import { describe, expect, it } from "vitest";
import { nextNowVisit, selectNowLead, visitForConsult } from "./dayCard";
import { bedtimeDoorOpen } from "../timeOfDay";
import { snoozeOfferIn } from "../companionOffer";
import type { Appointment } from "../careTrack";

const visit = (id: string, whenIso: string, extra: Partial<Appointment> = {}): Appointment => ({ id, whenIso, when: "", who: "", role: "Speech therapist", profession: "slp", mode: "In person", status: "confirmed", ...extra });
const base = { chosen: false, record: false, recordPending: false, tonight: false, visit: null, fallback: "practice" as const };

describe("Now's one-lead priority (B-TODAY-28/34)", () => {
  for (const hour of [8, 14, 20.5]) {
    it(`${hour}: a pending chosen outcome wins, then the visit, evening, record, existing fallback`, () => {
      const now = new Date(2026, 9, 12, Math.floor(hour), (hour % 1) * 60);
      const appointment = nextNowVisit([visit("near", "2026-10-14T10:00:00")], now, {});
      const input = { ...base, tonight: bedtimeDoorOpen(now.getHours()), record: true, visit: appointment };
      expect(selectNowLead({ ...input, chosen: true })).toBe("step");
      expect(selectNowLead(input)).toBe("visit");
      expect(selectNowLead({ ...input, visit: null })).toBe(hour >= 18 ? "tonight" : "record");
      expect(selectNowLead({ ...input, visit: null, record: false })).toBe(hour >= 18 ? "tonight" : "practice");
    });
  }
  it("does not erase a record answer being saved or retried when a visit arrives or evening starts", () => {
    expect(selectNowLead({ ...base, record: true, recordPending: true, tonight: true, visit: visit("a", "2026-10-14T10:00:00") })).toBe("record");
  });
  it("has no Monday recap and leaves an empty child's existing fallback intact", () => {
    for (const fallback of ["practice", "notice", "program", "recommendation"] as const) expect(selectNowLead({ ...base, fallback })).toBe(fallback);
  });
});

describe("visit lead: calendar window, actual time, saved profession and suppression", () => {
  const now = new Date(2026, 9, 12, 14);
  it("excludes past-hour, yesterday, done, undated and requested visits", () => {
    expect(nextNowVisit([
      visit("past-hour", "2026-10-12T13:59:59"), visit("yesterday", "2026-10-11T17:00:00"),
      visit("done", "2026-10-12T15:00:00", { status: "done" }), visit("requested", "2026-10-12T16:00:00", { status: "requested" }),
      visit("undated", ""), visit("later", "2026-10-15T00:00:00"),
    ], now, {})).toBeNull();
  });
  it("chooses the nearest future instant regardless of source order, preserving actual profession", () => {
    const sameDay = visit("soon", "2026-10-12T15:00:00", { profession: "ot", role: "Parent-entered role" });
    const rows = [visit("late", "2026-10-12T18:00:00"), visit("past", "2026-10-12T08:00:00"), sameDay];
    expect(nextNowVisit(rows, now, {})).toBe(sameDay);
    expect(nextNowVisit([...rows].reverse(), now, {})).toBe(sameDay);
  });
  it("uses +2 calendar days, not a 48-hour cutoff, and stops exactly at the visit's hour", () => {
    const future = visit("a", "2026-10-14T23:30:00");
    expect(nextNowVisit([future], now, {})).toBe(future);
    expect(nextNowVisit([future], new Date(future.whenIso!), {})).toBeNull();
  });
  it("honors the existing child's offer-ledger snooze and cannot leak another child's visit", () => {
    const rows = [visit("a", "2026-10-13T10:00:00")];
    const snoozed = snoozeOfferIn({}, "appointment", now.getTime());
    expect(nextNowVisit(rows, now, snoozed)).toBeNull();
    expect(nextNowVisit(rows, new Date(now.getTime() + 3 * 3600000), snoozed)).toBe(rows[0]);
    expect(nextNowVisit([], now, {})).toBeNull();
  });
  it("Consult honors a valid explicit child-owned visit, and fails closed for an obsolete/foreign target", () => {
    const rows = [visit("first", "2026-10-13T10:00:00"), visit("chosen", "2026-10-14T10:00:00")];
    expect(visitForConsult(rows, now.getTime(), "chosen")).toBe(rows[1]);
    expect(visitForConsult(rows, now.getTime(), "foreign")).toBeNull();
    expect(visitForConsult(rows, new Date(2026, 9, 15).getTime(), "chosen")).toBeNull();
    expect(visitForConsult(rows, now.getTime(), null)).toBe(rows[0]);
  });
});
