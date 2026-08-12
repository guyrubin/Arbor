/**
 * TrustLink — masterplan 3.1: the "How Arbor decides →" chip other surfaces
 * mount next to their inline why-lines (W4's ContentActionBar owns mounting).
 * SOURCE scan + string-contract test (node env, no DOM).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTE_IDS } from "../../lib/routes";
import { en, he } from "../../lib/i18nElevation/trustcenter";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "TrustLink.tsx"), "utf8");

describe("TrustLink — navigation contract", () => {
  it("deep-links to the trust center via the canonical setActiveTab pattern", () => {
    expect(src).toContain('setActiveTab("science")');
  });

  it('"science" is a registered route id', () => {
    expect(ROUTE_IDS.includes("science")).toBe(true);
  });

  it("fires track(\"trustlink_tap\") with the optional surface tag", () => {
    expect(src).toContain('track("trustlink_tap"');
    expect(src).toMatch(/surface \? \{ surface \} : \{\}/);
  });
});

describe("TrustLink — strings (module-local en+he)", () => {
  it("resolves label + aria from i18nElevation/trustcenter", () => {
    expect(src).toContain('from "../../lib/i18nElevation/trustcenter"');
    expect(src).toContain('trustText(uiLang, "elev.trust.link")');
    expect(src).toContain('trustText(uiLang, "elev.trust.link.aria")');
  });

  it("both languages carry the label and aria strings", () => {
    for (const dict of [en, he]) {
      expect(dict["elev.trust.link"]).toBeTruthy();
      expect(dict["elev.trust.link.aria"]).toBeTruthy();
    }
  });
});

describe("TrustLink — register + a11y (Rule B acceptance)", () => {
  it("≥44px hit area via the ::before overlay recipe (EvidenceChip sibling)", () => {
    expect(src).toContain("before:-inset-y-2");
  });

  it("RTL-safe arrow (rtl:rotate-180) and motion-safe press transition", () => {
    expect(src).toContain("rtl:rotate-180");
    expect(src).toContain("motion-reduce:transition-none");
  });

  it("lav register — matches the trust center, no alarm or graded colors", () => {
    expect(src).toContain("PASTEL.lav");
    expect(src).not.toContain("--arbor-danger");
    expect(src).not.toMatch(/tone="yellow"|tone="pink"/);
  });

  it("firewall: no banned vocabulary in the component source", () => {
    const FINALS: Record<string, string> = { "ן": "נ", "ם": "מ", "ך": "כ", "ף": "פ", "ץ": "צ" };
    const norm = (s: string) => s.toLowerCase().replace(/[ןםךףץ]/g, (c) => FINALS[c]);
    for (const token of ["score", "on track", "high risk", "ציון", "אחוז", "סיכון גבוה", "%"]) {
      expect(norm(src).includes(norm(token)), `found "${token}"`).toBe(false);
    }
  });
});
