import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { translate } from "../../lib/i18n";
import { SURFACE_CONTRACTS } from "../../lib/surfaceContract";

/* B-OCCL-04 (6 Oct, framer option (c)) — #/copilot at 375 × 812: the READ
   move open-full-picture was stamped on the copilot-domains card wrapper,
   measured y 517 EN / 444 HE, h 472 (sweeps/ship-275042b9), so the stamp
   rect ran under the fixed capture dock. The module holds no control (the
   contract declares a read: "Read surface — no write"); the framer kept the
   read stamp and the contract and moved the stamp to the module's HEADING.
   The ONE literal (FULL_PICTURE_STAMP) is spread on the card's h2, written out
   in the same markup kit SectionCard uses (36 px badge + text-lg heading).

   No content is removed and no layout moves, so the heading sits where the
   card's title row always sat: card top + 1 px border + p-6, one 36 px row
   (two 28 px lines if the title wraps at 375). OWED to a rendered check:
   rendered-sweep primaryMoveOccluded false on #/copilot 375 EN + HE with
   the stamp h ≤ 56 (the probe tests the stamp itself: it holds no control). */

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(here, "DevelopmentCopilot.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/^\s*\/\/.*$/gm, "");

const MEASURED_CARD_TOP = { en: 517, he: 444 } as const;
const FOLD_LIMIT = 640;
/* Title width at 375: 375 − 2 · 16 − 2 − 2 · 24 − 36 − 10 = 247 px; 18 px
   display face at 0.52 em per character (EN widths for HE: conservative). */
const titleLines = (lang: "en" | "he") =>
  Math.max(1, Math.ceil((translate(lang, "elev.growthTruth.copilot.domains.title", { age: "3 years" }).length * 18 * 0.52) / 247));
const headingHeight = (lang: "en" | "he") => Math.max(36, titleLines(lang) * 28);
const headingBottom = (lang: "en" | "he") => MEASURED_CARD_TOP[lang] + 1 + 24 + headingHeight(lang);

describe("#/copilot — the read stamp sits on the module heading, not the 472 px card", () => {
  it("the contract is unchanged: a read move, open-full-picture", () => {
    const c = SURFACE_CONTRACTS.find((x) => x.route === "copilot");
    expect(c?.primaryMove).toBe("open-full-picture");
    expect(c?.threadWrite).toBe("none");
  });

  it("ONE data-primary-move literal, a static const spread on the heading; the card wrapper carries none", () => {
    expect(SRC.match(/\bdata-primary-move\b(?!-)/g)).toHaveLength(1);
    expect(SRC).toContain('const FULL_PICTURE_STAMP = { "data-primary-move": "open-full-picture" } as const;');
    expect(SRC).toMatch(/<h2\s+\{\.\.\.FULL_PICTURE_STAMP\}\s+data-testid="copilot-domains-heading"/);
    expect(SRC).toMatch(/<div data-module="copilot-domains" style=\{\{ display: "contents" \}\}>/);
  });

  it("the heading is the card's first child, the title row kit SectionCard draws (no duplicate title)", () => {
    const at = SRC.indexOf('<div data-module="copilot-domains"');
    const card = SRC.indexOf("<SectionCard", at);
    const heading = SRC.indexOf('data-testid="copilot-domains-heading"', at);
    const list = SRC.indexOf("visibleDomains.length === 0", at);
    expect([at, card, heading, list].every((i) => i > 0)).toBe(true);
    expect(card).toBeLessThan(heading);
    expect(heading).toBeLessThan(list);
    expect(SRC.slice(card, heading)).toMatch(/<SectionCard tone="mint">/);
    expect(SRC.slice(heading, list)).toContain('t("elev.growthTruth.copilot.domains.title"');
    expect(SRC.match(/elev\.growthTruth\.copilot\.domains\.title/g)).toHaveLength(1);
    const h2 = /<h2\s+\{\.\.\.FULL_PICTURE_STAMP\}[^>]*>/.exec(SRC)?.[0] ?? "";
    expect(h2).toContain('className="text-lg font-extrabold"');
    expect(h2).not.toMatch(/uppercase|text-\[1[01]/);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the heading is short (≤ 56 px) and its bottom ≤ ${FOLD_LIMIT} px at 375 × 812`, () => {
      expect(headingHeight(lang)).toBeLessThanOrEqual(56);
      expect(headingBottom(lang)).toBeLessThanOrEqual(FOLD_LIMIT);
    });
  }

  it("negative control: the pre-fix stamp (the whole card) ran past the dock", () => {
    for (const lang of ["en", "he"] as const) expect(MEASURED_CARD_TOP[lang] + 472).toBeGreaterThan(FOLD_LIMIT);
  });
});
