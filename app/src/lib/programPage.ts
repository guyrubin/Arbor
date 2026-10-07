/**
 * B-PROG-05 — the program page's VIEW MODEL (pure: no React, no Firebase).
 * Reads the B-PROG-01 engine (lib/programs/enrolment + measures, read-only)
 * and the program content (content/programs, read-only) and returns what the
 * page renders and what the professional's packet line says.
 *
 * FIREWALL (laws 1 + 9): three COUNTS, each beside the family's OWN first
 * week — never another child, never a rate, a %, a colour, a bar or a trend
 * arrow. Week 1 has no baseline beside it (it IS the baseline). Zero model
 * calls: nothing here is AI.
 *
 * The packet line (`programPacketLine`) is the text consult/packet.ts carries
 * when the child is enrolled (packet hunk = REJECTIONS P6-PRACTICE session A,
 * B-PROG-05: consult/ is not this builder's file). It lives in lib/ so the
 * packet can import it without reaching into components/.
 */
import type { ActionLoopEntry } from "../actionLoop/model";
import type { SleepLogEntry } from "../types";
import type { Observation } from "./observations";
import type { ShelfId } from "./shelves/registry";
import { PROGRAMS, PROGRAM_DOSE, programById, programMeta, programWeek } from "../content/programs";
import { activeEnrolment, programWeekAt, validEnrolments, type ProgramEnrolment } from "./programs/enrolment";
import { programWeekMeasures } from "./programs/measures";
import { resolveHebrewSlash } from "./hebrewSlashGender";

export type ProgramLang = "en" | "he";
type T = (key: string, vars?: Record<string, string | number>) => string;

export interface ProgramCount {
  /** dose = practice days · parent = the program's parent proxy · child = its child proxy. */
  id: "dose" | "parent" | "child";
  /** The program's own measure id (practice-days, turns-waited, new-words, …). */
  measureId: string;
  /** The program's own label for the measure, in the page language. */
  label: string;
  unit: string;
  /** This week's count; null when its source is not loaded (or the diary is empty). */
  value: number | null;
  /** Practice days only: last week's count (week ≥ 2), else null. */
  lastWeek: number | null;
  /** The practice days / diary nights the count came from, when the measure has one. */
  from: number | null;
  /** The family's OWN first-week count (week ≥ 2 only); null in week 1 or before one exists. */
  baseline: number | null;
}

export interface ProgramWeekRow {
  n: number;
  /** The week's short title (the skill up to its colon, else the whole skill). */
  title: string;
  skill: string;
  state: "done" | "current" | "future";
}

export interface ProgramPageModel {
  enrolment: ProgramEnrolment;
  programId: string;
  name: string;
  describedAs: string;
  shelf: ShelfId;
  status: "active" | "paused";
  week: number;
  weeks: number;
  /** This week's skill sentence (Hebrew slash forms resolved from the child's gender). */
  skill: string;
  counts: ProgramCount[];
  weekRows: ProgramWeekRow[];
}

export interface ProgramPageInputs {
  childId: string;
  actionLoops?: readonly ActionLoopEntry[];
  sleepLogs?: readonly SleepLogEntry[];
  observations?: ReadonlyArray<Pick<Observation, "at" | "shelf" | "value">>;
}

const loc = (text: { en: string; he: string }, lang: ProgramLang, gender?: string | null): string =>
  lang === "he" ? resolveHebrewSlash(text.he, gender ?? null) : text.en;

/** The enrolment the page shows: the active one, else the newest paused one; done enrolments never. */
export function currentEnrolment(rows: readonly unknown[]): ProgramEnrolment | null {
  const active = activeEnrolment(rows);
  if (active) return active;
  const paused = validEnrolments(rows).filter((e) => e.status === "paused");
  paused.sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id));
  return paused[0] ?? null;
}

/** A week's short title: the skill up to its colon ("Add one word"), else the whole sentence. */
export function weekTitle(skill: string): string {
  const i = skill.indexOf(":");
  return i > 0 && i <= 48 ? skill.slice(0, i).trim() : skill.trim();
}

export function programPageModel(
  rows: readonly unknown[],
  inputs: ProgramPageInputs,
  now: Date,
  lang: ProgramLang,
  gender?: string | null,
): ProgramPageModel | null {
  const enrolment = currentEnrolment(rows);
  if (!enrolment || (enrolment.status !== "active" && enrolment.status !== "paused")) return null;
  const program = programById(enrolment.programId);
  const meta = programMeta(enrolment.programId);
  if (!program || !meta) return null;
  const weeks = Math.max(1, program.weeks.length);
  const week = programWeekAt(enrolment, program, now);
  const content = programWeek(program, week);
  if (!content) return null;

  const m = programWeekMeasures(enrolment, week, inputs);
  const first = week > 1 ? programWeekMeasures(enrolment, 1, inputs) : null;
  const prev = week > 1 ? programWeekMeasures(enrolment, week - 1, inputs) : null;
  const dose = PROGRAM_DOSE[program.id as keyof typeof PROGRAM_DOSE];
  const p = program.measures.parentProxy;
  const c = program.measures.childProxy;
  const childBaseline = week > 1 ? enrolment.baseline?.childProxy ?? first?.childProxy?.value ?? null : null;

  const counts: ProgramCount[] = [
    {
      id: "dose",
      measureId: dose?.id ?? "practice-days",
      label: dose ? loc(dose.label, lang, gender) : "",
      unit: dose ? loc(dose.unit, lang, gender) : "",
      value: m?.dose ?? null,
      lastWeek: prev?.dose ?? null,
      from: null,
      baseline: first?.dose ?? null,
    },
    {
      id: "parent",
      measureId: p.id,
      label: loc(p.label, lang, gender),
      unit: loc(p.unit, lang, gender),
      value: m?.parentProxy?.value ?? null,
      lastWeek: null,
      from: typeof m?.parentProxy?.from === "number" ? m.parentProxy.from : null,
      baseline: first?.parentProxy?.value ?? null,
    },
    {
      id: "child",
      measureId: c.id,
      label: loc(c.label, lang, gender),
      unit: loc(c.unit, lang, gender),
      value: m?.childProxy?.value ?? null,
      lastWeek: null,
      from: typeof m?.childProxy?.from === "number" ? m.childProxy.from : null,
      baseline: childBaseline,
    },
  ];

  const weekRows: ProgramWeekRow[] = [...program.weeks]
    .sort((a, b) => a.n - b.n)
    .map((w) => {
      const skill = loc(w.skill, lang, gender);
      const state: ProgramWeekRow["state"] = w.n < week ? "done" : w.n === week ? "current" : "future";
      return { n: w.n, title: weekTitle(skill), skill, state };
    });

  return {
    enrolment,
    programId: program.id,
    name: loc(meta.name, lang),
    describedAs: loc(meta.describedAs, lang),
    shelf: program.shelf,
    status: enrolment.status,
    week,
    weeks,
    skill: loc(content.skill, lang, gender),
    counts,
    weekRows,
  };
}

/**
 * The professional's packet line, plain text:
 * "Talk Together: week 5 of 8 · practice days 4/7 this week · Turns you waited
 * for: 9 (from 4 practice days; first week 3) · New words this week: 2 (first week 1)".
 * Parent proxy and child proxy are COUNTS with their own first week; a count
 * whose source is not loaded is left out (never shown as zero).
 */
export function programPacketLine(model: ProgramPageModel, t: T): string {
  const dose = model.counts.find((c) => c.id === "dose");
  const parts = [t("elev.program.packet.line", { program: model.name, n: model.week, total: model.weeks, d: dose?.value ?? 0 })];
  for (const c of model.counts) {
    if (c.id === "dose" || c.value === null) continue;
    const extra = [
      c.from !== null ? t(`elev.program.counts.from.${c.measureId}`, { n: c.from }) : "",
      c.baseline !== null ? t("elev.program.packet.first", { n: c.baseline }) : "",
    ].filter(Boolean);
    const count = t("elev.program.packet.count", { label: c.label, value: c.value });
    parts.push(extra.length ? `${count} (${extra.join("; ")})` : count);
  }
  return parts.join(" · ");
}

/** A program the family can start from the quiet page. */
export interface StartableProgram {
  id: string;
  name: string;
  describedAs: string;
  shelf: ShelfId;
  weeks: number;
  builtFor: { fromMonths: number; toMonths: number };
  /** The youngest age the program enrols (Steady Nights: 12 months). */
  enrolFromMonths: number;
  /** False when the child is younger than enrolFromMonths (the Start control is not offered). */
  canEnrol: boolean;
}

export function startablePrograms(ageMonths: number | null, lang: ProgramLang): StartableProgram[] {
  return PROGRAMS.map((program) => {
    const meta = programMeta(program.id)!;
    const from = (meta as { enrolFromMonths?: number }).enrolFromMonths ?? 0;
    return {
      id: program.id,
      name: loc(meta.name, lang),
      describedAs: loc(meta.describedAs, lang),
      shelf: program.shelf,
      weeks: program.weeks.length,
      builtFor: meta.builtFor,
      enrolFromMonths: from,
      canEnrol: ageMonths === null || ageMonths >= from,
    };
  });
}
