/**
 * COST-1 (WAF backlog): usage counters in a SHARED store.
 *
 * The previous hourly AI cap lived in a per-instance Map, so it reset on every
 * Cloud Run scale-out. This store keeps fixed-window counters in Firestore
 * (collection `aiQuota`, doc per key+window) so caps hold across instances.
 * Local/sandbox keeps the in-memory implementation. Firestore failures fail
 * OPEN (availability over enforcement) and are logged.
 */
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { logger } from "./logger.js";

export interface UsageCounterStore {
  /** Increment counter `name` for `key` within the fixed window; returns the new count. */
  increment(name: string, key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  /** Read without incrementing (for usage displays). */
  peek(name: string, key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

const windowStart = (windowMs: number, now = Date.now()) => now - (now % windowMs);

export class MemoryCounterStore implements UsageCounterStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  async increment(name: string, key: string, windowMs: number) {
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
    bucket.count += 1;
    return { ...bucket };
  }

  async peek(name: string, key: string, windowMs: number) {
    const start = windowStart(windowMs);
    const bucket = this.buckets.get(`${name}:${key}:${start}`);
    return bucket ? { ...bucket } : { count: 0, resetAt: start + windowMs };
  }
}

export class FirestoreCounterStore implements UsageCounterStore {
  private readonly db;
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

  async increment(name: string, key: string, windowMs: number) {
    const now = Date.now();
    const start = windowStart(windowMs, now);
    const resetAt = start + windowMs;
    const ref = this.ref(name, key, start);
    try {
      await ref.set(
        {
          count: FieldValue.increment(1),
          name,
          key,
          resetAt,
          // For a Firestore TTL policy on `expireAt` (cleanup of old windows).
          expireAt: new Date(resetAt + 24 * 60 * 60 * 1000),
        },
        { merge: true },
      );
      const snap = await ref.get();
      return { count: (snap.data()?.count as number) || 1, resetAt };
    } catch (error) {
      logger.error("Quota store increment failed — failing open", error, { name });
      return { count: 0, resetAt };
    }
  }

  async peek(name: string, key: string, windowMs: number) {
    const start = windowStart(windowMs);
    const resetAt = start + windowMs;
    try {
      const snap = await this.ref(name, key, start).get();
      return { count: (snap.data()?.count as number) || 0, resetAt };
    } catch {
      return { count: 0, resetAt };
    }
  }
}

export const createCounterStore = (config: ArborConfig): UsageCounterStore =>
  config.memoryAdapter === "firestore" ? new FirestoreCounterStore(config) : new MemoryCounterStore();
