import { appointmentStatus, type Appointment } from "../../lib/careTrack";
import type { Observation } from "../../lib/observations";
import { PARENT_SOURCES } from "../../lib/weekGlance";

/**
 * v3 F-NOW-2 — the pure reads behind Now's "Today at a glance" rows: how many
 * days until the visit, how many moments the parent kept since the last one,
 * the story the child is part-way through, and the plan's day. Counts and
 * dates only: never a score, a ratio or a verdict about the child.
 */

const DAY_MS = 86_400_000;
const localMidnight = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** Whole local days from today to the visit's day (0 = today), or null for a bad date. */
export function daysUntil(whenIso: string | undefined, now: Date): number | null {
  const at = whenIso ? Date.parse(whenIso) : NaN;
  if (!Number.isFinite(at) || !Number.isFinite(now.getTime())) return null;
  return Math.max(0, Math.round((localMidnight(at) - localMidnight(now.getTime())) / DAY_MS));
}

/** The most recent visit that already took place (never a requested one, never the upcoming one). */
export function lastPastVisitMs(appointments: readonly Appointment[], now: Date, excludeId?: string): number | null {
  const at = now.getTime();
  let last: number | null = null;
  for (const a of appointments) {
    if (a.id === excludeId || appointmentStatus(a) === "requested") continue;
    const when = a.whenIso ? Date.parse(a.whenIso) : NaN;
    if (Number.isFinite(when) && when <= at && (last === null || when > last)) last = when;
  }
  return last;
}

/** The moments the parent kept (their own words) after `sinceMs`, up to now. */
export function momentsSince(observations: readonly Observation[], sinceMs: number, nowMs: number): number {
  let n = 0;
  for (const o of observations) {
    if (o.kind !== "moment" || !PARENT_SOURCES.has(o.source)) continue;
    const at = Date.parse(o.at);
    if (Number.isFinite(at) && at > sinceMs && at <= nowMs) n += 1;
  }
  return n;
}

/** Moments since the last visit, or null when there was no earlier visit to count from. */
export function momentsSinceLastVisit(input: { appointments: readonly Appointment[]; visitId?: string; observations: readonly Observation[]; now: Date }): number | null {
  const since = lastPastVisitMs(input.appointments, input.now, input.visitId);
  return since === null ? null : momentsSince(input.observations, since, input.now.getTime());
}

/** The newest story run the child started this week and has not finished, or null. */
export function storyInProgress<R extends { startedAt: string; completedAt?: string }>(runs: readonly R[], now: Date): R | null {
  const at = now.getTime();
  let best: R | null = null;
  let bestAt = -Infinity;
  for (const run of runs) {
    if (run.completedAt) continue;
    const started = Date.parse(run.startedAt);
    if (!Number.isFinite(started) || started > at || at - started > 7 * DAY_MS) continue;
    if (started > bestAt) { best = run; bestAt = started; }
  }
  return best;
}

/** The plan's day (day 1 = the start day), counted to the pause day while paused; null for a bad date. */
export function planDay(enrolment: { startedAt: string; status?: string; pausedAt?: string }, now: Date): number | null {
  const parse = (key: string | undefined) => {
    const m = key ? /^(\d{4})-(\d{2})-(\d{2})/.exec(key) : null;
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : NaN;
  };
  const start = parse(enrolment.startedAt);
  const paused = enrolment.status === "paused" ? parse(enrolment.pausedAt) : NaN;
  const until = Number.isFinite(paused) ? paused : localMidnight(now.getTime());
  if (!Number.isFinite(start) || !Number.isFinite(until) || until < start) return null;
  return Math.round((until - start) / DAY_MS) + 1;
}
