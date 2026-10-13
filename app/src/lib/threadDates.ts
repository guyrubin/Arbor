import { translate, type UiLang } from "./i18n";
import { fmtDay } from "./formatDate";

/**
 * F-TALK-2 — the Talk thread's date line (mock: "Today · 07:58").
 *
 * One muted line per calendar day of turns, placed before the first turn of
 * that day. The day and the time come from the turn's own `at` stamp (set when
 * the turn was appended); turns saved before stamps existed carry none and
 * draw no line, so an old thread never shows an invented date. Local-time
 * days. Display-time only: never persist the returned label.
 */

export interface DatedTurn {
  at?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

const parse = (at?: string): Date | null => {
  if (!at) return null;
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "2026-10-12" in local time. */
export function threadDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Indexes of the turns that open a new day (the first stamped turn of each day). */
export function threadDayMarks(turns: readonly DatedTurn[]): Set<number> {
  const marks = new Set<number>();
  let lastDay = "";
  turns.forEach((turn, idx) => {
    const date = parse(turn.at);
    if (!date) return;
    const day = threadDayKey(date);
    if (day !== lastDay) {
      marks.add(idx);
      lastDay = day;
    }
  });
  return marks;
}

/** "Today · 07:58", "Yesterday · 21:04", else "Oct 9, 2026 · 07:58" (HE alike). */
export function threadDayLabel(at: string, now: Date, lang: UiLang): string {
  const date = parse(at);
  if (!date) return "";
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const day = threadDayKey(date);
  const label =
    day === threadDayKey(now)
      ? translate(lang, "companion.thread.today")
      : day === threadDayKey(yesterday)
        ? translate(lang, "companion.thread.yesterday")
        : fmtDay(date, lang);
  return `${label} · ${time}`;
}
