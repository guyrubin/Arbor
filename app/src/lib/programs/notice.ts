/**
 * B-PROG-01 — the program hook on "Notice today" (B-LOOP-04). With an active
 * program, the program's SHELF is skipped by the thinnest-shelf selection and
 * the week's `watchFor` milestones are served to it instead, first:
 *  - only catalogue rows the child has OPEN inside the age window (the same
 *    `selectNextMilestones` derivation — current band + one earlier, never
 *    ahead of band; "the engine shows them only inside the child's age
 *    window", content/programs/types);
 *  - NO CHASING holds: once the parent answered a milestone on the program's
 *    shelf today, no further watch-for card is served until tomorrow;
 *  - the caller's `excludeShelves` (the practice's shelf) does NOT hide the
 *    watch-for cards — with a program the practice IS on the program's shelf,
 *    and the week's watch-for rows are exactly what the parent should notice;
 *  - the rest of the `total` is filled by `selectNextMilestonesByShelf` with
 *    the program's shelf excluded.
 *
 * A wrapper rather than an edit of lib/milestones/selectByShelf.ts (held
 * uncommitted by another builder on 6 Oct); the caller (OverviewTab, session
 * A) swaps the call. Without a program it returns exactly the selector's picks.
 */
import type { Milestone } from "../../types";
import { selectNextMilestones } from "../milestoneData";
import { selectNextMilestonesByShelf, shelfOfMilestone, type NoticePick, type SelectByShelfOptions } from "../milestones/selectByShelf";
import { answeredToday } from "../milestones/observe";
import type { ShelfId } from "../shelves/registry";

/** The program's part of Notice today: its shelf and this week's watch-for ids. */
export interface NoticeProgram {
  shelf: ShelfId;
  watchFor: readonly string[];
}

export interface ProgramNoticePick extends NoticePick {
  /** True for a watch-for row served by the active program's week. */
  fromProgram?: true;
}

/** The week's watch-for picks: open, in window, not on a shelf answered today; watch-for order. */
export function programWatchForPicks(milestones: Milestone[], comparisonMonths: number, program: NoticeProgram, now: Date = new Date()): ProgramNoticePick[] {
  if (!program.watchFor.length) return [];
  const answeredOnShelf = milestones.some((m) => answeredToday(m, now) && shelfOfMilestone(m) === program.shelf);
  if (answeredOnShelf) return [];
  const open = new Map(selectNextMilestones(milestones, comparisonMonths, Number.MAX_SAFE_INTEGER).map((m) => [m.id, m]));
  const out: ProgramNoticePick[] = [];
  for (const id of program.watchFor) {
    const m = open.get(id);
    if (m && !out.some((p) => p.milestone.id === id)) out.push({ shelf: program.shelf, milestone: m, fromProgram: true });
  }
  return out;
}

/** Notice today with the program hook: watch-for rows first, then the other shelves, `total` in all. */
export function selectNoticeWithProgram(
  milestones: Milestone[],
  comparisonMonths: number,
  opts: SelectByShelfOptions = {},
  program?: NoticeProgram | null,
): ProgramNoticePick[] {
  if (!program) return selectNextMilestonesByShelf(milestones, comparisonMonths, opts);
  const total = Math.max(0, opts.total ?? 3);
  if (total === 0) return [];
  const watch = programWatchForPicks(milestones, comparisonMonths, program, opts.now ?? new Date()).slice(0, total);
  const rest = selectNextMilestonesByShelf(milestones, comparisonMonths, {
    ...opts,
    total: total - watch.length,
    excludeShelves: [...(opts.excludeShelves ?? []), program.shelf],
  });
  return [...watch, ...rest];
}
