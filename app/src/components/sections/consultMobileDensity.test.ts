/**
 * R14 (LC-28) — the #/consult column above "Your summary" at 390.
 *
 * Round 2b measured the packet heading at 1,440 px on a 390 px viewport: a
 * hub hero, then a section header that said the hub's eyebrow a second time,
 * then the reason box, then three full-height data-contract tiles stacked one
 * per row — all before the parent reached the summary they came for.
 *
 * Three compressions, all `<md` only, none of them removing a capability:
 *   · the hero tightens its padding/margin and drops its GENERIC sub (the
 *     child-specific sub in the section header is the one kept);
 *   · the section header's duplicate eyebrow stands down;
 *   · the three contract tiles fold into ONE disclosure line that opens to
 *     the same three tiles — the md+ three-column row is untouched.
 *
 * There is no jsdom in this repo, so this is a SOURCE guard: it pins the
 * breakpoint classes and the disclosure structure. The rendered "< 900 px"
 * measurement stays the orchestrator's.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

const ASK = read("components/sections/AskSpecialist.tsx");
const CONSULT = read("components/tabs/ConsultTab.tsx");

describe("R14 · the contract tiles fold into a disclosure below md", () => {
  it("the three promises are declared ONCE and reused by both renders", () => {
    expect(ASK).toContain("const CONTRACT_TILES = [");
    // Three reads of the one list: the disclosure, the md+ row, and the
    // one-line label — and nothing else re-declares the promises.
    expect((ASK.match(/CONTRACT_TILES\.map\(/g) ?? []).length).toBe(3);
    expect((ASK.match(/CONTRACT_TILES\.map\(\(item\) => \(/g) ?? []).length).toBe(2);
    // …plus the one-line label, built from the same titles.
    expect(ASK).toContain('CONTRACT_TILES.map((item) => item.title).join(" · ")');
  });

  it("below md the tiles are behind a disclosure, and only below md", () => {
    expect(ASK).toContain('<details className="md:hidden rounded-[18px]"');
    expect(ASK).toContain('data-testid="consult-contract-summary"');
    expect(ASK).toContain('<div className="hidden md:grid md:grid-cols-3 gap-3">');
  });

  it("the disclosure control clears the 44 px floor", () => {
    const at = ASK.indexOf('data-testid="consult-contract-summary"');
    expect(at).toBeGreaterThan(-1);
    expect(ASK.slice(at, at + 320)).toMatch(/touch-target|min-h-11|min-h-\[4[4-9]px\]/);
  });

  it("every tile stays reachable at every width (law 6)", () => {
    // Nothing is dropped from the DOM: the disclosure holds the full bodies,
    // not a truncated summary of them.
    for (const key of ["consult.contract.reviewBody", "consult.contract.controlBody", "consult.contract.shareBody"]) {
      expect(ASK).toContain(key);
    }
    expect(ASK).not.toContain('<section className="grid grid-cols-1 sm:grid-cols-3 gap-3">');
  });
});

describe("R14 · the duplicated header copy stands down below md", () => {
  it("the section eyebrow is md-and-up only; the h2 and the child sub are not", () => {
    expect(ASK).toContain('<span className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-bold"');
    expect(ASK).toContain('{t("consult.title")}');
    expect(ASK).toContain('<p className="text-sm mt-1.5 leading-relaxed"');
    // The section title is still an h2, not a second h1 (CR-21 / OBJ-CARE-02):
    // the only "<h1" left in this file is the comment that records the fix.
    expect((ASK.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    expect(ASK).toContain("this was a second <h1> on the route");
  });

  it("the hero gives back what it can without editing the shared primitive", () => {
    expect(CONSULT).toContain('className="max-md:p-4 max-md:mb-3 max-md:[&_p]:hidden"');
    // This hub passes no stats on purpose, so there was never a trio to drop.
    expect(CONSULT).not.toContain("stats={");
  });
});

describe("R14 · NEGATIVE CONTROL — the pre-fix shapes are what this rejects", () => {
  it("the pre-fix tile row had no breakpoint of its own", () => {
    const preFix = '<section className="grid grid-cols-1 sm:grid-cols-3 gap-3">';
    // One column at 390, three full tiles stacked, on every width below sm.
    expect(preFix).not.toContain("md:hidden");
    expect(preFix).not.toContain("details");
    expect(ASK).not.toContain(preFix);
  });

  it("the pre-fix header printed the hub eyebrow at every width", () => {
    const preFix = '<span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>';
    expect(preFix).not.toContain("hidden md:");
    expect(ASK).not.toContain(preFix);
  });

  it("the pre-fix hero carried no width-scoped class at all", () => {
    expect(CONSULT).not.toContain("<HubHero\n        zeroLine=");
  });
});
