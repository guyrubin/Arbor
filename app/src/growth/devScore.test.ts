import { describe, it, expect } from "vitest";
import { computeDevScore, toSnapshot, shouldSnapshot, type ScoreMilestone, type DevScoreSnapshot } from "./devScore";

const NOW = new Date("2026-06-15T12:00:00").getTime();
const DAY = 86_400_000;

const ms = (domain: string, checked: boolean): ScoreMilestone => ({ domain, checked });

describe("computeDevScore", () => {
  it("scores each domain by share of milestones reached", () => {
    const s = computeDevScore([
      ms("Motor", true), ms("Motor", true), ms("Motor", false), ms("Motor", false), // 50%
      ms("Language", true), ms("Language", true), ms("Language", true), // 100%
    ]);
    const motor = s.domains.find((d) => d.domain === "Motor")!;
    const lang = s.domains.find((d) => d.domain === "Language")!;
    expect(motor.score).toBe(50);
    expect(lang.score).toBe(100);
    expect(s.overall).toBe(Math.round((5 / 7) * 100)); // 71
  });

  it("returns a 'none' read with no milestones", () => {
    const s = computeDevScore([]);
    expect(s.overall).toBe(0);
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

  it("derives an honest trend only against a prior snapshot", () => {
    const milestones = [ms("Motor", true), ms("Motor", true), ms("Motor", false)]; // 67%
    const flat = computeDevScore(milestones);
    expect(flat.domains[0].trend).toBe("flat"); // no prior

    const prior: DevScoreSnapshot = { takenMs: NOW - 7 * DAY, overall: 33, byDomain: { Motor: 33 } };
    const up = computeDevScore(milestones, prior);
    expect(up.domains[0].trend).toBe("up"); // 33 → 67
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

describe("snapshots", () => {
  it("round-trips a snapshot from a score", () => {
    const s = computeDevScore([ms("Motor", true), ms("Language", false)]);
    const snap = toSnapshot(s, NOW);
    expect(snap.takenMs).toBe(NOW);
    expect(snap.overall).toBe(s.overall);
    expect(snap.byDomain.Motor).toBe(100);
  });

  it("snapshots weekly (and always when there is no prior)", () => {
    expect(shouldSnapshot(null, NOW)).toBe(true);
    expect(shouldSnapshot({ takenMs: NOW - 3 * DAY, overall: 0, byDomain: {} }, NOW)).toBe(false);
    expect(shouldSnapshot({ takenMs: NOW - 8 * DAY, overall: 0, byDomain: {} }, NOW)).toBe(true);
  });
});
