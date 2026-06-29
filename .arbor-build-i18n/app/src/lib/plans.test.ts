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
