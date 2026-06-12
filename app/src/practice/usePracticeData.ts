import { useMemo } from "react";
import type { AdventureResult, MimicSession, MissionRecord, SpeechAttempt } from "../types";
import { useChildCollection, type ChildCollection } from "../hooks/useChildCollection";
import {
  dayKey,
  developmentScore,
  domainBands,
  recommend,
  soundStats,
  streakDays,
  weeklyActivity,
  type CopilotRecommendation,
  type DomainBand,
  type SoundStats,
  type WeeklyActivity,
} from "./signals";
import type { Milestone } from "../types";

export interface PracticeData {
  speech: ChildCollection<SpeechAttempt>;
  mimic: ChildCollection<MimicSession>;
  missions: ChildCollection<MissionRecord>;
  adventures: ChildCollection<AdventureResult>;
  today: string;
  stats: SoundStats[];
  week: WeeklyActivity;
  score: number;
  streak: number;
}

/**
 * All Practice Studio collections for the active child, plus the derived
 * weekly signal. Firestore-backed when authed, localStorage in sandbox —
 * same adapter the rest of the app uses.
 */
export function usePracticeData(childId: string): PracticeData {
  const speech = useChildCollection<SpeechAttempt>(childId, "speechAttempts", {
    orderByField: "timestamp",
    orderDir: "desc",
    max: 500,
  });
  const mimic = useChildCollection<MimicSession>(childId, "mimicSessions", {
    orderByField: "timestamp",
    orderDir: "desc",
    max: 300,
  });
  const missions = useChildCollection<MissionRecord>(childId, "missionRecords", {
    orderByField: "timestamp",
    orderDir: "desc",
    max: 300,
  });
  const adventures = useChildCollection<AdventureResult>(childId, "adventureResults", {
    orderByField: "timestamp",
    orderDir: "desc",
    max: 500,
  });

  const today = dayKey(new Date());

  const stats = useMemo(() => soundStats(speech.items), [speech.items]);
  const week = useMemo(
    () => weeklyActivity(speech.items, mimic.items, missions.items, adventures.items, today),
    [speech.items, mimic.items, missions.items, adventures.items, today]
  );
  const score = useMemo(() => developmentScore(week), [week]);
  const streak = useMemo(() => streakDays(missions.items, today), [missions.items, today]);

  return { speech, mimic, missions, adventures, today, stats, week, score, streak };
}

/** Copilot derivations shared by the dashboard and the missions banner. */
export function useCopilot(
  milestones: Milestone[],
  data: Pick<PracticeData, "speech" | "missions" | "adventures">
): { bands: DomainBand[]; recommendation: CopilotRecommendation } {
  const bands = useMemo(
    () => domainBands(milestones, data.speech.items, data.missions.items, data.adventures.items),
    [milestones, data.speech.items, data.missions.items, data.adventures.items]
  );
  const recommendation = useMemo(() => recommend(bands, data.missions.items), [bands, data.missions.items]);
  return { bands, recommendation };
}
