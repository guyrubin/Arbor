/**
 * B-LOOP-11 — the journal by shelves: pure selectors over the read model.
 *
 *  · `shelfSignalIds` maps the shelf's observations to the timeline's signal
 *    ids (behaviorLogs → `moment-`, milestones → `milestone-`, actionLoops →
 *    `action-`), so a shelf page renders the SAME day-grouped engine
 *    (signalTimeline.groupByDay) filtered by `shelfOf` and nothing else;
 *  · `shelfPractice` is the B-LOOP-09 chooser scoped to ONE shelf (its
 *    `candidateFilter` seam — no chooser change);
 *  · `shelfNotice` is the B-LOOP-04 per-shelf selection for ONE shelf.
 *
 * FIREWALL: counts choose nothing here and compare nothing; a shelf's count
 * is read only to print "{n} noticed" on its own tile (never ranked, never
 * coloured, the grid order is the registry's `order`).
 */
import type { Milestone } from "../../types";
import type { Observation, ObservationOrigin } from "../observations";
import type { TimelineSignal } from "../signalTimeline";
import type { ShelfId } from "../shelves/registry";
import { selectNextMilestonesByShelf, type NoticePick } from "../milestones/selectByShelf";
import { practiceCandidates, type ChoosePracticeInput, type PracticePick } from "../practice/choosePractice";

/** Read-model origin → the timeline signal id prefix (the origins the journal thread shows). */
export const SIGNAL_PREFIX: Partial<Record<ObservationOrigin, string>> = {
  behaviorLogs: "moment-",
  milestones: "milestone-",
  actionLoops: "action-",
};

/** The signal ids of the observations filed on `shelf`. */
export function shelfSignalIds(observations: ReadonlyArray<Pick<Observation, "id" | "origin" | "shelf">>, shelf: ShelfId): Set<string> {
  const out = new Set<string>();
  for (const o of observations) {
    if (o.shelf !== shelf) continue;
    const prefix = SIGNAL_PREFIX[o.origin];
    if (!prefix) continue;
    const recordId = o.id.slice(o.origin.length + 1);
    out.add(`${prefix}${recordId}`);
  }
  return out;
}

/** The timeline signals on one shelf, in the stream's own order. */
export function signalsOnShelf(
  signals: readonly TimelineSignal[],
  observations: ReadonlyArray<Pick<Observation, "id" | "origin" | "shelf">>,
  shelf: ShelfId,
): TimelineSignal[] {
  const ids = shelfSignalIds(observations, shelf);
  return signals.filter((s) => ids.has(s.id));
}

/** The shelf's next practice: the chooser's candidate for this shelf only. */
export function shelfPractice(input: ChoosePracticeInput, shelf: ShelfId): PracticePick | null {
  const prior = input.candidateFilter;
  return practiceCandidates({ ...input, candidateFilter: (p) => p.shelf === shelf && (!prior || prior(p)) }, 1)[0] ?? null;
}

/** The shelf's next thing to notice (never ahead of band, never a shelf answered today). */
export function shelfNotice(milestones: Milestone[], comparisonMonths: number | null, shelf: ShelfId, now: Date = new Date()): NoticePick | null {
  if (comparisonMonths === null) return null;
  return selectNextMilestonesByShelf(milestones, comparisonMonths, { perShelf: 1, total: 9, now }).find((p) => p.shelf === shelf) ?? null;
}

/* ── B-LOOP-12 — the professional view's per-domain counts ─────────────── */

export interface ProDomainCounts {
  /** Entries on the domain's shelves in the last `days` days. */
  noticed: number;
  /** Milestones the parent marked seen on the domain's shelves (all time). */
  milestonesSeen: number;
  /** Distinct days with a practice done on the domain's shelves in the window. */
  practiceDays: number;
}

/** Counts only, per registry domain (through each entry's shelf). */
export function proDomainCounts(
  observations: ReadonlyArray<Pick<Observation, "at" | "origin" | "shelf">>,
  shelvesOf: (shelf: ShelfId) => string,
  now: Date = new Date(),
  days = 30,
): Map<string, ProDomainCounts> {
  const out = new Map<string, ProDomainCounts>();
  const end = now.getTime();
  const start = end - days * 86_400_000;
  const practice = new Map<string, Set<string>>();
  for (const o of observations) {
    if (!o.shelf) continue;
    const domain = shelvesOf(o.shelf);
    const c = out.get(domain) ?? { noticed: 0, milestonesSeen: 0, practiceDays: 0 };
    const t = Date.parse(o.at);
    const inWindow = Number.isFinite(t) && t >= start && t <= end;
    if (inWindow) c.noticed += 1;
    if (o.origin === "milestones") c.milestonesSeen += 1;
    if (o.origin === "actionLoops" && inWindow) {
      const set = practice.get(domain) ?? new Set<string>();
      set.add(o.at.slice(0, 10));
      practice.set(domain, set);
      c.practiceDays = set.size;
    }
    out.set(domain, c);
  }
  return out;
}
