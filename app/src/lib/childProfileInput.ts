import type { ChildProfile } from "../types";
import { isoDateOf } from "./childAge";

export type ChildGender = "girl" | "boy" | "other" | "unspecified";

export type BuildNewChildInputParams = {
  name: string;
  ageMonths: number;
  gender: ChildGender;
  languages: string[];
  strengthsText: string;
  challengesText: string;
  now?: Date;
};

const toLines = (text: string) =>
  text.split("\n").map((s) => s.trim()).filter(Boolean);

const clampAgeMonths = (ageMonths: number) => Math.max(0, Math.min(216, Math.round(ageMonths)));

/**
 * Builds the Add Child payload in one tested place so profile creation always
 * carries the months-precise age spine used by recommendations.
 *
 * B-DATA-03: months only — `ageMonths` + the date it was true on
 * (`ageMonthsAsOf`). No `birthDate` is invented from the months value; the
 * key is absent unless a parent typed a real date somewhere else.
 */
export function buildNewChildInput(params: BuildNewChildInputParams): Omit<ChildProfile, "id"> {
  const ageMonths = clampAgeMonths(params.ageMonths);
  return {
    name: params.name.trim() || "New Child",
    age: Math.floor(ageMonths / 12),
    ageMonths,
    ageMonthsAsOf: isoDateOf(params.now),
    gender: params.gender,
    languages: params.languages.length ? params.languages : ["English"],
    schoolContext: "",
    strengths: toLines(params.strengthsText),
    challenges: toLines(params.challengesText),
    riskLevel: "Low",
  };
}
