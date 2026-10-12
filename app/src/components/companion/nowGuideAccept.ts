import { useSyncExternalStore } from "react";

/**
 * v3 F-NOW-1 (FEAT-02 r1): choosing the guide's AI step writes the action
 * optimistically, so the accepted row takes Now's lead — unmounting the
 * recommendation and its reader — before the write settles. When the store
 * then rejects, the row rolls back and the recommendation mounts again with
 * fresh state. This page-session note (child id → the step that failed)
 * lets that fresh mount still say the step did not save, for that step only.
 */
const failed = new Map<string, string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export function markAcceptFailed(childId: string, step: string): void {
  if (failed.get(childId) === step) return;
  failed.set(childId, step);
  emit();
}

export function clearAcceptFailed(childId: string): void {
  if (failed.delete(childId)) emit();
}

export function acceptFailedFor(childId: string, step: string | null | undefined): boolean {
  return !!step && failed.get(childId) === step;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** True while this child's last failed accept is the step on screen now.
 *  The app renders on the client only, so the first paint reads the same note. */
export function useAcceptFailed(childId: string, step: string | null | undefined): boolean {
  const read = () => acceptFailedFor(childId, step);
  return useSyncExternalStore(subscribe, read, read);
}
