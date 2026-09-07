import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DOMAIN_META } from "../practice/content";
import { translate } from "./i18n";
import { resolvePlural } from "../context/LanguageContext";

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
  it("the dictionary no longer carries a literal total in either language", () => {
    const growth = read("lib", "i18nElevation", "growth.ts");
    for (const line of growth.split("\n").filter((l) => l.includes("elev.hero.growth.stat.domains"))) {
      expect(line).not.toMatch(/\d/);
      expect(line).toContain("{total}");
    }
  });

  it("EN and HE both interpolate the count and read singular at 1", () => {
    const t = (lang: "en" | "he", vars: Record<string, string | number>) =>
      resolvePlural(lang, translate(lang, "elev.hero.growth.stat.domains", vars), vars);
    const total = Object.keys(DOMAIN_META).length;
    for (const lang of ["en", "he"] as const) {
      expect(t(lang, { n: 1, total })).toContain(String(total));
      expect(t(lang, { n: total, total })).toContain(String(total));
    }
    expect(t("en", { n: 1, total })).toBe(`area of ${total}`);
    expect(t("en", { n: 3, total })).toBe(`areas of ${total}`);
  });

  it("the three surfaces derive the total from DOMAIN_META, never a literal", () => {
    const dev = stripComments(read("components", "tabs", "DevelopmentTab.tsx"));
    expect(dev).toContain("const DOMAIN_COUNT = Object.keys(DOMAIN_META).length;");
    expect(dev).toMatch(/elev\.hero\.growth\.stat\.domains[^)]*total: DOMAIN_COUNT/);
    expect(dev).toMatch(/elev\.fullpicture\.card\.teaser[^)]*n: DOMAIN_COUNT/);

    const sci = stripComments(read("components", "tabs", "SciencePage.tsx"));
    expect(sci).toContain('value={String(Object.keys(DOMAIN_META).length)} label={t("sci.stat.domains")}');
    expect(sci).not.toMatch(/value="7"\s+label=\{t\("sci\.stat\.domains"\)\}/);

    // The Full Picture's own domain list already walks the same source.
    const copilot = stripComments(read("components", "practice", "DevelopmentCopilot.tsx"));
    expect(copilot).toContain("DOMAIN_META[b.domain]");
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
});
