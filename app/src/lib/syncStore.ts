/* ════════════════════════════════════════════════════════════════════════════
   syncStore — W0.5 + W0.6 (ARBOR-UI-MASTERPLAN-2026-08-11): the lightweight
   module-level registry of "a live listener failed" facts.

   WHY: useChildCollection's onSnapshot error callback silently degraded to
   localStorage on ~18 screens — error was indistinguishable from empty, and
   offline was silent. Instead of touching 18 screens, every hook instance
   registers its failure here (name + childId) and ONE global banner
   (SyncStatusBanner) subscribes and says "some data couldn't refresh".

   DESIGN:
   - Plain module singleton, framework-free (node-testable, no React import).
   - `errors` is keyed `${name}:${childId}` so repeated errors from the same
     listener are a no-op (no re-render churn while Firestore retries).
   - `version` is the RETRY mechanism: the banner's Retry button bumps it,
     every mounted useChildCollection has it in its subscribe-effect deps, so
     all live listeners fully re-mount (the simplest robust resubscribe).
   - Snapshot object is cached and only replaced on emit → safe for
     useSyncExternalStore (stable reference between changes).

   ADDITIVE by contract: nothing here ever blocks or replaces cached/local
   data — it only records that the remote refresh failed.
   ════════════════════════════════════════════════════════════════════════════ */

export type SyncErrorEntry = { name: string; childId: string };

export type SyncSnapshot = {
  /** Collections whose live Firestore listener last failed (deduped). */
  errors: ReadonlyArray<SyncErrorEntry>;
  /** Bumped by retrySync() — subscribers re-mount their listeners on change. */
  version: number;
};

const errors = new Map<string, SyncErrorEntry>();
let version = 0;
let snapshot: SyncSnapshot = { errors: [], version: 0 };
const listeners = new Set<() => void>();

const keyOf = (name: string, childId: string) => `${name}:${childId}`;

function emit(): void {
  snapshot = { errors: Array.from(errors.values()), version };
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* a broken listener must never break the store or its siblings */
    }
  });
}

/** Register a failed listener. Idempotent per (name, childId) — no churn. */
export function reportSyncError(name: string, childId: string): void {
  const key = keyOf(name, childId);
  if (errors.has(key)) return;
  errors.set(key, { name, childId });
  emit();
}

/** Clear a listener's error (next successful snapshot, or unmount). */
export function clearSyncError(name: string, childId: string): void {
  if (errors.delete(keyOf(name, childId))) emit();
}

/** Current immutable snapshot — reference-stable between emits. */
export function getSyncSnapshot(): SyncSnapshot {
  return snapshot;
}

/** Subscribe to changes; returns the unsubscribe function. */
export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Retry: bump the version so every mounted useChildCollection re-runs its
 * subscribe effect (full listener re-mount). Firestore then re-attempts from
 * its IndexedDB cache + network.
 */
export function retrySync(): void {
  version += 1;
  emit();
}

/** Test-only: reset all module state between test cases. */
export function __resetSyncStoreForTests(): void {
  errors.clear();
  version = 0;
  snapshot = { errors: [], version: 0 };
  listeners.clear();
}
