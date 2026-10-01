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

/** B-ASKJB-10: the fast-start chip built from the child's own recurring moment. */
export type RecurringScenario = {
  /** The behaviorType as the parent's logs spell it. */
  type: string;
  /** The keyed chip label ("{type} again — what now?"), the type localized. */
  label: string;
  /** The AI-input prompt (English map entry, or the generic prompt). */
  prompt: string;
};

/**
 * B-ASKJB-10 — Ask's fast-start leads with what THIS child keeps doing.
 *
 * Deterministic, zero model calls. Reuses `patternEchoFor` — the SAME
 * recurrence rule and the SAME threshold (ECHO_MIN_COUNT logs inside
 * ECHO_WINDOW_DAYS), never a second one. When several types recur, the most
 * frequent leads (ties: the first logged). The label carries the localized type
 * only — no count, no intensity, nothing about the child beyond the parent's
 * own log. Plain Moments never recur here (suggestedChallenges' carve-out).
 */
export function recurringScenario(
  logs: BehaviorLog[],
  today: string,
  opts: {
    /** canonical type → English model prompt (CoachTab's map beside SCENARIOS). */
    prompts: Readonly<Record<string, string>>;
    /** Localized type label (behaviorTypeLabel). */
    typeLabel: (type: string) => string;
    t: (key: string, vars?: Record<string, string | number>) => string;
    /** Generic prompt for a type the map does not know; `{type}` = the localized label. */
    fallbackPrompt: string;
  },
): RecurringScenario | null {
  const seen: string[] = [];
  for (const log of logs) {
    const type = (log.behaviorType || "").trim();
    if (type && !seen.some((s) => s.toLowerCase() === type.toLowerCase())) seen.push(type);
  }
  let best: PatternEcho | null = null;
  for (const type of seen) {
    const echo = patternEchoFor(logs, type, today);
    if (echo && (!best || echo.count > best.count)) best = echo;
  }
  if (!best) return null;
  const typeLabel = opts.typeLabel(best.type);
  const known = Object.keys(opts.prompts).find((k) => k.toLowerCase() === best!.type.toLowerCase());
  return {
    type: best.type,
    label: opts.t("elev.coach.echo.chip", { type: typeLabel }),
    prompt: known ? opts.prompts[known] : opts.fallbackPrompt.replace("{type}", typeLabel),
  };
}
