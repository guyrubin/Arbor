/* retention — ENG-22: D1/D7/D30, finally computable.
 *
 * THE DEFECT THIS CLOSES
 * ──────────────────────
 * The masterplan's driver is week-2 return, and nothing in the app could
 * compute it. Events land in `users/{uid}/events`; the admin overview reported
 * users / paying / usageToday, and lib/attributionFunnel.ts stopped at
 * install → first_plan → paid. There was no day-grain activity record and no
 * cohort arithmetic anywhere — so "did this parent come back on day 7" was a
 * question the product could not answer about itself.
 *
 * WHAT THIS IS
 * ────────────
 * Pure arithmetic over event timestamps. No I/O, no Date.now(), no Firestore:
 * the caller supplies the events and the "as of" day, which is what makes the
 * whole thing testable and what lets the same code run on the client (upsert a
 * per-user rollup on session_open) and on the server (roll a cohort up).
 *
 * CLINICAL FIREWALL — READ BEFORE RENDERING ANY OF THIS
 * ────────────────────────────────────────────────────
 * A retention number is a PRODUCT metric for the product team. It is never a
 * verdict about a family and must never be rendered on a parent surface: not
 * as a percentage, not as a ring, not as "you were active 3 of 7 days", not as
 * a colour. A parent who opened the app twice this week is not doing worse
 * than one who opened it five times, and Arbor must never imply it. Nothing
 * here returns copy, and `rate` is deliberately `null` (never 0) when the
 * cohort is empty, so no surface can accidentally paint an honest gap as a
 * failing score.
 *
 * PRIVACY: day keys and counts only. No child data can reach this module —
 * it never sees anything but an event NAME and a timestamp.
 */

/** The event names that count as "the family used Arbor that day".
 *  `session_open` is the spine (once per browser session, lib/loopEvents.ts);
 *  the others catch a session that began before auth resolved or a capture
 *  that arrived through a deep link. Names are pinned by kpiEvents.test.ts. */
export const RETENTION_ACTIVITY_EVENTS = [
  "session_open",
  "app_open",
  "onboarding_completed",
  "capture_saved",
  "bell_open",
] as const;

export type RetentionActivityEvent = (typeof RETENTION_ACTIVITY_EVENTS)[number];

/** The retention day-offsets the product reports on. */
export const RETENTION_DAYS = [1, 7, 30] as const;
export type RetentionDay = (typeof RETENTION_DAYS)[number];

/** An analytics row, reduced to the only two fields retention needs. */
export interface ActivityEvent {
  event: string;
  at: string | number | Date;
}

/** The per-user record an upsert maintains: first day seen + the distinct
 *  local day keys the family was active on. Cumulative, never consecutive —
 *  there is no streak here and there must never be one. */
export interface RetentionRollup {
  firstSeen: string;
  activeDays: string[];
}

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

function toMs(at: string | number | Date): number {
  if (at instanceof Date) return at.getTime();
  if (typeof at === "number") return at;
  return new Date(at).getTime();
}

/**
 * "YYYY-MM-DD" for an instant, in the family's own day boundary.
 * `tzOffsetMinutes` is minutes to ADD to UTC (Israel summer = +180), so a
 * 23:30 local capture counts on the day the parent lived it, not the next one.
 */
export function dayKeyOf(at: string | number | Date, tzOffsetMinutes = 0): string | null {
  const ms = toMs(at);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + tzOffsetMinutes * 60_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Whole days from `firstSeen` to `day` (0 = the same day). Returns null for
 *  an unparseable key rather than a bogus offset. */
export function dayIndex(firstSeen: string, day: string): number | null {
  const a = Date.parse(`${firstSeen}T00:00:00Z`);
  const b = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / DAY_MS);
}

/**
 * Fold raw events into a rollup. Non-activity events are ignored, unparseable
 * timestamps are dropped, days are de-duplicated and sorted. Returns null when
 * nothing qualifies — an absent rollup is honest; a zeroed one is not.
 */
export function buildRollup(events: readonly ActivityEvent[], tzOffsetMinutes = 0): RetentionRollup | null {
  const allowed = new Set<string>(RETENTION_ACTIVITY_EVENTS);
  const days = new Set<string>();
  for (const e of events) {
    if (!e || !allowed.has(e.event)) continue;
    const key = dayKeyOf(e.at, tzOffsetMinutes);
    if (key) days.add(key);
  }
  if (days.size === 0) return null;
  const activeDays = [...days].sort();
  return { firstSeen: activeDays[0], activeDays };
}

/**
 * Upsert semantics: merge a freshly observed rollup into the stored one.
 * `firstSeen` only ever moves EARLIER (a late-syncing device must not reset a
 * cohort), and active days union. Pure — neither input is mutated.
 */
export function mergeRollup(
  prev: RetentionRollup | null,
  incoming: RetentionRollup | null,
): RetentionRollup | null {
  if (!prev) return incoming ? { firstSeen: incoming.firstSeen, activeDays: [...incoming.activeDays].sort() } : null;
  if (!incoming) return { firstSeen: prev.firstSeen, activeDays: [...prev.activeDays].sort() };
  const activeDays = [...new Set([...prev.activeDays, ...incoming.activeDays])].sort();
  const firstSeen = prev.firstSeen <= incoming.firstSeen ? prev.firstSeen : incoming.firstSeen;
  return { firstSeen, activeDays };
}

/** Day offsets (from firstSeen) the family was active on, ascending. */
export function activeDayOffsets(rollup: RetentionRollup): number[] {
  return rollup.activeDays
    .map((d) => dayIndex(rollup.firstSeen, d))
    .filter((n): n is number => n !== null && n >= 0)
    .sort((a, b) => a - b);
}

/** Did this user return on exactly day N after first seen? (Classic D-N.) */
export function returnedOnDay(rollup: RetentionRollup, day: number): boolean {
  return activeDayOffsets(rollup).includes(day);
}

/**
 * Is this user even ELIGIBLE to answer the D-N question yet? A parent who
 * installed yesterday cannot have a D7 answer, and counting them as a miss is
 * the single most common way a retention dashboard lies.
 */
export function eligibleForDay(rollup: RetentionRollup, day: number, asOfDay: string): boolean {
  const elapsed = dayIndex(rollup.firstSeen, asOfDay);
  return elapsed !== null && elapsed >= day;
}

export interface RetentionBucket {
  /** Users whose cohort is old enough for this question. */
  eligible: number;
  /** Of those, how many were active on exactly that day. */
  returned: number;
  /** returned/eligible, or null when nobody is eligible yet — NEVER 0. */
  rate: number | null;
}

export type RetentionReport = Record<`d${RetentionDay}`, RetentionBucket>;

/** Per-user answer for the three reported offsets, as of a given day.
 *  `null` means "not answerable yet", which is not the same as "no". */
export function retentionFlags(
  rollup: RetentionRollup,
  asOfDay: string,
): Record<`d${RetentionDay}`, boolean | null> {
  const out = {} as Record<`d${RetentionDay}`, boolean | null>;
  for (const day of RETENTION_DAYS) {
    out[`d${day}`] = eligibleForDay(rollup, day, asOfDay) ? returnedOnDay(rollup, day) : null;
  }
  return out;
}

/**
 * Cohort rollup across users. The denominator is eligibility, not headcount.
 * `rate` stays null on an empty denominator so a young product reads as
 * "not enough data yet" rather than "0%".
 */
export function cohortRetention(rollups: readonly RetentionRollup[], asOfDay: string): RetentionReport {
  const out = {} as RetentionReport;
  for (const day of RETENTION_DAYS) {
    let eligible = 0;
    let returned = 0;
    for (const r of rollups) {
      if (!eligibleForDay(r, day, asOfDay)) continue;
      eligible += 1;
      if (returnedOnDay(r, day)) returned += 1;
    }
    out[`d${day}`] = { eligible, returned, rate: eligible === 0 ? null : returned / eligible };
  }
  return out;
}
