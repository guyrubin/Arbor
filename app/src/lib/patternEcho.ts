/* ════════════════════════════════════════════════════════════════════════════
   patternEcho — TJB-06: the echo a save owes the parent.

   The plan's promise for Behaviors is "log what happened; see the pattern
   form" — after ~3 similar logs, ONE contextual line that names the count and
   routes into Plans (surfaceContract already declares `plans` as the
   demotionTarget for exactly this). `lib/plans.suggestedChallenges` computes
   the recurrence, but only PlansTab ever calls it: saving a third meltdown in
   the Behaviors form echoed nothing at all, so the pattern only "formed" for a
   parent who happened to open another tab.

   This module is the save-time selector, built ON TOP of suggestedChallenges
   so there is ONE recurrence rule in the app (same trailing window, same
   "plain Moment rows never accumulate" carve-out, same resolved-log skip).
   It adds only what the echo needs: it looks at the type the parent JUST
   saved, and it needs a real repetition — the plan says 3, not the 2 that is
   enough to seed the Plans list.

   CLINICAL FIREWALL: the result is a COUNT of the parent's own notes over a
   named window. No score, no severity read, no trend, no "worse/better", and
   nothing about the child — "you have written this down three times" is an
   observation about the log, which is what makes it safe to say.

   Pure (callers pass `today`) — unit-testable.
   ════════════════════════════════════════════════════════════════════════════ */

import type { BehaviorLog } from "../types";
import { suggestedChallenges } from "./plans";

/** Repetitions before the echo speaks. Below this it is a coincidence, not a pattern. */
export const ECHO_MIN_COUNT = 3;

/** The trailing window suggestedChallenges uses — surfaced so the copy can name it. */
export const ECHO_WINDOW_DAYS = 21;

export type PatternEcho = {
  /** The behaviorType as the parent's own logs spell it (raw record content). */
  type: string;
  /** How many times it appears in the window. A flat count, never a rate. */
  count: number;
  /** Window length, so the line can say "in the last N days" honestly. */
  windowDays: number;
};

/**
 * The echo for a just-saved behavior type, or null.
 *
 * `savedType` is matched case-insensitively against the recurrence table
 * because the taxonomy select and older free-typed logs disagree on casing.
 * `max` is deliberately generous: suggestedChallenges caps its OWN list at the
 * top 2 for the Plans surface, but the echo must be able to speak about the
 * type in the parent's hand even when two other types are more frequent.
 */
export function patternEchoFor(
  logs: BehaviorLog[],
  savedType: string | null | undefined,
  today: string,
  minCount: number = ECHO_MIN_COUNT,
): PatternEcho | null {
  const needle = (savedType || "").trim().toLowerCase();
  if (!needle) return null;

  // suggestedChallenges returns `${Cap(type)} — a recurring pattern…` topics
  // and a "Logged {n}× in the last {d} days" reason; re-deriving the count
  // from its prose would be brittle, so recount here under the SAME filter
  // the module documents, and use suggestedChallenges as the gate that the
  // type is a recurrence at all (one recurrence rule, one carve-out list).
  const recurring = suggestedChallenges(logs, today, Number.MAX_SAFE_INTEGER, ECHO_WINDOW_DAYS);
  const isRecurring = recurring.some((s) => s.topic.trim().toLowerCase().startsWith(needle));
  if (!isRecurring) return null;

  const cutoff = new Date(`${today}T23:59:59`).getTime() - ECHO_WINDOW_DAYS * 86400000;
  let count = 0;
  let label = "";
  for (const log of logs) {
    if (log.resolved) continue;
    const type = (log.behaviorType || "").trim();
    if (type.toLowerCase() !== needle) continue;
    const t = new Date(log.timestamp).getTime();
    if (Number.isNaN(t) || t < cutoff) continue;
    count += 1;
    if (!label) label = type;
  }

  if (count < minCount) return null;
  return { type: label || (savedType || "").trim(), count, windowDays: ECHO_WINDOW_DAYS };
}
