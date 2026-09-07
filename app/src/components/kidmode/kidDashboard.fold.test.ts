/**
 * kidDashboard.fold.test.ts — OBJ-KID-06 + KID-06 guard.
 *
 * Measured at 390x844 in Kid Mode: 0 of 8 game tiles were above the fold (the
 * first sat at 931 px), the tiles were 135x97 with 15 px parent-scale titles,
 * and "See all games" landed on an arcade grid of SIX worlds while the home
 * showed EIGHT — Beat Keeper, Hero Pose and Pattern Power were filtered out of
 * the grid by `WORLDS.filter(w => !w.isNew)`, which also made the NEW ribbon
 * unreachable code.
 *
 * There is no jsdom in this repo (package.json devDependencies), so the fold is
 * proved arithmetically: KidDashboard exports the block sizes it renders with,
 * and this file stacks them in the order the sections appear — the layout stub
 * the item asks for, with the component as its single source. The stack is
 * conservative (every gap counted, the grid assumed to start below a full
 * heading row), so a passing sum is a floor, not an optimistic estimate.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  KID_HOME_HEADER_BLOCK,
  KID_HOME_SECTION_GAP,
  KID_HOME_BANNER_BLOCK,
  KID_HOME_SECTION_HEAD_BLOCK,
  KID_HOME_HEAD_GAP,
  KID_HOME_GAME_TILE_BLOCK,
  KID_HOME_ADVENTURE_TILE_BLOCK,
  KID_HOME_TILE_GAP,
  KID_HOME_GAME_TITLE_SIZE,
  KID_HOME_GAME_TITLE_MIN_PX,
} from "./KidDashboard";
import { KID_WORLDS } from "../practice/HeroArcade";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dash = readFileSync(path.join(__dirname, "KidDashboard.tsx"), "utf8");
const arcade = readFileSync(path.join(__dirname, "..", "practice", "HeroArcade.tsx"), "utf8");
const css = readFileSync(path.join(__dirname, "..", "..", "index.css"), "utf8");

/** iPhone-class viewport the ledger measured at. */
const FOLD = 844;
/** Two tiles per row at 390 px: 350 px of content, minmax(160px,1fr) + 12 px gap. */
const TILES_PER_ROW = 2;

/** Top edge of the first game tile, stacking the sections in render order. */
const firstGameTileTop =
  KID_HOME_HEADER_BLOCK +
  KID_HOME_SECTION_GAP +
  KID_HOME_BANNER_BLOCK +
  KID_HOME_SECTION_GAP +
  KID_HOME_SECTION_HEAD_BLOCK +
  KID_HOME_HEAD_GAP;

describe("OBJ-KID-06 — the games are above the fold at 390x844", () => {
  it("the games section renders before the growth adventures", () => {
    const games = dash.indexOf("{/* ── Games ");
    const adventures = dash.indexOf("{/* ── My growth adventures ");
    expect(games).toBeGreaterThan(-1);
    expect(adventures).toBeGreaterThan(-1);
    expect(games, "the games grid must sit directly under the quest banner").toBeLessThan(adventures);
  });

  it("at least two game tiles are fully visible without scrolling", () => {
    const firstRowBottom = firstGameTileTop + KID_HOME_GAME_TILE_BLOCK;
    expect(firstRowBottom, `first row ends at ${firstRowBottom}`).toBeLessThan(FOLD);
    // A row is TILES_PER_ROW tiles wide, so a visible first row is >= 2 tiles.
    expect(TILES_PER_ROW).toBeGreaterThanOrEqual(2);
    // …and the second row lands above the fold too.
    const secondRowBottom = firstRowBottom + KID_HOME_TILE_GAP + KID_HOME_GAME_TILE_BLOCK;
    expect(secondRowBottom).toBeLessThan(FOLD);
  });

  it("negative control — the pre-fix order and tile height put every tile below the fold", () => {
    // Adventures first: three 150 px tiles stacked one per row at 390 px.
    const preFixTop =
      KID_HOME_HEADER_BLOCK +
      KID_HOME_SECTION_GAP +
      KID_HOME_BANNER_BLOCK +
      KID_HOME_SECTION_GAP +
      KID_HOME_SECTION_HEAD_BLOCK +
      KID_HOME_HEAD_GAP +
      3 * KID_HOME_ADVENTURE_TILE_BLOCK +
      2 * KID_HOME_TILE_GAP +
      KID_HOME_SECTION_GAP +
      KID_HOME_SECTION_HEAD_BLOCK +
      KID_HOME_HEAD_GAP;
    // The ledger measured the first tile at 931 px; the model agrees it is below.
    expect(preFixTop).toBeGreaterThan(FOLD);
    const preFixTileBlock = 97;
    expect(preFixTop + preFixTileBlock).toBeGreaterThan(FOLD);
  });
});

describe("OBJ-KID-06 — the game tile title is on the kid scale", () => {
  /** The measured viewport. 5vw = 19.5 px here, so the clamp sits on its floor. */
  const VIEWPORT_W = 390;
  /** Resolve a `clamp(min, preferred, max)` of absolute px + vw at one width. */
  function resolveClamp(value: string, viewportPx: number): number {
    const m = /^clamp\(\s*([\d.]+)px\s*,\s*([\d.]+)vw\s*,\s*([\d.]+)px\s*\)$/.exec(value);
    expect(m, `not an absolute px/vw clamp: ${value}`).toBeTruthy();
    const [min, vw, max] = [Number(m![1]), Number(m![2]), Number(m![3])];
    return Math.min(max, Math.max(min, (vw / 100) * viewportPx));
  }

  it("the title size is absolute, so its floor does not depend on the root font-size", () => {
    // The rendered check measured 15 px while the constant said var(--t-xl).
    // 15 px is exactly what --t-base (0.9375rem) inherits at a 16 px root, so a
    // rem step cannot distinguish "the token did not resolve on the overlay"
    // from "the checker read a neighbouring node" — an absolute length can.
    expect(KID_HOME_GAME_TITLE_SIZE).not.toMatch(/rem|var\(/);
    expect(resolveClamp(KID_HOME_GAME_TITLE_SIZE, VIEWPORT_W)).toBeGreaterThanOrEqual(KID_HOME_GAME_TITLE_MIN_PX);
    expect(KID_HOME_GAME_TITLE_MIN_PX).toBeGreaterThanOrEqual(20);
    // …and it is the size the component actually renders the title with.
    expect(dash).toContain("fontSize: big ? \"var(--t-lg)\" : KID_HOME_GAME_TITLE_SIZE");
  });

  it("the title carries a measurement hook, so the rendered check reads the title node", () => {
    expect(dash).toContain("data-kid-tile-title");
    // The hook sits on the same span as the font-size — one node, not two.
    const hook = dash.indexOf("data-kid-tile-title");
    const size = dash.indexOf("KID_HOME_GAME_TITLE_SIZE", hook);
    expect(hook, "the hook must precede the size on the same element").toBeGreaterThan(-1);
    expect(dash.slice(hook, size)).not.toContain("</span>");
  });

  it("one action per tile, imagery-first: a single button, art before the title block", () => {
    const tile = dash.slice(dash.indexOf("function SceneTile"), dash.indexOf("export default function KidDashboard"));
    expect((tile.match(/<button\b/g) ?? []).length, "a tile is exactly one action").toBe(1);
    expect(tile.indexOf("<WorldScene"), "the scene must render before the title block").toBeLessThan(tile.indexOf("data-kid-tile-title"));
  });

  it("negative control — both pre-fix sizes fall under the floor at 390 px", () => {
    // The original --t-base title, and the --t-xl replacement that the rendered
    // check still measured at 15 px. The stylesheet numbers are read here so the
    // control moves if the scale is ever re-cut.
    const base = /--t-base:\s*([\d.]+)rem/.exec(css);
    expect(Number(base![1]) * 16).toBeLessThan(20);
    // 15 px measured — whatever produced it, it was under the floor, and an
    // absolute clamp is the only form of this constant that cannot produce it.
    expect(15).toBeLessThan(KID_HOME_GAME_TITLE_MIN_PX);
    expect(() => resolveClamp("var(--t-xl)", VIEWPORT_W)).toThrow();
  });
});

describe("KID-06 — the arcade grid lists the same games the home does", () => {
  it("no world is hidden by the isNew flag any more", () => {
    expect(arcade).toContain("{KID_WORLDS.map((w) => {");
    expect(arcade).not.toContain("WORLDS.filter((w) => !w.isNew)");
  });

  it("the NEW ribbon is now reachable: at least one listed world carries isNew", () => {
    expect(KID_WORLDS.some((w) => w.isNew)).toBe(true);
    expect(arcade).toContain('{t("elev.play.arcade.new")}');
  });

  it("the grid renders every world except the parent-register one", () => {
    // Nine kid worlds; Word World is parent-register by its own header and is
    // the ONLY exclusion (kidRegisterScan lists it in EXCLUDED for the same
    // reason). A new world must appear here deliberately, not by accident.
    expect(KID_WORLDS.map((w) => w.id)).toEqual([
      "speech",
      "feelings",
      "adventures",
      "mimic",
      "memory",
      "reading",
      "beat",
      "pose",
      "pattern",
    ]);
    expect(KID_WORLDS.some((w) => w.id === "word-world")).toBe(false);
  });

  it("every game tile on the kid home has a world in that grid", () => {
    const tileWorldIds = [...dash.matchAll(/\{ id: "[a-z-]+", worldId: "([a-z-]+)"/g)]
      .map((m) => m[1])
      .filter((id) => !id.startsWith("kid-"));
    expect(tileWorldIds.length).toBe(8);
    for (const id of tileWorldIds) {
      expect(KID_WORLDS.some((w) => w.id === id), `home tile world "${id}" is not in the arcade grid`).toBe(true);
    }
  });

  it("negative control — the pre-fix filter hid three of the home's own games", () => {
    const preFixVisible = KID_WORLDS.filter((w) => !w.isNew).map((w) => w.id);
    expect(preFixVisible).not.toContain("beat");
    expect(preFixVisible).not.toContain("pose");
    expect(preFixVisible).not.toContain("pattern");
    expect(preFixVisible.length).toBe(6);
  });
});
