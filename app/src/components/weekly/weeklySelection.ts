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

const DAY_MS = 86_400_000;

/**
 * v3 F-NOW-3 — the instants one report week spans, [startMs, endMs], so a
 * history week renders the same dashboard as the current one. Pure: the
 * report-id function (recapWeekId) and its week start (recapWeekStartMs) are
 * passed in, so DST and the year cut follow the id exactly as the stored
 * reports do.
 *
 * The week is found from the id itself ("2026-W41"): a day near Jan 1 + 7
 * days per week is searched for one that carries the id. A malformed id falls
 * back to the report's own date anchor (weekAnchorDate), when that anchor
 * carries the same id. No match at all → null (WeeklyTab then renders the
 * report without counts).
 */
export function reportWeekBounds(
  id: string,
  anchor: Date | null,
  fns: { weekId: (d: Date) => string; weekStartMs: (d: Date) => number }
): { startMs: number; endMs: number } | null {
  let inWeek: Date | null = null;
  const match = /^(\d{4})-W(\d{2})$/.exec(id);
  if (match) {
    const year = Number(match[1]);
    const week = Number(match[2]);
    for (let offset = -7; offset <= 7 && !inWeek; offset += 1) {
      const day = new Date(year, 0, 1 + (week - 1) * 7 + offset, 12);
      if (fns.weekId(day) === id) inWeek = day;
    }
  }
  if (!inWeek && anchor && !Number.isNaN(anchor.getTime()) && fns.weekId(anchor) === id) inWeek = anchor;
  if (!inWeek) return null;

  const startMs = fns.weekStartMs(inWeek);
  // The last instant that still carries the id: binary search over 8 days.
  let lo = inWeek.getTime();
  let hi = startMs + 8 * DAY_MS;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (fns.weekId(new Date(mid)) === id) lo = mid;
    else hi = mid;
  }
  return { startMs, endMs: lo };
}
