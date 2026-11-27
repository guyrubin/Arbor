/**
 * B-KID-173: the last comic shells and navy stages are on the Season 01 kit.
 * Calm Builder, Puzzle Planet and Sound Explorer wear the Bop games' shell
 * (.adventure--bop, a .bop-stage, kit props); Clay Theatre's night stage and
 * Maker Desk's screens are dimmed or lit pearl, never navy. Rendered half for
 * the three menu games (EN and HE), source half for all five, and negative
 * controls that mutate the real source so the scans are known to bite.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string) => key }) }));
vi.mock("../../../../context/ArborContext", () => ({ useArborOptional: () => ({ childProfile: { id: "synthetic-kit-child", kidTheme: "film3d" } }) }));
vi.mock("../../game/GameShell", () => ({ GameShell: ({ children }: { children: ReactNode }) => <div data-test-shell="">{children}</div>, GameFinish: () => null }));
vi.mock("../../audio/kidAudio", () => ({ useKidReadAloudMuted: () => false, kidSfx: () => {} }));
vi.mock("../studioCreations", () => ({ useStudioCreations: () => ({ items: [], loaded: true, isCurrent: () => true }) }));
vi.mock("../StudioPlayHero", () => ({ StudioPlayHero: () => <span data-test-hero="" /> }));
vi.mock("./explorerAudio", () => ({ createExplorerAudio: () => ({ load: async () => true, play: () => true, stop: () => {}, dispose: () => {} }) }));

import CalmBuilder, { cornerObjectArt } from "./CalmBuilder";
import PuzzlePlanet from "./PuzzlePlanet";
import SoundExplorer from "./SoundExplorer";
import { CORNER_OBJECTS } from "./gameRules";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** The old comic shell and placeholder look: the comic ink line and pop
 *  shadow, the retired panel, a "+" placeholder or puzzle line icon, or a
 *  graphite comic outline. */
const COMIC = /--comic-(?:line|pop|ink)\b|\bstudio-game-panel\b|lucide-plus\b|lucide-puzzle\b|border:\s*3px solid var\(--studio-graphite-soft\)/;
/** A dashed placeholder slot (the three menu games' sheet only: a maker's
 *  dashed motion cue or crew dot is not a slot). */
const DASHED_SLOT = /border:\s*\d+px dashed/;
export function dashedSlots(source: string): string[] { return [...strip(source).matchAll(new RegExp(DASHED_SLOT, "g"))].map(m => m[0]); }
/** Navy: the makers' night and indigo inks, or a navy pad. */
const NAVY = /--mk-(?:night|indigo|indigo-deep)\b|\bpad-navy\b/;
/** The same inks named bare, as a canvas palette or a clay sky lists them. */
const NAVY_NAME = /['"](?:night|indigo|indigo-deep)['"]/;
export function comicFindings(source: string): string[] { return [...strip(source).matchAll(new RegExp(COMIC, "g"))].map(m => m[0]); }
export function navyFindings(source: string): string[] { return [...strip(source).matchAll(new RegExp(NAVY, "g"))].map(m => m[0]); }
export function navyNameFindings(source: string): string[] { return [...strip(source).matchAll(new RegExp(NAVY_NAME, "g"))].map(m => m[0]); }
/** The sky a clay story's night stage paints, as written in clayScene. */
export function deepNightSky(source: string): string {
  const line = source.split("\n").find(l => /^\s*deepNight:/.test(l));
  if (!line) throw new Error("clayScene has no deepNight sky");
  return line;
}
/** The pixel inks inside the Maker Desk's screen (DeskPixels' INK map). */
export function pixelInks(source: string): string {
  const start = source.indexOf("const INK"), end = source.indexOf("};", start);
  if (start < 0 || end < 0) throw new Error("DeskPixels has no INK map");
  return source.slice(start, end);
}
/** The canvas inks Bounce resolves (DeskBounce's PALETTE). */
export function bounceInks(source: string): string {
  const m = source.match(/const PALETTE = \[[^\]]*\]/);
  if (!m) throw new Error("DeskBounce has no PALETTE");
  return m[0];
}

const FILES = {
  calm: "CalmBuilder.tsx", puzzle: "PuzzlePlanet.tsx", sound: "SoundExplorer.tsx", css: "studioGames.css",
  clayCss: "makers/clayTheatre/clayTheatre.css", clayScene: "makers/clayTheatre/clayScene.ts",
  deskCss: "makers/makerDesk/makerDesk.css", deskPixels: "makers/makerDesk/DeskPixels.tsx", deskBounce: "makers/makerDesk/DeskBounce.tsx",
} as const;

beforeEach(() => { h.lang = "en"; });

describe.each(["en", "he"] as const)("B-KID-173 rendered (%s): the three menu games wear the Bop shell", lang => {
  beforeEach(() => { h.lang = lang; });
  const games = [["Calm Builder", CalmBuilder], ["Puzzle Planet", PuzzlePlanet], ["Sound Explorer", SoundExplorer]] as const;
  it.each(games)("%s: one kit shell, a pearl stage, no comic panel or placeholder", (_name, Game) => {
    const html = renderToStaticMarkup(<Game />);
    expect(html).toMatch(/<section class="studio-game adventure adventure--bop" data-kit-shell=""/);
    expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    expect(html).toMatch(/class="[^"]*\bbop-stage\b/);
    expect(comicFindings(html)).toEqual([]);
    expect(navyFindings(html)).toEqual([]);
  });
  it("Calm Builder: the tray is the kit's props; the room is a film plate under the stage; an empty place has no placeholder", () => {
    const html = renderToStaticMarkup(<CalmBuilder />);
    for (const stem of ["item-cushion", "item-journal", "item-lamp", "rest-rug", "flower-open"]) expect(html).toContain(`data-bop-sprite="${stem}"`);
    expect(html).toContain('src="/visuals/studio-v2/makers/kit-prop-planter-bud.webp"');
    expect(html).toMatch(/<img class="bop-scene studio-corner-room" src="\/visuals\/studio-v2\/film\/room-calm-480\.webp"/);
    expect(html).toContain('class="studio-corner-light"');
    // Six empty places, each only a pearl mark: no glyph inside.
    expect(html.match(/<button type="button" class="studio-corner-place"[^>]*data-filled="false"[^>]*><\/button>/g)).toHaveLength(6);
  });
  it("Puzzle Planet: empty spaces are pale pearl slots, no line icon", () => {
    const html = renderToStaticMarkup(<PuzzlePlanet />);
    expect(html).toMatch(/class="studio-puzzle-layout bop-stage"/);
    expect(html.match(/<button type="button" class="studio-puzzle-cell"[^>]*><\/button>/g)).toHaveLength(4);
  });
  it("Sound Explorer: the music room of the kit with Chock, the Studio's host", () => {
    const html = renderToStaticMarkup(<SoundExplorer />);
    expect(html).toContain('data-bop-scene="scene-band"');
    expect(html).toContain('data-bop-friend="chock"');
    expect(html).toContain('data-bop-sprite="chock-idle"');
  });
});

describe("B-KID-173 Calm Builder objects", () => {
  it("every object the kit has a prop for uses it; only the panda toy and the basket keep a glyph token", () => {
    const glyphs = CORNER_OBJECTS.filter(object => cornerObjectArt(object).kind === "glyph");
    expect(glyphs).toEqual(["panda", "basket"]);
  });
});

describe("B-KID-173 source: no comic shell or navy stage in the five games", () => {
  it.each(Object.entries(FILES))("%s has no comic shell", (_key, file) => {
    expect(comicFindings(read(file)), file).toEqual([]);
  });
  it("the menu games' sheet has no dashed placeholder slot", () => {
    expect(dashedSlots(read(FILES.css))).toEqual([]);
  });
  it.each([FILES.calm, FILES.puzzle, FILES.sound, FILES.css, FILES.clayCss, FILES.deskCss, FILES.deskPixels, FILES.deskBounce])("%s has no navy ink", file => {
    expect(navyFindings(read(file)), file).toEqual([]);
  });
  it("Clay Theatre's night stage is dimmed pearl felt, not a navy sky", () => {
    const sky = deepNightSky(read(FILES.clayScene));
    expect(navyNameFindings(sky)).toEqual([]);
    expect(sky).toMatch(/'steel'/);
    expect(read(FILES.clayCss)).toMatch(/\.ct-cell \{[^}]*background: color-mix\(in srgb, var\(--mk-snow\) 84%, var\(--mk-umber\)\)/);
  });
  it("Maker Desk: the lid, the screen inks and Bounce's lanterns are pearl", () => {
    expect(navyFindings(pixelInks(read(FILES.deskPixels)))).toEqual([]);
    expect(navyNameFindings(bounceInks(read(FILES.deskBounce)))).toEqual([]);
    const css = read(FILES.deskCss);
    expect(css).toMatch(/\.md-lid::before \{[^}]*var\(--studio-mist\)/);
    expect(css).toMatch(/\.md-lid\[data-screen=on\]::before \{[^}]*var\(--studio-surface\)/);
  });
  it("Calm Builder's Starlight dims the pearl room (graphite-soft over mist), never navy", () => {
    const css = strip(read(FILES.css));
    const night = css.split("\n").find(l => l.includes('[data-light="night"]'))!;
    expect(night).toMatch(/--studio-graphite-soft/);
    expect(night).toMatch(/--studio-mist/);
    expect(navyFindings(night)).toEqual([]);
  });
});

describe("B-KID-173 negative controls: the scans bite on the real source", () => {
  it("a comic line, a placeholder or the old panel put back into a real game file is caught", () => {
    expect(comicFindings(read(FILES.css).replace(".studio-game .studio-corner {", ".studio-game .studio-corner { border: var(--comic-line);"))).toEqual(["--comic-line"]);
    expect(comicFindings(read(FILES.calm).replace('data-kit-shell=""', 'data-kit-shell="" data-old="studio-game-panel"'))).toEqual(["studio-game-panel"]);
    expect(dashedSlots(read(FILES.css) + "\n.studio-corner-place { border: 2px dashed var(--studio-line); }")).toEqual(["border: 2px dashed"]);
    expect(comicFindings('<svg class="lucide lucide-plus"></svg>')).toEqual(["lucide-plus"]);
  });
  it("navy put back into the night stage, the desk's lid, its pixels or Bounce is caught", () => {
    const scene = read(FILES.clayScene);
    expect(navyNameFindings(deepNightSky(scene.replace("{ top: 'steel', low: 'chalk'", "{ top: 'night', low: 'indigo'")))).toEqual(["'night'", "'indigo'"]);
    expect(navyFindings(read(FILES.deskCss).replace("var(--studio-mist) 92%, transparent)", "var(--mk-night) 92%, transparent)"))).toEqual(["--mk-night"]);
    expect(navyFindings(pixelInks(read(FILES.deskPixels).replace("n: 'var(--mk-snow)'", "n: 'var(--mk-night)'")))).toEqual(["--mk-night"]);
    expect(navyNameFindings(bounceInks(read(FILES.deskBounce).replace("const PALETTE = ['slate',", "const PALETTE = ['indigo', 'slate',")))).toEqual(["'indigo'"]);
  });
});
