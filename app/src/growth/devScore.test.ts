import { describe, it, expect } from "vitest";
import { computeDevScore, type ScoreMilestone } from "./devScore";

const ms = (domain: string, checked: boolean): ScoreMilestone => ({ domain, checked });

describe("computeDevScore", () => {
  it("counts each domain's noticed and total milestones (B-GROWTH-06: counts only)", () => {
    const s = computeDevScore([
      ms("Motor", true), ms("Motor", true), ms("Motor", false), ms("Motor", false),
      ms("Language", true), ms("Language", true), ms("Language", true),
    ]);
    expect(s.domains).toEqual([
      { domain: "Language", reached: 3, total: 3, confidence: "medium" },
      { domain: "Motor", reached: 2, total: 4, confidence: "medium" },
    ]);
  });

  it("returns a 'none' read with no milestones", () => {
    const s = computeDevScore([]);
    expect(s.domains).toEqual([]);
    expect(s.confidence).toBe("none");
    expect(s.focusDomain).toBeNull();
  });

  it("points the focus at the lowest-scoring domain with room to grow", () => {
    const s = computeDevScore([
      ms("Motor", true), ms("Motor", true), ms("Motor", true),       // 100% → no room
      ms("Social", false), ms("Social", false), ms("Social", true),  // 33% → most room
      ms("Cognitive", true), ms("Cognitive", false), ms("Cognitive", true), // 67%
    ]);
    expect(s.focusDomain).toBe("Social");
  });

  it("never points focus at a fully-reached domain", () => {
    const s = computeDevScore([ms("Motor", true), ms("Motor", true), ms("Motor", true)]);
    expect(s.focusDomain).toBeNull();
  });

  it("scales confidence with how many milestones inform a domain", () => {
    const low = computeDevScore([ms("Motor", true)]);
    expect(low.domains[0].confidence).toBe("low");
    const high = computeDevScore(Array.from({ length: 8 }, () => ms("Motor", true)));
    expect(high.domains[0].confidence).toBe("high");
  });

  it("passes domain ids through unchanged (label resolution is a view concern)", () => {
    // Compute must never rewrite ids to human labels — the card resolves
    // social_development → "Social development" at render time, not here.
    const s = computeDevScore([
      ms("social_development", true), ms("social_development", false),
      ms("language_communication", true),
    ]);
    expect(s.domains.map((d) => d.domain).sort()).toEqual([
      "language_communication", "social_development",
    ]);
    expect(s.focusDomain).toBe("social_development");
  });
});
