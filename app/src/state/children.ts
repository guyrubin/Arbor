import type { ChildProfile } from "../types";

/**
 * A-01 / A-02 — Multi-child family model.
 *
 * The moat is longitudinal, per-child memory, so the product must hold real
 * children, not one hard-coded demo. These pure helpers create and derive
 * child profiles; persistence and UI live elsewhere.
 */

export type NewChildInput = {
  name: string;
  birthMonthYear?: string; // "YYYY-MM"
  age?: number;
  languages?: string[];
  schoolContext?: string;
  strengths?: string[];
  challenges?: string[];
};

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "child";

/** Whole-year age from a "YYYY-MM" birth month, relative to `now`. */
export const ageFromBirth = (birthMonthYear: string, now: Date = new Date()): number => {
  const match = /^(\d{4})-(\d{1,2})$/.exec(birthMonthYear.trim());
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  let age = now.getFullYear() - year;
  if (now.getMonth() < month) age -= 1;
  return Math.max(0, age);
};

/** Map a whole-year age to the framework age band id. */
export const ageBandFor = (age: number): string => {
  if (age < 1) return "0-12m";
  if (age < 3) return "12-36m";
  if (age <= 5) return "3-5y";
  if (age <= 8) return "6-8y";
  return "9-12y";
};

export const createChildProfile = (input: NewChildInput): ChildProfile => {
  const age = input.age ?? (input.birthMonthYear ? ageFromBirth(input.birthMonthYear) : 0);
  return {
    id: `${slug(input.name)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim() || "My child",
    age,
    languages: input.languages?.length ? input.languages : ["English"],
    schoolContext: input.schoolContext?.trim() || "",
    strengths: input.strengths ?? [],
    challenges: input.challenges ?? [],
    riskLevel: "Low"
  };
};

/** Apply edits to an existing profile, recomputing age from birth month when given. */
export const updateChildProfile = (existing: ChildProfile, input: NewChildInput): ChildProfile => ({
  ...existing,
  name: input.name.trim() || existing.name,
  age: input.age ?? (input.birthMonthYear ? ageFromBirth(input.birthMonthYear) : existing.age),
  languages: input.languages?.length ? input.languages : existing.languages,
  schoolContext: input.schoolContext?.trim() ?? existing.schoolContext
});
