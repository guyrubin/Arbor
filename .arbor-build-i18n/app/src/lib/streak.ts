/**
 * V4 — parent-facing "days of moments" streak.
 *
 * A gentle retention signal counted off the days the parent logged at least one
 * "moment" (a behaviour log or a Daily Play completion). It is deliberately
 * AADC/Fairplay-hardened:
 *  - **No loss/guilt:** there is no "broken streak" event, no notification, no
 *    punitive reset. When a run genuinely lapses, the count simply returns to 0
 *    and the chip quietly hides (callers render only at >= 2).
 *  - **One-day grace:** a day with nothing logged *yet* does not reset the
 *    count — the run is anchored at yesterday until a full day actually passes,
 *    so the parent is never shamed at midnight.
 *
 * Pure + deterministic: inject `now` in tests. Day bucketing matches the
 * existing rhythm engine (UTC day number = floor(ms / 86_400_000)).
 */
const DAY_MS = 86_400_000;

const toMs = (t: string | number): number => (typeof t === "number" ? t : Date.parse(t));
const dayNum = (t: string | number): number => Math.floor(toMs(t) / DAY_MS);

export interface StreakResult {
  /** Consecutive days (ending today, or yesterday via grace) with >= 1 moment. */
  current: number;
  /** Whether a moment has been logged today already. */
  loggedToday: boolean;
  /** Lifetime count of distinct active days — a calm "moments logged" framing. */
  totalDays: number;
}

/** Compute the gentle streak from a set of moment timestamps (ISO strings or ms). */
export function computeStreak(
  timestamps: Array<string | number>,
  now: number = Date.now(),
): StreakResult {
  const days = new Set<number>();
  for (const t of timestamps) {
    const d = dayNum(t);
    if (Number.isFinite(d)) days.add(d);
  }
  const today = Math.floor(now / DAY_MS);
  const loggedToday = days.has(today);
  // Grace: if nothing logged today yet, anchor the walk at yesterday so the run
  // is preserved through the day rather than reset the moment midnight passes.
  let cursor = loggedToday ? today : today - 1;
  let current = 0;
  while (days.has(cursor)) {
    current++;
    cursor--;
  }
  return { current, loggedToday, totalDays: days.size };
}
