/**
 * ADM-1: the read side of the founder dashboard. Cheap aggregation queries over
 * Firestore (`users`, `entitlements`) plus today's `usageRollup` doc, folded into
 * one overview. Local/sandbox returns zeros so the UI still renders.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { estimateCostEur, type ProviderTokens } from "./admin.js";
import { PRICE_TABLE_AS_OF } from "../ai/priceTable.js";
import { usageDateKey } from "./usageRollup.js";
import { logger } from "./logger.js";

export type AdminOverview = {
  users: number;
  paying: { plus: number; family: number; trialing: number; total: number };
  usageToday: {
    date: string;
    calls: number;
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
    byProvider: Record<string, ProviderTokens & { calls?: number }>;
    approxCostEur: number;
  };
  /** B-PROV-04: the last 30 days' estimated model spend ÷ active families. */
  cost30d: Cost30d;
  generatedAt: string;
};

/** B-PROV-04 (admin only, no parent surface). `null` = not answerable (no
 *  priced call, or no active family) — never a fabricated 0. */
export type Cost30d = {
  days: number;
  estimatedCostUsd: number | null;
  /** Calls the estimate covers vs all calls (an unpriced model adds no cost). */
  pricedCalls: number;
  calls: number;
  /** Families with an active day in the window; internal and demo excluded. */
  activeFamilies: number;
  perActiveFamilyUsd: number | null;
  priceTableAsOf: string;
};

const DAY_MS = 86_400_000;

/** The date keys (YYYY-MM-DD, UTC) of the last `days` days, today included. */
export const lastDayKeys = (now: Date, days = 30): string[] =>
  Array.from({ length: days }, (_, i) => new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10));

/** Pure fold: usageRollup day docs + retention rollups → €/family's USD source. */
export function costPerActiveFamily(input: {
  usageDays: { date?: unknown; calls?: unknown; pricedCalls?: unknown; estimatedCostUsd?: unknown }[];
  rollups: { activeDays?: unknown; cohort?: unknown }[];
  now: Date;
  days?: number;
}): Cost30d {
  const days = input.days ?? 30;
  const keys = new Set(lastDayKeys(input.now, days));
  let usd = 0;
  let pricedCalls = 0;
  let calls = 0;
  for (const d of input.usageDays) {
    if (typeof d.date !== "string" || !keys.has(d.date)) continue;
    calls += Number(d.calls ?? 0) || 0;
    pricedCalls += Number(d.pricedCalls ?? 0) || 0;
    usd += Number(d.estimatedCostUsd ?? 0) || 0;
  }
  const activeFamilies = input.rollups.filter(
    (r) => r.cohort !== "internal" && r.cohort !== "demo" && Array.isArray(r.activeDays) && r.activeDays.some((day) => typeof day === "string" && keys.has(day)),
  ).length;
  const estimatedCostUsd = pricedCalls > 0 ? Math.round(usd * 1_000_000) / 1_000_000 : null;
  return {
    days,
    estimatedCostUsd,
    pricedCalls,
    calls,
    activeFamilies,
    perActiveFamilyUsd: estimatedCostUsd !== null && activeFamilies > 0 ? Math.round((estimatedCostUsd / activeFamilies) * 10_000) / 10_000 : null,
    priceTableAsOf: PRICE_TABLE_AS_OF,
  };
}

const EMPTY_USAGE = (date: string): AdminOverview["usageToday"] => ({
  date,
  calls: 0,
  promptTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  byProvider: {},
  approxCostEur: 0,
});

export interface AdminMetricsStore {
  overview(): Promise<AdminOverview>;
}

export class NullAdminMetricsStore implements AdminMetricsStore {
  async overview(): Promise<AdminOverview> {
    const date = usageDateKey();
    return {
      users: 0,
      paying: { plus: 0, family: 0, trialing: 0, total: 0 },
      usageToday: EMPTY_USAGE(date),
      cost30d: costPerActiveFamily({ usageDays: [], rollups: [], now: new Date() }),
      generatedAt: new Date().toISOString(),
    };
  }
}

export class FirestoreAdminMetricsStore implements AdminMetricsStore {
  private readonly db: Firestore;
  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }

  private async count(query: FirebaseFirestore.Query | FirebaseFirestore.CollectionReference): Promise<number> {
    try {
      const snap = await query.count().get();
      return snap.data().count;
    } catch (error) {
      logger.error("Admin metrics count failed", error);
      return 0;
    }
  }

  async overview(): Promise<AdminOverview> {
    const date = usageDateKey();
    const entitlements = this.db.collection("entitlements");
    const now = new Date();
    const windowKeys = lastDayKeys(now, 30);
    const [users, plus, family, trialing, usageSnap, usageDays, activeRollups] = await Promise.all([
      this.count(this.db.collection("users")),
      this.count(entitlements.where("plan", "==", "plus")),
      this.count(entitlements.where("plan", "==", "family")),
      this.count(entitlements.where("status", "==", "in_trial")),
      this.db.collection("usageRollup").doc(date).get().catch(() => null),
      // B-PROV-04: the 30-day spend and the families active in the same window.
      this.db.collection("usageRollup").where("date", ">=", windowKeys[windowKeys.length - 1]).get()
        .then((snap) => snap.docs.map((d) => d.data()))
        .catch((error) => { logger.error("Admin cost window read failed", error); return []; }),
      this.db.collection("retentionRollups").where("activeDays", "array-contains-any", windowKeys).limit(5000).get()
        .then((snap) => snap.docs.map((d) => d.data()))
        .catch((error) => { logger.error("Admin active-family read failed", error); return []; }),
    ]);

    const data = usageSnap?.data();
    const byProvider = (data?.byProvider ?? {}) as Record<string, ProviderTokens & { calls?: number }>;
    const usageToday: AdminOverview["usageToday"] = data
      ? {
          date,
          calls: Number(data.calls ?? 0),
          promptTokens: Number(data.promptTokens ?? 0),
          outputTokens: Number(data.outputTokens ?? 0),
          totalTokens: Number(data.totalTokens ?? 0),
          byProvider,
          approxCostEur: estimateCostEur(byProvider),
        }
      : EMPTY_USAGE(date);

    return {
      users,
      paying: { plus, family, trialing, total: plus + family },
      usageToday,
      cost30d: costPerActiveFamily({ usageDays, rollups: activeRollups, now }),
      generatedAt: new Date().toISOString(),
    };
  }
}

export const createAdminMetricsStore = (config: ArborConfig): AdminMetricsStore =>
  config.memoryAdapter === "firestore" ? new FirestoreAdminMetricsStore(config) : new NullAdminMetricsStore();
