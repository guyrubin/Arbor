import { useMemo } from "react";
import { useArbor } from "../context/ArborContext";
import { buildTimeline, type TimelineSignal } from "../lib/signalTimeline";
import { useChildCollection } from "./useChildCollection";
import type {
  AdventureResult,
  HeroJourneyRun,
  MimicSession,
  MissionRecord,
  PracticeEvent,
  SpeechAttempt,
} from "../types";

/**
 * The ONE read of the moment ledger.
 *
 * Both timeline densities — the Journal simple feed and the Story rich rail —
 * previously called `buildTimeline(...)` with byte-identical arguments from two
 * components, i.e. the same stream assembled twice with no single owner. This
 * hook is that single source; a density is a rendering choice over it, never a
 * second read.
 *
 * Masterplan 1.4: the six child-activity ledgers (practice, speech, mimic,
 * adventures, missions, hero runs) fold in here too — DIRECT useChildCollection
 * reads of the registered CHILD_SUBCOLLECTIONS sinks, no derived sink, no new
 * write path. buildTimeline aggregates them same-day same-type into warm
 * "practice" signals with provenance "child".
 *
 * Read-only by construction: it never writes to the ledger and never forks the
 * memory-approval logic.
 */
export function useTimeline(): TimelineSignal[] {
  const {
    behaviorLogs, milestones, actionPlans, memoryReviewItems, conversations, playLogs,
    // TJB-05: the `actionLoops` ledger — Today's accepted/completed step. It
    // is already read once by ArborContext (sorted, capped at 100); this hook
    // FOLDS that same list into the thread instead of opening a second read.
    actionLoop,
    childProfile,
  } = useArbor();
  const childId = childProfile.id;

  // Child-activity ledgers — limits mirror practice/usePracticeData.ts so the
  // two readers of each sink stay in bounds together.
  const practiceEvents = useChildCollection<PracticeEvent>(childId, "practiceEvents", {
    orderByField: "timestamp", orderDir: "desc", max: 800,
  });
  const speechAttempts = useChildCollection<SpeechAttempt>(childId, "speechAttempts", {
    orderByField: "timestamp", orderDir: "desc", max: 500,
  });
  const mimicSessions = useChildCollection<MimicSession>(childId, "mimicSessions", {
    orderByField: "timestamp", orderDir: "desc", max: 300,
  });
  const adventureResults = useChildCollection<AdventureResult>(childId, "adventureResults", {
    orderByField: "timestamp", orderDir: "desc", max: 500,
  });
  const missionRecords = useChildCollection<MissionRecord>(childId, "missionRecords", {
    orderByField: "timestamp", orderDir: "desc", max: 300,
  });
  const heroRuns = useChildCollection<HeroJourneyRun>(childId, "heroRuns", {
    orderByField: "startedAt", orderDir: "desc", max: 100,
  });

  return useMemo(
    () => buildTimeline({
      behaviorLogs,
      milestones,
      plans: actionPlans,
      memory: memoryReviewItems,
      conversations,
      play: playLogs,
      actionOutcomes: actionLoop,
      practiceEvents: practiceEvents.items,
      speechAttempts: speechAttempts.items,
      mimicSessions: mimicSessions.items,
      adventureResults: adventureResults.items,
      missionRecords: missionRecords.items,
      heroRuns: heroRuns.items,
    }),
    [
      behaviorLogs, milestones, actionPlans, memoryReviewItems, conversations, playLogs, actionLoop,
      practiceEvents.items, speechAttempts.items, mimicSessions.items,
      adventureResults.items, missionRecords.items, heroRuns.items,
    ],
  );
}
