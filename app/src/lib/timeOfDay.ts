export type DayPart = "morning" | "afternoon" | "evening";

/**
 * Pure time-of-day bucket. Caller injects the hour (0–23) for testability —
 * no Date.now() inside, so the Today spine can be reordered deterministically.
 *
 *  - morning:   00:00 – 11:59
 *  - afternoon: 12:00 – 17:59
 *  - evening:   18:00 – 23:59
 *
 * ENG-10: consumed by OverviewTab — "evening" (or the rhythm's wind-down hour,
 * whichever comes first) swaps the Daily Play module for the ONE "Tonight"
 * module (components/overview/todayModules.ts eveningSlotFor).
 */
export function dayPartFor(hour: number): DayPart {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/* ── App-locale clock/date helpers (TJB-22 / CR-14) ─────────────────────────
 * The parent surfaces used to render times through bare
 * `toLocaleTimeString()` / `toLocaleString()` — the BROWSER locale, so a
 * Hebrew UI on an English device read "5:30 PM" beside Hebrew copy. These
 * helpers are driven by the app's active language (same contract as
 * lib/formatDate.ts, which owns DATE-with-month formats); formatDate.guard
 * .test.ts bans new `toLocale*String(` calls under src/components. */

type UiLangLike = "en" | "he" | string;
type DateInput = Date | string | number | null | undefined;

const LOCALE: Record<string, string> = { en: "en-US", he: "he-IL" };
const localeFor = (lang: UiLangLike): string => LOCALE[lang] ?? LOCALE.en;

const toDate = (input: DateInput): Date | null => {
  if (input == null || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
};

const format = (input: DateInput, lang: UiLangLike, options: Intl.DateTimeFormatOptions): string => {
  const d = toDate(input);
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat(localeFor(lang), options).format(d);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(d);
  }
};

/** Clock time only — "5:30 PM" (en) / "17:30" (he). Empty for invalid input. */
export const fmtClockTime = (input: DateInput, lang: UiLangLike): string =>
  format(input, lang, { hour: "numeric", minute: "2-digit" });

/** Short month + day, no year — "Jul 9" / "9 ביולי". */
export const fmtShortDay = (input: DateInput, lang: UiLangLike): string =>
  format(input, lang, { month: "short", day: "numeric" });

/** Short day + clock time — "Jul 9, 5:30 PM" / "9 ביולי, 17:30". */
export const fmtStamp = (input: DateInput, lang: UiLangLike): string =>
  format(input, lang, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
