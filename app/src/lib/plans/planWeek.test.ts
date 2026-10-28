/**
 * B-BOOK-78 — the plan in the parent's week: the active plan and its day,
 * the night confirmation as a COUNT (idempotent per day, undoable), keep /
 * close after the duration, the shelf a pattern's door sits on, the journal
 * words only on an explicit tap; and Tonight: an active plan sits first.
 */
import { describe, expect, it } from "vitest";
import { activePlans, closePlan, keepPlan, leadPlan, nightMomentText, nightRecorded, nightsCount, patternsOnShelf, planShelf, recordNight, runningPatternIds, unrecordNight } from "./planWeek";
import { authoredPatterns } from "../library/plans/planBooks";
import type { PlanBookDoc } from "../library/plans/planBookDoc";
import { libraryBookEntries } from "../bookAssets";
import { PLAN_POSES, PLAN_SHEET_BOOK_ID } from "../library/plans/planPoses";
import type { BookAssetsDoc } from "../library/bookAssetPaths";

const doc = (over: Partial<PlanBookDoc> = {}): PlanBookDoc => ({
  id: "plan-poo-sit.c1", bookId: "plan-poo-sit.c1", kind: "plan", pattern: "plan-poo-sit", lang: "en",
  stepMenuIds: ["sit-after-meal", "the-box", "just-try"], minutes: 5, time: "evening", boxItemIds: ["book"], durationDays: 21,
  approvedAt: "2026-10-20T18:00:00.000Z", approvedBy: "p", createdAt: "t", updatedAt: "t", status: "active", ...over,
});
const now = new Date(2026, 9, 27, 20, 0, 0); // local 27 Oct 2026, 20:00

describe("the active plan", () => {
  it("counts the day from the approval day, the days left, and the review once the duration ran out", () => {
    const [p] = activePlans([doc()], now);
    expect(p.day).toBe(8);
    expect(p.daysLeft).toBe(14);
    expect(p.review).toBe(false);
    const old = activePlans([doc({ approvedAt: "2026-09-20T18:00:00.000Z" })], now)[0];
    expect(old.daysLeft).toBe(0);
    expect(old.review).toBe(true);
    expect(leadPlan([doc({ status: "closed" }), { junk: 1 }], now)).toBeNull();
    expect(runningPatternIds([doc()], now)).toEqual(["plan-poo-sit"]);
  });

  it("the newest approval leads", () => {
    const rows = [doc(), doc({ id: "plan-dropoff.c1", bookId: "plan-dropoff.c1", pattern: "plan-dropoff", stepMenuIds: ["goodbye-ritual", "thing-from-home", "door-opens-again"], approvedAt: "2026-10-25T18:00:00.000Z" })];
    expect(leadPlan(rows, now)?.def.id).toBe("plan-dropoff");
  });

  it("tonight's confirmation is a count: once per day, undoable, never a rate", () => {
    const d0 = doc();
    expect(nightsCount(d0)).toBe(0);
    expect(nightRecorded(d0, now)).toBe(false);
    const d1 = recordNight(d0, now);
    expect(d1.nights).toEqual(["2026-10-27"]);
    expect(nightRecorded(d1, now)).toBe(true);
    expect(recordNight(d1, now).nights).toEqual(["2026-10-27"]);
    expect(nightsCount(recordNight(d1, new Date(2026, 9, 28, 20)))).toBe(2);
    expect(unrecordNight(d1, now).nights).toEqual([]);
    expect(JSON.stringify(d1)).not.toMatch(/rate|streak|score|%/);
  });

  it("keep extends within bounds; close leaves Tonight and Today but keeps the row", () => {
    expect(keepPlan(doc(), now).durationDays).toBe(35);
    expect(keepPlan(doc(), now, 90).durationDays).toBe(49);
    const closed = closePlan(doc(), now);
    expect(closed.status).toBe("closed");
    expect(closed.closedAt).toBe(now.toISOString());
    expect(activePlans([closed], now)).toEqual([]);
  });

  it("the door's shelf: a real shelf, or null for the body domain (Guy's to place)", () => {
    const defs = authoredPatterns();
    expect(planShelf(defs.find((d) => d.id === "plan-poo-sit")!)).toBeNull();
    expect(planShelf(defs.find((d) => d.id === "plan-toilet-start")!)).toBeNull();
    expect(patternsOnShelf(defs, "sleep").map((d) => d.id).sort()).toEqual(["plan-sleep-alone", "plan-stay-in-bed"]);
    expect(patternsOnShelf(defs, "feelings").map((d) => d.id).sort()).toEqual(["plan-big-feelings", "plan-dropoff"]);
    expect(patternsOnShelf(defs, "food").map((d) => d.id)).toEqual(["plan-new-food"]);
    expect(patternsOnShelf(defs, "family").map((d) => d.id)).toEqual(["plan-screen-end"]);
  });

  it("the journal words are the pattern's, no count, no verdict, in the parent's language", () => {
    const def = authoredPatterns()[0];
    expect(nightMomentText(def, "en", "Noa")).toBe("Tonight we did Noa's plan: The toilet champion.");
    expect(nightMomentText(def, "he", "נועה")).toContain("נועה");
    expect(nightMomentText(def, "he", "נועה")).not.toMatch(/\d/);
  });

  it("Tonight: an active plan inside its duration sits first; past its duration it follows the canonical books", () => {
    const sheet: BookAssetsDoc = { id: PLAN_SHEET_BOOK_ID, bookId: PLAN_SHEET_BOOK_ID, sheetId: "h-0123456789abcdef", setId: "none", sheetManifest: { poses: Object.fromEntries(PLAN_POSES.map((p) => [p, { file: `${p}.webp` }])) }, files: PLAN_POSES.map((p) => `hero-sheets/h-0123456789abcdef/${p}.webp`), bytes: 1, createdAt: "t" };
    expect(libraryBookEntries([sheet], [doc()], now).map((e) => e.book.id)).toEqual(["plan-poo-sit.c1"]);
    expect(libraryBookEntries([sheet], [doc({ approvedAt: "2026-09-01T18:00:00.000Z" })], now).map((e) => e.book.id)).toEqual(["plan-poo-sit.c1"]);
  });
});
