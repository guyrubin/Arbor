/**
 * B-PROG-02 — the program registry (B-PROG-01 shape, content/programs/types).
 * v1 carries Talk Together and Steady Nights (thesis §8, E2: Talk Together
 * first, Steady Nights second — B-PROG-06). Every program here ships
 * `reviewStatus: "draft"` until the clinical reviewer signs.
 *
 * B-PROG-01 (engine): the ONE index the engine, the chooser's caller, the
 * Notice hook and CompanionContext read — both programs, their metas (the
 * name and the rest the `Program` shape does not carry) and the lookups.
 */
import type { LocalizedText } from "../governance";
import type { Program, ProgramWeek } from "./types";
import { TALK_TOGETHER, TALK_TOGETHER_DOSE, TALK_TOGETHER_META } from "./talkTogether";
import { STEADY_NIGHTS, STEADY_NIGHTS_DOSE, STEADY_NIGHTS_META } from "./steadyNights";

export { TALK_TOGETHER, TALK_TOGETHER_DOSE, TALK_TOGETHER_META } from "./talkTogether";
export { STEADY_NIGHTS, STEADY_NIGHTS_DOSE, STEADY_NIGHTS_META } from "./steadyNights";

export const PROGRAMS: readonly Program[] = [TALK_TOGETHER, STEADY_NIGHTS];

/** The per-program fields every meta carries (name, age band, words, dose). */
export interface ProgramMetaCommon {
  name: LocalizedText;
  builtFor: { fromMonths: number; toMonths: number };
  describedAs: LocalizedText;
}

export const PROGRAM_METAS: Readonly<Record<string, ProgramMetaCommon>> = {
  [TALK_TOGETHER.id]: TALK_TOGETHER_META,
  [STEADY_NIGHTS.id]: STEADY_NIGHTS_META,
};

/** The dose measure's words per program (`measures.dose: true`). */
export const PROGRAM_DOSE = {
  [TALK_TOGETHER.id]: TALK_TOGETHER_DOSE,
  [STEADY_NIGHTS.id]: STEADY_NIGHTS_DOSE,
} as const;

export function programById(id: string): Program | undefined {
  return PROGRAMS.find((program) => program.id === id);
}

export function programMeta(id: string): ProgramMetaCommon | undefined {
  return Object.prototype.hasOwnProperty.call(PROGRAM_METAS, id) ? PROGRAM_METAS[id] : undefined;
}

/** The program's display name (EN + HE); undefined for an unknown id. */
export function programName(id: string): LocalizedText | undefined {
  return programMeta(id)?.name;
}

/** Week n (1-based) of a program, clamped to its weeks; undefined for no weeks. */
export function programWeek(program: Program, n: number): ProgramWeek | undefined {
  if (!program.weeks.length) return undefined;
  const k = Math.min(program.weeks.length, Math.max(1, Math.floor(Number.isFinite(n) ? n : 1)));
  return program.weeks.find((w) => w.n === k) ?? program.weeks[k - 1];
}
