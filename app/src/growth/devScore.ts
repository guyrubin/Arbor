/* The development picture (PRD C4) — COUNTS of the child's age-window
 * milestones the parent has noticed, per developmental domain.
 *
 * B-GROWTH-06 (clinical firewall): this module used to build a 0–100 score
 * per domain, an overall percentage and an up/flat/down trend against a weekly
 * snapshot that DevScoreCard persisted to `devScoreSnapshots` — composite
 * grades of a child, stored and shipped in every GDPR export, while every
 * surface had long since stopped rendering them. The public type now carries
 * counts only (`reached`/`total`) and no snapshot is built or written. Legacy
 * `devScoreSnapshots` documents stay registered in CHILD_SUBCOLLECTIONS so they
 * still export and erase until Guy decides their deletion (G12).
 *
 * `focusDomain` is unchanged for its existing consumers (Learn, Masterclasses):
 * the domain with the most room to grow, computed internally and never exposed
 * as a number. Pure + deterministic.
 */

export interface ScoreMilestone {
  domain: string;
  checked: boolean;
}

export type ScoreConfidence = "none" | "low" | "medium" | "high";

export interface DomainScore {
  domain: string;
  /** Milestones in this domain the parent has noticed. */
  reached: number;
  /** Milestones in this domain inside the child's age window. */
  total: number;
  confidence: ScoreConfidence;
}

export interface DevScore {
  domains: DomainScore[];
  confidence: ScoreConfidence;
  /** The domain with the most room to grow (descriptive only), or null. */
  focusDomain: string | null;
}

const MIN_FOR_CONFIDENCE = 3; // milestones in a domain before its count is dependable

function domainConfidence(total: number): ScoreConfidence {
  if (total === 0) return "none";
  if (total < MIN_FOR_CONFIDENCE) return "low";
  if (total < MIN_FOR_CONFIDENCE * 2) return "medium";
  return "high";
}

/** Compute the count picture from the child's age-appropriate milestones. */
export function computeDevScore(milestones: ScoreMilestone[]): DevScore {
  const byDomain = new Map<string, { reached: number; total: number }>();
  for (const m of milestones) {
    const d = byDomain.get(m.domain) ?? { reached: 0, total: 0 };
    d.total += 1;
    if (m.checked) d.reached += 1;
    byDomain.set(m.domain, d);
  }

  const domains: DomainScore[] = [...byDomain.entries()]
    .map(([domain, { reached, total }]) => ({ domain, reached, total, confidence: domainConfidence(total) }))
    .sort((a, b) => a.domain.localeCompare(b.domain));

  // Focus = the domain with the most room to grow, needing at least one
  // unreached milestone and enough data to be worth pointing at. The share is
  // a LOCAL sort key only (same rounding as before, so the pick is unchanged);
  // it never leaves this function.
  const share = (d: DomainScore) => Math.round((d.reached / d.total) * 100);
  const focus = domains
    .filter((d) => d.reached < d.total && d.confidence !== "none")
    .sort((a, b) => share(a) - share(b))[0];

  return {
    domains,
    confidence: domainConfidence(milestones.length),
    focusDomain: focus?.domain ?? null,
  };
}
