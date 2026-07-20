import { useMemo } from "react";
import { useArbor } from "../context/ArborContext";
import { buildTimeline, type TimelineSignal } from "../lib/signalTimeline";

/**
 * The ONE read of the moment ledger.
 *
 * Both timeline densities — the Journal simple feed and the Story rich rail —
 * previously called `buildTimeline(...)` with byte-identical arguments from two
 * components, i.e. the same stream assembled twice with no single owner. This
 * hook is that single source; a density is a rendering choice over it, never a
 * second read.
 *
 * Read-only by construction: it never writes to the ledger and never forks the
 * memory-approval logic.
 */
export function useTimeline(): TimelineSignal[] {
  const { behaviorLogs, milestones, actionPlans, memoryReviewItems, conversations, playLogs } = useArbor();
  return useMemo(
    () => buildTimeline({
      behaviorLogs,
      milestones,
      plans: actionPlans,
      memory: memoryReviewItems,
      conversations,
      play: playLogs,
    }),
    [behaviorLogs, milestones, actionPlans, memoryReviewItems, conversations, playLogs],
  );
}
