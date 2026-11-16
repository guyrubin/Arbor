import { RHYTHM_WINDOW_DAYS } from "../rhythm/predict";

/**
 * v10 "Your day at a glance" — the day field: when the parent logs, by weekday
 * and part of the day, over the same trailing window the hour strip reads
 * (rhythm/predict RHYTHM_WINDOW_DAYS). Pure. Counts of what the parent logged,
 * never a read of the child: an empty cell means nothing was logged then.
 */

export const DAY_PARTS = ["morning", "afternoon", "evening", "night"] as const;
export type DayPart = (typeof DAY_PARTS)[number];

/** Morning 6–12, afternoon 12–17, evening 17–21, night 21–6. */
export function dayPartOf(hour: number): DayPart {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export type DayFieldCell = { moment: number; hard: number };
export type DayField = {
  /** Per part, seven cells indexed by weekday (0 = Sunday). */
  cells: Record<DayPart, DayFieldCell[]>;
  totals: Record<DayPart, number>;
  total: number;
  /** The earliest logged instant inside the window, or null with nothing logged. */
  sinceMs: number | null;
  /** The part holding the most moments (the first in day order on a tie), or null. */
  busiest: DayPart | null;
};

export type DayFieldLog = { timestamp: string | number; intensity?: number };

const DAY_MS = 86_400_000;

export function dayField(logs: readonly DayFieldLog[], nowMs: number, windowDays: number = RHYTHM_WINDOW_DAYS): DayField {
  const since = nowMs - windowDays * DAY_MS;
  const cells = Object.fromEntries(DAY_PARTS.map((p) => [p, Array.from({ length: 7 }, () => ({ moment: 0, hard: 0 }))])) as Record<DayPart, DayFieldCell[]>;
  const totals = Object.fromEntries(DAY_PARTS.map((p) => [p, 0])) as Record<DayPart, number>;
  let total = 0;
  let sinceMs: number | null = null;
  for (const log of logs) {
    const ms = typeof log.timestamp === "number" ? log.timestamp : Date.parse(log.timestamp);
    if (!Number.isFinite(ms) || ms < since || ms > nowMs) continue;
    const d = new Date(ms);
    const part = dayPartOf(d.getHours());
    const cell = cells[part][d.getDay()];
    if (typeof log.intensity === "number") cell.hard += 1;
    else cell.moment += 1;
    totals[part] += 1;
    total += 1;
    if (sinceMs === null || ms < sinceMs) sinceMs = ms;
  }
  let busiest: DayPart | null = null;
  for (const p of DAY_PARTS) if (totals[p] > 0 && (busiest === null || totals[p] > totals[busiest])) busiest = p;
  return { cells, totals, total, sinceMs, busiest };
}
