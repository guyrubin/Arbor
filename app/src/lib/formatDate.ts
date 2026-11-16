import { isolate, type UiLang } from "./i18n";

/**
 * F-09 — ONE date-rendering seam for every parent surface.
 *
 * The app previously rendered dates through bare zero-arg
 * `toLocaleDateString()` calls, so the same screen could show four different
 * formats depending on the BROWSER locale — including ambiguous numeric
 * DD/MM vs MM/DD. These helpers are driven by the APP's active language
 * (uiLang, same contract as formatWeekLabel in useWeeklyRecap): an English UI
 * on a Hebrew machine still reads "Jul 9, 2026", and a Hebrew UI reads
 * "9 ביול׳ 2026" — always an explicit month NAME, never an ambiguous number.
 *
 * Output is routed through i18n `isolate()` (FSI…PDI, applied only when the
 * string carries RTL characters) so a Hebrew month name dropped into
 * surrounding LTR text cannot reorder it. DISPLAY-TIME ONLY — never persist
 * the returned string (same rule as isolate itself).
 *
 * A guard test (formatDate.guard.test.ts) bans new zero-arg
 * toLocaleDateString() calls in src/components.
 */

const LOCALES: Record<UiLang, string> = { en: "en-US", he: "he-IL" };

type DateInput = Date | string | number | null | undefined;

const toDate = (input: DateInput): Date | null => {
  if (input == null || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmt = (input: DateInput, lang: UiLang, options: Intl.DateTimeFormatOptions): string => {
  const d = toDate(input);
  if (!d) return "";
  let s: string;
  try {
    s = d.toLocaleDateString(LOCALES[lang] ?? LOCALES.en, options);
  } catch {
    // Unknown locale in an exotic runtime — still an explicit-month format.
    s = d.toLocaleDateString(undefined, options);
  }
  return isolate(s);
};

/** Compact day date — "Jul 9, 2026" / "9 ביול׳ 2026". Empty string for missing/invalid input. */
export const fmtDay = (input: DateInput, lang: UiLang): string =>
  fmt(input, lang, { day: "numeric", month: "short", year: "numeric" });

/** Long day date — "July 9, 2026" / "9 ביולי 2026". */
export const fmtDayLong = (input: DateInput, lang: UiLang): string =>
  fmt(input, lang, { day: "numeric", month: "long", year: "numeric" });

/** Month + year — "July 2026" / "יולי 2026". */
export const fmtMonthYear = (input: DateInput, lang: UiLang): string =>
  fmt(input, lang, { month: "long", year: "numeric" });

/**
 * TJB-22 — day + time in one string ("Jul 9, 2026, 4:15 PM" / "9 ביול׳ 2026,
 * 16:15"). The Behaviors list, its PDF export and the week headers rendered
 * bare `toLocaleString()` / `toLocaleDateString(undefined, …)`, so the SAME
 * screen showed the app's language and the machine's date format side by side
 * — and an ambiguous numeric date at that.
 */
export const fmtDayTime = (input: DateInput, lang: UiLang): string => {
  const d = toDate(input);
  if (!d) return "";
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  };
  let s: string;
  try {
    s = d.toLocaleString(LOCALES[lang] ?? LOCALES.en, options);
  } catch {
    s = d.toLocaleString(undefined, options);
  }
  return isolate(s);
};

/** Compact day WITHOUT a year — "Jul 9" / "9 ביול׳". For a within-range label
 *  (a week header) where the year is carried by the surrounding context. */
export const fmtDayShort = (input: DateInput, lang: UiLang): string =>
  fmt(input, lang, { day: "numeric", month: "short" });

/**
 * v10 — the shell's "when" beside the pill row: weekday, day and month, then the
 * time ("Monday, November 16 · 5:40 PM" / "יום שני, 16 בנובמבר · 17:40"). The
 * locale decides the order and the clock; the separator is the app's middle dot.
 */
export const fmtShellNow = (input: DateInput, lang: UiLang): string => {
  const d = toDate(input);
  if (!d) return "";
  const locale = LOCALES[lang] ?? LOCALES.en;
  let day: string;
  let time: string;
  try {
    day = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    time = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  } catch {
    day = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return isolate(`${day} · ${time}`);
};

/**
 * v10.3 (the My child boards) — a day-first short day with its weekday:
 * "Sun 15 Nov" / "יום א׳, 15 בנוב׳", and with the clock when asked
 * ("Sun 15 Nov, 18:00"). English reads day-first here (en-GB), as the boards
 * set it; no year (the range around it carries the year).
 */
export const fmtDayWeek = (input: DateInput, lang: UiLang, withTime = false): string => {
  const d = toDate(input);
  if (!d) return "";
  const locale = lang === "he" ? LOCALES.he : "en-GB";
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short", day: "numeric", month: "short",
    ...(withTime ? { hour: "2-digit" as const, minute: "2-digit" as const, hourCycle: "h23" as const } : {}),
  };
  let s: string;
  try {
    s = withTime ? d.toLocaleString(locale, options) : d.toLocaleDateString(locale, options);
  } catch {
    s = withTime ? d.toLocaleString(undefined, options) : d.toLocaleDateString(undefined, options);
  }
  return isolate(s);
};

/** The same day-first short form without the weekday: "8 Oct" / "8 באוק׳". */
export const fmtDayMonth = (input: DateInput, lang: UiLang): string => {
  const d = toDate(input);
  if (!d) return "";
  try {
    return isolate(d.toLocaleDateString(lang === "he" ? LOCALES.he : "en-GB", { day: "numeric", month: "short" }));
  } catch {
    return isolate(d.toLocaleDateString(undefined, { day: "numeric", month: "short" }));
  }
};
