/**
 * B-INF-02 — the weekly digest send job (Cloud Scheduler → POST
 * /api/jobs/weekly-digest). Replaces the hand trigger (`window.__arborDigestSend`,
 * deleted in the same commit).
 *
 * WHAT ONE RUN DOES
 * ─────────────────
 * For every `digestOptIn/{uid}` row (bounded): the SAME four fail-closed axes
 * the hand route used (`decideDigestSend`: consent, verified address, provider
 * enabled, ≥6 days since the last send) decide; a "go" builds the email with
 * `buildDigestEmail` (server/digest.ts — the only sanctioned renderer) from
 * server-read counts and the server-side CompanionContext, scans the body
 * through the clinical firewall, sends, and stamps `lastSentAt`. Idempotent
 * within 6 days per uid because the stamp is the gate. A dry run decides and
 * renders but never sends and never stamps.
 *
 * WHAT IT READS — counts, never free text (G-14): moment timestamps / resolved
 * flags / context / type for the counts, milestone checked flags, the child's
 * first name for the greeting, and the parent's own action ledger (the last
 * step they reported helped). Moment notes are never read.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import {
  buildDigestEmail,
  computeWeeklyDigestStats,
  fallbackDigestNarrative,
  type DigestEmailRender,
} from "./digest.js";
import {
  decideDigestSend,
  isDigestSendRefused,
  DIGEST_OPTIN_COLLECTION,
  type DigestLanguage,
  type DigestOptInRow,
  type DigestSendRefusal,
  type VerifiedEmailResolver,
} from "./digestOptIn.js";
import type { DigestEmailMessage } from "./emailProvider.js";
import { projectAcceptedActions, type CompanionAction } from "./companionContext.js";

/* ── seams ──────────────────────────────────────────────────────────────── */

export type DigestJobChild = {
  childId: string;
  firstName: string;
  logs: Array<{ timestamp: string; resolved?: boolean; context?: string; behaviorType?: string }>;
  milestones: Array<{ checked: boolean }>;
  /** Raw actionLoops rows (projected through CompanionContext here). */
  actionLoops: unknown[];
};

export interface DigestJobSource {
  /** Opt-in rows, bounded. */
  listOptIns(limit: number): Promise<Array<{ uid: string; row: DigestOptInRow }>>;
  /** The account's children, counts-only fields. */
  loadFamily(uid: string): Promise<DigestJobChild[]>;
  markSent(uid: string, atIso: string): Promise<void>;
  /** First-party census row (`users/{uid}/events`), `{result}` only. */
  recordResult(uid: string, result: string): Promise<void>;
}

export type DigestJobResult = DigestSendRefusal | "sent" | "would_send" | "no_child_record" | "firewall_blocked" | "send_failed";

export type DigestJobReport = {
  dryRun: boolean;
  considered: number;
  results: Partial<Record<DigestJobResult, number>>;
  ranAt: string;
};

export const DIGEST_JOB_MAX_ROWS = 2000;

/* ── the firewall scan on the email body ────────────────────────────────── */

/** A denominator, a share, a comparison or a verdict word. Counts are fine;
 *  "X of Y", "%", "more than last week", "on track", "behind" are not. */
export const DIGEST_BODY_FIREWALL =
  /%|\b\d+\s+(?:of|out of)\s+\d+\b|מתוך|\bthan last week\b|\blast week\b|\bon track\b|\bbehind\b|\bscore\b|\bdelay(?:ed)?\b|\bat risk\b|בפיגור|ציון/i;

export function digestBodyViolations(email: DigestEmailRender): string[] {
  const out: string[] = [];
  for (const [field, text] of Object.entries(email)) {
    const m = DIGEST_BODY_FIREWALL.exec(text);
    if (m) out.push(`${field}: "${m[0]}"`);
  }
  return out;
}

/* ── rendering ──────────────────────────────────────────────────────────── */

/** The parent's own words, carried forward: the last step they said helped. */
export function keepGoingLine(actions: readonly CompanionAction[], language: DigestLanguage): string | null {
  const helped = actions.find((a) => a.status === "completed" && a.outcome === "helped");
  if (!helped) return null;
  const step = helped.recommendation.length > 120 ? `${helped.recommendation.slice(0, 119).trimEnd()}…` : helped.recommendation;
  return language === "he"
    ? `להמשיך עם „${step}” — אמרתם שזה עזר.`
    : `Keep going with “${step}” — you said it helped.`;
}

/** One email per account: a section per child, one subject. */
export function renderFamilyDigest(children: readonly DigestJobChild[], language: DigestLanguage, now: number): DigestEmailRender {
  const parts = children.map((child) => {
    // Counts only: the stats read timestamp / resolved / context / type, never intensity or notes.
    const stats = computeWeeklyDigestStats(child.logs as Parameters<typeof computeWeeklyDigestStats>[0], child.milestones as Parameters<typeof computeWeeklyDigestStats>[1], now);
    const narrative = fallbackDigestNarrative(child.firstName, stats, language);
    const keepGoing = keepGoingLine(projectAcceptedActions(child.actionLoops), language);
    return buildDigestEmail({
      childName: child.firstName,
      language,
      narrative: keepGoing ? { ...narrative, tryThisWeek: keepGoing } : narrative,
      stats,
    });
  });
  if (parts.length === 1) return parts[0];
  return {
    subject: language === "he" ? "יש תובנה חדשה על המשפחה שלכם 💚" : "A new insight about your family is waiting 💚",
    preheader: parts[0].preheader,
    bodyText: parts.map((p) => p.bodyText).join("\n\n———\n\n"),
  };
}

/* ── the run ────────────────────────────────────────────────────────────── */

export async function runWeeklyDigestJob(deps: {
  source: DigestJobSource;
  resolveVerifiedEmail: VerifiedEmailResolver;
  providerEnabled: boolean;
  send: (msg: DigestEmailMessage) => Promise<{ sent: boolean }>;
  now: number;
  dryRun: boolean;
}): Promise<DigestJobReport> {
  const { source, now, dryRun } = deps;
  const results: DigestJobReport["results"] = {};
  const count = (r: DigestJobResult) => { results[r] = (results[r] ?? 0) + 1; };
  const rows = await source.listOptIns(DIGEST_JOB_MAX_ROWS);
  for (const { uid, row } of rows) {
    let result: DigestJobResult;
    try {
      const verified = await deps.resolveVerifiedEmail({ uid, email: null });
      const decision = decideDigestSend({ row, verified, providerEnabled: deps.providerEnabled, now });
      if (isDigestSendRefused(decision)) {
        result = decision.reason;
      } else {
        const family = await source.loadFamily(uid);
        if (family.length === 0) {
          result = "no_child_record";
        } else {
          const email = renderFamilyDigest(family, decision.language, now);
          if (digestBodyViolations(email).length > 0) {
            result = "firewall_blocked";
          } else if (dryRun) {
            result = "would_send";
          } else {
            const sent = await deps.send({ to: decision.to, ...email });
            if (sent.sent) {
              await source.markSent(uid, new Date(now).toISOString());
              result = "sent";
            } else {
              result = "provider_disabled";
            }
          }
        }
      }
    } catch {
      // Status only — the body summarises a real child's week and is never logged.
      result = "send_failed";
    }
    count(result);
    if (!dryRun) {
      try { await source.recordResult(uid, result); } catch { /* census is best-effort */ }
    }
  }
  return { dryRun, considered: rows.length, results, ranAt: new Date(now).toISOString() };
}

/* ── caller authentication: Cloud Scheduler's OIDC token ────────────────── */

export type JobCallerVerifier = (authorization: string | undefined) => Promise<boolean>;

/**
 * The job is callable ONLY by the scheduler's service account: a Google-signed
 * OIDC ID token whose audience is this endpoint and whose verified email is
 * `ARBOR_JOB_SA`. Unset `ARBOR_JOB_SA` = nobody may call (fail closed).
 */
export const createOidcJobVerifier = (env: Record<string, string | undefined>, defaultAudience: string): JobCallerVerifier => {
  const serviceAccount = (env.ARBOR_JOB_SA ?? "").trim();
  const audience = (env.ARBOR_JOB_AUDIENCE ?? "").trim() || defaultAudience;
  return async (authorization) => {
    if (!serviceAccount) return false;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token) return false;
    try {
      const { OAuth2Client } = await import("google-auth-library");
      const ticket = await new OAuth2Client().verifyIdToken({ idToken: token, audience });
      const payload = ticket.getPayload();
      return !!payload && payload.email === serviceAccount && payload.email_verified === true;
    } catch {
      return false;
    }
  };
};

/* ── Firestore source (Cloud Run ADC) ───────────────────────────────────── */

const DAY_MS = 86_400_000;

export class FirestoreDigestJobSource implements DigestJobSource {
  private readonly db: Firestore;
  constructor(config: ArborConfig) {
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    this.db = getFirestore(config.firestoreDatabaseId);
  }

  async listOptIns(limit: number) {
    const snap = await this.db.collection(DIGEST_OPTIN_COLLECTION).limit(limit).get();
    const out: Array<{ uid: string; row: DigestOptInRow }> = [];
    for (const d of snap.docs) {
      const data = d.data();
      if (typeof data.email !== "string" || !data.email) continue;
      out.push({
        uid: d.id,
        row: {
          email: data.email,
          language: data.language === "he" ? "he" : "en",
          optedInAt: typeof data.optedInAt === "string" ? data.optedInAt : new Date(0).toISOString(),
          lastSentAt: typeof data.lastSentAt === "string" ? data.lastSentAt : null,
        },
      });
    }
    return out;
  }

  async loadFamily(uid: string): Promise<DigestJobChild[]> {
    const kids = await this.db.collection(`users/${uid}/children`).limit(6).get();
    const since = new Date(Date.now() - 14 * DAY_MS).toISOString();
    const out: DigestJobChild[] = [];
    for (const kid of kids.docs) {
      const ref = kid.ref;
      const [logs, milestones, loops] = await Promise.all([
        ref.collection("behaviorLogs").where("timestamp", ">=", since).select("timestamp", "resolved", "context", "behaviorType").get(),
        ref.collection("milestones").select("checked").get(),
        ref.collection("actionLoops").orderBy("acceptedAt", "desc").limit(10).get(),
      ]);
      const name = typeof kid.data().name === "string" ? String(kid.data().name).trim().split(/\s+/)[0] : "";
      out.push({
        childId: kid.id,
        firstName: name || "your child",
        logs: logs.docs.map((d) => d.data() as DigestJobChild["logs"][number]),
        milestones: milestones.docs.map((d) => ({ checked: d.data().checked === true })),
        actionLoops: loops.docs.map((d) => d.data()),
      });
    }
    return out;
  }

  async markSent(uid: string, atIso: string) {
    await this.db.collection(DIGEST_OPTIN_COLLECTION).doc(uid).set({ lastSentAt: atIso }, { merge: true });
  }

  async recordResult(uid: string, result: string) {
    await this.db.collection(`users/${uid}/events`).add({ event: "digest_email_send", props: { result, via: "job" }, at: FieldValue.serverTimestamp() });
  }
}

/** Local/sandbox: nothing opted in, nothing sent. */
export class NullDigestJobSource implements DigestJobSource {
  async listOptIns() { return []; }
  async loadFamily() { return []; }
  async markSent() { /* none */ }
  async recordResult() { /* none */ }
}

export const createDigestJobSource = (config: ArborConfig): DigestJobSource =>
  config.memoryAdapter === "firestore" ? new FirestoreDigestJobSource(config) : new NullDigestJobSource();
