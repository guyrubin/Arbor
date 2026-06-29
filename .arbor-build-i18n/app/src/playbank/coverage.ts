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
