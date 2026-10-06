/**
 * B-PROG-06 (Steady Nights v0.1) — the sleep diary seam, PURE (no React, no
 * Firebase). The program document PAI/projects/arbor/PROGRAM-STEADY-NIGHTS-v0.1.md
 * §"The three measures" is the definition of record; this file is its code.
 *
 *  - `recordRoutineTap` — the parent proxy: one tap after bedtime, "Done in
 *    order" or "Not tonight", on the night's `sleepLogs` document (last tap
 *    that night wins). It counts the PARENT's routine, never the child.
 *  - `recordSleepDiaryNight` — the morning entry: fell asleep · wakings the
 *    parent noticed · woke up for the day; `longestStretchMinutes` is
 *    COMPUTED here, never typed by the parent and never a goal.
 *  - `weekLongestStretch` / `diaryBaseline` / `longestStretchLine` — the child
 *    proxy: per night the longest gap between consecutive diary times, rounded
 *    to the nearest half hour and shown as hours; per week the middle night
 *    (the lower middle on an even count, so it is always a night that
 *    happened) with the number of nights it came from; beside it the family's
 *    first diary week (the first program week with at least three nights).
 *    Never a recommended number of hours, an arrow, better / worse, or a
 *    comparison with other children (clinical firewall).
 *
 * Persistence is the engine's (B-PROG-01, session A): it upserts the returned
 * entry at users/{uid}/children/{childId}/sleepLogs/{entry.date}
 * (useChildCollection(childId, "sleepLogs")). Guard: lib/sleepDiary.test.ts and
 * content/programs/steadyNights.test.ts.
 */
import type { SleepLogEntry } from "../types";

export type RoutineAnswer = NonNullable<SleepLogEntry["routine"]>;

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 24 * 60;

/** "HH:MM" → minutes after midnight, or null. */
export const clockMinutes = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const m = CLOCK.exec(value.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * The longest gap between consecutive diary times (bedtime → noticed wakings →
 * wake), in minutes, with the times unrolled across midnight (each time is
 * after the one before it). Null when a time is malformed, bedtime or wake is
 * missing, or the night would span 24 hours or more.
 */
export function longestStretchMinutes(night: Pick<SleepLogEntry, "bedtime" | "wakings" | "wake">): number | null {
  const raw = [night.bedtime, ...(night.wakings ?? []), night.wake];
  if (night.bedtime === undefined || night.wake === undefined) return null;
  const clocks = raw.map(clockMinutes);
  if (clocks.some((c) => c === null)) return null;
  const unrolled: number[] = [];
  for (const c of clocks as number[]) {
    let t = c;
    const prev = unrolled[unrolled.length - 1];
    if (prev !== undefined) while (t <= prev) t += DAY;
    unrolled.push(t);
  }
  if (unrolled[unrolled.length - 1] - unrolled[0] >= DAY) return null;
  let longest = 0;
  for (let i = 1; i < unrolled.length; i += 1) longest = Math.max(longest, unrolled[i] - unrolled[i - 1]);
  return longest;
}

/** Minutes → hours rounded to the nearest half hour (7 h 40 min → 7.5). */
export const nightHours = (minutes: number): number => Math.round(minutes / 30) / 2;

/** The bedtime tap: last tap that night wins; the morning's diary fields are kept. */
export function recordRoutineTap(
  existing: SleepLogEntry | undefined,
  input: { date: string; answer: RoutineAnswer; now: string; programId?: string },
): SleepLogEntry {
  if (!DATE.test(input.date)) throw new Error(`sleepDiary: bad date ${input.date}`);
  return {
    ...(existing ?? { date: input.date }),
    date: input.date,
    routine: input.answer,
    routineAt: input.now,
    ...(input.programId ? { programId: input.programId } : {}),
    updatedAt: input.now,
  };
}

/** The morning entry: the times as the parent noted them, the longest stretch computed. Null when the times cannot make a night. */
export function recordSleepDiaryNight(
  existing: SleepLogEntry | undefined,
  input: { date: string; bedtime: string; wake: string; wakings?: string[]; now: string; programId?: string },
): SleepLogEntry | null {
  if (!DATE.test(input.date)) return null;
  const wakings = (input.wakings ?? []).map((w) => w.trim()).filter((w) => w.length > 0);
  const longest = longestStretchMinutes({ bedtime: input.bedtime.trim(), wakings, wake: input.wake.trim() });
  if (longest === null) return null;
  const entry: SleepLogEntry = {
    ...(existing ?? { date: input.date }),
    date: input.date,
    bedtime: input.bedtime.trim(),
    wake: input.wake.trim(),
    longestStretchMinutes: longest,
    ...(input.programId ? { programId: input.programId } : {}),
    updatedAt: input.now,
  };
  if (wakings.length) entry.wakings = wakings;
  else delete entry.wakings;
  return entry;
}

const addDays = (date: string, days: number): string => {
  const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
};

/** Program week n (1-based): local dates startedAt + 7(n−1) … startedAt + 7n − 1. */
export const programWeekRange = (startedAt: string, n: number): { from: string; to: string } => ({
  from: addDays(startedAt, 7 * (n - 1)),
  to: addDays(startedAt, 7 * n - 1),
});

/** The nights of one program week (by the evening's date). */
export const nightsInWeek = (entries: readonly SleepLogEntry[], range: { from: string; to: string }): SleepLogEntry[] =>
  entries.filter((e) => e.date >= range.from && e.date <= range.to);

/** Parent proxy: nights tapped "Done in order" in the week (0–7; one per night). "Not tonight" and no tap are not counted. */
export const routineDoneInOrderCount = (entries: readonly SleepLogEntry[], range: { from: string; to: string }): number =>
  new Set(nightsInWeek(entries, range).filter((e) => e.routine === "done_in_order").map((e) => e.date)).size;

/** The per-night hours of a week's diary nights (computed if the stored value is absent). */
const diaryHours = (entries: readonly SleepLogEntry[]): number[] => {
  const byNight = new Map<string, number>();
  for (const e of entries) {
    const minutes = e.longestStretchMinutes ?? longestStretchMinutes(e);
    if (typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0) byNight.set(e.date, nightHours(minutes));
  }
  return [...byNight.values()];
};

/** Child proxy for one week: the middle night (lower middle on an even count) and the number of nights it came from; null with no diary night. */
export function weekLongestStretch(entries: readonly SleepLogEntry[]): { hours: number; nights: number } | null {
  const hours = diaryHours(entries).sort((a, b) => a - b);
  if (!hours.length) return null;
  return { hours: hours[Math.floor((hours.length - 1) / 2)], nights: hours.length };
}

/** The baseline: the first program week with at least three diary nights ("your first diary week"); null until then. */
export function diaryBaseline(weeks: readonly (readonly SleepLogEntry[])[]): { week: number; hours: number; nights: number } | null {
  for (let i = 0; i < weeks.length; i += 1) {
    const w = weekLongestStretch(weeks[i]);
    if (w && w.nights >= 3) return { week: i + 1, ...w };
  }
  return null;
}

const fmt = (hours: number): string => (Number.isInteger(hours) ? String(hours) : hours.toFixed(1));

/**
 * The one line the program page shows for the child proxy. EN
 * "{h} hours · from {k} nights in your diary · {h1} in your first diary week";
 * the baseline part is left out (no message) until the first diary week exists.
 * Never a recommended number, an arrow or a comparison.
 */
export function longestStretchLine(
  week: { hours: number; nights: number },
  baseline: { hours: number } | null,
  lang: "en" | "he",
): string {
  if (lang === "he") {
    const nights = week.nights === 1 ? "מתוך לילה אחד ביומן שלכם" : `מתוך ${week.nights} לילות ביומן שלכם`;
    const base = baseline ? ` · ${fmt(baseline.hours)} בשבוע היומן הראשון שלכם` : "";
    return `${fmt(week.hours)} שעות · ${nights}${base}`;
  }
  const nights = week.nights === 1 ? "from 1 night in your diary" : `from ${week.nights} nights in your diary`;
  const base = baseline ? ` · ${fmt(baseline.hours)} in your first diary week` : "";
  return `${fmt(week.hours)} hours · ${nights}${base}`;
}
