/**
 * R10 — the sub-44 residues round 2 found on the rendered app.
 *
 * Four controls survived the item-9 sweep because none of them lives in the
 * files touchFloor.journalPlans / touchFloor.learnCare pin:
 *   · Today   — the play card's "Based on ASHA" citation link, 34×16 (a bare
 *               inline <a> inside a <p>, so it had no box of its own);
 *   · Behaviors — the filter Reset button, 16 px tall (an icon + label with no
 *               padding), and the week-group header button at 36;
 *   · Coach   — the "What the coach sees" disclosure, pinned at min-h-[36px];
 *   · Language — the vocab "ideas" chevron, min-h-[44px] but only 16 px WIDE.
 *
 * The last one is the lesson this file exists to hold: a 44 px floor is BOTH
 * axes. A height-only floor passes a height-only ratchet and still ships a
 * 16 px target.
 *
 * There is no jsdom in this repo, so this is a SOURCE ratchet like its two
 * siblings, not a rendered measurement. The rendered sweep stays the
 * orchestrator's.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

const FILES = {
  play: "components/overview/DailyPlayCard.tsx",
  behaviors: "components/tabs/BehaviorsTab.tsx",
  coach: "components/tabs/CoachTab.tsx",
  language: "components/tabs/LanguageLabVocabView.tsx",
  // B-SHELL-21: the shell-mounted post-capture strip (CTA was 36 px, dismiss 32).
  strip: "components/overview/PostCaptureCoachStrip.tsx",
} as const;

/** A 44 px HEIGHT floor, in any of the accepted forms (sibling ratchets' regex). */
const FLOOR = /min-h-11\b|min-h-\[4[4-9]px\]|min-h-\[5\d px\]|touch-target|var\(--touch-min\)|min-h-\[48px\]/;
/** A 44 px WIDTH floor — `.touch-target` sets min-width too, `min-h-*` does not. */
const WIDTH_FLOOR = /min-w-11\b|min-w-\[4[4-9]px\]|touch-target|var\(--touch-min\)/;

const CONTROLS: { id: string; file: keyof typeof FILES; near: string; width?: true }[] = [
  { id: "Today play-card citation link", file: "play", near: "{activity.source.org}", width: true },
  { id: "Behaviors filter reset", file: "behaviors", near: "onClick={resetFilters}" },
  { id: "Behaviors week-group header", file: "behaviors", near: "setCollapsedWeeks((p) =>" },
  { id: "Coach contract disclosure", file: "coach", near: 'data-testid="coach-contract-toggle"', width: true },
  { id: "Language vocab ideas chevron", file: "language", near: "setShowActivities((v) => !v)", width: true },
  { id: "Post-capture strip CTA", file: "strip", near: "onClick={acceptPostCaptureCoach}" },
  { id: "Post-capture strip dismiss", file: "strip", near: "onClick={dismissPostCaptureCoach}", width: true },
];

/** The className/style of the element containing `near` (sibling ratchets' helper). */
function shellAround(source: string, near: string): string {
  const at = source.indexOf(near);
  expect(at, `anchor not found: ${near}`).toBeGreaterThan(-1);
  const open = source.lastIndexOf("<", at);
  const close = source.indexOf(">", at);
  return source.slice(open, Math.max(close, at) + 500);
}

describe("touch floor · the R10 residues", () => {
  for (const c of CONTROLS) {
    it(`${c.id} declares a 44 px height floor`, () => {
      expect(shellAround(read(FILES[c.file]), c.near)).toMatch(FLOOR);
    });
    if (c.width) {
      it(`${c.id} declares a 44 px WIDTH floor too (it is icon-width at 390)`, () => {
        expect(shellAround(read(FILES[c.file]), c.near)).toMatch(WIDTH_FLOOR);
      });
    }
  }
});

describe("touch floor · the sub-44 shapes stay out of these files", () => {
  const RETIRED: [keyof typeof FILES, string][] = [
    // The citation was a bare inline <a> whose only styling was the underline.
    ["play", '            <a\n              href={activity.source.url}\n              target="_blank"\n              rel="noopener noreferrer"\n              style={{ color: "var(--arbor-muted)"'],
    ["behaviors", 'onClick={resetFilters} className="flex items-center gap-1"'],
    ["behaviors", 'className="w-full flex items-center justify-between text-[11px] font-bold rounded-lg px-3 py-2"'],
    ["coach", "min-h-[36px]"],
    ["language", 'className="inline-flex items-center gap-1 text-xs min-h-[44px]"'],
    ["strip", "min-h-9 flex-shrink-0"],
    ["strip", "flex h-8 w-8 flex-shrink-0"],
  ];

  for (const [file, shape] of RETIRED) {
    it(`${FILES[file]} no longer contains \`${shape.replace(/\n/g, "\n").slice(0, 60)}\``, () => {
      expect(read(FILES[file])).not.toContain(shape);
    });
  }

  it("NEGATIVE CONTROL: each pre-fix shape fails the floor it now has to pass", () => {
    // Height: the Coach disclosure and the Behaviors week header were both 36.
    const preFixCoach = 'className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-bold min-h-[36px] px-2 rounded-lg"';
    expect(preFixCoach).not.toMatch(FLOOR);
    const preFixWeek = 'className="w-full flex items-center justify-between text-[11px] font-bold rounded-lg px-3 py-2"';
    expect(preFixWeek).not.toMatch(FLOOR);
    // Width: the Language chevron PASSED a height-only ratchet at 16 px wide.
    const preFixChevron = 'className="inline-flex items-center gap-1 text-xs min-h-[44px]"';
    expect(preFixChevron).toMatch(FLOOR);
    expect(preFixChevron).not.toMatch(WIDTH_FLOOR);
    // …and each post-fix shell passes both.
    expect(shellAround(read(FILES.coach), 'data-testid="coach-contract-toggle"')).toMatch(FLOOR);
    expect(shellAround(read(FILES.behaviors), "setCollapsedWeeks((p) =>")).toMatch(FLOOR);
    expect(shellAround(read(FILES.language), "setShowActivities((v) => !v)")).toMatch(WIDTH_FLOOR);
  });

  it("the glyphs themselves did not grow — only the hit boxes", () => {
    expect(read(FILES.behaviors)).toContain('<Icon name="restart_alt" size={13} />');
    expect(read(FILES.coach)).toContain('<Icon name="shield" size={13} />');
    expect(read(FILES.language)).toContain('<Icon name="expand_more" size={16} />');
  });

  it("the icon-only Language chevron gained an accessible name with its box", () => {
    expect(shellAround(read(FILES.language), "setShowActivities((v) => !v)")).toContain("aria-label=");
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   R19 → B-SHELL-25 — the 44 px width floor stops being decoration.

   R19 found WHY `min-w-11` on the Language chevron still rendered 16 px wide:

     app/src/index.css   `.arbor-app button, .arbor-app a { min-width: 0 }`
                         — written after `@import "tailwindcss"`, UNLAYERED;
     tailwind            `.min-w-11 { min-width: calc(var(--spacing) * 11) }`
                         — emitted inside `@layer utilities`.

   Unlayered declarations beat every layered one, so `min-w-*` was inert on
   every <button> and <a>. R19 pinned the defect and allowed only
   `.touch-target`. B-SHELL-25 FIXES the cascade instead: the reset now sits in
   `@layer base`, below `@layer utilities` in the cascade, so `min-w-11` holds.
   `.touch-target` (unlayered, more specific) remains the recipe for icon-only
   controls. The "touch-target only" special case is deleted.

   There is no CSS engine in this node harness, so the cascade is modelled from
   the parsed source (layer order base < utilities < unlayered — the CSS
   Cascade Layers rule). The 320/390 rendered width sweep is the orchestrator's.
   ══════════════════════════════════════════════════════════════════════════ */

/** Which layer a selector's declaration lives in: the name of the enclosing
 *  `@layer x { … }` block, or "unlayered". */
function layerOf(css: string, needle: string): string {
  const at = css.indexOf(needle);
  expect(at, `selector not found: ${needle}`).toBeGreaterThan(-1);
  let depth = 0;
  let layer = "unlayered";
  const re = /@layer\s+([a-z-]+)\s*\{|\{|\}/g;
  const stack: string[] = [];
  for (let m = re.exec(css); m && m.index < at; m = re.exec(css)) {
    if (m[1]) { stack.push(m[1]); depth += 1; }
    else if (m[0] === "{") stack.push("");
    else stack.pop();
  }
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i]) { layer = stack[i]; break; }
  void depth;
  return layer;
}

/** CSS Cascade Layers: later-declared layers win; unlayered beats all layers. */
const LAYER_RANK: Record<string, number> = { theme: 0, base: 1, components: 2, utilities: 3, unlayered: 9 };

describe("B-SHELL-25 · the min-width reset is layered, so min-w-* utilities win", () => {
  const CSS = readFileSync(path.join(SRC, "index.css"), "utf8").replace(/\r\n/g, "\n");
  const RESET = ".arbor-app a { min-width: 0; }";

  it("the reset sits inside @layer base (CSS-order test)", () => {
    expect(CSS).toContain(RESET);
    expect(layerOf(CSS, RESET)).toBe("base");
    // …and nowhere unlayered.
    expect(CSS.split(RESET).length - 1).toBe(1);
  });

  it("a button.min-w-11 now computes min-width 44 px: utilities outrank base", () => {
    // tailwind emits `.min-w-11` in @layer utilities; the reset is in @layer base.
    expect(LAYER_RANK.utilities).toBeGreaterThan(LAYER_RANK[layerOf(CSS, RESET)]);
    // 11 × the 4 px spacing unit = 44 px.
    expect(11 * 4).toBe(44);
  });

  it("NEGATIVE CONTROL: the pre-fix unlayered reset beats the utility", () => {
    const preFix = '@import "tailwindcss";\n.arbor-app button,\n.arbor-app a { min-width: 0; }\n';
    expect(layerOf(preFix, RESET)).toBe("unlayered");
    expect(LAYER_RANK.unlayered).toBeGreaterThan(LAYER_RANK.utilities);
  });

  it("`.touch-target` is kept: unlayered, sets min-width to the touch floor", () => {
    expect(CSS).toContain(".arbor-app .touch-target {");
    expect(layerOf(CSS, ".arbor-app .touch-target {")).toBe("unlayered");
    const at = CSS.indexOf(".arbor-app .touch-target {");
    expect(CSS.slice(at, at + 220)).toContain("min-width:  var(--touch-min)");
  });

  it("the icon-only controls R19 fixed keep their touch-target width floor", () => {
    expect(read(FILES.language)).toContain('className="touch-target gap-1 text-xs"');
    expect(shellAround(read(FILES.play), "{activity.source.org}")).toMatch(/touch-target|minWidth|min-width/);
  });

  it("the glyph did not grow with the box", () => {
    expect(read(FILES.language)).toContain('<Icon name="expand_more" size={16} />');
    expect(read(FILES.language)).toContain('<Icon name="expand_less" size={16} />');
  });
});

describe("B-SHELL-21 · the post-capture strip still clears MobileNav", () => {
  it("the strip keeps its bottom-20 offset above the bar", () => {
    expect(read(FILES.strip)).toMatch(/bottom-20/);
  });
});
