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
  if (typeof plan.id !== "string" || !plan.id.startsWith(ROUTINE_PLAN_PREFIX)) return null;
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

/* ── FEAT-07: a routine plan runs again every day ─────────────────────────────
   A routine plan never writes `step.completed` (that would finish it after one
   run). Each day's ticks live in `plan.routineRuns[YYYY-MM-DD]` as the indices
   of the steps done that day. All helpers are pure: they return a new plan and
   never mutate the one passed in. Counts only — never a ratio or a score. */

/** How many days of runs a routine plan keeps. */
export const ROUTINE_RUN_KEEP_DAYS = 14;

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The LOCAL calendar day (YYYY-MM-DD) a run is filed under. */
export function routineDayKey(now: Date | number): string {
  const d = typeof now === "number" ? new Date(now) : now;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole days from `a` to `b` (both day keys), or null when either is malformed. */
function dayDiff(a: string, b: string): number | null {
  const ma = DAY_KEY.exec(a);
  const mb = DAY_KEY.exec(b);
  if (!ma || !mb) return null;
  const ta = Date.UTC(Number(ma[1]), Number(ma[2]) - 1, Number(ma[3]));
  const tb = Date.UTC(Number(mb[1]), Number(mb[2]) - 1, Number(mb[3]));
  return Math.round((tb - ta) / 86_400_000);
}

/** Every step of a routine plan, across its phases (a template has one phase). */
export function routineStepCount(plan: Pick<ActionPlan, "phases">): number {
  return (plan.phases ?? []).reduce((n, ph) => n + (ph.steps?.length ?? 0), 0);
}

function cleanRun(run: readonly number[] | undefined, total: number): number[] {
  if (!Array.isArray(run)) return [];
  const seen = new Set<number>();
  for (const i of run) if (Number.isInteger(i) && i >= 0 && i < total) seen.add(i);
  return [...seen].sort((x, y) => x - y);
}

/** The step indices done on `dayKey` ([] for any plan not started from a routine). */
export function routineRunToday(plan: ActionPlan, dayKey: string): number[] {
  if (routineIdOfPlan(plan) === null) return [];
  return cleanRun(plan.routineRuns?.[dayKey], routineStepCount(plan));
}

/** Keep only well-formed, non-empty days within `keepDays` before `dayKey`. */
function prunedRuns(runs: Record<string, number[]>, dayKey: string, total: number, keepDays: number): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [key, run] of Object.entries(runs)) {
    const diff = dayDiff(key, dayKey);
    if (diff === null || diff < -1 || diff > keepDays) continue;
    const clean = cleanRun(run, total);
    if (clean.length) out[key] = clean;
  }
  return out;
}

/**
 * Tick (or untick) step `idx` for `dayKey`. Returns the SAME plan for a plan
 * not started from a routine or an index outside the board; otherwise a new
 * plan whose `routineRuns` is pruned to the last `keepDays` days.
 */
export function toggleRoutineStep(plan: ActionPlan, dayKey: string, idx: number, keepDays = ROUTINE_RUN_KEEP_DAYS): ActionPlan {
  if (routineIdOfPlan(plan) === null) return plan;
  const total = routineStepCount(plan);
  if (!Number.isInteger(idx) || idx < 0 || idx >= total) return plan;
  const today = routineRunToday(plan, dayKey);
  const next = today.includes(idx) ? today.filter((i) => i !== idx) : [...today, idx].sort((x, y) => x - y);
  const runs = prunedRuns({ ...(plan.routineRuns ?? {}), [dayKey]: next }, dayKey, total, keepDays);
  return { ...plan, routineRuns: runs };
}

/** Clear today's run (earlier days stay). Same plan back for a non-routine plan. */
export function resetRoutineToday(plan: ActionPlan, dayKey: string, keepDays = ROUTINE_RUN_KEEP_DAYS): ActionPlan {
  if (routineIdOfPlan(plan) === null) return plan;
  const runs = prunedRuns({ ...(plan.routineRuns ?? {}), [dayKey]: [] }, dayKey, routineStepCount(plan), keepDays);
  return { ...plan, routineRuns: runs };
}

/** Days on which EVERY step was run (a partial day never counts). */
export function routineDaysComplete(plan: ActionPlan): number {
  if (routineIdOfPlan(plan) === null) return 0;
  const total = routineStepCount(plan);
  if (total === 0) return 0;
  return Object.entries(plan.routineRuns ?? {}).filter(
    ([key, run]) => DAY_KEY.test(key) && cleanRun(run, total).length === total,
  ).length;
}

/** Whether every step was run on `dayKey`. */
export function isRoutineRunComplete(plan: ActionPlan, dayKey: string): boolean {
  const total = routineStepCount(plan);
  return total > 0 && routineRunToday(plan, dayKey).length === total;
}
