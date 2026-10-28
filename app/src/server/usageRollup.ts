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

/** EVAL-7: one model call's latency, attributed to its logical route. */
export type RollupTiming = { route: string; totalMs: number; firstChunkMs?: number };

/** UTC day key, e.g. 2026-06-17. One rollup doc per day. */
export const usageDateKey = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

/**
 * EVAL-7: fixed latency histogram bounds (ms). Counters per bucket per route are
 * incrementable in Firestore (unlike raw percentiles), and p50/p95 are derived
 * from the bucket counts with `percentileFromBuckets` — the data source every
 * cadence budget and the founder dashboard read.
 */
export const LATENCY_BUCKET_BOUNDS_MS = [250, 500, 1000, 2000, 3000, 5000, 8000, 15000, 30000] as const;

/** Bucket label for a duration, e.g. `le1000` or `gt30000`. */
export const latencyBucketOf = (ms: number): string => {
  for (const bound of LATENCY_BUCKET_BOUNDS_MS) {
    if (ms <= bound) return `le${bound}`;
  }
  return `gt${LATENCY_BUCKET_BOUNDS_MS[LATENCY_BUCKET_BOUNDS_MS.length - 1]}`;
};

/**
 * Approximate percentile (0-100) from `{bucketLabel: count}` histogram counts.
 * Returns the upper bound of the bucket containing the percentile rank (a
 * conservative estimate), or null when the histogram is empty.
 */
export const percentileFromBuckets = (buckets: Record<string, number>, percentile: number): number | null => {
  const ordered: Array<{ bound: number; count: number }> = [
    ...LATENCY_BUCKET_BOUNDS_MS.map((bound) => ({ bound, count: Number(buckets[`le${bound}`] || 0) })),
    {
      bound: Number.POSITIVE_INFINITY,
      count: Number(buckets[`gt${LATENCY_BUCKET_BOUNDS_MS[LATENCY_BUCKET_BOUNDS_MS.length - 1]}`] || 0),
    },
  ];
  const total = ordered.reduce((sum, b) => sum + b.count, 0);
  if (!total) return null;
  const rank = (percentile / 100) * total;
  let seen = 0;
  for (const bucket of ordered) {
    seen += bucket.count;
    if (seen >= rank && bucket.count > 0) return bucket.bound;
  }
  return ordered[ordered.length - 1].bound;
};

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

/** Increment today's rollup with one model call's tokens (+ EVAL-7 latency). Never throws. */
export const recordUsageRollup = (provider: string, usage: RollupUsage, timing?: RollupTiming, costUsd?: number): void => {
  if (!db) return;
  const date = usageDateKey();
  // EVAL-7: per-route latency histogram + sums. p50/p95 per route are derived
  // from `byRoute.{route}.latencyBuckets` via percentileFromBuckets.
  const routeLatency = timing
    ? {
        byRoute: {
          [timing.route]: {
            calls: FieldValue.increment(1),
            totalMsSum: FieldValue.increment(Math.max(0, Math.round(timing.totalMs))),
            ...(timing.firstChunkMs !== undefined
              ? { firstChunkMsSum: FieldValue.increment(Math.max(0, Math.round(timing.firstChunkMs))) }
              : {}),
            latencyBuckets: { [latencyBucketOf(timing.totalMs)]: FieldValue.increment(1) },
          },
        },
      }
    : {};
  db.collection("usageRollup").doc(date).set(
    {
      date,
      calls: FieldValue.increment(1),
      promptTokens: FieldValue.increment(usage.promptTokens),
      outputTokens: FieldValue.increment(usage.outputTokens),
      totalTokens: FieldValue.increment(usage.totalTokens),
      // B-PROV-04: priced calls only; `pricedCalls` lets the reader say how
      // much of the day the estimate covers (an unpriced call adds nothing).
      ...(costUsd !== undefined ? { estimatedCostUsd: FieldValue.increment(costUsd), pricedCalls: FieldValue.increment(1) } : {}),
      byProvider: {
        [provider]: {
          calls: FieldValue.increment(1),
          promptTokens: FieldValue.increment(usage.promptTokens),
          outputTokens: FieldValue.increment(usage.outputTokens),
          ...(costUsd !== undefined ? { estimatedCostUsd: FieldValue.increment(costUsd) } : {}),
        },
      },
      ...routeLatency,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  ).catch((error) => logger.error("Usage rollup write failed", error, { date }));
};

/**
 * B-AIOPS-02/03: the family voice allowance's daily totals, for the cost
 * reads B-GA-26 and BD-06/52 take (docs/ops/incident-alerts.md "Cost and
 * budget outputs"). Counts and milliseconds only — no family, uid or content.
 *   live.reservedMs / live.reservations   Live token slices delivered (the
 *                                          upper bound of provider-billable time)
 *   live.fallbackTurnMs / live.fallbackTurns  settled fallback-loop turns
 *   live.restingRefusals                  mints or turns refused (allowance spent)
 *   live.byPlan.{plan}.reservedMs / .fallbackTurnMs
 * Fire-and-forget like recordUsageRollup: never throws, never blocks.
 */
export type LiveBudgetRollup =
  | { kind: "live"; plan: string; reservedMs: number }
  | { kind: "turn"; plan: string; settledMs: number }
  | { kind: "resting"; plan: string };

export const liveBudgetRollupFields = (event: LiveBudgetRollup): Record<string, unknown> => {
  const plan = /^[a-z_]{1,20}$/.test(event.plan) ? event.plan : "unknown";
  if (event.kind === "live") {
    const ms = Math.max(0, Math.round(event.reservedMs));
    return { reservedMs: FieldValue.increment(ms), reservations: FieldValue.increment(1), byPlan: { [plan]: { reservedMs: FieldValue.increment(ms) } } };
  }
  if (event.kind === "turn") {
    const ms = Math.max(0, Math.round(event.settledMs));
    return { fallbackTurnMs: FieldValue.increment(ms), fallbackTurns: FieldValue.increment(1), byPlan: { [plan]: { fallbackTurnMs: FieldValue.increment(ms) } } };
  }
  return { restingRefusals: FieldValue.increment(1), byPlan: { [plan]: { restingRefusals: FieldValue.increment(1) } } };
};

export const recordLiveBudgetRollup = (event: LiveBudgetRollup): void => {
  if (!db) return;
  const date = usageDateKey();
  db.collection("usageRollup").doc(date).set({ date, live: liveBudgetRollupFields(event), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    .catch((error) => logger.error("Live budget rollup write failed", error, { date }));
};
