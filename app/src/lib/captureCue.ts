/* ════════════════════════════════════════════════════════════════════════════
   captureCue — TJB-12: the Journal writing prompt must reach the capture form.

   The Journal mounts three rotating promptBank questions. Tapping one shows it
   as a writing cue ABOVE the compose card — and then the parent taps Voice /
   Photo / Text, lands on the capture form in Behaviors, and the question is
   GONE. They are now staring at an empty "What happened?" with no memory of
   what they were about to answer.

   The sanctioned pattern (W1, pinned by tabs/journalPrompts.test.ts) is that
   the question is a CUE, never draft content: `requestCapture(mode)` stays
   mode-only and the prompt text is never injected into the log body — the
   answer belongs in the log, the question does not. So the cue travels on its
   own one-slot channel, and the capture surface RENDERS it beside the field.

   Deliberately a module store rather than context state: the two ends of this
   handoff (JournalTab, BehaviorsTab) are the only participants, and it stays
   out of ArborContext's re-render graph. Consume-once, same contract as the
   `pendingCaptureMode` / `pendingJournalFocusId` seams.
   ════════════════════════════════════════════════════════════════════════════ */

import { useSyncExternalStore } from "react";

/** The promptBank i18n key the parent tapped, or null. */
let cue: string | null = null;
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};

/** Arm the cue for the next capture surface. `null` clears it. */
export function setCaptureCue(promptKey: string | null): void {
  if (cue === promptKey) return;
  cue = promptKey;
  emit();
}

/** Read without subscribing (tests, imperative call sites). */
export function getCaptureCue(): string | null {
  return cue;
}

/** Clear the cue — the capture surface calls this once it has been answered
 *  or abandoned, so a stale question never greets an unrelated capture. */
export function clearCaptureCue(): void {
  setCaptureCue(null);
}

/** Store subscription (also the useSyncExternalStore binding below). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React binding. Server snapshot is null — the cue is a live-session handoff. */
export function useCaptureCue(): string | null {
  return useSyncExternalStore(subscribe, getCaptureCue, () => null);
}

/** Test-only reset so one spec's cue can't leak into the next. */
export function __resetCaptureCue(): void {
  cue = null;
  listeners.clear();
}
