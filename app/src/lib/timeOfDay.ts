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

/** The hour the generic evening begins — the `dayPartFor` boundary, named once. */
export const EVENING_START_HOUR = 18;

/**
 * ENG-10 — THE EVENING DOOR.
 *
 * Until this existed `dayPartFor` had zero production consumers: the app knew
 * how to name an evening and never used the answer, so Bedtime Stories had no
 * entry point at the one hour a parent actually wants it. This predicate is
 * that door, and it is the reason `dayPartFor` is now load-bearing.
 *
 * Rules, in the order they matter:
 *  - morning → CLOSED. A bedtime cue before noon is noise, and the wrap past
 *    midnight (00:00–11:59 is "morning") must never re-open last night's door.
 *  - evening → OPEN. 18:00 onward, for every family, with or without a rhythm
 *    read. The clock is a fact; it needs no confidence score.
 *  - afternoon → open ONLY from the family's OWN wind-down hour
 *    (rhythm/predict.ts `windDownHour`, which for a baby can be 18:00 and for
 *    a toddler 18:30 → floored to 18, but the age prior allows earlier reads).
 *    No wind-down known → stay shut until the generic boundary. We never
 *    invent an early evening for a family we have not observed.
 *
 * Pure: the caller injects the hour, so the door is unit-testable at every
 * hour of the day.
 */
export function bedtimeDoorOpen(hour: number, windDownHour?: number | null): boolean {
  const part = dayPartFor(hour);
  if (part === "morning") return false;
  if (part === "evening") return true;
  return windDownHour != null && hour >= windDownHour;
}
