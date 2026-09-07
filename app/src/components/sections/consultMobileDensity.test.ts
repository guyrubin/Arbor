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

/* ══════════════════════════════════════════════════════════════════════════
   R18 — the R14 residue. Round 2c re-measured "Your summary" at 1,014 px on a
   390 px viewport; the target is < 900.

   What was still above it, in order: the hub hero, the section header, a
   ~190 px reason composer (a label, a two-line hint, an empty textarea and a
   "you have not written one yet" line), and the folded contract disclosure.
   Two of those four blocks are not what the parent opened `#/consult` to see:
   the composer ASKS for input, and the contract REASSURES about input already
   given. The summary is the read they came for.

   So under md the column is reordered, not shortened: the composer and the
   contract disclosure render after the summary, and the sticky export bar
   takes the last order so it still ends the column (and so the parent still
   meets the reason before Copy / Download / Send). Nothing is hidden,
   nothing is collapsed, no capability moves (law 6), and the DOM order — which
   is what the heading outline and a screen reader follow — is untouched.

   `space-y-5` had to become `gap-5` for this: Tailwind's space-y is a margin
   on `:not(:last-child)`, keyed to DOM order, so the reordered blocks would
   have butted against the export bar. Flex `gap` is keyed to visual order.

   SOURCE guard (no jsdom in this repo). The rendered "< 900 px" measurement
   stays the orchestrator's.
   ══════════════════════════════════════════════════════════════════════════ */
describe("R18 · under md the summary comes before the blocks that are not it", () => {
  it("the column is a flex column whose gap survives reordering", () => {
    expect(ASK).toContain('className="flex flex-col gap-5 max-w-[1180px]"');
    // space-y would have keyed the gaps to DOM order and collapsed one of them.
    expect(ASK).not.toContain('className="space-y-5 max-w-[1180px]"');
  });

  it("the reason composer and the contract disclosure take an order below md", () => {
    expect(ASK).toContain('data-testid="consult-reason-section" className="max-md:order-2');
    expect(ASK).toContain('data-testid="consult-contract" className="max-md:order-3"');
  });

  it("the sticky export bar still ends the column, so the reason precedes the verbs", () => {
    expect(ASK).toContain('className="sticky bottom-2 max-md:order-4 rounded-2xl p-4 flex flex-col gap-3"');
    // The required first step of the bar is unmoved and still the CTA's target.
    expect(ASK).toContain('id="consult-audience-row"');
    expect(CONSULT).toContain('document.getElementById("consult-audience-row")');
  });

  it("the summary card takes no order at all — it is what the default order is for", () => {
    const at = ASK.indexOf('{t("care.packet.title")}');
    expect(at).toBeGreaterThan(-1);
    const card = ASK.slice(ASK.lastIndexOf("<section", at), at);
    expect(card).not.toContain("order-");
  });

  it("nothing was removed to buy the height (law 6)", () => {
    // The composer, its hint, its missing-line nudge and the three contract
    // promises are all still rendered — they moved, they did not go.
    for (const key of [
      "elev.learnCare.reason.label",
      "elev.learnCare.reason.hint",
      "elev.learnCare.reason.placeholder",
      "elev.learnCare.reason.missing",
      "consult.contract.reviewBody",
      "consult.contract.controlBody",
      "consult.contract.shareBody",
    ]) {
      expect(ASK, key).toContain(key);
    }
    expect(ASK).toContain('id="consult-reason"');
    expect(ASK).toContain('data-testid="consult-reason-input"');
  });

  it("the DOM order — the heading outline and the reading order — is unchanged", () => {
    const order = ["consult-section-header", "consult-reason-section", "consult-contract", "care.packet.title"];
    let cursor = -1;
    for (const marker of order) {
      const at = ASK.indexOf(marker, cursor + 1);
      expect(at, `${marker} out of DOM order`).toBeGreaterThan(cursor);
      cursor = at;
    }
    // Still exactly one h1 on the route (CR-21) and it is the hub's, not this.
    expect((ASK.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it("the reason still leads the PACKET, wherever the composer sits on screen", () => {
    // The move is presentational. What the clinician receives is built by
    // buildPacketInput, which is untouched and still carries `reason`.
    expect(ASK).toContain("reason,");
    expect(ASK).toContain("buildPacketInput");
  });
});

describe("R18 · NEGATIVE CONTROL — the round-2c column is what this rejects", () => {
  it("none of the four shipped 1,014 px shapes could have moved a block", () => {
    const preRoot = 'className="space-y-5 max-w-[1180px]"';
    const preContract = "<section data-testid=\"consult-contract\">";
    const preBar = 'className="sticky bottom-2 rounded-2xl p-4 flex flex-col gap-3"';
    // The reason composer's pre-fix tag carried no test id at all, which is
    // why it could not be pinned before this item.
    const preReason = "<section className=\"rounded-[18px] p-4\" style={{ background: \"var(--arbor-paper-elevated)\"";
    for (const shape of [preRoot, preContract, preBar, preReason]) {
      expect(shape, shape).not.toContain("order-");
    }
    expect(preRoot).not.toContain("flex flex-col");
    // Three of the four are gone outright.
    for (const shape of [preRoot, preContract, preBar]) expect(ASK, shape).not.toContain(shape);
  });

  it("the reason composer specifically no longer renders in the pre-fix shape", () => {
    // That tag is still the vision-note section's shape, so the needle here is
    // the composer itself: the section that owns `id="consult-reason"`.
    const at = ASK.indexOf('id="consult-reason"');
    expect(at).toBeGreaterThan(-1);
    const openTag = ASK.slice(ASK.lastIndexOf("<section", at), at);
    expect(openTag).toContain("max-md:order-2");
    expect(openTag).toContain('data-testid="consult-reason-section"');
  });

  it("the guard is not vacuous — an unmoved block is reported as unmoved", () => {
    // The vision-note section deliberately keeps the default order: it only
    // renders when a note arrived, and then it IS what the parent came to see.
    const at = ASK.indexOf('t("consult.visionNote.title")');
    const openTag = ASK.slice(ASK.lastIndexOf("<section", at), at);
    expect(openTag).not.toContain("order-");
  });
});
