import { useMemo } from "react";
import { useArbor } from "../context/ArborContext";
import { useChildCollection } from "./useChildCollection";
import { toObservations, type Observation } from "../lib/observations";
import type { KeepsakeDoc } from "../lib/firstsKeepsake";
import type { GrowthEntry } from "../growth/growthEntries";
import type { LangObservation } from "../growth/vocabAgg";
import type { GoalObservation } from "../practice/dailyPlan";
import type { ScreeningResult } from "../lib/screening";
import type {
  AdventureResult,
  MimicSession,
  MissionRecord,
  PracticeEvent,
  SpeechAttempt,
} from "../types";

/**
 * B-GROWTH-28 — the child's record as ONE list of domain-tagged observations
 * (lib/observations.ts). Read-only: DIRECT useChildCollection reads of
 * registered CHILD_SUBCOLLECTIONS sinks (the same ones useTimeline, the
 * Language Lab, Growth and the Development Check already read), no new sink,
 * no write path. Limits mirror the existing readers.
 */
export function useObservations(): Observation[] {
  const { behaviorLogs, milestones, playLogs, childProfile, memoryReviewItems } = useArbor();
  const childId = childProfile.id;

  const keepsakes = useChildCollection<KeepsakeDoc>(childId, "keepsakes");
  const growthEntries = useChildCollection<GrowthEntry>(childId, "growthEntries", { orderByField: "date", orderDir: "desc", max: 200 });
  const langObs = useChildCollection<LangObservation>(childId, "langObs", { orderByField: "timestamp", orderDir: "desc", max: 200 });
  const goalObservations = useChildCollection<GoalObservation>(childId, "goalObservations", { orderByField: "timestamp", orderDir: "desc", max: 200 });
  const screenings = useChildCollection<ScreeningResult & { id: string }>(childId, "screenings");
  const speechAttempts = useChildCollection<SpeechAttempt>(childId, "speechAttempts", { orderByField: "timestamp", orderDir: "desc", max: 500 });
  const practiceEvents = useChildCollection<PracticeEvent>(childId, "practiceEvents", { orderByField: "timestamp", orderDir: "desc", max: 800 });
  const mimicSessions = useChildCollection<MimicSession>(childId, "mimicSessions", { orderByField: "timestamp", orderDir: "desc", max: 300 });
  const adventureResults = useChildCollection<AdventureResult>(childId, "adventureResults", { orderByField: "timestamp", orderDir: "desc", max: 500 });
  const missionRecords = useChildCollection<MissionRecord>(childId, "missionRecords", { orderByField: "timestamp", orderDir: "desc", max: 300 });

  return useMemo(
    () => toObservations(
      {
        behaviorLogs,
        milestones,
        keepsakes: keepsakes.items,
        growthEntries: growthEntries.items,
        langObs: langObs.items,
        goalObservations: goalObservations.items,
        screenings: screenings.items,
        playLogs,
        speechAttempts: speechAttempts.items,
        practiceEvents: practiceEvents.items,
        mimicSessions: mimicSessions.items,
        adventureResults: adventureResults.items,
        missionRecords: missionRecords.items,
        // B-GROWTH-29: approved facts that carry the answer's domains (untagged
        // older facts stay out of the per-domain record — no backfill)
        memoryFacts: (memoryReviewItems ?? [])
          .filter((m) => m.status === "approved")
          .map((m) => ({ id: m.memoryId, fact: m.fact, at: m.createdAt, domains: m.domains })),
      },
      childProfile,
    ),
    [
      behaviorLogs, milestones, playLogs, childProfile, memoryReviewItems,
      keepsakes.items, growthEntries.items, langObs.items, goalObservations.items, screenings.items,
      speechAttempts.items, practiceEvents.items, mimicSessions.items, adventureResults.items, missionRecords.items,
    ],
  );
}
