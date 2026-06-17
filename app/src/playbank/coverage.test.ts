import { describe, it, expect } from "vitest";
import { buildCoverage, coverageGaps, coverageSummary, activityStages, PLAY_DOMAINS } from "./coverage";
import { STAGES } from "./stages";
import type { PlayActivity } from "./content";

const mk = (over: Partial<PlayActivity>): PlayActivity => ({
  id: "x", title: "x", bands: ["toddler"], domain: "regulation",
  skillTags: [], householdItems: [], whatItBuilds: "", steps: [], durationMin: 5, ...over,
});

describe("content coverage", () => {
  it("activityStages prefers explicit stages, else fans out the bands", () => {
    expect(activityStages(mk({ stages: ["18-24m"] }))).toEqual(["18-24m"]);
    expect(activityStages(mk({ bands: ["toddler"] }))).toEqual(["12-18m", "18-24m", "2-3y"]);
  });

  it("builds a full zero-filled stage x domain grid", () => {
    const cells = buildCoverage([]);
    expect(cells.length).toBe(STAGES.length * PLAY_DOMAINS.length);
    expect(cells.every((c) => c.count === 0)).toBe(true);
  });

  it("counts an activity into each of its stage x domain cells", () => {
    const cells = buildCoverage([mk({ stages: ["18-24m"], domain: "language" })]);
    const hit = cells.find((c) => c.stage === "18-24m" && c.domain === "language");
    expect(hit?.count).toBe(1);
    expect(cells.filter((c) => c.count > 0).length).toBe(1);
  });

  it("coverageGaps lists empty cells (the authoring backlog)", () => {
    const gaps = coverageGaps([mk({ stages: ["2-3y"], domain: "regulation" })]);
    expect(gaps.every((c) => c.count === 0)).toBe(true);
    expect(gaps.find((c) => c.stage === "2-3y" && c.domain === "regulation")).toBeUndefined();
  });

  it("summary reports fill rate and thinnest stages", () => {
    const s = coverageSummary([mk({ stages: ["2-3y"], domain: "social" })]);
    expect(s.filledCells).toBe(1);
    expect(s.emptyCells).toBe(s.totalCells - 1);
    expect(s.thinnestStages.length).toBe(5);
    expect(s.thinnestStages[0].domainsCovered).toBe(0); // a fully-empty stage is thinnest
  });

  it("the real bank leaves the 0–12 month stages largely empty (the known gap)", () => {
    const cells = buildCoverage(); // real PLAY_ACTIVITIES
    const infantCells = cells.filter((c) => ["0-3m", "3-6m", "6-9m", "9-12m"].includes(c.stage));
    const infantFilled = infantCells.filter((c) => c.count > 0).length;
    // Sanity: the map exposes that early-infant coverage is thin (drives the backlog).
    expect(infantFilled).toBeLessThan(infantCells.length);
  });
});
