/**
 * B-KID-70 (R-1) — the kid theme manifest is the ONE seam for kid art.
 * (a) every file the manifest names exists on disk (in both sizes);
 * (b) KID_ART_GAPS is exactly what each theme lacks — the reviewed list of
 *     images still to be created — and the default theme covers every gating
 *     slot (else the build fails);
 * (c) no component under components/kidmode or components/practice names a
 *     `/visuals/` path: art goes through `kidArt()` only. This re-pins the old
 *     "no legacy stock-child source" ban (kidMode.test.ts KID-7, e3592a9),
 *     superseded by Guy's 5 Oct ruling that the glossy-3D cards stay and are used.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_KID_THEME, GATING_KID_ART_KEYS, KID_ART_KEYS, KID_THEME_IDS, KID_THEME_MANIFEST,
  KID_THEME_TILE_SHAPE, kidArt, kidArtSrcSet, resolveKidTheme, selectableThemes, storyCoverKey, themeCoverage,
} from "./kidThemeManifest";
import { KID_ART_GAPS } from "./kidArtGaps";
import { HERO_STORIES } from "./heroJourneys";

const APP = path.resolve(__dirname, "..", "..");
const PUBLIC = path.join(APP, "public");
const SRC = path.join(APP, "src");

describe("B-KID-70 (a): every manifest file exists on disk", () => {
  it.each(KID_THEME_IDS.map((t) => [t]))("%s", (theme) => {
    const entries = Object.entries(KID_THEME_MANIFEST[theme]);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, art] of entries) {
      for (const url of [art!.src, art!.src480]) {
        expect(url.startsWith("/visuals/"), `${theme} ${key}`).toBe(true);
        const file = path.join(PUBLIC, url);
        expect(existsSync(file), `${theme} ${key} -> ${url}`).toBe(true);
        // web derivatives only: a raw multi-MB PNG never ships through the manifest
        expect(statSync(file).size, url).toBeLessThanOrEqual(400 * 1024);
      }
      expect(kidArtSrcSet(art!)).toBe(`${art!.src480} 480w, ${art!.src} ${art!.width}w`);
      expect(KID_ART_KEYS, `${theme} names an unknown slot ${key}`).toContain(key);
    }
  });
});

describe("B-KID-70 (b): coverage + the reviewed list of images to create", () => {
  it("KID_ART_GAPS equals what each theme is missing (re-review on any change)", () => {
    for (const theme of KID_THEME_IDS) {
      expect([...KID_ART_GAPS[theme]], theme).toEqual(themeCoverage(theme).missing);
    }
  });
  it("the default theme covers every gating slot, so it is always selectable", () => {
    expect(themeCoverage(DEFAULT_KID_THEME, GATING_KID_ART_KEYS).missing).toEqual([]);
    expect(selectableThemes()).toContain(DEFAULT_KID_THEME);
  });
  it("a theme is selectable only when it covers every gating slot", () => {
    for (const theme of KID_THEME_IDS) {
      const complete = GATING_KID_ART_KEYS.every((k) => kidArt(theme, k) !== null);
      expect(selectableThemes().includes(theme), theme).toBe(complete);
    }
  });
  it("one slot per story, and a story key never falls back across themes", () => {
    expect(KID_ART_KEYS.filter((k) => k.startsWith("story."))).toHaveLength(HERO_STORIES.length);
    expect(kidArt("storybook", storyCoverKey("noahs-ark"))).toBeNull();
    expect(kidArt("film3d", storyCoverKey("noahs-ark"))?.src).toContain("story-noahs-ark");
  });
  it("R-2b: tile shape is a theme property; film3d art says whether it shows a hero", () => {
    expect(KID_THEME_TILE_SHAPE).toEqual({ film3d: "portrait", storybook: "wide" });
    expect(kidArt("film3d", "world.memory.tile")?.hasHero).toBe(true);
    expect(kidArt("film3d", "world.kid-quest.tile")?.hasHero).toBe(false);
    expect(kidArt("storybook", "world.memory.tile")?.hasHero).toBe(false);
  });
  it("resolveKidTheme: unknown or unselectable values fall to the default", () => {
    expect(resolveKidTheme(undefined)).toBe(DEFAULT_KID_THEME);
    expect(resolveKidTheme("comic")).toBe(DEFAULT_KID_THEME);
    for (const t of selectableThemes()) expect(resolveKidTheme(t)).toBe(t);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name) ? [p] : [];
  });
}

describe("B-KID-70 (c): kid components reference art only through the manifest", () => {
  // R-4: the story surfaces (catalogue, shelf, reader) joined the seam.
  const files = [
    ...["kidmode", "practice", "stories"].flatMap((d) => walk(path.join(SRC, "components", d))),
    path.join(SRC, "components", "tabs", "HeroJourneyTab.tsx"),
  ];
  it("scans a real tree", () => expect(files.length).toBeGreaterThan(20));
  it.each(files.map((f) => [path.relative(SRC, f), f]))("%s names no /visuals/ path", (_rel, file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/\/visuals\//);
  });
  it("R-4: the story shelf + reader take the cover from the manifest, per theme", () => {
    const tab = readFileSync(path.join(SRC, "components", "tabs", "HeroJourneyTab.tsx"), "utf8");
    expect(tab).toContain("const storyCover = (id: string) => kidArt(kidTheme, storyCoverKey(id));");
    expect(tab).toContain("fallbackArtUrl={storyCover(activeStory.id)?.src}");
    // B-KID-85: the parent Library keeps its run tiles; the kid shelf is
    // KidLibrary, whose covers come from the manifest through KidBookCover.
    expect(tab.match(/const cover = storyCover\(run\.storyId\);/g)).toHaveLength(1);
    expect(tab).toContain("hasCover: (id) => storyCover(id) !== null");
    const kidCover = readFileSync(path.join(SRC, "components", "kidmode", "KidBookCover.tsx"), "utf8");
    expect(kidCover).toContain("kidArt(theme, storyCoverKey(storyId))");
  });
  it("negative control: the scan catches a direct path", () => {
    expect('src="/visuals/cards/web/game-memory-480.webp"').toMatch(/\/visuals\//);
  });
});
