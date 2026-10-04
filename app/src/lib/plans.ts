import type { ActionPlan, BehaviorLog, PlanCheckAnswer, StepStatus } from "../types";
import type { ActionLoopEntry, ActionOutcome, PlanStepRef } from "../actionLoop/model";
import { MOMENT_BEHAVIOR_TYPE } from "../content/behaviorTaxonomy";

/**
 * Pure helpers that turn a one-shot Growth Plan into a closed loop:
 *  - planProgress(): where the family is in the plan + the next steps to focus on.
 *  - suggestedChallenges(): plan topics derived from the child's own logged behavior
 *    (the moat — a content-only rival can't suggest from THIS child's history).
 * No I/O, no Date.now() in the math (callers pass `today`) — unit-testable.
 */

type PlanStep = ActionPlan["phases"][number]["steps"][number];

const stepDone = (s: PlanStep): boolean => (s.status ? s.status === "done" : s.completed);

export interface PlanProgress {
  totalSteps: number;
  doneSteps: number;
  pct: number;                  // 0–100
  phasesDone: number;
  totalPhases: number;
  currentPhaseIndex: number;    // first phase with an incomplete step (last when complete)
  currentPhaseName: string;
  nextSteps: string[];          // up to `take` incomplete steps in the current phase
  planComplete: boolean;
}

/** Where the family is in a plan, and the 1–3 steps to focus on next. */
export function planProgress(plan: ActionPlan, take = 3): PlanProgress {
  const phases = plan.phases ?? [];
  const allSteps = phases.flatMap((p) => p.steps ?? []);
  const totalSteps = allSteps.length;
  const doneSteps = allSteps.filter(stepDone).length;
  const planComplete = totalSteps > 0 && doneSteps === totalSteps;

  const phasesDone = phases.filter((p) => (p.steps ?? []).length > 0 && (p.steps ?? []).every(stepDone)).length;

  let currentPhaseIndex = phases.findIndex((p) => (p.steps ?? []).some((s) => !stepDone(s)));
  if (currentPhaseIndex === -1) currentPhaseIndex = Math.max(0, phases.length - 1);

  const currentPhase = phases[currentPhaseIndex];
  const nextSteps = (currentPhase?.steps ?? [])
    .filter((s) => !stepDone(s))
    .slice(0, take)
    .map((s) => s.text);

  return {
    totalSteps,
    doneSteps,
    pct: totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0,
    phasesDone,
    totalPhases: phases.length,
    currentPhaseIndex,
    currentPhaseName: currentPhase?.name ?? "",
    nextSteps,
    planComplete,
  };
}

export interface PlanSuggestion {
  topic: string;   // ready to feed into the plan generator
  reason: string;  // why Arbor is suggesting it (from the logs)
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Suggest plan topics from the child's recent, still-unresolved behavior logs:
 * the most frequently logged behavior types over the trailing window, annotated
 * with their most common trigger. Returns [] when there isn't enough signal.
 */
export function suggestedChallenges(
  logs: BehaviorLog[],
  today: string,
  max = 2,
  windowDays = 21
): PlanSuggestion[] {
  const cutoff = new Date(`${today}T23:59:59`).getTime() - windowDays * 86400000;
  const recent = logs.filter((l) => {
    if (l.resolved) return false;
    // Wave T (TJB-01): plain "Moment" rows are ordinary journal captures —
    // they never accumulate into a suggested challenge.
    if (l.behaviorType === MOMENT_BEHAVIOR_TYPE) return false;
    const t = new Date(l.timestamp).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });

  const byType = new Map<string, { count: number; triggers: Map<string, number> }>();
  for (const l of recent) {
    const type = (l.behaviorType || "").trim().toLowerCase();
    if (!type) continue;
    const entry = byType.get(type) ?? { count: 0, triggers: new Map() };
    entry.count++;
    const trig = (l.trigger || "").trim();
    if (trig) entry.triggers.set(trig, (entry.triggers.get(trig) ?? 0) + 1);
    byType.set(type, entry);
  }

  return [...byType.entries()]
    .filter(([, v]) => v.count >= 2) // need a pattern, not a one-off
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, max)
    .map(([type, v]) => {
      const topTrigger = [...v.triggers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return {
        topic: topTrigger
          ? `${cap(type)} — a recurring pattern, often triggered by ${topTrigger}`
          : `${cap(type)} — a recurring pattern over the last few weeks`,
        reason: `Logged ${v.count}× in the last ${windowDays} days${topTrigger ? `, often around ${topTrigger}` : ""}.`,
      };
    });
}

/* ── B-ASKJB-26 — the plan as a track ──────────────────────────────────────
   One step a day through the action loop, and a weekly "Signs it's working?".
   Everything here is pure (callers pass `now` / today's day key). Values are
   counts and the parent's own answers — never a share, score or verdict. */

const DAY_MS = 86_400_000;

/** Status of a step, from either field (older plans only carry `completed`). */
export function planStepStatus(s: PlanStep): StepStatus {
  return s.status || (s.completed ? "done" : "todo");
}

/** The step a plan-sourced loop row is about. */
const sameStep = (row: Pick<ActionLoopEntry, "planId" | "phaseIdx" | "stepIdx">, ref: PlanStepRef): boolean =>
  row.planId === ref.planId && row.phaseIdx === ref.phaseIdx && row.stepIdx === ref.stepIdx;

/** The local day key a loop row belongs to (its id embeds it; acceptedAt otherwise). */
function rowDay(row: Pick<ActionLoopEntry, "id" | "acceptedAt">): string {
  return /(\d{4}-\d{2}-\d{2})/.exec(row.id)?.[1] ?? row.acceptedAt.slice(0, 10);
}

export interface TodaysPlanStep extends PlanStepRef {
  text: string;
  /** "Day {n}": the days the parent has practised this plan, today included. */
  day: number;
  /** The step after this one (plan order), when one is left. */
  next: (PlanStepRef & { text: string }) | null;
  /** True when this step's last outcome was "somewhat": offer the next step too. */
  offerNext: boolean;
}

/**
 * Today's step = the first step whose status is not done in the current phase
 * (the phase planProgress names). `not_today` changes nothing, so the same step
 * is tomorrow's; `helped` marked it done (the context writes that), so the next
 * one leads; `somewhat` keeps it and offers the next step beside it.
 */
export function todaysPlanStep(
  plan: ActionPlan,
  loop: readonly Pick<ActionLoopEntry, "id" | "acceptedAt" | "source" | "planId" | "phaseIdx" | "stepIdx" | "outcome" | "outcomeAt" | "status">[],
  todayKey: string,
): TodaysPlanStep | null {
  const phases = plan.phases ?? [];
  const flat: (PlanStepRef & { text: string; status: StepStatus })[] = [];
  phases.forEach((ph, phaseIdx) => (ph.steps ?? []).forEach((st, stepIdx) =>
    flat.push({ planId: plan.id, phaseIdx, stepIdx, text: st.text, status: planStepStatus(st) })));
  const { currentPhaseIndex } = planProgress(plan);
  const at = flat.findIndex((s) => s.phaseIdx === currentPhaseIndex && s.status !== "done");
  if (at === -1) return null;
  const cur = flat[at];
  const nextStep = flat.slice(at + 1).find((s) => s.status !== "done") ?? null;
  const rows = loop.filter((r) => r.source === "plan" && r.planId === plan.id && r.status !== "superseded");
  const pastDays = new Set(rows.map(rowDay).filter((d) => d !== todayKey));
  const lastForStep = rows
    .filter((r) => sameStep(r, cur) && r.outcome)
    .sort((a, b) => (b.outcomeAt ?? b.acceptedAt).localeCompare(a.outcomeAt ?? a.acceptedAt))[0];
  return {
    planId: cur.planId,
    phaseIdx: cur.phaseIdx,
    stepIdx: cur.stepIdx,
    text: cur.text,
    day: pastDays.size + 1,
    next: nextStep ? { planId: nextStep.planId, phaseIdx: nextStep.phaseIdx, stepIdx: nextStep.stepIdx, text: nextStep.text } : null,
    offerNext: lastForStep?.outcome === "somewhat" && nextStep !== null,
  };
}

/** What a plan step's outcome does to the step: helped → done, somewhat →
 *  in progress (kept), not_today → nothing (it is tomorrow's step). */
export function planStepStatusAfter(outcome: ActionOutcome): StepStatus | null {
  return outcome === "helped" ? "done" : outcome === "somewhat" ? "doing" : null;
}

/** When the plan started: the epoch-ms its id carries (plans are `plan-{ms}`). */
export function planStartedMs(plan: Pick<ActionPlan, "id">): number | null {
  const m = /(\d{10,})/.exec(plan.id);
  if (!m) return null;
  const ms = Number(m[1]);
  return Number.isFinite(ms) ? ms : null;
}

/** "Started {n} days ago" — days since creation, never "running". */
export function planStartedDays(plan: Pick<ActionPlan, "id">, now: number): number | null {
  const ms = planStartedMs(plan);
  return ms === null ? null : Math.max(0, Math.floor((now - ms) / DAY_MS));
}

/** The weekly check-in is due 7 days after creation, then 7 days after the last answer. */
export function weeklyCheckDue(plan: Pick<ActionPlan, "id" | "weeklyChecks">, now: number): boolean {
  const days = planStartedDays(plan, now);
  if (days === null || days < 7) return false;
  const last = plan.weeklyChecks?.[plan.weeklyChecks.length - 1];
  if (!last) return true;
  const lastMs = Date.parse(last.at);
  return Number.isNaN(lastMs) || now - lastMs >= 7 * DAY_MS;
}

/** "Not yet" twice in a row → offer "Adjust the plan in Ask". */
export function offerPlanAdjust(plan: Pick<ActionPlan, "weeklyChecks">): boolean {
  const c = plan.weeklyChecks ?? [];
  return c.length >= 2 && c.slice(-2).every((x) => x.answer === "not_yet");
}

export const PLAN_CHECK_ANSWERS: readonly PlanCheckAnswer[] = ["yes", "little", "not_yet"];

/** The plan's last ≤5 step outcomes (step text + outcome enum), newest first —
 *  the Adjust seed carries these and the title, never a logged moment's text. */
export function lastPlanOutcomes(
  planId: string,
  loop: readonly Pick<ActionLoopEntry, "recommendation" | "source" | "planId" | "outcome" | "outcomeAt">[],
  max = 5,
): { step: string; outcome: ActionOutcome }[] {
  return loop
    .filter((r) => r.source === "plan" && r.planId === planId && r.outcome)
    .sort((a, b) => (b.outcomeAt ?? "").localeCompare(a.outcomeAt ?? ""))
    .slice(0, max)
    .map((r) => ({ step: r.recommendation, outcome: r.outcome! }));
}
