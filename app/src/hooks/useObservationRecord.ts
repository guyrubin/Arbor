import { useMemo } from "react";
import { useArbor } from "../context/ArborContext";
import { useChildHistory } from "./useChildHistory";
import { toObservations, type ObservationSources } from "../lib/observations";
import type { KeepsakeDoc } from "../lib/firstsKeepsake";
import type { GrowthEntry } from "../growth/growthEntries";
import type { LangObservation } from "../growth/vocabAgg";
import type { GoalObservation } from "../practice/dailyPlan";
import type { ScreeningResult } from "../lib/screening";
import type { ActionLoopEntry } from "../actionLoop/model";
import type { AdventureResult, BehaviorLog, Milestone, MimicSession, MissionRecord, PlayLog, PracticeEvent, SpeechAttempt } from "../types";

/** The portrait's expandable source record. Other bounded summaries retain
 * useObservations; only this explicit history browser requests older pages. */
export function useObservationRecord() {
  const { childProfile, behaviorLogs, milestoneHistory, playLogs, actionLoop, memoryReviewItems, memoryReviewError, memoryReviewLoaded, retryMemoryReview } = useArbor();
  const childId = childProfile.id;
  const moments = useChildHistory<BehaviorLog>(childId, "behaviorLogs", "timestamp", behaviorLogs);
  const noticed = useChildHistory<Milestone>(childId, "milestones", undefined, milestoneHistory);
  const play = useChildHistory<PlayLog>(childId, "playLogs", "timestamp", playLogs);
  const actions = useChildHistory<ActionLoopEntry>(childId, "actionLoops", "acceptedAt", actionLoop);
  const keepsakes = useChildHistory<KeepsakeDoc>(childId, "keepsakes");
  const growth = useChildHistory<GrowthEntry>(childId, "growthEntries", "date");
  const words = useChildHistory<LangObservation>(childId, "langObs", "timestamp");
  const goals = useChildHistory<GoalObservation>(childId, "goalObservations", "timestamp");
  const checks = useChildHistory<ScreeningResult & { id: string }>(childId, "screenings");
  const speech = useChildHistory<SpeechAttempt>(childId, "speechAttempts", "timestamp");
  const practice = useChildHistory<PracticeEvent>(childId, "practiceEvents", "timestamp");
  const mimic = useChildHistory<MimicSession>(childId, "mimicSessions", "timestamp");
  const adventures = useChildHistory<AdventureResult>(childId, "adventureResults", "timestamp");
  const missions = useChildHistory<MissionRecord>(childId, "missionRecords", "timestamp");
  const sources: ObservationSources = useMemo(() => ({
    behaviorLogs: moments.items, milestones: noticed.items, playLogs: play.items, actionLoops: actions.items,
    keepsakes: keepsakes.items, growthEntries: growth.items, langObs: words.items, goalObservations: goals.items,
    screenings: checks.items, speechAttempts: speech.items, practiceEvents: practice.items,
    mimicSessions: mimic.items, adventureResults: adventures.items, missionRecords: missions.items,
    memoryFacts: memoryReviewError ? [] : memoryReviewItems.filter(item => item.status === "approved").map(item => ({ id: item.memoryId, fact: item.fact, at: item.createdAt, domains: item.domains })),
  }), [moments.items, noticed.items, play.items, actions.items, keepsakes.items, growth.items, words.items, goals.items, checks.items, speech.items, practice.items, mimic.items, adventures.items, missions.items, memoryReviewError, memoryReviewItems]);
  const observations = useMemo(() => toObservations(sources, childProfile), [sources, childProfile]);
  const collections = [moments, noticed, play, actions, keepsakes, growth, words, goals, checks, speech, practice, mimic, adventures, missions];
  const loading = collections.some(source => source.loading) || !memoryReviewLoaded;
  const error = collections.some(source => source.error) || memoryReviewError;
  const more = collections.some(source => source.more);
  const confirmed = collections.every(source => source.confirmed);
  return {
    observations, sources, loading, error, more, confirmed,
    // Each source advances by at most 200 rows per explicit parent action.
    loadMore: () => { for (const source of collections) source.loadMore(); },
    reload: () => { for (const source of collections) source.reload(); if (memoryReviewError) retryMemoryReview(); },
  };
}
