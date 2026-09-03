import type { ChildProfile } from "../types";
import { birthDateFromAgeMonths, chronologicalAgeMonths } from "./childAge";

export type ChildGender = "girl" | "boy" | "other" | "unspecified";

// ── MOB-11 / GP-03 — the ONE child-age input ────────────────────────────────
// Every surface that asks for a child's age (OnboardingFlow step 2,
// AddChildModal, ProfileEditDrawer) renders components/profile/ChildAgeField
// and writes the three stored fields { birthDate, ageMonths, age } through
// buildChildAgeFields — never one field alone (the split-brain GP-03 found).

/** What the parent entered: an exact date of birth, or an age when unsure. */
export type ChildAgeInput =
  | { mode: "dob"; birthDate: string }
  | { mode: "age"; ageMonths: number };

/** The three age fields every consumer reads (birthDate is the gold source). */
export interface ChildAgeFields {
  birthDate: string;
  ageMonths: number;
  age: number;
}

const MAX_AGE_MONTHS = 216; // 18 years — the DOB picker's floor and the stepper's ceiling

const clampAgeMonths = (ageMonths: number) =>
  Math.max(0, Math.min(MAX_AGE_MONTHS, Math.round(Number.isFinite(ageMonths) ? ageMonths : 0)));

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** `<input type="date">` bounds: today back to today − 18 years. */
export function dobBounds(now: Date = new Date()): { min: string; max: string } {
  const min = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  return { min: isoDay(min), max: isoDay(now) };
}

/** A DOB is valid when it parses and lies within dobBounds(now). */
export function isValidBirthDate(birthDate: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return false;
  const { min, max } = dobBounds(now);
  return birthDate >= min && birthDate <= max;
}

/** True when the input can be saved (a valid DOB, or any age). */
export function isAgeInputComplete(input: ChildAgeInput, now?: Date): boolean {
  return input.mode === "age" ? true : isValidBirthDate(input.birthDate, now);
}

/** Months the input resolves to (0 for an empty / invalid DOB). */
export function ageMonthsOfInput(input: ChildAgeInput, now?: Date): number {
  if (input.mode === "age") return clampAgeMonths(input.ageMonths);
  return isValidBirthDate(input.birthDate, now) ? clampAgeMonths(chronologicalAgeMonths(input.birthDate, now)) : 0;
}

/**
 * The ONE builder: DOB mode stores the exact date (round-trips to the day);
 * age mode stores the parent's months and an approximate first-of-month
 * birthDate (the pre-existing fallback), so both modes fill all three fields.
 */
export function buildChildAgeFields(input: ChildAgeInput, now?: Date): ChildAgeFields {
  const ageMonths = ageMonthsOfInput(input, now);
  const birthDate =
    input.mode === "dob" && isValidBirthDate(input.birthDate, now)
      ? input.birthDate
      : birthDateFromAgeMonths(ageMonths, now);
  return { birthDate, ageMonths, age: Math.floor(ageMonths / 12) };
}

/** Seed the field from a stored profile: an exact DOB wins; otherwise the months/years fallback. */
export function ageInputFromProfile(
  profile: Pick<ChildProfile, "birthDate" | "ageMonths" | "age">,
  now?: Date,
): ChildAgeInput {
  // A stored day-01 date is the approximate one buildChildAgeFields fabricates
  // from an age entry; only a "real" day is offered back as a DOB.
  if (profile.birthDate && isValidBirthDate(profile.birthDate, now) && !profile.birthDate.endsWith("-01")) {
    return { mode: "dob", birthDate: profile.birthDate };
  }
  if (profile.birthDate && isValidBirthDate(profile.birthDate, now)) {
    return { mode: "age", ageMonths: clampAgeMonths(chronologicalAgeMonths(profile.birthDate, now)) };
  }
  if (typeof profile.ageMonths === "number" && Number.isFinite(profile.ageMonths)) {
    return { mode: "age", ageMonths: clampAgeMonths(profile.ageMonths) };
  }
  return { mode: "age", ageMonths: clampAgeMonths((profile.age ?? 0) * 12) };
}

// ── Add Child payload ────────────────────────────────────────────────────────

export type BuildNewChildInputParams = {
  name: string;
  /** MOB-11: the ChildAgeField value. */
  age?: ChildAgeInput;
  /** Legacy months entry (pre-MOB-11 callers); ignored when `age` is given. */
  ageMonths?: number;
  gender: ChildGender;
  languages: string[];
  strengthsText: string;
  challengesText: string;
  /** MOB-10: the default home language follows the app language (he → Hebrew). */
  uiLang?: "en" | "he";
  now?: Date;
};

const toLines = (text: string) =>
  text.split("\n").map((s) => s.trim()).filter(Boolean);

/** MOB-10: IL-first — a Hebrew interface defaults the home language to Hebrew. */
export const defaultHomeLanguages = (uiLang?: "en" | "he"): string[] => (uiLang === "he" ? ["Hebrew"] : ["English"]);

/**
 * Builds the Add Child payload in one tested place so profile creation always
 * carries the months-precise age spine used by recommendations.
 */
export function buildNewChildInput(params: BuildNewChildInputParams): Omit<ChildProfile, "id"> {
  const ageInput: ChildAgeInput = params.age ?? { mode: "age", ageMonths: params.ageMonths ?? 0 };
  const ageFields = buildChildAgeFields(ageInput, params.now);
  return {
    name: params.name.trim() || "New Child",
    ...ageFields,
    gender: params.gender,
    languages: params.languages.length ? params.languages : defaultHomeLanguages(params.uiLang),
    schoolContext: "",
    strengths: toLines(params.strengthsText),
    challenges: toLines(params.challengesText),
    riskLevel: "Low",
  };
}
