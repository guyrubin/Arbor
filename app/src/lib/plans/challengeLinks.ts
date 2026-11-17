/**
 * lib/plans/challengeLinks — the one address of Challenge Plans (v10: their
 * home is Now › Plans). Other surfaces (Now, Moments, the bookshelf) link here
 * instead of hosting their own copy:
 *
 *   #/plans?challenge=all          every pattern this family may start, and the running ones
 *   #/plans?challenge=<patternId>  that plan: its page when it runs, else the composer
 *   #/plans?challenge=<id>&compose=1  the composer on the saved choices ("Change a step")
 *   #/plans?challenge=<id>&printout=1 the parent copy, as it will print (CP-6), with Print
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
  | { kind: "pattern"; pattern: PatternId; compose: boolean; print: boolean };

/** What `?challenge=` asks for. `choose` (the old journal value) reads as the list. */
export function readChallengeQuery(q: URLSearchParams): ChallengeTarget {
  const v = q.get("challenge");
  if (!v) return { kind: "none" };
  if (v === CHALLENGE_ALL || v === "choose") return { kind: "all" };
  if (isPatternId(v)) return { kind: "pattern", pattern: v, compose: q.get("compose") === "1", print: q.get("printout") === "1" };
  return { kind: "all" };
}

/** The hash for a Challenge plan (or the list when no id is given). */
export function challengePlanHref(pattern?: PatternId | null, opts: { compose?: boolean; print?: boolean } = {}): string {
  return "#" + routeHash("plans", { challenge: pattern ?? CHALLENGE_ALL, ...(pattern && opts.compose ? { compose: "1" } : {}), ...(pattern && opts.print ? { printout: "1" } : {}) });
}

/**
 * The plan a Challenge Plans view has open, as the shell's breadcrumb names it
 * (N-Challenge-D: "Now › Plans › {plan}"); null on Plans' home. The composer
 * names the pattern it composes; the plan's page, the running plan it shows
 * (the one asked for, else the newest running); the parent copy, its plan.
 * The name is the plan's own title (the board's parent-register names are not
 * in the pattern data).
 */
export function openChallengeName(
  target: ChallengeTarget,
  running: { def: { id: PatternId; title: { en: string; he: string } } }[],
  composing: { title: { en: string; he: string } } | null | undefined,
  lang: "en" | "he",
): string | null {
  if (target.kind === "none") return null;
  if (composing) return composing.title[lang];
  const open = target.kind === "pattern" ? running.find((r) => r.def.id === target.pattern) ?? (target.print ? undefined : running[0]) : running[0];
  return open ? open.def.title[lang] : null;
}
