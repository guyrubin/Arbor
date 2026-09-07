/**
 * MOB-11 follow-through — an age entered without a DOB still ages.
 *
 * Onboarding used to derive a `birthDate` from the entered months value, so a
 * "14 months" answer was stored as a day-01 birthday nobody gave. That was
 * removed (263480b1) and the fabricated birthday went with it — but so did the
 * only thing that made the child grow older. A profile carrying `ageMonths`
 * and nothing else read 14 months for ever: bands, milestone windows, screening
 * windows and the age label all reasoned about a child frozen at onboarding.
 *
 * The fix is an anchor: `ageMonthsAsOf` records the date the months value was
 * true on, and the reader adds the elapsed months.
 *
 * Negative control: `staleReader` below is the reader as it stood before this
 * change (`Math.max(0, profile.ageMonths)`), run against the same fixtures. It
 * must fail exactly where the real reader now succeeds.
 */
import { describe, expect, it } from "vitest";
import type { ChildProfile } from "../types";
import {
  ageAnchorOf,
  ageLabel,
  ageMonthsFromProfile,
  ageYearsFromProfile,
  agePatchFromMonths,
  correctedAgeMonths,
  isoDateOf,
  monthsSince,
} from "./childAge";

/** The pre-fix reader: the stored number, straight through. */
const staleReader = (p: { ageMonths?: number }) => Math.max(0, p.ageMonths ?? 0);

const NOW = new Date("2026-09-07T10:00:00");
/** 14 months before NOW. */
const ANCHOR = "2025-07-07";

const anchored = (over: Partial<ChildProfile> = {}): ChildProfile =>
  ({
    id: "c1",
    name: "Dylan",
    age: 1,
    ageMonths: 14,
    ageMonthsAsOf: ANCHOR,
    languages: ["English"],
    schoolContext: "",
    strengths: [],
    challenges: [],
    riskLevel: "Low",
    ...over,
  }) as ChildProfile;

describe("monthsSince", () => {
  it("counts whole elapsed months and never goes negative", () => {
    expect(monthsSince(ANCHOR, NOW)).toBe(14);
    expect(monthsSince("2026-09-07", NOW)).toBe(0);
    // Day-of-month rule: the month is not gained until the anchor day arrives.
    expect(monthsSince("2026-08-08", NOW)).toBe(0);
    expect(monthsSince("2026-08-07", NOW)).toBe(1);
    // A future anchor, an absent one and junk all read as "no drift".
    expect(monthsSince("2027-01-01", NOW)).toBe(0);
    expect(monthsSince(undefined, NOW)).toBe(0);
    expect(monthsSince("not-a-date", NOW)).toBe(0);
    // A full ISO timestamp is accepted, not just a calendar date (it is read
    // in the device's own timezone, like every other date in the app).
    expect(monthsSince("2025-07-07T09:00:00.000Z", NOW)).toBe(14);
  });
});

describe("a profile anchored 14 months ago reads 14 months older", () => {
  const profile = anchored();

  it("ageMonthsFromProfile adds the elapsed months", () => {
    expect(ageMonthsFromProfile(profile, NOW)).toBe(28);
    expect(ageYearsFromProfile(profile, NOW)).toBe(2);
    expect(ageLabel(profile, undefined, NOW)).toBe("2 years 4 months");
  });

  it("NEGATIVE CONTROL: the pre-fix reader still returns the frozen number", () => {
    expect(staleReader(profile)).toBe(14);
    expect(staleReader(profile)).not.toBe(ageMonthsFromProfile(profile, NOW));
  });

  it("corrected age for a preemie rides the same anchored base", () => {
    // 28 months chronological is past the 24-month correction ceiling (AAP),
    // so correction has stopped — the point is that the BASE moved with the
    // anchor; the pre-fix base of 14 months would still have been corrected.
    const preterm = anchored({ preterm: { gestationalWeeks: 32 } });
    expect(correctedAgeMonths(preterm, NOW)).toBe(28);
  });
});

describe("the sources are read in order, and the anchor never overrides a DOB", () => {
  it("birthDate wins over an anchored ageMonths", () => {
    const p = anchored({ birthDate: "2022-09-07" });
    expect(ageMonthsFromProfile(p, NOW)).toBe(48);
  });

  it("the legacy whole-year fallback is untouched by the anchor", () => {
    const p = anchored({ ageMonths: undefined, ageMonthsAsOf: undefined, age: 4 });
    expect(ageMonthsFromProfile(p, NOW)).toBe(48);
  });

  it("a profile with no age data at all is still null", () => {
    const p = anchored({ ageMonths: undefined, ageMonthsAsOf: undefined, age: undefined as unknown as number });
    expect(ageMonthsFromProfile(p, NOW)).toBeNull();
  });
});

describe("migration: profiles written before the anchor existed", () => {
  it("falls back to onboardingCompletedAt — the nearest creation stamp", () => {
    const p = anchored({ ageMonthsAsOf: undefined, onboardingCompletedAt: "2025-07-07T09:00:00.000Z" });
    expect(ageAnchorOf(p, NOW)).toBe("2025-07-07T09:00:00.000Z");
    expect(ageMonthsFromProfile(p, NOW)).toBe(28);
  });

  it("falls back to today when there is no stamp at all — no invented ageing", () => {
    const p = anchored({ ageMonthsAsOf: undefined });
    expect(ageAnchorOf(p, NOW)).toBe(isoDateOf(NOW));
    // Identical to the pre-fix reader: a legacy profile is never aged on a guess.
    expect(ageMonthsFromProfile(p, NOW)).toBe(staleReader(p));
  });
});

describe("every ageMonths write carries the anchor", () => {
  it("agePatchFromMonths stamps ageMonthsAsOf alongside the triple", () => {
    const patch = agePatchFromMonths(30, NOW);
    expect(patch).toEqual({ age: 2, ageMonths: 30, birthDate: "2024-03-01", ageMonthsAsOf: "2026-09-07" });
  });

  it("a drawer edit re-reads as the value that was just typed", () => {
    const edited = { ...anchored(), ...agePatchFromMonths(30, NOW) };
    expect(ageMonthsFromProfile(edited, NOW)).toBe(30);
  });

  it("isoDateOf is a calendar date in the device timezone, not a UTC shift", () => {
    expect(isoDateOf(new Date(2026, 0, 1, 23, 30))).toBe("2026-01-01");
  });
});
