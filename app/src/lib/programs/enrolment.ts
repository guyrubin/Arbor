/**
 * B-PROG-01 — THE PROGRAM ENGINE: enrolment, the week schedule, pause /
 * resume / finish. PURE (no React, no Firebase): every function returns the
 * document(s) to write; the caller persists them at
 * users/{uid}/children/{childId}/programs/{enrolment.id}
 * (useChildCollection(childId, "programs"); registered in
 * lib/childData CHILD_SUBCOLLECTIONS → export + erase).
 *
 *  - ONE active program per child: `enrolInProgram` refuses while another
 *    enrolment is active (the caller pauses or finishes it first); a paused
 *    enrolment of the SAME program is resumed, never duplicated.
 *  - `startedAt` is the LOCAL day key (YYYY-MM-DD) of week 1's first day —
 *    the same key lib/sleepDiary `programWeekRange(startedAt, n)` reads, so
 *    every measure counts the same seven days. `enrolledAt` is the ISO time.
 *  - Weeks advance by the calendar while ACTIVE only: a pause freezes the
 *    week (resume moves `startedAt` forward by the paused days), so a family
 *    who stops for a fortnight comes back to the week they left.
 *  - `currentWeek` is stored (1-based, clamped to the program's weeks) and
 *    refreshed by `syncCurrentWeek`; readers that have a clock use
 *    `programWeekAt` and never trust a stale stored value.
 *  - `baseline.childProxy` is the family's own first-week count (null until
 *    the first week closes) — the program page compares a week only with this
 *    child's own first week, never with other children (clinical firewall).
 */
import type { Program, ProgramWeek } from "../../content/programs/types";
import { programById, programWeek } from "../../content/programs";

export type ProgramEnrolmentStatus = "active" | "paused" | "done";

export interface ProgramEnrolment {
  /** Document id: `${programId}.${startedAt}` (one enrolment per program per start day). */
  id: string;
  programId: string;
  /** LOCAL day key (YYYY-MM-DD) of week 1's first day; moves forward on resume. */
  startedAt: string;
  /** ISO time the family enrolled. */
  enrolledAt: string;
  /** 1-based; clamped to the program's weeks. */
  currentWeek: number;
  status: ProgramEnrolmentStatus;
  /** The family's own first-week count of the program's child proxy. */
  baseline: { childProxy: number | null; capturedAt: string | null };
  /** LOCAL day key the enrolment was paused on (status "paused" only). */
  pausedAt?: string;
  /** ISO time the family finished (status "done" only). */
  finishedAt?: string;
  /** Optional parent-typed lines the program asks for (Steady Nights weeks 4–5),
   *  the parent's words verbatim, keyed by the meta's `parentNotes[].id`. */
  notes?: Record<string, string>;
  updatedAt: string;
}

const DAY_MS = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** LOCAL day key YYYY-MM-DD (the same key practice/signals `dayKey` writes; kept
 *  local so the server's CompanionContext does not bundle the practice module). */
export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const utcOf = (key: string): number => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const addDays = (key: string, days: number): string => new Date(utcOf(key) + days * DAY_MS).toISOString().slice(0, 10);
/** Whole local days from `from` to `to` (both day keys). */
export const daysBetween = (from: string, to: string): number => Math.round((utcOf(to) - utcOf(from)) / DAY_MS);

export const enrolmentId = (programId: string, startedAt: string): string => `${programId}.${startedAt}`;

/** Every enrolment row a reader can trust: a known program, a valid start day, a known status. */
export function validEnrolments(rows: readonly unknown[]): ProgramEnrolment[] {
  const out: ProgramEnrolment[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Partial<ProgramEnrolment>;
    if (typeof r.programId !== "string" || !programById(r.programId)) continue;
    if (typeof r.startedAt !== "string" || !DATE.test(r.startedAt)) continue;
    if (r.status !== "active" && r.status !== "paused" && r.status !== "done") continue;
    out.push(r as ProgramEnrolment);
  }
  return out;
}

/** The child's one active enrolment (the newest by start day if a race wrote two), or null. */
export function activeEnrolment(rows: readonly unknown[]): ProgramEnrolment | null {
  const active = validEnrolments(rows).filter((e) => e.status === "active");
  active.sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id));
  return active[0] ?? null;
}

/** The week number (1-based, clamped) an enrolment is in at `now`. Paused → the week it was paused in; done → the stored week. */
export function programWeekAt(enrolment: ProgramEnrolment, program: Program, now: Date = new Date()): number {
  const weeks = Math.max(1, program.weeks.length);
  const clamp = (n: number) => Math.min(weeks, Math.max(1, n));
  if (enrolment.status === "done") return clamp(enrolment.currentWeek || weeks);
  const until = enrolment.status === "paused" && enrolment.pausedAt && DATE.test(enrolment.pausedAt) ? enrolment.pausedAt : dayKey(now);
  return clamp(Math.floor(daysBetween(enrolment.startedAt, until) / 7) + 1);
}

/** The enrolment with `currentWeek` refreshed for `now` (same object when unchanged — the caller writes only on change). */
export function syncCurrentWeek(enrolment: ProgramEnrolment, now: Date = new Date()): ProgramEnrolment {
  const program = programById(enrolment.programId);
  if (!program) return enrolment;
  const week = programWeekAt(enrolment, program, now);
  return week === enrolment.currentWeek ? enrolment : { ...enrolment, currentWeek: week, updatedAt: now.toISOString() };
}

/** The active program, its week number and the week's content — what the chooser, Notice and the AI context read. */
export interface ActiveProgramWeek {
  enrolment: ProgramEnrolment;
  program: Program;
  week: number;
  content: ProgramWeek;
}

export function activeProgramWeek(rows: readonly unknown[], now: Date = new Date()): ActiveProgramWeek | null {
  const enrolment = activeEnrolment(rows);
  if (!enrolment) return null;
  const program = programById(enrolment.programId);
  if (!program) return null;
  const week = programWeekAt(enrolment, program, now);
  const content = programWeek(program, week);
  return content ? { enrolment, program, week, content } : null;
}

/** Narrow with `"enrolment" in result` / `"reason" in result`: the app's tsconfig
 *  is not strict, so a boolean `ok` discriminant does not narrow (CI TS2339). */
export type EnrolResult =
  | { ok: true; enrolment: ProgramEnrolment; resumed: boolean }
  | { ok: false; reason: "unknown_program" | "already_active"; active?: ProgramEnrolment };

/**
 * Enrol the child in a program today. Refused while ANY enrolment is active
 * (the same program included — it is already running). A paused enrolment of
 * the same program is resumed instead of starting over.
 */
export function enrolInProgram(rows: readonly unknown[], programId: string, now: Date = new Date()): EnrolResult {
  const program = programById(programId);
  if (!program) return { ok: false, reason: "unknown_program" };
  const active = activeEnrolment(rows);
  if (active) return { ok: false, reason: "already_active", active };
  const paused = validEnrolments(rows)
    .filter((e) => e.programId === programId && e.status === "paused")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  if (paused) {
    // resumeEnrolment already returns { ok: true, enrolment, resumed: true } or the refusal.
    return resumeEnrolment(rows, paused, now);
  }
  const startedAt = dayKey(now);
  const iso = now.toISOString();
  return {
    ok: true,
    resumed: false,
    enrolment: {
      id: enrolmentId(programId, startedAt),
      programId,
      startedAt,
      enrolledAt: iso,
      currentWeek: 1,
      status: "active",
      baseline: { childProxy: null, capturedAt: null },
      updatedAt: iso,
    },
  };
}

/** Pause an active enrolment: the week freezes where it is. A non-active enrolment is returned unchanged. */
export function pauseEnrolment(enrolment: ProgramEnrolment, now: Date = new Date()): ProgramEnrolment {
  if (enrolment.status !== "active") return enrolment;
  const program = programById(enrolment.programId);
  const currentWeek = program ? programWeekAt(enrolment, program, now) : enrolment.currentWeek;
  return { ...enrolment, status: "paused", pausedAt: dayKey(now), currentWeek, updatedAt: now.toISOString() };
}

/**
 * Resume a paused enrolment: `startedAt` moves forward by the paused days so
 * the family comes back to the week they left. Refused while ANOTHER
 * enrolment is active (one active program per child).
 */
export function resumeEnrolment(rows: readonly unknown[], enrolment: ProgramEnrolment, now: Date = new Date()): EnrolResult {
  if (!programById(enrolment.programId)) return { ok: false, reason: "unknown_program" };
  const active = activeEnrolment(rows);
  if (active && active.id !== enrolment.id) return { ok: false, reason: "already_active", active };
  if (enrolment.status !== "paused") return { ok: true, enrolment, resumed: false };
  const today = dayKey(now);
  const pausedDays = enrolment.pausedAt && DATE.test(enrolment.pausedAt) ? Math.max(0, daysBetween(enrolment.pausedAt, today)) : 0;
  const { pausedAt: _drop, ...rest } = enrolment;
  return {
    ok: true,
    resumed: true,
    enrolment: { ...rest, status: "active", startedAt: addDays(enrolment.startedAt, pausedDays), updatedAt: now.toISOString() },
  };
}

/** Finish an enrolment (from active or paused). Done is final; a new enrolment starts the program again. */
export function finishEnrolment(enrolment: ProgramEnrolment, now: Date = new Date()): ProgramEnrolment {
  if (enrolment.status === "done") return enrolment;
  const program = programById(enrolment.programId);
  const currentWeek = program ? programWeekAt(enrolment, program, now) : enrolment.currentWeek;
  const { pausedAt: _drop, ...rest } = enrolment;
  return { ...rest, status: "done", currentWeek, finishedAt: now.toISOString(), updatedAt: now.toISOString() };
}

/** Record the family's first-week child-proxy count (once; a captured baseline is never overwritten). */
export function captureBaseline(enrolment: ProgramEnrolment, childProxy: number, now: Date = new Date()): ProgramEnrolment {
  if (enrolment.baseline.childProxy !== null || !Number.isFinite(childProxy) || childProxy < 0) return enrolment;
  return { ...enrolment, baseline: { childProxy, capturedAt: now.toISOString() }, updatedAt: now.toISOString() };
}

/** Store one optional parent-typed line (verbatim, trimmed, ≤ 500 chars); empty text removes it. */
export function setEnrolmentNote(enrolment: ProgramEnrolment, noteId: string, text: string, now: Date = new Date()): ProgramEnrolment {
  const value = text.trim().slice(0, 500);
  const notes = { ...(enrolment.notes ?? {}) };
  if (value) notes[noteId] = value;
  else delete notes[noteId];
  return { ...enrolment, notes, updatedAt: now.toISOString() };
}

/** The chooser's view of an active program (lib/practice/choosePractice `ChoosePracticeInput.program`). */
export function chooserProgram(active: Pick<ActiveProgramWeek, "enrolment" | "program"> | null): {
  programId: string;
  startedAt: string;
  weeks: string[][];
} | null {
  if (!active) return null;
  return {
    programId: active.program.id,
    startedAt: active.enrolment.startedAt,
    weeks: [...active.program.weeks].sort((a, b) => a.n - b.n).map((w) => [...w.practices]),
  };
}
