/* tomorrowReason — TJB-28. Close the day with a reason to come back.
 *
 * THE DEFECT: Arbor ends a parent's day with nothing. There is no return hook
 * at all, and the one mechanism that could carry one (a notification) does not
 * exist — lib/push is inert without a VAPID key, and a bedtime alert is the
 * wrong instrument for a family product anyway (see lib/pushPriming).
 *
 * THE FIX, entirely in-app: when the parent is in the app at the close of a
 * day, Arbor writes down ONE concrete thing that is waiting for them, chosen
 * from what is genuinely true right now. The next time they open the app on a
 * LATER DAY, that one thing is the first thing they see, with the button that
 * goes straight to it. Nothing is sent anywhere; nothing fires while the phone
 * is face-down.
 *
 * ONE reason, never a list: a list is a backlog, and a backlog is a debt. The
 * hook works because it is small enough to actually do.
 *
 * CLINICAL FIREWALL: every reason is about the PARENT's next move — a ritual,
 * a book on the shelf, the thing they themselves chose to watch for, one
 * moment to write down. None of them reports on the child, and none of them
 * counts what was missed.
 *
 * DEVICE-LOCAL: one small record with a kind and two date stamps. No child
 * name, no observation, nothing that leaves the device.
 */

import type { ActiveTab } from "./routes";

/** What is waiting. Ordered by how concrete the next move is. */
export type ReasonKind = "ritual" | "focus" | "story" | "moment";

export interface StoredReason {
  kind: ReasonKind;
  /** Local day stamp the reason was written on. */
  setOn: string;
  /** Local day stamp the parent last saw (or put away) this reason. */
  seenOn?: string;
}

/** True facts about right now, injected so the whole module stays pure. */
export interface DayCloseSignals {
  /** A family ritual's turn is up (lib/familyRitualsCadence). */
  ritualDue: boolean;
  /** The parent chose something to watch for and it is still open (GP-34). */
  watchFocus: boolean;
  /** The comic shelf still holds a book this child has never been the hero of. */
  unopenedStory: boolean;
  /** Moments captured today — 0 means the day went unwritten. */
  momentsToday: number;
}

/**
 * Child-scoped on the sweepable `arbor.<ns>.<childId>` convention, for TWO
 * reasons. A reason is derived from ONE child's signals (their watch focus,
 * their unopened book, their day's moments) — under a single global key a
 * parent who closed the day on one child would open on a sibling and be handed
 * the first child's reason. And a key that does not end in the child id is not
 * swept by lib/childLocalState when that child is deleted.
 */
const storeKey = (childId: string) => `arbor.tomorrowReason.${childId}`;

/** The hour a day is treated as closing. Local time, deliberately late. */
export const DAY_CLOSE_HOUR = 19;

/** Local calendar day as a sortable stamp. Local, so it turns over at midnight
 *  where the parent actually is, not at UTC midnight. */
export function dayStamp(nowMs: number): string {
  const d = new Date(nowMs);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function isDayClosing(nowMs: number): boolean {
  return new Date(nowMs).getHours() >= DAY_CLOSE_HOUR;
}

/* ── Storage (best-effort, never throws) ────────────────────────────────── */

export function readStoredReason(childId: string): StoredReason | null {
  try {
    if (!childId) return null;
    const raw = localStorage.getItem(storeKey(childId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const r = parsed as Partial<StoredReason>;
    if (typeof r.setOn !== "string") return null;
    if (r.kind !== "ritual" && r.kind !== "focus" && r.kind !== "story" && r.kind !== "moment") return null;
    return { kind: r.kind, setOn: r.setOn, ...(typeof r.seenOn === "string" ? { seenOn: r.seenOn } : {}) };
  } catch {
    return null;
  }
}

function write(childId: string, reason: StoredReason): StoredReason {
  try {
    if (!childId) return;
    localStorage.setItem(storeKey(childId), JSON.stringify(reason));
  } catch {
    /* private mode / quota — the hook simply does not persist */
  }
  return reason;
}

export function clearStoredReason(childId: string): void {
  try {
    if (!childId) return;
    localStorage.removeItem(storeKey(childId));
  } catch {
    /* nothing to do */
  }
}

/* ── The choice (pure) ──────────────────────────────────────────────────── */

/**
 * ONE reason, by how concrete the next move is: a ritual whose turn is up beats
 * the thing the parent chose to watch for, which beats an unopened book, and a
 * day with nothing written falls back to writing one moment down.
 */
export function chooseReason(signals: DayCloseSignals): ReasonKind | null {
  if (signals.ritualDue) return "ritual";
  if (signals.watchFocus) return "focus";
  if (signals.unopenedStory) return "story";
  // momentsToday was collected by both call sites and never read, so the
  // fallback told a parent "write down one thing you saw — that is the whole
  // ask" on an evening they had already written five. A day that WAS written
  // needs no reason to come back and write it.
  return signals.momentsToday > 0 ? null : "moment";
}

/**
 * Write the day's reason if the day is closing and one is not already written
 * for today. Returns what now stands for today, or null before the closing
 * hour. Idempotent within a day: re-opening the app at 21:00 does not rewrite
 * (and so cannot flip) a reason chosen at 19:30.
 */
export function closeDay(childId: string, nowMs: number, signals: DayCloseSignals): StoredReason | null {
  if (!childId || !isDayClosing(nowMs)) return null;
  const today = dayStamp(nowMs);
  const existing = readStoredReason(childId);
  if (existing && existing.setOn === today) return existing;
  const kind = chooseReason(signals);
  // No honest reason tonight is a real answer — better than inventing one.
  if (!kind) return null;
  return write(childId, { kind, setOn: today });
}

/**
 * The reason to show on THIS open, or null. It shows only on a LATER day than
 * the one it was written on (that is what makes it a return hook rather than a
 * nag), and only once — putting it away or acting on it stamps it seen.
 */
export function reasonForThisOpen(childId: string, nowMs: number): StoredReason | null {
  const stored = readStoredReason(childId);
  if (!stored) return null;
  const today = dayStamp(nowMs);
  if (stored.setOn >= today) return null;
  // Seen at all — not merely seen TODAY. Suppressing only same-day meant a
  // reason written Thursday and dismissed Friday came back Saturday, Sunday and
  // every day after, until the parent happened to be inside Growth or the shelf
  // after 19:00 to overwrite it. A return hook that cannot be put down is a nag.
  if (stored.seenOn) return null;
  return stored;
}

/** Stamp the current reason as seen, so it does not follow the parent around. */
export function markReasonSeen(childId: string, nowMs: number): void {
  const stored = readStoredReason(childId);
  if (!stored) return;
  write(childId, { ...stored, seenOn: dayStamp(nowMs) });
}

/* ── Copy + destination contract ────────────────────────────────────────── */


export interface ReasonPresentation {
  titleKey: string;
  bodyKey: string;
  ctaKey: string;
  /** Always a registered route id — a return hook that 404s is worse than none. */
  action: ActiveTab;
  glyph: string;
}

const PRESENTATION: Record<ReasonKind, ReasonPresentation> = {
  ritual: {
    titleKey: "elev.rh.tomorrow.ritual.title",
    bodyKey: "elev.rh.tomorrow.ritual.body",
    ctaKey: "elev.rh.tomorrow.ritual.cta",
    action: "family",
    glyph: "diversity_3",
  },
  focus: {
    titleKey: "elev.rh.tomorrow.focus.title",
    bodyKey: "elev.rh.tomorrow.focus.body",
    ctaKey: "elev.rh.tomorrow.focus.cta",
    action: "development",
    glyph: "visibility",
  },
  story: {
    titleKey: "elev.rh.tomorrow.story.title",
    bodyKey: "elev.rh.tomorrow.story.body",
    ctaKey: "elev.rh.tomorrow.story.cta",
    action: "comics",
    glyph: "auto_stories",
  },
  moment: {
    titleKey: "elev.rh.tomorrow.moment.title",
    bodyKey: "elev.rh.tomorrow.moment.body",
    ctaKey: "elev.rh.tomorrow.moment.cta",
    action: "overview",
    glyph: "edit_note",
  },
};

export function reasonPresentation(kind: ReasonKind): ReasonPresentation {
  return PRESENTATION[kind];
}
