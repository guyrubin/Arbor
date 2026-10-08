/**
 * B-PROG-09 (template) — THE HOME PROGRAM: the professional's home program,
 * entered by the parent after a visit, in the parent's own words. PURE (no
 * React, no Firebase, no model call). The caller persists what these return:
 *  - the enrolment at users/{uid}/children/{childId}/programs/{enrolment.id}
 *    (the same `programs` sub-collection as the content programs, so export +
 *    erase already cover it — lib/childData CHILD_SUBCOLLECTIONS);
 *  - each ACCEPTED goal at .../familyGoals/{goal.id} (lib/goals).
 *
 * A TEMPLATE, not content: program id `home-<profession>` (the consult intake
 * professions — speech, OT, PT, psychology, pediatrician), instantiated from
 * the parent's entry:
 *  - weeks = whole weeks until the next visit (rounded up, 1–12); 4 when no
 *    visit is booked (HOME_PROGRAM_DEFAULT_WEEKS);
 *  - each exercise the parent wrote becomes a FAMILY-AUTHORED practice on the
 *    shelf the parent picked (default: the profession's shelf,
 *    HOME_PROFESSION_SHELF). It lives on the enrolment (`home.exercises`),
 *    never in content/practices.ts — it is the family's text, verbatim;
 *  - each goal the professional proposed becomes a FAMILY goal only when the
 *    parent accepts it in their own words and writes their own five scale
 *    words (`acceptProposedGoal` → lib/goals setGoal with `proposedBy`, the
 *    provenance). Nothing here writes a goal by itself.
 *
 * Coexists with the content programs (Talk Together, Steady Nights): the
 * engine's one-active-program rule (lib/programs/enrolment enrolInProgram)
 * governs Arbor's own programs, and `validEnrolments` there drops every
 * `home-*` row (programById knows only the registry) — so the chooser, the
 * program page and CompanionContext never read a home program, and no model
 * ever reads the family's exercise text. A newer home program from the same
 * profession finishes the older one (the next visit's program replaces it).
 *
 * FIREWALL: adherence is practice DAYS as counts (`homeAdherence`), never a
 * rate, a % or a verdict; "proposed by {profession}" is provenance, never an
 * instruction the app gives. The professional's program is not reviewed by
 * Arbor (reviewStatus stays "draft"; it publishes nowhere).
 */
import type { LocalizedText } from "../governance";
import type { Program, ProgramWeek } from "./types";
import { SHELF_IDS, type ShelfId } from "../../lib/shelves/registry";
import { dayKey, daysBetween, enrolmentId, type ProgramEnrolment } from "../../lib/programs/enrolment";
import { setGoal, type FamilyGoal, type GoalScaleKey, type SetGoalResult } from "../../lib/goals";
import { en as PRACTICE_EN, he as PRACTICE_HE } from "../../lib/i18nElevation/practice";

/** The consult intake professions (consult/packet IntakeProfession) a home program can come from. */
export type HomeProfession = "slp" | "ot" | "pt" | "psychology" | "pediatrician";
export const HOME_PROFESSIONS: readonly HomeProfession[] = ["slp", "ot", "pt", "psychology", "pediatrician"];
export const isHomeProfession = (v: unknown): v is HomeProfession =>
  typeof v === "string" && (HOME_PROFESSIONS as readonly string[]).includes(v);

/** The shelf an exercise defaults to, per profession — a shelf over a registry
 *  domain the profession owns (lib/domains/registry DOMAINS[].professions;
 *  pinned in homeProgram.test.ts). The parent can pick any shelf per exercise. */
export const HOME_PROFESSION_SHELF: Readonly<Record<HomeProfession, ShelfId>> = {
  slp: "words",
  ot: "hands",
  pt: "moving",
  psychology: "feelings",
  pediatrician: "food",
};

export const HOME_PROGRAM_PREFIX = "home-";
export const HOME_PROGRAM_DEFAULT_WEEKS = 4;
export const HOME_PROGRAM_MAX_WEEKS = 12;
export const HOME_EXERCISES_MAX = 8;
export const HOME_EXERCISE_TEXT_MAX = 200;
export const HOME_GOALS_MAX = 3;

export const homeProgramId = (profession: HomeProfession): string => `${HOME_PROGRAM_PREFIX}${profession}`;
export const isHomeProgramId = (id: unknown): id is string =>
  typeof id === "string" && id.startsWith(HOME_PROGRAM_PREFIX) && isHomeProfession(id.slice(HOME_PROGRAM_PREFIX.length));
export const homeProgramProfession = (id: string): HomeProfession | null => {
  const p = id.startsWith(HOME_PROGRAM_PREFIX) ? id.slice(HOME_PROGRAM_PREFIX.length) : "";
  return isHomeProfession(p) ? p : null;
};

/** One exercise in the family's words, on the shelf the family picked. */
export interface HomeExercise {
  /** `ex-1`, `ex-2` … in the order the parent wrote them. */
  id: string;
  /** The exercise in the parent's own words (verbatim, trimmed). */
  text: string;
  shelf: ShelfId;
}

/** What a home-program enrolment carries beyond the engine's shape. */
export interface HomeProgramRecord {
  profession: HomeProfession;
  exercises: HomeExercise[];
  /** Whole weeks until the next visit (or the default). */
  weeks: number;
  /** LOCAL day key of the next visit, or null when none was booked. */
  nextVisit: string | null;
  /** The professional's goals as the parent wrote them down (provenance only;
   *  a goal enters familyGoals only when the parent accepts it). */
  proposedGoals: string[];
  /** Per exercise id: the LOCAL day keys the family marked it done (sorted, unique). */
  done: Record<string, string[]>;
}

export type HomeProgramEnrolment = ProgramEnrolment & { home: HomeProgramRecord };

/** The parent's entry from the after-visit flow. */
export interface HomeProgramEntry {
  profession: HomeProfession;
  exercises: ReadonlyArray<{ text: string; shelf?: ShelfId | null }>;
  goals?: readonly string[];
  /** LOCAL day key (YYYY-MM-DD) of the next visit; null/absent = not booked. */
  nextVisit?: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clean = (value: unknown, cap: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, cap) : "";
const isShelf = (v: unknown): v is ShelfId => typeof v === "string" && (SHELF_IDS as readonly string[]).includes(v);
const lt = (key: string): LocalizedText => ({ en: PRACTICE_EN[key] ?? key, he: PRACTICE_HE[key] ?? key });

/** Whole weeks from today until the next visit (rounded up, 1–12); the default when none / past / invalid. */
export function homeProgramWeeks(nextVisit: string | null | undefined, now: Date = new Date()): number {
  if (!nextVisit || !DATE.test(nextVisit)) return HOME_PROGRAM_DEFAULT_WEEKS;
  const days = daysBetween(dayKey(now), nextVisit);
  if (!Number.isFinite(days) || days <= 0) return HOME_PROGRAM_DEFAULT_WEEKS;
  return Math.min(HOME_PROGRAM_MAX_WEEKS, Math.max(1, Math.ceil(days / 7)));
}

/** The exercises the entry yields: trimmed, empty ones dropped, at most eight, each on its shelf. */
export function homeExercises(entry: Pick<HomeProgramEntry, "profession" | "exercises">): HomeExercise[] {
  const fallback = HOME_PROFESSION_SHELF[entry.profession];
  const out: HomeExercise[] = [];
  for (const ex of entry.exercises ?? []) {
    const text = clean(ex?.text, HOME_EXERCISE_TEXT_MAX);
    if (!text) continue;
    out.push({ id: `ex-${out.length + 1}`, text, shelf: isShelf(ex?.shelf) ? ex.shelf : fallback });
    if (out.length >= HOME_EXERCISES_MAX) break;
  }
  return out;
}

/** The program shape of a home program (content/programs/types `Program`): every week
 *  carries the family's exercises; no coach scripts, no watch-for rows, no sources
 *  (the program is the professional's, not Arbor's). */
export function homeProgramFromRecord(record: HomeProgramRecord): Program {
  const weeks: ProgramWeek[] = Array.from({ length: Math.max(1, record.weeks) }, (_, i) => ({
    n: i + 1,
    skill: lt("elev.homeProgram.parentSkill"),
    practices: record.exercises.map((e) => e.id),
    coachScripts: [],
    watchFor: [],
  }));
  return {
    id: homeProgramId(record.profession),
    shelf: record.exercises[0]?.shelf ?? HOME_PROFESSION_SHELF[record.profession],
    weeks,
    parentSkill: lt("elev.homeProgram.parentSkill"),
    evidence: { techniques: [], sources: [] },
    measures: {
      dose: true,
      parentProxy: {
        id: "home-practice-days",
        label: lt("elev.homeProgram.measure.days.label"),
        countingRule: lt("elev.homeProgram.measure.days.rule"),
        source: "selfCount",
        unit: lt("elev.homeProgram.measure.days.unit"),
      },
      childProxy: {
        id: "home-exercise-days",
        label: lt("elev.homeProgram.measure.exercise.label"),
        countingRule: lt("elev.homeProgram.measure.exercise.rule"),
        source: "selfCount",
        unit: lt("elev.homeProgram.measure.days.unit"),
      },
    },
    reviewStatus: "draft",
  };
}

const isRecord = (h: unknown): h is HomeProgramRecord => {
  if (!h || typeof h !== "object") return false;
  const r = h as Partial<HomeProgramRecord>;
  return isHomeProfession(r.profession) && Array.isArray(r.exercises) && r.exercises.length > 0 && typeof r.weeks === "number";
};

/** Every home-program enrolment row a reader can trust (any status). */
export function homeEnrolments(rows: readonly unknown[]): HomeProgramEnrolment[] {
  const out: HomeProgramEnrolment[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Partial<HomeProgramEnrolment>;
    if (!isHomeProgramId(r.programId) || typeof r.startedAt !== "string" || !DATE.test(r.startedAt)) continue;
    if (r.status !== "active" && r.status !== "paused" && r.status !== "done") continue;
    if (!isRecord(r.home)) continue;
    out.push(r as HomeProgramEnrolment);
  }
  return out;
}

/** The active home programs, newest first (one per profession by construction). */
export function activeHomeEnrolments(rows: readonly unknown[]): HomeProgramEnrolment[] {
  return homeEnrolments(rows)
    .filter((e) => e.status === "active")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id));
}

/** The active home program of one profession, or null. */
export function activeHomeEnrolmentFor(rows: readonly unknown[], profession: HomeProfession): HomeProgramEnrolment | null {
  return activeHomeEnrolments(rows).find((e) => e.programId === homeProgramId(profession)) ?? null;
}

/** Narrow with `"enrolment" in result` / `"reason" in result` (the app tsconfig is not strict). */
export type StartHomeProgramResult =
  | { ok: true; enrolment: HomeProgramEnrolment; superseded: HomeProgramEnrolment[] }
  | { ok: false; reason: "no_exercises" | "unknown_profession" };

/**
 * Instantiate the template from the parent's entry: ONE enrolment carrying the
 * exercises (each on its shelf) and the professional's goals as the parent wrote
 * them down (provenance only). An active or paused home program of the SAME
 * profession is finished (returned in `superseded` for the caller to write).
 * Goals are NOT written here — see `acceptProposedGoal`.
 */
export function startHomeProgram(rows: readonly unknown[], entry: HomeProgramEntry, now: Date = new Date()): StartHomeProgramResult {
  if (!isHomeProfession(entry.profession)) return { ok: false, reason: "unknown_profession" };
  const exercises = homeExercises(entry);
  if (!exercises.length) return { ok: false, reason: "no_exercises" };
  const programId = homeProgramId(entry.profession);
  const startedAt = dayKey(now);
  const iso = now.toISOString();
  const nextVisit = entry.nextVisit && DATE.test(entry.nextVisit) ? entry.nextVisit : null;
  const superseded = homeEnrolments(rows)
    .filter((e) => e.programId === programId && e.status !== "done" && e.id !== enrolmentId(programId, startedAt))
    .map((e): HomeProgramEnrolment => {
      const { pausedAt: _drop, ...rest } = e;
      return { ...rest, status: "done", finishedAt: iso, updatedAt: iso };
    });
  const proposedGoals = (entry.goals ?? []).map((g) => clean(g, 200)).filter(Boolean).slice(0, HOME_GOALS_MAX);
  return {
    ok: true,
    superseded,
    enrolment: {
      id: enrolmentId(programId, startedAt),
      programId,
      startedAt,
      enrolledAt: iso,
      currentWeek: 1,
      status: "active",
      baseline: { childProxy: null, capturedAt: null },
      updatedAt: iso,
      home: {
        profession: entry.profession,
        exercises,
        weeks: homeProgramWeeks(nextVisit, now),
        nextVisit,
        proposedGoals,
        done: {},
      },
    },
  };
}

/**
 * The parent ACCEPTS a proposed goal in their own words (they may rewrite it)
 * with their own five scale words: a family goal marked proposed by the
 * profession (provenance), set under the home program. Same limits as any
 * family goal (lib/goals: three active at most, all five words required).
 */
export function acceptProposedGoal(
  existing: readonly FamilyGoal[],
  input: { text: string; scale: Partial<Record<GoalScaleKey, unknown>> },
  profession: HomeProfession,
  now: Date = new Date(),
): SetGoalResult {
  return setGoal(existing, { text: input.text, scale: input.scale, programId: homeProgramId(profession), proposedBy: profession }, now);
}

/** Mark (or unmark) one exercise as done on `now`'s local day. Unknown exercise / non-active enrolment → unchanged. */
export function toggleExerciseDay(enrolment: HomeProgramEnrolment, exerciseId: string, now: Date = new Date()): HomeProgramEnrolment {
  if (enrolment.status !== "active" || !enrolment.home.exercises.some((e) => e.id === exerciseId)) return enrolment;
  const day = dayKey(now);
  const days = new Set(enrolment.home.done?.[exerciseId] ?? []);
  if (days.has(day)) days.delete(day);
  else days.add(day);
  return {
    ...enrolment,
    home: { ...enrolment.home, done: { ...(enrolment.home.done ?? {}), [exerciseId]: [...days].sort() } },
    updatedAt: now.toISOString(),
  };
}

/** Is the exercise marked done today? */
export const exerciseDoneToday = (enrolment: HomeProgramEnrolment, exerciseId: string, now: Date = new Date()): boolean =>
  (enrolment.home.done?.[exerciseId] ?? []).includes(dayKey(now));

/** ADHERENCE — counts only: practice days (any exercise) this program week and in all, days per exercise. */
export interface HomeAdherence {
  programId: string;
  profession: HomeProfession;
  status: ProgramEnrolment["status"];
  /** 1-based, clamped to the weeks. */
  week: number;
  weeks: number;
  nextVisit: string | null;
  /** Distinct days in the current program week with at least one exercise done (0–7). */
  daysThisWeek: number;
  /** Distinct days since the start with at least one exercise done. */
  daysInAll: number;
  exercises: Array<{ id: string; text: string; shelf: ShelfId; days: number }>;
}

export function homeAdherence(enrolment: HomeProgramEnrolment, now: Date = new Date()): HomeAdherence {
  const weeks = Math.max(1, enrolment.home.weeks);
  const today = dayKey(now);
  const elapsed = Math.max(0, daysBetween(enrolment.startedAt, today));
  const week = Math.min(weeks, Math.floor(elapsed / 7) + 1);
  const weekFrom = new Date(Date.UTC(+enrolment.startedAt.slice(0, 4), +enrolment.startedAt.slice(5, 7) - 1, +enrolment.startedAt.slice(8, 10)) + (week - 1) * 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const weekTo = new Date(Date.parse(`${weekFrom}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
  const valid = (d: string) => DATE.test(d) && d >= enrolment.startedAt && d <= today;
  const all = new Set<string>();
  const exercises = enrolment.home.exercises.map((e) => {
    const days = [...new Set((enrolment.home.done?.[e.id] ?? []).filter(valid))];
    days.forEach((d) => all.add(d));
    return { id: e.id, text: e.text, shelf: e.shelf, days: days.length };
  });
  return {
    programId: enrolment.programId,
    profession: enrolment.home.profession,
    status: enrolment.status,
    week,
    weeks,
    nextVisit: enrolment.home.nextVisit,
    daysThisWeek: [...all].filter((d) => d >= weekFrom && d <= weekTo).length,
    daysInAll: all.size,
    exercises,
  };
}

/** The goals proposed under this home program, in the family's words (the family goals marked proposedBy). */
export function homeProgramGoals(goals: readonly FamilyGoal[], enrolment: Pick<HomeProgramEnrolment, "programId" | "home">): FamilyGoal[] {
  return goals.filter((g) => !g.archivedAt && g.proposedBy === enrolment.home.profession && g.programId === enrolment.programId);
}
