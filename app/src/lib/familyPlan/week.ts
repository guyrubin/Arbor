/**
 * Family plan v1: this week's plan, derived from the stored dates.
 *
 * The week the screen draws is seven days, two before today and four after
 * (the ribbon), plus the dates later in the plan window (14 days ahead) in one
 * "later" column. The counts are counts of dates (with units in words on the
 * screen): how many, how many have an adult, how many nobody has yet. An asked
 * date with no answer counts as nobody yet: "No answer is not covered".
 *
 * Reminders are in the app only (v1 sends no phone alert): one per open date,
 * the evening before at 19:00, for the adult who has it (or for the family
 * when nobody does). They are derived from the date as it stands, so applying
 * a change re-derives the reminder for the new time and the old one stops
 * (the change also writes a "reminder stopped" history line).
 */
import { addDays, bySoonest, dayKey, parseDay, startMs, stateOf, type FamilyPlanAdult, type FamilyPlanDate, type FamilyPlanState } from "./model";

export const RIBBON_BEFORE = 2;
export const RIBBON_AFTER = 4;
export const PLAN_AHEAD_DAYS = 14;
export const REMINDER_HOUR = 19;

export interface PlanWindow {
  today: string;
  /** The seven ribbon days, oldest first. */
  days: string[];
  /** Last day in the plan window (inclusive). */
  until: string;
}

export function planWindow(now: Date): PlanWindow {
  const today = dayKey(now);
  const days = Array.from({ length: RIBBON_BEFORE + RIBBON_AFTER + 1 }, (_, i) => addDays(today, i - RIBBON_BEFORE));
  return { today, days, until: addDays(today, PLAN_AHEAD_DAYS - 1) };
}

/** The open (not cancelled) dates inside the plan window, soonest first. Done dates stay: they happened this week. */
export function datesInWindow(items: readonly FamilyPlanDate[], w: PlanWindow): FamilyPlanDate[] {
  return items.filter((d) => d.status !== "cancelled" && d.date >= w.days[0] && d.date <= w.until).sort(bySoonest);
}

export interface PlanCounts {
  dates: number;
  withAdult: number;
  nobodyYet: number;
}

export function planCounts(items: readonly FamilyPlanDate[]): PlanCounts {
  const withAdult = items.filter((d) => stateOf(d) === "has").length;
  return { dates: items.length, withAdult, nobodyYet: items.length - withAdult };
}

export interface Lane {
  /** The adult's uid, or "nobody" for the nobody-yet lane. */
  key: string;
  adult: FamilyPlanAdult | null;
  /** Dates in this lane with their state in THIS lane (an asked date is open in the asked adult's lane). */
  dates: { item: FamilyPlanDate; state: FamilyPlanState }[];
}

/**
 * One lane per adult in the family (the owner first, then co-parents who
 * joined), then the nobody-yet lane. A date an adult has sits in their lane;
 * an asked date sits open in the asked adult's lane AND in nobody yet, because
 * an unanswered request is not cover. An adult who left the family keeps
 * their dates visible in their own lane.
 */
export function lanes(items: readonly FamilyPlanDate[], adults: readonly FamilyPlanAdult[]): Lane[] {
  const out = new Map<string, Lane>();
  for (const a of adults) out.set(a.uid, { key: a.uid, adult: a, dates: [] });
  const laneFor = (adult: FamilyPlanAdult): Lane => {
    const existing = out.get(adult.uid);
    if (existing) return existing;
    const lane: Lane = { key: adult.uid, adult, dates: [] };
    out.set(adult.uid, lane);
    return lane;
  };
  const nobody: Lane = { key: "nobody", adult: null, dates: [] };
  for (const item of [...items].sort(bySoonest)) {
    const state = stateOf(item);
    if (state === "has" && item.holder) laneFor(item.holder).dates.push({ item, state });
    else {
      if (state === "asked" && item.request) {
        laneFor({ uid: item.request.toUid, role: "co_parent", email: item.request.toEmail ?? null, ...(item.request.grantId ? { grantId: item.request.grantId } : {}) }).dates.push({ item, state });
      }
      nobody.dates.push({ item, state: "none" });
    }
  }
  return [...out.values(), nobody];
}

export interface PlanReminder {
  id: string;
  dateId: string;
  /** When the reminder shows in the app (local ms). */
  atMs: number;
  /** queued = still ahead · due = its time has come and the date has not passed. */
  status: "queued" | "due";
  /** Whom it is for: the adult who has the date, or null for the family. */
  forUid: string | null;
  item: FamilyPlanDate;
}

/** The evening-before reminder for one open date (19:00 the day before; for a date today, today at 07:00). */
export function reminderAt(item: Pick<FamilyPlanDate, "date" | "time">, now: Date): number {
  const eve = parseDay(addDays(item.date, -1));
  eve.setHours(REMINDER_HOUR, 0, 0, 0);
  if (eve.getTime() > now.getTime() || item.date !== dayKey(now)) return eve.getTime();
  const morning = parseDay(item.date);
  morning.setHours(7, 0, 0, 0);
  return morning.getTime();
}

/** In-app reminders for the open dates that have not happened yet, soonest first. */
export function reminders(items: readonly FamilyPlanDate[], now: Date): PlanReminder[] {
  const nowMs = now.getTime();
  const today = dayKey(now);
  return items
    .filter((d) => d.status === "open" && d.date >= today && (d.date > today || !d.time || startMs(d) > nowMs))
    .map((item) => {
      const atMs = reminderAt(item, now);
      return { id: `${item.id}@v${item.version}`, dateId: item.id, atMs, status: atMs > nowMs ? ("queued" as const) : ("due" as const), forUid: item.holder?.uid ?? null, item };
    })
    .sort((a, b) => a.atMs - b.atMs);
}

/** Open requests (sent, no answer yet), oldest first. */
export function openRequests(items: readonly FamilyPlanDate[]): FamilyPlanDate[] {
  return items.filter((d) => d.status === "open" && d.request?.status === "asked").sort((a, b) => (a.request!.askedAt).localeCompare(b.request!.askedAt));
}

/** Where each thing stands: asked (no answer), accepted (an adult has it, not done), done. */
export function standing(items: readonly FamilyPlanDate[]): { asked: FamilyPlanDate[]; accepted: FamilyPlanDate[]; done: FamilyPlanDate[] } {
  return {
    asked: items.filter((d) => d.status === "open" && stateOf(d) === "asked"),
    accepted: items.filter((d) => d.status === "open" && stateOf(d) === "has"),
    done: items.filter((d) => d.status === "done"),
  };
}
