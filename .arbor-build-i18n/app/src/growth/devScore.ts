/* Longitudinal Development Score (PRD C4) — the moat made visible.
 *
 * One number per developmental domain (plus an overall), derived from how much
 * of the child's *age-appropriate* milestone set is reached, with an honest
 * trend vs a prior snapshot and a single next action. This is distinct from the
 * Practice Studio "Development Score = practice consistency" — this one is about
 * developmental position, not effort. Pure + deterministic (caller passes the
 * prior snapshot and nowMs), so it's unit-testable and never invents precision.
 *
 * Stance (per PRODUCT.md): non-diagnostic. The score is a conversation starter
 * and a "what to nurture next" pointer, never an ability verdict or a label.
 */

export interface ScoreMilestone {
  domain: string;
  checked: boolean;
}

export type Trend = "up" | "flat" | "down";
export type ScoreConfidence = "none" | "low" | "medium" | "high";

export interface DomainScore {
  domain: string;
  /** 0–100: share of the age-appropriate milestones reached in this domain. */
  score: number;
  reached: number;
  total: number;
  trend: Trend;
  confidence: ScoreConfidence;
}

export interface DevScore {
  /** 0–100 across all tracked domains. */
  overall: number;
  domains: DomainScore[];
  confidence: ScoreConfidence;
  /** The domain to nurture next (lowest-scoring with room to grow), or null. */
  focusDomain: string | null;
}

/** A persistable snapshot for trend comparison. */
export interface DevScoreSnapshot {
  takenMs: number;
  overall: number;
  byDomain: Record<string, number>;
}

const MIN_FOR_CONFIDENCE = 3; // milestones in a domain before its score is dependable
const TREND_EPSILON = 5;      // ignore score wobble below this many points

function domainConfidence(total: number): ScoreConfidence {
  if (total === 0) return "none";
  if (total < MIN_FOR_CONFIDENCE) return "low";
  if (total < MIN_FOR_CONFIDENCE * 2) return "medium";
  return "high";
}

function trendVs(current: number, prior: number | undefined): Trend {
  if (prior == null) return "flat";
  if (current > prior + TREND_EPSILON) return "up";
  if (current < prior - TREND_EPSILON) return "down";
  return "flat";
}

/**
 * Compute the development score from the child's age-appropriate milestones.
 * `prior` (optional) drives the honest trend; without it, trends are "flat".
 */
export function computeDevScore(
  milestones: ScoreMilestone[],
  prior?: DevScoreSnapshot | null
): DevScore {
  const byDomain = new Map<string, { reached: number; total: number }>();
  for (const m of milestones) {
    const d = byDomain.get(m.domain) ?? { reached: 0, total: 0 };
    d.total += 1;
    if (m.checked) d.reached += 1;
    byDomain.set(m.domain, d);
  }

  const domains: DomainScore[] = [...byDomain.entries()]
    .map(([domain, { reached, total }]) => {
      const score = total > 0 ? Math.round((reached / total) * 100) : 0;
      return {
        domain,
        score,
        reached,
        total,
        trend: trendVs(score, prior?.byDomain[domain]),
        confidence: domainConfidence(total),
      };
    })
    .sort((a, b) => a.domain.localeCompare(b.domain));

  const totalAll = milestones.length;
  const reachedAll = milestones.filter((m) => m.checked).length;
  const overall = totalAll > 0 ? Math.round((reachedAll / totalAll) * 100) : 0;

  // Focus = the domain with the most room to grow (lowest score), needing at
  // least one unreached milestone and enough data to be worth pointing at.
  const focus = domains
    .filter((d) => d.reached < d.total && d.confidence !== "none")
    .sort((a, b) => a.score - b.score)[0];

  return {
    overall,
    domains,
    confidence: domainConfidence(totalAll),
    focusDomain: focus?.domain ?? null,
  };
}

/** Build a snapshot from a computed score (caller persists it for next time). */
export function toSnapshot(score: DevScore, nowMs: number): DevScoreSnapshot {
  return {
    takenMs: nowMs,
    overall: score.overall,
    byDomain: Object.fromEntries(score.domains.map((d) => [d.domain, d.score])),
  };
}

/** Whether enough time passed to record a fresh snapshot (weekly cadence). */
export function shouldSnapshot(prior: DevScoreSnapshot | null | undefined, nowMs: number): boolean {
  if (!prior) return true;
  return nowMs - prior.takenMs >= 7 * 86_400_000;
}
