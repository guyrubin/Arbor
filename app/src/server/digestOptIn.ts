/**
 * digestOptIn — N1-07 (OBJ-INF-03): the wire the weekly recap email never had.
 *
 * THE DEFECT THIS CLOSES
 * ──────────────────────
 * `server/emailProvider.ts` says "no code change is required" — true about the
 * PROVIDER, false about DELIVERY. On d588755c `sendWeeklyDigestEmail` had ZERO
 * callers, there was no send route, and the opt-in lived in `localStorage`
 * only (`components/weekly/recapEmail.ts`, key `arbor.recap.emailOptIn`). The
 * server therefore knew neither WHO had opted in nor WHAT ADDRESS to send to.
 * Flipping EMAIL_PROVIDER=resend sent nothing to nobody. This module is the
 * missing half: a server-side row per family, and the decision function that
 * refuses to send.
 *
 * WHAT IS STORED — `digestOptIn/{uid}`, top-level:
 *   { email, language, optedInAt, lastSentAt }
 * Four fields, pinned by DIGEST_OPTIN_DOC_KEYS. NO child data, no name, no
 * digest body, no counts: this row is a mailing consent, not a record of a
 * family. The address is captured from the AUTHENTICATED user's VERIFIED
 * Firebase email at opt-in time and never from a request body — see
 * `resolveDigestRecipient` and the guard's `req.body.email` negative control.
 *
 * FAIL-CLOSED ON FOUR AXES (decideDigestSend, in refusal order):
 *   1. no server-side opt-in row          → not_opted_in
 *   2. address not currently verified, or
 *      no longer the address consented to → unverified_address
 *   3. unset provider / missing creds     → provider_disabled
 *   4. lastSentAt within 6 days           → already_sent_this_week
 * Axes 1+2 outrank the provider so the day-0 answer stays honest whether or
 * not the env is armed; axis 4 is last because nothing can be "already sent"
 * through a channel that cannot send. A send is the ONLY path that reaches a
 * real parent's inbox, so every axis returns a typed refusal and the sender is
 * called zero times.
 *
 * VERIFICATION IS RE-CHECKED AT SEND TIME, not trusted from the row. A row is
 * only ever written for a verified address, and the send additionally requires
 * that the SAME address is still verified now — so a self-written row (the
 * rules deny client writes, but defence in depth) or a since-changed address
 * can never be mailed.
 *
 * WHAT THIS MODULE IS NOT: a scheduler. There is no cron, no Cloud Function
 * and no lapse arm in this wave. `/digest/email-send` is admin-gated and
 * triggered by hand. The 6-day window is written here so that the day a
 * scheduler does arrive, a double-trigger still cannot double-mail a parent.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { logger } from "./logger.js";

/** Top-level collection. One document per family, id = uid. */
export const DIGEST_OPTIN_COLLECTION = "digestOptIn";

/** The complete key set of a stored opt-in document, sorted.
 *  Pinned by the guard: a new key here is a privacy review, not a patch. */
export const DIGEST_OPTIN_DOC_KEYS = ["email", "language", "lastSentAt", "optedInAt"] as const;

/** Body language for the digest. Mirrors buildDigestEmail's `language`. */
export type DigestLanguage = "en" | "he";

export interface DigestOptInRow {
  /** The verified address consented to at opt-in time. Never from a body. */
  email: string;
  /** Which localisation of the body this parent chose. */
  language: DigestLanguage;
  /** ISO instant the opt-in was recorded. */
  optedInAt: string;
  /** ISO instant of the last SUCCESSFUL send, or null. Drives idempotence. */
  lastSentAt: string | null;
}

export interface DigestOptInStore {
  get(uid: string): Promise<DigestOptInRow | null>;
  put(uid: string, row: DigestOptInRow): Promise<void>;
  remove(uid: string): Promise<void>;
  /** Stamp a successful send. Separate from put() so a send can never
   *  rewrite the consented address or the opt-in timestamp. */
  markSent(uid: string, atIso: string): Promise<void>;
}

/** Local/sandbox: no store, so nothing is remembered and nothing 500s. A send
 *  attempted here always refuses with `not_opted_in` — the honest answer when
 *  there is no durable consent to read. Same posture as NullAdminMetricsStore. */
export class NullDigestOptInStore implements DigestOptInStore {
  async get(): Promise<DigestOptInRow | null> { return null; }
  async put(): Promise<void> { /* no durable store locally */ }
  async remove(): Promise<void> { /* no durable store locally */ }
  async markSent(): Promise<void> { /* no durable store locally */ }
}

export class FirestoreDigestOptInStore implements DigestOptInStore {
  private readonly db: Firestore;

  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }

  private docRef(uid: string) {
    return this.db.collection(DIGEST_OPTIN_COLLECTION).doc(uid);
  }

  async get(uid: string): Promise<DigestOptInRow | null> {
    try {
      const snap = await this.docRef(uid).get();
      const data = snap.exists ? snap.data() : null;
      if (!data) return null;
      const email = typeof data.email === "string" ? data.email : "";
      if (!email) return null;
      return {
        email,
        language: data.language === "he" ? "he" : "en",
        optedInAt: typeof data.optedInAt === "string" ? data.optedInAt : new Date(0).toISOString(),
        lastSentAt: typeof data.lastSentAt === "string" ? data.lastSentAt : null,
      };
    } catch (error) {
      // Fail CLOSED: an unreadable row is "no consent", never "send anyway".
      logger.error("Digest opt-in read failed", error);
      return null;
    }
  }

  async put(uid: string, row: DigestOptInRow): Promise<void> {
    await this.docRef(uid).set({
      email: row.email,
      language: row.language,
      optedInAt: row.optedInAt,
      lastSentAt: row.lastSentAt,
    });
  }

  async remove(uid: string): Promise<void> {
    await this.docRef(uid).delete();
  }

  async markSent(uid: string, atIso: string): Promise<void> {
    await this.docRef(uid).set({ lastSentAt: atIso }, { merge: true });
  }
}

export const createDigestOptInStore = (config: ArborConfig): DigestOptInStore =>
  config.memoryAdapter === "firestore" ? new FirestoreDigestOptInStore(config) : new NullDigestOptInStore();

/* ── the address: authenticated + verified, never a request body ─────────── */

export type VerifiedEmail = { email: string | null; verified: boolean };

/** The identity seam. Injectable so the guard can drive every branch without
 *  firebase-admin, and so the route never has to reach for `req.body`. */
export type VerifiedEmailResolver = (actor: {
  uid: string;
  email: string | null;
  emailVerified?: boolean;
}) => Promise<VerifiedEmail>;

/**
 * Default resolver. Prefers the verified claim the auth middleware decoded;
 * falls back to an Admin SDK user lookup, which is authoritative. ANY failure
 * — no credentials, unknown uid, network — resolves to unverified, because the
 * consequence of guessing wrong is mail to an address a parent never proved.
 *
 * NOTE (cross-file residue, filed in FOLLOW-UPS-N1.md): `authMiddleware.ts`
 * currently attaches only `{ uid, email }`, dropping `decoded.email_verified`,
 * so the fast path never fires and every opt-in costs one Admin SDK lookup.
 * Correct but wasteful; the one-line fix belongs to that file's owner.
 */
export const firebaseVerifiedEmailResolver: VerifiedEmailResolver = async (actor) => {
  if (actor.emailVerified === true && actor.email) return { email: actor.email, verified: true };
  if (!actor.uid || actor.uid === "local-sandbox") return { email: null, verified: false };
  try {
    const { getAuth } = await import("firebase-admin/auth");
    const user = await getAuth().getUser(actor.uid);
    return { email: user.email ?? null, verified: user.emailVerified === true };
  } catch (error) {
    logger.warn("Verified-email lookup unavailable — treating address as unverified", {
      errorMessage: (error as { message?: string })?.message,
    });
    return { email: null, verified: false };
  }
};

const sameAddress = (a: string | null, b: string | null): boolean =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/* ── the decision: pure, so every refusal is testable ────────────────────── */

/** Minimum whole days between two sends to the same family. A send inside the
 *  window is refused, so a double-trigger (or a future scheduler retrying)
 *  cannot double-mail a parent. "Within 6 days" is strict: at exactly 6 days
 *  elapsed the next weekly send is allowed. */
export const DIGEST_SEND_MIN_INTERVAL_DAYS = 6;

/** Refusal tokens. MUST stay in sync with `DIGEST_SEND_RESULTS` in
 *  lib/kpiEvents.ts — the analytics helper rejects anything outside that list,
 *  so a token invented here would be silently dropped from the census. */
export type DigestSendRefusal =
  | "not_opted_in"
  | "unverified_address"
  | "provider_disabled"
  | "already_sent_this_week";

export type DigestSendDecision =
  | { send: true; to: string; language: DigestLanguage }
  | { send: false; reason: DigestSendRefusal };

const DAY_MS = 86_400_000;

/**
 * The four fail-closed axes, in refusal order. Pure: no I/O, no Date.now(),
 * no provider, no store — the caller supplies every fact, which is what makes
 * "the sender was called zero times" provable rather than asserted.
 */
export function decideDigestSend(input: {
  row: DigestOptInRow | null;
  verified: VerifiedEmail;
  providerEnabled: boolean;
  now: number;
}): DigestSendDecision {
  const { row, verified, providerEnabled, now } = input;

  // 1. No durable consent. Nothing else matters.
  if (!row || !row.email) return { send: false, reason: "not_opted_in" };

  // 2. The consented address must still be a verified address on the account.
  if (!verified.verified || !sameAddress(verified.email, row.email)) {
    return { send: false, reason: "unverified_address" };
  }

  // 3. The channel itself: unset provider OR missing credentials both land here
  //    (resolveEmailProvider folds them into one `enabled: false`).
  if (!providerEnabled) return { send: false, reason: "provider_disabled" };

  // 4. Idempotence. An unparseable stamp is treated as "sent just now" —
  //    fail-closed, because the alternative is mailing a parent twice.
  if (row.lastSentAt) {
    const last = Date.parse(row.lastSentAt);
    if (!Number.isFinite(last)) return { send: false, reason: "already_sent_this_week" };
    if (now - last < DIGEST_SEND_MIN_INTERVAL_DAYS * DAY_MS) {
      return { send: false, reason: "already_sent_this_week" };
    }
  }

  return { send: true, to: row.email, language: row.language };
}

/* ── opt-in ──────────────────────────────────────────────────────────────── */

export type DigestOptInResult =
  | { optedIn: true; row: DigestOptInRow }
  | { optedIn: false; reason: "unverified_address" };

/**
 * Build the row for an opt-in. The address argument is a RESOLVED verified
 * identity — there is deliberately no parameter that a request body could
 * reach, so no future edit at a call site can introduce one.
 */
export function buildDigestOptIn(input: {
  verified: VerifiedEmail;
  language: unknown;
  now: Date;
  previous?: DigestOptInRow | null;
}): DigestOptInResult {
  const { verified, previous } = input;
  if (!verified.verified || !verified.email) return { optedIn: false, reason: "unverified_address" };
  const email = verified.email.trim();
  // A re-opt-in at the SAME address keeps its send stamp, so toggling off and
  // on again is not a way to bypass the 6-day window. A different address is a
  // new consent and starts clean.
  const lastSentAt = previous && sameAddress(previous.email, email) ? previous.lastSentAt : null;
  return {
    optedIn: true,
    row: {
      email,
      language: input.language === "he" ? "he" : "en",
      optedInAt: input.now.toISOString(),
      lastSentAt,
    },
  };
}
