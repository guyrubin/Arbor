/**
 * B0 — Child age derivation helpers (months-precise).
 *
 * Pure, framework-free module. No imports from React, Firebase, or any Arbor
 * UI layer — fully unit-testable in isolation.
 *
 * Design decisions:
 *  - `birthDate` (ISO YYYY-MM-DD) is the gold source: gives exact months.
 *  - `ageMonths` is the explicit-months fallback (set during onboarding when
 *    the parent entered a months value rather than a DOB).
 *  - `age` (whole years) is the legacy fallback: multiplied by 12.
 *  - Every function accepts an optional `now` Date for deterministic tests.
 *  - Corrected-age follows AAP guidance: apply `(40 - gestationalWeeks)` weeks
 *    of correction until chronological age reaches 24 months, then stop.
 *
 * Non-diagnostic: these helpers compute factual age values only. No developmental
 * claim, score, or interpretation is made here.
 */

import type { ChildProfile } from "../types";

/** AAP: stop correcting for prematurity at 24 months chronological age. */
const CORRECTION_CEILING_MONTHS = 24;
/** Weeks in a gestational term. */
const TERM_WEEKS = 40;

// ── Core arithmetic ──────────────────────────────────────────────────────────

/**
 * Whole months between `birthDate` (ISO YYYY-MM-DD) and `now`.
 * Uses floor so a child born on the 15th is still "8 months" on the 14th of
 * the following month. Returns 0 when `now` is before `birthDate`.
 */
export function chronologicalAgeMonths(birthDate: string, now?: Date): number {
  const ref = now ?? new Date();
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return 0;

  let months =
    (ref.getFullYear() - birth.getFullYear()) * 12 +
    (ref.getMonth() - birth.getMonth());

  // If the day-of-month hasn't arrived yet this month, subtract one month.
  if (ref.getDate() < birth.getDate()) months -= 1;

  return Math.max(0, months);
}

/**
 * Corrected (adjusted) age in months for a preterm child, following AAP
 * guidance:
 *  - Correction: subtract `(40 − gestationalWeeks)` weeks, converted to months.
 *  - Only applied while chronological age < 24 months; after that the child's
 *    corrected age equals their chronological age (correction stops).
 *  - For a term baby (gestationalWeeks ≥ 40) or when gestationalWeeks is absent,
 *    returns chronological age unchanged.
 *
 * Returns `null` only when the underlying chronological age is null (i.e. the
 * profile has no age data at all). When `birthDate` is absent, falls back
 * through `ageMonths` then `age * 12` for the chronological base.
 */
export function correctedAgeMonths(profile: ChildProfile, now?: Date): number | null {
  const chrono = ageMonthsFromProfile(profile, now);
  if (chrono === null) return null;

  const gestationalWeeks = profile.preterm?.gestationalWeeks;
  if (gestationalWeeks == null || gestationalWeeks >= TERM_WEEKS) return chrono;

  // AAP: stop correction once chronological age is 24+ months.
  if (chrono >= CORRECTION_CEILING_MONTHS) return chrono;

  const adjustmentWeeks = TERM_WEEKS - gestationalWeeks;
  // Convert weeks to months using the standard 12/52 factor.
  const corrected = chrono - adjustmentWeeks * (12 / 52);
  return Math.max(0, Math.round(corrected * 10) / 10);
}

// ── Profile-level derivation ─────────────────────────────────────────────────

/**
 * The child's age in months from the profile, using the best available source:
 *  1. `birthDate` (ISO YYYY-MM-DD) → exact months from `now`.
 *  2. `ageMonths` → the explicit months value stored during onboarding.
 *  3. `age` (whole years) × 12 → legacy fallback for profiles created before B0.
 *
 * Returns `null` only when none of these fields carry a usable value
 * (e.g. a profile where all three are absent/undefined).
 */
export function ageMonthsFromProfile(profile: ChildProfile, now?: Date): number | null {
  // Prefer birth date — most precise.
  if (profile.birthDate) {
    return chronologicalAgeMonths(profile.birthDate, now);
  }
  // Explicit months fallback.
  if (typeof profile.ageMonths === "number" && Number.isFinite(profile.ageMonths)) {
    return Math.max(0, profile.ageMonths);
  }
  // Legacy year fallback — always present on existing profiles.
  if (typeof profile.age === "number" && Number.isFinite(profile.age)) {
    return Math.max(0, Math.round(profile.age * 12));
  }
  return null;
}

/**
 * Back-compat year value derived from the months-precise age.
 * Equivalent to `Math.floor(ageMonths / 12)`.
 * Returns 0 when no age data is available (never returns null, so callers that
 * still read `.age` get a safe zero rather than a crash).
 */
export function ageYearsFromProfile(profile: ChildProfile, now?: Date): number {
  const months = ageMonthsFromProfile(profile, now);
  if (months === null) return 0;
  return Math.floor(months / 12);
}

// ── Display label (optional helper) ─────────────────────────────────────────

/**
 * Calm, factual age label for display: "9 months", "1 year 3 months", "4 years".
 * Not a clinical claim — just a human-readable summary of a factual date.
 *
 * `t` is an optional translation shim; if omitted, English strings are used.
 * Keys: `age.months`, `age.year`, `age.years`, `age.yearMonths`, `age.yearsMonths`.
 */
export function ageLabel(
  profile: ChildProfile,
  t?: (key: string, vars?: Record<string, number>) => string,
  now?: Date,
): string {
  const months = ageMonthsFromProfile(profile, now);
  if (months === null) return "";

  const tr = (key: string, vars?: Record<string, number>) =>
    t ? t(key, vars) : defaultLabel(key, vars);

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0) return tr("age.months", { n: months });
  if (remainingMonths === 0)
    return years === 1 ? tr("age.year") : tr("age.years", { n: years });
  return years === 1
    ? tr("age.yearMonths", { m: remainingMonths })
    : tr("age.yearsMonths", { n: years, m: remainingMonths });
}

function defaultLabel(key: string, vars?: Record<string, number>): string {
  const n = vars?.n ?? 0;
  const m = vars?.m ?? 0;
  switch (key) {
    case "age.months": return `${vars?.n ?? 0} month${(vars?.n ?? 0) !== 1 ? "s" : ""}`;
    case "age.year": return "1 year";
    case "age.years": return `${n} years`;
    case "age.yearMonths": return `1 year ${m} month${m !== 1 ? "s" : ""}`;
    case "age.yearsMonths": return `${n} years ${m} month${m !== 1 ? "s" : ""}`;
    default: return key;
  }
}

// ── Onboarding utility ───────────────────────────────────────────────────────

/**
 * Derive an approximate birth date (ISO YYYY-MM-DD) from an entered age in
 * months, anchored to `now`. Used during onboarding when the parent enters
 * "9 months" rather than an exact DOB — the stored date is approximate but
 * round-trips correctly through `ageMonthsFromProfile`.
 *
 * The resulting date is the first day of the birth month (day 01) to avoid
 * edge-case off-by-one issues around month boundaries.
 */
export function birthDateFromAgeMonths(ageMonths: number, now?: Date): string {
  const ref = now ?? new Date();
  const totalMonths = ref.getFullYear() * 12 + ref.getMonth();
  const birthTotalMonths = totalMonths - Math.round(ageMonths);
  const birthYear = Math.floor(birthTotalMonths / 12);
  const birthMonth = birthTotalMonths % 12; // 0-indexed
  const mm = String(birthMonth + 1).padStart(2, "0");
  return `${birthYear}-${mm}-01`;
}
