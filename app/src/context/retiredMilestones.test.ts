import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Milestone } from "../types";
import { ALL_MILESTONES, RETIRED_MILESTONE_IDS, ageWindowMilestones } from "../lib/milestoneData";
import { hydrateMilestones, isRetiredMilestone } from "./milestoneHydration";

/**
 * B-LOOP-01 (follow-up) — a child created before 6 Oct still carries the
 * retired Arbor rows m-1…m-10 in Firestore. They are filtered out where the
 * stored rows are read into state (ArborContext → hydrateMilestones), never
 * on write and never deleted; every count reads the filtered list.
 */

const retired = (id: string, ageMonths: number, checked = false): Milestone =>
  ({ id, domain: "social_development", ageMonths, ageGroup: "4-5 years", title: "Legacy English row", description: "x", checked } as Milestone);

const cdc48 = ALL_MILESTONES.filter((m) => m.ageMonths === 48);
const cdc60 = ALL_MILESTONES.filter((m) => m.ageMonths === 60);

describe("B-LOOP-01 follow-up — retired milestone ids are filtered on read", () => {
  it("a stored record carrying m-3 yields a list without it; a non-retired id survives", () => {
    const stored = [...cdc48, retired("m-3", 54, true), ...cdc60];
    const list = hydrateMilestones(stored, ALL_MILESTONES);
    expect(list.map((m) => m.id)).not.toContain("m-3");
    expect(list.map((m) => m.id)).toEqual(ALL_MILESTONES.filter((m) => m.ageMonths === 48 || m.ageMonths === 60).map((m) => m.id));
    expect(list.find((m) => m.id === cdc48[0].id)).toBe(cdc48[0]);
  });

  it("counts exclude it: the windowed total and the checked count never include a retired row", () => {
    const stored = [...cdc48, retired("m-3", 54, true), retired("m-7", 60, true), ...cdc60];
    const list = hydrateMilestones(stored, ALL_MILESTONES);
    for (const months of [48, 54, 60, 66]) {
      const windowed = ageWindowMilestones(list, months);
      expect(windowed.some((m) => RETIRED_MILESTONE_IDS.includes(m.id)), String(months)).toBe(false);
      expect(windowed.filter((m) => m.checked).length, String(months)).toBe(0);
    }
  });

  it("every retired id is dropped; a parent-added row is never dropped, whatever its id", () => {
    const stored = [...RETIRED_MILESTONE_IDS.map((id) => retired(id, 60)), { ...retired("m-4", 60), custom: true }];
    const list = hydrateMilestones(stored, ALL_MILESTONES);
    expect(list).toHaveLength(1);
    expect(list[0].custom).toBe(true);
    expect(isRetiredMilestone({ id: "m-4" })).toBe(true);
    expect(isRetiredMilestone({ id: "m-4", custom: true })).toBe(false);
  });

  it("a child with no stored rows gets the catalogue seed, in catalogue order", () => {
    expect(hydrateMilestones([], ALL_MILESTONES).map((m) => m.id)).toEqual(ALL_MILESTONES.map((m) => m.id));
  });

  it("filter on read, never on write: hydrateMilestones never mutates the stored list", () => {
    const stored = [retired("m-1", 54), ...cdc48];
    const copy = [...stored];
    hydrateMilestones(stored, ALL_MILESTONES);
    expect(stored).toEqual(copy);
  });

  it("ArborContext reads the child's milestones through hydrateMilestones (the one seam)", () => {
    const src = readFileSync(path.resolve(__dirname, "ArborContext.tsx"), "utf8");
    expect(src).toMatch(/hydrateMilestones\(milestonesCol\.items, initialMilestones\)/);
    expect(src).not.toMatch(/milestonesCol\.remove\([^)]*RETIRED/);
  });
});
