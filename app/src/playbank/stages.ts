/* Micro-stage taxonomy — finer-grained developmental windows than the four
 * coarse bands. The coarse bands (infant/toddler/preschool/early-school) are
 * too wide to serve a 1.5-year-old differently from a 2.5-year-old; these
 * windows fix that, especially across 0–24 months where development moves fast.
 * Pure + deterministic. Coarse bands are kept (back-compat) and every stage maps
 * back to one.
 */

import type { PlayBand } from "./content";

export type Stage =
  | "0-3m" | "3-6m" | "6-9m" | "9-12m" | "12-18m" | "18-24m"
  | "2-3y" | "3-4y" | "4-5y" | "5-7y" | "7-9y" | "9-12y";

export interface StageDef {
  stage: Stage;
  label: string;
  /** Inclusive lower bound, exclusive upper bound, in months. */
  minMonths: number;
  maxMonths: number;
  band: PlayBand;
}

export const STAGES: StageDef[] = [
  { stage: "0-3m",   label: "0–3 months",   minMonths: 0,   maxMonths: 3,   band: "infant" },
  { stage: "3-6m",   label: "3–6 months",   minMonths: 3,   maxMonths: 6,   band: "infant" },
  { stage: "6-9m",   label: "6–9 months",   minMonths: 6,   maxMonths: 9,   band: "infant" },
  { stage: "9-12m",  label: "9–12 months",  minMonths: 9,   maxMonths: 12,  band: "infant" },
  { stage: "12-18m", label: "12–18 months", minMonths: 12,  maxMonths: 18,  band: "toddler" },
  { stage: "18-24m", label: "18–24 months", minMonths: 18,  maxMonths: 24,  band: "toddler" },
  { stage: "2-3y",   label: "2–3 years",    minMonths: 24,  maxMonths: 36,  band: "toddler" },
  { stage: "3-4y",   label: "3–4 years",    minMonths: 36,  maxMonths: 48,  band: "preschool" },
  { stage: "4-5y",   label: "4–5 years",    minMonths: 48,  maxMonths: 60,  band: "preschool" },
  { stage: "5-7y",   label: "5–7 years",    minMonths: 60,  maxMonths: 84,  band: "early-school" },
  { stage: "7-9y",   label: "7–9 years",    minMonths: 84,  maxMonths: 108, band: "early-school" },
  { stage: "9-12y",  label: "9–12 years",   minMonths: 108, maxMonths: 144, band: "early-school" },
];

const STAGE_BY_ID = new Map(STAGES.map((s) => [s.stage, s]));

/** Map an age in years (may be fractional, e.g. 1.5) to its micro-stage. */
export function ageToStage(ageYears: number): Stage {
  const months = Math.max(0, Math.round(ageYears * 12));
  const hit = STAGES.find((s) => months >= s.minMonths && months < s.maxMonths);
  if (hit) return hit.stage;
  return months < 0 ? "0-3m" : STAGES[STAGES.length - 1].stage; // clamp above 12y
}

export function stageDef(stage: Stage): StageDef {
  return STAGE_BY_ID.get(stage) ?? STAGES[0];
}

export function stageLabel(stage: Stage): string {
  return stageDef(stage).label;
}

export function stageToBand(stage: Stage): PlayBand {
  return stageDef(stage).band;
}

/** The micro-stages that fall within a coarse band — lets band-tagged content
 *  fan out across the finer grid for coverage and matching. */
export function bandStages(band: PlayBand): Stage[] {
  return STAGES.filter((s) => s.band === band).map((s) => s.stage);
}

/** Neighbouring stages (for "nearby" content fallback when a stage is thin). */
export function adjacentStages(stage: Stage): Stage[] {
  const i = STAGES.findIndex((s) => s.stage === stage);
  if (i === -1) return [];
  return [STAGES[i - 1]?.stage, STAGES[i + 1]?.stage].filter(Boolean) as Stage[];
}
