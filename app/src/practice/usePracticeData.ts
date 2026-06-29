import { useEffect, useMemo, useRef } from "react";
import type {
  AdventureResult,
  BandSnapshot,
  DevelopmentMetrics,
  HeroJourneyRun,
  Milestone,
  MimicSession,
  MissionRecord,
  PracticeEvent,
  SpeechAttempt,
} from "../types";
import { useChildCollection, type ChildCollection } from "../hooks/useChildCollection";
import {
  bandTrend,
  dayKey,
  daysPracticed,
  developmentScore,
  domainBands,
  domainConfidence,
  pendingSnapshot,
  recommend,
  soundStats,
  streakDays,
  weeklyActivity,
  type ConfidenceLevel,
  type CopilotRecommendation,
  type DomainBand,
  type SoundStats,
  type WeeklyActivity,
} from "./signals";
import type { PracticeDomain } from "../types";

export interface PracticeData {
  speech: ChildCollection<SpeechAttempt>;
  mimic: ChildCollection<MimicSession>;
  missions: ChildCollection<MissionRecord>;
  adventures: ChildCollection<AdventureResult>;
  /** Generic play/practice interactions (Feelings Lab, Words/Express, Memory Match). */
  events: ChildCollection<PracticeEvent>;
  today: string;
  stats: SoundStats[];
  week: WeeklyActivity;
  score: number;
  /** Consecutive-day streak — PARENT-SIDE context only, never a child reward. */
  streak: number;
  /** Lifetime distinct days practiced — monotonic, child-safe consistency signal. */
  daysPracticed: number;
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
  const events = useChildCollection<PracticeEvent>(childId, "practiceEvents", {
    orderByField: "timestamp",
    orderDir: "desc",
    max: 800,
  });

  const today = dayKey(new Date());

  const stats = useMemo(() => soundStats(speech.items), [speech.items]);
  const week = useMemo(
    () => weeklyActivity(speech.items, mimic.items, missions.items, adventures.items, today, events.items),
    [speech.items, mimic.items, missions.items, adventures.items, events.items, today]
  );
  const score = useMemo(() => developmentScore(week), [week]);
  const streak = useMemo(() => streakDays(missions.items, today), [missions.items, today]);
  const days = useMemo(() => daysPracticed(missions.items), [missions.items]);

  return { speech, mimic, missions, adventures, events, today, stats, week, score, streak, daysPracticed: days };
}

export interface CopilotData {
  bands: DomainBand[];
  recommendation: CopilotRecommendation;
  confidence: Record<PracticeDomain, ConfidenceLevel>;
  trend: Record<PracticeDomain, number>;
  snapshots: BandSnapshot[];
  heroMetrics: Partial<DevelopmentMetrics>;
  heroRunCount: number;
}

/**
 * Copilot derivations shared by the dashboard, missions banner and Journey.
 * Also maintains the weekly band-snapshot history (one snapshot per ISO week,
 * written automatically once enough collections have loaded).
 */
export function useCopilot(
  milestones: Milestone[],
  data: Pick<PracticeData, "speech" | "missions" | "adventures" | "events" | "today">,
  childId: string
): CopilotData {
  const heroRunsCol = useChildCollection<HeroJourneyRun>(childId, "heroRuns");
  const snapshotsCol = useChildCollection<BandSnapshot>(childId, "bandSnapshots", {
    orderByField: "date",
    orderDir: "desc",
    max: 60,
  });

  const heroMetrics = useMemo(() => {
    const sum: Partial<DevelopmentMetrics> = {};
    for (const run of heroRunsCol.items) {
      for (const [k, v] of Object.entries(run.metricsEarned ?? {})) {
        const key = k as keyof DevelopmentMetrics;
        sum[key] = (sum[key] ?? 0) + (v ?? 0);
      }
    }
    return sum;
  }, [heroRunsCol.items]);

  const bands = useMemo(
    () => domainBands(milestones, data.speech.items, data.missions.items, data.adventures.items, data.events.items, heroMetrics),
    [milestones, data.speech.items, data.missions.items, data.adventures.items, data.events.items, heroMetrics]
  );
  const recommendation = useMemo(() => recommend(bands, data.missions.items), [bands, data.missions.items]);

  const confidence = useMemo(() => {
    const out = {} as Record<PracticeDomain, ConfidenceLevel>;
    for (const b of bands) {
      out[b.domain] = domainConfidence(b.domain, milestones, data.speech.items, data.adventures.items, data.events.items, data.missions.items);
    }
    return out;
  }, [bands, milestones, data.speech.items, data.adventures.items, data.events.items, data.missions.items]);

  // Weekly history: persist one snapshot per ISO week (Epic 1 historical progression).
  const snapshotWritten = useRef<string | null>(null);
  useEffect(() => {
    if (!snapshotsCol.loaded || !data.speech.loaded) return;
    const snap = pendingSnapshot(snapshotsCol.items, bands, data.today, milestones);
    if (snap && snapshotWritten.current !== snap.id) {
      snapshotWritten.current = snap.id;
      void snapshotsCol.upsert(snap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotsCol.loaded, snapshotsCol.items, data.speech.loaded, bands, data.today]);

  const trend = useMemo(() => bandTrend(snapshotsCol.items, bands), [snapshotsCol.items, bands]);

  return {
    bands,
    recommendation,
    confidence,
    trend,
    snapshots: snapshotsCol.items,
    heroMetrics,
    heroRunCount: heroRunsCol.items.length,
  };
}
