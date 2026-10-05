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
  storyHasLanguage,
  STORY_HE_REVIEW,
} from "./heroJourneys";
import { authoredChoice, authoredScene, type StoryHero } from "./heroJourneyRender";
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
  it("contains exactly 21 stories with unique ids", () => {
    expect(HERO_STORIES).toHaveLength(21);
    const ids = HERO_STORIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(21);
  });

  it("covers all 5 packs (courage 6 / responsibility 4 / growth 5 / wisdom 4 / truth 2) — UX26-37 added Lantern Path, Cloud Orchestra, Little Bridge Builders", () => {
    expect(PACKS).toHaveLength(5);
    expect(storiesInPack("courage")).toHaveLength(6);
    expect(storiesInPack("responsibility")).toHaveLength(4);
    expect(storiesInPack("growth")).toHaveLength(5);
    expect(storiesInPack("wisdom")).toHaveLength(4);
    expect(storiesInPack("truth")).toHaveLength(2);
  });

  it("every story follows the fixed 8-beat spine in order", () => {
    for (const story of HERO_STORIES) {
      expect(story.beats.map((b) => b.id)).toEqual(SPINE_ORDER);
      // B-KID-52 (KB-13): ages follow the lane-B section 1.K verdicts, inside 3-8 years.
      expect(story.ageRange[0]).toBeGreaterThanOrEqual(3);
      expect(story.ageRange[1]).toBeLessThanOrEqual(8);
      expect(story.ageRange[0]).toBeLessThan(story.ageRange[1]);
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
        // Peterson scoring: the avoidant choice MAY award nothing (empty deltas);
        // any present delta must still use a valid metric key with positive points.
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

  it("the avoidant choice 'a' never rewards the story's primary virtue (Peterson: avoidance is not virtue)", () => {
    for (const story of HERO_STORIES) {
      const decision = story.beats.find((b) => b.id === "decision");
      const avoidant = decision!.choices!.find((c) => c.id === "a")!;
      // retreat must not pay out courage/responsibility/wisdom/resilience-as-the-primary
      expect((avoidant.metricDeltas[story.primaryMetric] ?? 0)).toBe(0);
      expect((avoidant.metricDeltas.courage ?? 0)).toBe(0);
    }
  });
});

describe("metric helpers", () => {
  it("emptyMetrics has all metrics at zero", () => {
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

// B-KID-132: the illustrated books read as picture-book text (EN + HE, with the
// feminine Hebrew for a girl). Every hero mention is a token nameTheHero
// replaces: after naming, no "hero" / "גיבור" is left for a boy or a girl.
const READ_ALOUD_IDS = [
  "the-lion-who-was-afraid", "noahs-ark", "the-garden-of-forgotten-seeds",
  "david-and-goliath", "the-dragon-of-responsibility", "jonah-and-the-great-fish",
  "king-solomons-choice", "moses-and-pharaoh",
];

describe("B-KID-132: the read-aloud books name the child on every page", () => {
  const boy = { name: "Noam", gender: "boy" as const };
  const boyHe = { name: "נועם", gender: "boy" as const };
  const girlHe = { name: "מאיה", gender: "girl" as const };
  const pages = (id: string, lang: "en" | "he", hero: StoryHero) => {
    const s = getStorySpec(id)!;
    const decision = s.beats.find((b) => b.id === "decision")!;
    return [
      ...s.beats.map((b) => authoredScene(b, lang, undefined, hero).narration),
      ...decision.choices!.map((c) => authoredChoice(c, lang, hero).consequence),
    ];
  };
  it("exactly the rewritten books carry feminine Hebrew text, and keep the Hebrew review marker", () => {
    expect(HERO_STORIES.filter((s) => s.beats.some((b) => b.spineHeF)).map((s) => s.id).sort()).toEqual([...READ_ALOUD_IDS].sort());
    for (const id of READ_ALOUD_IDS) {
      expect(STORY_HE_REVIEW[id], id).toBe("ai-first-pass");
      expect(storyHasLanguage(getStorySpec(id)!, "he"), id).toBe(true);
    }
  });
  it.each(READ_ALOUD_IDS.map((id) => [id]))("%s: EN, HE boy and HE girl leave no un-named hero", (id) => {
    for (const p of pages(id, "en", boy)) expect(p, p).not.toMatch(/\bhero/i);
    for (const p of pages(id, "he", boyHe)) expect(p, p).not.toMatch(/גיבור/);
    for (const p of pages(id, "he", girlHe)) expect(p, p).not.toMatch(/גיבור/);
    expect(pages(id, "en", boy).some((p) => p.includes("Noam"))).toBe(true);
    expect(pages(id, "he", girlHe).some((p) => p.includes("מאיה"))).toBe(true);
  });
  it.each(READ_ALOUD_IDS.map((id) => [id]))("%s: the feminine text is the girl's twin of the masculine page", (id) => {
    for (const b of getStorySpec(id)!.beats) {
      if (b.spineHeF) {
        expect(b.spineHe, `${id} ${b.id}`).toMatch(/גיבור(?!ה)/);
        expect(b.spineHeF, `${id} ${b.id}`).toMatch(/גיבורה/);
      }
      for (const c of b.choices ?? []) if (c.outcomeHintHeF) expect(c.outcomeHintHeF, `${id} ${c.id}`).toMatch(/גיבורה/);
    }
  });
});
