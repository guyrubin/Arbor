import { describe, it, expect } from "vitest";
import { STAGES, ageToStage, stageToBand, bandStages, adjacentStages, stageLabel } from "./stages";

describe("micro-stage taxonomy", () => {
  it("covers 0–144 months with no gaps or overlaps", () => {
    const sorted = [...STAGES].sort((a, b) => a.minMonths - b.minMonths);
    expect(sorted[0].minMonths).toBe(0);
    expect(sorted[sorted.length - 1].maxMonths).toBe(144);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].minMonths).toBe(sorted[i - 1].maxMonths); // contiguous
    }
  });

  it("maps fractional ages to the right window (the 1.5yo fix)", () => {
    expect(ageToStage(1.5)).toBe("18-24m");   // 18 months
    expect(ageToStage(2)).toBe("2-3y");        // 24 months
    expect(ageToStage(2.5)).toBe("2-3y");
    expect(ageToStage(0.1)).toBe("0-3m");      // ~1 month
    expect(ageToStage(0.25)).toBe("3-6m");     // 3 months → lower bound is exclusive
    expect(ageToStage(1)).toBe("12-18m");      // 12 months
  });

  it("clamps ages above 12 to the last stage", () => {
    expect(ageToStage(15)).toBe("9-12y");
  });

  it("every stage maps back to a coarse band", () => {
    for (const s of STAGES) expect(stageToBand(s.stage)).toBe(s.band);
  });

  it("bandStages fans a band out to its micro-stages", () => {
    expect(bandStages("toddler")).toEqual(["12-18m", "18-24m", "2-3y"]);
    expect(bandStages("infant")).toEqual(["0-3m", "3-6m", "6-9m", "9-12m"]);
  });

  it("adjacentStages returns neighbours for thin-stage fallback", () => {
    expect(adjacentStages("18-24m")).toEqual(["12-18m", "2-3y"]);
    expect(adjacentStages("0-3m")).toEqual(["3-6m"]); // no left neighbour
  });

  it("exposes human labels", () => {
    expect(stageLabel("18-24m")).toBe("18–24 months");
  });
});
