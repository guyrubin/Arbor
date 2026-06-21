/**
 * Pride Moment — threshold-crossing detector (R3, arbor-growth).
 *
 * Detects when a DevScore domain (or the overall score) crosses a celebration
 * threshold it had not already cleared, or when the total checked milestone
 * count crosses a round-number milestone-count threshold.
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

import type { DevScore } from "./devScore";

/** Thresholds at which a domain's score triggers a pride moment, in ascending
 *  order. The crossing is detected when the score goes FROM below a threshold
 *  TO at or above it. */
export const DOMAIN_THRESHOLDS = [25, 50, 75, 100] as const;
export type DomainThreshold = (typeof DOMAIN_THRESHOLDS)[number];

/** Milestone-count round-number thresholds that earn a pride moment. */
export const MILESTONE_COUNT_THRESHOLDS = [5, 10, 15, 20, 25, 30] as const;
export type MilestoneThreshold = (typeof MILESTONE_COUNT_THRESHOLDS)[number];

/** A celebration that just crossed its threshold for the first time. */
export interface PrideCrossing {
  /** Unique key — used for idempotency storage. */
  key: string;
  /** "domain" for a per-domain score crossing, "milestone_count" for raw count. */
  kind: "domain" | "milestone_count";
  /** Domain id (kind="domain") or undefined (kind="milestone_count"). */
  domain?: string;
  /** The threshold that was crossed. */
  threshold: number;
  /** First name (or undefined) — for the factual card line. */
  firstName?: string;
}

/** The state shape the caller must persist across renders to enforce idempotency. */
export interface PrideState {
  /** Set of crossing keys that have already been celebrated. */
  crossedThresholds: string[];
  /** Last persisted milestone count (for count-threshold idempotency). */
  lastMilestoneCount?: number;
}

function domainThresholdKey(domain: string, threshold: number): string {
  return `domain:${domain}:${threshold}`;
}

function milestoneCountKey(threshold: number): string {
  return `milestone_count:${threshold}`;
}

/**
 * Detect any new threshold crossings.
 *
 * @param current  The freshly computed DevScore.
 * @param prior    The DevScore byDomain snapshot from the last persisted record
 *                 (pass `null` / `undefined` for first-ever — no celebration on
 *                 first render; we don't want a confetti dump on onboarding).
 * @param checkedCount  The current total number of checked milestones.
 * @param state    Persisted idempotency state from the last celebration cycle.
 * @param firstName  Child's first name (no surname). Optional.
 * @returns Any NEW crossings (may be empty). Caller persists the new keys.
 */
export function detectPrideCrossings({
  current,
  priorByDomain,
  checkedCount,
  state,
  firstName,
}: {
  current: DevScore;
  priorByDomain: Record<string, number> | null | undefined;
  checkedCount: number;
  state: PrideState;
  firstName?: string;
}): PrideCrossing[] {
  // First-ever render: no prior snapshot exists. We celebrate nothing yet so
  // new users don't get an immediate confetti on loading the app.
  if (!priorByDomain) return [];

  const alreadyCrossed = new Set(state.crossedThresholds);
  const crossings: PrideCrossing[] = [];

  // ── Domain score crossings ────────────────────────────────────────────────
  for (const d of current.domains) {
    const priorScore = priorByDomain[d.domain] ?? 0;
    for (const threshold of DOMAIN_THRESHOLDS) {
      const key = domainThresholdKey(d.domain, threshold);
      if (alreadyCrossed.has(key)) continue; // already celebrated
      // Only fire on a genuine new upward crossing (AADC: no negative events).
      if (d.score >= threshold && priorScore < threshold) {
        crossings.push({ key, kind: "domain", domain: d.domain, threshold, firstName });
        alreadyCrossed.add(key);
      }
    }
  }

  // ── Milestone count crossings ─────────────────────────────────────────────
  // Mirror the domain first-render guard: a fresh state (no established prior
  // count) establishes the baseline silently rather than dumping confetti for
  // every historical milestone on first observation. Only an increase from a
  // real prior count (prevCount > 0) earns a celebration.
  const prevCount = state.lastMilestoneCount ?? 0;
  for (const threshold of MILESTONE_COUNT_THRESHOLDS) {
    const key = milestoneCountKey(threshold);
    if (alreadyCrossed.has(key)) continue;
    if (prevCount > 0 && checkedCount >= threshold && prevCount < threshold) {
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
export function factualShareLine(crossing: PrideCrossing, domainLabel: string): { en: string; he: string } {
  const name = crossing.firstName || "Your child";
  const nameHe = crossing.firstName || "ילד/ה שלכם";

  if (crossing.kind === "milestone_count") {
    return {
      en: `${name} reached a new milestone`,
      he: `${nameHe} הגיע/ה לאבן דרך חדשה`,
    };
  }

  // domain crossing
  const domain = (domainLabel || crossing.domain || "").toLowerCase();
  return {
    en: `A new milestone for ${name} in ${domain}`,
    he: `אבן דרך חדשה עבור ${nameHe} ב${domain}`,
  };
}

/**
 * Pick the "best" crossing to celebrate when multiple fire at once
 * (show only one at a time — prevent flooding).
 * Preference: 100% domain crossings first, then count crossings, then others.
 */
export function pickCelebration(crossings: PrideCrossing[]): PrideCrossing | null {
  if (crossings.length === 0) return null;
  const full = crossings.find((c) => c.kind === "domain" && c.threshold === 100);
  if (full) return full;
  const count = crossings.find((c) => c.kind === "milestone_count");
  if (count) return count;
  return crossings[0];
}
