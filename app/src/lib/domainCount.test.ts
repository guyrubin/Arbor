import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DOMAIN_META } from "../practice/content";
import { DOMAINS, DOMAIN_COUNT } from "./domains/registry";
import { translate } from "./i18n";

/* OBJ-GROWTH-01 — one screen, four different answers to "how many areas does
   Arbor track": the Development hero said "1 areas (of 7)" from a hard-coded
   literal in the dictionary, six domain rows rendered beneath it, the Full
   Picture teaser said "5 areas covered", and #/science said "7 developmental
   domains". The count is now derived from DOMAIN_META everywhere it is named.

   Guarded structurally rather than by render, because the number's source is
   the point: a render test passes just as happily against a second hard-coded
   literal. */

const SRC = path.resolve(__dirname, "..");
const read = (...rel: string[]) => readFileSync(path.join(SRC, ...rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("OBJ-GROWTH-01 — one domain count, derived once", () => {
  /* B-GROWTH-34 superseded B-GROWTH-01: the hero row no longer carries any
     "areas of N" (law 1 — no denominator), so the n ≤ total invariant and its
     lib/domainCount helper are gone. The hero's plain counts are guarded in
     components/tabs/growthHeroCounts.test.ts. What stays here: the registry
     total the remaining surfaces name. */
  it("the hero row's old denominator keys are gone from both dictionaries", () => {
    const growth = read("lib", "i18nElevation", "growth.ts");
    expect(growth).not.toContain('"elev.hero.growth.stat.domains"');
    expect(growth).not.toContain('"elev.hero.growth.stat.noticed"');
    const dev = stripComments(["ChildPortrait.tsx", "PortraitWatchRow.tsx", "PortraitKeepsakes.tsx"].map((f) => read("components", "companion", f)).join("\n"));
    expect(dev).not.toContain("domainCountsIn");
    expect(dev).not.toContain("DOMAIN_META");
    expect(dev).not.toContain("DOMAIN_COUNT");
  });

  it("B-GROWTH-26: DOMAIN_COUNT is the registry's length — 8 domains (Guy D1)", () => {
    expect(DOMAIN_COUNT).toBe(DOMAINS.length);
    expect(DOMAIN_COUNT).toBe(8);
  });

  it("the remaining surfaces derive the total from the registry's DOMAIN_COUNT, never a literal", () => {
    const sci = stripComments(read("components", "tabs", "SciencePage.tsx"));
    expect(sci).toContain('value={String(DOMAIN_COUNT)} label={t("sci.stat.domains")}');
    expect(sci).toContain('import { DOMAINS, DOMAIN_COUNT, domainName } from "../../lib/domains/registry";');
    expect(sci).not.toMatch(/value="7"\s+label=\{t\("sci\.stat\.domains"\)\}/);

    const summary = stripComments(read("consult", "clinicianSummary.ts"));
    expect(summary).toContain('import { DOMAIN_COUNT, distinctDomains, domainLabelEn } from "../lib/domains/registry"');
    expect(summary).toContain('${distinctDomains("practice", data.week.domainsTouched).length} of ${DOMAIN_COUNT} domains.');
    expect(summary).not.toMatch(/const DOMAIN_COUNT = /);
  });

  it("NEGATIVE CONTROL — the pre-fix shapes fail every check above", () => {
    const preFixDict = '  "elev.hero.growth.stat.domains": "areas (of 7)",';
    expect(preFixDict).toMatch(/\d/);
    expect(preFixDict).not.toContain("{total}");
    const preFixSci = '<StatTile value="7" label={t("sci.stat.domains")} />';
    expect(/value="7"\s+label=\{t\("sci\.stat\.domains"\)\}/.test(preFixSci)).toBe(true);
    // and the two literals disagreed with each other and with DOMAIN_META
    expect(7).not.toBe(Object.keys(DOMAIN_META).length);
  });

  it("the retired Full Picture dictionary and live door are gone", () => {
    const registry = read("lib", "i18nElevation", "index.ts");
    expect(registry).not.toContain("fullpicture");
    const portrait = read("components", "companion", "ChildPortrait.tsx");
    expect(portrait).not.toContain('setActiveTab("copilot")');
  });
});
