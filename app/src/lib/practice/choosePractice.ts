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
 * The dose log is ONE `actionLoops` row per day (`practice.<child>.<day>`,
 * source "practice"): "Did it" → completed (tonight's question sets the
 * outcome: helped / somewhat, chosen by the parent, never inferred);
 * "Not today" → completed with outcome not_today. No streak, no count of
 * days on Today; dose is logged, never scored.
 */
import type { Milestone } from "../../types";
import type { ActionLoopEntry } from "../../actionLoop/model";
import type { Practice } from "../../content/practices";
import { selectNextMilestones } from "../milestoneData";
import { dayKey } from "../../practice/signals";
import { answeredToday } from "../milestones/observe";
import { shelfOfMilestone, shelvesThinnestFirst, type ShelfCoverage } from "../milestones/selectByShelf";
import type { ShelfId } from "../shelves/registry";

export interface PracticePick {
  practice: Practice;
  milestone: Milestone;
  shelf: ShelfId;
  /** "ai" when the focus route's practiceId (from the candidates) won. */
  via: "chooser" | "ai" | "today";
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
 * The candidates, one per shelf, thinnest shelf first: for each shelf the
 * first open in-window milestone that has a practice not used recently; the
 * practice among that milestone's practices is picked by the day's seed.
 */
export function practiceCandidates(input: ChoosePracticeInput, limit = 6): PracticePick[] {
  if (input.comparisonMonths === null || !Number.isFinite(input.comparisonMonths)) return [];
  const recent = new Set(input.recentPracticeIds ?? []);
  const rested = restedShelves(input.milestones, input.today);
  const byMilestone = new Map<string, Practice[]>();
  for (const p of input.practices) {
    if (recent.has(p.id)) continue;
    if (input.candidateFilter && !input.candidateFilter(p)) continue;
    // B-LOOP-08 follow-up: a shelf-level practice (milestoneId null) is legal
    // but not milestone-bound; this chooser picks by milestone, so it skips it.
    if (p.milestoneId === null) continue;
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
  const out: PracticePick[] = [];
  for (const shelf of shelvesThinnestFirst(input.coverage)) {
    const hit = firstByShelf.get(shelf);
    if (!hit) continue;
    const practice = hit.practices[hash(`${seed}|${hit.milestone.id}`) % hit.practices.length];
    out.push({ practice, milestone: hit.milestone, shelf, via: "chooser" });
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
  return practiceCandidates(withoutYesterdaysOffer(input, input.today), limit);
}

/** Today's practice, or null when no open milestone in the window has one. */
export function choosePractice(input: ChoosePracticeInput): PracticePick | null {
  if (input.todayPracticeId) {
    const practice = input.practices.find((p) => p.id === input.todayPracticeId);
    const milestone = practice ? input.milestones.find((m) => m.id === practice.milestoneId) : undefined;
    if (practice && milestone) return { practice, milestone, shelf: practice.shelf, via: "today" };
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
  pick: Pick<PracticePick, "practice" | "milestone" | "shelf">,
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
    milestoneId: pick.milestone.id,
    shelf: pick.shelf,
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
