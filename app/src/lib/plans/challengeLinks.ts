/**
 * lib/plans/challengeLinks — the one address of Challenge Plans (v10: their
 * home is Now › Plans). Other surfaces (Now, Moments, the bookshelf) link here
 * instead of hosting their own copy:
 *
 *   #/plans?challenge=all          every pattern this family may start, and the running ones
 *   #/plans?challenge=<patternId>  that plan: its page when it runs, else the composer
 *   #/plans?challenge=<id>&compose=1  the composer on the saved choices ("Change a step")
 *
 * Pattern ids, storage keys and the `books` rows are unchanged (plan-* ids).
 */
import { routeHash } from "../routes";
import { isPatternId } from "../library/plans/planVisibility";
import type { PatternId } from "../library/types";

export const CHALLENGE_ALL = "all";

export type ChallengeTarget =
  | { kind: "none" }
  | { kind: "all" }
  | { kind: "pattern"; pattern: PatternId; compose: boolean };

/** What `?challenge=` asks for. `choose` (the old journal value) reads as the list. */
export function readChallengeQuery(q: URLSearchParams): ChallengeTarget {
  const v = q.get("challenge");
  if (!v) return { kind: "none" };
  if (v === CHALLENGE_ALL || v === "choose") return { kind: "all" };
  if (isPatternId(v)) return { kind: "pattern", pattern: v, compose: q.get("compose") === "1" };
  return { kind: "all" };
}

/** The hash for a Challenge plan (or the list when no id is given). */
export function challengePlanHref(pattern?: PatternId | null, opts: { compose?: boolean } = {}): string {
  return "#" + routeHash("plans", { challenge: pattern ?? CHALLENGE_ALL, ...(pattern && opts.compose ? { compose: "1" } : {}) });
}
