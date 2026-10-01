import { describe, it, expect } from "vitest";
import * as prideModule from "./prideMoment";
import {
  detectPrideCrossings,
  mergeCrossings,
  factualShareLine,
  pickCelebration,
  MILESTONE_COUNT_THRESHOLDS,
  type PrideState,
  type PrideCrossing,
} from "./prideMoment";

/* B-GROWTH-06 — the per-domain SCORE branch (25/50/75/100 % of a child's age
   window, celebrated) is gone. These tests cover what remains: the count of
   milestones the PARENT noticed crossing a round number, once. */

const emptyState: PrideState = { crossedThresholds: [], lastMilestoneCount: 0 };

describe("detectPrideCrossings — no baseline yet", () => {
  it("never fires without a baseline (no confetti dump on first observation)", () => {
    expect(detectPrideCrossings({ checkedCount: 20, state: emptyState })).toHaveLength(0);
    expect(detectPrideCrossings({ checkedCount: 20, state: { crossedThresholds: [] } })).toHaveLength(0);
  });
});

describe("detectPrideCrossings — milestone count thresholds", () => {
  it("fires milestone_count when the noticed count crosses a round threshold", () => {
    const crossings = detectPrideCrossings({ checkedCount: 10, state: { crossedThresholds: [], lastMilestoneCount: 8 } });
    expect(crossings.map((c) => c.threshold)).toEqual([10]);
    expect(crossings[0].kind).toBe("milestone_count");
  });

  it("does NOT re-fire a threshold that is already crossed", () => {
    const crossings = detectPrideCrossings({
      checkedCount: 10,
      state: { crossedThresholds: ["milestone_count:10"], lastMilestoneCount: 8 },
    });
    expect(crossings.map((c) => c.threshold)).not.toContain(10);
  });

  it("does NOT fire when the count did not change", () => {
    expect(detectPrideCrossings({ checkedCount: 10, state: { crossedThresholds: [], lastMilestoneCount: 10 } })).toHaveLength(0);
  });

  it("AADC — does NOT fire when the count regresses (un-checking milestones)", () => {
    expect(detectPrideCrossings({ checkedCount: 8, state: { crossedThresholds: [], lastMilestoneCount: 12 } })).toHaveLength(0);
  });

  it("catches multiple thresholds when the count jumps past several at once", () => {
    const thresholds = detectPrideCrossings({ checkedCount: 21, state: { crossedThresholds: [], lastMilestoneCount: 4 } })
      .map((c) => c.threshold)
      .sort((a, b) => a - b);
    expect(thresholds).toEqual([5, 10, 15, 20]);
  });
});

describe("B-GROWTH-06 — no score threshold survives", () => {
  it("the module exports no DOMAIN_THRESHOLDS and the detector takes no score", () => {
    expect("DOMAIN_THRESHOLDS" in prideModule).toBe(false);
    // the input shape is the parent-noticed count + idempotency state only
    const crossings = detectPrideCrossings({ checkedCount: 5, state: { crossedThresholds: [], lastMilestoneCount: 3 } });
    expect(crossings.every((c) => c.kind === "milestone_count")).toBe(true);
  });
});

// ── mergeCrossings ─────────────────────────────────────────────────────────────

describe("mergeCrossings", () => {
  const c10: PrideCrossing = { key: "milestone_count:10", kind: "milestone_count", threshold: 10 };

  it("adds new keys to the crossed set", () => {
    expect(mergeCrossings(emptyState, [c10], 10).crossedThresholds).toContain("milestone_count:10");
  });

  it("does not create duplicate keys", () => {
    const next = mergeCrossings({ crossedThresholds: ["milestone_count:10"], lastMilestoneCount: 9 }, [c10], 10);
    expect(next.crossedThresholds.filter((k) => k === "milestone_count:10")).toHaveLength(1);
  });

  it("updates the lastMilestoneCount", () => {
    expect(mergeCrossings(emptyState, [], 17).lastMilestoneCount).toBe(17);
  });

  it("does not mutate the input state", () => {
    const state: PrideState = { crossedThresholds: [], lastMilestoneCount: 0 };
    mergeCrossings(state, [c10], 5);
    expect(state.crossedThresholds).toHaveLength(0);
  });
});

// ── factualShareLine — G2 compliance ─────────────────────────────────────────

const BANNED_WORDS = ["proven", "validated", "clinical", "clinically", "delay", "score", "assessment"];
const DIGIT_PERCENT = /%|\d+/;

function assertClaimFree(text: string) {
  for (const word of BANNED_WORDS) expect(text.toLowerCase()).not.toContain(word);
  expect(DIGIT_PERCENT.test(text)).toBe(false);
}

describe("factualShareLine — G2 and face-safety", () => {
  const crossingCount: PrideCrossing = { key: "milestone_count:10", kind: "milestone_count", threshold: 10, firstName: "Maya" };

  it("the line is claim-free (no digits, no banned words)", () => {
    const { en, he } = factualShareLine(crossingCount);
    assertClaimFree(en);
    assertClaimFree(he);
  });

  it("outputs exactly the name it is given (callers pass first name only)", () => {
    expect(factualShareLine({ ...crossingCount, firstName: "Maya Rubin" }).en).toContain("Maya Rubin");
  });

  it("falls back gracefully when no first name is provided", () => {
    const { en } = factualShareLine({ ...crossingCount, firstName: undefined });
    expect(en).toContain("Your child");
    assertClaimFree(en);
  });

  it("all defined MILESTONE_COUNT_THRESHOLDS produce claim-free lines in EN and HE", () => {
    for (const t of MILESTONE_COUNT_THRESHOLDS) {
      const { en, he } = factualShareLine({ key: `milestone_count:${t}`, kind: "milestone_count", threshold: t });
      assertClaimFree(en);
      assertClaimFree(he);
      expect(he.length).toBeGreaterThan(5);
    }
  });
});

// ── pickCelebration ─────────────────────────────────────────────────────────

describe("pickCelebration", () => {
  it("returns null for an empty array", () => {
    expect(pickCelebration([])).toBeNull();
  });

  it("picks the highest threshold when several cross at once", () => {
    const crossings: PrideCrossing[] = [5, 15, 10].map((t) => ({ key: `milestone_count:${t}`, kind: "milestone_count" as const, threshold: t }));
    expect(pickCelebration(crossings)?.threshold).toBe(15);
  });
});
