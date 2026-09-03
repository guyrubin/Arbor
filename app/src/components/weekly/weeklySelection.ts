/**
 * weeklySelection — F-06 (E2): pure landing/chip logic for WeeklyTab.
 *
 * The tab used to land on `reports[0]` — with a quiet summer log that is a
 * June week rendered in August as if it were now. The rules, pinned by unit
 * tests in recapStoryCards.test.ts:
 *   · the landing week is ALWAYS the current week (WeeklyTab defaults its
 *     selection to `currentId`, never a stored report's id),
 *   · the chip strip ALWAYS leads with the current week — synthetic when no
 *     stored report exists for it yet — so the newest chip is never in the
 *     past, and
 *   · a current week with no stored report renders the honest
 *     `wk.emptyThisWeek` card, never a past week dressed as this one.
 *   · TJB-19: a chip's LABEL is the localized week label ("Week of Aug 31"),
 *     never the storage id ("2026-W36").
 */

/**
 * Chip ids for the history strip, newest-first. `storedIds` arrive
 * newest-first from useWeeklyRecap; the current week is prepended when no
 * stored report exists for it (and never duplicated when one does).
 */
export function weeklyChipIds(storedIds: string[], currentId: string): string[] {
  return [currentId, ...storedIds.filter((id) => id !== currentId)];
}

/**
 * True when the CURRENT week is selected but has no stored report yet —
 * WeeklyTab renders the empty-state card instead of falling back to a stale
 * report. History weeks never trigger it: a missing history report is the
 * `wk.noReports` case, not "nothing captured yet this week".
 */
export function isEmptyCurrentWeek(
  selectedId: string | null,
  currentId: string,
  hasStoredCurrentWeek: boolean
): boolean {
  return (selectedId ?? currentId) === currentId && !hasStoredCurrentWeek;
}

/** The raw storage-key shape a chip must never render (F-06 residue). */
export const WEEK_ID_SHAPE = /^\d{4}-W\d{2}$/;

/**
 * TJB-19: the human label for a chip. A stored report resolves through the
 * hook's localized `labelFor`; the synthetic current-week chip uses the
 * current label. The storage id is never returned — if a label resolver
 * somehow hands the id back, the current label wins.
 */
export function weeklyChipLabel<R extends { id: string }>(
  id: string,
  reports: ReadonlyArray<R>,
  labelFor: (report: R) => string,
  currentLabel: string,
): string {
  const report = reports.find((r) => r.id === id);
  const label = report ? labelFor(report) : currentLabel;
  return WEEK_ID_SHAPE.test(label.trim()) || !label.trim() ? currentLabel : label;
}
