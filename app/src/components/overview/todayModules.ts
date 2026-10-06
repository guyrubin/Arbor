/* ════════════════════════════════════════════════════════════════════════════
   todayModules v3 — B-LOOP-07: Today = THREE BLOCKS (the milestone loop).

     practice — Today's practice (B-LOOP-09), the day's primary move; in the
                evening only its outcome strip.
     notice   — Notice today: ≤ 2 watch-for cards (B-LOOP-04), never the
                practice's shelf.
     tonight  — Tonight's three questions (B-LOOP-10). Before the evening door
                opens it is ONE pointer line under `notice` ("Tonight · 3 quick
                questions"), not a module.
     door     — "More for today": chrome, never counted (what changed since
                you left, hard-moment words, the week, Daily Play, an accepted
                step, a lifecycle moment, first steps).

   Order: morning practice → notice (+ tonight pointer); evening tonight →
   practice outcome → notice. `lifecycle`, `changed`, `noticed`, `rail` are no
   longer modules — they live behind the door, so they can never be siblings.

   The budget still counts the modules that ACTUALLY render (P1-B lesson): the
   inputs are each block's real render condition, never a governance gate.
   Pure functions — no React, no context, no I/O.
   ════════════════════════════════════════════════════════════════════════════ */

export type TodayModuleId = "practice" | "notice" | "tonight" | "door";

/** At most three modules render on Today in every state; the door is chrome. */
export const TODAY_MODULE_BUDGET = 3;

export interface TodayPlanInput {
  /** The evening door is open (lib/timeOfDay bedtimeDoorOpen) or the parent opened Tonight early. */
  evening: boolean;
  /** Block 1 has something to show: a practice, or the thin-shelf Notice card fallback. */
  practice: boolean;
  /** Block 2 has at least one watch-for card. */
  notice: boolean;
  /** Tonight has a question to ask (a day to read from). */
  tonight: boolean;
  /** Evening only: today's practice was answered (its outcome strip has a line). */
  practiceAnswered?: boolean;
}

export interface TodayPlan {
  /** The modules that render, in order — never more than the budget, never the door. */
  order: TodayModuleId[];
  /** Morning: the one-line pointer to Tonight under `notice`. */
  tonightPointer: boolean;
  /** How block 1 renders: the full card, its outcome strip (evening), or not at all. */
  practiceMode: "card" | "outcome" | null;
}

export function planToday(input: TodayPlanInput): TodayPlan {
  const order: TodayModuleId[] = [];
  let practiceMode: TodayPlan["practiceMode"] = null;
  if (input.evening && input.tonight) {
    order.push("tonight");
    if (input.practice && input.practiceAnswered) {
      order.push("practice");
      practiceMode = "outcome";
    }
    if (input.notice) order.push("notice");
    return { order: order.slice(0, TODAY_MODULE_BUDGET), tonightPointer: false, practiceMode };
  }
  if (input.practice) {
    order.push("practice");
    practiceMode = "card";
  }
  if (input.notice) order.push("notice");
  return { order: order.slice(0, TODAY_MODULE_BUDGET), tonightPointer: input.tonight, practiceMode };
}
