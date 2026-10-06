/**
 * B-LOOP-04 — "Notice today": the next milestones PER SHELF.
 *
 * Over the one "worth watching next" derivation (`selectNextMilestones`,
 * lib/milestoneData — current band + one earlier, never ahead of band), the
 * thinnest shelves come first: the fewest observations in the last 30 days,
 * ties broken by shelf display order (lib/shelves/registry). One open
 * milestone per shelf by default, three in all.
 *
 * NO CHASING: a shelf the parent answered TODAY (any answer, "not yet" and
 * "not sure" included) is skipped for the rest of the day — the next card for
 * that shelf is not shown until tomorrow.
 *
 * FIREWALL: coverage is a COUNT used only to choose what to offer; it is
 * never rendered as a comparison between shelves, never a "{n} not yet" and
 * never a status (pack non-negotiable "Firewall on age").
 */
import type { Milestone } from "../../types";
import type { Observation } from "../observations";
import { selectNextMilestones } from "../milestoneData";
import { SHELF_IDS, milestoneShelf, type ShelfId } from "../shelves/registry";
import { answeredToday } from "./observe";

export type ShelfCoverage = Record<ShelfId, number>;

const DAY_MS = 86_400_000;

/** An all-zero coverage map, every shelf present. */
export const emptyCoverage = (): ShelfCoverage =>
  Object.fromEntries(SHELF_IDS.map((id) => [id, 0])) as ShelfCoverage;

/**
 * Entries per shelf over the last `days` days (default 30). Observations
 * with no shelf or no valid date are left out; a future-dated one too.
 */
export function shelfCoverage(
  observations: ReadonlyArray<Pick<Observation, "at" | "shelf">>,
  now: Date = new Date(),
  days = 30,
): ShelfCoverage {
  const out = emptyCoverage();
  const end = now.getTime();
  const start = end - days * DAY_MS;
  for (const o of observations) {
    if (!o.shelf) continue;
    const t = Date.parse(o.at);
    if (!Number.isFinite(t) || t < start || t > end) continue;
    out[o.shelf] += 1;
  }
  return out;
}

/** Shelves, thinnest first; ties by shelf display order. */
export function shelvesThinnestFirst(coverage: Partial<ShelfCoverage>): ShelfId[] {
  return SHELF_IDS.map((id, order) => ({ id, order, n: coverage[id] ?? 0 }))
    .sort((a, b) => a.n - b.n || a.order - b.order)
    .map((x) => x.id);
}

/** The shelf of a milestone, or null where the binding table has no rule. */
export function shelfOfMilestone(m: Milestone): ShelfId | null {
  try {
    return milestoneShelf(m);
  } catch {
    return null;
  }
}

export interface NoticePick {
  shelf: ShelfId;
  milestone: Milestone;
}

export interface SelectByShelfOptions {
  /** Open milestones per shelf (default 1). */
  perShelf?: number;
  /** Cards in all (default 3). */
  total?: number;
  /** Entries per shelf over 30 days (`shelfCoverage`); absent = all zero. */
  coverage?: Partial<ShelfCoverage>;
  /** The clock, for "answered today" (default now). */
  now?: Date;
  /** Shelves the caller already fills today (e.g. the practice's shelf). */
  excludeShelves?: readonly ShelfId[];
}

/**
 * The Notice cards: thinnest shelves first, `perShelf` open milestones each,
 * `total` in all. Never ahead of the child's band (the window comes from
 * `selectNextMilestones`); never a shelf answered today.
 */
export function selectNextMilestonesByShelf(
  milestones: Milestone[],
  comparisonMonths: number,
  opts: SelectByShelfOptions = {},
): NoticePick[] {
  const perShelf = Math.max(0, opts.perShelf ?? 1);
  const total = Math.max(0, opts.total ?? 3);
  const now = opts.now ?? new Date();
  if (perShelf === 0 || total === 0) return [];

  // Shelves the parent already answered today are rested until tomorrow.
  const rested = new Set<ShelfId>(opts.excludeShelves ?? []);
  for (const m of milestones) {
    if (!answeredToday(m, now)) continue;
    const shelf = shelfOfMilestone(m);
    if (shelf) rested.add(shelf);
  }

  // The shared ranked list (current band first, "not sure" ahead), grouped.
  const ranked = selectNextMilestones(milestones, comparisonMonths, Number.MAX_SAFE_INTEGER);
  const byShelf = new Map<ShelfId, Milestone[]>();
  for (const m of ranked) {
    const shelf = shelfOfMilestone(m);
    if (!shelf || rested.has(shelf)) continue;
    const list = byShelf.get(shelf) ?? [];
    if (list.length < perShelf) list.push(m);
    byShelf.set(shelf, list);
  }

  const out: NoticePick[] = [];
  for (const shelf of shelvesThinnestFirst(opts.coverage ?? {})) {
    for (const milestone of byShelf.get(shelf) ?? []) {
      if (out.length >= total) return out;
      out.push({ shelf, milestone });
    }
  }
  return out;
}
