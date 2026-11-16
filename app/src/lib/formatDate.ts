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
 * time, as every v10 board draws it ("Monday 16 November · 17:40" /
 * "יום שני, 16 בנובמבר · 17:40"): day-first and a 24-hour clock in both
 * languages (canvas V77). The separator is the app's middle dot.
 */
export const fmtShellNow = (input: DateInput, lang: UiLang): string => {
  const d = toDate(input);
  if (!d) return "";
  const locale = lang === "he" ? "he-IL" : "en-GB";
  let day: string;
  try {
    day = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  } catch {
    day = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  }
  return isolate(`${day} · ${fmtTimeV10(d, lang)}`);
};

/* ── v10 / canvas V77: the day as the boards draw it ───────────────────────
   Every v10 board writes a day as weekday, day, short month ("Sat 14 Nov",
   "Wed 25 Nov, 10:00") with a 24-hour clock, and a time alone as "10:00".
   English uses en-GB for that day-first order; Hebrew keeps he-IL. The year
   appears only when the date is not in the current year, so an old date can
   never pass as this year's. Same seam rules as above: explicit month names,
   isolate() for Hebrew, display-time only. Legacy screens keep fmtDay. */
const V10_LOCALES: Record<UiLang, string> = { en: "en-GB", he: "he-IL" };

const v10DayOptions = (d: Date, now: Date): Intl.DateTimeFormatOptions => ({
  weekday: "short", day: "numeric", month: "short",
  ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
});

const v10Time = (d: Date, lang: UiLang): string => {
  const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  try {
    return d.toLocaleTimeString(V10_LOCALES[lang] ?? V10_LOCALES.en, options);
  } catch {
    return d.toLocaleTimeString(undefined, options);
  }
};

/** v10 day — "Sat 14 Nov" / "שבת, 14 בנוב׳" (year added outside the current year). */
export const fmtDayV10 = (input: DateInput, lang: UiLang, now: Date = new Date()): string => {
  const d = toDate(input);
  if (!d) return "";
  const options = v10DayOptions(d, now);
  let s: string;
  try {
    if (lang === "he") {
      s = d.toLocaleDateString(V10_LOCALES.he, options);
    } else {
      // The boards' English form has no punctuation: "Sat 14 Nov", "Fri 14 Nov 2025".
      const parts = new Intl.DateTimeFormat(V10_LOCALES.en, options).formatToParts(d);
      const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
      s = [pick("weekday"), pick("day"), pick("month"), pick("year")].filter(Boolean).join(" ");
    }
  } catch {
    s = d.toLocaleDateString(undefined, options);
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

/** v10 day and time — "Wed 25 Nov, 10:00" / "יום ד׳, 25 בנוב׳, 10:00" (24-hour clock). */
export const fmtDayTimeV10 = (input: DateInput, lang: UiLang, now: Date = new Date()): string => {
  const d = toDate(input);
  if (!d) return "";
  const day = fmtDayV10(d, lang, now).replace(/[⁨⁩]/g, "");
  return isolate(`${day}, ${v10Time(d, lang)}`);
};

/** v10 time alone — "10:00" / "17:40" (24-hour clock, both languages). */
export const fmtTimeV10 = (input: DateInput, lang: UiLang): string => {
  const d = toDate(input);
  return d ? v10Time(d, lang) : "";
};

