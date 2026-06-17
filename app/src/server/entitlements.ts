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
 *  - ARBOR_PLUS_UIDS / ARBOR_PLUS_EMAILS env lists grant Plus manually
 *    (founder accounts, comped testers) without touching Firestore.
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

export type Plan = "free" | "plus";

export type PlanLimits = {
  /** Coach + council messages per day; null = unlimited. */
  coachMessagesPerDay: number | null;
  maxChildren: number;
  professionalReports: boolean;
  advancedPlans: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    coachMessagesPerDay: Number(process.env.FREE_COACH_MESSAGES_PER_DAY || 10),
    maxChildren: 1,
    professionalReports: false,
    advancedPlans: false,
  },
  plus: {
    coachMessagesPerDay: null,
    maxChildren: 6,
    professionalReports: true,
    advancedPlans: true,
  },
};

export type Entitlement = {
  plan: Plan;
  limits: PlanLimits;
  source: "default" | "env" | "store" | "beta_unenforced";
  enforced: boolean;
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
}

export class NullEntitlementStore implements EntitlementStore {
  async getPlan() { return null; }
}

/** Reads `entitlements/{uid}` — the doc a billing webhook will maintain. */
export class FirestoreEntitlementStore implements EntitlementStore {
  private readonly db;
  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  async getPlan(uid: string): Promise<Plan | null> {
    try {
      const snap = await this.db.collection("entitlements").doc(uid).get();
      const plan = snap.data()?.plan;
      return plan === "plus" || plan === "free" ? plan : null;
    } catch (error) {
      logger.error("Entitlement store read failed — defaulting", error, { uid });
      return null;
    }
  }
}

export const createEntitlementStore = (config: ArborConfig): EntitlementStore =>
  config.memoryAdapter === "firestore" ? new FirestoreEntitlementStore(config) : new NullEntitlementStore();

export const resolveEntitlement = async (
  store: EntitlementStore,
  actor: { uid: string; email: string | null },
): Promise<Entitlement> => {
  if (!entitlementsEnforced()) {
    return { plan: "plus", limits: PLAN_LIMITS.plus, source: "beta_unenforced", enforced: false };
  }
  const uid = actor.uid.toLowerCase();
  const email = (actor.email || "").toLowerCase();
  if (envList("ARBOR_PLUS_UIDS").includes(uid) || (email && envList("ARBOR_PLUS_EMAILS").includes(email))) {
    return { plan: "plus", limits: PLAN_LIMITS.plus, source: "env", enforced: true };
  }
  const stored = await store.getPlan(actor.uid);
  if (stored) return { plan: stored, limits: PLAN_LIMITS[stored], source: "store", enforced: true };
  return { plan: "free", limits: PLAN_LIMITS.free, source: "default", enforced: true };
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
