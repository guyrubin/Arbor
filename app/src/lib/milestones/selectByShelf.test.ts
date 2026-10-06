import { describe, expect, it } from "vitest";
import type { Milestone } from "../../types";
import { ALL_MILESTONES, bandForAgeMonths } from "../milestoneData";
import { milestoneShelf } from "../shelves/registry";
import { selectNextMilestonesByShelf, shelfCoverage, shelvesThinnestFirst } from "./selectByShelf";

/* B-LOOP-04 — "Notice today": thinnest shelf first, one open milestone per
   shelf, never ahead of band, never a shelf answered today. */

const NOW = new Date("2026-10-06T07:30:00");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const catalogue = (): Milestone[] => ALL_MILESTONES.map((m) => ({ ...m }));

/** The real catalogue holds no sleep row (CDC 2022 has none); a parent-added
 *  sleep row stands in so the thinnest-shelf rule can be shown on sleep. */
const sleepRow: Milestone = {
  id: "custom-sleep-1",
  custom: true,
  tags: ["sleep"],
  domain: "independence_adaptive_skills",
  ageMonths: 24,
  ageGroup: "Custom",
  title: "Falls asleep after the bedtime routine",
  description: "Custom milestone added by parent.",
  checked: false,
};

const obs = (shelf: string, n: number, ago = 3) =>
  Array.from({ length: n }, () => ({ at: daysAgo(ago), shelf: shelf as never }));

describe("shelfCoverage — entries per shelf over 30 days", () => {
  it("counts only dated, shelved observations inside the window", () => {
    const c = shelfCoverage([...obs("words", 12), ...obs("words", 4, 45), { at: "not a date", shelf: "words" as never }, { at: daysAgo(1) }], NOW);
    expect(c.words).toBe(12);
    expect(c.sleep).toBe(0);
    expect(Object.keys(c)).toHaveLength(9);
  });

  it("ties keep shelf display order", () => {
    expect(shelvesThinnestFirst({})).toEqual(["sleep", "food", "words", "feelings", "play", "moving", "hands", "school", "family"]);
  });
});

describe("selectNextMilestonesByShelf — a 26-month child", () => {
  const milestones = [...catalogue(), sleepRow];
  const coverage = shelfCoverage(obs("words", 12), NOW);

  it("12 observations in words and 0 in sleep: sleep comes first, words is not offered ahead of thinner shelves", () => {
    const picks = selectNextMilestonesByShelf(milestones, 26, { coverage, now: NOW });
    expect(picks).toHaveLength(3);
    expect(picks[0].shelf).toBe("sleep");
    expect(picks[0].milestone.id).toBe("custom-sleep-1");
    expect(picks.map((p) => p.shelf)).not.toContain("words");
  });

  it("never an item above the current band (24 months for 26)", () => {
    const picks = selectNextMilestonesByShelf(milestones, 26, { coverage, now: NOW, perShelf: 5, total: 50 });
    expect(picks.length).toBeGreaterThan(3);
    for (const p of picks) {
      expect(typeof p.milestone.ageMonths).toBe("number");
      expect(bandForAgeMonths(p.milestone.ageMonths as number).months).toBeLessThanOrEqual(24);
    }
  });

  it("perShelf is respected and every pick sits on the shelf the registry resolves", () => {
    const picks = selectNextMilestonesByShelf(milestones, 26, { coverage, now: NOW, perShelf: 2, total: 50 });
    const per = new Map<string, number>();
    for (const p of picks) {
      per.set(p.shelf, (per.get(p.shelf) ?? 0) + 1);
      expect(milestoneShelf(p.milestone)).toBe(p.shelf);
    }
    for (const n of per.values()) expect(n).toBeLessThanOrEqual(2);
    expect(selectNextMilestonesByShelf(milestones, 26, { coverage, now: NOW, total: 2 })).toHaveLength(2);
  });

  it("a shelf answered today (any answer) is skipped until tomorrow", () => {
    const answered = milestones.map((m) => (m.id === "custom-sleep-1" ? { ...m, observationStatus: "not_yet" as const, observationUpdatedAt: NOW.toISOString() } : m));
    const today = selectNextMilestonesByShelf(answered, 26, { coverage, now: NOW, total: 50 });
    expect(today.map((p) => p.shelf)).not.toContain("sleep");
    const tomorrow = selectNextMilestonesByShelf(answered, 26, { coverage, now: new Date(NOW.getTime() + 86_400_000), total: 50 });
    expect(tomorrow[0].shelf).toBe("sleep");
  });

  it("excludeShelves leaves out the shelf the caller already fills", () => {
    const picks = selectNextMilestonesByShelf(milestones, 26, { coverage, now: NOW, excludeShelves: ["sleep"] });
    expect(picks.map((p) => p.shelf)).not.toContain("sleep");
  });

  it("a seen milestone is never offered again", () => {
    const seen = milestones.map((m) => (m.id === "custom-sleep-1" ? { ...m, checked: true, observationStatus: "yes" as const, observationUpdatedAt: daysAgo(2) } : m));
    const picks = selectNextMilestonesByShelf(seen, 26, { coverage, now: NOW, total: 50 });
    expect(picks.map((p) => p.milestone.id)).not.toContain("custom-sleep-1");
  });
});
