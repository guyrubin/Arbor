/**
 * B-LOOP-09 — THE PRACTICE CHOOSER and THE DOSE LOG.
 *
 * Today's practice = the practice of the first open milestone of the
 * THINNEST shelf (fewest entries in 30 days, ties by shelf order), in the
 * child's age window (current band + one earlier — never ahead of band).
 *  · deterministic for the day: seeded by date + child id, so a reload shows
 *    the same card; once the parent answered today, today's row names it;
 *  · never the same practice two days running (yesterday's id is excluded);
 *  · never a shelf the parent answered "not sure" today (B-LOOP-04 rule);
 *  · an AI pick (B-LOOP-13 `practiceId`) wins ONLY when it is one of the
 *    candidates this chooser offered; anything else is ignored. The pure
 *    chooser is the fallback and the zero-model-call path.
 *
 * B-PROG-01 — THE PROGRAM RULE comes FIRST: with an active program
 * (`input.program`, the enrolment's current week from lib/programs/enrolment
 * `activeProgramWeek`), today's practice is drawn from THAT WEEK's list — a
 * day rotation over the week's practices, never two days the same (the same
 * pool-minus-yesterday rule as the shelf-level pools), recent ids skipped —
 * and the AI's pick is honoured only inside the week's list. Without a
 * program, or when none of the week's ids resolve, the thinnest-shelf rule
 * below is unchanged.
 *
 * The dose log is ONE `actionLoops` row per day (`practice.<child>.<day>`,
 * source "practice"): "Did it" → completed (tonight's question sets the
 * outcome: helped / somewhat, chosen by the parent, never inferred);
 * "Not today" → completed with outcome not_today. No streak, no count of
 * days on Today; dose is logged, never scored.
 */
import type { Milestone } from "../../types";
import type { ActionLoopEntry } from "../../actionLoop/model";
import type { Practice } from "../../content/practices";
import { bandForAgeMonths, milestoneAgeWindow, selectNextMilestones } from "../milestoneData";
import { dayKey } from "../../practice/signals";
import { answeredToday } from "../milestones/observe";
import { shelfOfMilestone, shelvesThinnestFirst, type ShelfCoverage } from "../milestones/selectByShelf";
import type { ShelfId } from "../shelves/registry";

export interface PracticePick {
  practice: Practice;
  /** The open milestone the practice serves; null for a SHELF-LEVEL practice
   *  (B-LOOP-08 follow-up: Sleep and Family carry practices bound to the shelf). */
  milestone: Milestone | null;
  shelf: ShelfId;
  /** "ai" when the focus route's practiceId (from the candidates) won;
   *  "program" when the active program's week served it (B-PROG-01). */
  via: "chooser" | "ai" | "today" | "program";
  /** B-PROG-01: set when the pick came from the active program's week. */
  programId?: string;
  programWeek?: number;
}

/** B-PROG-01: the active program, as the chooser needs it (lib/programs/enrolment
 *  `chooserProgram` builds it from the active enrolment). */
export interface ChooserProgram {
  programId: string;
  /** LOCAL day key (YYYY-MM-DD) of week 1's first day (the enrolment's `startedAt`). */
  startedAt: string;
  /** Every week's practice ids, in order (content/programs ProgramWeek.practices). */
  weeks: readonly (readonly string[])[];
}

export interface ChoosePracticeInput {
  childId: string;
  milestones: Milestone[];
  comparisonMonths: number | null;
  practices: readonly Practice[];
  /** Entries per shelf over 30 days (lib/milestones/selectByShelf shelfCoverage). */
  coverage: Partial<ShelfCoverage>;
  today: Date;
  /** Practice ids the parent was offered on recent days (yesterday's at least). */
  recentPracticeIds?: readonly string[];
  /** The practice today's dose row already names — the card stays put all day. */
  todayPracticeId?: string;
  /** B-LOOP-13: the AI's pick; honoured only inside the candidate set. */
  aiPracticeId?: string;
  /** P6 seam (B-PROG-01): a program rule may narrow the candidates later; the
   *  chooser takes an optional filter and applies it before ranking. */
  candidateFilter?: (practice: Practice) => boolean;
  /** B-PROG-01: the active program — its current week's practices win. */
  program?: ChooserProgram | null;
}

/** FNV-1a — a stable small hash (date + child seed). */
const hash = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};

/** Shelves the parent answered "not sure" on today (B-LOOP-04: rested). */
function restedShelves(milestones: readonly Milestone[], now: Date): Set<ShelfId> {
  const out = new Set<ShelfId>();
  for (const m of milestones) {
    if (m.observationStatus !== "not_sure" || !answeredToday(m, now)) continue;
    const shelf = shelfOfMilestone(m);
    if (shelf) out.add(shelf);
  }
  return out;
}

/**
 * B-PROG-06 (gate) rotation, shared with the program rule (B-PROG-01): a DAY
 * ROTATION over a stable pool, seeded by `seedKey` — consecutive days take
 * consecutive positions — returned in order from today's position, MINUS
 * yesterday's position (explicitly excluded when the pool has more than one)
 * and minus recent ids.
 */
function dayRotation(pool: readonly Practice[], seedKey: string, today: Date, recent: ReadonlySet<string>): Practice[] {
  if (!pool.length) return [];
  const start = (hash(seedKey) + epochDay(today)) % pool.length;
  const yesterdays = pool[(start + pool.length - 1) % pool.length].id;
  const out: Practice[] = [];
  for (let k = 0; k < pool.length; k += 1) {
    const p = pool[(start + k) % pool.length];
    if (recent.has(p.id) || (pool.length > 1 && p.id === yesterdays)) continue;
    out.push(p);
  }
  return out;
}

/** B-PROG-01: the program week (1-based, clamped) a local day falls in. */
export function chooserProgramWeekOn(program: ChooserProgram, day: Date): number {
  const [y, m, d] = program.startedAt.split("-").map(Number);
  const days = Math.round((Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) - Date.UTC(y, (m || 1) - 1, d || 1)) / DAY_MS);
  return Math.min(Math.max(1, program.weeks.length), Math.max(1, Math.floor(days / 7) + 1));
}

/** The week's practices that resolve (and pass the optional filter), list order, no duplicates. */
function programPool(input: ChoosePracticeInput, program: ChooserProgram, week: number): Practice[] {
  const byId = new Map(input.practices.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const pool: Practice[] = [];
  for (const id of program.weeks[week - 1] ?? []) {
    const p = byId.get(id);
    if (!p || seen.has(id) || (input.candidateFilter && !input.candidateFilter(p))) continue;
    seen.add(id);
    pool.push(p);
  }
  return pool;
}

const programSeed = (input: ChoosePracticeInput, program: ChooserProgram, week: number): string =>
  `${input.childId}|program|${program.programId}|${week}`;

/**
 * B-PROG-01 — the program week's candidates, today's first: the current
 * week's practices rotated by day (never yesterday's position), recent ids
 * skipped, and — across a week boundary too — never YESTERDAY's offer
 * (yesterday's rotation of yesterday's week, answered or not). [] without a
 * program or when nothing resolves (the caller falls back to the shelves).
 */
export function programCandidates(input: ChoosePracticeInput, limit = 6): PracticePick[] {
  const program = input.program;
  if (!program || !program.weeks.length || input.comparisonMonths === null || !Number.isFinite(input.comparisonMonths)) return [];
  const week = chooserProgramWeekOn(program, input.today);
  const pool = programPool(input, program, week);
  if (!pool.length) return [];
  const recent = new Set(input.recentPracticeIds ?? []);
  const yesterday = dayBefore(input.today);
  const yWeek = chooserProgramWeekOn(program, yesterday);
  const yOffer = dayRotation(programPool(input, program, yWeek), programSeed(input, program, yWeek), yesterday, recent)[0];
  let list = dayRotation(pool, programSeed(input, program, week), input.today, yOffer ? new Set([...recent, yOffer.id]) : recent);
  if (!list.length) list = dayRotation(pool, programSeed(input, program, week), input.today, recent);
  const milestoneById = new Map(input.milestones.map((m) => [m.id, m]));
  return list.slice(0, limit).map((practice) => ({
    practice,
    milestone: practice.milestoneId ? milestoneById.get(practice.milestoneId) ?? null : null,
    shelf: practice.shelf,
    via: "program" as const,
    programId: program.programId,
    programWeek: week,
  }));
}

/**
 * The candidates, one per shelf, thinnest shelf first: for each shelf the
 * first open in-window milestone that has a practice not used recently; the
 * practice among that milestone's practices is picked by the day's seed.
 */
export function practiceCandidates(input: ChoosePracticeInput, limit = 6): PracticePick[] {
  if (input.comparisonMonths === null || !Number.isFinite(input.comparisonMonths)) return [];
  const recent = new Set(input.recentPracticeIds ?? []);
  const rested = restedShelves(input.milestones, input.today);
  const byMilestone = new Map<string, Practice[]>();
  const shelfLevel = new Map<ShelfId, Practice[]>();
  for (const p of input.practices) {
    if (input.candidateFilter && !input.candidateFilter(p)) continue;
    // B-LOOP-08 follow-up: a shelf-level practice (milestoneId null) is
    // ranked below with its shelf, never through a milestone. B-PROG-06
    // (gate): the WHOLE shelf pool is kept here (recent ids are skipped at
    // pick time), so the day rotation below indexes a stable pool.
    if (p.milestoneId === null) {
      const list = shelfLevel.get(p.shelf) ?? [];
      list.push(p);
      shelfLevel.set(p.shelf, list);
      continue;
    }
    if (recent.has(p.id)) continue;
    const list = byMilestone.get(p.milestoneId) ?? [];
    list.push(p);
    byMilestone.set(p.milestoneId, list);
  }
  const open = selectNextMilestones(input.milestones, input.comparisonMonths, Number.MAX_SAFE_INTEGER);
  const firstByShelf = new Map<ShelfId, { milestone: Milestone; practices: Practice[] }>();
  for (const m of open) {
    const practices = byMilestone.get(m.id);
    if (!practices || practices.length === 0) continue;
    const shelf = shelfOfMilestone(m);
    if (!shelf || rested.has(shelf) || firstByShelf.has(shelf)) continue;
    firstByShelf.set(shelf, { milestone: m, practices });
  }
  const seed = `${input.childId}|${dayKey(input.today)}`;
  // A shelf with no open milestone practice may still have a SHELF-LEVEL one
  // whose own age anchor sits inside the child's window (never ahead of band).
  const window = milestoneAgeWindow(input.comparisonMonths);
  const shelfLevelFor = (shelf: ShelfId): Practice | null => {
    if (rested.has(shelf)) return null;
    const fits = (shelfLevel.get(shelf) ?? []).filter((p) => {
      const band = bandForAgeMonths(p.ageMonths).months;
      return band <= window.currentBandMonths && band >= window.earlierBandMonths;
    });
    if (!fits.length) return null;
    // B-PROG-06 (gate): a DAY ROTATION over the shelf's whole pool, seeded per
    // child + shelf — consecutive days take consecutive positions — and the
    // pick is the pool MINUS yesterday's choice (explicitly excluded) and
    // minus recent ids. With a 21-practice sleep pool the date-seeded index
    // used to land on the same id two days running (pr-sleep-17, day 15/16).
    return dayRotation(fits, `${input.childId}|${shelf}`, input.today, recent)[0] ?? null;
  };
  const out: PracticePick[] = [];
  for (const shelf of shelvesThinnestFirst(input.coverage)) {
    const hit = firstByShelf.get(shelf);
    if (hit) {
      const practice = hit.practices[hash(`${seed}|${hit.milestone.id}`) % hit.practices.length];
      out.push({ practice, milestone: hit.milestone, shelf, via: "chooser" });
    } else {
      const practice = shelfLevelFor(shelf);
      if (!practice) continue;
      out.push({ practice, milestone: null, shelf, via: "chooser" });
    }
    if (out.length >= limit) break;
  }
  return out;
}

const DAY_MS = 86_400_000;
const epochDay = (d: Date): number => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
const dayBefore = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12);

/**
 * Never two days running, whether or not the parent answered yesterday:
 * yesterday's offer is the day's candidates indexed by the day's parity
 * (epoch day % 2), and today takes the first candidate that is not it. Under
 * an unchanged record that is exactly today's own parity offer, so the
 * sequence alternates between the two thinnest shelves instead of repeating
 * (two pure passes, zero model calls); answered ids are excluded as well.
 */
function parityOffer(input: ChoosePracticeInput, day: Date): Practice | null {
  const c = practiceCandidates({ ...input, today: day }, 2);
  return (c[epochDay(day) % 2] ?? c[0])?.practice ?? null;
}

function withoutYesterdaysOffer(input: ChoosePracticeInput, day: Date): ChoosePracticeInput {
  const prev = parityOffer(input, dayBefore(day));
  return prev ? { ...input, recentPracticeIds: [...(input.recentPracticeIds ?? []), prev.id] } : input;
}

/** The candidates TODAY offers (yesterday's offer excluded), ≤ `limit` —
 *  the same set the focus route may choose from (`candidatePracticeIds`). */
export function todaysCandidates(input: ChoosePracticeInput, limit = 6): PracticePick[] {
  // B-PROG-01: an active program's week wins; the rotation already excludes
  // yesterday's position, so the parity pass is not needed.
  const program = programCandidates(input, limit);
  if (program.length) return program;
  return practiceCandidates(withoutYesterdaysOffer(input, input.today), limit);
}

/** Today's practice, or null when no open milestone in the window has one. */
export function choosePractice(input: ChoosePracticeInput): PracticePick | null {
  if (input.todayPracticeId) {
    const practice = input.practices.find((p) => p.id === input.todayPracticeId);
    const milestone = practice?.milestoneId ? input.milestones.find((m) => m.id === practice.milestoneId) ?? null : null;
    if (practice && (milestone || practice.milestoneId === null)) {
      const week = input.program ? chooserProgramWeekOn(input.program, input.today) : 0;
      const inProgram = input.program && (input.program.weeks[week - 1] ?? []).includes(practice.id)
        ? { programId: input.program.programId, programWeek: week }
        : {};
      return { practice, milestone, shelf: practice.shelf, via: "today", ...inProgram };
    }
  }
  const candidates = todaysCandidates(input);
  if (input.aiPracticeId) {
    const ai = candidates.find((c) => c.practice.id === input.aiPracticeId);
    if (ai) return { ...ai, via: "ai" };
  }
  return candidates[0] ?? null;
}

/* ── the dose log (actionLoops, source "practice") ─────────────────────── */

export type PracticeAnswer = "did" | "not_today";

/** One row per child per local day. */
export const practiceDoseId = (childId: string, at: Date = new Date()): string => `practice.${childId}.${dayKey(at)}`;

/** The row "Did it" / "Not today" writes. Pure; the caller persists it. */
export function practiceDoseEntry(
  pick: Pick<PracticePick, "practice" | "milestone" | "shelf" | "programId">,
  answer: PracticeAnswer,
  childId: string,
  sayText: string,
  at: Date = new Date(),
): ActionLoopEntry {
  const iso = at.toISOString();
  return {
    id: practiceDoseId(childId, at),
    recommendation: sayText.trim() || pick.practice.say.en,
    source: "practice",
    capacity: pick.practice.minutes <= 5 ? "tiny" : pick.practice.minutes <= 10 ? "standard" : "roomy",
    status: "completed",
    acceptedAt: iso,
    practiceId: pick.practice.id,
    ...(pick.milestone ? { milestoneId: pick.milestone.id } : {}),
    shelf: pick.shelf,
    ...(pick.programId ? { programId: pick.programId } : {}),
    ...(answer === "not_today" ? { outcome: "not_today" as const, outcomeAt: iso } : {}),
  };
}

/** Today's dose row, if the parent answered. */
export function todayDose(rows: readonly ActionLoopEntry[], childId: string, at: Date = new Date()): ActionLoopEntry | null {
  const id = practiceDoseId(childId, at);
  return rows.find((r) => r.id === id) ?? null;
}

/** The practice ids offered on the days before today (newest first, ≤ `days`). */
export function recentPracticeIds(rows: readonly ActionLoopEntry[], childId: string, at: Date = new Date(), days = 1): string[] {
  const out: string[] = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(at.getFullYear(), at.getMonth(), at.getDate() - i, 12);
    const row = rows.find((r) => r.id === practiceDoseId(childId, d));
    if (row?.practiceId) out.push(row.practiceId);
  }
  return out;
}
