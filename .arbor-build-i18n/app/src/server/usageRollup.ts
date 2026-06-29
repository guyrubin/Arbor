/**
 * COST-3: a Firestore daily rollup of AI token usage.
 *
 * recordUsage() (ai/usage.ts) already emits an `ai.usage` Cloud Logging line per
 * model call — great for ad-hoc slicing, but the app server can't read it back.
 * This rollup aggregates the same numbers into `usageRollup/{YYYY-MM-DD}` so the
 * founder dashboard (and the cost-cap gate) can read today's spend cheaply.
 *
 * Fire-and-forget: a failed rollup must never affect a user request.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { logger } from "./logger.js";

export type RollupUsage = { promptTokens: number; outputTokens: number; totalTokens: number };

/** UTC day key, e.g. 2026-06-17. One rollup doc per day. */
export const usageDateKey = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

let db: Firestore | null = null;

/** Wire the rollup to Firestore at app startup. No-op outside firestore mode. */
export const initUsageRollup = (config: ArborConfig): void => {
  if (config.memoryAdapter !== "firestore") return;
  try {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    db = getFirestore(config.firestoreDatabaseId);
  } catch (error) {
    logger.error("Usage rollup init failed", error);
  }
};

/** Increment today's rollup with one model call's tokens. Never throws. */
export const recordUsageRollup = (provider: string, usage: RollupUsage): void => {
  if (!db) return;
  const date = usageDateKey();
  db.collection("usageRollup").doc(date).set(
    {
      date,
      calls: FieldValue.increment(1),
      promptTokens: FieldValue.increment(usage.promptTokens),
      outputTokens: FieldValue.increment(usage.outputTokens),
      totalTokens: FieldValue.increment(usage.totalTokens),
      byProvider: {
        [provider]: {
          calls: FieldValue.increment(1),
          promptTokens: FieldValue.increment(usage.promptTokens),
          outputTokens: FieldValue.increment(usage.outputTokens),
        },
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  ).catch((error) => logger.error("Usage rollup write failed", error, { date }));
};
