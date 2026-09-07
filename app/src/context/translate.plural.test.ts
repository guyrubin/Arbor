import { describe, it, expect } from "vitest";
import { translate } from "../lib/i18n";
import { resolvePlural } from "./LanguageContext";

/* GP-01 residue / OBJ-GROWTH-01 — `{plural}` shipped to the screen unresolved.
   translate() only substitutes the tokens a caller names, and no caller ever
   named this one, so "Grounded in {n} source{plural}" rendered with the braces
   showing. `t` now resolves it after translate(): English gets the suffix from
   `n`, Hebrew strips it (a Hebrew plural is not one suffix — מקור → מקורות,
   ילד → ילדים — so a Hebrew string needing both forms takes the explicit
   one/many key pair lib/childAge.ts:132 documents), and an explicit `plural`
   var always wins. */

const t = (lang: "en" | "he", key: string, vars?: Record<string, string | number>) =>
  resolvePlural(lang, translate(lang, key, vars), vars);

describe("OBJ-GROWTH-01 — {plural} never reaches the screen", () => {
  it("EN resolves the suffix from n", () => {
    expect(t("en", "elev.hero.growth.stat.domains", { n: 1, total: 5 })).toBe("area of 5");
    expect(t("en", "elev.hero.growth.stat.domains", { n: 2, total: 5 })).toBe("areas of 5");
  });

  it("HE carries no token and no English suffix", () => {
    for (const n of [1, 2]) {
      const s = t("he", "elev.hero.growth.stat.domains", { n, total: 5 });
      expect(s).not.toContain("{plural}");
      expect(s).not.toMatch(/[A-Za-z]/);
      expect(s).toContain("5");
    }
  });

  it("the token is stripped even where the dictionary still carries it", () => {
    for (const lang of ["en", "he"] as const) {
      for (const n of [1, 3]) {
        expect(t(lang, "cite.drawer.header", { n })).not.toContain("{plural}");
      }
    }
    expect(t("en", "cite.drawer.header", { n: 1 })).toContain("1 source");
    expect(t("en", "cite.drawer.header", { n: 3 })).toContain("3 sources");
  });

  it("an explicit plural var wins over the derived suffix", () => {
    expect(resolvePlural("he", "{n} מקור{plural}", { n: 3, plural: "ות" })).toBe("{n} מקור{plural}");
    // translate() wraps every interpolated value in bidi isolates (U+2068/9).
    const bare = translate("he", "cite.drawer.header", { n: 3, plural: "ות" }).replace(/[⁦-⁩]/g, "");
    expect(bare).toContain("מקורות");
  });

  it("NEGATIVE CONTROL — translate() alone leaks the token", () => {
    expect(translate("en", "elev.hero.growth.stat.domains", { n: 1, total: 5 })).toContain("{plural}");
    expect(translate("en", "cite.drawer.header", { n: 3 })).toContain("{plural}");
  });
});
