/**
 * B-KID-150 — the studio cost ledger: what PRODUCTION of shared kid assets
 * costs (book plates, plan plates, overlays, the shared narration sets,
 * video, music), per asset and per accepted second, kept APART from the
 * family-serving usage that the B-GA-26 / BD-36 family meter reads.
 *
 * On the shared accounting contract (B-AIOPS-01, ai/usage.ts): every model
 * call still emits its content-free `ai.usage` line. A call made inside
 * `runAsStudioProduction(asset, …)` is ALSO stamped with its asset key and its
 * cost lands here, in `studioCostLedger/{assetKey}`, and NEVER in
 * `usageRollup/{day}` — the only source of costPerActiveFamily
 * (server/adminMetrics.ts). That is the exclusion by construction: a studio
 * call cannot reach the family meter because recordUsage routes it away
 * (ai/usage.ts, tested in studioCostLedger.test.ts).
 *
 * One document per asset:
 *   asset, kind, ref             what was produced (no family, uid or child)
 *   calls.{modality}             image / tts / video / music / text calls
 *   failedCalls                  charged-but-failed attempts the provider bills
 *   estimatedCostUsd, pricedCalls, unpricedCalls
 *                                list-price estimate (ai/priceTable, ttsUsage);
 *                                an unpriced call adds a count, never a 0 cost
 *   billedCostUsd, billedSource, billedPeriod
 *                                the ACTUAL billed cost, set only by the bill
 *                                reconciliation (scripts/studio-ledger-import.mts);
 *                                absent until then — never inferred
 *   acceptedSeconds              audio / video / music accepted into the product
 *
 * Fire-and-forget like usageRollup: a failed write never breaks a paint.
 */
import { AsyncLocalStorage } from "async_hooks";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { logger } from "./logger.js";

export const STUDIO_COST_LEDGER_COLLECTION = "studioCostLedger";

export type StudioAssetKind = "book-plate" | "plan-plate" | "overlay" | "narration-set" | "video" | "music";
export const STUDIO_ASSET_KINDS: readonly StudioAssetKind[] = ["book-plate", "plan-plate", "overlay", "narration-set", "video", "music"];
export type StudioModality = "image" | "tts" | "video" | "music" | "text";
export const STUDIO_MODALITIES: readonly StudioModality[] = ["image", "tts", "video", "music", "text"];

export interface StudioAsset {
  kind: StudioAssetKind;
  /** The asset's own id: `<bookId>/<plateId>`, `<patternId>/<plateId>`, `<bookId>/<setId>`, a video slug. */
  ref: string;
}

const REF = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}(?:\/[A-Za-z0-9][A-Za-z0-9_.-]{0,63}){0,2}$/;

/** A production asset (a known kind, a path-safe ref), else null. */
export function studioAsset(kind: string, ref: string): StudioAsset | null {
  return (STUDIO_ASSET_KINDS as readonly string[]).includes(kind) && REF.test(ref) && !ref.includes("..") ? { kind: kind as StudioAssetKind, ref } : null;
}

/** The ledger document id: `<kind>:<ref>` with `/` as `~` (a Firestore id has no `/`). */
export function studioAssetKey(asset: StudioAsset): string {
  return `${asset.kind}:${asset.ref.replace(/\//g, "~")}`;
}

export interface StudioScope {
  asset: StudioAsset;
  /** What the calls inside the scope produce (a plate paint = image). */
  modality: StudioModality;
}
const scope = new AsyncLocalStorage<StudioScope>();

/** Run `fn` as the production of `asset`: every model call inside it is studio spend. */
export function runAsStudioProduction<T>(asset: StudioAsset, modality: StudioModality, fn: () => T): T {
  return scope.run({ asset, modality }, fn);
}

/** The asset being produced by the current call chain, if any. */
export function currentStudioScope(): StudioScope | undefined {
  return scope.getStore();
}

export interface StudioUsage {
  modality: StudioModality;
  /** List-price estimate; undefined = unpriced (counted, never 0). */
  estimatedCostUsd?: number;
  /** A charged attempt that produced nothing usable. */
  failed?: boolean;
}

/** The Firestore update for one studio call (pure; FieldValue increments). */
export function studioUsageFields(asset: StudioAsset, usage: StudioUsage): Record<string, unknown> {
  const priced = typeof usage.estimatedCostUsd === "number" && Number.isFinite(usage.estimatedCostUsd) && usage.estimatedCostUsd >= 0;
  return {
    asset: studioAssetKey(asset),
    kind: asset.kind,
    ref: asset.ref,
    calls: { [usage.modality]: FieldValue.increment(1) },
    ...(usage.failed ? { failedCalls: FieldValue.increment(1) } : {}),
    ...(priced ? { estimatedCostUsd: FieldValue.increment(usage.estimatedCostUsd!), pricedCalls: FieldValue.increment(1) } : { unpricedCalls: FieldValue.increment(1) }),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

let db: Firestore | null = null;

/** Wire the ledger to Firestore at app startup. No-op outside firestore mode. */
export const initStudioCostLedger = (config: ArborConfig): void => {
  if (config.memoryAdapter !== "firestore") return;
  try {
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    db = getFirestore(config.firestoreDatabaseId);
  } catch (error) {
    logger.error("Studio cost ledger init failed", error);
  }
};

/** Test seam: a fake store (null = off). */
export function _setStudioLedgerDb(next: Firestore | null): void {
  db = next;
}

/** One studio call into its asset's row. Never throws, never blocks. */
export function recordStudioUsage(asset: StudioAsset, usage: StudioUsage): void {
  if (!db) return;
  const key = studioAssetKey(asset);
  db.collection(STUDIO_COST_LEDGER_COLLECTION).doc(key).set(studioUsageFields(asset, usage), { merge: true })
    .catch((error) => logger.error("Studio cost ledger write failed", error, { asset: key }));
}

/* ── the read side: per asset and per accepted second ─────────────────────── */

export interface StudioLedgerRow {
  asset: string;
  kind: StudioAssetKind;
  ref: string;
  calls?: Partial<Record<StudioModality, number>>;
  /** Calls made outside the app (the offline art and audio rounds), from the bill import. */
  offlineCalls?: Partial<Record<StudioModality, number>>;
  failedCalls?: number;
  estimatedCostUsd?: number;
  pricedCalls?: number;
  unpricedCalls?: number;
  billedCostUsd?: number;
  billedSource?: "invoice" | "billing-export";
  billedPeriod?: string;
  acceptedSeconds?: number;
}

export interface StudioAssetCost {
  asset: string;
  kind: StudioAssetKind;
  calls: number;
  /** The actual billed cost; null until the bill is reconciled (never an estimate). */
  billedCostUsd: number | null;
  estimatedCostUsd: number | null;
  /** Billed cost ÷ accepted seconds; null when either is missing. */
  billedPerAcceptedSecondUsd: number | null;
  acceptedSeconds: number | null;
  unpricedCalls: number;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const round6 = (v: number) => Math.round(v * 1_000_000) / 1_000_000;

/** Pure fold of ledger rows into the per-asset report (admin / reconciliation only). */
export function studioCostReport(rows: readonly StudioLedgerRow[]): { assets: StudioAssetCost[]; billedTotalUsd: number | null; unreconciledAssets: number } {
  const assets = rows.map((r): StudioAssetCost => {
    const calls = [...Object.values(r.calls ?? {}), ...Object.values(r.offlineCalls ?? {})].reduce((n: number, v) => n + (num(v) ?? 0), 0);
    const billed = num(r.billedCostUsd);
    const seconds = num(r.acceptedSeconds);
    return {
      asset: r.asset,
      kind: r.kind,
      calls,
      billedCostUsd: billed,
      estimatedCostUsd: num(r.pricedCalls) ? round6(num(r.estimatedCostUsd) ?? 0) : null,
      billedPerAcceptedSecondUsd: billed !== null && seconds ? round6(billed / seconds) : null,
      acceptedSeconds: seconds,
      unpricedCalls: num(r.unpricedCalls) ?? 0,
    };
  });
  const billed = assets.filter((a) => a.billedCostUsd !== null);
  return {
    assets,
    billedTotalUsd: billed.length ? round6(billed.reduce((n, a) => n + a.billedCostUsd!, 0)) : null,
    unreconciledAssets: assets.length - billed.length,
  };
}

/* ── the bill reconciliation (scripts/studio-ledger-import.mts) ───────────── */

export interface StudioBillRow {
  kind: string;
  ref: string;
  /** The actual billed cost for this asset from the invoice / billing export. */
  billedCostUsd: number;
  billedSource: "invoice" | "billing-export";
  /** YYYY-MM of the bill. */
  billedPeriod: string;
  /** Seconds accepted into the product (audio, video, music). */
  acceptedSeconds?: number;
  /** Calls made outside the app (the offline art and audio rounds), by modality. */
  calls?: Partial<Record<StudioModality, number>>;
}

/** Why a bill row cannot be written (empty = it can). */
export function billRowProblems(row: StudioBillRow): string[] {
  const out: string[] = [];
  if (!studioAsset(row.kind, row.ref)) out.push(`not a studio asset: ${row.kind}:${row.ref}`);
  if (!(typeof row.billedCostUsd === "number" && Number.isFinite(row.billedCostUsd) && row.billedCostUsd >= 0)) out.push("billedCostUsd must be a number ≥ 0");
  if (row.billedSource !== "invoice" && row.billedSource !== "billing-export") out.push("billedSource must be invoice or billing-export");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.billedPeriod ?? "")) out.push("billedPeriod must be YYYY-MM");
  if (row.acceptedSeconds !== undefined && !(Number.isFinite(row.acceptedSeconds) && row.acceptedSeconds >= 0)) out.push("acceptedSeconds must be ≥ 0");
  for (const [m, n] of Object.entries(row.calls ?? {})) if (!(STUDIO_MODALITIES as readonly string[]).includes(m) || !(Number.isSafeInteger(n) && (n as number) >= 0)) out.push(`calls.${m} must be a whole number ≥ 0 of a known modality`);
  return out;
}

/** The ledger fields one bill row SETS (the billed cost replaces, never adds). */
export function billRowFields(row: StudioBillRow): { key: string; fields: Record<string, unknown> } {
  const asset = studioAsset(row.kind, row.ref)!;
  return {
    key: studioAssetKey(asset),
    fields: {
      asset: studioAssetKey(asset),
      kind: asset.kind,
      ref: asset.ref,
      billedCostUsd: row.billedCostUsd,
      billedSource: row.billedSource,
      billedPeriod: row.billedPeriod,
      ...(row.acceptedSeconds !== undefined ? { acceptedSeconds: row.acceptedSeconds } : {}),
      ...(row.calls ? { offlineCalls: row.calls } : {}),
    },
  };
}
