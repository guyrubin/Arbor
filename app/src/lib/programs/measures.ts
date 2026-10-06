/**
 * B-PROG-01 — the program MEASURES accessors (pure). Three counts per program
 * week, each against the family's OWN first week (never other children, never
 * a grade, never a trend arrow — clinical firewall). The counting rules are
 * the programs' own `countingRule` text (content/programs/*); this file is
 * their code, keyed by the measure id so a new program declares a measure and
 * the engine reads it here.
 *
 *  - DOSE (`measures.dose: true`, every program): local days in week n with a
 *    `practice.<childId>.<day>` row in actionLoops (source practice, status
 *    completed) whose outcome is not "not today". 0–7; a day counts once.
 *  - PARENT PROXY: "turns-waited" (Talk Together) = the sum of the parent's
 *    one-tap self-count after a practice (`ActionLoopEntry.selfCount`, 5+ = 5)
 *    over the week, with the number of practice days it came from;
 *    "routine-in-order" (Steady Nights) = nights tapped "Done in order"
 *    (lib/sleepDiary).
 *  - CHILD PROXY: "new-words" (Talk Together) = entries the parent filed on the
 *    Words shelf in the week (a `word` observation); "longest-stretch"
 *    (Steady Nights) = the week's middle diary night (lib/sleepDiary).
 *
 * The week's seven days are lib/sleepDiary `programWeekRange(startedAt, n)` —
 * the one definition every measure shares.
 */
import type { ActionLoopEntry } from "../../actionLoop/model";
import type { SleepLogEntry } from "../../types";
import type { Observation } from "../observations";
import type { Program } from "../../content/programs/types";
import { programById } from "../../content/programs";
import { nightsInWeek, programWeekRange, routineDoneInOrderCount, weekLongestStretch } from "../sleepDiary";
import { dayKey, type ProgramEnrolment } from "./enrolment";

export type WeekRange = { from: string; to: string };

/** The seven local days of program week n (1-based). */
export const programWeekDays = (enrolment: Pick<ProgramEnrolment, "startedAt">, n: number): WeekRange =>
  programWeekRange(enrolment.startedAt, n);

const inRange = (key: string, range: WeekRange): boolean => key >= range.from && key <= range.to;

/** The practice dose rows of one child in a week range (one per day by construction; "Not today" left out). */
function doseRows(rows: readonly ActionLoopEntry[], childId: string, range: WeekRange): ActionLoopEntry[] {
  const prefix = `practice.${childId}.`;
  const byDay = new Map<string, ActionLoopEntry>();
  for (const r of rows) {
    if (r.source !== "practice" || r.status !== "completed" || r.outcome === "not_today") continue;
    if (!r.id.startsWith(prefix)) continue;
    const day = r.id.slice(prefix.length);
    if (!inRange(day, range)) continue;
    byDay.set(day, r);
  }
  return [...byDay.values()];
}

/** DOSE: practice days in program week n (0–7). */
export function doseDays(rows: readonly ActionLoopEntry[], childId: string, enrolment: Pick<ProgramEnrolment, "startedAt">, n: number): number {
  return doseRows(rows, childId, programWeekDays(enrolment, n)).length;
}

/** Talk Together parent proxy: the week's sum of the parent's turn taps (5+ = 5) and the practice days it came from. */
export function turnsWaitedWeek(
  rows: readonly ActionLoopEntry[],
  childId: string,
  enrolment: Pick<ProgramEnrolment, "startedAt">,
  n: number,
): { turns: number; days: number } {
  let turns = 0;
  let days = 0;
  for (const r of doseRows(rows, childId, programWeekDays(enrolment, n))) {
    if (typeof r.selfCount !== "number" || !Number.isFinite(r.selfCount) || r.selfCount < 0) continue;
    turns += Math.min(5, Math.floor(r.selfCount));
    days += 1;
  }
  return { turns, days };
}

/** Entries on a shelf whose LOCAL day falls in the week (optionally one value type, e.g. "word"). */
export function shelfEntriesWeek(
  observations: ReadonlyArray<Pick<Observation, "at" | "shelf" | "value">>,
  shelf: Program["shelf"],
  range: WeekRange,
  valueType?: Observation["value"]["type"],
): number {
  let n = 0;
  for (const o of observations) {
    if (o.shelf !== shelf) continue;
    if (valueType && o.value?.type !== valueType) continue;
    const t = Date.parse(o.at);
    if (!Number.isFinite(t) || !inRange(dayKey(new Date(t)), range)) continue;
    n += 1;
  }
  return n;
}

/** What the accessors read; every list optional (absent = not loaded → that count is null). */
export interface ProgramMeasureInputs {
  childId: string;
  actionLoops?: readonly ActionLoopEntry[];
  sleepLogs?: readonly SleepLogEntry[];
  observations?: ReadonlyArray<Pick<Observation, "at" | "shelf" | "value">>;
}

/** One week's three counts. `parentProxy` / `childProxy` are null when their source is not loaded or (diary) empty. */
export interface ProgramWeekMeasures {
  week: number;
  range: WeekRange;
  dose: number | null;
  parentProxy: { id: string; value: number; from?: number } | null;
  childProxy: { id: string; value: number; from?: number } | null;
}

/** The week's three counts for an enrolment, by the program's own measure ids. */
export function programWeekMeasures(enrolment: ProgramEnrolment, n: number, inputs: ProgramMeasureInputs): ProgramWeekMeasures | null {
  const program = programById(enrolment.programId);
  if (!program) return null;
  const range = programWeekDays(enrolment, n);
  const dose = inputs.actionLoops ? doseDays(inputs.actionLoops, inputs.childId, enrolment, n) : null;

  let parentProxy: ProgramWeekMeasures["parentProxy"] = null;
  const pId = program.measures.parentProxy.id;
  if (pId === "turns-waited" && inputs.actionLoops) {
    const t = turnsWaitedWeek(inputs.actionLoops, inputs.childId, enrolment, n);
    parentProxy = { id: pId, value: t.turns, from: t.days };
  } else if (pId === "routine-in-order" && inputs.sleepLogs) {
    parentProxy = { id: pId, value: routineDoneInOrderCount(inputs.sleepLogs, range) };
  }

  let childProxy: ProgramWeekMeasures["childProxy"] = null;
  const cId = program.measures.childProxy.id;
  if (cId === "new-words" && inputs.observations) {
    childProxy = { id: cId, value: shelfEntriesWeek(inputs.observations, program.shelf, range, "word") };
  } else if (cId === "longest-stretch" && inputs.sleepLogs) {
    const w = weekLongestStretch(nightsInWeek(inputs.sleepLogs, range));
    childProxy = w ? { id: cId, value: w.hours, from: w.nights } : null;
  }
  return { week: n, range, dose, parentProxy, childProxy };
}

/** The measure ids the accessors know (a program declaring another id gets null counts until it is added here). */
export const KNOWN_MEASURE_IDS = { parentProxy: ["turns-waited", "routine-in-order"], childProxy: ["new-words", "longest-stretch"] } as const;
