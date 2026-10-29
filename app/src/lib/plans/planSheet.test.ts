/**
 * B-BOOK-75 follow-up — the shared plan sheet's poses: the union of the plan
 * poses every ACTIVE approved plan shows, in the shared order, at most twelve;
 * a closed plan, a malformed row or a row that no longer composes adds nothing.
 */
import { describe, expect, it } from "vitest";
import { planSheetPoses } from "./planSheet";
import { PLAN_POSES } from "../library/plans/planPoses";
import { bookPoseIds } from "../library/bookPoses";
import { planBookFromDoc, type PlanBookDoc } from "../library/plans/planBookDoc";

const doc = (pattern: string, steps: [string, string, string], extra: Partial<PlanBookDoc> = {}): PlanBookDoc => ({
  id: `${pattern}.c1`, bookId: `${pattern}.c1`, kind: "plan", pattern: pattern as PlanBookDoc["pattern"], lang: "en",
  stepMenuIds: steps, minutes: 5, time: "evening", boxItemIds: [], durationDays: 14,
  approvedAt: "2026-10-20T18:00:00.000Z", approvedBy: "p", createdAt: "2026-10-20T18:00:00.000Z", updatedAt: "2026-10-20T18:00:00.000Z", status: "active", ...extra,
});
const poo = doc("plan-poo-sit", ["sit-after-meal", "the-box", "just-try"]);
const sleep = doc("plan-sleep-alone", ["four-steps", "sit-further", "morning-check-in"]);

describe("the shared plan sheet's poses", () => {
  it("is the union of the active plans' plan poses, in the shared order, every one a shared plan pose", () => {
    const one = planSheetPoses([poo]);
    expect(one.length).toBeGreaterThan(0);
    expect(one).toEqual(bookPoseIds(planBookFromDoc(poo)!).filter((p) => (PLAN_POSES as readonly string[]).includes(p)).sort((a, b) => PLAN_POSES.indexOf(a as never) - PLAN_POSES.indexOf(b as never)));
    const both = planSheetPoses([poo, sleep]);
    expect(new Set(both).size).toBe(both.length);
    expect(both.length).toBeGreaterThanOrEqual(one.length);
    expect(both.length).toBeLessThanOrEqual(PLAN_POSES.length);
    for (const p of both) expect(PLAN_POSES).toContain(p);
  });

  it("a closed plan, junk and a row that no longer composes add nothing", () => {
    expect(planSheetPoses([{ ...poo, status: "closed" }, { junk: true }, doc("plan-poo-sit", ["nope", "the-box", "just-try"])])).toEqual([]);
    expect(planSheetPoses([])).toEqual([]);
  });
});
