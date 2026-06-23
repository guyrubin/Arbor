/**
 * Canonical Practice Worlds registry — non-functional, importable by the
 * F2 capability-floor harness (`scripts/capability-floors.mjs`).
 *
 * This file owns the authoritative list of distinct practice worlds/game-modes
 * that exist (or are clearly planned) in the Practice Studio. It is a READ-ONLY
 * export; nothing here alters any rendering path. Components MAY import it later
 * to replace local arrays, but that is a separate change.
 *
 * Status annotations:
 *   "live"        — component exists, fully wired, ships today.
 *   "scaffolded"  — planned world; content / game logic not yet implemented.
 *
 * The 14 ids below match the target ids from the F2 floor spec
 * (NO-REGRESSION-GATE.md §1 F2):
 *   speech, feelings, adventures, mimic, memory, reading,
 *   beat, pose, pattern, order, truth, promise, courage, aim
 *
 * Three additional live worlds are included (ids 15–17) because they exist as
 * fully shipped game surfaces in the current codebase and the floor spec uses
 * >= 14 (not exactly 14).
 */

export interface World {
  /** Unique stable id — the floor script asserts uniqueness and count >= 14. */
  id: string;
  /** Human-readable title shown in UI (or planned title). */
  title: string;
  /** Describes whether the world is live or scaffolded. */
  status: "live" | "scaffolded";
}

/**
 * Canonical registry. Do NOT reorder without updating floor assertions.
 * Ids 1–14 match the F2 spec target list exactly.
 */
export const WORLDS: World[] = [
  // ── Target ids (F2 spec) ────────────────────────────────────────────────
  {
    id: "speech",
    title: "Speech Coach",
    status: "live",
    // src/components/practice/SpeechCoachTab.tsx — ASHA-gated articulation
    // drills: sound picker, word/sentence/story ladder, record & compare,
    // vocabulary naming, category pick, expressive mode, ASHA dosage tracking.
  },
  {
    id: "feelings",
    title: "Feelings Lab",
    status: "live",
    // src/components/practice/FeelingsLabTab.tsx — emotion-id scenarios,
    // self-check avatar mirror, "why feelings happen" cards, breathing patterns
    // and calm-down toolkit.
  },
  {
    id: "adventures",
    title: "Cognitive Adventures",
    status: "live",
    // src/components/practice/AdventuresTab.tsx — MITA-style comprehension
    // stories: curated + AI-generated scenarios, vocabulary/logic/sequencing/
    // instructions/abstract-thinking signals, scene-by-scene choice play.
  },
  {
    id: "mimic",
    title: "Mimic Studio",
    status: "live",
    // src/components/practice/MimicStudioTab.tsx — Speech Blubs-style
    // imitation packs (animal-sounds etc.); local-only camera mirror;
    // parent star-rating; pack completion celebrations.
  },
  {
    id: "memory",
    title: "Memory Match",
    status: "live",
    // src/components/practice/MemoryMatch.tsx — adaptive emoji pairs game
    // measuring working memory; grid size scales with past-round performance;
    // efficiency score feeds the cognition domain band.
  },
  {
    id: "reading",
    title: "Early Reading Track",
    status: "live",
    // src/components/practice/EarlyReadingTrack.tsx — age-gated phonics
    // (letter sounds), sight-words, and first-reading stages; plus the finger
    // letter-trace mini-game (coverage-scored, multi-stroke).
  },
  {
    id: "beat",
    title: "Beat & Rhythm",
    status: "scaffolded", // planned rhythm/beat world; game logic not yet implemented
  },
  {
    id: "pose",
    title: "Pose Match",
    status: "scaffolded", // planned body-pose mimicry world; on-device pose estimation
    // Note: on-device face-expression mimicry (MediaPipe blendshapes) is LIVE
    // under id "faceMatch" below — "pose" targets full-body pose, not facial.
  },
  {
    id: "pattern",
    title: "Pattern Play",
    status: "scaffolded", // planned pattern-recognition / sequence-completion world
  },
  {
    id: "order",
    title: "Sequencing & Order",
    status: "scaffolded", // planned event-sequencing / ordering world
  },
  {
    id: "truth",
    title: "Truth Quest",
    status: "scaffolded", // planned world; builds honest-assessment & truth-telling skills
  },
  {
    id: "promise",
    title: "Promise Keeper",
    status: "scaffolded", // planned world; responsibility / commitment follow-through
  },
  {
    id: "courage",
    title: "Courage Corner",
    status: "scaffolded", // planned world; try-it / bravery / growth-mindset challenges
  },
  {
    id: "aim",
    title: "Aim & Goals",
    status: "scaffolded", // planned goals/aim world; today's missions + journey are live
    // precursors, but a dedicated goal-setting game is not yet built.
  },

  // ── Additional live worlds (ids 15–17) ──────────────────────────────────
  {
    id: "faceMatch",
    title: "Face Match",
    status: "live",
    // src/components/practice/MimicMatch.tsx — on-device MediaPipe blendshape
    // expression mimicry; scores geometry only (not emotion inference); skip
    // affordance; star rating; fully privacy-gated (nothing leaves the device).
  },
  {
    id: "missions",
    title: "Development Missions",
    status: "live",
    // src/components/practice/MissionsTab.tsx (MissionsPanel) — 5-day mission
    // rotation, Fitbit-style Development Score (practice consistency, not
    // ability), streak, weekly focus from milestone gaps, copilot re-aim.
  },
  {
    id: "journey",
    title: "Practice Journey",
    status: "live",
    // src/components/practice/JourneyTab.tsx — weekly plan view, monthly
    // objectives, effort-badge achievements, historical domain-band snapshots.
  },
];

/** Convenience: just the world ids, for floor assertions like `WORLD_IDS.length >= 14`. */
export const WORLD_IDS: string[] = WORLDS.map((w) => w.id);
