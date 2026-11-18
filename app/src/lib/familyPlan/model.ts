/**
 * Family plan v1: the data model.
 *
 * A Family plan date is one dated thing about the child's kindergarten or
 * school day (a deadline, an event, a time a parent is asked to join) and the
 * adult who has it. It lives under the child as the `familyPlanDates`
 * subcollection (lib/childData.ts CHILD_SUBCOLLECTIONS: export + erase), the
 * owner writes it from the client (hooks/useFamilyPlan.ts) and a co-parent in
 * the same family answers a request through the server on their share grant
 * (server/familyPlanCoParent.ts). Nothing here judges the child: a date is
 * about adults and a calendar, and the only figures are counts of dates.
 *
 * Every transition is a pure function that returns the next row with a
 * history line appended, so the owner's client, the server and the tests all
 * move a date the same way.
 */

export const FAMILY_PLAN_COLLECTION = "familyPlanDates";

/** deadline = something due by a day · event = something happening · join = a parent is asked to come. */
export type FamilyPlanKind = "deadline" | "event" | "join";
export const FAMILY_PLAN_KINDS: readonly FamilyPlanKind[] = ["deadline", "event", "join"];

export type FamilyPlanRole = "owner" | "co_parent";

/** An adult in the family: the owner, or a co-parent who joined on a grant. */
export interface FamilyPlanAdult {
  uid: string;
  role: FamilyPlanRole;
  /** The adult's sign-in email (what the family already knows them by). */
  email?: string | null;
  /** The share grant a co-parent joined on. */
  grantId?: string;
}

export type FamilyPlanRequestStatus = "asked" | "accepted" | "declined" | "closed";

/** A message from one adult to another: "can you take this one?". */
export interface FamilyPlanRequest {
  toUid: string;
  toEmail?: string | null;
  grantId?: string;
  fromUid: string;
  /** The asker's own words, as sent. */
  note: string;
  askedAt: string;
  /** The version of the date the request is for: a yes counts for that version only. */
  forVersion: number;
  status: FamilyPlanRequestStatus;
  answeredAt?: string;
}

export interface FamilyPlanPrep {
  id: string;
  text: string;
  done: boolean;
}

/** A change read from a newer version of the message, waiting for the parent. */
export interface FamilyPlanPendingChange {
  date: string;
  time?: string;
  /** The new version's line, the parent's own source text. */
  sourceLine?: string;
  receivedAt: string;
}

/** One earlier version of the date's day and time, kept when a change is applied. */
export interface FamilyPlanVersion {
  version: number;
  date: string;
  time?: string;
  /** The message line it came from, when it came from a message. */
  sourceLine?: string;
  replacedAt: string;
}

export type FamilyPlanHistoryKind =
  | "added"
  | "asked"
  | "took"
  | "accepted"
  | "declined"
  | "changed"
  | "reminder_stopped"
  | "request_closed"
  | "prep_added"
  | "done"
  | "cancelled"
  | "edited";

export interface FamilyPlanHistory {
  at: string;
  kind: FamilyPlanHistoryKind;
  /** Who did it (uid); absent for the system. */
  by?: string;
  /** The version the line is about. */
  version?: number;
  /** The other adult the line names (uid), e.g. who was asked. */
  who?: string;
  /** The day/time the line names, e.g. the old time that changed. */
  date?: string;
  time?: string;
}

export interface FamilyPlanDate {
  id: string;
  kind: FamilyPlanKind;
  /** The parent-kept name of the date, at most 120 characters. */
  title: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  /** Local time HH:MM, when the date has one. */
  time?: string;
  /** The line of the school message this came from (the parent's own source text). */
  sourceLine?: string;
  /** That line's number in the message (1-based), when it came from a message. */
  sourceLineNo?: number;
  /**
   * A newer version of the message moved this date and the parent has not
   * decided yet ("One change to review"). Nothing about the date changes
   * until they apply it (applyChange) or keep both dates.
   */
  pendingChange?: FamilyPlanPendingChange | null;
  /** Groups the dates kept from one pasted message. */
  messageId?: string;
  /** "message" when kept from a reviewed school message, "manual" when typed. */
  origin: "message" | "manual";
  version: number;
  previous?: FamilyPlanVersion[];
  holder?: FamilyPlanAdult | null;
  request?: FamilyPlanRequest | null;
  prep?: FamilyPlanPrep[];
  status: "open" | "done" | "cancelled";
  doneAt?: string;
  history: FamilyPlanHistory[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/* ── validation ──────────────────────────────────────────────────────────── */

export const TITLE_MAX = 120;
export const NOTE_MAX = 400;
export const SOURCE_LINE_MAX = 400;
export const PREP_MAX = 12;
export const HISTORY_MAX = 60;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A real calendar day in YYYY-MM-DD (rejects 2026-02-31). */
export function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function isTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

export const isKind = (value: unknown): value is FamilyPlanKind =>
  typeof value === "string" && (FAMILY_PLAN_KINDS as readonly string[]).includes(value);

export const clean = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/* ── day arithmetic (local calendar days) ─────────────────────────────────── */

export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Local start time of a date (its time, or the start of the day). */
export function startMs(item: Pick<FamilyPlanDate, "date" | "time">): number {
  const d = parseDay(item.date);
  if (item.time && isTime(item.time)) {
    const [h, m] = item.time.split(":").map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d.getTime();
}

/** Soonest first; a date without a time sorts before a timed one on the same day. */
export const bySoonest = (a: FamilyPlanDate, b: FamilyPlanDate): number =>
  a.date === b.date ? (a.time ?? "").localeCompare(b.time ?? "") : a.date.localeCompare(b.date);

/* ── the date's state for a reader ────────────────────────────────────────── */

/** has = an adult has it · asked = asked, no answer yet · none = nobody yet. */
export type FamilyPlanState = "has" | "asked" | "none";

export function stateOf(item: FamilyPlanDate): FamilyPlanState {
  if (item.holder) return "has";
  if (item.request?.status === "asked") return "asked";
  return "none";
}

/* ── transitions ──────────────────────────────────────────────────────────── */

const withHistory = (item: FamilyPlanDate, line: FamilyPlanHistory, patch: Partial<FamilyPlanDate>): FamilyPlanDate => ({
  ...item,
  ...patch,
  history: [...item.history, line].slice(-HISTORY_MAX),
  updatedAt: line.at,
});

export interface NewDateInput {
  id: string;
  kind: FamilyPlanKind;
  title: string;
  date: string;
  time?: string;
  sourceLine?: string;
  sourceLineNo?: number;
  messageId?: string;
  origin: "message" | "manual";
  prep?: string[];
}

/** A new date nobody has yet. Throws on an invalid title, day or time. */
export function createDate(input: NewDateInput, byUid: string, nowIso: string): FamilyPlanDate {
  const title = clean(input.title, TITLE_MAX);
  if (!title) throw new Error("invalid_title");
  if (!isDay(input.date)) throw new Error("invalid_date");
  if (input.time && !isTime(input.time)) throw new Error("invalid_time");
  if (!isKind(input.kind)) throw new Error("invalid_kind");
  const sourceLine = clean(input.sourceLine, SOURCE_LINE_MAX);
  const prep = (input.prep ?? []).map((text, i) => ({ id: `${input.id}-p${i}`, text: clean(text, TITLE_MAX), done: false })).filter((p) => p.text).slice(0, PREP_MAX);
  return {
    id: input.id,
    kind: input.kind,
    title,
    date: input.date,
    ...(input.time ? { time: input.time } : {}),
    ...(sourceLine ? { sourceLine } : {}),
    ...(sourceLine && input.sourceLineNo && input.sourceLineNo > 0 ? { sourceLineNo: Math.trunc(input.sourceLineNo) } : {}),
    ...(input.messageId ? { messageId: input.messageId } : {}),
    origin: input.origin,
    version: 1,
    holder: null,
    request: null,
    prep,
    status: "open",
    history: [{ at: nowIso, kind: "added", by: byUid, version: 1 }],
    createdBy: byUid,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** The asker takes the date themself. Closes an open request to someone else. */
export function takeIt(item: FamilyPlanDate, me: FamilyPlanAdult, nowIso: string): FamilyPlanDate {
  const request = item.request && item.request.status === "asked" ? { ...item.request, status: "closed" as const, answeredAt: nowIso } : item.request ?? null;
  return withHistory(item, { at: nowIso, kind: "took", by: me.uid, version: item.version }, { holder: me, request });
}

/** Ask one adult in the family to take it. A previous holder is released: "sent is not accepted". */
export function askAdult(item: FamilyPlanDate, from: string, to: FamilyPlanAdult, note: string, nowIso: string): FamilyPlanDate {
  const request: FamilyPlanRequest = {
    toUid: to.uid,
    toEmail: to.email ?? null,
    ...(to.grantId ? { grantId: to.grantId } : {}),
    fromUid: from,
    note: clean(note, NOTE_MAX),
    askedAt: nowIso,
    forVersion: item.version,
    status: "asked",
  };
  return withHistory(item, { at: nowIso, kind: "asked", by: from, who: to.uid, version: item.version }, { request, holder: null });
}

export type AnswerError = "not_asked" | "not_for_you" | "date_changed";

/**
 * The asked adult answers. A yes counts for the version it was asked for only:
 * if the date changed after the request, the answer is refused (`date_changed`)
 * and the adult sees the new version. Answering twice the same way is a no-op.
 */
export function answerRequest(
  item: FamilyPlanDate,
  actor: FamilyPlanAdult,
  answer: "yes" | "no",
  version: number,
  nowIso: string,
): { ok: true; item: FamilyPlanDate; changed: boolean } | { ok: false; error: AnswerError } {
  const req = item.request;
  if (!req) return { ok: false, error: "not_asked" };
  if (req.toUid !== actor.uid) return { ok: false, error: "not_for_you" };
  if (req.forVersion !== item.version || version !== item.version) return { ok: false, error: "date_changed" };
  const target = answer === "yes" ? "accepted" : "declined";
  if (req.status === target) return { ok: true, item, changed: false };
  if (req.status !== "asked") return { ok: false, error: "not_asked" };
  const next = withHistory(
    item,
    { at: nowIso, kind: answer === "yes" ? "accepted" : "declined", by: actor.uid, version: item.version },
    { request: { ...req, status: target, answeredAt: nowIso }, holder: answer === "yes" ? actor : item.holder ?? null },
  );
  return { ok: true, item: next, changed: true };
}

/**
 * A newer version of the message moved the date. The old day/time is kept in
 * `previous`, the version goes up, the queued reminder for the old time stops,
 * and whoever had it or was asked is asked again for the new version (their
 * earlier yes does not carry over). Returns the row and whom it re-asks.
 */
export function applyChange(
  item: FamilyPlanDate,
  change: { date: string; time?: string; sourceLine?: string },
  byUid: string,
  nowIso: string,
  reaskNote: string,
): FamilyPlanDate {
  if (!isDay(change.date)) throw new Error("invalid_date");
  if (change.time && !isTime(change.time)) throw new Error("invalid_time");
  const prior: FamilyPlanVersion = {
    version: item.version,
    date: item.date,
    ...(item.time ? { time: item.time } : {}),
    ...(item.sourceLine ? { sourceLine: item.sourceLine } : {}),
    replacedAt: nowIso,
  };
  const version = item.version + 1;
  const lines: FamilyPlanHistory[] = [
    { at: nowIso, kind: "changed", by: byUid, version, date: item.date, ...(item.time ? { time: item.time } : {}) },
    { at: nowIso, kind: "reminder_stopped", version: item.version, date: item.date, ...(item.time ? { time: item.time } : {}) },
  ];
  // Who to ask again: the adult who had it (unless that is the one applying
  // the change), else the adult with an open request.
  const holder = item.holder ?? null;
  const asked = item.request && (item.request.status === "asked" || item.request.status === "accepted") ? item.request : null;
  const reaskTo: FamilyPlanAdult | null =
    holder && holder.uid !== byUid ? holder : asked && asked.toUid !== byUid ? { uid: asked.toUid, role: "co_parent", email: asked.toEmail ?? null, ...(asked.grantId ? { grantId: asked.grantId } : {}) } : null;
  if (item.request && item.request.status === "asked") lines.push({ at: nowIso, kind: "request_closed", version: item.version, who: item.request.toUid });
  const sourceLine = clean(change.sourceLine, SOURCE_LINE_MAX);
  let next: FamilyPlanDate = {
    ...item,
    date: change.date,
    time: change.time || undefined,
    ...(sourceLine ? { sourceLine } : {}),
    version,
    previous: [...(item.previous ?? []), prior].slice(-10),
    pendingChange: null,
    // The applier keeps it when it was theirs; anyone else is asked again.
    holder: holder && holder.uid === byUid ? holder : null,
    request: item.request ? { ...item.request, status: "closed", answeredAt: item.request.answeredAt ?? nowIso } : null,
    history: [...item.history, ...lines].slice(-HISTORY_MAX),
    updatedAt: nowIso,
  };
  if (next.time === undefined) delete next.time;
  if (reaskTo) next = askAdult(next, byUid, reaskTo, reaskNote, nowIso);
  return next;
}

/** Hold a change read from a newer message until the parent decides (nothing else moves). */
export function holdChange(item: FamilyPlanDate, change: { date: string; time?: string; sourceLine?: string }, nowIso: string): FamilyPlanDate {
  if (!isDay(change.date)) throw new Error("invalid_date");
  if (change.time && !isTime(change.time)) throw new Error("invalid_time");
  const sourceLine = clean(change.sourceLine, SOURCE_LINE_MAX);
  return { ...item, pendingChange: { date: change.date, ...(change.time ? { time: change.time } : {}), ...(sourceLine ? { sourceLine } : {}), receivedAt: nowIso }, updatedAt: nowIso };
}

/** The parent keeps the date as it is: the held change is let go. */
export function dropPendingChange(item: FamilyPlanDate, nowIso: string): FamilyPlanDate {
  return { ...item, pendingChange: null, updatedAt: nowIso };
}

export function addPrep(item: FamilyPlanDate, text: string, id: string, byUid: string, nowIso: string): FamilyPlanDate {
  const t = clean(text, TITLE_MAX);
  if (!t || (item.prep ?? []).length >= PREP_MAX) return item;
  return withHistory(item, { at: nowIso, kind: "prep_added", by: byUid, version: item.version }, { prep: [...(item.prep ?? []), { id, text: t, done: false }] });
}

/** Ticking prep is not a history event: it is the adult's own checklist. */
export function togglePrep(item: FamilyPlanDate, prepId: string, nowIso: string): FamilyPlanDate {
  return { ...item, prep: (item.prep ?? []).map((p) => (p.id === prepId ? { ...p, done: !p.done } : p)), updatedAt: nowIso };
}

export function markDone(item: FamilyPlanDate, byUid: string, nowIso: string): FamilyPlanDate {
  if (item.status === "done") return item;
  return withHistory(item, { at: nowIso, kind: "done", by: byUid, version: item.version }, { status: "done", doneAt: nowIso });
}

export function cancelDate(item: FamilyPlanDate, byUid: string, nowIso: string): FamilyPlanDate {
  if (item.status === "cancelled") return item;
  const request = item.request && item.request.status === "asked" ? { ...item.request, status: "closed" as const, answeredAt: nowIso } : item.request ?? null;
  return withHistory(item, { at: nowIso, kind: "cancelled", by: byUid, version: item.version }, { status: "cancelled", request });
}

/** Edit the name, kind, day or time by hand. A day/time edit is a change: it bumps the version like applyChange. */
export function editDate(
  item: FamilyPlanDate,
  patch: { title?: string; kind?: FamilyPlanKind; date?: string; time?: string },
  byUid: string,
  nowIso: string,
  reaskNote: string,
): FamilyPlanDate {
  const title = patch.title !== undefined ? clean(patch.title, TITLE_MAX) : item.title;
  if (!title) throw new Error("invalid_title");
  const kind = patch.kind && isKind(patch.kind) ? patch.kind : item.kind;
  const moved = (patch.date !== undefined && patch.date !== item.date) || (patch.time !== undefined && (patch.time || undefined) !== item.time);
  let next = item;
  if (moved) next = applyChange(item, { date: patch.date ?? item.date, time: patch.time !== undefined ? patch.time : item.time }, byUid, nowIso, reaskNote);
  if (title !== item.title || kind !== item.kind) {
    next = withHistory(next, { at: nowIso, kind: "edited", by: byUid, version: next.version }, { title, kind });
  }
  return next;
}
