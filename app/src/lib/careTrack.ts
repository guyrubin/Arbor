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
 * fed from the consult request, date ordering, in-app reminders, an .ics file,
 * and a follow-up note record. No React, no network, no storage — so the rules
 * are proven by unit test rather than by inspection.
 *
 * ONE deliberate exception: `saveIcsFile` at the bottom, which hands the built
 * .ics to the platform. Every platform touch it makes is a dependency it is
 * GIVEN, so it is unit-testable with fakes in the same node environment as the
 * rest of this file, and the decision it encodes (native share sheet before
 * browser download) is provable rather than a matter of inspection. Keep it
 * that way: no direct `document`, `window` or Capacitor reference above the
 * default-deps factory.
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
 *  confirmed.
 *
 *  ── NOT WIRED, ON PURPOSE (2026-09-04) ────────────────────────────────────
 *  This function has NO production caller. That is a documented state, not a
 *  missing import: nothing in this repo can move a consult request off
 *  "requested" in the first place. `buildConsultRequest`
 *  (server/consultRequests.ts) hard-codes `status: "requested"`, and
 *  `ConsultStore` exposes only `create` and `listByOwner` — there is no update
 *  seam, no staffed workflow, and no admin surface behind
 *  `POST/GET /api/consult-requests`. Mapping today would turn "requested" into
 *  "requested" and, worse, would overwrite the local "done" a parent earns by
 *  saving a follow-up note.
 *
 *  To wire it, in this order: (1) give `ConsultStore` a status-update seam and
 *  an authenticated route that drives it; (2) have Appointments read
 *  `GET /api/consult-requests` and match on `Appointment.requestId`; (3) apply
 *  this mapping ONLY when it moves the row FORWARD along
 *  `APPOINTMENT_STATUSES`, so a server still sitting on "requested" can never
 *  walk back a booking the parent has already completed. Until (1) exists, the
 *  honest surface is the one shipped: a locally-stamped status, and an
 *  Appointments header that says so. */
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

/* ── Calendar egress, part 2: actually getting the file OFF the device ───────
 *
 * Two claims in this repo could not both be true. `schoolBrief.ts` justifies
 * the LC-11 rewrite of the School Brief export with "on a Capacitor WKWebView a
 * blob `<a download>` is not reliable egress at all", while Appointments saved
 * the .ics with exactly that mechanism — `new Blob(...)` + `<a download>` +
 * `click()`. This app ships through Capacitor 8 (`@capacitor/core` ^8.4.0), so
 * on iOS the page runs inside a WKWebView where a programmatic download of a
 * blob: URL has no user-visible destination: nothing is written, nothing opens,
 * and no error fires — the toast still said the file was saved.
 *
 * `lib/reportExport.openPrintableReport` already resolved this for the report
 * PDF: native → write to Cache with @capacitor/filesystem, then open the OS
 * share sheet with @capacitor/share; web → the browser path. This function is
 * the same ladder for the .ics.
 *
 * WHY NOT THE PRINT SHELL THE SCHOOL BRIEF CHOSE: that conclusion was about the
 * FORMAT, not the transport — a teacher cannot open a .md, so the brief became
 * a printable document. An .ics is not read by a human at all; it is consumed
 * by a calendar app, which is reached through the OS share/open-in sheet.
 * Printing an .ics would destroy it. Same transport ladder as the report, same
 * reason; different final format, for a reason stated here so the next reader
 * is not left holding two contradicting claims.
 */

/** Where the .ics actually went. `unavailable` = neither path was possible,
 *  and the caller must NOT tell the parent the file was saved. */
export type IcsEgressChannel = "native_share" | "download" | "unavailable";

export interface IcsEgressDeps {
  /** True inside the Capacitor native runtime (iOS/Android WebView). */
  isNative: () => boolean;
  /** Write to cache + open the OS share sheet. Rejects if either half fails. */
  shareNative: (file: IcsFile) => Promise<void>;
  /** Browser download. Returns false when the DOM path is not available. */
  downloadWeb: (file: IcsFile) => boolean;
}

/**
 * Hand one .ics to the platform: native share sheet first, browser download
 * second. Never throws — a failed native share falls through to the browser
 * path, and only a failure of BOTH reports `unavailable`.
 */
export async function saveIcsFile(file: IcsFile, deps: IcsEgressDeps): Promise<IcsEgressChannel> {
  let native = false;
  try {
    native = deps.isNative();
  } catch {
    /* an exotic runtime that cannot even be probed is, by definition, not it */
  }
  if (native) {
    try {
      await deps.shareNative(file);
      return "native_share";
    } catch {
      /* user cancelled, or the plugin is unavailable — try the browser path */
    }
  }
  try {
    return deps.downloadWeb(file) ? "download" : "unavailable";
  } catch {
    return "unavailable";
  }
}

/** The real platform deps. Everything that touches Capacitor or the DOM lives
 *  here, behind dynamic imports, so this module still loads in node. */
export function defaultIcsEgressDeps(): IcsEgressDeps {
  return {
    isNative: () => {
      try {
        const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
        return typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : false;
      } catch {
        return false;
      }
    },
    shareNative: async (f) => {
      const [{ Share }, { Filesystem, Directory, Encoding }] = await Promise.all([
        import("@capacitor/share"),
        import("@capacitor/filesystem"),
      ]);
      const written = await Filesystem.writeFile({
        path: f.filename,
        data: f.content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      // No title/text: the calendar entry's own SUMMARY is the label, and this
      // module never puts the child's name into a calendar file (see above).
      await Share.share({ files: [written.uri] });
    },
    downloadWeb: (f) => {
      if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") return false;
      const url = URL.createObjectURL(new Blob([f.content], { type: f.mime }));
      const link = document.createElement("a");
      link.href = url;
      link.download = f.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return true;
    },
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
