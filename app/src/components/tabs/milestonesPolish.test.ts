import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * UND-3 / UND-8 — source-based guards for the Milestones journey polish
 * (same pattern as clinicalFirewall.wave3.test.ts: string-scan the shipped
 * files so a regression is caught at CI time).
 *
 *  - UND-8: no native window.prompt/window.confirm dialogs (inline in-app
 *    patterns only), and no text below 11px on the screen.
 *  - UND-3: the "Gentle watch points" card must be DERIVED from the canonical
 *    useMonitoring watch-area derivation — the hardcoded, always-asserted
 *    "code-switching" insight must never return.
 *  - UND-6: the weekly focus must go through the age-aware selector, never the
 *    naive first-unchecked-in-array pick.
 */

const SRC_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");

describe("UND-8 — Milestones consumer polish", () => {
  const code = stripComments(read("components/tabs/MilestonesTab.tsx"));

  it("uses no native window.prompt / window.confirm dialogs", () => {
    expect(code).not.toMatch(/window\.(prompt|confirm)\s*\(/);
  });

  it("renders no text below 11px (readable mobile minimum)", () => {
    expect(code).not.toMatch(/text-\[(?:\d|10)px\]/);
  });

  it("the explain() seam goes through the months-precise prompt builder", () => {
    expect(code).toContain("explainMilestonePrompt(item.title, chronoMonths)");
    expect(code).not.toMatch(/\$\{childProfile\.age\}-year-old/);
  });
});

describe("UND-3 — watch points card is derived, never fabricated", () => {
  const code = read("components/tabs/MilestonesTab.tsx");

  it("no longer hardcodes the static code-switching / 'a few areas' insight", () => {
    expect(code).not.toContain("code-switching between");
    expect(code).not.toContain("A few areas are still in the");
  });

  it("derives the card from the canonical monitoring derivation (counts only)", () => {
    expect(code).toContain("useMonitoring");
    expect(code).toContain("watchPointsSummary");
    expect(code).toContain('t("ms.watch.none")');
  });
});

describe("UND-6 — weekly focus is age-aware", () => {
  const code = stripComments(read("components/tabs/DevelopmentTab.tsx"));

  it("selects through selectWeeklyFocus with corrected months, not array order", () => {
    expect(code).toContain("selectWeeklyFocus(milestones, comparisonMonths)");
    expect(code).not.toMatch(/milestones\.find\(\s*\(m\)\s*=>\s*!m\.checked\s*\)/);
  });
});
