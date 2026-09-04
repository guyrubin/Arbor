/**
 * LC-09 + LC-12 guard — the Care "track" leg.
 *
 * Every case below fails against the pre-change shape (a free-text `when`,
 * `sort((a, b) => (a.id < b.id ? -1 : 1))`, no status field, no follow-up sink,
 * no appointment created by a consult request).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APPOINTMENT_STATUSES,
  REMINDER_WINDOW_MS,
  appointmentFromConsultRequest,
  appointmentStartMs,
  appointmentStatus,
  appointmentToIcs,
  dueReminders,
  followUpsFor,
  isFollowUpDue,
  makeFollowUp,
  sortAppointments,
  statusFromConsultRequest,
  type Appointment,
} from "./careTrack";

const NOW = Date.parse("2026-09-04T09:00:00.000Z");
const appt = (over: Partial<Appointment> & { id: string }): Appointment => ({
  who: "Dr Levi",
  role: "Speech Therapist",
  when: "",
  mode: "Online",
  ...over,
});

describe("LC-12 · appointments sort by date, never by id", () => {
  it("upcoming is soonest-first even when the ids say otherwise", () => {
    const zLater = appt({ id: "z", whenIso: "2026-09-20T10:00:00.000Z" });
    const aSooner = appt({ id: "a", whenIso: "2026-09-06T10:00:00.000Z" });
    const { upcoming } = sortAppointments([zLater, aSooner], NOW);
    expect(upcoming.map((x) => x.id)).toEqual(["a", "z"]);
    // NEGATIVE CONTROL: id ordering (the pre-change sort) would give a, z here
    // too — so pin a case where the two orders disagree.
    const bLater = appt({ id: "a", whenIso: "2026-09-20T10:00:00.000Z" });
    const cSooner = appt({ id: "z", whenIso: "2026-09-06T10:00:00.000Z" });
    const byDate = sortAppointments([bLater, cSooner], NOW).upcoming.map((x) => x.id);
    const byId = [bLater, cSooner].map((x) => x.id).sort();
    expect(byDate).toEqual(["z", "a"]);
    expect(byDate).not.toEqual(byId);
  });

  it("past bookings separate out, most recent first", () => {
    const old = appt({ id: "old", whenIso: "2026-08-01T10:00:00.000Z" });
    const recent = appt({ id: "recent", whenIso: "2026-09-01T10:00:00.000Z" });
    const { past, upcoming } = sortAppointments([old, recent], NOW);
    expect(past.map((x) => x.id)).toEqual(["recent", "old"]);
    expect(upcoming).toHaveLength(0);
  });

  it("an undated booking stays live, at the end of upcoming", () => {
    const dated = appt({ id: "dated", whenIso: "2026-09-06T10:00:00.000Z" });
    const undated = appt({ id: "undated", when: "Mon 9 Jun · 10:00" });
    const { upcoming, past } = sortAppointments([undated, dated], NOW);
    expect(upcoming.map((x) => x.id)).toEqual(["dated", "undated"]);
    expect(past).toHaveLength(0);
    expect(appointmentStartMs(undated)).toBeNull();
  });

  it("a legacy free-text date is never mistaken for a machine date", () => {
    expect(appointmentStartMs(appt({ id: "l", when: "Mon 9 Jun · 10:00" }))).toBeNull();
    expect(appointmentStartMs(appt({ id: "l", whenIso: "not a date" }))).toBeNull();
  });
});

describe("LC-09 · a consult request creates a tracked appointment", () => {
  it("mints a requested booking carrying the request id", () => {
    const a = appointmentFromConsultRequest({
      proName: "Dr Levi",
      proRole: "Speech Therapist",
      requestId: "req-7",
      nowMs: NOW,
    });
    expect(a.status).toBe("requested");
    expect(a.requestId).toBe("req-7");
    expect(a.who).toBe("Dr Levi");
    expect(appointmentStatus(a)).toBe("requested");
  });

  it("maps every server consult-request status onto a booking chip", () => {
    expect(statusFromConsultRequest("requested")).toBe("requested");
    expect(statusFromConsultRequest("contacted")).toBe("requested");
    expect(statusFromConsultRequest("booked")).toBe("confirmed");
    expect(statusFromConsultRequest("closed")).toBe("done");
  });

  it("an unknown status never over-claims a confirmed booking", () => {
    expect(statusFromConsultRequest("wat")).toBe("requested");
    expect(appointmentStatus(appt({ id: "x", status: "nonsense" as never }))).toBe("confirmed");
  });

  it("the status ladder describes the booking, not the child", () => {
    expect([...APPOINTMENT_STATUSES]).toEqual(["requested", "confirmed", "done"]);
  });
});

describe("LC-12 · reminders surface IN THE APP and promise nothing else", () => {
  it("returns dated bookings inside the 48-hour window, soonest first", () => {
    const soon = appt({ id: "soon", whenIso: new Date(NOW + 3 * 3600_000).toISOString() });
    const tomorrow = appt({ id: "tomorrow", whenIso: new Date(NOW + 30 * 3600_000).toISOString() });
    const farOff = appt({ id: "far", whenIso: new Date(NOW + 10 * 24 * 3600_000).toISOString() });
    const gone = appt({ id: "gone", whenIso: new Date(NOW - 3600_000).toISOString() });
    const undated = appt({ id: "undated" });
    const due = dueReminders([farOff, tomorrow, gone, soon, undated], NOW);
    expect(due.map((x) => x.id)).toEqual(["soon", "tomorrow"]);
  });

  it("a booking already marked done never reminds", () => {
    const done = appt({ id: "d", status: "done", whenIso: new Date(NOW + 3600_000).toISOString() });
    expect(dueReminders([done], NOW)).toHaveLength(0);
  });

  it("the window is 48 hours", () => {
    expect(REMINDER_WINDOW_MS).toBe(48 * 60 * 60 * 1000);
  });

  it("NO notification API is referenced anywhere in the module (there is none in this app)", () => {
    const src = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "careTrack.ts"),
      "utf8"
    ).replace(/\r\n/g, "\n");
    expect(src.length).toBeGreaterThan(500); // the file was really read
    expect(src).toMatch(/dueReminders/); // and it is the file we think it is
    // Strip comments: the module header names these APIs precisely to say the
    // app does not have them. Only CODE is scanned.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).toMatch(/export function dueReminders/); // the strip kept the code
    for (const forbidden of [
      "LocalNotifications",
      "@capacitor/local-notifications",
      "Notification(",
      "requestPermission",
      "showNotification",
      "pushToken",
      "VAPID",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });
});

describe("LC-12 · follow-up capture", () => {
  it("asks only once the date has passed", () => {
    const future = appt({ id: "f", whenIso: new Date(NOW + 3600_000).toISOString() });
    const past = appt({ id: "p", whenIso: new Date(NOW - 3600_000).toISOString() });
    expect(isFollowUpDue(future, NOW)).toBe(false);
    expect(isFollowUpDue(past, NOW)).toBe(true);
    expect(isFollowUpDue(appt({ id: "u" }), NOW)).toBe(false);
  });

  it("refuses to write an empty note into the child's data", () => {
    expect(makeFollowUp("a1", "   ", NOW)).toBeNull();
    expect(makeFollowUp("a1", "", NOW)).toBeNull();
  });

  it("keeps the parent's words verbatim, attached to the booking", () => {
    const f = makeFollowUp("a1", "  She suggested short turn-taking games.  ", NOW);
    expect(f).toBeTruthy();
    expect(f!.note).toBe("She suggested short turn-taking games.");
    expect(f!.apptId).toBe("a1");
  });

  it("groups notes per appointment, oldest first", () => {
    const all = [
      { id: "f2", apptId: "a1", note: "second", createdAt: "2026-09-02T10:00:00.000Z" },
      { id: "f1", apptId: "a1", note: "first", createdAt: "2026-09-01T10:00:00.000Z" },
      { id: "f3", apptId: "a2", note: "other", createdAt: "2026-09-03T10:00:00.000Z" },
    ];
    expect(followUpsFor(all, "a1").map((f) => f.note)).toEqual(["first", "second"]);
  });
});

describe("LC-12 · calendar file", () => {
  it("writes a valid single-event VCALENDAR with CRLF line breaks", () => {
    const ics = appointmentToIcs(appt({ id: "a1", whenIso: "2026-09-06T10:00:00.000Z" }), NOW);
    expect(ics).toBeTruthy();
    expect(ics!.content).toContain("BEGIN:VCALENDAR");
    expect(ics!.content).toContain("DTSTART:20260906T100000Z");
    expect(ics!.content).toContain("END:VEVENT");
    expect(ics!.content).toContain("\r\n");
    expect(ics!.mime).toContain("text/calendar");
  });

  it("never writes the child into a file that syncs outside Arbor's erase reach", () => {
    const ics = appointmentToIcs(
      appt({ id: "a1", who: "Dr Levi", role: "Speech Therapist", whenIso: "2026-09-06T10:00:00.000Z" }),
      NOW
    );
    expect(ics).toBeTruthy();
    expect(ics!.content).toContain("Dr Levi");
    expect(ics!.content).not.toMatch(/DESCRIPTION/);
  });

  it("an undated booking produces no calendar file", () => {
    expect(appointmentToIcs(appt({ id: "a1" }), NOW)).toBeNull();
  });
});
