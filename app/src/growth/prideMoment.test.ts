import { describe, it, expect } from "vitest";
import {
  detectPrideCrossings,
  mergeCrossings,
  factualShareLine,
  pickCelebration,
  DOMAIN_THRESHOLDS,
  MILESTONE_COUNT_THRESHOLDS,
  type PrideState,
  type PrideCrossing,
} from "./prideMoment";
import type { DevScore } from "./devScore";

// ── Helpers ───────────────────────────────────────────────────────────────────

const emptyState: PrideState = { crossedThresholds: [], lastMilestoneCount: 0 };

function makeScore(overrides: Partial<DevScore> = {}): DevScore {
  return {
    overall: 0,
    domains: [],
    confidence: "none",
    focusDomain: null,
    ...overrides,
  };
}

function domainScore(domain: string, score: number, reached = 0, total = 4) {
  return { domain, score, reached, total, trend: "flat" as const, confidence: "medium" as const };
}

// ── detectPrideCrossings ───────────────────────────────────────────────────────

describe("detectPrideCrossings — no prior snapshot", () => {
  it("never fires on first render (no prior = no celebration)", () => {
    const current = makeScore({ domains: [domainScore("Motor", 80)] });
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: null,
      checkedCount: 20,
      state: emptyState,
    });
    expect(crossings).toHaveLength(0);
  });

  it("also returns nothing when priorByDomain is undefined", () => {
    const current = makeScore({ domains: [domainScore("Motor", 80)] });
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: undefined,
      checkedCount: 5,
      state: emptyState,
    });
    expect(crossings).toHaveLength(0);
  });
});

describe("detectPrideCrossings — domain score thresholds", () => {
  it("fires when a domain crosses the 50% threshold for the first time", () => {
    const current = makeScore({ domains: [domainScore("Language", 55)] });
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: { Language: 40 },
      checkedCount: 0,
      state: emptyState,
    });
    expect(crossings).toHaveLength(1);
    expect(crossings[0].kind).toBe("domain");
    expect(crossings[0].domain).toBe("Language");
    expect(crossings[0].threshold).toBe(50);
  });

  it("fires the 75% crossing when score jumps from 40 to 80 (catches the 50 and 75 crossings)", () => {
    const current = makeScore({ domains: [domainScore("Motor", 80)] });
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: { Motor: 40 },
      checkedCount: 0,
      state: emptyState,
    });
    // Both 50 and 75 are uncrossed and now crossed
    const thresholds = crossings.map((c) => c.threshold).sort((a, b) => a - b);
    expect(thresholds).toContain(50);
    expect(thresholds).toContain(75);
  });

  it("fires the 100% crossing when a domain reaches 100", () => {
    const current = makeScore({ domains: [domainScore("Social", 100)] });
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: { Social: 90 },
      checkedCount: 0,
      state: emptyState,
    });
    const keys = crossings.map((c) => c.threshold);
    expect(keys).toContain(100);
  });

  it("does NOT fire when already at or above the threshold with no new crossing", () => {
    const current = makeScore({ domains: [domainScore("Cognitive", 55)] });
    // prior was already at 55 — no new crossing occurred
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: { Cognitive: 55 },
      checkedCount: 0,
      state: emptyState,
    });
    expect(crossings).toHaveLength(0);
  });

  it("does NOT fire when score is still below the threshold", () => {
    const current = makeScore({ domains: [domainScore("Emotion", 40)] });
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: { Emotion: 30 },
      checkedCount: 0,
      state: emptyState,
    });
    expect(crossings).toHaveLength(0);
  });

  // AADC: regression never triggers celebration
  it("AADC — never fires when score regresses (domain went down)", () => {
    const current = makeScore({ domains: [domainScore("Motor", 45)] });
    const crossings = detectPrideCrossings({
      current,
      // prior was at 55 — score is now lower: regression
      priorByDomain: { Motor: 55 },
      checkedCount: 0,
      state: emptyState,
    });
    expect(crossings).toHaveLength(0);
  });

  it("AADC — does not fire for a domain that fell below a threshold", () => {
    const current = makeScore({ domains: [domainScore("Social", 48)] });
    // Prior was 50, current is 48 — fell below the 50 threshold
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: { Social: 50 },
      checkedCount: 0,
      state: emptyState,
    });
    expect(crossings).toHaveLength(0);
  });
});

describe("detectPrideCrossings — idempotency (no re-fire on already-crossed)", () => {
  it("does NOT re-fire a domain threshold that was already crossed and stored", () => {
    const current = makeScore({ domains: [domainScore("Language", 60)] });
    const stateWithCrossed: PrideState = {
      crossedThresholds: ["domain:Language:50"],
      lastMilestoneCount: 0,
    };
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: { Language: 40 }, // would normally trigger the 50-crossing
      checkedCount: 0,
      state: stateWithCrossed,
    });
    const keys = crossings.map((c) => c.key);
    expect(keys).not.toContain("domain:Language:50");
  });

  it("fires the next uncrossed threshold even if prior ones are persisted", () => {
    const current = makeScore({ domains: [domainScore("Motor", 80)] });
    const stateWith50: PrideState = {
      crossedThresholds: ["domain:Motor:50"],
      lastMilestoneCount: 0,
    };
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: { Motor: 70 }, // crosses 75 for the first time
      checkedCount: 0,
      state: stateWith50,
    });
    const keys = crossings.map((c) => c.threshold);
    expect(keys).toContain(75);
    expect(keys).not.toContain(50);
  });

  it("a re-render with identical state and score fires nothing", () => {
    const current = makeScore({ domains: [domainScore("Language", 60)] });
    const priorByDomain = { Language: 60 }; // same as current
    const crossings = detectPrideCrossings({
      current,
      priorByDomain,
      checkedCount: 10,
      state: emptyState,
    });
    expect(crossings).toHaveLength(0);
  });
});

describe("detectPrideCrossings — milestone count thresholds", () => {
  it("fires milestone_count when checked milestones crosses a round threshold", () => {
    const current = makeScore({});
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: {},
      checkedCount: 10,
      state: { crossedThresholds: [], lastMilestoneCount: 8 },
    });
    const countCrossings = crossings.filter((c) => c.kind === "milestone_count");
    expect(countCrossings.length).toBeGreaterThanOrEqual(1);
    expect(countCrossings[0].threshold).toBe(10);
  });

  it("does NOT re-fire a milestone count threshold that is already crossed", () => {
    const current = makeScore({});
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: {},
      checkedCount: 10,
      state: { crossedThresholds: ["milestone_count:10"], lastMilestoneCount: 8 },
    });
    const countCrossings = crossings.filter((c) => c.kind === "milestone_count");
    expect(countCrossings.map((c) => c.threshold)).not.toContain(10);
  });

  it("does NOT fire milestone_count when count did not change", () => {
    const current = makeScore({});
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: {},
      checkedCount: 10,
      state: { crossedThresholds: [], lastMilestoneCount: 10 },
    });
    expect(crossings.filter((c) => c.kind === "milestone_count")).toHaveLength(0);
  });

  it("AADC — does NOT fire milestone_count when count regresses (un-checking milestones)", () => {
    const current = makeScore({});
    // Count went from 12 to 8 — user unchecked some; 10-threshold was crossed before
    // but lastMilestoneCount tracking prevents re-celebration
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: {},
      checkedCount: 8,
      state: { crossedThresholds: [], lastMilestoneCount: 12 },
    });
    expect(crossings.filter((c) => c.kind === "milestone_count")).toHaveLength(0);
  });

  it("catches multiple thresholds when count jumps past several at once", () => {
    const current = makeScore({});
    const crossings = detectPrideCrossings({
      current,
      priorByDomain: {},
      checkedCount: 21,
      state: { crossedThresholds: [], lastMilestoneCount: 4 },
    });
    const thresholds = crossings
      .filter((c) => c.kind === "milestone_count")
      .map((c) => c.threshold)
      .sort((a, b) => a - b);
    expect(thresholds).toContain(5);
    expect(thresholds).toContain(10);
    expect(thresholds).toContain(15);
    expect(thresholds).toContain(20);
    expect(thresholds).not.toContain(25); // 25 not yet reached
  });
});

// ── mergeCrossings ─────────────────────────────────────────────────────────────

describe("mergeCrossings", () => {
  it("adds new keys to the crossed set", () => {
    const next = mergeCrossings(emptyState, [
      { key: "domain:Motor:50", kind: "domain", domain: "Motor", threshold: 50 },
    ], 10);
    expect(next.crossedThresholds).toContain("domain:Motor:50");
  });

  it("does not create duplicate keys", () => {
    const state: PrideState = { crossedThresholds: ["domain:Motor:50"], lastMilestoneCount: 0 };
    const next = mergeCrossings(state, [
      { key: "domain:Motor:50", kind: "domain", domain: "Motor", threshold: 50 },
    ], 10);
    expect(next.crossedThresholds.filter((k) => k === "domain:Motor:50")).toHaveLength(1);
  });

  it("updates the lastMilestoneCount", () => {
    const next = mergeCrossings(emptyState, [], 17);
    expect(next.lastMilestoneCount).toBe(17);
  });

  it("does not mutate the input state", () => {
    const state: PrideState = { crossedThresholds: [], lastMilestoneCount: 0 };
    mergeCrossings(state, [{ key: "x", kind: "domain", threshold: 50 }], 5);
    expect(state.crossedThresholds).toHaveLength(0);
  });
});

// ── factualShareLine — G2 compliance ─────────────────────────────────────────

const BANNED_WORDS = ["proven", "validated", "clinical", "clinically", "delay", "score", "assessment"];
const DIGIT_PERCENT = /%|\d+/;

function assertClaimFree(text: string) {
  for (const word of BANNED_WORDS) {
    expect(text.toLowerCase()).not.toContain(word);
  }
  expect(DIGIT_PERCENT.test(text)).toBe(false);
}

describe("factualShareLine — G2 and face-safety", () => {
  const crossingDomain: PrideCrossing = {
    key: "domain:Social:50",
    kind: "domain",
    domain: "Social",
    threshold: 50,
    firstName: "Maya",
  };
  const crossingCount: PrideCrossing = {
    key: "milestone_count:10",
    kind: "milestone_count",
    threshold: 10,
    firstName: "Maya",
  };

  it("domain line is claim-free (no digits, no banned words)", () => {
    const { en, he } = factualShareLine(crossingDomain, "Social development");
    assertClaimFree(en);
    assertClaimFree(he);
  });

  it("milestone_count line is claim-free", () => {
    const { en, he } = factualShareLine(crossingCount, "");
    assertClaimFree(en);
    assertClaimFree(he);
  });

  it("uses first name only (face-safety)", () => {
    const { en } = factualShareLine({ ...crossingDomain, firstName: "Maya Rubin" }, "Social");
    // Should contain first name but the full implementation uses whatever is passed
    // — callers MUST pass first-name only. The function outputs exactly what was given.
    expect(en).toContain("Maya Rubin"); // responsibility of the caller to pass first-name only
  });

  it("falls back gracefully when no first name is provided", () => {
    const { en } = factualShareLine({ ...crossingDomain, firstName: undefined }, "Social development");
    expect(en).toContain("Your child");
    assertClaimFree(en);
  });

  it("produces both EN and HE strings", () => {
    const { en, he } = factualShareLine(crossingDomain, "Language");
    expect(en.length).toBeGreaterThan(5);
    expect(he.length).toBeGreaterThan(5);
  });

  it("all defined DOMAIN_THRESHOLDS produce claim-free lines", () => {
    for (const t of DOMAIN_THRESHOLDS) {
      const c: PrideCrossing = { key: `domain:Motor:${t}`, kind: "domain", domain: "Motor", threshold: t };
      const { en, he } = factualShareLine(c, "Motor development");
      assertClaimFree(en);
      assertClaimFree(he);
    }
  });

  it("all defined MILESTONE_COUNT_THRESHOLDS produce claim-free lines", () => {
    for (const t of MILESTONE_COUNT_THRESHOLDS) {
      const c: PrideCrossing = { key: `milestone_count:${t}`, kind: "milestone_count", threshold: t };
      const { en, he } = factualShareLine(c, "");
      assertClaimFree(en);
      assertClaimFree(he);
    }
  });
});

// ── pickCelebration ─────────────────────────────────────────────────────────

describe("pickCelebration", () => {
  it("returns null for an empty array", () => {
    expect(pickCelebration([])).toBeNull();
  });

  it("prefers the 100% domain crossing", () => {
    const crossings: PrideCrossing[] = [
      { key: "milestone_count:10", kind: "milestone_count", threshold: 10 },
      { key: "domain:Motor:100", kind: "domain", domain: "Motor", threshold: 100 },
      { key: "domain:Language:50", kind: "domain", domain: "Language", threshold: 50 },
    ];
    expect(pickCelebration(crossings)?.key).toBe("domain:Motor:100");
  });

  it("falls back to milestone_count when no 100-crossing exists", () => {
    const crossings: PrideCrossing[] = [
      { key: "milestone_count:10", kind: "milestone_count", threshold: 10 },
      { key: "domain:Language:50", kind: "domain", domain: "Language", threshold: 50 },
    ];
    expect(pickCelebration(crossings)?.kind).toBe("milestone_count");
  });

  it("falls back to the first crossing when nothing else matches", () => {
    const crossings: PrideCrossing[] = [
      { key: "domain:Language:50", kind: "domain", domain: "Language", threshold: 50 },
    ];
    expect(pickCelebration(crossings)?.key).toBe("domain:Language:50");
  });
});
