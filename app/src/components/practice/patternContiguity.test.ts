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


/* ═══════════════════════════════════════════════════════════════════════════
   F3 (round 2) — the compact world header must not collapse at 320.

   Round 1 gave the text column `min-w-0` so the action would never wrap. The
   rendered result was the opposite of a fix: at 320 the column got ~110 px and
   "What comes next? Tap the shape that finishes the pattern." rendered one word
   per line over eight lines, so the header ate ~520 px of a 700 px screen
   before the puzzle appeared. `min-w-[12rem]` restores a real minimum; the
   header already wraps, so the action drops to its own row instead — which is
   what Astra's accepted 11-candidate-pattern-390x700.jpg shows.

   Modelled here the way the fold and the glyph run are modelled: flex line
   breaking is deterministic given the item sizes, so the outcome is arithmetic,
   not a screenshot claim.
   ═══════════════════════════════════════════════════════════════════════════ */
const playkitSrc = readFileSync(path.join(here, "..", "ui", "playkit.tsx"), "utf8");
const playHeader = playkitSrc.slice(playkitSrc.indexOf("export function PlayHeader("), playkitSrc.indexOf("/** Sprout saying something inline"));

/** The cameo's rendered outer width: the HeroAvatar size plus the 2 px comic
 *  border `.play-hero-cameo` puts around it. */
const CAMEO_OUTER = (() => {
  const size = /<HeroAvatar size=\{(\d+)\}/.exec(playHeader);
  expect(size, "PlayHeader must render the cameo at a literal size").not.toBeNull();
  const border = /\.arbor-play \.play-hero-cameo \{[^}]*border:\s*(\d+)px/.exec(css);
  expect(border, ".play-hero-cameo must declare its border width").not.toBeNull();
  return Number(size![1]) + 2 * Number(border![1]);
})();

/** The read-aloud action, as the critic measured it on Hero Pose ("Hear it",
 *  66x44 — CRITIC-M1-round1.md E2). Its declared floor is 44 px; the wider
 *  measured value is the conservative one for a wrap question. */
const ACTION_PX = 66;

/** `min-w-[12rem]` (compact) / `min-w-[200px]` (entry), read from the source. */
function textMinPx(compact: boolean): number {
  const m = /compact \? "min-w-\[([^\]]+)\]" : "min-w-\[([^\]]+)\]"/.exec(playHeader);
  expect(m, "PlayHeader must declare a minimum width for its text column in BOTH variants").not.toBeNull();
  return lengthPx(compact ? m![1] : m![2], 0);
}

/** Header padding + gap at a viewport: index.css overrides both at <= 420. */
function headerBox(viewport: number): { padX: number; gap: number } {
  const narrow = /@media \(max-width: 420px\) \{\s*\.arbor-play \.play-scene-header \{ padding: \d+px (\d+)px; gap: (\d+)px; \}/.exec(css);
  expect(narrow, "the <=420 header override must exist").not.toBeNull();
  if (viewport <= 420) return { padX: Number(narrow![1]), gap: Number(narrow![2]) };
  const wide = /\.arbor-play \.play-scene-header--compact \{\s*padding: \d+px (\d+)px;/.exec(css);
  expect(wide, "the compact header must declare its padding").not.toBeNull();
  return { padX: Number(wide![1]), gap: 8 }; // gap-x-2
}

/** Flex line breaking for [cameo, text, action], then `flex-1` growth on the
 *  text column. Returns the text column's final width and the row count. */
function layoutCompactHeader(viewport: number, textMin: number): { textWidth: number; rows: number } {
  const { padX, gap } = headerBox(viewport);
  const inner = viewport - OVERLAY_PAD * 2 - padX * 2;
  const items = [CAMEO_OUTER, textMin, ACTION_PX];
  const rows: number[][] = [[]];
  let used = 0;
  for (const w of items) {
    const add = rows[rows.length - 1].length === 0 ? w : gap + w;
    if (used + add > inner && rows[rows.length - 1].length > 0) {
      rows.push([w]);
      used = w;
    } else {
      rows[rows.length - 1].push(w);
      used += add;
    }
  }
  const textRow = rows.find((r) => r.includes(textMin))!;
  const fixedOnRow = textRow.filter((w) => w !== textMin).reduce((a, b) => a + b, 0);
  const gaps = gap * (textRow.length - 1);
  return { textWidth: Math.max(textMin, inner - fixedOnRow - gaps), rows: rows.length };
}

describe("F3 — the compact header gives its instruction a readable column", () => {
  /** Below this a 14 px kid sentence starts breaking into one or two words a line. */
  const READABLE_MIN = 176;

  it("both variants declare a real minimum width (min-w-0 is what collapsed)", () => {
    expect(playHeader).not.toContain('compact ? "min-w-0"');
    expect(textMinPx(true)).toBeGreaterThanOrEqual(READABLE_MIN);
  });

  for (const viewport of WIDTHS) {
    it(`the instruction column is at least ${READABLE_MIN} px at ${viewport} px`, () => {
      const { textWidth } = layoutCompactHeader(viewport, textMinPx(true));
      expect(textWidth, `text column ${textWidth.toFixed(0)} px`).toBeGreaterThanOrEqual(READABLE_MIN);
    });

    it(`the header stays at most three rows at ${viewport} px`, () => {
      expect(layoutCompactHeader(viewport, textMinPx(true)).rows).toBeLessThanOrEqual(3);
    });
  }

  it("negative control — round 1's min-w-0 squeezed the column to about 110 px at 320", () => {
    const { padX, gap } = headerBox(320);
    const inner = 320 - OVERLAY_PAD * 2 - padX * 2;
    const collapsed = inner - CAMEO_OUTER - ACTION_PX - gap * 2;
    expect(collapsed).toBeLessThan(READABLE_MIN);
    expect(collapsed).toBeLessThan(layoutCompactHeader(320, textMinPx(true)).textWidth);
  });

  it("the read-aloud action keeps the 44 px floor, and answer tiles stay large", () => {
    const pattern = readFileSync(path.join(here, "PatternPowerWorld.tsx"), "utf8");
    expect(pattern).toContain("min-w-[44px] min-h-[44px]");
    expect(pattern).toContain("<ChoiceTile");
    const tile = playkitSrc.slice(playkitSrc.indexOf("export function ChoiceTile("), playkitSrc.indexOf("/** Chunky progress pips"));
    const min = /min-h-\[(\d+)px\]/.exec(tile);
    expect(min, "ChoiceTile must declare a minimum height").not.toBeNull();
    expect(Number(min![1])).toBeGreaterThanOrEqual(TOUCH_MIN);
  });

  it("one cameo size across all nine worlds — not per variant", () => {
    // 51 px on seven worlds, 75 px on Beat Keeper's arrival header (E2/E10).
    expect(playHeader).not.toMatch(/<HeroAvatar size=\{compact \?/);
    expect((playHeader.match(/<HeroAvatar size=\{\d+\}/g) ?? []).length).toBe(1);
  });
});
