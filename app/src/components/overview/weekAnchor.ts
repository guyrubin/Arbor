/* ════════════════════════════════════════════════════════════════════════════
   weekAnchor — ENG-24: "the week has turned and last week is waiting".

   The weekly recap already exists, is already generated on app open, and is
   already firewall-clean — but it only ever surfaced as ONE LINE inside the
   Since-last-visit strip, and only for RETURNING parents with since-visit rows
   (SinceLastVisit's own "known v1 limitation"). A week-boundary ritual is the
   cheapest habit anchor there is, and this one was buried in a sub-line of a
   card that half the audience never sees.

   This module owns the "is it time?" decision so chooseTodayAction stays a
   pure ranking function and the whole rule is unit-testable:

     · the recap for the CURRENT week exists (it is generated on open), and
     · the parent has not opened it yet (the recap's own opened-week marker),
       and
     · this device has not already been offered the anchor for this week
       (dismissing it must not re-offer it on the next open of the same day).

   Nothing here reads or derives anything about the child.
   ════════════════════════════════════════════════════════════════════════════ */

/** localStorage marker: the last weekId whose ANCHOR this child's parent was
 *  offered and dismissed. Distinct from the recap's own "opened" marker — a
 *  parent may dismiss the anchor without opening the recap. */
export function weekAnchorSeenKey(childId: string): string {
  return `arbor.week.anchor.seen.${childId}`;
}

export function readWeekAnchorSeen(childId: string, explicit?: Storage | null): string | null {
  try {
    const store = explicit ?? (typeof window !== "undefined" ? window.localStorage : null);
    return store?.getItem(weekAnchorSeenKey(childId)) ?? null;
  } catch {
    return null;
  }
}

export function markWeekAnchorSeen(childId: string, weekId: string, explicit?: Storage | null): void {
  try {
    const store = explicit ?? (typeof window !== "undefined" ? window.localStorage : null);
    store?.setItem(weekAnchorSeenKey(childId), weekId);
  } catch {
    /* storage blocked — the anchor simply offers again next open */
  }
}

/**
 * Pure decision: should Today lead with the week's recap?
 *
 * `recapUnopened` is the existing isRecapUnopened(...) result from
 * hooks/useWeeklyRecap — this module deliberately does not re-derive it, so
 * there is exactly one definition of "a new recap is waiting".
 */
export function weekAnchorRecapDue(input: {
  /** The current recapWeekId. */
  weekId: string;
  /** A report for that week exists and the parent has not opened it. */
  recapUnopened: boolean;
  /** The weekId whose anchor was already offered and dismissed on this device. */
  anchorSeenWeekId: string | null;
}): boolean {
  if (!input.weekId) return false;
  if (!input.recapUnopened) return false;
  return input.anchorSeenWeekId !== input.weekId;
}

/* ════════════════════════════════════════════════════════════════════════════
   THE SHIPPED VARIANT — the week-OPEN anchor (ENG-24, 2026-09-04).

   The decision above needs a fact Today cannot check. `weekAnchorRecapDue`
   gates on a written report EXISTING, and existence is exactly what a signed-in
   device has no local copy of: a report is only generated when the trailing
   week carried at least one logged moment, and the collection mirror to
   localStorage runs in sandbox mode only. Asking Today for that fact means a
   Firestore subscription on the app's most-loaded surface, which was refused.

   So the ritual ships on the half of the item that needs no unverifiable fact.
   A week boundary is a CALENDAR event, not a content event: it is true on every
   device, for every parent, whether they logged thirty moments last week or
   none. The anchor therefore says only what the calendar says and offers the
   move the parent can always make — note one thing from today. It looks
   FORWARD, so it makes no claim about last week at all, and a parent who logged
   nothing reads a fresh start rather than a report that is not there or a
   scolding for the gap.

   Both decisions share ONE marker (`weekAnchorSeenKey` above): whichever
   variant is offered spends the week's single appearance, so the two can never
   stack, and no second `arbor.` key template enters the tree.
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * The days on which "a new week begins" is still literally true.
 *
 * `recapWeekId` (hooks/useWeeklyRecap) increments its week number on a SUNDAY
 * in every year — the Jan-1 anchor cancels out of its arithmetic, which
 * weekOpenAnchor.test.ts proves rather than assumes. So these are days 1-3 of
 * that week id: Sunday (Israeli week start), Monday (the item's "Monday
 * anchor") and Tuesday, which catches a parent whose first open of the week is
 * a day late. A parent whose first open falls later simply gets no anchor that
 * week — silence is the honest option, because by Thursday "a new week begins"
 * is no longer true.
 */
export const WEEK_OPEN_ANCHOR_DAYS: readonly number[] = [0, 1, 2];

/**
 * Pure decision: is this open the top of a new week for this device?
 *
 * Every input is free — a date and one localStorage read. Nothing here is
 * derived from the child, from the log, or from anything the network owns, so
 * mounting this costs Today no subscription and can state nothing it cannot
 * verify.
 */
export function weekOpenAnchorDue(input: {
  /** The current recapWeekId — the same week identity the recap variant uses. */
  weekId: string;
  /** `Date.getDay()` for this open: 0 = Sunday. */
  dayOfWeek: number;
  /** The weekId whose anchor was already offered on this device. */
  anchorSeenWeekId: string | null;
}): boolean {
  if (!input.weekId) return false;
  if (!WEEK_OPEN_ANCHOR_DAYS.includes(input.dayOfWeek)) return false;
  return input.anchorSeenWeekId !== input.weekId;
}
