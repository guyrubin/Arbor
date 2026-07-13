import { describe, it, expect } from "vitest";
import { buildCoverage, coverageGaps, coverageSummary, activityStages, PLAY_DOMAINS } from "./coverage";
import { STAGES } from "./stages";
import { PLAY_ACTIVITIES, PLAY_ACTIVITIES_HE, PLAY_BANDS } from "./content";
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

  it("the play bank has been expanded past the reviewed seed toward the F11 floor (>=250)", () => {
    // Content-expansion wave: the original reviewed seed (40–60) was grown with
    // research-backed, bilingual activities across all 5 domains × 4 bands toward
    // the capability floor (F11 >= 250). Lower bound is a sanity floor.
    expect(PLAY_ACTIVITIES.length).toBeGreaterThanOrEqual(200);
  });

  it("every populated band×domain cell holds at least 2 activities (engine can't regress below playable)", () => {
    const counts = new Map<string, number>();
    for (const a of PLAY_ACTIVITIES) {
      for (const band of a.bands) counts.set(`${band}|${a.domain}`, (counts.get(`${band}|${a.domain}`) ?? 0) + 1);
    }
    const thin: string[] = [];
    for (const { band } of PLAY_BANDS) {
      for (const domain of PLAY_DOMAINS) {
        const n = counts.get(`${band}|${domain}`) ?? 0;
        if (n === 1) thin.push(`${band}×${domain}`); // populated (≥1) but below the floor of 2
      }
    }
    expect(thin).toEqual([]);
  });

  it("every activity has a matching Hebrew translation (parity)", () => {
    const missing = PLAY_ACTIVITIES.filter((a) => !PLAY_ACTIVITIES_HE[a.id]).map((a) => a.id);
    expect(missing).toEqual([]);
  });

  it("early-infant (0–12 month) coverage is now populated (gap closed by the content-expansion wave)", () => {
    const cells = buildCoverage(); // real PLAY_ACTIVITIES
    const infantCells = cells.filter((c) => ["0-3m", "3-6m", "6-9m", "9-12m"].includes(c.stage));
    const infantFilled = infantCells.filter((c) => c.count > 0).length;
    // The early-infant gap that drove the backlog has been filled with infant-band
    // activities across the domains — most early-infant cells now carry content.
    expect(infantFilled).toBeGreaterThan(infantCells.length / 2);
  });
});
