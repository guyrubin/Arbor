/**
 * Pride Moment — threshold-crossing detector (R3, arbor-growth).
 *
 * Detects when the total count of milestones the PARENT has noticed crosses a
 * round-number threshold it had not already cleared.
 *
 * B-GROWTH-06 (clinical firewall): the per-domain branch is gone. It fired a
 * celebration when a child's domain SCORE (share of the age window reached)
 * crossed 25/50/75/100 — a percentage grade of the child, celebrated. What
 * remains counts what the parent noticed; a crossing is persisted, so it fires
 * once and never again even if a milestone is later un-marked.
 *
 * Design rules:
 *  - Pure and deterministic: no Date.now(), no side effects. Caller injects
 *    prior state + current state.
 *  - Fires AT MOST ONCE per threshold crossing: idempotency is enforced by
 *    the persisted `crossedThresholds` set. A re-render with the same state
 *    never re-fires.
 *  - Positive-only (AADC): only a new UPWARD crossing triggers an event.
 *    A regression (score falling) NEVER produces a celebration.
 *  - Non-diagnostic: the event carries a factual label (domain name), not a
 *    numeric score. Callers build the share-card line from `factualLine()`,
 *    which is claim-free and score-free.
 *  - G2: the shareable factual line contains no score number, no percentage,
 *    no "proven/validated/clinical/%" text.
 *  - Face-safety: the caller passes only a first-name (or none). No surname.
 */

/** Milestone-count round-number thresholds that earn a pride moment. */
export const MILESTONE_COUNT_THRESHOLDS = [5, 10, 15, 20, 25, 30] as const;
export type MilestoneThreshold = (typeof MILESTONE_COUNT_THRESHOLDS)[number];

/** A celebration that just crossed its threshold for the first time. */
export interface PrideCrossing {
  /** Unique key — used for idempotency storage. */
  key: string;
  /** The only kind left: the parent-noticed milestone count. */
  kind: "milestone_count";
  /** The threshold that was crossed. */
  threshold: number;
  /** First name (or undefined) — for the factual card line. */
  firstName?: string;
}

/** The state shape the caller must persist across renders to enforce idempotency. */
export interface PrideState {
  /** Set of crossing keys that have already been celebrated. */
  crossedThresholds: string[];
  /** Last persisted milestone count — the baseline a crossing is measured
   *  from. Missing or 0 = no baseline yet (the caller records one silently). */
  lastMilestoneCount?: number;
}

function milestoneCountKey(threshold: number): string {
  return `milestone_count:${threshold}`;
}

/**
 * Detect any new milestone-count threshold crossings.
 *
 * @param checkedCount  The current total number of milestones the parent noticed.
 * @param state    Persisted idempotency state (crossed keys + the baseline count).
 * @param firstName  Child's first name (no surname). Optional.
 * @returns Any NEW crossings (may be empty). Caller persists the new keys.
 */
export function detectPrideCrossings({
  checkedCount,
  state,
  firstName,
}: {
  checkedCount: number;
  state: PrideState;
  firstName?: string;
}): PrideCrossing[] {
  // No baseline yet: celebrate nothing (no confetti dump for every historical
  // milestone on first observation). The caller records the baseline silently.
  const prevCount = state.lastMilestoneCount ?? 0;
  if (prevCount <= 0) return [];

  const alreadyCrossed = new Set(state.crossedThresholds);
  const crossings: PrideCrossing[] = [];
  for (const threshold of MILESTONE_COUNT_THRESHOLDS) {
    const key = milestoneCountKey(threshold);
    if (alreadyCrossed.has(key)) continue;
    // Positive-only (AADC): a genuine new upward crossing of the noticed count.
    if (checkedCount >= threshold && prevCount < threshold) {
      crossings.push({ key, kind: "milestone_count", threshold, firstName });
      alreadyCrossed.add(key);
    }
  }

  return crossings;
}

/**
 * Merge a batch of new crossings into the persisted state.
 * Returns the NEXT state to persist. Pure — does not mutate the input.
 */
export function mergeCrossings(state: PrideState, crossings: PrideCrossing[], checkedCount: number): PrideState {
  return {
    crossedThresholds: [
      ...new Set([...state.crossedThresholds, ...crossings.map((c) => c.key)]),
    ],
    lastMilestoneCount: checkedCount,
  };
}

/**
 * Build the claim-free, G2-compliant, face-safe factual line for a share card.
 *
 * Rules:
 *  - NO score number (no "80%", no "75 out of 100").
 *  - NO clinical/efficacy language ("proven", "validated", "clinical", "delay").
 *  - First name only (no surname). Falls back to "Your child".
 *  - Returns [en, he] tuple.
 */
export function factualShareLine(crossing: PrideCrossing): { en: string; he: string } {
  const name = crossing.firstName || "Your child";
  const nameHe = crossing.firstName || "ילד/ה שלכם";
  return {
    en: `${name} reached a new milestone`,
    he: `${nameHe} הגיע/ה לאבן דרך חדשה`,
  };
}

/**
 * Pick ONE crossing to celebrate when several fire at once (prevent flooding):
 * the highest threshold crossed.
 */
export function pickCelebration(crossings: PrideCrossing[]): PrideCrossing | null {
  if (crossings.length === 0) return null;
  return [...crossings].sort((a, b) => b.threshold - a.threshold)[0];
}
