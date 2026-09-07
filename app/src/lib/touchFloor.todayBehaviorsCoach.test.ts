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
   R19 — why the Language chevron measured 16 px WIDE a second time.

   R10 gave it `min-w-11`. Round 2c re-measured `#/language` and read 16 px
   again. The class was never the problem; the CASCADE was:

     app/src/index.css   `.arbor-app button, .arbor-app a { min-width: 0 }`
                         — written after `@import "tailwindcss"`, so UNLAYERED;
     tailwind            `.min-w-11 { min-width: calc(var(--spacing) * 11) }`
                         — emitted inside `@layer utilities`.

   Unlayered declarations beat every layered one regardless of specificity, so
   `min-width: 0` wins on EVERY <button> and <a> in the app. `min-w-*` is inert
   there. `.touch-target` is unlayered too and more specific than the reset
   (`.arbor-app .touch-target` = 0,2,0 vs `.arbor-app button` = 0,1,1), so it is
   the one width floor that survives — which is why DESIGN.md's floor recipe is
   a class and not a utility pair.

   Height is unaffected: nothing resets `min-height`, so `min-h-11` still holds.
   ══════════════════════════════════════════════════════════════════════════ */

/** A width floor that SURVIVES the unlayered button/anchor reset. */
const CASCADE_SAFE_WIDTH = /touch-target|minWidth|min-width/;

/** Icon-only controls: no label text to hold the box open, so the declared
 *  width floor is the whole hit box. `min-w-*` does not count here. */
const ICON_ONLY: { id: string; file: keyof typeof FILES; near: string }[] = [
  { id: "Language vocab ideas chevron", file: "language", near: "setShowActivities((v) => !v)" },
  { id: "Today play-card citation link", file: "play", near: "{activity.source.org}" },
];

describe("R19 · an icon-only control needs a width floor the cascade cannot erase", () => {
  const CSS = readFileSync(path.join(SRC, "index.css"), "utf8");

  it("the reset that erases every `min-w-*` on a button or anchor is still there", () => {
    // If this rule is ever deleted, the rule below can be relaxed — but until
    // then a `min-w-11` on a button is decoration, not a hit box.
    expect(CSS.replace(/\s+/g, " ")).toContain(".arbor-app button, .arbor-app a { min-width: 0; }");
    // …and it is written AFTER the tailwind import, i.e. unlayered.
    expect(CSS.indexOf('@import "tailwindcss"')).toBeLessThan(CSS.indexOf(".arbor-app a { min-width: 0; }"));
  });

  it("`.touch-target` is the recipe that outranks it (unlayered + more specific)", () => {
    expect(CSS).toContain(".arbor-app .touch-target {");
    const at = CSS.indexOf(".arbor-app .touch-target {");
    expect(CSS.slice(at, at + 220)).toContain("min-width:  var(--touch-min)");
  });

  for (const c of ICON_ONLY) {
    it(`${c.id} uses that recipe, not a min-w utility`, () => {
      const shell = shellAround(read(FILES[c.file]), c.near);
      expect(shell).toMatch(CASCADE_SAFE_WIDTH);
      // The className itself no longer leans on the inert utility.
      const cls = shell.match(/className="([^"]*)"/)?.[1] ?? "";
      expect(cls, `${c.id} className`).not.toMatch(/min-w-/);
    });
  }

  it("NEGATIVE CONTROL: the R10 shape passes the old width regex and fails this one", () => {
    const r10 = 'className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 text-xs"';
    expect(r10).toMatch(WIDTH_FLOOR);          // why round 2c believed it was fixed
    const cls = r10.match(/className="([^"]*)"/)?.[1] ?? "";
    expect(cls).toMatch(/min-w-/);             // …and why it still rendered at 16 px
    expect(cls.includes("touch-target")).toBe(false);
    // The shipped shape is the inverse on both counts.
    const now = read(FILES.language);
    expect(now).not.toContain(r10);
    expect(now).toContain('className="touch-target gap-1 text-xs"');
  });

  it("the glyph did not grow with the box", () => {
    expect(read(FILES.language)).toContain('<Icon name="expand_more" size={16} />');
    expect(read(FILES.language)).toContain('<Icon name="expand_less" size={16} />');
  });
});
