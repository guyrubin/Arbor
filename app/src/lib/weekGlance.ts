import type { ActionLoopEntry } from "../actionLoop/model";
import type { DomainId } from "./domains/registry";
import type { Observation, ObservationOrigin, ObservationSource } from "./observations";

/**
 * v3 EXTRA-WEEKLY — what was kept in one report week, as COUNTS.
 *
 * Extracted from Now's "This week so far" (NowWeekSoFar renders the same
 * numbers from it, unchanged); the Weekly tab's glance reads the same object.
 * Clinical firewall: every figure here is a count of what the parent kept or
 * the child did in Kid Mode. No share, no denominator, no score, no trend;
 * the screens simply leave a zero out.
 *
 * The week is the report's own week: `weekStartMs` comes from
 * recapWeekStartMs (the instant recapWeekId turns over), and a record counts
 * when it falls between that instant and `now`.
 */

/** Kid Mode's own records — what the child did, never the parent's notes. */
export const KID_ORIGINS: ReadonlySet<ObservationOrigin> = new Set(["practiceEvents", "mimicSessions", "adventureResults", "missionRecords"]);
/** A moment counts when the parent wrote it, said it, or confirmed it. */
export const PARENT_SOURCES: ReadonlySet<ObservationSource> = new Set(["parent_typed", "parent_voice", "ai_proposed_parent_confirmed"]);

export type WeekCountKey = "moments" | "helped" | "milestones" | "words" | "kid";
/** Now's order of the five counts (its tiles, then the stacking of its day bars). */
export const WEEK_ORDER: readonly WeekCountKey[] = ["moments", "helped", "milestones", "words", "kid"];

/**
 * The last step outcome the parent recorded on a day. Only "helped" reads as
 * helped; "somewhat" and "not_today" both read "not this time". Null: no
 * outcome that day.
 */
export type DayOutcome = "helped" | "not-this-time" | null;

export type WeekGlanceDay = Record<WeekCountKey, number> & {
  /** Local midnight that opens the day (the weekday label is read from it). */
  startMs: number;
  outcome: DayOutcome;
};

export type WeekGlance = {
  /** `tried`: the number of days on which the parent recorded any step outcome. */
  counts: Record<WeekCountKey, number> & { tried: number };
  /** Seven days from the week's first local midnight. */
  perDay: WeekGlanceDay[];
  /** Each counted record once per area it carries; an area with nothing is absent. */
  byDomain: Partial<Record<DomainId, number>>;
  /** The fullest day over all five counts (at least 1): the scale of Now's day bars. */
  max: number;
  /** The fullest day over moments and Kid Mode sessions (at least 1): the scale of the glance's day strip. */
  stackMax: number;
};

type StepOutcome = Pick<ActionLoopEntry, "outcome" | "outcomeAt">;

const zeroCounts = (): Record<WeekCountKey, number> => ({ moments: 0, helped: 0, milestones: 0, words: 0, kid: 0 });

/** Which count an observation feeds, in Now's order of precedence; null when it feeds none. */
function countKey(item: Observation): WeekCountKey | null {
  if (item.kind === "moment" && PARENT_SOURCES.has(item.source)) return "moments";
  if (item.kind === "milestone") return "milestones";
  if (item.value.type === "word") return "words";
  if (KID_ORIGINS.has(item.origin)) return "kid";
  return null;
}

export function weekGlance({ observations, actionLoop, now, weekStartMs }: {
  observations: readonly Observation[];
  actionLoop: readonly StepOutcome[];
  now: Date;
  weekStartMs: number;
}): WeekGlance {
  const start = weekStartMs;
  const end = now.getTime();
  const first = new Date(start);
  const days = Array.from({ length: 7 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i).getTime());
  const counts = { ...zeroCounts(), tried: 0 };
  const perDay: WeekGlanceDay[] = days.map((startMs) => ({ ...zeroCounts(), startMs, outcome: null }));
  const byDomain: Partial<Record<DomainId, number>> = {};

  /** The instant, when it falls inside the week so far; otherwise null. */
  const inWeek = (iso?: string): number | null => {
    const ms = Date.parse(iso ?? "");
    return Number.isFinite(ms) && ms >= start && ms <= end ? ms : null;
  };
  const dayIndex = (ms: number): number => {
    let index = 0;
    while (index < 6 && ms >= days[index + 1]) index += 1;
    return index;
  };
  const add = (key: WeekCountKey, ms: number) => {
    counts[key] += 1;
    perDay[dayIndex(ms)][key] += 1;
  };

  for (const item of observations) {
    const key = countKey(item);
    if (!key) continue;
    const ms = inWeek(item.at);
    if (ms === null) continue;
    add(key, ms);
    for (const domain of item.domains) byDomain[domain] = (byDomain[domain] ?? 0) + 1;
  }

  const latest = days.map(() => Number.NEGATIVE_INFINITY);
  const triedDays = new Set<number>();
  for (const step of actionLoop) {
    if (!step.outcome) continue;
    const ms = inWeek(step.outcomeAt);
    if (ms === null) continue;
    if (step.outcome === "helped") add("helped", ms);
    const index = dayIndex(ms);
    triedDays.add(index);
    if (ms >= latest[index]) {
      latest[index] = ms;
      perDay[index].outcome = step.outcome === "helped" ? "helped" : "not-this-time";
    }
  }
  counts.tried = triedDays.size;

  const max = Math.max(1, ...perDay.map((day) => WEEK_ORDER.reduce((sum, key) => sum + day[key], 0)));
  const stackMax = Math.max(1, ...perDay.map((day) => day.moments + day.kid));
  return { counts, perDay, byDomain, max, stackMax };
}

/** True when the week holds anything to count (a step tried counts too). */
export function glanceHasCounts(glance: WeekGlance): boolean {
  return glance.counts.tried > 0 || WEEK_ORDER.some((key) => glance.counts[key] > 0);
}
