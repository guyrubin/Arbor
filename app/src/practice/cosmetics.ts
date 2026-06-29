/* Avatar progression cosmetics (PRD A5) — gentle rewards EARNED through
 * development play, never bought, never streak-shamed. Each cosmetic unlocks at a
 * declarative threshold on a practice signal, so the engine is pure + unit-testable
 * and the UI just renders what's unlocked. Framing is celebration, not pressure:
 * locked items show "keep playing", never a loss or a countdown. */

export type CosmeticKind = "frame" | "badge" | "title";

export interface CosmeticStats {
  /** Lifetime practice interactions across all modules. Monotonic. */
  totalSessions: number;
  /** Lifetime count of distinct days the child has practiced. MONOTONIC —
   *  never resets, never decreases. The child-safe consistency signal that
   *  replaced the old consecutive-day streak (no loss-aversion, no streak-shame). */
  daysPracticed: number;
  /** Distinct developmental domains touched this week (0–5). */
  domainsTouched: number;
}

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  label: string;
  emoji: string;
  metric: keyof CosmeticStats;
  threshold: number;
  requirement: string;
}

/** Ordered easiest → most committed. Thresholds are gentle and reachable. */
export const COSMETICS: Cosmetic[] = [
  { id: "sprout-frame", kind: "frame", label: "Sprout", emoji: "🌱", metric: "totalSessions", threshold: 1, requirement: "Try your first activity" },
  { id: "explorer-badge", kind: "badge", label: "Explorer", emoji: "🧭", metric: "domainsTouched", threshold: 3, requirement: "Play across 3 areas in a week" },
  { id: "steady-title", kind: "title", label: "Steady", emoji: "🪴", metric: "daysPracticed", threshold: 3, requirement: "Practice on 3 different days" },
  { id: "bloom-frame", kind: "frame", label: "Bloom", emoji: "🌸", metric: "totalSessions", threshold: 10, requirement: "Complete 10 activities" },
  { id: "allrounder-badge", kind: "badge", label: "All-rounder", emoji: "🌈", metric: "domainsTouched", threshold: 5, requirement: "Play across all 5 areas in a week" },
  { id: "devoted-title", kind: "title", label: "Devoted", emoji: "💛", metric: "daysPracticed", threshold: 7, requirement: "Practice on 7 different days" },
  { id: "star-frame", kind: "frame", label: "Star", emoji: "⭐", metric: "totalSessions", threshold: 25, requirement: "Complete 25 activities" },
  { id: "tree-frame", kind: "frame", label: "Mighty tree", emoji: "🌳", metric: "totalSessions", threshold: 50, requirement: "Complete 50 activities" },
];

export interface CosmeticProgress {
  cosmetic: Cosmetic;
  /** How far toward the threshold, 0–1. */
  progress: number;
  remaining: number;
}

export interface CosmeticState {
  unlocked: Cosmetic[];
  locked: Cosmetic[];
  /** The closest not-yet-earned reward (smallest remaining), or null when all earned. */
  next: CosmeticProgress | null;
  /** The "best" earned frame to wear (last unlocked frame), or null. */
  activeFrame: Cosmetic | null;
}

const isUnlocked = (c: Cosmetic, s: CosmeticStats) => s[c.metric] >= c.threshold;

/** Evaluate which cosmetics the child has earned, and the nearest next one. */
export function evaluateCosmetics(stats: CosmeticStats, catalog: Cosmetic[] = COSMETICS): CosmeticState {
  const unlocked = catalog.filter((c) => isUnlocked(c, stats));
  const locked = catalog.filter((c) => !isUnlocked(c, stats));

  const next = locked
    .map((c) => {
      const remaining = Math.max(0, c.threshold - stats[c.metric]);
      return { cosmetic: c, remaining, progress: Math.min(1, stats[c.metric] / c.threshold) };
    })
    .sort((a, b) => a.remaining - b.remaining || b.progress - a.progress)[0] ?? null;

  const frames = unlocked.filter((c) => c.kind === "frame");
  const activeFrame = frames.length ? frames[frames.length - 1] : null;

  return { unlocked, locked, next, activeFrame };
}
