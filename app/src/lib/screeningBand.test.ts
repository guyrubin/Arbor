import { describe, expect, it } from "vitest";
import { AGE_BANDS, bandForAge, bandForAgeMonths } from "./screening";
import { comparisonAgeMonths } from "./milestoneData";

/**
 * UND-5 — the Development Check must select its question band from the SAME
 * corrected (preterm-adjusted), months-precise age the Milestones map uses.
 * Previously ScreeningFlow used bandForAge(childProfile.age) — the legacy
 * whole-years field, uncorrected — so a preemie was screened against a band
 * the corrected milestone view disagreed with, one click away.
 *
 * ⚠ Clinical note: band selection is clinical logic. This change is flagged to
 * the named clinical reviewer alongside the UND-1 localization pass (GD-10) —
 * see docs/audits/2026-07-23-next-level/UND-1-clinical-review-followup.md.
 */
describe("bandForAgeMonths (UND-5 — months-precise screening band)", () => {
  it("picks the band containing the month value", () => {
    expect(bandForAgeMonths(0).id).toBe("0-1");
    expect(bandForAgeMonths(11).id).toBe("0-1");
    expect(bandForAgeMonths(12).id).toBe("1-2");
    expect(bandForAgeMonths(35).id).toBe("2-3");
    expect(bandForAgeMonths(71).id).toBe("3-5");
    expect(bandForAgeMonths(108).id).toBe("8-12");
  });

  it("clamps: negative/NaN → youngest band, above the top band → oldest band", () => {
    expect(bandForAgeMonths(-3).id).toBe("0-1");
    expect(bandForAgeMonths(Number.NaN).id).toBe("0-1");
    expect(bandForAgeMonths(500).id).toBe(AGE_BANDS[AGE_BANDS.length - 1].id);
  });

  it("bandForAge (legacy years entry point) delegates to the same month logic", () => {
    expect(bandForAge(1)).toBe(bandForAgeMonths(12));
    expect(bandForAge(4)).toBe(bandForAgeMonths(48));
  });
});

describe("corrected-age band selection (UND-5 preemie fixture)", () => {
  it("a 13-month-old born at 28 weeks screens against the corrected 0-1 band", () => {
    // 12 weeks of correction ≈ 2.8 months → corrected ≈ 10.2 months.
    const comparison = comparisonAgeMonths(13, 28);
    expect(comparison).toBeLessThan(12);
    expect(bandForAgeMonths(comparison).id).toBe("0-1");
    // Uncorrected, the same child would get the 1–2y questions — the UND-5 defect.
    expect(bandForAgeMonths(13).id).toBe("1-2");
  });

  it("term children are unchanged (corrected age equals chronological age)", () => {
    expect(comparisonAgeMonths(13, 40)).toBe(13);
    expect(comparisonAgeMonths(13, undefined)).toBe(13);
    expect(bandForAgeMonths(comparisonAgeMonths(13, 40)).id).toBe("1-2");
  });

  it("correction stops at 24 months (AAP): an older preemie screens chronologically", () => {
    expect(comparisonAgeMonths(30, 28)).toBe(30);
    expect(bandForAgeMonths(comparisonAgeMonths(30, 28)).id).toBe("2-3");
  });
});
