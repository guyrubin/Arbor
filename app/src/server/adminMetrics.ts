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
import { familyDailyCostReport, readFamilyCostWindow, type FamilyCostDay } from "./familyCostReport.js";
import type { CoParentLink, StoredRollup } from "./cohortMetrics.js";

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
    /** Observed connection time (liveUsage.ts) and, B-AIOPS-02/03, the family
     *  allowance's reserved Live slices, settled fallback turns and refusals. */
    live?: { observedSessionMs: number; openedSessions: number; reservedMs?: number; fallbackTurnMs?: number; restingRefusals?: number };
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
  activeFamilies: number | null;
  dataStatus: "complete" | "unavailable" | "truncated";
  householdsFolded: number | null;
  excludedCostUsd: number | null;
  unattributedUsd: number | null;
  billMatch: "partial";
  perActiveFamilyUsd: number | null;
  priceTableAsOf: string;
};

const DAY_MS = 86_400_000;

/** The date keys (YYYY-MM-DD, UTC) of the last `days` days, today included. */
export const lastDayKeys = (now: Date, days = 30): string[] =>
  Array.from({ length: days }, (_, i) => new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10));

/** The same attributed cost and household fold as /api/admin/family-cost.
 * Global usage is deliberately not a substitute for missing family receipts. */
export function costPerActiveFamily(input: {
  familyCosts: readonly FamilyCostDay[];
  rollups: readonly StoredRollup[];
  coParents: readonly CoParentLink[] | null;
  now: Date;
  days?: number;
  dataStatus?: Cost30d["dataStatus"];
}): Cost30d {
  const days = input.days ?? 30;
  const keys = lastDayKeys(input.now, days);
  const status = input.dataStatus ?? (input.coParents === null ? "unavailable" : "complete");
  if (status !== "complete") return {
    days, estimatedCostUsd: null, pricedCalls: 0, calls: 0, activeFamilies: null,
    perActiveFamilyUsd: null, priceTableAsOf: PRICE_TABLE_AS_OF, dataStatus: status,
    householdsFolded: null, excludedCostUsd: null, unattributedUsd: null, billMatch: "partial",
  };
  const report = familyDailyCostReport({
    date: keys[0], activeDates: keys,
    costs: input.familyCosts.filter((day) => day.date && keys.includes(day.date)),
    rollups: input.rollups, coParents: input.coParents,
  });
  return {
    days, estimatedCostUsd: report.estimatedCostUsd, pricedCalls: report.pricedCalls,
    calls: report.calls, activeFamilies: report.activeHouseholds,
    perActiveFamilyUsd: report.perActiveFamilyUsd, priceTableAsOf: PRICE_TABLE_AS_OF,
    dataStatus: status, householdsFolded: report.householdsFolded,
    excludedCostUsd: report.excludedCostUsd, unattributedUsd: report.unattributedUsd, billMatch: "partial",
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
      cost30d: costPerActiveFamily({ familyCosts: [], rollups: [], coParents: [], now: new Date() }),
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
    const [users, plus, family, trialing, usageSnap, costWindow] = await Promise.all([
      this.count(this.db.collection("users")),
      this.count(entitlements.where("plan", "==", "plus")),
      this.count(entitlements.where("plan", "==", "family")),
      this.count(entitlements.where("status", "==", "in_trial")),
      this.db.collection("usageRollup").doc(date).get().catch(() => null),
      readFamilyCostWindow(this.db, windowKeys),
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
          ...(data.live ? { live: {
            observedSessionMs: Number(data.live.observedSessionMs ?? 0), openedSessions: Number(data.live.openedSessions ?? 0),
            reservedMs: Number(data.live.reservedMs ?? 0), fallbackTurnMs: Number(data.live.fallbackTurnMs ?? 0), restingRefusals: Number(data.live.restingRefusals ?? 0),
          } } : {}),
        }
      : EMPTY_USAGE(date);

    return {
      users,
      paying: { plus, family, trialing, total: plus + family },
      usageToday,
      cost30d: costPerActiveFamily({
        familyCosts: costWindow.familyCosts ?? [], rollups: costWindow.rollups ?? [],
        coParents: costWindow.coParents ?? null, dataStatus: costWindow.status, now,
      }),
      generatedAt: new Date().toISOString(),
    };
  }
}

export const createAdminMetricsStore = (config: ArborConfig): AdminMetricsStore =>
  config.memoryAdapter === "firestore" ? new FirestoreAdminMetricsStore(config) : new NullAdminMetricsStore();
