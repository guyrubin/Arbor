import type { ActionLoopEntry } from "../actionLoop/model";
import type { Observation } from "./observations";
import { PARENT_SOURCES } from "./weekGlance";

/**
 * v10 Weekly report — the week instrument: days across, time of day down, one
 * token where each record happened. Pure; WeeklyTab feeds it the same
 * observations and action-loop rows production's glance counts, so the tokens
 * add up to the glance's figures (a moment token per counted moment, a step
 * token per recorded outcome).
 *
 * Honesty rules (DESIGN.md, REGRESSION-RULES):
 *  - a token sits at a clock time only when the record holds one; a date-only
 *    record, and every step outcome (its instant is when the parent answered,
 *    not when the step happened), sits in the day's "no time" lane;
 *  - nothing grades the child: a hard moment is a kind of record, never a
 *    colour of the day; a day with nothing is blank, never a deficit.
 */

export type TimedKind = "moment" | "hard";
export type LaneKind = TimedKind | "helped" | "not";
export type InstrumentKind = LaneKind | "date";

export type InstrumentDay = {
  /** Local midnight that opens the day. */
  startMs: number;
  isToday: boolean;
  /** Not lived yet (after today in the current week). */
  isAhead: boolean;
};

export type TimedToken = { id: string; kind: TimedKind; day: number; ms: number; hour: number; latest: boolean };
export type LaneToken = { id: string; kind: LaneKind; day: number };
export type DateToken = { id: string; day: number; ms: number; label: string };

export type WeekInstrument = {
  days: InstrumentDay[];
  timed: TimedToken[];
  lane: LaneToken[];
  dates: DateToken[];
  counts: Record<InstrumentKind, number>;
  /** Whole hours shown down the plot: at least 6 to 22, widened to fit every timed record. */
  hours: { from: number; to: number };
  /** The clock now as a fractional hour, when today is one of the days; else null. */
  nowHour: number | null;
};

/** The minimal shape of a hard-moment log the instrument reads. */
export type InstrumentLog = { id: string; intensity?: number };
/** The minimal shape of a dated visit. */
export type InstrumentDate = { id: string; startMs: number | null; label: string };

const DAY_FROM = 6;
const DAY_TO = 22;

/** True when an ISO string carries a clock time (a date-only "2026-11-14" does not). */
export function hasClockTime(iso: string): boolean {
  return /T\d{2}:\d{2}/.test(iso);
}

const fractionalHour = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() + d.getMinutes() / 60;
};

export function weekInstrument({
  observations,
  actionLoop,
  logs,
  dates = [],
  dayStarts,
  endMs,
  isCurrent,
}: {
  observations: readonly Observation[];
  actionLoop: readonly Pick<ActionLoopEntry, "id" | "outcome" | "outcomeAt">[];
  logs: readonly InstrumentLog[];
  dates?: readonly InstrumentDate[];
  /** The seven local midnights of the report week (lib/weekGlance perDay). */
  dayStarts: readonly number[];
  /** The last instant counted: now for the current week, the week's end for a past one. */
  endMs: number;
  isCurrent: boolean;
}): WeekInstrument {
  const start = dayStarts[0];
  const afterLast = new Date(new Date(dayStarts[6]).getFullYear(), new Date(dayStarts[6]).getMonth(), new Date(dayStarts[6]).getDate() + 1).getTime();
  const dayIndex = (ms: number) => {
    let i = 0;
    while (i < 6 && ms >= dayStarts[i + 1]) i += 1;
    return i;
  };
  const todayIdx = isCurrent && endMs >= start && endMs < afterLast ? dayIndex(endMs) : -1;
  const days: InstrumentDay[] = dayStarts.map((startMs, i) => ({
    startMs,
    isToday: i === todayIdx,
    isAhead: isCurrent && (todayIdx === -1 ? endMs < start : i > todayIdx),
  }));

  const hardIds = new Set(logs.filter((l) => typeof l.intensity === "number").map((l) => `behaviorLogs:${l.id}`));
  const counts: Record<InstrumentKind, number> = { moment: 0, hard: 0, helped: 0, not: 0, date: 0 };
  const timed: TimedToken[] = [];
  const lane: LaneToken[] = [];

  for (const item of observations) {
    if (item.kind !== "moment" || !PARENT_SOURCES.has(item.source)) continue;
    const ms = Date.parse(item.at);
    if (!Number.isFinite(ms) || ms < start || ms > endMs) continue;
    const kind: TimedKind = hardIds.has(item.id) ? "hard" : "moment";
    counts[kind] += 1;
    if (hasClockTime(item.at)) timed.push({ id: item.id, kind, day: dayIndex(ms), ms, hour: fractionalHour(ms), latest: false });
    else lane.push({ id: item.id, kind, day: dayIndex(ms) });
  }
  timed.sort((a, b) => a.ms - b.ms);
  const newestMoment = [...timed].reverse().find((tok) => tok.kind === "moment");
  if (newestMoment) newestMoment.latest = true;

  const steps = actionLoop
    .filter((row) => row.outcome && row.outcomeAt)
    .map((row) => ({ row, ms: Date.parse(row.outcomeAt!) }))
    .filter(({ ms }) => Number.isFinite(ms) && ms >= start && ms <= endMs)
    .sort((a, b) => a.ms - b.ms);
  for (const { row, ms } of steps) {
    const kind: LaneKind = row.outcome === "helped" ? "helped" : "not";
    counts[kind] += 1;
    lane.push({ id: `step:${row.id}`, kind, day: dayIndex(ms) });
  }

  const dated: DateToken[] = dates
    .filter((d): d is InstrumentDate & { startMs: number } => d.startMs !== null && d.startMs >= start && d.startMs < afterLast)
    .sort((a, b) => a.startMs - b.startMs)
    .map((d) => ({ id: d.id, day: dayIndex(d.startMs), ms: d.startMs, label: d.label }));
  counts.date = dated.length;

  const hoursSeen = timed.map((tok) => tok.hour);
  const from = Math.min(DAY_FROM, ...hoursSeen.map((h) => Math.floor(h)));
  const to = Math.max(DAY_TO, ...hoursSeen.map((h) => Math.floor(h) + 1));
  const nowHour = todayIdx >= 0 ? Math.min(to, Math.max(from, fractionalHour(endMs))) : null;

  return { days, timed, lane, dates: dated, counts, hours: { from, to }, nowHour };
}
