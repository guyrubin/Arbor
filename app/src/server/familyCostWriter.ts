/**
 * B-AIOPS-01: one Firestore row per family per UTC day, numbers and ids only.
 * The `ai.usage` line stays the per-call receipt; this is what the daily
 * report reads back (Cloud Logging is not a query source for the app).
 * Studio production never lands here — recordUsage returns before this write.
 * A failed write never breaks a request.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { usageDateKey } from "./usageRollup.js";
import { costId } from "./requestContext.js";
import { logger } from "./logger.js";

export const FAMILY_COST_COLLECTION = "familyCostDaily";

export { costId };

const ROUTE = /^[a-z][a-z0-9_]{0,40}$/;

export type FamilyCostInput = {
  familyId: string | null;
  uid: string | null;
  route: string;
  retries: number;
  fallback: boolean;
  chargedFailure: boolean;
  promptTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  audioSeconds: number;
  imageCount: number;
  characters: number;
  observedMs: number;
  /** Absent when the call has no price. Never a fabricated 0. */
  estimatedCostUsd?: number;
  priceTableAsOf: string;
};

export function familyCostDocId(familyId: string | null, date: string): string {
  return `${costId(familyId) ?? "unattributed"}_${date}`;
}

const whole = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0));

/** The Firestore update for one paid call. Pure aside from FieldValue. */
export function familyCostFields(input: FamilyCostInput, date = usageDateKey()): { id: string; fields: Record<string, unknown> } | null {
  if (!ROUTE.test(input.route)) return null;
  const familyId = costId(input.familyId);
  const uid = costId(input.uid);
  const priced = typeof input.estimatedCostUsd === "number" && Number.isFinite(input.estimatedCostUsd) && input.estimatedCostUsd >= 0;
  const route = input.route;
  return {
    id: familyCostDocId(familyId, date),
    fields: {
      familyId,
      date,
      priceTableAsOf: input.priceTableAsOf,
      ...(uid ? { memberUids: FieldValue.arrayUnion(uid) } : {}),
      routes: {
        [route]: {
          calls: FieldValue.increment(1),
          retries: FieldValue.increment(whole(input.retries)),
          ...(input.fallback ? { fallbacks: FieldValue.increment(1) } : {}),
          ...(input.chargedFailure ? { chargedFailures: FieldValue.increment(1) } : {}),
          promptTokens: FieldValue.increment(whole(input.promptTokens)),
          outputTokens: FieldValue.increment(whole(input.outputTokens)),
          cacheReadTokens: FieldValue.increment(whole(input.cacheReadTokens)),
          audioSeconds: FieldValue.increment(Math.max(0, Number.isFinite(input.audioSeconds) ? input.audioSeconds : 0)),
          imageCount: FieldValue.increment(whole(input.imageCount)),
          characters: FieldValue.increment(whole(input.characters)),
          observedMs: FieldValue.increment(whole(input.observedMs)),
          ...(priced
            ? { estimatedCostUsd: FieldValue.increment(input.estimatedCostUsd!), pricedCalls: FieldValue.increment(1) }
            : { unpricedCalls: FieldValue.increment(1) }),
        },
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
  };
}

let db: Firestore | null = null;

export function initFamilyCost(config: ArborConfig): void {
  if (config.memoryAdapter !== "firestore") return;
  try {
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    db = getFirestore(config.firestoreDatabaseId);
  } catch (error) {
    logger.error("Family cost init failed", error);
  }
}

/** Test seam. */
export function _setFamilyCostDb(next: Firestore | null): void {
  db = next;
}

/** One paid call into today's family row. Never throws, never blocks. */
export function rememberFamilyCost(input: FamilyCostInput, now = new Date()): void {
  if (!db) return;
  const write = familyCostFields(input, usageDateKey(now));
  if (!write) return;
  db.collection(FAMILY_COST_COLLECTION).doc(write.id).set(write.fields, { merge: true })
    .catch((error) => logger.error("Family cost write failed", error, { date: usageDateKey(now) }));
}
