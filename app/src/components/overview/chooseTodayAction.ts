/* ════════════════════════════════════════════════════════════════════════════
   chooseTodayAction — W1 1.2 "guaranteed action" fallback chain (the Whoop
   rule, masterplan §3): EVERY open of Today ends in exactly ONE offered
   primary action, including day-0 / AI-miss / offline.

   Deterministic chain, pure function (all branches unit-tested):

     1. loop    — an accepted action is already active → TodayActionLoop card.
     2. focus   — a real AI focus headline exists (or is still being fetched
                  for a child WITH data: `focusPending` keeps the hero+skeleton
                  so the slot never flickers prompt→focus mid-load).
     3. prompt  — no AI focus → the promptBank capture prompt of the day
                  ("What made her laugh today?") with a capture CTA.
     4. play    — no band prompts (defensively unreachable: bandForAge always
                  resolves a band) → evergreen Daily Play pick as primary.
     5. capture — absolute floor: a bare capture-one-moment card.

   Exactly one of these renders in Today's left slot (Rule A: one primary
   action above the fold) — enforced by todayConsolidation.test.ts.
   ════════════════════════════════════════════════════════════════════════════ */

export type TodayActionChoice =
  | { kind: "loop" }
  | { kind: "focus" }
  | { kind: "prompt"; promptKey: string }
  | { kind: "play" }
  | { kind: "capture" };

export function chooseTodayAction(input: {
  /** An accepted today-action already exists (actionLoop owns the slot). */
  hasActiveAction: boolean;
  /** The scrubbed AI focus headline (focusHeadlineFrom), or null. */
  focusHeadline: string | null;
  /** True while a focus fetch is in flight for a child with signals. */
  focusPending: boolean;
  /** Today's rotating promptBank keys for the child's band (dailyPromptKeys). */
  promptKeys: readonly string[];
  /** A Daily Play pick exists for the child. */
  hasDailyPlay: boolean;
}): TodayActionChoice {
  if (input.hasActiveAction) return { kind: "loop" };
  if (input.focusHeadline || input.focusPending) return { kind: "focus" };
  if (input.promptKeys.length > 0) return { kind: "prompt", promptKey: input.promptKeys[0] };
  if (input.hasDailyPlay) return { kind: "play" };
  return { kind: "capture" };
}
