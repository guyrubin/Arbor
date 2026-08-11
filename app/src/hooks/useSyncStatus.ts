import { useCallback, useSyncExternalStore } from "react";
import { getSyncSnapshot, retrySync, subscribeSyncStatus, type SyncSnapshot } from "../lib/syncStore";

/**
 * useSyncStatus — W0.5 + W0.6: the read side of lib/syncStore plus browser
 * online/offline, for the ONE global SyncStatusBanner and the topbar chip.
 *
 * - `online` comes from navigator.onLine via the window online/offline events
 *   (the app previously had ZERO listeners — offline was silent).
 * - `hasSyncError` is true while any useChildCollection live listener is in
 *   its error state (registered in lib/syncStore, deduped per collection).
 * - `retry()` bumps the store version → every mounted useChildCollection
 *   re-runs its subscribe effect (full listener re-mount).
 */

function subscribeOnline(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

const getOnline = (): boolean =>
  typeof navigator === "undefined" || navigator.onLine !== false;

export type SyncStatus = {
  /** Browser connectivity (navigator.onLine, live via online/offline events). */
  online: boolean;
  /** True while at least one live collection listener is in error state. */
  hasSyncError: boolean;
  /** Number of distinct collections currently failing to refresh. */
  errorCount: number;
  /** Re-mount all live listeners (the banner's Retry). */
  retry: () => void;
};

export function useSyncStatus(): SyncStatus {
  const online = useSyncExternalStore(subscribeOnline, getOnline, () => true);
  const snap: SyncSnapshot = useSyncExternalStore(subscribeSyncStatus, getSyncSnapshot, getSyncSnapshot);
  const retry = useCallback(() => retrySync(), []);
  return { online, hasSyncError: snap.errors.length > 0, errorCount: snap.errors.length, retry };
}

export default useSyncStatus;
