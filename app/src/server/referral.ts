/**
 * mk-p0-2 referral loop: the server-side referral primitive.
 *
 * The loop closes here. A parent's stable code is an HMAC of their uid + a
 * server secret (no PII), surfaced as `ARBOR-XXXX`. When a referred parent
 * reaches activation (their family's first generated plan), the client POSTs the
 * captured code and BOTH parties earn one Plus month — written through the
 * existing `comp` entitlement seam (see entitlements.buildReferralGrant), never
 * masquerading as a RevenueCat event.
 *
 * Abuse guards: one activation credit per referred uid ever; self-referral
 * blocked; a referrer earns at most `referralMaxGrants` months; an active PAID
 * record (stripe/app_store/play_store) is never overwritten; a second comp month
 * extends `currentPeriodEnd` rather than stacking records.
 *
 * B-GROWTH-43: a family redeems ONE offer, ever. Before any grant the store
 * claims `offerRedemptions/{uid}` (create-if-absent), so a second code from
 * another referrer, a retry, or a second device racing the first is refused
 * with `already_activated` and grants nothing. A family a referrer ledger
 * already credits (it redeemed before the claim existed) is refused the same
 * way, and its claim is written then. The code (link or typed) is normalised
 * and resolved to its offer in lib/offers.ts, which also holds the grant
 * length; an unknown or self code never consumes the claim. If the family's
 * own grant fails, the claim and the ledger entry are released so a retry
 * can succeed.
 *
 * Privacy: codes carry no child data; the share link references the parent
 * account only. Pure helpers (`codeForUid`, alphabet) are unit-tested.
 */
import { createHmac } from "crypto";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import {
  buildReferralGrant,
  type EntitlementRecord,
  type EntitlementStore,
} from "./entitlements.js";
import { logger } from "./logger.js";
import { normalizeOfferCode, offerForCode, type OfferId, type RedemptionVia } from "../lib/offers.js";

/** Non-ambiguous alphabet — no 0/O/1/I so codes survive being read aloud. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LEN = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

/** B-GROWTH-43: the one redemption a family holds, at `offerRedemptions/{uid}`.
 *  Account-level: the offer, its version, how the code was entered and when.
 *  No referrer, no child, no code. */
export type OfferRedemption = {
  offerId: OfferId;
  offerVersion: number;
  via: RedemptionVia;
  at: string;
  /** True for a family that redeemed before the per-family claim existed,
   *  recorded from the referrer ledgers (referralGrants.activatedBy). */
  legacy?: boolean;
};

/** B-GROWTH-43: families a referrer ledger credits. Families that redeemed
 *  before the per-family claim existed have no `offerRedemptions` record; the
 *  ledgers are their record. Pure. */
export function legacyRedemptionsFromLedgers(ledgers: ReadonlyArray<{ activatedBy?: unknown }>): string[] {
  const uids = new Set<string>();
  for (const l of ledgers) {
    if (Array.isArray(l.activatedBy)) for (const u of l.activatedBy) if (typeof u === "string" && u) uids.add(u);
  }
  return [...uids];
}
export const OFFER_REDEMPTIONS_COLLECTION = "offerRedemptions";

/** Deterministic per-user code: HMAC(uid, secret) → 8 non-ambiguous chars. */
export const codeForUid = (uid: string, secret: string): string => {
  const digest = createHmac("sha256", secret).update(uid).digest();
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[digest[i] % ALPHABET.length];
  return `ARBOR-${out}`;
};

/** Per-referrer ledger: how many months earned + which uids were credited. */
export type ReferralGrantLedger = {
  uid: string;
  count: number;
  activatedBy: string[];
};

export type ActivationResult =
  | { ok: true; status: "granted"; earnedMonths: number; periodEnd: string }
  | { ok: true; status: "maxed"; earnedMonths: number }
  | { ok: true; status: "already_activated" }
  | { ok: false; status: "self_referral" | "unknown_code" };

export interface ReferralStore {
  /** Stable code for this uid; persists the `code → uid` mapping on first call. */
  codeForUid(uid: string): Promise<string>;
  /** Resolve a code back to the referrer uid (null if unknown). */
  uidForCode(code: string): Promise<string | null>;
  /** Months this referrer has already earned (for the "you've earned N" copy). */
  earnedMonths(uid: string): Promise<number>;
  /** Run the full activation: validate, grant both sides, dedupe. */
  activateReferral(input: { code: string; redeemerUid: string; via?: RedemptionVia }): Promise<ActivationResult>;
}

/** Shared activation core used by both stores; keeps guard logic in one place. */
abstract class BaseReferralStore implements ReferralStore {
  protected constructor(
    protected readonly secret: string,
    protected readonly maxGrants: number,
    protected readonly entitlements: EntitlementStore,
  ) {}

  abstract codeForUid(uid: string): Promise<string>;
  abstract uidForCode(code: string): Promise<string | null>;
  abstract earnedMonths(uid: string): Promise<number>;
  /** True the first time `redeemerUid` is recorded against `referrerUid`; the
   *  store increments the referrer ledger and persists the dedupe key atomically. */
  protected abstract recordActivation(referrerUid: string, redeemerUid: string): Promise<boolean>;
  /** B-GROWTH-43: true only for the family's FIRST redemption of any offer;
   *  atomic per uid (create-if-absent), so concurrent devices cannot both win. */
  protected abstract claimFamilyRedemption(redeemerUid: string, claim: OfferRedemption): Promise<boolean>;
  /** The family's redemption, or null when it has none. */
  abstract familyRedemption(uid: string): Promise<OfferRedemption | null>;
  /** True when any referrer ledger already credits this family (a redemption
   *  from before the per-family claim). */
  protected abstract creditedByAnyLedger(redeemerUid: string): Promise<boolean>;
  /** Undo a claim and a ledger entry whose grant failed, so a retry can succeed. */
  protected abstract releaseRedemption(referrerUid: string, redeemerUid: string): Promise<void>;

  async activateReferral({ code, redeemerUid, via = "link" }: { code: string; redeemerUid: string; via?: RedemptionVia }): Promise<ActivationResult> {
    const normalized = normalizeOfferCode(code);
    const offer = offerForCode(normalized);
    if (!offer || offer.grantDays === null) return { ok: false, status: "unknown_code" };
    const referrerUid = await this.uidForCode(normalized);
    if (!referrerUid) return { ok: false, status: "unknown_code" };
    if (referrerUid === redeemerUid) return { ok: false, status: "self_referral" };

    const at = new Date().toISOString();
    // A family a ledger already credits redeemed before the claim existed:
    // record that as its claim (once) and refuse, like any second redemption.
    if (await this.creditedByAnyLedger(redeemerUid)) {
      await this.claimFamilyRedemption(redeemerUid, { offerId: "referral_month", offerVersion: 1, via: "link", at, legacy: true });
      return { ok: true, status: "already_activated" };
    }

    // One redemption per family, claimed before anything is granted.
    const claimed = await this.claimFamilyRedemption(redeemerUid, { offerId: offer.id, offerVersion: offer.version, via, at });
    if (!claimed) return { ok: true, status: "already_activated" };

    const firstTime = await this.recordActivation(referrerUid, redeemerUid);
    if (!firstTime) return { ok: true, status: "already_activated" };

    // The redeemed parent always gets their month. If that grant fails, the
    // claim and the ledger entry are released and the error surfaces, so the
    // client's retry (lib/referralActivation rolls its device guard back) can
    // succeed instead of leaving the family claimed with nothing granted.
    let periodEnd: string;
    try {
      periodEnd = await this.extendGrant(redeemerUid, offer.grantDays);
    } catch (error) {
      await this.releaseRedemption(referrerUid, redeemerUid).catch((releaseError) =>
        logger.error("Referral claim release failed", releaseError, { referrerUid, redeemerUid }));
      throw error;
    }
    // The referrer gets one too, up to the cap; beyond the cap the invite still
    // "works" (200, no grant). A failed referrer grant never undoes the family's.
    const referrerEarned = await this.earnedMonths(referrerUid);
    if (offer.grantsReferrer && referrerEarned <= this.maxGrants) {
      try {
        await this.extendGrant(referrerUid, offer.grantDays);
      } catch (error) {
        logger.error("Referrer grant failed", error, { referrerUid, redeemerUid });
      }
      logger.info("Referral activated", { referrerUid, redeemerUid, referrerEarned });
      return { ok: true, status: "granted", earnedMonths: referrerEarned, periodEnd };
    }
    logger.info("Referral activated past cap (no referrer grant)", { referrerUid, redeemerUid });
    return { ok: true, status: "maxed", earnedMonths: this.maxGrants };
  }

  /**
   * Read-before-write comp grant. Never clobbers an active PAID record; if a comp
   * referral month already exists, push its period end out by 30d (extend, not
   * stack). Returns the resulting `currentPeriodEnd`.
   */
  protected async extendGrant(uid: string, days: number): Promise<string> {
    const current = this.entitlements.getRecord ? await this.entitlements.getRecord(uid) : null;
    const base = this.grantBase(current);
    const periodEnd = new Date(base + days * DAY_MS).toISOString();
    const record = buildReferralGrant(periodEnd);
    if (this.entitlements.setEntitlement) await this.entitlements.setEntitlement(uid, record);
    return periodEnd;
  }

  /** Base time to extend from: an active comp referral's existing end (if still
   *  in future), otherwise now. Paid records are honored by `shouldGrant`. */
  private grantBase(current: EntitlementRecord | null): number {
    if (
      current?.provider === "comp" &&
      current.productId === "referral_month" && // entitlements.buildReferralGrant's productId
      current.currentPeriodEnd
    ) {
      const end = Date.parse(current.currentPeriodEnd);
      if (Number.isFinite(end) && end > Date.now()) return end;
    }
    return Date.now();
  }
}

/** In-memory store for local/dev + tests. */
export class LocalReferralStore extends BaseReferralStore {
  private codes = new Map<string, string>(); // code → uid
  private ledgers = new Map<string, ReferralGrantLedger>(); // referrerUid → ledger
  private redemptions = new Map<string, OfferRedemption>(); // redeemerUid → its one redemption

  constructor(secret: string, maxGrants: number, entitlements: EntitlementStore) {
    super(secret, maxGrants, entitlements);
  }

  async codeForUid(uid: string): Promise<string> {
    const code = codeForUid(uid, this.secret);
    this.codes.set(code, uid);
    return code;
  }
  async uidForCode(code: string): Promise<string | null> {
    return this.codes.get(code.trim().toUpperCase()) ?? null;
  }
  async earnedMonths(uid: string): Promise<number> {
    return this.ledgers.get(uid)?.count ?? 0;
  }
  protected async recordActivation(referrerUid: string, redeemerUid: string): Promise<boolean> {
    const ledger = this.ledgers.get(referrerUid) ?? { uid: referrerUid, count: 0, activatedBy: [] };
    if (ledger.activatedBy.includes(redeemerUid)) return false;
    ledger.activatedBy.push(redeemerUid);
    ledger.count += 1;
    this.ledgers.set(referrerUid, ledger);
    return true;
  }
  protected async claimFamilyRedemption(redeemerUid: string, claim: OfferRedemption): Promise<boolean> {
    if (this.redemptions.has(redeemerUid)) return false;
    this.redemptions.set(redeemerUid, claim);
    return true;
  }
  async familyRedemption(uid: string): Promise<OfferRedemption | null> {
    return this.redemptions.get(uid) ?? null;
  }
  protected async creditedByAnyLedger(redeemerUid: string): Promise<boolean> {
    return legacyRedemptionsFromLedgers([...this.ledgers.values()]).includes(redeemerUid);
  }
  protected async releaseRedemption(referrerUid: string, redeemerUid: string): Promise<void> {
    this.redemptions.delete(redeemerUid);
    const ledger = this.ledgers.get(referrerUid);
    if (ledger && ledger.activatedBy.includes(redeemerUid)) {
      ledger.activatedBy = ledger.activatedBy.filter((u) => u !== redeemerUid);
      ledger.count = Math.max(0, ledger.count - 1);
    }
  }
  /** Test seam: a ledger as it stood before the per-family claim existed. */
  seedLegacyLedger(referrerUid: string, activatedBy: string[]): void {
    this.ledgers.set(referrerUid, { uid: referrerUid, count: activatedBy.length, activatedBy: [...activatedBy] });
  }

  /** Override the comp grant so the conflict guard is honored without a record
   *  store in dev: skip the write when an active PAID record is present. */
  protected async extendGrant(uid: string, days: number): Promise<string> {
    const current = this.entitlements.getRecord ? await this.entitlements.getRecord(uid) : null;
    if (isActivePaid(current)) {
      return current?.currentPeriodEnd ?? new Date(Date.now() + days * DAY_MS).toISOString();
    }
    return super.extendGrant(uid, days);
  }
}

/** Firestore-backed store. `referralCodes` {code→uid}; `referralGrants` ledger. */
export class FirestoreReferralStore extends BaseReferralStore {
  private readonly db;
  constructor(config: ArborConfig, entitlements: EntitlementStore) {
    super(config.referralSecret, config.referralMaxGrants, entitlements);
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  async codeForUid(uid: string): Promise<string> {
    const code = codeForUid(uid, this.secret);
    await this.db.collection("referralCodes").doc(code).set({ uid }, { merge: true });
    return code;
  }
  async uidForCode(code: string): Promise<string | null> {
    const snap = await this.db.collection("referralCodes").doc(code.trim().toUpperCase()).get();
    const uid = snap.data()?.uid;
    return typeof uid === "string" ? uid : null;
  }
  async earnedMonths(uid: string): Promise<number> {
    const snap = await this.db.collection("referralGrants").doc(uid).get();
    const count = snap.data()?.count;
    return typeof count === "number" ? count : 0;
  }
  protected async recordActivation(referrerUid: string, redeemerUid: string): Promise<boolean> {
    const ref = this.db.collection("referralGrants").doc(referrerUid);
    return this.db.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data() as ReferralGrantLedger | undefined;
      const activatedBy: string[] = Array.isArray(data?.activatedBy) ? data!.activatedBy : [];
      if (activatedBy.includes(redeemerUid)) return false;
      tx.set(ref, {
        uid: referrerUid,
        count: (typeof data?.count === "number" ? data.count : 0) + 1,
        activatedBy: [...activatedBy, redeemerUid],
      }, { merge: true });
      return true;
    });
  }
  protected async claimFamilyRedemption(redeemerUid: string, claim: OfferRedemption): Promise<boolean> {
    try {
      // create() fails when the document exists: the per-uid claim is atomic.
      await this.db.collection(OFFER_REDEMPTIONS_COLLECTION).doc(redeemerUid).create(claim);
      return true;
    } catch (error) {
      const e = error as { code?: unknown; message?: unknown };
      if (e?.code === 6 || e?.code === "already-exists" || /ALREADY_EXISTS/i.test(String(e?.message ?? ""))) return false;
      throw error;
    }
  }
  async familyRedemption(uid: string): Promise<OfferRedemption | null> {
    const data = (await this.db.collection(OFFER_REDEMPTIONS_COLLECTION).doc(uid).get()).data();
    return data ? (data as OfferRedemption) : null;
  }
  protected async creditedByAnyLedger(redeemerUid: string): Promise<boolean> {
    const snap = await this.db.collection("referralGrants").where("activatedBy", "array-contains", redeemerUid).limit(1).get();
    return !snap.empty;
  }
  protected async releaseRedemption(referrerUid: string, redeemerUid: string): Promise<void> {
    await this.db.collection(OFFER_REDEMPTIONS_COLLECTION).doc(redeemerUid).delete();
    const ref = this.db.collection("referralGrants").doc(referrerUid);
    await this.db.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data() as ReferralGrantLedger | undefined;
      const activatedBy: string[] = Array.isArray(data?.activatedBy) ? data!.activatedBy : [];
      if (!activatedBy.includes(redeemerUid)) return;
      tx.set(ref, {
        activatedBy: activatedBy.filter((u) => u !== redeemerUid),
        count: Math.max(0, (typeof data?.count === "number" ? data.count : 1) - 1),
      }, { merge: true });
    });
  }
  protected async extendGrant(uid: string, days: number): Promise<string> {
    const current = this.entitlements.getRecord ? await this.entitlements.getRecord(uid) : null;
    if (isActivePaid(current)) {
      return current?.currentPeriodEnd ?? new Date(Date.now() + days * DAY_MS).toISOString();
    }
    return super.extendGrant(uid, days);
  }
}

/** A still-active subscription bought through a real billing provider. */
export const isActivePaid = (record: EntitlementRecord | null): boolean => {
  if (!record) return false;
  const paid = record.provider === "stripe" || record.provider === "app_store" || record.provider === "play_store";
  if (!paid) return false;
  if (record.status === "expired") return false;
  if (record.currentPeriodEnd) {
    const end = Date.parse(record.currentPeriodEnd);
    if (Number.isFinite(end) && end < Date.now() && record.willRenew === false) return false;
  }
  return true;
};

export const createReferralStore = (config: ArborConfig, entitlements: EntitlementStore): ReferralStore =>
  config.memoryAdapter === "firestore"
    ? new FirestoreReferralStore(config, entitlements)
    : new LocalReferralStore(config.referralSecret, config.referralMaxGrants, entitlements);
