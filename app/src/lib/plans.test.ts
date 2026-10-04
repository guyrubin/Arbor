import { describe, expect, it } from "vitest";
import type { ActionPlan, BehaviorLog } from "../types";
import { planProgress, suggestedChallenges } from "./plans";

const step = (text: string, done: boolean) => ({ text, completed: done, status: done ? ("done" as const) : ("todo" as const) });

const plan = (phases: ActionPlan["phases"]): ActionPlan => ({
  id: "p1", title: "Test", issue: "i", phases, scripts: [], successIndicators: [],
});

describe("planProgress", () => {
  it("computes progress and the next steps in the current phase", () => {
    const p = plan([
      { name: "Phase 1", description: "", steps: [step("a", true), step("b", true)] },
      { name: "Phase 2", description: "", steps: [step("c", false), step("d", false), step("e", false), step("f", false)] },
    ]);
    const pr = planProgress(p, 3);
    expect(pr.totalSteps).toBe(6);
    expect(pr.doneSteps).toBe(2);
    expect(pr.pct).toBe(33);
    expect(pr.phasesDone).toBe(1);
    expect(pr.currentPhaseIndex).toBe(1);
    expect(pr.currentPhaseName).toBe("Phase 2");
    expect(pr.nextSteps).toEqual(["c", "d", "e"]); // capped at take=3
    expect(pr.planComplete).toBe(false);
  });

  it("flags a fully complete plan", () => {
    const p = plan([{ name: "Only", description: "", steps: [step("a", true)] }]);
    const pr = planProgress(p);
    expect(pr.planComplete).toBe(true);
    expect(pr.pct).toBe(100);
    expect(pr.nextSteps).toEqual([]);
  });

  it("honors the legacy `completed` flag when status is absent", () => {
    const p = plan([{ name: "P", description: "", steps: [{ text: "a", completed: true }, { text: "b", completed: false }] }]);
    const pr = planProgress(p);
    expect(pr.doneSteps).toBe(1);
    expect(pr.nextSteps).toEqual(["b"]);
  });
});

describe("suggestedChallenges", () => {
  const today = "2026-06-17";
  const log = (behaviorType: string, daysBack: number, trigger = "", resolved = false): BehaviorLog => ({
    id: `${behaviorType}-${daysBack}-${Math.random()}`,
    timestamp: new Date(new Date(`${today}T12:00:00`).getTime() - daysBack * 86400000).toISOString(),
    behaviorType,
    intensity: 3,
    durationMinutes: 5,
    trigger,
    response: "",
    resolved,
  });

  it("surfaces the most frequent recent unresolved behavior with its top trigger", () => {
    const logs = [
      log("tantrum", 1, "transitions"),
      log("tantrum", 3, "transitions"),
      log("tantrum", 5, "tiredness"),
      log("hitting", 2, "sharing"),
      log("hitting", 4, "sharing"),
    ];
    const sugg = suggestedChallenges(logs, today, 2);
    expect(sugg).toHaveLength(2);
    expect(sugg[0].topic.toLowerCase()).toContain("tantrum");
    expect(sugg[0].topic).toContain("transitions"); // most common trigger
    expect(sugg[0].reason).toContain("3×");
  });

  it("never turns plain Moment rows into a challenge (Wave T, TJB-01)", () => {
    const logs = [
      log("Moment", 1, "bath"),
      log("Moment", 2, "bath"),
      log("Moment", 3, "bath"),
    ];
    expect(suggestedChallenges(logs, today, 2)).toHaveLength(0);
    // Negative control: the same three rows as an incident type DO surface.
    const incidents = logs.map((l) => ({ ...l, behaviorType: "tantrum" }));
    expect(suggestedChallenges(incidents, today, 2)).toHaveLength(1);
  });

  it("ignores one-offs, resolved logs, and stale logs", () => {
    const logs = [
      log("biting", 1),                 // single occurrence → below threshold
      log("whining", 2, "", true),      // resolved
      log("whining", 3, "", true),      // resolved
      log("clinging", 40),              // outside the 21-day window
      log("clinging", 45),
    ];
    expect(suggestedChallenges(logs, today)).toEqual([]);
  });
});

/* ── B-ASKJB-26 — the plan as a track ────────────────────────────────────── */
import {
  lastPlanOutcomes,
  offerPlanAdjust,
  planStartedDays,
  planStepStatusAfter,
  todaysPlanStep,
  weeklyCheckDue,
} from "./plans";
import type { ActionLoopEntry } from "../actionLoop/model";

describe("B-ASKJB-26 — today's step selection", () => {
  const st = (text: string, status: "todo" | "doing" | "done") => ({ text, completed: status === "done", status });
  const p = (phases: ActionPlan["phases"], extra: Partial<ActionPlan> = {}): ActionPlan =>
    ({ id: "plan-1759000000000", title: "Calmer exits", issue: "i", phases, scripts: [], successIndicators: [], ...extra });
  const row = (over: Partial<ActionLoopEntry> & { id: string }): ActionLoopEntry => ({
    recommendation: "x", source: "plan", capacity: "standard", status: "completed", acceptedAt: "2026-10-01T08:00:00.000Z",
    planId: "plan-1759000000000", phaseIdx: 0, stepIdx: 0, ...over,
  });

  it("is the first not-done step of the current phase (in progress counts as not done)", () => {
    const plan = p([
      { name: "W1", description: "", steps: [st("a", "done"), st("b", "doing"), st("c", "todo")] },
      { name: "W2", description: "", steps: [st("d", "todo")] },
    ]);
    const s = todaysPlanStep(plan, [], "2026-10-04")!;
    expect(s).toMatchObject({ phaseIdx: 0, stepIdx: 1, text: "b", day: 1, offerNext: false });
    expect(s.next?.text).toBe("c");
  });

  it("moves to the next phase once the current phase is done", () => {
    const plan = p([
      { name: "W1", description: "", steps: [st("a", "done")] },
      { name: "W2", description: "", steps: [st("d", "todo")] },
    ]);
    expect(todaysPlanStep(plan, [], "2026-10-04")).toMatchObject({ phaseIdx: 1, stepIdx: 0, text: "d", next: null });
  });

  it("a complete plan has no step today", () => {
    expect(todaysPlanStep(p([{ name: "W1", description: "", steps: [st("a", "done")] }]), [], "2026-10-04")).toBeNull();
  });

  it("not_today keeps the step as tomorrow's; somewhat keeps it AND offers the next", () => {
    const plan = p([{ name: "W1", description: "", steps: [st("a", "todo"), st("b", "todo")] }]);
    const notToday = [row({ id: "today.c.2026-10-03", outcome: "not_today", outcomeAt: "2026-10-03T20:00:00.000Z" })];
    expect(todaysPlanStep(plan, notToday, "2026-10-04")).toMatchObject({ text: "a", offerNext: false, day: 2 });
    const somewhat = [row({ id: "today.c.2026-10-03", outcome: "somewhat", outcomeAt: "2026-10-03T20:00:00.000Z" })];
    expect(todaysPlanStep(plan, somewhat, "2026-10-04")).toMatchObject({ text: "a", offerNext: true });
  });

  it("Day n counts the distinct days a step of THIS plan entered the loop (today included once)", () => {
    const plan = p([{ name: "W1", description: "", steps: [st("a", "todo")] }]);
    const loop = [
      row({ id: "today.c.2026-10-01" }),
      row({ id: "today.c.2026-10-02" }),
      row({ id: "today.c.2026-10-02.2" }),
      row({ id: "today.c.2026-10-04", status: "accepted" }),
      row({ id: "today.c.2026-09-30", planId: "other-plan" }),
      row({ id: "today.c.2026-09-29", source: "coach" }),
      row({ id: "today.c.2026-09-28", status: "superseded" }),
    ];
    expect(todaysPlanStep(plan, loop, "2026-10-04")!.day).toBe(3);
  });

  it("outcomes: helped → done, somewhat → in progress, not_today → unchanged", () => {
    expect(planStepStatusAfter("helped")).toBe("done");
    expect(planStepStatusAfter("somewhat")).toBe("doing");
    expect(planStepStatusAfter("not_today")).toBeNull();
  });
});

describe("B-ASKJB-26 — started days, weekly check-in, adjust", () => {
  const created = 1759000000000;
  const plan = (weeklyChecks?: ActionPlan["weeklyChecks"]) => ({ id: `plan-${created}`, weeklyChecks });
  const day = (n: number) => created + n * 86_400_000;

  it("'Started {n} days ago' counts days since creation", () => {
    expect(planStartedDays(plan(), day(0))).toBe(0);
    expect(planStartedDays(plan(), day(9) + 3600_000)).toBe(9);
    expect(planStartedDays({ id: "no-timestamp" }, day(9))).toBeNull();
  });

  it("the check-in is due on day 7, then 7 days after the last answer", () => {
    expect(weeklyCheckDue(plan(), day(6))).toBe(false);
    expect(weeklyCheckDue(plan(), day(7))).toBe(true);
    const answered = plan([{ at: new Date(day(7)).toISOString(), answer: "little" }]);
    expect(weeklyCheckDue(answered, day(8))).toBe(false);
    expect(weeklyCheckDue(answered, day(14))).toBe(true);
  });

  it("'Not yet' twice in a row offers the adjust door; anything else does not", () => {
    const at = new Date(day(7)).toISOString();
    expect(offerPlanAdjust(plan([{ at, answer: "not_yet" }]))).toBe(false);
    expect(offerPlanAdjust(plan([{ at, answer: "not_yet" }, { at, answer: "not_yet" }]))).toBe(true);
    expect(offerPlanAdjust(plan([{ at, answer: "not_yet" }, { at, answer: "little" }]))).toBe(false);
  });

  it("the adjust seed's outcomes are plan step text + outcome enum, newest first, ≤5", () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      recommendation: `step ${i}`, source: "plan" as const, planId: "p", outcome: "not_today" as const, outcomeAt: `2026-10-0${i + 1}T08:00:00.000Z`,
    }));
    const out = lastPlanOutcomes("p", [...rows, { recommendation: "coach", source: "coach" as const, planId: "p", outcome: "helped" as const, outcomeAt: "2026-10-09T08:00:00.000Z" }]);
    expect(out).toHaveLength(5);
    expect(out[0]).toEqual({ step: "step 6", outcome: "not_today" });
  });
});
