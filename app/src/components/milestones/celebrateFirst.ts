import { celebrate } from "../../lib/celebrate";
import { hasCelebrated, markCelebrated } from "../ui/CelebrationMoment";

/**
 * v3 F-CHILD-1 — the one rule for a fresh "Seen it": one capped burst per
 * skill EVER, per child (arbor.celebrate.seen.{childId}).
 *
 * The caller decides freshness (a "yes" on a skill that was not seen before)
 * and calls this only AFTER the answer was stored, so a failed write never
 * celebrates. Returns true when it celebrated.
 *
 * MilestonesTab keeps its own pinned form of the same three steps
 * (milestoneCelebration.test.ts), because it also layers the full
 * CelebrationMoment card; it goes when F-SHELL-1 stops registering that page.
 */
export function celebrateFirstOnce(childId: string, milestoneId: string): boolean {
  if (hasCelebrated(childId, milestoneId)) return false;
  celebrate({ kind: "milestone" });
  markCelebrated(childId, milestoneId);
  return true;
}
