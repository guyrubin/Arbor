/* Daily Play selector — pure ranking, no I/O.
 *
 * The differentiator vs age-only competitors (Kinedu/Lovevery): the pick is
 * matched to the child's band AND the domains they've actually been struggling
 * with in their log. Deterministic given a daySeed, so "today's pick" is stable
 * across a day and varies day to day. Falls back to band-only when logs are
 * sparse — never a cold-start failure.
 */

import {
  PLAY_ACTIVITIES, bandForAge, type PlayActivity, type PlayBand, type PlayDomain,
} from "./content";

export interface PlaySelectContext {
  ageYears: number;
  /** Domains the child has recently struggled with (from their log). */
  concernDomains?: PlayDomain[];
  /**
   * CI-28: Domains derived from the parent's explicitly selected active goals
   * (from ChildProfile.activeGoals). Applied at 1.6× weight — higher than the
   * concern-log boost — so goal-linked activities surface first. These are
   * injected by OverviewTab and DailyPlayTab when goals are active.
   */
  goalDomains?: PlayDomain[];
  /** Activity ids done recently — deprioritised for novelty. */
  recentlyDoneIds?: string[];
  /** Stable per-day seed so the pick doesn't churn within a day. */
  daySeed?: number;
}

export interface ScoredActivity {
  activity: PlayActivity;
  score: number;
  /**
   * Why it surfaced, for an honest "because…" line in the UI.
   * CI-28 adds "goal-match": the parent explicitly set a focus for this domain.
   */
  reason: "concern-match" | "stage-match" | "goal-match";
}

/** Map a logged behaviour type to the developmental domain it stresses. */
export function domainForBehaviorType(type: string): PlayDomain | null {
  const t = type.toLowerCase();
  if (/(transition|screen|tantrum|melt|refus|sleep|bedtime|frustrat)/.test(t)) return "regulation";
  if (/(sibling|share|conflict|friend|social|hit|bite)/.test(t)) return "social";
  if (/(speech|word|talk|language|stutter|articul)/.test(t)) return "language";
  if (/(focus|attention|task|listen)/.test(t)) return "cognitive";
  if (/(motor|clumsy|coordination|balance)/.test(t)) return "motor";
  return null;
}

/** Derive the concern domains from recent logs (most-frequent first). */
export function concernDomainsFromLogs(
  logs: { behaviorType: string; timestamp: string | number }[],
  nowMs: number,
  windowDays = 21
): PlayDomain[] {
  const since = nowMs - windowDays * 86_400_000;
  const counts = new Map<PlayDomain, number>();
  for (const l of logs) {
    const t = typeof l.timestamp === "number" ? l.timestamp : new Date(l.timestamp).getTime();
    if (!Number.isFinite(t) || t < since) continue;
    const d = domainForBehaviorType(l.behaviorType);
    if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
}

/** Small deterministic 0–1 jitter so equal-scoring picks rotate by day. */
function jitter(id: string, daySeed: number): number {
  let h = daySeed | 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

function matchesBand(activity: PlayActivity, band: PlayBand): boolean {
  return activity.bands.includes(band);
}

export function rankDailyPlay(ctx: PlaySelectContext): ScoredActivity[] {
  const band = bandForAge(ctx.ageYears);
  const concerns = ctx.concernDomains ?? [];
  const goals = ctx.goalDomains ?? [];
  const done = new Set(ctx.recentlyDoneIds ?? []);
  const daySeed = ctx.daySeed ?? 0;

  return PLAY_ACTIVITIES
    .map((activity) => {
      const bandScore = matchesBand(activity, band) ? 1 : 0.35;
      // CI-28: goal domains apply at 1.6x weight — parent-explicit intent ranks
      // above the inferred concern-log boost (1.8 max). Both can compound on the
      // same activity if the activity's domain matches both.
      const goalMatch = goals.includes(activity.domain);
      const goalBoost = goalMatch ? 1.6 : 1;
      // Concern domains decay by rank: the top struggle weighs most.
      const concernIdx = concerns.indexOf(activity.domain);
      const concernBoost = concernIdx === -1 ? 1 : 1.8 - concernIdx * 0.25;
      const novelty = done.has(activity.id) ? 0.4 : 1;
      const score = bandScore * goalBoost * concernBoost * novelty + jitter(activity.id, daySeed) * 0.05;
      // Reason precedence: goal-match > concern-match > stage-match.
      const reason: ScoredActivity["reason"] =
        goalMatch && matchesBand(activity, band)
          ? "goal-match"
          : concernIdx !== -1 && matchesBand(activity, band)
          ? "concern-match"
          : "stage-match";
      return { activity, score, reason };
    })
    .sort((a, b) => b.score - a.score);
}

/** Top N picks; the first is "today's pick". */
export function selectDailyPlay(ctx: PlaySelectContext, count = 3): ScoredActivity[] {
  return rankDailyPlay(ctx).slice(0, count);
}

/** A stable day seed (days since epoch) from a timestamp. */
export function daySeedFor(nowMs: number): number {
  return Math.floor(nowMs / 86_400_000);
}
