/**
 * MON-1: the Free vs Plus entitlement layer (Phase 3 monetization).
 *
 * This is the billing-agnostic seam: a billing provider (Stripe/RevenueCat
 * webhook) only has to write `{ plan: "plus" }` to `entitlements/{uid}` in
 * Firestore and the whole product gates itself. Until billing exists:
 *
 *  - ENFORCE_ENTITLEMENTS=false: everyone resolves to "plus", so a private beta
 *    can keep full access. Production defaults to enforced even if the env var
 *    is missing, so an omitted Cloud Run flag cannot leak Plus.
 *  - ARBOR_FAMILY_* / ARBOR_PLUS_* (UIDS|EMAILS) env lists grant Family / Plus
 *    manually (founder + example/demo accounts, comped testers) without touching
 *    Firestore. Family wins (it's the superset). Pair with ARBOR_ADMIN_EMAILS to
 *    also unlock the founder dashboard.
 *
 * Free meters the coach and keeps single-child; Plus adds unlimited coaching,
 * professional reports/handoffs, advanced plans, and multi-child.
 */
import type { RequestHandler } from "express";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import type { UsageCounterStore } from "./quotaStore.js";
import { logger } from "./logger.js";

export type Plan = "free" | "plus" | "family";

/** Lifecycle of a paid entitlement, mirrored from the billing provider. */
export type EntitlementStatus = "active" | "in_trial" | "grace_period" | "canceled" | "expired";
/** Where the active subscription was bought. `comp` = manual env grant. */
export type BillingProvider = "stripe" | "app_store" | "play_store" | "comp" | "none";

export type PlanLimits = {
  /** Coach + council messages per day; null = unlimited. */
  coachMessagesPerDay: number | null;
  maxChildren: number;
  professionalReports: boolean;
  advancedPlans: boolean;
  /** Shared-access adults beyond the account owner (co-parent seats). Family = 1. */
  coParentSeats: number;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    coachMessagesPerDay: Number(process.env.FREE_COACH_MESSAGES_PER_DAY || 10),
    maxChildren: 1,
    professionalReports: false,
    advancedPlans: false,
    coParentSeats: 0,
  },
  plus: {
    coachMessagesPerDay: null,
    maxChildren: 6,
    professionalReports: true,
    advancedPlans: true,
    coParentSeats: 0,
  },
  family: {
    coachMessagesPerDay: null,
    maxChildren: 6,
    professionalReports: true,
    advancedPlans: true,
    coParentSeats: 1,
  },
};

/**
 * The shape persisted at `entitlements/{uid}` — written by the billing webhook
 * (see server/billing.ts), read by the resolver and the Account screen.
 */
export type EntitlementRecord = {
  plan: Plan;
  status?: EntitlementStatus;
  provider?: BillingProvider;
  productId?: string | null;
  /** True while the subscription is set to auto-renew. */
  willRenew?: boolean;
  /** ISO 8601 end of the current paid period (renewal or expiry date). */
  currentPeriodEnd?: string | null;
  /** RevenueCat's stable cross-platform user id, for support/debugging. */
  rcOriginalAppUserId?: string | null;
  /** Idempotency: the billing event id + its timestamp (ms). Writes for an event
   *  not newer than the stored one are skipped (dedupes resends + out-of-order). */
  lastEventId?: string;
  lastEventTs?: number;
  updatedAt?: string;
};

export type Entitlement = {
  plan: Plan;
  limits: PlanLimits;
  source: "default" | "env" | "store" | "beta_unenforced";
  enforced: boolean;
  status?: EntitlementStatus;
  provider?: BillingProvider;
  currentPeriodEnd?: string | null;
  willRenew?: boolean;
};

const flag = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : ["1", "true", "yes", "on"].includes(value.toLowerCase());

export const entitlementsEnforced = () =>
  flag(process.env.ENFORCE_ENTITLEMENTS, (process.env.ARBOR_ENV || "").toLowerCase() === "prod");

const envList = (name: string) =>
  (process.env[name] || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export interface EntitlementStore {
  getPlan(uid: string): Promise<Plan | null>;
  /** Full stored record (plan + status + renewal) for display + lifecycle logic. */
  getRecord?(uid: string): Promise<EntitlementRecord | null>;
  /** Persist a billing event into the seam. Read-only stores omit this. */
  setEntitlement?(uid: string, record: EntitlementRecord): Promise<void>;
}

const isPlan = (value: unknown): value is Plan =>
  value === "free" || value === "plus" || value === "family";

export class NullEntitlementStore implements EntitlementStore {
  async getPlan() { return null; }
  async getRecord() { return null; }
  async setEntitlement(uid: string, record: EntitlementRecord) {
    // Local/sandbox has no billing backend; log so webhook wiring is observable in dev.
    logger.info("Entitlement write skipped (NullEntitlementStore)", { uid, plan: record.plan, status: record.status ?? null });
  }
}

/** Reads + writes `entitlements/{uid}` — the doc the billing webhook maintains. */
export class FirestoreEntitlementStore implements EntitlementStore {
  private readonly db;
  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  async getRecord(uid: string): Promise<EntitlementRecord | null> {
    try {
      const snap = await this.db.collection("entitlements").doc(uid).get();
      const data = snap.data();
      if (!data || !isPlan(data.plan)) return null;
      const periodEnd = typeof data.currentPeriodEnd === "string"
        ? data.currentPeriodEnd
        : (data.currentPeriodEnd?.toDate?.().toISOString() ?? null);
      return {
        plan: data.plan,
        status: data.status,
        provider: data.provider,
        productId: data.productId ?? null,
        willRenew: data.willRenew,
        currentPeriodEnd: periodEnd,
        rcOriginalAppUserId: data.rcOriginalAppUserId ?? null,
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
      };
    } catch (error) {
      logger.error("Entitlement store read failed — defaulting", error, { uid });
      return null;
    }
  }
  async getPlan(uid: string): Promise<Plan | null> {
    return (await this.getRecord(uid))?.plan ?? null;
  }
  async setEntitlement(uid: string, record: EntitlementRecord): Promise<void> {
    const ref = this.db.collection("entitlements").doc(uid);
    // Idempotent write: in a transaction, skip events not newer than the last one
    // applied — so RevenueCat resends and out-of-order deliveries can't regress state.
    await this.db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      if (record.lastEventTs && current?.lastEventTs && current.lastEventTs >= record.lastEventTs) {
        return;
      }
      // Firestore rejects `undefined` field values (e.g. lastEventTs when a
      // RevenueCat event carries no event_timestamp_ms) — which crashed the
      // webhook (500) and silently dropped paid upgrades. Strip undefined keys
      // before the write so a missing optional field can never block the grant.
      const payload = Object.fromEntries(
        Object.entries({ ...record, updatedAt: new Date().toISOString() }).filter(([, v]) => v !== undefined),
      );
      tx.set(ref, payload, { merge: true });
    });
  }
}

/**
 * A stored paid record still entitles the user until it lapses. A canceled sub
 * keeps its plan until the period end; an expired/refunded one drops to Free.
 */
const recordStillEntitles = (record: EntitlementRecord): boolean => {
  if (record.plan === "free") return true;
  if (record.status === "expired") return false;
  if (record.currentPeriodEnd && record.willRenew === false && record.status !== "in_trial") {
    const end = Date.parse(record.currentPeriodEnd);
    if (Number.isFinite(end) && end < Date.now()) return false;
  }
  return true;
};

export const createEntitlementStore = (config: ArborConfig): EntitlementStore =>
  config.memoryAdapter === "firestore" ? new FirestoreEntitlementStore(config) : new NullEntitlementStore();

export const resolveEntitlement = async (
  store: EntitlementStore,
  actor: { uid: string; email: string | null },
): Promise<Entitlement> => {
  if (!entitlementsEnforced()) {
    return { plan: "plus", limits: PLAN_LIMITS.plus, source: "beta_unenforced", enforced: false, status: "active" };
  }
  const uid = actor.uid.toLowerCase();
  const email = (actor.email || "").toLowerCase();
  // Comp lists grant a plan without billing (founders, example/demo accounts).
  // Family is the superset (everything in Plus + a co-parent seat), so it wins.
  if (envList("ARBOR_FAMILY_UIDS").includes(uid) || (email && envList("ARBOR_FAMILY_EMAILS").includes(email))) {
    return { plan: "family", limits: PLAN_LIMITS.family, source: "env", enforced: true, status: "active", provider: "comp" };
  }
  if (envList("ARBOR_PLUS_UIDS").includes(uid) || (email && envList("ARBOR_PLUS_EMAILS").includes(email))) {
    return { plan: "plus", limits: PLAN_LIMITS.plus, source: "env", enforced: true, status: "active", provider: "comp" };
  }
  // Prefer the rich record (status + renewal); fall back to the legacy plan-only read.
  const record = store.getRecord ? await store.getRecord(actor.uid) : null;
  if (record && recordStillEntitles(record) && record.plan !== "free") {
    return {
      plan: record.plan,
      limits: PLAN_LIMITS[record.plan],
      source: "store",
      enforced: true,
      status: record.status,
      provider: record.provider,
      currentPeriodEnd: record.currentPeriodEnd ?? null,
      willRenew: record.willRenew,
    };
  }
  if (!store.getRecord) {
    const stored = await store.getPlan(actor.uid);
    if (stored) return { plan: stored, limits: PLAN_LIMITS[stored], source: "store", enforced: true };
  }
  return { plan: "free", limits: PLAN_LIMITS.free, source: "default", enforced: true, status: "active" };
};

const DAY_MS = 24 * 60 * 60 * 1000;
export const COACH_METER = "coach_daily";

/**
 * Middleware for /chat and /council: meters free-tier coach messages per day.
 * Responds 402 with a structured upgrade payload when the meter is exhausted,
 * which the client renders as the Plus upsell.
 */
export const createCoachMeter = (
  store: EntitlementStore,
  counters: UsageCounterStore,
): RequestHandler => async (req, res, next) => {
  const actor = { uid: (req as any).user?.uid || "local-sandbox", email: ((req as any).user?.email as string | null) || null };
  const entitlement = await resolveEntitlement(store, actor);
  (req as any).entitlement = entitlement;
  const limit = entitlement.limits.coachMessagesPerDay;
  if (limit === null) { next(); return; }

  const { count, resetAt } = await counters.increment(COACH_METER, actor.uid, DAY_MS);
  res.setHeader("X-Coach-Limit", String(limit));
  res.setHeader("X-Coach-Remaining", String(Math.max(0, limit - count)));
  if (count > limit) {
    res.status(402).json({
      error: "Daily coaching limit reached",
      details: `The free plan includes ${limit} coach messages per day. Arbor Plus removes the limit.`,
      upgrade: { feature: "coach_unlimited", plan: "plus", resetAt: new Date(resetAt).toISOString() },
    });
    return;
  }
  next();
};

/**
 * mk-p0-2 referral loop: build the comp Plus record granted on a successful
 * referral activation. Kept here so server/referral.ts and its tests share one
 * shape. A `comp` + `willRenew:false` record lapses to Free at `currentPeriodEnd`
 * via `recordStillEntitles` above — exactly "one free month", no billing rails.
 * Written out-of-band by server/referral.ts (NOT by the RevenueCat webhook).
 */
export const buildReferralGrant = (currentPeriodEndIso: string): EntitlementRecord => ({
  plan: "plus",
  status: "active",
  provider: "comp",
  productId: "referral_month",
  willRenew: false,
  currentPeriodEnd: currentPeriodEndIso,
  rcOriginalAppUserId: null,
});

/** Middleware for Plus-only endpoints (professional reports / handoffs). */
export const requirePlusFeature = (
  store: EntitlementStore,
  feature: keyof Pick<PlanLimits, "professionalReports" | "advancedPlans">,
  label: string,
): RequestHandler => async (req, res, next) => {
  const actor = { uid: (req as any).user?.uid || "local-sandbox", email: ((req as any).user?.email as string | null) || null };
  const entitlement = await resolveEntitlement(store, actor);
  (req as any).entitlement = entitlement;
  if (entitlement.limits[feature]) { next(); return; }
  res.status(402).json({
    error: `${label} is an Arbor Plus feature`,
    details: `Upgrade to Arbor Plus to use ${label.toLowerCase()}.`,
    upgrade: { feature, plan: "plus" },
  });
};
