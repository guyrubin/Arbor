/* Content coverage map — turns "I keep noticing we have nothing for 1.5-year-olds"
 * into a counted grid of stage x domain so gaps are visible, not hand-discovered.
 * Pure. Powers an internal coverage view and gap-aware authoring/generation.
 */

import { PLAY_ACTIVITIES, type PlayActivity, type PlayDomain } from "./content";
import { STAGES, bandStages, type Stage } from "./stages";

export const PLAY_DOMAINS: PlayDomain[] = ["regulation", "language", "motor", "cognitive", "social"];

/** The micro-stages an activity serves: explicit `stages`, else its bands fanned out. */
export function activityStages(activity: PlayActivity): Stage[] {
  if (activity.stages?.length) return activity.stages;
  return Array.from(new Set(activity.bands.flatMap((b) => bandStages(b))));
}

export interface CoverageCell {
  stage: Stage;
  domain: PlayDomain;
  count: number;
}

/** Full stage x domain grid with activity counts (zero-filled). */
export function buildCoverage(activities: PlayActivity[] = PLAY_ACTIVITIES): CoverageCell[] {
  const counts = new Map<string, number>();
  for (const a of activities) {
    for (const stage of activityStages(a)) {
      const key = `${stage}|${a.domain}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const cells: CoverageCell[] = [];
  for (const s of STAGES) {
    for (const domain of PLAY_DOMAINS) {
      cells.push({ stage: s.stage, domain, count: counts.get(`${s.stage}|${domain}`) ?? 0 });
    }
  }
  return cells;
}

/** Cells at or below `threshold` (default 0 = empty), worst first. The authoring/
 *  generation backlog: exactly where content is missing. */
export function coverageGaps(activities: PlayActivity[] = PLAY_ACTIVITIES, threshold = 0): CoverageCell[] {
  return buildCoverage(activities)
    .filter((c) => c.count <= threshold)
    .sort((a, b) => a.count - b.count);
}

export interface CoverageSummary {
  totalCells: number;
  filledCells: number;
  emptyCells: number;
  percentFilled: number;
  /** Stages with the fewest covered domains (the thinnest age windows). */
  thinnestStages: { stage: Stage; domainsCovered: number }[];
}

/* ── KID-5 / AR-CONT-02: guided-play authoring rank ─────────────────────────
 * The content wave authors the four guided fields (easierVariation /
 * harderVariation / whatToNotice / outcomePrompt) for the TOP-50 activities,
 * ranked by domain coverage × band: each activity scores the sum, over its
 * band×domain cells, of 1/(activities in that cell) — so activities carrying
 * thin cells rank first and the authored set spreads across the whole grid
 * instead of pooling in the fattest cells. Deterministic (ties break by id). */

export const GUIDED_AUTHORING_COUNT = 50;

/** All activities, ranked for guided-play authoring (rarity-weighted band×domain coverage). */
export function guidedAuthoringRank(activities: PlayActivity[] = PLAY_ACTIVITIES): PlayActivity[] {
  const cellCount = new Map<string, number>();
  for (const a of activities) {
    for (const band of a.bands) {
      const key = `${band}|${a.domain}`;
      cellCount.set(key, (cellCount.get(key) ?? 0) + 1);
    }
  }
  const score = (a: PlayActivity) =>
    a.bands.reduce((sum, band) => sum + 1 / (cellCount.get(`${band}|${a.domain}`) ?? 1), 0);
  return [...activities].sort((x, y) => score(y) - score(x) || (x.id < y.id ? -1 : 1));
}

/** The top-N activities the guided-play content wave must cover. */
export function topGuidedActivities(
  activities: PlayActivity[] = PLAY_ACTIVITIES,
  count = GUIDED_AUTHORING_COUNT
): PlayActivity[] {
  return guidedAuthoringRank(activities).slice(0, count);
}

/** True when every guided-play field is authored (non-empty) on the activity. */
export function hasGuidedFields(a: PlayActivity): boolean {
  return Boolean(
    a.easierVariation?.trim() && a.harderVariation?.trim() && a.whatToNotice?.trim() && a.outcomePrompt?.trim()
  );
}

export function coverageSummary(activities: PlayActivity[] = PLAY_ACTIVITIES): CoverageSummary {
  const cells = buildCoverage(activities);
  const filled = cells.filter((c) => c.count > 0).length;
  const byStage = new Map<Stage, number>();
  for (const c of cells) if (c.count > 0) byStage.set(c.stage, (byStage.get(c.stage) ?? 0) + 1);
  const thinnestStages = STAGES
    .map((s) => ({ stage: s.stage, domainsCovered: byStage.get(s.stage) ?? 0 }))
    .sort((a, b) => a.domainsCovered - b.domainsCovered)
    .slice(0, 5);
  return {
    totalCells: cells.length,
    filledCells: filled,
    emptyCells: cells.length - filled,
    percentFilled: cells.length ? Math.round((filled / cells.length) * 100) : 0,
    thinnestStages,
  };
}
