/**
 * B0 — Unit tests for src/lib/childAge.ts
 *
 * All tests inject `now` so they never depend on the wall clock.
 * Coverage targets:
 *  - chronologicalAgeMonths: boundary math, year crossing, day-of-month edge cases
 *  - ageMonthsFromProfile: birthDate / ageMonths / legacy-age / null
 *  - correctedAgeMonths: preterm correction applied and stopped at 24m
 *  - ageYearsFromProfile: round-trip through years
 *  - ageLabel: English default labels
 *  - birthDateFromAgeMonths: round-trip
 */
import { describe, it, expect } from "vitest";
import type { ChildProfile } from "../types";
import {
  chronologicalAgeMonths,
  ageMonthsFromProfile,
  correctedAgeMonths,
  ageYearsFromProfile,
  ageLabel,
  birthDateFromAgeMonths,
} from "./childAge";

// ── Minimal profile builder ──────────────────────────────────────────────────

function profile(overrides: Partial<ChildProfile> = {}): ChildProfile {
  return {
    id: "test-child",
    name: "Tali",
    age: 0,
    languages: ["English"],
    schoolContext: "",
    strengths: [],
    challenges: [],
    riskLevel: "Low",
    ...overrides,
  };
}

// ── Fixed reference dates ────────────────────────────────────────────────────
// "now" = 2026-06-21  (the date this wave is built, safe for determinism)
const NOW = new Date("2026-06-21");

// ── chronologicalAgeMonths ───────────────────────────────────────────────────

describe("chronologicalAgeMonths", () => {
  it("9-month-old returns 9 not 0", () => {
    // Born 2025-09-21 — exactly 9 months before 2026-06-21
    expect(chronologicalAgeMonths("2025-09-21", NOW)).toBe(9);
  });

  it("crossing a year boundary — born 2025-01-15, now 2026-06-21 = 17 months", () => {
    expect(chronologicalAgeMonths("2025-01-15", NOW)).toBe(17);
  });

  it("born same day of month — full months only", () => {
    // Born 2024-12-21 → 6 months as of 2026-06-21
    expect(chronologicalAgeMonths("2024-12-21", NOW)).toBe(18);
  });

  it("day-of-month not yet reached this month — subtracts one month", () => {
    // Born 2025-09-25 — the 25th hasn't arrived by the 21st, so still 8 months
    expect(chronologicalAgeMonths("2025-09-25", NOW)).toBe(8);
  });

  it("born exactly today returns 0", () => {
    expect(chronologicalAgeMonths("2026-06-21", NOW)).toBe(0);
  });

  it("future birthDate returns 0 (clamps at 0)", () => {
    expect(chronologicalAgeMonths("2027-01-01", NOW)).toBe(0);
  });

  it("invalid birthDate returns 0", () => {
    expect(chronologicalAgeMonths("not-a-date", NOW)).toBe(0);
  });

  it("3-year-old born 2023-06-21 returns 36 months", () => {
    expect(chronologicalAgeMonths("2023-06-21", NOW)).toBe(36);
  });
});

// ── ageMonthsFromProfile ─────────────────────────────────────────────────────

describe("ageMonthsFromProfile", () => {
  it("prefers birthDate over ageMonths and age", () => {
    const p = profile({ birthDate: "2025-09-21", ageMonths: 99, age: 5 });
    expect(ageMonthsFromProfile(p, NOW)).toBe(9);
  });

  it("falls back to ageMonths when no birthDate", () => {
    const p = profile({ ageMonths: 15, age: 5 });
    expect(ageMonthsFromProfile(p, NOW)).toBe(15);
  });

  it("falls back to age * 12 when no birthDate or ageMonths", () => {
    const p = profile({ age: 3 });
    expect(ageMonthsFromProfile(p, NOW)).toBe(36);
  });

  it("legacy age: age=0 gives 0, not null", () => {
    // A 0-year-old in legacy system is 0 months (not null)
    const p = profile({ age: 0 });
    expect(ageMonthsFromProfile(p, NOW)).toBe(0);
  });

  it("returns null when nothing is known — all fields absent", () => {
    // Construct a profile that lacks all three fields (override age to be omitted)
    // TypeScript requires age but runtime could receive an incomplete record
    const p = { ...profile(), age: undefined as unknown as number };
    expect(ageMonthsFromProfile(p, NOW)).toBeNull();
  });

  it("clamps ageMonths to 0 if somehow negative", () => {
    const p = profile({ ageMonths: -5 });
    expect(ageMonthsFromProfile(p, NOW)).toBe(0);
  });
});

// ── correctedAgeMonths ───────────────────────────────────────────────────────

describe("correctedAgeMonths", () => {
  it("term baby: correction not applied — returns chronological months", () => {
    const p = profile({ birthDate: "2025-09-21" }); // 9 months, term
    expect(correctedAgeMonths(p, NOW)).toBe(9);
  });

  it("no preterm field: returns chronological months unchanged", () => {
    const p = profile({ ageMonths: 14 });
    expect(correctedAgeMonths(p, NOW)).toBe(14);
  });

  it("32w gestation = 8w = ~2mo correction, applied at 9 months chrono", () => {
    // 32w gestation → 40-32=8 weeks correction
    // 8w × (12/52) ≈ 1.846 months
    // chrono=9, corrected ≈ 7.15 months, rounded to 7.2
    const p = profile({ ageMonths: 9, preterm: { gestationalWeeks: 32 } });
    const result = correctedAgeMonths(p, NOW);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(9 - 8 * (12 / 52), 1);
  });

  it("32w gestation at 24+ months: correction stops, returns chrono", () => {
    // AAP: stop correcting once chronological age >= 24 months
    const p = profile({ ageMonths: 24, preterm: { gestationalWeeks: 32 } });
    expect(correctedAgeMonths(p, NOW)).toBe(24);
  });

  it("32w gestation at 30 months: correction fully stopped", () => {
    const p = profile({ ageMonths: 30, preterm: { gestationalWeeks: 32 } });
    expect(correctedAgeMonths(p, NOW)).toBe(30);
  });

  it("gestationalWeeks >= 40 (term or post-term): no correction", () => {
    const p = profile({ ageMonths: 10, preterm: { gestationalWeeks: 40 } });
    expect(correctedAgeMonths(p, NOW)).toBe(10);
  });

  it("very preterm (28w) at 6 months: correction is larger", () => {
    // 40-28=12 weeks; 12 × (12/52) ≈ 2.77 months; corrected ≈ 3.23
    const p = profile({ ageMonths: 6, preterm: { gestationalWeeks: 28 } });
    const result = correctedAgeMonths(p, NOW);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(6 - 12 * (12 / 52), 1);
  });

  it("correction never goes below 0", () => {
    // 24w gestation → 16w correction ≈ 3.7 months; at 2 months chrono → would go negative
    const p = profile({ ageMonths: 2, preterm: { gestationalWeeks: 24 } });
    const result = correctedAgeMonths(p, NOW);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(0);
  });

  it("returns null when no age data at all", () => {
    const p = { ...profile(), age: undefined as unknown as number };
    expect(correctedAgeMonths(p, NOW)).toBeNull();
  });

  it("23 months with 32w gestation: correction still applied (< 24m ceiling)", () => {
    const p = profile({ ageMonths: 23, preterm: { gestationalWeeks: 32 } });
    const result = correctedAgeMonths(p, NOW);
    // Should be less than 23 (correction still in effect)
    expect(result!).toBeLessThan(23);
  });
});

// ── ageYearsFromProfile ──────────────────────────────────────────────────────

describe("ageYearsFromProfile", () => {
  it("9-month-old yields 0 years", () => {
    const p = profile({ birthDate: "2025-09-21" });
    expect(ageYearsFromProfile(p, NOW)).toBe(0);
  });

  it("13-month-old yields 1 year", () => {
    const p = profile({ ageMonths: 13 });
    expect(ageYearsFromProfile(p, NOW)).toBe(1);
  });

  it("36-month-old yields 3 years", () => {
    const p = profile({ ageMonths: 36 });
    expect(ageYearsFromProfile(p, NOW)).toBe(3);
  });

  it("legacy profile age=4 round-trips to 4 years", () => {
    const p = profile({ age: 4 });
    expect(ageYearsFromProfile(p, NOW)).toBe(4);
  });

  it("returns 0 (not null) when no age data", () => {
    const p = { ...profile(), age: undefined as unknown as number };
    expect(ageYearsFromProfile(p, NOW)).toBe(0);
  });
});

// ── ageLabel ─────────────────────────────────────────────────────────────────

describe("ageLabel", () => {
  it("0-11 months: 'N months'", () => {
    expect(ageLabel(profile({ ageMonths: 9 }), undefined, NOW)).toBe("9 months");
  });

  it("1 month singular", () => {
    expect(ageLabel(profile({ ageMonths: 1 }), undefined, NOW)).toBe("1 month");
  });

  it("exactly 12 months: '1 year'", () => {
    expect(ageLabel(profile({ ageMonths: 12 }), undefined, NOW)).toBe("1 year");
  });

  it("exactly 24 months: '2 years'", () => {
    expect(ageLabel(profile({ ageMonths: 24 }), undefined, NOW)).toBe("2 years");
  });

  it("15 months: '1 year 3 months'", () => {
    expect(ageLabel(profile({ ageMonths: 15 }), undefined, NOW)).toBe("1 year 3 months");
  });

  it("27 months: '2 years 3 months'", () => {
    expect(ageLabel(profile({ ageMonths: 27 }), undefined, NOW)).toBe("2 years 3 months");
  });

  it("empty string when no age data", () => {
    const p = { ...profile(), age: undefined as unknown as number };
    expect(ageLabel(p, undefined, NOW)).toBe("");
  });

  it("delegates to t() when provided", () => {
    const calls: string[] = [];
    const tFn = (key: string, vars?: Record<string, number>) => {
      calls.push(key);
      return `${key}:${JSON.stringify(vars ?? {})}`;
    };
    ageLabel(profile({ ageMonths: 9 }), tFn, NOW);
    expect(calls).toContain("age.months");
  });
});

// ── birthDateFromAgeMonths ────────────────────────────────────────────────────

describe("birthDateFromAgeMonths", () => {
  it("round-trips: birthDate → ageMonthsFromProfile ≈ entered months", () => {
    const entered = 9;
    const bd = birthDateFromAgeMonths(entered, NOW);
    const p = profile({ birthDate: bd, age: 0 });
    const computed = ageMonthsFromProfile(p, NOW);
    // Allow ±1 due to day-01 rounding
    expect(computed).not.toBeNull();
    expect(Math.abs(computed! - entered)).toBeLessThanOrEqual(1);
  });

  it("0 months returns current year-month as birth month", () => {
    const bd = birthDateFromAgeMonths(0, NOW);
    // 0 months back from 2026-06-21 → 2026-06
    expect(bd.startsWith("2026-06")).toBe(true);
  });

  it("36 months ago (3 years) returns a date 3 years back", () => {
    const bd = birthDateFromAgeMonths(36, NOW);
    // 2026-06 minus 36 months = 2023-06
    expect(bd.startsWith("2023-06")).toBe(true);
  });

  it("result is always a valid ISO date", () => {
    const bd = birthDateFromAgeMonths(7, NOW);
    expect(new Date(bd).getTime()).not.toBeNaN();
  });

  it("returns day-01 format", () => {
    const bd = birthDateFromAgeMonths(5, NOW);
    expect(bd).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

// ── Back-compat: age*12 is always the last resort ────────────────────────────

describe("legacy age*12 fallback", () => {
  it("profile with only age=2 yields 24 months", () => {
    const p = profile({ age: 2 });
    expect(ageMonthsFromProfile(p, NOW)).toBe(24);
  });

  it("profile with birthDate overrides legacy age", () => {
    // birthDate for 9 months, age set to 5 (legacy mismatch)
    const p = profile({ birthDate: "2025-09-21", age: 5 });
    expect(ageMonthsFromProfile(p, NOW)).toBe(9);
  });

  it("ageMonths overrides legacy age but not birthDate", () => {
    const p = profile({ ageMonths: 7, age: 5 });
    expect(ageMonthsFromProfile(p, NOW)).toBe(7);
  });
});
