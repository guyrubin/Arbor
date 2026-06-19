export type DayPart = "morning" | "afternoon" | "evening";

/**
 * Pure time-of-day bucket. Caller injects the hour (0–23) for testability —
 * no Date.now() inside, so the Today spine can be reordered deterministically.
 *
 *  - morning:   00:00 – 11:59
 *  - afternoon: 12:00 – 17:59
 *  - evening:   18:00 – 23:59
 */
export function dayPartFor(hour: number): DayPart {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
