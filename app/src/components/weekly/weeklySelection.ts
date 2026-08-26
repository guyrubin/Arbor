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
