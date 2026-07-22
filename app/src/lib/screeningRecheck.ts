/**
 * UND-2 — real "remind me to re-check" state for the Development Check.
 *
 * The result screen's reminder button previously fired a success toast and
 * persisted NOTHING (a fake done-state). Now it writes `recheckDueAt`
 * (answeredAt + ~3 weeks) onto the already-saved screening record in the
 * existing `screenings` child collection (in CHILD_SUBCOLLECTIONS — no new
 * capture path), and the due state is surfaced on re-entry in both the
 * Development hub pointer row and the ScreeningFlow intro's last-check card.
 *
 * HONESTY CONTRACT: no push/email channel is registered here, so all copy
 * tied to this seam may only claim in-app flagging ("we'll flag it here").
 */

export const RECHECK_WEEKS = 3;
export const RECHECK_MS = RECHECK_WEEKS * 7 * 24 * 60 * 60 * 1000;

export interface RecheckRecord {
  answeredAt: string;
  /** ISO timestamp when a parent-requested re-check becomes due. */
  recheckDueAt?: string;
}

/** Due date for a re-check: answeredAt + RECHECK_WEEKS (falls back to now + RECHECK_WEEKS on a bad date). */
export function computeRecheckDueAt(answeredAt: string, now: number = Date.now()): string {
  const base = new Date(answeredAt).getTime();
  const from = Number.isFinite(base) ? base : now;
  return new Date(from + RECHECK_MS).toISOString();
}

/** True once a stored due date has arrived. Absent/invalid due dates are never "due". */
export function isRecheckDue(recheckDueAt: string | undefined | null, now: number = Date.now()): boolean {
  if (!recheckDueAt) return false;
  const due = new Date(recheckDueAt).getTime();
  return Number.isFinite(due) && now >= due;
}

/** The due date (if any) carried by the MOST RECENT screening record. */
export function latestRecheckDueAt<T extends RecheckRecord>(items: readonly T[]): string | undefined {
  const latest = [...items].sort((a, b) => (a.answeredAt < b.answeredAt ? 1 : -1))[0];
  return latest?.recheckDueAt;
}
