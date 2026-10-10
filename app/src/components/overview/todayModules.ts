/* ════════════════════════════════════════════════════════════════════════════
   todayModules v3 — B-LOOP-07: Today = THREE BLOCKS (the milestone loop).

     practice — Today's practice (B-LOOP-09), the day's primary move. In the
                evening it does not render: Tonight's step 1 asks how it went,
                so a morning receipt under it would contradict the open flow
                (P5-LOOP critic c2 r1).
     notice   — Notice today: ≤ 2 watch-for cards (B-LOOP-04), never the
                practice's shelf.
     tonight  — Tonight's three questions (B-LOOP-10). Before the evening door
                opens it is ONE pointer line under `notice` ("Tonight · 3 quick
                questions"), not a module.
     door     — "More for today": chrome, never counted (what changed since
                you left, hard-moment words, the week, Daily Play, an accepted
                step, a lifecycle moment).

   Order: morning practice → notice (+ tonight pointer); evening tonight →
   notice — unless the evening never showed the practice (critic c2 r2
   P1-2): then practice (tonight mode) → notice (+ tonight pointer). `lifecycle`, `changed`, `noticed` are no
   longer modules — they live behind the door. B-SHELL-36 permanently retires
   the first-steps rail; it is not a module or a budget input.

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
  /** Today's practice was answered (kept for the callers; the evening no longer renders a strip). */
  practiceAnswered?: boolean;
  /** P5-LOOP critic c2 r2 (product P1-2): the parent SAW today's practice
   *  (a dose row, the day pin, a day-mode card impression, or Tonight opened
   *  from the pointer). `false` in the evening → Tonight cannot ask "Did you
   *  try it?" about it, so the evening opens on the practice card in its
   *  tonight mode, with Tonight as the pointer beneath. Omitted = shown. */
  practiceShown?: boolean;
}

export interface TodayPlan {
  /** The modules that render, in order — never more than the budget, never the door. */
  order: TodayModuleId[];
  /** Morning: the one-line pointer to Tonight under `notice`. */
  tonightPointer: boolean;
  /** How block 1 renders: the full card (day), the card offered for tonight
   *  (an evening that never showed it), or not at all (the evening flow). */
  practiceMode: "card" | "tonight" | null;
}

export function planToday(input: TodayPlanInput): TodayPlan {
  const order: TodayModuleId[] = [];
  let practiceMode: TodayPlan["practiceMode"] = null;
  // c2 r2 P1-2: an evening that never showed the practice offers it first —
  // never a question with a false premise ("Did you try it today?").
  if (input.evening && input.practice && input.practiceShown === false) {
    order.push("practice");
    if (input.notice) order.push("notice");
    return { order: order.slice(0, TODAY_MODULE_BUDGET), tonightPointer: input.tonight, practiceMode: "tonight" };
  }
  if (input.evening && input.tonight) {
    order.push("tonight");
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
