/**
 * careTrack — LC-09 + LC-12: the Care "track" leg.
 *
 * Appointments used to keep a name and a free-text string: `when` was typed
 * prose ("Mon 9 Jun · 10:00"), the list sorted by document id, there was no
 * status, nothing captured what the professional said afterwards, and a
 * successful consult request created no appointment at all — "Track it in
 * Appointments" landed on an empty list.
 *
 * This module is the pure half of the fix: a real date, a real status ladder
 * fed from the consult request, date ordering, in-app reminders, an .ics blob,
 * and a follow-up note record. No React, no network, no storage — so the rules
 * are proven by unit test rather than by inspection.
 *
 * ── REMINDER HONESTY (binding) ──────────────────────────────────────────────
 * This app has NO notification infrastructure: no VAPID key, and
 * @capacitor/local-notifications is not a dependency. `dueReminders` therefore
 * returns the appointments to surface IN THE APP on the parent's next open.
 * Nothing here schedules, requests, or implies a phone alert, and the copy that
 * renders it says so out loud (elev.learnCare.appt.reminder.honesty). Do not
 * add a "we'll remind you" promise on top of this function.
 *
 * ── CLINICAL FIREWALL ───────────────────────────────────────────────────────
 * An appointment carries who/when/status and the parent's own follow-up words.
 * No score, no verdict tag, no colour meaning good or bad about the child. The
 * status ladder describes the BOOKING, never the child.
 */

/** Where an appointment sits in the booking ladder. Describes the booking. */
export type AppointmentStatus = "requested" | "confirmed" | "done";

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = ["requested", "confirmed", "done"];

/** The server's consult-request status model (server/consultRequests.ts). */
export type ConsultRequestStatus = "requested" | "contacted" | "booked" | "closed";

/** One appointment. `whenIso` is the machine date; `when` survives as the
 *  human label so records typed before LC-12 are never lost or mis-read. */
export interface Appointment {
  id: string;
  who: string;
  role: string;
  /** Free-text label (legacy records, and anything the parent typed). */
  when: string;
  mode: string;
  /** ISO datetime (`datetime-local` value + seconds) when a real date is set. */
  whenIso?: string;
  status?: AppointmentStatus;
  /** The consult request this appointment was created from (LC-09). */
  requestId?: string;
}

/** A parent's own note after the visit — their words, kept with the booking. */
export interface AppointmentFollowUp {
  id: string;
  apptId: string;
  note: string;
  createdAt: string;
}

/** Consult-request status → the booking chip a parent understands. Fails to
 *  "requested" for any unknown value: we never over-claim that a booking is
 *  confirmed. */
export function statusFromConsultRequest(status: string): AppointmentStatus {
  switch (status) {
    case "booked":
      return "confirmed";
    case "closed":
      return "done";
    case "requested":
    case "contacted":
    default:
      return "requested";
  }
}

/** The effective status of an appointment (absent → a manually added booking
 *  the parent already has, i.e. "confirmed"). Never derived from the clock:
 *  a date passing does not mean the visit happened. */
export function appointmentStatus(appt: Appointment): AppointmentStatus {
  return appt.status && APPOINTMENT_STATUSES.includes(appt.status) ? appt.status : "confirmed";
}

/** LC-09: a successful consult request becomes a tracked appointment, so the
 *  "track" leg of find → share → track finally lands somewhere real. */
export function appointmentFromConsultRequest(input: {
  proName: string;
  proRole: string;
  requestId: string;
  mode?: string;
  nowMs: number;
}): Appointment {
  return {
    id: `a${input.nowMs}`,
    who: input.proName,
    role: input.proRole,
    when: "",
    mode: input.mode ?? "Online",
    status: "requested",
    requestId: input.requestId,
  };
}

/** Parsed start time in ms, or null when the appointment has no real date. */
export function appointmentStartMs(appt: Appointment): number | null {
  if (!appt.whenIso) return null;
  const ms = Date.parse(appt.whenIso);
  return Number.isFinite(ms) ? ms : null;
}

export interface SortedAppointments {
  /** Dated in the future (soonest first), then undated bookings. */
  upcoming: Appointment[];
  /** Dated in the past, most recent first. */
  past: Appointment[];
}

/**
 * Date ordering — the whole point of LC-12. Undated bookings (a request with
 * no date yet) stay in the upcoming list at the end: they are still live, they simply
 * have nothing to sort by. Ties keep insertion order (stable sort).
 */
export function sortAppointments(appts: Appointment[], nowMs: number): SortedAppointments {
  const upcoming: Appointment[] = [];
  const past: Appointment[] = [];
  const undated: Appointment[] = [];
  for (const a of appts) {
    const start = appointmentStartMs(a);
    if (start == null) undated.push(a);
    else if (start >= nowMs) upcoming.push(a);
    else past.push(a);
  }
  upcoming.sort((a, b) => (appointmentStartMs(a) ?? 0) - (appointmentStartMs(b) ?? 0));
  past.sort((a, b) => (appointmentStartMs(b) ?? 0) - (appointmentStartMs(a) ?? 0));
  return { upcoming: [...upcoming, ...undated], past };
}

/** How far ahead an in-app reminder surfaces (48 h). */
export const REMINDER_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * The appointments to show the parent IN THE APP right now: dated, not yet
 * marked done, and starting within the next 48 hours. This is a render input,
 * not a schedule — nothing is queued and no alert is sent (see the module
 * header). Soonest first.
 */
export function dueReminders(
  appts: Appointment[],
  nowMs: number,
  windowMs: number = REMINDER_WINDOW_MS
): Appointment[] {
  return appts
    .filter((a) => {
      if (appointmentStatus(a) === "done") return false;
      const start = appointmentStartMs(a);
      return start != null && start >= nowMs && start <= nowMs + windowMs;
    })
    .sort((a, b) => (appointmentStartMs(a) ?? 0) - (appointmentStartMs(b) ?? 0));
}

/** True when the visit's date has passed — the moment to ask "how did it go?".
 *  Asking is not the same as asserting: the status stays whatever it was. */
export function isFollowUpDue(appt: Appointment, nowMs: number): boolean {
  const start = appointmentStartMs(appt);
  return start != null && start < nowMs;
}

/* ── Calendar egress ─────────────────────────────────────────────────────────
 * A single VEVENT, built from the appointment fields only. The child's name is
 * NOT written into the calendar file: a calendar entry syncs to devices and
 * services well outside Arbor's erase reach, so it carries the professional,
 * the role and the time — nothing about the child.
 */

const icsEscape = (v: string): string =>
  v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** ISO → the basic UTC form iCalendar wants (YYYYMMDDTHHMMSSZ). */
export function icsStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export interface IcsFile {
  filename: string;
  mime: string;
  content: string;
}

/** Default visit length when a calendar entry needs an end time (60 minutes). */
export const ICS_DEFAULT_DURATION_MS = 60 * 60 * 1000;

/** Build the .ics text for one dated appointment. Returns null when there is
 *  no real date to write — an undated booking is not a calendar entry. */
export function appointmentToIcs(appt: Appointment, nowMs: number): IcsFile | null {
  const start = appointmentStartMs(appt);
  if (start == null) return null;
  const summary = appt.role ? `${appt.who} — ${appt.role}` : appt.who;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Arbor//Care//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${appt.id}@arbor`,
    `DTSTAMP:${icsStamp(nowMs)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(start + ICS_DEFAULT_DURATION_MS)}`,
    `SUMMARY:${icsEscape(summary)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return {
    filename: `arbor-appointment-${appt.id}.ics`,
    mime: "text/calendar;charset=utf-8",
    // RFC 5545 line breaks.
    content: lines.join("\r\n") + "\r\n",
  };
}

/** Follow-up notes belonging to one appointment, oldest first. */
export function followUpsFor(all: AppointmentFollowUp[], apptId: string): AppointmentFollowUp[] {
  return all
    .filter((f) => f.apptId === apptId)
    .sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));
}

/** Mint a follow-up record. Empty/whitespace notes are refused (null) so a
 *  blank record can never be written into the child's data. */
export function makeFollowUp(apptId: string, note: string, nowMs: number): AppointmentFollowUp | null {
  const text = note.trim();
  if (!text) return null;
  return { id: `f${nowMs}`, apptId, note: text, createdAt: new Date(nowMs).toISOString() };
}
