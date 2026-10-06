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
