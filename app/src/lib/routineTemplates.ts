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

/** B-ASKJB-26 — the nine problem-named template chips on Plans are FOLDED
 *  into the authored routine boards: each one only ever started one of these
 *  boards (two started the same one), so the ready-made routines row is the
 *  one way to start a board — the board's own EN + HE steps, zero
 *  generate-plan calls, no new copy (the row's Gate).
 *
 *  After a start the new plan leads the page, above the row the parent tapped.
 *  This names the lead plan that has just appeared — not seen on this page
 *  before and created in the last two minutes (both plan id shapes end in the
 *  creation epoch: `routine-<id>-<ms>`, `plan-<ms>`) — so the page can answer
 *  where the parent is looking. A child switch or a synced older plan is
 *  never "just started". */
export const JUST_STARTED_MS = 120_000;
export function justStartedPlanId(plans: readonly { id: string }[], seen: ReadonlySet<string>, nowMs: number): string | null {
  const lead = plans[0];
  if (!lead || seen.has(lead.id)) return null;
  const m = /-(\d{13})$/.exec(lead.id);
  if (!m) return null;
  const age = nowMs - Number(m[1]);
  return age >= 0 && age <= JUST_STARTED_MS ? lead.id : null;
}

/** Critic r2: the page's memory of plans already seen. The FIRST load primes
 *  it with every plan there (no receipt: a reload within two minutes of a
 *  start is not a new start); later loads name a just-started lead plan. */
export function nextStartedPlan(seen: ReadonlySet<string> | null, plans: readonly { id: string }[], nowMs: number): { seen: Set<string>; leadId: string | null } {
  const next = new Set(seen ?? []);
  const leadId = seen === null ? null : justStartedPlanId(plans, seen, nowMs);
  for (const p of plans) next.add(p.id);
  return { seen: next, leadId };
}

/** The templates offered for a child of this age (months; null = every one). */
export function routineTemplatesForAge(months: number | null | undefined): Routine[] {
  return routinesForAge(months);
}

/* ── FEAT-07: a routine plan runs again every day ─────────────────────────────
   A routine plan never writes `step.completed` (that would finish it after one
   run). Each day's ticks live in `plan.routineRuns[YYYY-MM-DD]` as the indices
   of the steps done that day. All helpers are pure: they return a new plan and
   never mutate the one passed in. Counts only — never a ratio or a score.

   The window: a plan keeps (and counts) the runs of the last
   ROUTINE_RUN_KEEP_DAYS local days, today included — `0 <= age < keepDays`.
   One tolerance: a key ONE day ahead of this device is kept (never counted),
   because another device in a later time zone may already be on tomorrow, and
   pruning it here would erase that family member's ticks. */

/** How many days of runs a routine plan keeps (today and the 13 days before). */
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

/** Whether `key` is one of the `keepDays` local days ending on `dayKey`. */
function inWindow(key: string, dayKey: string, keepDays: number): boolean {
  const age = dayDiff(key, dayKey);
  return age !== null && age >= 0 && age < keepDays;
}

/** Keep only well-formed, non-empty days in the window (plus one day ahead, see above). */
function prunedRuns(runs: Record<string, number[]>, dayKey: string, total: number, keepDays: number): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [key, run] of Object.entries(runs)) {
    if (!inWindow(key, dayKey, keepDays) && dayDiff(key, dayKey) !== -1) continue;
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

/**
 * Days in the last `keepDays` local days (today included) on which EVERY step
 * was run. A partial day never counts, and neither does a day outside the
 * window, even while it is still stored (runs are pruned only on a write).
 */
export function routineDaysComplete(plan: ActionPlan, dayKey: string, keepDays = ROUTINE_RUN_KEEP_DAYS): number {
  if (routineIdOfPlan(plan) === null) return 0;
  const total = routineStepCount(plan);
  if (total === 0) return 0;
  return Object.entries(plan.routineRuns ?? {}).filter(
    ([key, run]) => inWindow(key, dayKey, keepDays) && cleanRun(run, total).length === total,
  ).length;
}

/** Whether every step was run on `dayKey`. */
export function isRoutineRunComplete(plan: ActionPlan, dayKey: string): boolean {
  const total = routineStepCount(plan);
  return total > 0 && routineRunToday(plan, dayKey).length === total;
}

/** Whether `dayKey`'s finished run already had its celebration (on any device). */
export function routineCelebrated(plan: ActionPlan, dayKey: string): boolean {
  return routineIdOfPlan(plan) !== null && plan.routineCelebratedOn === dayKey;
}

/** The plan with `dayKey` marked as celebrated (same plan back for a non-routine plan). */
export function markRoutineCelebrated(plan: ActionPlan, dayKey: string): ActionPlan {
  if (routineIdOfPlan(plan) === null) return plan;
  return { ...plan, routineCelebratedOn: dayKey };
}
