import { useMemo } from "react";
import type {
  AdventureResult,
  BandSnapshot,
  HeroJourneyRun,
  Milestone,
  MimicSession,
  MissionRecord,
  PracticeEvent,
  SpeechAttempt,
} from "../types";
import { useChildCollection, type ChildCollection } from "../hooks/useChildCollection";
import {
  dayKey,
  daysPracticed,
  developmentScore,
  domainBands,
  domainConfidence,
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
  /**
   * LEGACY weekly band snapshots, read-only. B-GROWTH-22a (6 Oct) stopped the
   * writer: no new document is ever stored. The read stays only because the
   * two history cards (Journey, Development Copilot) still list the documents
   * already stored, as counts; W4-R2 / W4-P1 retire the read and the documents.
   */
  snapshots: BandSnapshot[];
  heroRunCount: number;
}

/**
 * Copilot derivations shared by the dashboard, missions banner and Journey.
 * The in-memory `bands` drive escalation (recommend/confidence/watch). They
 * are NEVER stored: B-GROWTH-22a removed the weekly `bandSnapshots` writer
 * (a stored band is a stored grade on a child — law 1). Guard:
 * practice/noStoredGrades.test.ts.
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

  // B-BOOK-60: a story choice is never evidence about the child — the runs'
  // legacy `metricsEarned` are not summed and no band reads them.
  const bands = useMemo(
    () => domainBands(milestones, data.speech.items, data.missions.items, data.adventures.items, data.events.items),
    [milestones, data.speech.items, data.missions.items, data.adventures.items, data.events.items]
  );
  const recommendation = useMemo(() => recommend(bands, data.missions.items), [bands, data.missions.items]);

  const confidence = useMemo(() => {
    const out = {} as Record<PracticeDomain, ConfidenceLevel>;
    for (const b of bands) {
      out[b.domain] = domainConfidence(b.domain, milestones, data.speech.items, data.adventures.items, data.events.items, data.missions.items);
    }
    return out;
  }, [bands, milestones, data.speech.items, data.adventures.items, data.events.items, data.missions.items]);

  return {
    bands,
    recommendation,
    confidence,
    snapshots: snapshotsCol.items,
    heroRunCount: heroRunsCol.items.length,
  };
}
