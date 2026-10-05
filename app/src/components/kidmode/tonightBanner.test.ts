/**
 * B-KID-42 (+ KA-28) — Tonight's banner wears the story's OWN cover in the
 * child's theme and opens THAT book in one tap (not a one-card catalogue).
 * Static + pure (no jsdom in this repo); the rendered tap is Fable's pass.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { worldArtwork } from "../practice/worldArtwork";

const SRC = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const dash = read("components/kidmode/KidDashboard.tsx");
const tab = read("components/tabs/HeroJourneyTab.tsx");

describe("B-KID-42: the banner art is tonight's story cover", () => {
  it("resolves a story cover per theme, never across themes", () => {
    expect(worldArtwork("story-noahs-ark", "film3d")?.src).toContain("/cards/web/story-noahs-ark-480.webp");
    expect(worldArtwork("story-noahs-ark", "storybook")).toBeUndefined();
    expect(worldArtwork("story-the-lantern-path", "storybook")?.src).toContain("lantern-path-v1-480.webp");
    expect(worldArtwork("story-the-lantern-path", "film3d")).toBeUndefined();
  });
  it("the banner picks the cover when the theme has it, else the kid-quest tile", () => {
    expect(dash).toContain("kidArt(kidTheme, storyCoverKey(tonightsStory.id)) ? `story-${tonightsStory.id}` : \"kid-quest\"");
    expect(dash).toContain("<WorldScene worldId={tonightsArtId} theme={kidTheme}");
    expect(dash).toContain('onClick={() => onOpenSurface("journeys", tonightsStoryId)}');
  });
});

describe("B-KID-70 (R-2b): a portrait theme is image-led", () => {
  it("no sticker portrait over art that already shows a hero; 3:4 side panel; title max 2 lines", () => {
    expect(dash).toContain("{!tonightsArtHasHero && (");
    expect(dash).toContain("inlineSize: Math.round(KID_HOME_BANNER_BLOCK * 3 / 4)");
    const banner = dash.slice(dash.indexOf("Today's adventure banner"), dash.indexOf("── Games ──"));
    expect(banner).toContain("WebkitLineClamp: 2");
  });
  it("film3d tiles take the 480 derivative only (no 1024 request on the home)", () => {
    for (const id of ["kid-playbank", "kid-hero", "memory", "story-noahs-ark"]) {
      expect(worldArtwork(id, "film3d")!.srcSet, id).not.toContain("1024");
    }
    expect(worldArtwork("kid-hero", "storybook")!.srcSet).toContain("960w");
  });
  it("the shape comes from the theme, not a component if", () => {
    expect(dash).toContain('const portrait = KID_THEME_TILE_SHAPE[theme] === "portrait";');
    expect(dash).not.toMatch(/theme === "film3d"|kidTheme === "film3d"/);
  });
});

describe("B-KID-42: a pinned story opens the book on arrival", () => {
  const effect = tab.slice(tab.indexOf("const pinnedOpened = useRef(false);"));
  it("auto-starts the pinned story once, after startJourney is declared", () => {
    expect(tab.indexOf("const pinnedOpened = useRef(false);")).toBeGreaterThan(tab.indexOf("const startJourney = async"));
    expect(effect).toMatch(/if \(pinnedOpened\.current \|\| !initialStoryId\) return;\s+const story = getStorySpec\(initialStoryId\);\s+if \(!story\) return;\s+pinnedOpened\.current = true;\s+void startJourney\(story\);/);
    expect(effect.slice(0, 600)).toContain("}, [initialStoryId]);");
  });
  it("negative control: the pre-fix tab (pin = filter only) has no auto-open", () => {
    const pre = tab.replace(/const pinnedOpened[\s\S]*?\}, \[initialStoryId\]\);/, "");
    expect(pre).not.toMatch(/startJourney\(story\);\s*\/\/ eslint[^\n]*\n\s*\}, \[initialStoryId\]\)/);
    expect(pre).not.toContain("pinnedOpened");
  });
});
