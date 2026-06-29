/* Content + pure helpers for the three Hero Arcade worlds added in Wave D:
 * Pattern Power (logic), Beat Keeper (rhythm/regulation), Hero Pose (body
 * imitation). Data-driven and side-effect-free so the engine stays unit-testable
 * — components only render and log PracticeEvents. */

export interface PatternPuzzle {
  id: string;
  /** The visible run, ending just before the missing slot. */
  shown: string[];
  /** The glyph that correctly continues the pattern. */
  answer: string;
  /** Choices presented (includes the answer), shuffled at render time. */
  options: string[];
}

export const PATTERN_PUZZLES: PatternPuzzle[] = [
  { id: "p1", shown: ["🔴", "🔵", "🔴", "🔵"], answer: "🔴", options: ["🔴", "🔵", "🟡"] },
  { id: "p2", shown: ["⭐", "⭐", "⬛", "⭐", "⭐"], answer: "⬛", options: ["⬛", "⭐", "🔺"] },
  { id: "p3", shown: ["🟢", "🟡", "🔴", "🟢", "🟡"], answer: "🔴", options: ["🔴", "🟢", "🟡"] },
  { id: "p4", shown: ["🔺", "🔺", "🔵", "🔺", "🔺"], answer: "🔵", options: ["🔺", "🔵", "⭐"] },
  { id: "p5", shown: ["🌙", "⭐", "🌙", "⭐"], answer: "🌙", options: ["🌙", "⭐", "☀️"] },
  { id: "p6", shown: ["🟥", "🟦", "🟩", "🟥", "🟦"], answer: "🟩", options: ["🟩", "🟥", "🟦"] },
];

export interface PoseCard {
  id: string;
  name: string;
  emoji: string;
  cue: string;
}

export const POSE_CARDS: PoseCard[] = [
  { id: "star", name: "Star jump", emoji: "🌟", cue: "Arms and legs out wide like a star!" },
  { id: "strong", name: "Strong arms", emoji: "💪", cue: "Show me your strongest muscles!" },
  { id: "flamingo", name: "Flamingo", emoji: "🦩", cue: "Balance on one foot — wobbling is allowed!" },
  { id: "fly", name: "Hero fly", emoji: "🦸", cue: "One fist up high and fly like a hero!" },
  { id: "tree", name: "Tall tree", emoji: "🌳", cue: "Stand tall, arms up like branches." },
  { id: "seed", name: "Tiny seed", emoji: "🌱", cue: "Curl up small… then GROW up big!" },
];

export interface BeatRound {
  beats: number;
  intervalMs: number;
}

/** Tempo ramps up across rounds; gentle enough for a 5–8 year old. */
export const BEAT_ROUNDS: BeatRound[] = [
  { beats: 6, intervalMs: 900 },
  { beats: 8, intervalMs: 760 },
  { beats: 8, intervalMs: 640 },
];

/** Score a set of taps against the beat times they were aiming for, 0–100.
 * Each tap earns up to 100 by closeness to its nearest expected beat, within
 * `tolMs`; missing or extra taps simply don't earn. Pure + deterministic. */
export function scoreBeatTaps(expected: number[], taps: number[], tolMs = 320): number {
  if (expected.length === 0) return 0;
  const used = new Set<number>();
  let total = 0;
  for (const t of taps) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < expected.length; i++) {
      if (used.has(i)) continue;
      const d = Math.abs(t - expected[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx >= 0 && bestDist <= tolMs) {
      used.add(bestIdx);
      total += Math.round((1 - bestDist / tolMs) * 100);
    }
  }
  return Math.round(total / expected.length);
}

/** Map a 0–100 accuracy score to a 1–3 star rating (kind, never zero stars). */
export function gradeStars(score: number): number {
  if (score >= 80) return 3;
  if (score >= 50) return 2;
  return 1;
}
