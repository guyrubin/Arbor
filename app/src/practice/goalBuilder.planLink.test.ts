import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { focusGoal, focusNextStep, goalTileById, withFocusGoal, type ActiveGoal } from "./goalBuilder";
import type { ActionPlan } from "../types";

/* B-GROWTH-40 (residue after 1b55e180) — a plan started while a goal is
   current stores focusGoalId; My child's focus line reads "Next: {step}" from
   that plan. No backfill: a plan stored before the link never gains one. */

const goal = (goalId: string, addedAt: string): ActiveGoal => {
  const tile = goalTileById(goalId)!;
  return { goalId, label: tile.label, domainId: tile.domainId, addedAt };
};
const talking = goal("early-talking", "2026-10-01T00:00:00Z");
const turns = goal("taking-turns", "2026-10-05T00:00:00Z");
const step = (text: string, completed = false, status?: "todo" | "doing" | "done") => ({ text, completed, ...(status ? { status } : {}) });
const plan = (id: string, steps: ReturnType<typeof step>[][], focusGoalId?: string): ActionPlan => ({
  id, title: id, issue: "", scripts: [], successIndicators: [],
  phases: steps.map((s, i) => ({ name: `Phase ${i + 1}`, description: "", steps: s })),
  ...(focusGoalId ? { focusGoalId } : {}),
});

describe("withFocusGoal — stamped at start, never backfilled", () => {
  it("records the CURRENT goal (focusGoal: the newest) on a plan started now", () => {
    const started = withFocusGoal(plan("plan-1", [[step("Name one feeling")]]), [talking, turns]);
    expect(started.focusGoalId).toBe(focusGoal([talking, turns])!.goalId);
    expect(started.focusGoalId).toBe("taking-turns");
  });
  it("no goal → the plan is returned unchanged (same object, no field)", () => {
    const p = plan("plan-2", [[step("a")]]);
    expect(withFocusGoal(p, [])).toBe(p);
    expect(withFocusGoal(p)).toBe(p);
    expect("focusGoalId" in withFocusGoal(p, [])).toBe(false);
  });
  it("an existing link is never rewritten", () => {
    const p = plan("plan-3", [[step("a")]], "early-talking");
    expect(withFocusGoal(p, [turns])).toBe(p);
  });
});

describe("focusNextStep — the next unfinished step of the newest linked plan", () => {
  const linkedOld = plan("plan-100", [[step("Old step")]], "taking-turns");
  const linkedNew = plan("plan-200", [[step("Wait five seconds", true), step("Take turns with a ball")], [step("Later phase")]], "taking-turns");
  const unlinked = plan("plan-300", [[step("Unlinked step")]]);
  const otherGoal = plan("plan-400", [[step("Other goal step")]], "early-talking");
  const newestFirst = [otherGoal, unlinked, linkedNew, linkedOld];

  it("reads the newest plan linked to the current goal, skipping done steps", () => {
    expect(focusNextStep(turns, newestFirst)).toBe("Take turns with a ball");
  });
  it("a status-driven done step counts as done", () => {
    const p = plan("plan-500", [[step("Doing it", false, "done"), step("Then this")]], "taking-turns");
    expect(focusNextStep(turns, [p])).toBe("Then this");
  });
  it("a finished linked plan gives way to an older unfinished one; all finished → null", () => {
    const finished = plan("plan-600", [[step("x", true), step("y", true)]], "taking-turns");
    expect(focusNextStep(turns, [finished, linkedOld])).toBe("Old step");
    expect(focusNextStep(turns, [finished])).toBeNull();
  });
  it("no backfill: unlinked and other-goal plans never speak for this goal", () => {
    expect(focusNextStep(turns, [otherGoal, unlinked])).toBeNull();
    expect(focusNextStep(talking, newestFirst)).toBe("Other goal step");
    expect(focusNextStep(null, newestFirst)).toBeNull();
  });
});

describe("the three plan-start paths stamp the link (ArborContext)", () => {
  const src = readFileSync(path.resolve(__dirname, "../context/ArborContext.tsx"), "utf8");
  it("generated, template and routine plans go through withFocusGoal on the one profile accessor", () => {
    // The generated plan is stamped in place, so the N1-01 latch pin (kpiEvents.test) still reads the same write.
    const stamp = src.indexOf("Object.assign(planData, withFocusGoal(planData, childProfile.activeGoals));");
    expect(stamp).toBeGreaterThan(-1);
    expect(src.indexOf("await plansCol.upsert(planData);")).toBeGreaterThan(stamp);
    expect(src).toContain("const startPlanFromTemplate = (plan: ActionPlan) => plansCol.upsert(withFocusGoal(plan, childProfile.activeGoals));");
    expect(src).toContain("const startRoutinePlan = (plan: ActionPlan) => plansCol.upsert(withFocusGoal(plan, childProfile.activeGoals), { awaitServer: true });");
    // Edits of an existing plan (steps, checks, runs) never re-link it.
    expect(src.match(/withFocusGoal\(/g)).toHaveLength(3);
  });
});
