/**
 * B-ASKJB-14 — Journal finds things: the pure predicates behind the filter
 * row (All · Hard moments · Kept from Arbor · search · month jump).
 *
 * On-device only: the search is a substring match over the row's own text
 * (trigger, response, notes, the localized type label and the row's title /
 * detail) — nothing is sent anywhere and nothing is stored (search state is
 * per session, held in component state).
 */
import type { TimelineSignal } from "./signalTimeline";
import type { BehaviorLog } from "../types";
import { isIncidentType } from "../content/behaviorTaxonomy";

export type JournalFilter = "all" | "hard" | "kept";
export const JOURNAL_FILTERS: readonly JournalFilter[] = ["all", "hard", "kept"];

/** The BehaviorLog behind a moment row (`moment-{logId}`), if any. */
export const momentLogId = (s: Pick<TimelineSignal, "id" | "kind">): string | null =>
  s.kind === "moment" && s.id.startsWith("moment-") ? s.id.slice("moment-".length) : null;

/** Case-folded for HE + EN; trims the query. */
export const foldText = (text: string): string => text.toLocaleLowerCase().normalize("NFC").trim();

/** Everything a row can be found by, folded once. */
export function journalSearchText(
  s: Pick<TimelineSignal, "refTitle" | "detail">,
  log: Pick<BehaviorLog, "trigger" | "response" | "notes"> | undefined,
  label: string,
): string {
  return foldText([label, s.refTitle, s.detail, log?.trigger, log?.response, log?.notes].filter(Boolean).join("\n"));
}

export interface JournalFilterContext {
  filter: JournalFilter;
  query: string;
  logsById: ReadonlyMap<string, Pick<BehaviorLog, "behaviorType" | "trigger" | "response" | "notes">>;
  /** Signal ids kept from an Arbor answer (captureProvenance). */
  keptIds: ReadonlySet<string>;
  /** The localized title of a row (signalTitle → behaviorTypeLabel for moments). */
  labelOf: (s: TimelineSignal) => string;
}

/** A row is a hard moment when its log carries an incident type. */
export function isHardMomentSignal(s: TimelineSignal, logsById: JournalFilterContext["logsById"]): boolean {
  const id = momentLogId(s);
  const log = id ? logsById.get(id) : undefined;
  return !!log && isIncidentType(log.behaviorType);
}

export function matchesJournalFilter(s: TimelineSignal, ctx: JournalFilterContext): boolean {
  if (ctx.filter === "hard" && !isHardMomentSignal(s, ctx.logsById)) return false;
  if (ctx.filter === "kept" && !ctx.keptIds.has(s.id)) return false;
  const q = foldText(ctx.query);
  if (!q) return true;
  const id = momentLogId(s);
  return journalSearchText(s, id ? ctx.logsById.get(id) : undefined, ctx.labelOf(s)).includes(q);
}

/** "YYYY-MM" months present in groupByDay's day keys, newest first; "ongoing" skipped. */
export function journalMonthKeys(groupKeys: readonly string[]): string[] {
  const out: string[] = [];
  for (const key of groupKeys) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const month = key.slice(0, 7);
    if (!out.includes(month)) out.push(month);
  }
  return out;
}

/** The first day group of a month — where the month jump scrolls to. */
export const firstGroupOfMonth = (groupKeys: readonly string[], month: string): string | null =>
  groupKeys.find((key) => key.startsWith(`${month}-`)) ?? null;

/** A localized "September 2026" / "ספטמבר 2026" for a "YYYY-MM" key (UTC, like dayKey). */
export const monthLabel = (month: string, locale: "en" | "he"): string => {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)));
};
