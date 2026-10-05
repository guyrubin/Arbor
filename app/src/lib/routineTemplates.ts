/* ════════════════════════════════════════════════════════════════════════════
   routineTemplates.ts — B-GROWTH-25: the twelve ready-made routines as Plans
   templates (the Plans lane template adapter).

   A routine board becomes an `ActionPlan` the parent can start in one tap with
   NO goal: title = the routine's title, one phase whose description carries
   the routine's time + why-line, and one step per board step (none done). The
   plan then runs on the plan-as-track seam ASKJB shipped (PlanTrackCard /
   PlanSteps) and lands in the timeline through the `plans` source like any
   other plan.

   Pure (no React, no I/O): the caller passes the language, the child's first
   name and `now`. The template carries no issue text — a routine is not a
   problem statement about the child (law 1) — and no scripts or success
   indicators (nothing invented beyond the board).
   ════════════════════════════════════════════════════════════════════════════ */

import type { ActionPlan } from "../types";
import type { UiLang } from "./i18n";
import { localized, routinesForAge, type Routine } from "./routines";

/** Id prefix of a plan started from a routine template (`plan-routine-<id>-<ms>`). */
export const ROUTINE_PLAN_PREFIX = "plan-routine-";

/** The routine id a plan was started from, or null for any other plan. */
export function routineIdOfPlan(plan: Pick<ActionPlan, "id">): string | null {
  if (!plan.id.startsWith(ROUTINE_PLAN_PREFIX)) return null;
  const rest = plan.id.slice(ROUTINE_PLAN_PREFIX.length);
  const m = /^([a-z0-9-]+?)-(\d{10,})$/.exec(rest);
  return m ? m[1] : null;
}

/** One routine → one startable plan (EN or HE, the child's name filled in). */
export function routineToPlan(routine: Routine, lang: UiLang, firstName: string, nowMs: number): ActionPlan {
  const title = localized(routine.title, lang);
  const why = localized(routine.why, lang).replace(/\{name\}/g, firstName);
  return {
    // The trailing epoch keeps ArborContext's newest-first id sort working.
    id: `${ROUTINE_PLAN_PREFIX}${routine.id}-${nowMs}`,
    title,
    issue: "",
    phases: [
      {
        name: title,
        description: `${localized(routine.time, lang)} · ${why}`,
        steps: routine.steps.map((s) => ({ text: localized(s.label, lang), completed: false })),
      },
    ],
    scripts: [],
    successIndicators: [],
  };
}

/** The templates offered for a child of this age (months; null = every one). */
export function routineTemplatesForAge(months: number | null | undefined): Routine[] {
  return routinesForAge(months);
}
