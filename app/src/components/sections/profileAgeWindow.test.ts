/**
 * R8 (P0 truth) — the Profile milestones chapter printed a NaN age window.
 *
 * `#/profile` chapter 3 renders `elev.growthTruth.window.noticed`
 * ("{checked} of {total} noticed in the {band} window"). `{band}` was built as
 *
 *     ageLabelForMonths(milestoneAgeWindow(comparisonMonths).months, t)
 *
 * but `MilestoneAgeWindow` carries `currentBandMonths` / `earlierBandMonths` /
 * `label` — there is no `.months` field. `undefined` reached
 * `ageLabelForMonths`, `Math.round(undefined)` is NaN, and the parent read
 * "0 of 4 noticed in the NaN years NaN months window" about their own child.
 *
 * The seeded child is the legacy shape `{ age: 5 }` — no `birthDate`, no
 * `ageMonths` — which is exactly why the identity line ("5 years", straight
 * through `ageLabel`) stayed correct while the window went to NaN: the two
 * paths diverge at the window, not at the age derivation.
 *
 * This suite reproduces the component's own derivation end to end (the pure
 * libs are framework-free, so `environment: "node"` is enough) in BOTH locales,
 * with the pre-fix `.months` access as the negative control.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ageLabel, ageLabelForMonths, ageMonthsFromProfile } from "../../lib/childAge";
import { comparisonAgeMonths, milestoneAgeWindow } from "../../lib/milestoneData";
import { translate } from "../../lib/i18n";
import type { ChildProfile } from "../../types";

const SRC = path.resolve(__dirname, "..", "..");
const profileSrc = readFileSync(path.join(SRC, "components/sections/ChildProfile.tsx"), "utf8");

/** The seeded/legacy profile shape: whole years only. */
const legacyChild = { age: 5 } as unknown as ChildProfile;

const tFor = (lang: "en" | "he") => (key: string, vars?: Record<string, number>) =>
  translate(lang, key, vars);

/** ChildProfile's own derivation, copied verbatim from the component. */
const comparisonMonthsOf = (child: ChildProfile) => {
  const chronoMonths = ageMonthsFromProfile(child) ?? Math.round((child.age || 0) * 12);
  return comparisonAgeMonths(chronoMonths, child.preterm?.gestationalWeeks);
};

describe("R8 — the Profile age window is an age, not NaN", () => {
  it("the window object has no `.months` field to read (the root cause)", () => {
    const w = milestoneAgeWindow(60);
    expect(w.currentBandMonths).toBe(60);
    expect((w as unknown as Record<string, unknown>).months).toBeUndefined();
  });

  it("a legacy { age: 5 } profile still resolves to 60 comparison months", () => {
    expect(ageMonthsFromProfile(legacyChild)).toBe(60);
    expect(comparisonMonthsOf(legacyChild)).toBe(60);
  });

  for (const [lang, expected] of [["en", "5 years"], ["he", "5 שנים"]] as const) {
    it(`the band reads "${expected}" in ${lang}, with no NaN anywhere in the sentence`, () => {
      const t = tFor(lang);
      const band = ageLabelForMonths(milestoneAgeWindow(comparisonMonthsOf(legacyChild)).currentBandMonths, t);
      expect(band).toBe(expected);
      expect(band).not.toContain("NaN");

      const sentence = translate(lang, "elev.growthTruth.window.noticed", { checked: 0, total: 4, band });
      expect(sentence).toContain(expected);
      expect(sentence).not.toContain("NaN");
    });

    it(`the identity line and the window agree in ${lang} (they diverged before)`, () => {
      const t = tFor(lang);
      expect(ageLabel(legacyChild, t)).toBe(expected);
      expect(ageLabelForMonths(milestoneAgeWindow(comparisonMonthsOf(legacyChild)).currentBandMonths, t)).toBe(expected);
    });
  }

  it("NEGATIVE CONTROL — the pre-fix `.months` access prints the NaN sentence", () => {
    const t = tFor("en");
    const window = milestoneAgeWindow(comparisonMonthsOf(legacyChild)) as unknown as { months?: number };
    const preFixBand = ageLabelForMonths(window.months as unknown as number, t);
    expect(preFixBand).toBe("NaN years NaN months");
    expect(
      translate("en", "elev.growthTruth.window.noticed", { checked: 0, total: 4, band: preFixBand })
    ).toContain("NaN years NaN months");
  });

  it("the component reads the real field and never `.months` again", () => {
    expect(profileSrc).toContain("milestoneAgeWindow(comparisonMonths).currentBandMonths");
    expect(profileSrc).not.toContain("milestoneAgeWindow(comparisonMonths).months");
  });

  it("every band threshold renders a finite age label in both locales", () => {
    for (const months of [0, 2, 9, 12, 24, 36, 60, 72, 96]) {
      for (const lang of ["en", "he"] as const) {
        const label = ageLabelForMonths(milestoneAgeWindow(months).currentBandMonths, tFor(lang));
        expect(label, `${lang} @ ${months}m`).not.toContain("NaN");
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });
});
