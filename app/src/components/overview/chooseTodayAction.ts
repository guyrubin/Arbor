/* ════════════════════════════════════════════════════════════════════════════
   chooseTodayAction — W1 1.2 "guaranteed action" fallback chain (the Whoop
   rule, masterplan §3): EVERY open of Today ends in exactly ONE offered
   primary action, including day-0 / AI-miss / offline.

   Deterministic chain, pure function (all branches unit-tested):

     1. loop    — an accepted action is already active → TodayActionLoop card.
     1a. recap  — ENG-24: the week has turned and last week's recap is written
                  and unopened → the recap IS the day's anchor (the 3-5 story
                  cards, last card = the accepted step). Outranks everything
                  except an action the parent has already accepted; a
                  week-boundary ritual is the cheapest habit anchor there is,
                  and the recap already exists and is firewall-clean. The
                  CALLER owns "the week has turned" (weekAnchorRecapDue) so
                  this stays a pure ranking function.
     1b. weekOpen — ENG-24 as SHIPPED: the calendar week has turned and this
                  device has not been offered the week's anchor yet. Says only
                  what the calendar says and offers one capture, so it needs no
                  recap signal and can be mounted with nothing but a date and a
                  localStorage read (weekOpenAnchorDue). Ranks BELOW `recap`,
                  which is the same ritual with a verified report behind it, and
                  below an accepted action; above focus for the same reason
                  `recap` is — a week boundary is the cheapest habit anchor
                  there is, it appears once a week, and dismissing it falls
                  straight through to the focus hero in the same frame.
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
  | { kind: "recap" }
  | { kind: "weekOpen" }
  | { kind: "focus" }
  | { kind: "prompt"; promptKey: string }
  | { kind: "play" }
  | { kind: "capture" };

export function chooseTodayAction(input: {
  /** An accepted today-action already exists (actionLoop owns the slot). */
  hasActiveAction: boolean;
  /** ENG-24: a new week has started AND last week's recap is generated and
   *  still unopened (weekAnchorRecapDue). Defaults to false, so every existing
   *  caller keeps its exact behaviour. */
  hasWeekAnchorRecap?: boolean;
  /** ENG-24 as shipped: the calendar week has turned and this device has not
   *  been offered the week's anchor yet (weekOpenAnchorDue). Defaults to false,
   *  so every existing caller keeps its exact behaviour. */
  hasWeekOpenAnchor?: boolean;
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
  if (input.hasWeekAnchorRecap) return { kind: "recap" };
  if (input.hasWeekOpenAnchor) return { kind: "weekOpen" };
  if (input.focusHeadline || input.focusPending) return { kind: "focus" };
  if (input.promptKeys.length > 0) return { kind: "prompt", promptKey: input.promptKeys[0] };
  if (input.hasDailyPlay) return { kind: "play" };
  return { kind: "capture" };
}
