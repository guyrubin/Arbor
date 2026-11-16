/**
 * Family plan v1 — day, time and adult labels in the reader's language
 * (explicit locale, never the browser's: components/dateFormat.guard).
 */
import { parseDay, type FamilyPlanAdult, type FamilyPlanDate } from "../../lib/familyPlan/model";
import type { FamilyPlanCopy } from "./familyPlanCopy";

export type Lang = "en" | "he";
const LOCALE: Record<Lang, string> = { en: "en-US", he: "he-IL" };

const fmt = (d: Date, lang: Lang, o: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat(LOCALE[lang], o).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-US", o).format(d);
  }
};

/** "Wed 18" / "יום ד׳ 18". */
export const dayShort = (day: string, lang: Lang) => `${fmt(parseDay(day), lang, { weekday: "short" })} ${parseDay(day).getDate()}`;
/** "Wed" / "יום ד׳". */
export const weekdayShort = (day: string, lang: Lang) => fmt(parseDay(day), lang, { weekday: "short" });
/** "Thursday" / "יום חמישי". */
export const weekdayLong = (day: string, lang: Lang) => fmt(parseDay(day), lang, { weekday: "long" });
/** Day-first, as the boards write it: "19 Nov" / "19 בנוב׳" (long: "19 November"). */
export const monthName = (day: string, lang: Lang, long = false) => fmt(parseDay(day), lang, { month: long ? "long" : "short" });
export const dayMonth = (day: string, lang: Lang, long = false) => (lang === "he" ? fmt(parseDay(day), lang, { day: "numeric", month: long ? "long" : "short" }) : `${parseDay(day).getDate()} ${monthName(day, lang, long)}`);
/** The day number alone, for a date token. */
export const dayNum = (day: string) => String(parseDay(day).getDate());

/** "Thu 19, 10:00" or "Wed 18". */
export function whenLabel(item: Pick<FamilyPlanDate, "date" | "time">, lang: Lang): string {
  return item.time ? `${dayShort(item.date, lang)}, ${item.time}` : dayShort(item.date, lang);
}

/** "Tue 17, 19:00" for a moment in time (a reminder, a request). */
export function momentLabel(ms: number | string, lang: Lang): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return `${fmt(d, lang, { weekday: "short" })} ${d.getDate()}, ${fmt(d, lang, { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

/** "14 to 20 November" (one month) or "28 Nov to 4 Dec" — the ribbon's range, day first. */
export function rangeLabel(first: string, last: string, lang: Lang, c: FamilyPlanCopy, long = false): string {
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return sameMonth ? c.figRange(String(parseDay(first).getDate()), dayMonth(last, lang, long)) : c.figRange(dayMonth(first, lang), dayMonth(last, lang));
}

/** "Wed 18 to Wed 25 Nov" — a span of dates, the month once at the end. */
export function spanLabel(first: string, last: string, lang: Lang, c: FamilyPlanCopy): string {
  return c.figRange(dayShort(first, lang), `${dayShort(last, lang)} ${monthName(last, lang)}`);
}

/** Days from today to a date (0 = today). */
export function daysFrom(today: string, day: string): number {
  return Math.round((parseDay(day).getTime() - parseDay(today).getTime()) / 86400000);
}

/**
 * What the family calls an adult in the plan: "You" for the reader, else the
 * part of their sign-in email before the @ (the family already knows them by
 * it; Arbor does not hold display names for co-parents).
 */
export function adultLabel(adult: Pick<FamilyPlanAdult, "uid" | "email"> | null | undefined, meUid: string, c: FamilyPlanCopy, midSentence = false): string {
  if (!adult) return c.nobodyYet;
  if (adult.uid === meUid) return midSentence ? c.youMid : c.you;
  const local = (adult.email ?? "").split("@")[0];
  return local || c.coParent;
}

/** One initial for the adult's avatar. */
export function adultInitial(label: string): string {
  return (label.trim()[0] ?? "?").toLocaleUpperCase();
}
