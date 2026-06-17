/**
 * ADM-1: the read side of the founder dashboard. Cheap aggregation queries over
 * Firestore (`users`, `entitlements`) plus today's `usageRollup` doc, folded into
 * one overview. Local/sandbox returns zeros so the UI still renders.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { estimateCostEur, type ProviderTokens } from "./admin.js";
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
  generatedAt: string;
};

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
    const [users, plus, family, trialing, usageSnap] = await Promise.all([
      this.count(this.db.collection("users")),
      this.count(entitlements.where("plan", "==", "plus")),
      this.count(entitlements.where("plan", "==", "family")),
      this.count(entitlements.where("status", "==", "in_trial")),
      this.db.collection("usageRollup").doc(date).get().catch(() => null),
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
      generatedAt: new Date().toISOString(),
    };
  }
}

export const createAdminMetricsStore = (config: ArborConfig): AdminMetricsStore =>
  config.memoryAdapter === "firestore" ? new FirestoreAdminMetricsStore(config) : new NullAdminMetricsStore();
