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
