/**
 * patternContiguity.test.ts — M1 / Astra U2 guard.
 *
 * "The shown symbols plus the blank stay contiguous at 320 and 390 px,
 * including five-symbol puzzles." There is no jsdom in this repo, so — exactly
 * like kidDashboard.fold.test.ts proves the fold — the row is proved
 * ARITHMETICALLY from the declarations the component actually renders with:
 * this file reads the three `.pattern-sequence*` rules out of index.css,
 * evaluates their clamps at the two phone widths, and stacks them against the
 * content width KidModeOverlay gives a world.
 *
 * The reason the arithmetic is possible at all is the `inline-size: 1.3em` box
 * added with this guard. Before it, a glyph was a bare text span whose width
 * was whatever advance the platform emoji font chose (1.0em-1.4em in the wild),
 * so "it fits" could only ever be a screenshot claim on one machine. Now the
 * row width is closed-form and a regression in any of the three clamps fails
 * here instead of clipping on a 320 px phone.
 *
 * What this does NOT claim: a rendered verdict. Zoom, RTL ordering and the
 * answer tiles stay browser evidence.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PATTERN_PUZZLES } from "../../practice/newGames";

const here = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(here, "..", "..", "index.css"), "utf8");
const overlay = readFileSync(path.join(here, "..", "kidmode", "KidModeOverlay.tsx"), "utf8");

/** Root font size the clamps' rem values resolve against (browser default; the
 *  product never re-pins it — see KID_HOME_GAME_TITLE_SIZE's note). */
const ROOT_PX = 16;
/** Phone widths Astra's check names. */
const WIDTHS = [320, 390] as const;
/** The 44 px touch floor — the missing slot must never fall under it. */
const TOUCH_MIN = 44;

/** The single rule body for a selector, e.g. `.arbor-play .pattern-sequence {…}`. */
function ruleBody(selector: string): string {
  const needle = `${selector} {`;
  const at = css.indexOf(needle);
  expect(at, `${selector} must exist in index.css`).toBeGreaterThan(-1);
  const close = css.indexOf("}", at);
  return css.slice(at + needle.length, close);
}

function declaration(selector: string, prop: string): string {
  const body = ruleBody(selector);
  const m = new RegExp(`(?:^|;|\\n)\\s*${prop}\\s*:\\s*([^;]+);`).exec(body);
  expect(m, `${selector} must declare ${prop}`).not.toBeNull();
  return m![1].trim();
}

/** px value of a single CSS length at a given viewport width. `em` is resolved
 *  against the caller-supplied font size (the glyph box is 1.3em of its OWN
 *  font-size, which is the only em in these rules). */
function lengthPx(value: string, viewport: number, emBasis = ROOT_PX): number {
  const m = /^(-?[\d.]+)(px|rem|vw|em)$/.exec(value.trim());
  expect(m, `unsupported length "${value}"`).not.toBeNull();
  const n = Number(m![1]);
  switch (m![2]) {
    case "px": return n;
    case "rem": return n * ROOT_PX;
    case "em": return n * emBasis;
    default: return (n * viewport) / 100;
  }
}

/** Evaluate `clamp(a, b, c)` (or a plain length) at a viewport width. */
function evaluate(value: string, viewport: number, emBasis = ROOT_PX): number {
  const clamp = /^clamp\(([^,]+),([^,]+),([^)]+)\)$/.exec(value.trim());
  if (!clamp) return lengthPx(value, viewport, emBasis);
  const [min, preferred, max] = clamp.slice(1, 4).map((v) => lengthPx(v, viewport, emBasis));
  return Math.min(Math.max(preferred, min), max);
}

/** Widest puzzle in the live bank — the case the guard is actually about. */
const MAX_SHOWN = Math.max(...PATTERN_PUZZLES.map((p) => p.shown.length));

/** Content width a world gets: the viewport minus KidModeOverlay's scroller
 *  padding, read from the overlay rather than hard-coded. */
const OVERLAY_PAD = (() => {
  const m = /paddingInline:\s*"(\d+)px",\s*\n\s*paddingBlock:\s*"24px"/.exec(overlay);
  expect(m, "KidModeOverlay's content scroller must declare its inline padding").not.toBeNull();
  return Number(m![1]);
})();

function rowWidth(viewport: number): { total: number; glyphBox: number; missing: number; gap: number } {
  const fontSize = evaluate(declaration(".arbor-play .pattern-sequence-glyph", "font-size"), viewport);
  const glyphBox = evaluate(declaration(".arbor-play .pattern-sequence-glyph", "inline-size"), viewport, fontSize);
  const missing = evaluate(declaration(".arbor-play .pattern-sequence-missing", "inline-size"), viewport);
  const gap = evaluate(declaration(".arbor-play .pattern-sequence", "gap"), viewport);
  // shown glyphs + the blank, with one gap between every pair of items.
  const total = MAX_SHOWN * glyphBox + missing + MAX_SHOWN * gap;
  return { total, glyphBox, missing, gap };
}

describe("U2 — the pattern run stays contiguous on a phone", () => {
  it("the bank's widest puzzle shows five symbols", () => {
    expect(MAX_SHOWN).toBe(5);
  });

  it("the row never wraps", () => {
    expect(declaration(".arbor-play .pattern-sequence", "flex-wrap")).toBe("nowrap");
  });

  it("each glyph has a deterministic box, so the row width is not a font metric", () => {
    // Without this, the glyph is a bare text span and every number below is a
    // guess about the platform emoji font.
    expect(declaration(".arbor-play .pattern-sequence-glyph", "inline-size")).toMatch(/em$/);
  });

  for (const viewport of WIDTHS) {
    it(`five shown symbols + the blank fit in one row at ${viewport} px`, () => {
      const content = viewport - OVERLAY_PAD * 2;
      const { total } = rowWidth(viewport);
      expect(total, `row ${total.toFixed(1)} px in ${content} px of content`).toBeLessThanOrEqual(content);
    });

    it(`the missing slot keeps the ${TOUCH_MIN} px floor at ${viewport} px`, () => {
      // Not a touch target (the answer tiles are), but it is the blank the child
      // has to read — it must not shrink below the same floor the kit uses.
      expect(rowWidth(viewport).missing).toBeGreaterThanOrEqual(TOUCH_MIN);
    });

    it(`glyphs stay legibly large at ${viewport} px`, () => {
      // Astra: "Do not shrink body copy to gain space." 24 px is the kid floor.
      const fontSize = evaluate(declaration(".arbor-play .pattern-sequence-glyph", "font-size"), viewport);
      expect(fontSize).toBeGreaterThanOrEqual(24);
    });
  }

  it("negative control — the pre-guard bare span overflows 320 px when the font is wide", () => {
    // A 1.4em advance is inside the range real emoji fonts use; with no box the
    // row was that wide and nothing in the repo could see it.
    const viewport = 320;
    const fontSize = evaluate(declaration(".arbor-play .pattern-sequence-glyph", "font-size"), viewport);
    const { missing, gap } = rowWidth(viewport);
    const unboxed = MAX_SHOWN * (fontSize * 1.4) + missing + MAX_SHOWN * gap;
    expect(unboxed).toBeGreaterThan(rowWidth(viewport).total);
  });
});

/* The other half of U2: "the compact header also allocates an entire wrapped
   row to 'Hear it'." The compact variant fixed that by giving the title column
   `min-w-0` (flex-basis 0, free to shrink), so the three items — cameo, title,
   read-aloud — always resolve onto one line and the action never wraps. That is
   a one-word property and the row comes straight back if it is dropped. */
describe("U2 — the compact world header keeps its read-aloud on the title row", () => {
  const playkit = readFileSync(path.join(here, "..", "ui", "playkit.tsx"), "utf8");
  const header = playkit.slice(playkit.indexOf("export function PlayHeader("), playkit.indexOf("/** Sprout saying something inline"));

  it("the compact title column can shrink to zero, so nothing is pushed to a second row", () => {
    expect(header).toContain('compact ? "min-w-0" : "min-w-[200px]"');
  });

  it("the read-aloud action keeps the 44 px floor", () => {
    const pattern = readFileSync(path.join(here, "PatternPowerWorld.tsx"), "utf8");
    expect(pattern).toContain('min-w-[44px] min-h-[44px]');
  });

  it("answer controls stay far above the 44 px floor — glyphs are not targets", () => {
    // Astra: "Keep answer controls large; sequence glyphs are not interactive
    // targets." The tiles are ChoiceTile, which carries its own floor.
    const pattern = readFileSync(path.join(here, "PatternPowerWorld.tsx"), "utf8");
    expect(pattern).toContain("<ChoiceTile");
    const tile = playkit.slice(playkit.indexOf("export function ChoiceTile("), playkit.indexOf("/** Chunky progress pips"));
    const min = /min-h-\[(\d+)px\]/.exec(tile);
    expect(min, "ChoiceTile must declare a minimum height").not.toBeNull();
    expect(Number(min![1])).toBeGreaterThanOrEqual(TOUCH_MIN);
    // The glyph row is decorative reading material, not a control.
    expect(declaration(".arbor-play .pattern-sequence-glyph", "flex")).toBe("0 0 auto");
  });
});
