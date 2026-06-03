import { describe, it, expect } from "vitest";
import {
  HERO_STORIES,
  PACKS,
  METRIC_IDS,
  emptyMetrics,
  addMetrics,
  applyChoice,
  getStorySpec,
  storiesInPack,
} from "./heroJourneys";
import type { DevelopmentMetricId, HeroBeatId } from "../types";

const SPINE_ORDER: HeroBeatId[] = [
  "call",
  "challenge",
  "fear",
  "decision",
  "consequence",
  "growth",
  "victory",
  "reflection",
];

const isMetricKey = (k: string): k is DevelopmentMetricId =>
  (METRIC_IDS as string[]).includes(k);

describe("hero journey catalog", () => {
  it("contains exactly 10 stories with unique ids", () => {
    expect(HERO_STORIES).toHaveLength(10);
    const ids = HERO_STORIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(10);
  });

  it("covers all 4 packs (3 / 3 / 3 / 1)", () => {
    expect(PACKS).toHaveLength(4);
    expect(storiesInPack("courage")).toHaveLength(3);
    expect(storiesInPack("responsibility")).toHaveLength(3);
    expect(storiesInPack("growth")).toHaveLength(3);
    expect(storiesInPack("wisdom")).toHaveLength(1);
  });

  it("every story follows the fixed 8-beat spine in order", () => {
    for (const story of HERO_STORIES) {
      expect(story.beats.map((b) => b.id)).toEqual(SPINE_ORDER);
      expect(story.ageRange).toEqual([4, 8]);
      expect(story.titleHe.trim().length).toBeGreaterThan(0);
      expect(story.learningObjective.trim().length).toBeGreaterThan(0);
      expect(story.parentReflection.questions.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("only the decision beat carries choices, and it has exactly 3 (a/b/c)", () => {
    for (const story of HERO_STORIES) {
      for (const beat of story.beats) {
        if (beat.id === "decision") {
          expect(beat.choices).toBeDefined();
          expect(beat.choices).toHaveLength(3);
          expect(beat.choices!.map((c) => c.id)).toEqual(["a", "b", "c"]);
        } else {
          expect(beat.choices).toBeUndefined();
        }
      }
    }
  });

  it("all metric deltas and baseRewards use valid metric keys and positive points", () => {
    for (const story of HERO_STORIES) {
      for (const [k, v] of Object.entries(story.baseReward)) {
        expect(isMetricKey(k)).toBe(true);
        expect(v).toBeGreaterThan(0);
      }
      const decision = story.beats.find((b) => b.id === "decision");
      for (const choice of decision!.choices!) {
        const keys = Object.keys(choice.metricDeltas);
        expect(keys.length).toBeGreaterThan(0);
        for (const [k, v] of Object.entries(choice.metricDeltas)) {
          expect(isMetricKey(k)).toBe(true);
          expect(v).toBeGreaterThan(0);
        }
      }
    }
  });

  it("primaryMetric is awarded by the story's baseReward", () => {
    for (const story of HERO_STORIES) {
      expect(story.baseReward[story.primaryMetric] ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("metric helpers", () => {
  it("emptyMetrics has all five metrics at zero", () => {
    const m = emptyMetrics();
    expect(Object.keys(m).sort()).toEqual([...METRIC_IDS].sort());
    expect(METRIC_IDS.every((id) => m[id] === 0)).toBe(true);
  });

  it("addMetrics sums partial deltas into a full metrics object", () => {
    const sum = addMetrics(emptyMetrics(), { courage: 2, wisdom: 1 });
    expect(sum.courage).toBe(2);
    expect(sum.wisdom).toBe(1);
    expect(sum.empathy).toBe(0);
  });

  it("applyChoice adds baseReward plus the chosen choice deltas", () => {
    const david = getStorySpec("david-and-goliath")!;
    const base = applyChoice(david, undefined); // baseReward only
    expect(base.courage).toBe(david.baseReward.courage);

    const brave = applyChoice(david, "c"); // courage +2, resilience +1 on top of base
    expect((brave.courage ?? 0)).toBe((david.baseReward.courage ?? 0) + 2);
    expect((brave.resilience ?? 0)).toBeGreaterThan(base.resilience ?? 0);
  });

  it("getStorySpec returns undefined for unknown ids", () => {
    expect(getStorySpec("does-not-exist")).toBeUndefined();
    expect(getStorySpec("king-solomons-choice")?.pack).toBe("wisdom");
  });
});
