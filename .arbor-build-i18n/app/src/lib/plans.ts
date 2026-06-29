import type { ActionPlan, BehaviorLog } from "../types";

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
