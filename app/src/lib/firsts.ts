/* firsts — ENG-13: the week-1 celebration that was structurally impossible.
 *
 * THE DEFECT THIS CLOSES
 * ──────────────────────
 * growth/prideMoment.ts opens with `if (!priorByDomain) return [];` and
 * hooks/usePrideMoment.ts says it plainly: "A fresh user (no prior snapshot)
 * celebrates nothing." The milestone-count thresholds start at 5. So the ONE
 * celebration primitive in the app (ui/CelebrationMoment) was unreachable
 * until week 2, and the first-week parent — the one deciding whether Arbor is
 * worth keeping — got counts and never a moment.
 *
 * WHAT A "FIRST" IS
 * ─────────────────
 * A threshold at ONE, not at five: the first moment kept, the first milestone
 * noticed, the first story made, and the first week (7 days since starting,
 * with moments kept on at least 3 distinct days).
 *
 * THE 3-DAY RULE IS CUMULATIVE, NEVER CONSECUTIVE. This is deliberate and is
 * the whole reason `momentDays` is a set of day keys rather than a streak
 * counter: Arbor must never punish a parent for a gap, never say "in a row",
 * and never imply a chain that can be broken. A parent who captured on
 * Monday, Thursday and Sunday has had a real first week.
 *
 * Design rules (mirrors growth/prideMoment.ts, which this sits beside):
 *  - Pure and deterministic: no Date.now(), no storage, no side effects. The
 *    caller injects the counts and the persisted `seen` set.
 *  - Fires AT MOST ONCE EVER per kind — idempotency is the caller's persisted
 *    state, and a re-render with identical input yields nothing new.
 *  - Positive-only: a count going DOWN (a deleted row) never produces an
 *    event, and never un-fires one that already happened.
 *
 * CLINICAL FIREWALL
 * ─────────────────
 * A first carries a COUNT and a kind — never a score, a percentage, a target,
 * a "3 of 7", or any word that implies the family is behind or ahead. The
 * copy lives in i18nElevation/firsts.ts and is banned by test from containing
 * streak language.
 */

/** The four week-1 firsts, in the order they are worth celebrating. */
export const FIRST_KINDS = ["first_week", "first_milestone", "first_story", "first_moment"] as const;
export type FirstKind = (typeof FIRST_KINDS)[number];

/** Days since the family started before the first-week moment can happen, and
 *  the number of DISTINCT (never consecutive) days that must carry a moment. */
export const FIRST_WEEK_DAYS = 7;
export const FIRST_WEEK_MIN_DAYS_WITH_MOMENTS = 3;

/** Everything the detector needs — all counts, all supplied by the caller. */
export interface FirstsInput {
  /** Moments kept (behaviour logs). */
  momentCount: number;
  /** Milestones the parent has noticed (checked). */
  milestoneCount: number;
  /** Stories or comics saved. */
  storyCount: number;
  /** Distinct day keys ("YYYY-MM-DD") that carry at least one moment. */
  momentDays: readonly string[];
  /** Whole days since the family started (0 on the first day). */
  daysSinceStart: number;
}

/** The persisted idempotency state — the kinds already celebrated. */
export interface FirstsState {
  seen: string[];
}

/** A first that just happened for the first time ever. */
export interface FirstMoment {
  kind: FirstKind;
  /** The count behind it — a count, never a score and never out of anything. */
  count: number;
}

export const EMPTY_FIRSTS_STATE: FirstsState = { seen: [] };

/**
 * Detect any first that has newly become true and has never been celebrated.
 * Pure; returns [] when there is nothing new (the overwhelmingly common case).
 */
export function detectFirsts(input: FirstsInput, state: FirstsState): FirstMoment[] {
  const seen = new Set(state?.seen ?? []);
  const out: FirstMoment[] = [];

  const moments = Math.max(0, Math.trunc(input.momentCount) || 0);
  const milestones = Math.max(0, Math.trunc(input.milestoneCount) || 0);
  const stories = Math.max(0, Math.trunc(input.storyCount) || 0);
  const daysWithMoments = new Set(input.momentDays ?? []).size;
  const elapsed = Math.max(0, Math.trunc(input.daysSinceStart) || 0);

  // ONE OWNER PER CELEBRATION. `first_week` and `first_moment` are TIME-staged
  // and belong to the lifecycle spine (lib/lifecycle.ts), which shows them on
  // Today. Detecting them here too meant a parent met the identical sentence
  // twice on day 7 — once on Today, once on Child Memory — from two ledgers
  // that could not see each other. This module keeps the EVENT-staged firsts:
  // the first milestone and the first story, which lifecycle does not stage.
  // The kinds stay in FIRST_KINDS so an already-written ledger still parses.
  void elapsed;
  void daysWithMoments;
  if (!seen.has("first_milestone") && milestones >= 1) {
    out.push({ kind: "first_milestone", count: milestones });
  }
  if (!seen.has("first_story") && stories >= 1) {
    out.push({ kind: "first_story", count: stories });
  }
  void moments;

  return out;
}

/** Show ONE at a time — flooding a first week with four cards is not delight. */
export function pickFirst(firsts: readonly FirstMoment[]): FirstMoment | null {
  if (!firsts.length) return null;
  for (const kind of FIRST_KINDS) {
    const hit = firsts.find((f) => f.kind === kind);
    if (hit) return hit;
  }
  return null;
}

/** Merge celebrated kinds into the persisted state. Pure; input untouched. */
export function mergeFirsts(state: FirstsState, firsts: readonly FirstMoment[]): FirstsState {
  return { seen: [...new Set([...(state?.seen ?? []), ...firsts.map((f) => f.kind)])] };
}

/** True once this kind has been celebrated — it can never happen twice. */
export function hasCelebratedFirst(state: FirstsState, kind: FirstKind): boolean {
  return (state?.seen ?? []).includes(kind);
}

/** The i18n keys for a first. Copy lives in i18nElevation/firsts.ts. */
export function firstCopyKeys(kind: FirstKind): { title: string; sub: string } {
  return { title: `elev.firsts.${kind}.title`, sub: `elev.firsts.${kind}.sub` };
}

/** localStorage key for the per-child persisted state (the caller owns I/O). */
export const firstsStorageKey = (childId: string) => `arbor.firsts.${childId}`;
