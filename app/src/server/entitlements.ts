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
 *
 * BD-53 (Guy, 20 Oct 2026): there is no standing free tier. Every account gets
 * TRIAL_DAYS of full Plus from sign-up, with no card; after that, Arbor's AI
 * needs a subscription (`accessEnded` → 402 `trial_ended`) while everything the
 * family saved stays readable and exportable. The legacy free limits remain
 * only as the fallback when the trial clock cannot be read.
 */
import type { RequestHandler } from "express";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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
  /** Compatibility availability flag: co-parent sharing is free on every plan. */
  coParentSeats: number;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    coachMessagesPerDay: Number(process.env.FREE_COACH_MESSAGES_PER_DAY || 10),
    maxChildren: 1,
    professionalReports: false,
    advancedPlans: false,
    coParentSeats: 1,
  },
  plus: {
    coachMessagesPerDay: null,
    maxChildren: 6,
    professionalReports: true,
    advancedPlans: true,
    coParentSeats: 1,
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
 * CARE-5 (pricing honesty): the entitlement-side source of truth for what the
 * plans cost. Locked launch pricing — Plus €12.99/mo, Family €19.99/mo; annual
 * is 10× monthly (two months free). The client display constant
 * (src/lib/pricing.ts) is test-pinned to this record so the price a parent sees
 * on the paywall can never drift from what the checkout charges. Display-side
 * only — the hosted RevenueCat/Stripe page (WEB_PACKAGE_IDS in billing.ts)
 * remains the binding price; update BOTH together with the dashboard.
 */
export type PlanPricing = { monthlyEur: number; annualEur: number };
export const PLAN_PRICING: Record<Exclude<Plan, "free">, PlanPricing> = {
  plus: { monthlyEur: 12.99, annualEur: 129.9 },
  family: { monthlyEur: 19.99, annualEur: 199.9 },
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
  source: "default" | "env" | "store" | "beta_unenforced" | "trial";
  enforced: boolean;
  status?: EntitlementStatus;
  provider?: BillingProvider;
  currentPeriodEnd?: string | null;
  willRenew?: boolean;
  /** ISO end of the account's free trial (running or past); null when unknown. */
  trialEndsAt?: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** BD-53: days of full Plus every account gets from sign-up (no card). */
export const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 14);
/** Accounts created before the trial shipped count their days from here, so
 *  nobody already using Arbor loses access on release day. */
export const TRIAL_LAUNCHED_AT = Date.parse("2026-10-20T00:00:00.000Z");

/** End of the trial for an account created at `accountCreatedAtMs`. */
export const trialEndsAtFor = (accountCreatedAtMs: number, days: number = TRIAL_DAYS): number =>
  Math.max(accountCreatedAtMs, TRIAL_LAUNCHED_AT) + days * DAY_MS;

/**
 * True when the family has no paid or comped plan and its trial is over: the
 * only state in which Arbor's AI answers 402 `trial_ended`. An unknown trial
 * clock (`trialEndsAt` null) keeps the legacy free limits instead of locking
 * a new family out on a transient Auth read failure.
 */
export const accessEnded = (entitlement: Entitlement, now: number = Date.now()): boolean => {
  if (!entitlement.enforced || entitlement.plan !== "free" || !entitlement.trialEndsAt) return false;
  const end = Date.parse(entitlement.trialEndsAt);
  return Number.isFinite(end) && end <= now;
};

/** The 402 body every AI route returns once the trial is over. */
export const TRIAL_ENDED_BODY = Object.freeze({
  error: "Your Arbor trial has ended",
  details: "Everything you saved stays yours to read and export. Arbor Plus keeps the answers, plans and stories going.",
  upgrade: Object.freeze({ feature: "trial_ended", plan: "plus" as const }),
});

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
  /** Account creation time (ms) — the trial clock. Null when it cannot be read. */
  accountCreatedAt?(uid: string): Promise<number | null>;
}

const isPlan = (value: unknown): value is Plan =>
  value === "free" || value === "plus" || value === "family";

/**
 * Idempotency for billing writes: an event at or below the last applied
 * `event_timestamp_ms` is a resend or an out-of-order delivery and must not
 * regress state. Events without a timestamp always apply.
 */
export const isStaleBillingEvent = (
  current: Pick<EntitlementRecord, "lastEventTs"> | null | undefined,
  record: Pick<EntitlementRecord, "lastEventTs">,
): boolean => Boolean(record.lastEventTs && current?.lastEventTs && current.lastEventTs >= record.lastEventTs);

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
      if (isStaleBillingEvent(current, record)) return;
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
  /** Firebase Auth creation time: server-owned, so a client cannot extend its
   *  own trial, and nothing new is stored. Cached per instance (it never
   *  changes); a failed read is not cached, so the next request retries. */
  private readonly createdAtCache = new Map<string, number>();
  async accountCreatedAt(uid: string): Promise<number | null> {
    const hit = this.createdAtCache.get(uid);
    if (hit !== undefined) return hit;
    try {
      const created = Date.parse((await getAuth().getUser(uid)).metadata.creationTime);
      if (!Number.isFinite(created)) return null;
      if (this.createdAtCache.size >= 10_000) this.createdAtCache.clear();
      this.createdAtCache.set(uid, created);
      return created;
    } catch (error) {
      logger.error("Account creation time read failed — legacy free limits apply", error, { uid });
      return null;
    }
  }
}

/**
 * A stored paid record still entitles the user until it lapses. A canceled sub
 * keeps its plan until the period end; an expired/refunded one drops to Free.
 */
export const recordStillEntitles = (record: EntitlementRecord, now: number = Date.now()): boolean => {
  if (record.plan === "free") return true;
  if (record.status === "expired") return false;
  if (record.currentPeriodEnd && record.willRenew === false && record.status !== "in_trial") {
    const end = Date.parse(record.currentPeriodEnd);
    if (Number.isFinite(end) && end < now) return false;
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
  // Preserve existing Family billing identity; its limits now match Plus.
  // BD-53 (Guy, 20 Oct): the admin account is the founder's own and never meets
  // the trial or the paywall, even if it leaves the Family comp list.
  if (
    envList("ARBOR_FAMILY_UIDS").includes(uid)
    || (email && envList("ARBOR_FAMILY_EMAILS").includes(email))
    || (email && envList("ARBOR_ADMIN_EMAILS").includes(email))
  ) {
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
  // BD-53: no paid or comped plan → the trial decides. Running: full Plus.
  const createdAt = store.accountCreatedAt ? await store.accountCreatedAt(actor.uid) : null;
  const trialEnd = createdAt === null ? null : trialEndsAtFor(createdAt);
  const trialEndsAt = trialEnd === null ? null : new Date(trialEnd).toISOString();
  if (trialEnd !== null && trialEnd > Date.now()) {
    return {
      plan: "plus",
      limits: PLAN_LIMITS.plus,
      source: "trial",
      enforced: true,
      status: "in_trial",
      provider: "none",
      currentPeriodEnd: trialEndsAt,
      willRenew: false,
      trialEndsAt,
    };
  }
  return { plan: "free", limits: PLAN_LIMITS.free, source: "default", enforced: true, status: "active", trialEndsAt };
};

/**
 * The entitlement for this request, resolved once: the gates that run before
 * a route (access, coach meter, Plus features, image allowance) share it
 * instead of each re-reading Firestore.
 */
export const entitlementForRequest = (req: unknown, store: EntitlementStore): Promise<Entitlement> => {
  const r = req as { user?: { uid?: string; email?: string | null }; entitlementPromise?: Promise<Entitlement> };
  if (!r.entitlementPromise) {
    r.entitlementPromise = resolveEntitlement(store, { uid: r.user?.uid || "local-sandbox", email: r.user?.email || null });
  }
  return r.entitlementPromise;
};

/**
 * BD-53: middleware for every AI route except /chat and /council (the coach
 * gate in aiQuota.ts applies the same rule). Once the trial is over and no
 * plan is paid, the route answers 402 `trial_ended`, which the client turns
 * into the paywall. A failed resolution passes through: the gates downstream
 * still apply their own fail-closed limits.
 */
export const requireActiveAccess = (store: EntitlementStore): RequestHandler => async (req, res, next) => {
  try {
    const entitlement = await entitlementForRequest(req, store);
    (req as any).entitlement = entitlement;
    if (accessEnded(entitlement)) {
      res.status(402).json(TRIAL_ENDED_BODY);
      return;
    }
  } catch (error) {
    logger.error("Access gate could not resolve the entitlement — passing through", error);
  }
  next();
};

/**
 * B-MEAS-01: which cohort a signed-in account belongs to for MEASUREMENT.
 * "internal" = the env comp lists (founder, comped testers, demo accounts),
 * the admin list, or a synthetic `@example.com` identity (release-smoke
 * accounts). Everything else is a "family". Served on `/entitlement` as a tag
 * the client copies into its retention rollup — the email itself never leaves
 * the server and is never written to a rollup. Referral comps are real
 * families (source "store"), so only the ENV grant marks an account internal.
 */
export type CohortTag = "internal" | "family";
export const cohortTagFor = (
  entitlement: Pick<Entitlement, "source">,
  actor: { email: string | null },
  admin: boolean,
): CohortTag => {
  if (admin || entitlement.source === "env") return "internal";
  const email = (actor.email || "").trim().toLowerCase();
  if (email.endsWith("@example.com")) return "internal";
  return "family";
};

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
  if (accessEnded(entitlement)) { res.status(402).json(TRIAL_ENDED_BODY); return; }
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
  const entitlement = await entitlementForRequest(req, store);
  (req as any).entitlement = entitlement;
  if (accessEnded(entitlement)) { res.status(402).json(TRIAL_ENDED_BODY); return; }
  if (entitlement.limits[feature]) { next(); return; }
  res.status(402).json({
    error: `${label} is an Arbor Plus feature`,
    details: `Upgrade to Arbor Plus to use ${label.toLowerCase()}.`,
    upgrade: { feature, plan: "plus" },
  });
};
