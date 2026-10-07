/**
 * B-LOOP-11 — "Try it today" on a shelf page: the parent makes a shelf's
 * practice TODAY's practice. The chooser already honours an override
 * (`choosePractice` `todayPracticeId`, B-LOOP-09); until a dose row exists
 * the override comes from this pin — one device-local key per child per
 * local day, so it expires with the day and never becomes a streak or a plan.
 * A dose row ("Did it" / "Not today") always wins over the pin.
 */
import { dayKey } from "../../practice/signals";

export const todayPinKey = (childId: string, at: Date = new Date()): string => `arbor.practicePin.${childId}.${dayKey(at)}`;

/** The practice id the parent pinned for today, if any. */
export function readTodayPin(childId: string, at: Date = new Date()): string | undefined {
  try {
    return localStorage.getItem(todayPinKey(childId, at)) || undefined;
  } catch {
    return undefined;
  }
}

/** Pin a practice as today's. Returns false when storage is unavailable. */
export function writeTodayPin(childId: string, practiceId: string, at: Date = new Date()): boolean {
  try {
    localStorage.setItem(todayPinKey(childId, at), practiceId);
    return true;
  } catch {
    return false;
  }
}

/**
 * P5-LOOP critic c2 r2 (overview product P1-2, B-LOOP-NEW-2a) — the practice
 * card's day impression: Tonight asks "Did you try it today?" only about a
 * practice the parent was SHOWN today (a dose row, the day pin, or this
 * impression, written when the card renders in its day mode). One
 * device-local key per child per local day; it expires with the day and is
 * never a count, a streak or a plan.
 */
export const practiceShownKey = (childId: string, at: Date = new Date()): string => `arbor.practiceShown.${childId}.${dayKey(at)}`;

/** The practice id whose card the parent saw today (day mode), if any. */
export function readPracticeShown(childId: string, at: Date = new Date()): string | undefined {
  try {
    return localStorage.getItem(practiceShownKey(childId, at)) || undefined;
  } catch {
    return undefined;
  }
}

/** Record that today's practice card was shown. Returns false when storage is unavailable. */
export function markPracticeShown(childId: string, practiceId: string, at: Date = new Date()): boolean {
  try {
    localStorage.setItem(practiceShownKey(childId, at), practiceId);
    return true;
  } catch {
    return false;
  }
}
