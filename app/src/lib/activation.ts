/* ════════════════════════════════════════════════════════════════════════════
   activation — N1-03: the GTM plan's headline number, given a definition.

   THE DEFECT THIS CLOSES
   ──────────────────────
   "Activated families" is the 30/90/180-day headline in bd/ARBOR-GTM-PLAN.md
   §2.1 and nothing in the tree computed it. lib/attributionFunnel.ts stopped at
   install → first_plan → paid; `onboardingCompletedAt` was written at the end
   of setup and read by four lifecycle surfaces; `actionLoops` was a registered
   child sub-collection. Both halves of an activation definition existed and had
   never been joined, so the number could be asserted in a plan and argued with
   by nobody.

   THE DEFINITION — written here, and nowhere else
   ───────────────────────────────────────────────
   A family is ACTIVATED when `onboarding_completed` has fired AND at least one
   of ACTIVATION_LOOP_EVENTS has fired on a LATER LOCAL DAY than the onboarding
   day, within ACTIVATION_WINDOW_DAYS.

   "On a later local day" is load-bearing (critic C10). A parent who completes a
   loop inside the onboarding session has finished onboarding; they have not
   RETURNED. Counting that would roughly double the number and would measure
   onboarding twice — a definition that flatters is worse than no definition,
   because it survives scrutiny for exactly one quarter.

   The window is bounded at the other end too: a loop on day 30 is retention,
   which lib/retention.ts already answers. Activation is the first return.

   WHY THIS MODULE RENDERS NOTHING
   ───────────────────────────────
   Activation is a rate, and a rate rendered on a parent surface is a clinical
   firewall breach (critic C11). A parent who has not come back is not failing
   at anything, and Arbor must never tell them they are. This module is imported
   by ZERO files under components/ — asserted by its own guard — and its output
   is read by the founder's cohort report, never by the app.

   The day arithmetic is lib/retention.ts's `dayKeyOf` / `dayIndex`. There is
   exactly one day-key function in this codebase and this is not it.
   ════════════════════════════════════════════════════════════════════════════ */
import { dayIndex, dayKeyOf } from "./retention";
import { trackActivated } from "./kpiEvents";

/** The event that opens the question. Fired by OnboardingFlow (unchanged). */
export const ACTIVATION_START_EVENT = "onboarding_completed";

/**
 * The loops that count as a return. Each is a parent DOING something with the
 * record — saving a capture, accepting today's action, reporting how it went,
 * keeping a proposed line. Opening the app is not activation; `session_open`
 * is deliberately absent.
 */
export const ACTIVATION_LOOP_EVENTS = [
  "capture_saved",
  "today_action_accepted",
  "today_action_outcome",
  "keep_this",
] as const;
export type ActivationLoopEvent = (typeof ACTIVATION_LOOP_EVENTS)[number];

/** Days after onboarding within which the first return still counts. */
export const ACTIVATION_WINDOW_DAYS = 7;

/**
 * The definition as one printable line. `app/scripts/cohort-report.mjs` prints
 * THIS STRING, read from this file, beside the number — so the report and the
 * code cannot drift apart without the drift being visible in the report.
 */
export const ACTIVATION_DEFINITION =
  "A family is activated when onboarding_completed has fired and at least one of " +
  ACTIVATION_LOOP_EVENTS.join(", ") +
  " has fired on a later local day than the onboarding day, within " +
  ACTIVATION_WINDOW_DAYS +
  " days.";

/** One event doc, as the cohort reader and the client both hold it. */
export interface ActivationEvent {
  event: string;
  at: string | number | Date;
}

/** The answer, and the two props `activated` carries when it is yes. */
export interface ActivationVerdict {
  activated: boolean;
  /** Whole local days from the onboarding day. Null when not activated. */
  dayOffset: number | null;
  /** The qualifying event NAME. Null when not activated. */
  via: ActivationLoopEvent | null;
  /** True once onboarding has completed — the denominator's membership test. */
  eligible: boolean;
}

const NOT_ACTIVATED = (eligible: boolean): ActivationVerdict => ({
  activated: false,
  dayOffset: null,
  via: null,
  eligible,
});

const isLoopEvent = (name: string): name is ActivationLoopEvent =>
  (ACTIVATION_LOOP_EVENTS as readonly string[]).includes(name);

/**
 * Evaluate one family's event stream against the definition above.
 *
 * `tzOffsetMinutes` is the family's local offset: "later local day" means the
 * parent's day, not UTC's. Unparseable timestamps are dropped rather than
 * counted as day 0 — a bogus activation is worse than a missing one.
 */
export function evaluateActivation(
  events: readonly ActivationEvent[],
  tzOffsetMinutes = 0,
): ActivationVerdict {
  let onboardingDay: string | null = null;
  for (const e of events) {
    if (e.event !== ACTIVATION_START_EVENT) continue;
    const day = dayKeyOf(e.at, tzOffsetMinutes);
    if (!day) continue;
    // The EARLIEST completion is the anchor: a re-run of setup does not reset
    // the clock on a family that already had one.
    if (!onboardingDay || day < onboardingDay) onboardingDay = day;
  }
  if (!onboardingDay) return NOT_ACTIVATED(false);

  let best: { offset: number; via: ActivationLoopEvent } | null = null;
  for (const e of events) {
    if (!isLoopEvent(e.event)) continue;
    const day = dayKeyOf(e.at, tzOffsetMinutes);
    if (!day) continue;
    const offset = dayIndex(onboardingDay, day);
    if (offset === null) continue;
    // The two boundaries the definition stands on: same-day loops are
    // onboarding (offset 0 fails), and the window closes after day 7.
    if (offset < 1 || offset > ACTIVATION_WINDOW_DAYS) continue;
    if (!best || offset < best.offset) best = { offset, via: e.event };
  }
  if (!best) return NOT_ACTIVATED(true);
  return { activated: true, dayOffset: best.offset, via: best.via, eligible: true };
}

/* ── Emitting it once per family ───────────────────────────────────────────
 * The stamp is a `{accountId: true}` map under one key — the shape
 * components/weekly/recapEmail.ts already uses for its opt-in map, so there is
 * one convention for "this account has already done this", not two. Keyed on
 * the account so a second child, a re-install of the same account, or a repeat
 * qualifying event cannot emit a second `activated`. */

export const ACTIVATION_STAMP_KEY = "arbor.activation.reported";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const defaultStorage = (): StorageLike | null => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

function readStamps(storage: StorageLike): Record<string, boolean> {
  try {
    const raw = storage.getItem(ACTIVATION_STAMP_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

/** Whether this account has already been counted as activated on this device. */
export function hasReportedActivation(
  accountId: string,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!accountId || !storage) return false;
  return readStamps(storage)[accountId] === true;
}

/**
 * Emit `activated` for this family, at most once. Returns whether it emitted,
 * so a caller can be pinned on the result rather than on a side effect.
 *
 * Storage being unavailable does NOT suppress the event — a blocked
 * localStorage would otherwise make a whole browser class invisible in the
 * headline number — but it also cannot dedup, which is the honest trade and is
 * asserted in the guard.
 */
export function reportActivation(
  accountId: string,
  verdict: ActivationVerdict,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!verdict.activated || verdict.dayOffset === null || verdict.via === null) return false;
  if (accountId && storage) {
    const stamps = readStamps(storage);
    if (stamps[accountId] === true) return false;
    try {
      storage.setItem(ACTIVATION_STAMP_KEY, JSON.stringify({ ...stamps, [accountId]: true }));
    } catch {
      /* storage blocked → emit anyway; an unmeasured family is the worse loss */
    }
  }
  trackActivated({ dayOffset: verdict.dayOffset, via: verdict.via });
  return true;
}

/** Evaluate and report in one call — the shape a call site wants. */
export function maybeReportActivation(
  accountId: string,
  events: readonly ActivationEvent[],
  opts: { tzOffsetMinutes?: number; storage?: StorageLike | null } = {},
): ActivationVerdict {
  const verdict = evaluateActivation(events, opts.tzOffsetMinutes ?? 0);
  reportActivation(accountId, verdict, opts.storage === undefined ? defaultStorage() : opts.storage);
  return verdict;
}

/**
 * The cohort count and its DENOMINATOR. A count without a denominator is a
 * number nobody can act on: 40 activated families is a triumph or a disaster
 * depending on whether 60 or 6,000 finished onboarding. Both are returned, and
 * the report prints both or neither.
 */
export function activationCohort(
  families: readonly { events: readonly ActivationEvent[]; tzOffsetMinutes?: number }[],
): { activated: number; eligible: number; definition: string } {
  let activated = 0;
  let eligible = 0;
  for (const family of families) {
    const verdict = evaluateActivation(family.events, family.tzOffsetMinutes ?? 0);
    if (verdict.eligible) eligible += 1;
    if (verdict.activated) activated += 1;
  }
  return { activated, eligible, definition: ACTIVATION_DEFINITION };
}
