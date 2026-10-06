/**
 * B-INF-10 guard — `bandFor` reads the canonical band for a child (corrected
 * age under 2 if preterm) and `fits` reads every legacy notation through the
 * ONE registry (lib/domains/ageBands SCHEME_RANGES).
 */
import { describe, expect, it } from "vitest";
import {
  ageKeyOf,
  ageMonthsOf,
  ageYearsOf,
  bandFor,
  comparisonMonthsOf,
  fits,
  fitsChild,
  fitsMonths,
  fitsYears,
  isUnderThree,
  rangeOfNotation,
  stageFor,
  yearsNotation,
} from "./forChild";
import { CANONICAL_BANDS, SCHEME_RANGES, toAgeBand, type AgeScheme } from "../domains/ageBands";

const NOW = new Date(2026, 9, 6, 12);
const kid = (ageMonths: number, extra: Record<string, unknown> = {}) => ({
  id: `c${ageMonths}`,
  age: Math.floor(ageMonths / 12),
  ageMonths,
  ageMonthsAsOf: "2026-10-06",
  ...extra,
});

describe("B-INF-10 · bandFor", () => {
  it("22 months → 18m (the founder's Leni)", () => {
    expect(bandFor(kid(22), NOW).id).toBe("18m");
    expect(stageFor(kid(22), NOW)).toBe("toddler");
    expect(isUnderThree(kid(22), NOW)).toBe(true);
  });
  it("5 y 2 m → 60m (the founder's Dylan)", () => {
    expect(bandFor(kid(62), NOW).id).toBe("60m");
    expect(stageFor(kid(62), NOW)).toBe("preschool");
    expect(isUnderThree(kid(62), NOW)).toBe(false);
  });
  it("7 years → 6-8y", () => {
    expect(bandFor(kid(84), NOW).id).toBe("6-8y");
    expect(stageFor(kid(84), NOW)).toBe("school");
  });
  it("reads a birth date first, then ageMonths, then whole years", () => {
    expect(bandFor({ age: 9, birthDate: "2024-12-01" }, NOW).id).toBe("18m");
    expect(bandFor({ age: 5 }, NOW).id).toBe("60m");
    expect(ageMonthsOf({ age: 1, ageMonths: 22, ageMonthsAsOf: "2026-10-06" }, NOW)).toBe(22);
    expect(ageYearsOf({ age: 1, ageMonths: 22, ageMonthsAsOf: "2026-10-06" }, NOW)).toBe(1);
  });
  it("preterm: a 30-week baby at 10 months chronological is chosen for at ~7.7 months (corrected)", () => {
    const preterm = kid(10, { preterm: { gestationalWeeks: 30 } });
    expect(comparisonMonthsOf(preterm, NOW)).toBeCloseTo(7.7, 1);
    expect(bandFor(preterm, NOW).id).toBe("6m");
    expect(bandFor(kid(10), NOW).id).toBe("9m");
    // AAP: correction stops at 24 months chronological.
    expect(bandFor(kid(25, { preterm: { gestationalWeeks: 30 } }), NOW).id).toBe("24m");
  });
  it("the memo key is per child and per band, never per family", () => {
    expect(ageKeyOf(kid(22), NOW)).toBe("c22@18m");
    expect(ageKeyOf(kid(62), NOW)).not.toBe(ageKeyOf(kid(22), NOW));
  });
});

describe("B-INF-10 · fits reads each legacy notation", () => {
  const leni = bandFor(kid(22), NOW);
  const dylan = bandFor(kid(62), NOW);
  const seven = bandFor(kid(84), NOW);

  it("1 · canonical ids", () => {
    expect(fits(["18m"], leni)).toBe(true);
    expect(fits(["60m"], leni)).toBe(false);
    expect(fits({ ageBands: ["6-8y"] }, seven)).toBe(true);
  });
  it("2 · inclusive whole years (hard-moment cards)", () => {
    expect(rangeOfNotation("2-5")).toEqual([24, 72]);
    expect(fits(["2-5"], leni)).toBe(false);
    expect(fits(["2-5"], dylan)).toBe(true);
    expect(fits(["1-2"], leni)).toBe(true);
    expect(fits(["6-9"], seven)).toBe(true);
    expect(fits(["6-9"], dylan)).toBe(false);
    expect(fits(["3+"], seven)).toBe(true);
  });
  it("3 · stage and knowledge ids", () => {
    expect(fits(["18-24m"], leni)).toBe(true);
    expect(fits(["12-36m"], leni)).toBe(true);
    expect(fits(["3-5y"], leni)).toBe(false);
    expect(fits(["5-7y"], dylan)).toBe(true);
  });
  it("4 · play bands", () => {
    expect(fits(["toddler"], leni)).toBe(true);
    expect(fits(["preschool"], leni)).toBe(false);
    expect(fits(["early-school"], dylan)).toBe(true);
  });
  it("5 · milestone thresholds (months)", () => {
    expect(fits(["18"], leni)).toBe(true);
    expect(fits(["60"], dylan)).toBe(true);
    expect(fits(["24"], leni)).toBe(false);
  });
  it("6 · any scheme, explicitly", () => {
    expect(fits(["screening:1-2"], leni)).toBe(true);
    expect(fits(["screening:3-5"], dylan)).toBe(true);
    expect(fits(["language:12-36m"], leni)).toBe(true);
    expect(fits(["nosuch:1-2"], leni)).toBe(false);
  });
  it("every id of every scheme resolves, and agrees with toAgeBand", () => {
    for (const scheme of Object.keys(SCHEME_RANGES) as AgeScheme[]) {
      for (const id of Object.keys(SCHEME_RANGES[scheme])) {
        const claimed = new Set(toAgeBand(scheme, id));
        for (const b of CANONICAL_BANDS) {
          if (b.minMonths < 2) continue;
          expect(fits([`${scheme}:${id}`], b), `${scheme}:${id} @ ${b.id}`).toBe(claimed.has(b.id));
        }
      }
    }
  });
  it("fail-closed: no bands, an empty list or an unreadable notation never fits", () => {
    expect(fits(undefined, leni)).toBe(false);
    expect(fits({ ageBands: [] }, leni)).toBe(false);
    expect(fits(["toddlers"], leni)).toBe(false);
    expect(fits(["1-2", "soon"], leni)).toBe(false);
    expect(fitsMonths(["1-2"], null)).toBe(false);
  });
  it("a band expands to every year it covers: the 60m child fits cards tagged 4-6, 5-5, 3-7 and 2-5", () => {
    for (const tag of ["4-6", "5-5", "3-7", "2-5", "5+"]) expect(fits([tag], dylan), tag).toBe(true);
    for (const tag of ["6-8", "1-2", "0-4"]) expect(fits([tag], dylan), tag).toBe(false);
    // the school band spans three years, so it fits a card for any of them
    for (const tag of ["6-6", "7-9", "8-12"]) expect(fits([tag], seven), tag).toBe(true);
  });
  it("fitsYears (Learn's year-keyed age): the child's whole year, exact; slack widens the card", () => {
    expect(fitsYears(4, 3, 6)).toBe(true);
    expect(fitsYears(6, 3, 6)).toBe(true);
    expect(fitsYears(7, 3, 6)).toBe(false);
    expect(fitsYears(7, 3, 6, 1)).toBe(true);
    expect(fitsYears(10, 3, 6, 1)).toBe(false);
    expect(fitsYears(1, 2, 6)).toBe(false);
    expect(fitsYears(99, 2, 12)).toBe(false);
    expect(fitsYears(null, 2, 6)).toBe(false);
  });
  it("months and child forms agree with the band form", () => {
    expect(fitsMonths(["1-2"], 22)).toBe(true);
    expect(fitsChild(["1-2"], kid(22), NOW)).toBe(true);
    expect(fitsChild(["1-2"], kid(62), NOW)).toBe(false);
    expect(yearsNotation(2, 6)).toBe("2-6");
    expect(yearsNotation(3)).toBe("3+");
  });
});
