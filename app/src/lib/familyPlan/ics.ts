/**
 * Family plan v1: "Add to my calendar" through the app's existing calendar
 * egress (lib/careTrack saveIcsFile: native share sheet first, browser
 * download second, never a false "saved").
 *
 * As with appointments, the calendar file carries the date's own name and
 * time only: never the child's name, the message line or the adults, because
 * a calendar entry syncs to devices and services outside Arbor's erase reach.
 */
import { ICS_DEFAULT_DURATION_MS, icsStamp, type IcsFile } from "../careTrack";
import { addDays, startMs, type FamilyPlanDate } from "./model";

const icsEscape = (v: string): string =>
  v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const basicDay = (day: string) => day.replace(/-/g, "");

function vevent(item: FamilyPlanDate, nowMs: number): string[] {
  const when = item.time
    ? [`DTSTART:${icsStamp(startMs(item))}`, `DTEND:${icsStamp(startMs(item) + ICS_DEFAULT_DURATION_MS)}`]
    : [`DTSTART;VALUE=DATE:${basicDay(item.date)}`, `DTEND;VALUE=DATE:${basicDay(addDays(item.date, 1))}`];
  return [
    "BEGIN:VEVENT",
    // The version is part of the UID's sequence so a changed date updates the entry.
    `UID:family-plan-${item.id}@arbor`,
    `SEQUENCE:${Math.max(0, item.version - 1)}`,
    `DTSTAMP:${icsStamp(nowMs)}`,
    ...when,
    `SUMMARY:${icsEscape(item.title)}`,
    "END:VEVENT",
  ];
}

/** One calendar file for one or more dates. Null when there is nothing open to write. */
export function familyPlanToIcs(items: readonly FamilyPlanDate[], nowMs: number): IcsFile | null {
  const open = items.filter((d) => d.status !== "cancelled");
  if (!open.length) return null;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Arbor//Family plan//EN", "CALSCALE:GREGORIAN", ...open.flatMap((d) => vevent(d, nowMs)), "END:VCALENDAR"];
  return {
    filename: open.length === 1 ? `arbor-family-plan-${open[0].id}.ics` : "arbor-family-plan.ics",
    mime: "text/calendar;charset=utf-8",
    content: lines.join("\r\n") + "\r\n",
  };
}
