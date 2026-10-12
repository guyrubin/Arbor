import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { companionEn, companionHe } from "./i18nCompanion";
import { translate } from "./i18n";

/**
 * F-CHILD-2 — every Moments and Keep-a-moment string exists in EN and HE,
 * Hebrew carries no Latin words, and no string reads as a verdict about the
 * child (no grade words, no percentages, no "n of m").
 */

const KEYS = [
  "companion.moments.title", "companion.moments.tabs",
  "companion.moments.view.time", "companion.moments.view.places", "companion.moments.view.areas",
  "companion.moments.rangeAria", "companion.moments.keep", "companion.moments.open", "companion.moments.journal",
  "companion.moments.loadMore", "companion.moments.showMore", "companion.moments.overflow",
  "companion.moments.count", "companion.moments.countOne",
  "companion.moments.place.Home", "companion.moments.place.School", "companion.moments.place.Transit", "companion.moments.place.Public",
  "companion.moments.placeNote", "companion.moments.placesEmpty",
  "companion.moments.threadTitle", "companion.moments.threadSub", "companion.moments.areasNote",
  "companion.moments.area", "companion.moments.cellAria", "companion.moments.emptyMonth",
  "companion.moments.filtered", "companion.moments.clearFilter",
  "companion.capture.keepTitle", "companion.capture.keepSub", "companion.capture.modes",
  "companion.capture.mode.write", "companion.capture.mode.dictate", "companion.capture.mode.photo",
  "companion.capture.where", "companion.capture.area", "companion.capture.privacy", "companion.capture.keep",
  "companion.capture.another", "companion.capture.photoNote",
  "companion.capture.intensity.1", "companion.capture.intensity.2", "companion.capture.intensity.3",
  "companion.capture.intensity.4", "companion.capture.intensity.5",
] as const;

const en = companionEn as Record<string, string>;
const he = companionHe as Record<string, string>;
const VERDICT = /\b(on track|behind|delayed|at risk|percentile|ahead|advanced|below average|above average|normal range|score)\b|%/i;
const DENOMINATOR = /\{\w+\}\s*(of|\/|מתוך)\s*\{\w+\}|\d+\s*(of|\/|מתוך)\s*\d+/;

describe("F-CHILD-2 copy", () => {
  it("every key exists, non-empty, in both languages", () => {
    for (const key of KEYS) {
      expect(en[key], `en ${key}`).toBeTruthy();
      expect(he[key], `he ${key}`).toBeTruthy();
      expect(translate("en", key), key).toBe(en[key]);
      expect(translate("he", key), key).toBe(he[key]);
    }
  });

  it("Hebrew carries no Latin words (placeholders aside)", () => {
    for (const key of KEYS) expect(he[key].replace(/\{\w+\}/g, ""), key).not.toMatch(/[A-Za-z]/);
  });

  it("placeholders match across languages", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of KEYS) expect(vars(he[key]), key).toEqual(vars(en[key]));
    expect(vars(en["companion.moments.cellAria"])).toEqual(["{area}", "{month}", "{n}"]);
    expect(vars(en["companion.moments.count"])).toEqual(["{n}"]);
  });

  it("counts only: no verdict words, no percentages, no denominators", () => {
    for (const key of KEYS) {
      for (const value of [en[key], he[key]]) {
        expect(value, key).not.toMatch(VERDICT);
        expect(value, key).not.toMatch(DENOMINATOR);
      }
    }
  });

  it("the Across-areas note says what a number and a blank mean, verbatim (no lines are drawn, so none are described)", () => {
    expect(en["companion.moments.areasNote"]).toBe("A number = how many moments were saved. Blank = no record in this period, not a missing ability.");
    expect(he["companion.moments.areasNote"]).toBe("מספר = כמה רגעים נשמרו. ריק = אין תיעוד בתקופה, לא יכולת חסרה.");
    for (const value of [en["companion.moments.areasNote"], he["companion.moments.areasNote"]]) expect(value).not.toMatch(/\bLines?\b|קווים/);
  });

  it("the Across-areas title is the portrait's own wording in both languages", () => {
    expect(en["companion.moments.threadTitle"]).toBe(en["companion.portrait.threadTitle"]);
    expect(he["companion.moments.threadTitle"]).toBe("חלקים שונים של אותו ילד");
    expect(he["companion.moments.threadTitle"]).toBe(he["companion.portrait.threadTitle"]);
  });

  it("the duplicate saved line is gone: the capture Receipt is the one confirmation", () => {
    expect(en["companion.capture.saved"]).toBeUndefined();
    expect(he["companion.capture.saved"]).toBeUndefined();
  });

  it("the block is appended under its own F-CHILD-2 marker in both dictionaries", () => {
    const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "i18nCompanion.ts"), "utf8");
    expect((source.match(/\/\/ F-CHILD-2 — Moments/g) ?? []).length).toBe(2);
  });
});
