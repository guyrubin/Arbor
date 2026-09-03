import type { BehaviorLog } from "../../types";
import { isIncidentType } from "../../content/behaviorTaxonomy";
import { suggestedChallenges, type PlanSuggestion } from "../../lib/plans";

/**
 * patternEcho — TJB-06: the felt response after a Behaviors save.
 *
 * "That's the 3rd bedtime moment this week" — a COUNT of same-type incident
 * logs in the trailing 7 days (the same window the Journal's weekWindow and
 * Today's "this week" use), never an adjective. After ≥ 3 similar logs ONE
 * contextual CTA appears — "Turn this into a plan" — and only when
 * lib/plans suggestedChallenges already computes a suggestion for that type
 * (the Plans hub earns its traffic from the data that justifies it).
 *
 * Wave S+L residue (c): plain "Moment" rows (and any non-incident type) never
 * echo — `isIncidentType` is the ONE membership test, mirroring the Moment
 * filter already inside suggestedChallenges.
 *
 * Pure — no Date.now() inside (callers pass `nowMs`).
 */

export const PATTERN_ECHO_CTA_MIN = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface PatternEcho {
  /** The saved log's behaviorType (schema vocabulary — label at render). */
  type: string;
  /** Same-type incident logs in the trailing week, INCLUDING the saved one. */
  count: number;
  /** Present only at ≥ PATTERN_ECHO_CTA_MIN with a matching plan suggestion. */
  suggestion?: PlanSuggestion;
}

export function patternEchoFor(input: {
  /** All logs for the child AFTER the save (the saved row included, or not — see `saved`). */
  logs: ReadonlyArray<BehaviorLog>;
  /** The row that was just saved. Counted once even if `logs` already holds it. */
  saved: Pick<BehaviorLog, "id" | "behaviorType" | "timestamp">;
  nowMs: number;
}): PatternEcho | null {
  const type = (input.saved.behaviorType || "").trim();
  if (!type || !isIncidentType(type)) return null;
  const cutoff = input.nowMs - WEEK_MS;
  const key = type.toLowerCase();
  const others = input.logs.filter((l) => {
    if (l.id === input.saved.id) return false;
    if (!isIncidentType(l.behaviorType) || (l.behaviorType || "").trim().toLowerCase() !== key) return false;
    const ts = Date.parse(l.timestamp);
    return Number.isFinite(ts) && ts >= cutoff && ts <= input.nowMs;
  });
  const count = others.length + 1;
  if (count < PATTERN_ECHO_CTA_MIN) return { type, count };

  const all = input.logs.some((l) => l.id === input.saved.id)
    ? [...input.logs]
    : [...input.logs, { ...input.saved, intensity: 3, durationMinutes: 0, trigger: "", resolved: false } as BehaviorLog];
  const today = new Date(input.nowMs).toISOString().slice(0, 10);
  const suggestion = suggestedChallenges(all, today).find((s) => s.topic.toLowerCase().startsWith(key));
  return suggestion ? { type, count, suggestion } : { type, count };
}
