import type { AdventureResult, MimicSession, MissionRecord, PracticeEvent, SpeechAttempt } from "../types";
import type { SoundStats } from "./signals";

/* Achievements (Epic 10) — milestones of EFFORT, not ability. Every badge is
   earnable by any child through practice volume and variety. */

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  detail: string;
  earned: boolean;
}

export interface AchievementInput {
  speech: SpeechAttempt[];
  mimic: MimicSession[];
  missions: MissionRecord[];
  adventures: AdventureResult[];
  events: PracticeEvent[];
  stats: SoundStats[];
  streak: number;
  heroRuns: number;
}

export function computeAchievements(x: AchievementInput): Achievement[] {
  const emotionRounds = x.events.filter((e) => ["emotion-id", "emotion-why"].includes(e.kind)).length;
  const calmRounds = x.events.filter((e) => e.kind === "calm").length;
  const memoryRounds = x.events.filter((e) => e.kind === "memory");
  const wordRounds = x.events.filter((e) => ["vocab-naming", "vocab-category", "expressive"].includes(e.kind)).length;
  const missionsDone = x.missions.filter((m) => m.completed).length;
  const modulesUsed = [
    x.speech.length > 0 || x.mimic.length > 0,
    missionsDone > 0,
    x.adventures.length > 0,
    emotionRounds + calmRounds > 0,
  ].filter(Boolean).length;

  return [
    { id: "first-step", emoji: "🌱", title: "First step", detail: "Completed the very first practice of any kind.", earned: x.speech.length + missionsDone + x.adventures.length + x.events.length + x.mimic.length > 0 },
    { id: "streak-3", emoji: "🔥", title: "3-day streak", detail: "Practiced three days in a row.", earned: x.streak >= 3 },
    { id: "streak-7", emoji: "🏆", title: "Full week", detail: "Seven straight days of practice.", earned: x.streak >= 7 },
    { id: "explorer", emoji: "🧭", title: "Explorer", detail: "Tried all four practice areas.", earned: modulesUsed >= 4 },
    { id: "sound-master", emoji: "🎙️", title: "Sound on the rise", detail: "Took one sound above 80% with 10+ tries.", earned: x.stats.some((s) => s.attempts >= 10 && s.recentAccuracy >= 80) },
    { id: "word-collector", emoji: "📚", title: "Word collector", detail: "Finished 15 Words & Express rounds.", earned: wordRounds >= 15 },
    { id: "feelings-friend", emoji: "💛", title: "Feelings friend", detail: "Played 10 Feelings Lab rounds.", earned: emotionRounds >= 10 },
    { id: "calm-captain", emoji: "🫧", title: "Calm captain", detail: "Completed 5 calm-down practices.", earned: calmRounds >= 5 },
    { id: "memory-whiz", emoji: "🧠", title: "Memory whiz", detail: "Aced a big Memory Match grid.", earned: memoryRounds.some((e) => (e.score ?? 0) >= 90 && (e.meta ?? "").includes("12")) },
    { id: "story-hero", emoji: "📖", title: "Story hero", detail: "Completed a Story Journey choice.", earned: x.heroRuns > 0 },
    { id: "adventurer", emoji: "🗺️", title: "Adventurer", detail: "Answered 15 adventure scenes.", earned: x.adventures.length >= 15 },
    { id: "mission-20", emoji: "🎯", title: "Mission 20", detail: "Completed 20 daily missions.", earned: missionsDone >= 20 },
  ];
}
