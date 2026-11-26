/**
 * COST-1 (WAF backlog): usage counters in a SHARED store.
 *
 * The previous hourly AI cap lived in a per-instance Map, so it reset on every
 * Cloud Run scale-out. This store keeps fixed-window counters in Firestore
 * (collection `aiQuota`, doc per key+window) so caps hold across instances.
 * Local/sandbox keeps the in-memory implementation.
 *
 * B-AIOPS-01 (2026-11-26): Firestore failures fail CLOSED. They used to return
 * `{ count: 0 }`, so a datastore error read as "zero usage" and every metered
 * paid call (requests, images, narration, hero poses, plan plates) was granted
 * spare capacity it could not prove. The store now throws
 * `QuotaStoreUnavailableError`; the gates answer a calm, retryable 503
 * (`QUOTA_UNAVAILABLE_BODY`, never the "you hit your limit" copy) and display
 * reads degrade to "unknown", never to 0 used.
 *
 * AIR-7 (2026-07-25): `increment`/`add` used to cost TWO Firestore round-trips
 * (set THEN get) on every call — dead pre-model latency on every /chat. When
 * the caller passes its enforcement `limit`, the Firestore store now trusts
 * `FieldValue.increment` and a per-instance running estimate for the common
 * far-from-limit case (ONE round-trip), re-syncing with a real read only when
 * the estimate nears the limit (>=80%) or periodically to bound multi-instance
 * drift. Enforcement stays exact where it matters: near the limit every call
 * reads the authoritative count.
 *
 * AIR-6: `add(name, key, amount, windowMs)` supports amount-based meters (the
 * character-metered daily TTS cap) on the same window/rollover semantics.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { logger } from "./logger.js";

export type CounterOptions = {
  /** The caller's enforcement limit — enables the single-round-trip fast path. */
  limit?: number;
};

export interface UsageCounterStore {
  /** Increment counter `name` for `key` within the fixed window; returns the new count. */
  increment(name: string, key: string, windowMs: number, opts?: CounterOptions): Promise<{ count: number; resetAt: number }>;
  /** Add `amount` units (e.g. TTS characters) to counter `name` within the fixed window. */
  add(name: string, key: string, amount: number, windowMs: number, opts?: CounterOptions): Promise<{ count: number; resetAt: number }>;
  /** Read without incrementing (for usage displays). */
  peek(name: string, key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

export const QUOTA_UNAVAILABLE = "quota_unavailable";
/** Seconds; the same short wait the image route's transient 503 asks for. */
export const QUOTA_UNAVAILABLE_RETRY_AFTER = "15";
/** The 503 body every metered gate answers on a store error. The client maps
 *  503 to its existing calm, retryable copy (lib/aiErrorCopy generic), so no
 *  new user-facing string is carried here. */
export const QUOTA_UNAVAILABLE_BODY = Object.freeze({ error: QUOTA_UNAVAILABLE, code: QUOTA_UNAVAILABLE, retryable: true });

/** B-AIOPS-01: the counter store could not be read or written. Never "0 used". */
export class QuotaStoreUnavailableError extends Error {
  readonly code = QUOTA_UNAVAILABLE;
  constructor(readonly counter: string, options?: { cause?: unknown }) {
    super(`Usage counter store unavailable (${counter})`, options);
    this.name = "QuotaStoreUnavailableError";
  }
}

export const isQuotaStoreUnavailable = (err: unknown): err is QuotaStoreUnavailableError =>
  err instanceof QuotaStoreUnavailableError || (err as { code?: unknown } | null)?.code === QUOTA_UNAVAILABLE;

/** Answer the store-error 503 on an Express-like response. */
export const sendQuotaUnavailable = (res: { setHeader(name: string, value: string): unknown; status(code: number): { json(body: unknown): unknown } }) => {
  res.setHeader("Retry-After", QUOTA_UNAVAILABLE_RETRY_AFTER);
  res.status(503).json({ ...QUOTA_UNAVAILABLE_BODY });
};

const windowStart = (windowMs: number, now = Date.now()) => now - (now % windowMs);

export class MemoryCounterStore implements UsageCounterStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  async increment(name: string, key: string, windowMs: number) {
    return this.add(name, key, 1, windowMs);
  }

  async add(name: string, key: string, amount: number, windowMs: number) {
    const now = Date.now();
    const start = windowStart(windowMs, now);
    const id = `${name}:${key}:${start}`;
    let bucket = this.buckets.get(id);
    if (!bucket) {
      bucket = { count: 0, resetAt: start + windowMs };
      this.buckets.set(id, bucket);
      // Opportunistic cleanup of expired windows.
      for (const [k, v] of this.buckets) if (v.resetAt <= now) this.buckets.delete(k);
    }
    bucket.count += amount;
    return { ...bucket };
  }

  async peek(name: string, key: string, windowMs: number) {
    const start = windowStart(windowMs);
    const bucket = this.buckets.get(`${name}:${key}:${start}`);
    return bucket ? { ...bucket } : { count: 0, resetAt: start + windowMs };
  }
}

/** Re-sync the local estimate against Firestore at least every N writes. */
const ESTIMATE_MAX_DRIFT_WRITES = 20;
/** Above this fraction of the limit every call reads the authoritative count. */
const ESTIMATE_SAFE_FRACTION = 0.8;

export class FirestoreCounterStore implements UsageCounterStore {
  private readonly db;
  /** AIR-7: per-instance running estimates keyed `${name}:${key}:${start}`. */
  private readonly estimates = new Map<string, { base: number; pendingWrites: number; pendingAmount: number; resetAt: number }>();

  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  private ref(name: string, key: string, start: number) {
    // Key sanitization: uids and IPs may contain ':' / '/'.
    const safeKey = `${name}_${key}`.replace(/[/\\#?]/g, "_");
    return this.db.collection("aiQuota").doc(`${safeKey}_${start}`);
  }

  async increment(name: string, key: string, windowMs: number, opts?: CounterOptions) {
    return this.add(name, key, 1, windowMs, opts);
  }

  async add(name: string, key: string, amount: number, windowMs: number, opts?: CounterOptions) {
    const now = Date.now();
    const start = windowStart(windowMs, now);
    const resetAt = start + windowMs;
    const ref = this.ref(name, key, start);
    const estimateId = `${name}:${key}:${start}`;
    try {
      // One round-trip: the write is a blind FieldValue.increment.
      await ref.set(
        {
          count: FieldValue.increment(amount),
          name,
          key,
          resetAt,
          // For a Firestore TTL policy on `expireAt` (cleanup of old windows).
          expireAt: new Date(resetAt + 24 * 60 * 60 * 1000),
        },
        { merge: true },
      );

      // Fast path (AIR-7): trust the local estimate while comfortably under the
      // caller's limit; skip the read entirely.
      const cached = this.estimates.get(estimateId);
      if (cached && opts?.limit !== undefined) {
        cached.pendingWrites += 1;
        cached.pendingAmount += amount;
        const estimate = cached.base + cached.pendingAmount;
        if (estimate < opts.limit * ESTIMATE_SAFE_FRACTION && cached.pendingWrites < ESTIMATE_MAX_DRIFT_WRITES) {
          return { count: estimate, resetAt };
        }
      }

      // Authoritative read: first call of a window, near the limit, drift
      // re-sync, or a caller that did not declare a limit (exact semantics).
      const snap = await ref.get();
      const count = (snap.data()?.count as number) || amount;
      this.estimates.set(estimateId, { base: count, pendingWrites: 0, pendingAmount: 0, resetAt });
      this.pruneEstimates(now);
      return { count, resetAt };
    } catch (error) {
      logger.error("Quota store increment failed — failing closed", error, { name });
      throw new QuotaStoreUnavailableError(name, { cause: error });
    }
  }

  private pruneEstimates(now: number) {
    if (this.estimates.size <= 5000) return;
    for (const [k, v] of this.estimates) {
      if (v.resetAt <= now) this.estimates.delete(k);
    }
  }

  async peek(name: string, key: string, windowMs: number) {
    const start = windowStart(windowMs);
    const resetAt = start + windowMs;
    try {
      const snap = await this.ref(name, key, start).get();
      return { count: (snap.data()?.count as number) || 0, resetAt };
    } catch (error) {
      logger.error("Quota store read failed — usage unknown", error, { name });
      throw new QuotaStoreUnavailableError(name, { cause: error });
    }
  }
}

export const createCounterStore = (config: ArborConfig): UsageCounterStore =>
  config.memoryAdapter === "firestore" ? new FirestoreCounterStore(config) : new MemoryCounterStore();
