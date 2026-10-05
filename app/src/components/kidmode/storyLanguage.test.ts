/**
 * B-KID-46 (KB-03) — a Hebrew child is never offered a story that cannot be
 * told in Hebrew. Rule order for the Tonight pick: language availability FIRST,
 * then the age view, then illustrated-first (R-4b), then the family logic. The
 * catalogue and the Library shelf apply the same language rule.
 *
 * Pure + static (no jsdom in this repo); the rendered HE pass is Fable's.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pickTonightsStory } from "./tonightsStory";
import { HERO_STORIES, storiesForLanguage, storyHasLanguage, storyLanguage } from "../../lib/heroJourneys";
import { kidArt, storyCoverKey, KID_THEME_IDS } from "../../lib/kidThemeManifest";
import type { HeroStorySpec } from "../../types";

const SRC = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const days = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);

/** A Hebrew fixture: a full 8-beat story, told in Hebrew or English only. */
function fixture(id: string, hebrew: boolean, metric: HeroStorySpec["primaryMetric"] = "courage"): HeroStorySpec {
  const ids = ["call", "challenge", "fear", "decision", "consequence", "growth", "victory", "reflection"] as const;
  return {
    id, pack: "courage", title: id, titleHe: `סיפור ${id}`, theme: "t", origin: "original", ageRange: [4, 8],
    primaryMetric: metric, baseReward: {}, learningObjective: "o",
    parentReflection: { practiced: [], questions: [] },
    beats: ids.map((b) => ({
      id: b, title: b, spine: `${b} spine`,
      ...(hebrew ? { titleHe: "כותרת", spineHe: "הגיבור הולך." } : {}),
      ...(b === "decision"
        ? { choices: ["a", "b", "c"].map((c) => ({ id: c, label: c, outcomeHint: c, metricDeltas: {}, ...(hebrew ? { labelHe: "לבחור", outcomeHintHe: "וכך היה." } : {}) })) }
        : {}),
    })),
  };
}

describe("B-KID-46: what counts as 'told in Hebrew'", () => {
  it("every beat's spineHe AND every choice's labelHe + outcomeHintHe; English always qualifies", () => {
    const full = fixture("full-he", true);
    expect(storyHasLanguage(full, "he")).toBe(true);
    expect(storyHasLanguage(fixture("en-only", false), "he")).toBe(false);
    expect(storyHasLanguage(fixture("en-only", false), "en")).toBe(true);
    const noSpine = { ...full, beats: full.beats.map((b) => (b.id === "victory" ? { ...b, spineHe: undefined } : b)) };
    expect(storyHasLanguage(noSpine, "he")).toBe(false);
    const noChoice = {
      ...full,
      beats: full.beats.map((b) => (b.id === "decision" ? { ...b, choices: b.choices!.map((c, i) => (i === 2 ? { ...c, outcomeHintHe: " " } : c)) } : b)),
    };
    expect(storyHasLanguage(noChoice, "he")).toBe(false);
  });
  it("the story language is Hebrew when the UI or the story (AI) language is", () => {
    expect(storyLanguage("he", "he")).toBe("he");
    expect(storyLanguage("he", "en")).toBe("he");
    expect(storyLanguage("en", "he")).toBe("he");
    expect(storyLanguage("en", "en")).toBe("en");
  });
  it("the real catalogue: every story listed in Hebrew is fully Hebrew", () => {
    const heList = storiesForLanguage(HERO_STORIES, "he");
    expect(heList.length).toBeGreaterThan(0);
    for (const s of heList) {
      for (const b of s.beats) expect(b.spineHe?.trim(), `${s.id}/${b.id}`).toBeTruthy();
    }
    expect(storiesForLanguage(HERO_STORIES, "en")).toHaveLength(HERO_STORIES.length);
  });
});

describe("B-KID-46: the Tonight pick — language first, then illustrated-first", () => {
  const illustratedEn = fixture("illustrated-en-only", false);
  const plainHe = fixture("plain-he", true);
  const illustratedHe = fixture("illustrated-he", true);
  const covered = new Set(["illustrated-en-only", "illustrated-he"]);
  const prefer = (s: { id: string }) => covered.has(s.id);

  it("a Hebrew child never gets the illustrated English-only story (30 nights)", () => {
    for (const d of days) {
      const { story } = pickTonightsStory(d, "child-he", { stories: [illustratedEn, plainHe], prefer, showAllAges: true, lang: "he" });
      expect(story?.id, d).toBe("plain-he");
    }
  });
  it("inside the Hebrew set, an illustrated story still leads (no cover-less pick while one exists)", () => {
    for (const d of days) {
      const { story } = pickTonightsStory(d, "child-he", { stories: [illustratedEn, plainHe, illustratedHe], prefer, showAllAges: true, lang: "he" });
      expect(story?.id, d).toBe("illustrated-he");
    }
  });
  it("English is unchanged: the illustrated story leads", () => {
    for (const d of days) {
      const { story } = pickTonightsStory(d, "child-en", { stories: [illustratedEn, plainHe], prefer, showAllAges: true, lang: "en" });
      expect(story?.id, d).toBe("illustrated-en-only");
    }
  });
  it("no story can be told in Hebrew → no pick (the honest empty state), never an English one", () => {
    const r = pickTonightsStory("2026-11-01", "child-he", { stories: [illustratedEn], prefer, showAllAges: true, lang: "he" });
    expect(r.story).toBeNull();
    expect(r.reason.kind).toBe("none");
  });
  it("NEGATIVE CONTROL: without the language rule the Hebrew child is steered to the English-only story", () => {
    const { story } = pickTonightsStory("2026-11-01", "child-he", { stories: [illustratedEn, plainHe], prefer, showAllAges: true });
    expect(story?.id).toBe("illustrated-en-only");
  });
  it("real catalogue, every theme and both languages: the pick is tellable, and covered whenever a tellable covered story exists", () => {
    for (const theme of KID_THEME_IDS) {
      const covers = (s: { id: string }) => kidArt(theme, storyCoverKey(s.id)) !== null;
      for (const lang of ["en", "he"] as const) {
        const tellableCovered = HERO_STORIES.some((s) => storyHasLanguage(s, lang) && covers(s));
        for (const d of days) {
          const { story } = pickTonightsStory(d, "child-x", { prefer: covers, showAllAges: true, lang });
          expect(story, `${theme}/${lang}/${d}`).not.toBeNull();
          expect(storyHasLanguage(story!, lang), `${theme}/${lang}/${d} ${story!.id}`).toBe(true);
          if (tellableCovered) expect(covers(story!), `${theme}/${lang}/${d} ${story!.id}`).toBe(true);
        }
      }
    }
  });
});

describe("B-KID-46: both call sites and the Stories catalogue/Library apply the rule", () => {
  const dash = read("components/kidmode/KidDashboard.tsx");
  const tab = read("components/tabs/HeroJourneyTab.tsx");
  it("the kid home passes the story language (UI or AI Hebrew → Hebrew)", () => {
    expect(dash).toContain("lang: storyLanguage(uiLang, aiLang),");
    expect(dash).toContain("const { t, uiLang, aiLang } = useLanguage();");
  });
  it("the Stories tab: one story language, catalogue, Tonight, pin and Library shelf", () => {
    expect(tab).toContain("const storyLang = storyLanguage(uiLang, aiLang);");
    expect(tab).toMatch(/const visibleStories = storiesForLanguage\(\s*packFilter === "all" \? HERO_STORIES : storiesInPack\(packFilter\),\s*storyLang,\s*\);/);
    expect(tab).toContain("lang: storyLang,");
    expect(tab).toContain("if (!storyHasLanguage(story, storyLang)) return;");
    expect(tab).toContain("const shelfRuns = runs.filter((r) => isTellable(r.storyId));");
    // the parent Library shelf reads the filtered list; B-KID-85: the kid
    // library reads kidBooks with the same story language (storiesForLanguage)
    expect(tab.match(/\{shelfRuns\.map\(\(run\) => \{/g)).toHaveLength(1);
    expect(tab).toContain("kidBooks({ lang: storyLang,");
    expect(tab).not.toMatch(/\{runs\.map\(\(run\) => \{/);
  });
});
