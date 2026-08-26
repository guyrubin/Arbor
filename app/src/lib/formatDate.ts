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
