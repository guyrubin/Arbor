/**
 * B-PLAY-04 — ONE practice count for the parent chrome: the kid-play rounds of
 * the last 7 days.
 *
 * A "round" is one practiceEvents row (a game the child finished in Kid Mode).
 * A Mood Mountain `mood-checkin` is the child saying how THEY feel (B-KID-02) —
 * not a round played — so it is not counted. A COUNT only: no accuracy, no
 * stars, no streak, nothing per domain (law 1 / law 3).
 *
 * Shared with lane-X B-KID-07 (Today's practice nudge counts kid play): the
 * nudge input should read this same number.
 */
import { useMemo } from "react";
import { useChildCollection } from "../hooks/useChildCollection";
import type { PracticeEvent } from "../types";

export const PRACTICE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Pure: rounds played in the window ending at `nowMs`. */
export function practiceRoundsSince(
  events: ReadonlyArray<{ timestamp?: string; kind?: string }>,
  nowMs: number,
  windowMs: number = PRACTICE_WEEK_MS,
): number {
  const from = nowMs - windowMs;
  let n = 0;
  for (const e of events) {
    if (e.kind === "mood-checkin") continue;
    const at = e.timestamp ? Date.parse(e.timestamp) : Number.NaN;
    if (Number.isFinite(at) && at >= from && at <= nowMs) n += 1;
  }
  return n;
}

/** Lightweight per-child hook: one subscription (the same collection and order
 *  usePracticeData reads), one integer. */
export function usePractice7d(childId: string): number {
  const events = useChildCollection<PracticeEvent>(childId, "practiceEvents", {
    orderByField: "timestamp",
    orderDir: "desc",
    max: 800,
  });
  return useMemo(() => practiceRoundsSince(events.items, Date.now()), [events.items]);
}
