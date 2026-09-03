/* LC-14 — helpline groups render market-first, EU second, rest folded.
 * Pure-function order tests + a source pin that SafetyTab consumes the
 * ordering and renders a full-width primary tel button. Negative control:
 * the pre-fix fixed order (il first for everyone) must NOT be what a
 * Belgian / Dutch / unknown family gets. */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  HELPLINE_DIRECTORY,
  HELPLINE_EXPANDED_GROUPS,
  helplineOrderFor,
  helplineRegionForHint,
  type HelplineRegion,
} from "./escalation";

const ALL: readonly HelplineRegion[] = ["il", "eu", "nl", "be", "us"];
const here = path.dirname(fileURLToPath(import.meta.url));
const tabSource = readFileSync(path.join(here, "..", "components", "tabs", "SafetyTab.tsx"), "utf8");

describe("helplineOrderFor — family market first, EU second", () => {
  it("he → il first, eu second", () => {
    expect(helplineOrderFor("he")[0]).toBe("il");
    expect(helplineOrderFor("he")[1]).toBe("eu");
  });

  it("nl-BE → be first (territory subtag beats language)", () => {
    expect(helplineOrderFor("nl-BE")[0]).toBe("be");
    expect(helplineOrderFor("nl-BE")[1]).toBe("eu");
    expect(helplineOrderFor("nl-BE")).not.toContain(undefined);
  });

  it("attribution markets resolve directly (il / be / nl); ie / uk / intl fall to EU-first", () => {
    expect(helplineOrderFor("il")[0]).toBe("il");
    expect(helplineOrderFor("be")[0]).toBe("be");
    expect(helplineOrderFor("nl")[0]).toBe("nl");
    for (const m of ["ie", "uk", "intl", "en", "", undefined, null]) {
      expect(helplineOrderFor(m)[0], `hint ${String(m)}`).toBe("eu");
    }
    expect(helplineRegionForHint("en-US")).toBe("us");
  });

  it("always yields every region exactly once — the directory is never partially rendered", () => {
    for (const hint of ["he", "nl-BE", "nl", "en", "intl", "xx-YY"]) {
      const order = helplineOrderFor(hint);
      expect([...order].sort()).toEqual([...ALL].sort());
      for (const h of HELPLINE_DIRECTORY) expect(order).toContain(h.region);
    }
  });

  it("NEGATIVE CONTROL: the pre-fix fixed order (il first for everyone) is gone for non-IL families", () => {
    expect(helplineOrderFor("nl-BE")[0]).not.toBe("il");
    expect(helplineOrderFor("nl")[0]).not.toBe("il");
    expect(helplineOrderFor("en")[0]).not.toBe("il");
  });
});

describe("SafetyTab consumes the ordering (source pins)", () => {
  it("orders groups through helplineOrderFor and folds the rest behind a details element", () => {
    expect(tabSource).toContain("helplineOrderFor(");
    expect(tabSource).toContain("HELPLINE_EXPANDED_GROUPS");
    expect(tabSource).toMatch(/<details\b/);
    expect(HELPLINE_EXPANDED_GROUPS).toBe(2);
  });

  it("renders the first group's primary number as a full-width tel: button above the crisis card", () => {
    expect(tabSource).toContain("primaryHelpline");
    expect(tabSource).toMatch(/href=\{`tel:\$\{primaryHelpline\.tel\}`\}/);
    const primaryIdx = tabSource.indexOf("tel:${primaryHelpline.tel}");
    const crisisIdx = tabSource.indexOf("elev.safety.crisis.kicker");
    expect(primaryIdx).toBeGreaterThan(-1);
    expect(primaryIdx).toBeLessThan(crisisIdx);
    // Full width + ≥44px target on the primary button.
    const primaryAnchor = tabSource.slice(tabSource.lastIndexOf("<a", primaryIdx), tabSource.indexOf("</a>", primaryIdx));
    expect(primaryAnchor).toContain("w-full");
    expect(primaryAnchor).toMatch(/min-h-\[(44|48|52|56)px\]/);
  });
});
