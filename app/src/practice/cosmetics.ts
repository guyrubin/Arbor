/* Avatar progression cosmetics (PRD A5) — gentle rewards EARNED through
 * development play, never bought, never streak-shamed. Each cosmetic unlocks at a
 * declarative threshold on a practice signal, so the engine is pure + unit-testable
 * and the UI just renders what's unlocked. Framing is celebration, not pressure:
 * locked items show "keep playing", never a loss or a countdown.
 *
 * KID-02 (lane K): every CosmeticStats field is LIFETIME-MONOTONIC. The old
 * `domainsTouched` was a 7-day breadth window, so the Explorer / All-rounder
 * badges were earned one week and GONE the next — the exact loss-aversion the
 * no-streak doctrine forbids (achievements.ts: "No badge here may ever be
 * earned-then-lost"). Weekly breadth stays a PARENT-side signal
 * (signals.developmentScore); it is no longer a valid cosmetic metric — the
 * allow-list in cosmeticsFirewall.test.ts (MONOTONIC_METRICS) and the
 * monotonicity property test pin this. */
import type { AdventureResult, MimicSession, MissionRecord, PracticeDomain, PracticeEvent, SpeechAttempt } from "../types";

export type CosmeticKind = "frame" | "badge" | "title";

export interface CosmeticStats {
  /** Lifetime practice interactions across all modules. Monotonic. */
  totalSessions: number;
  /** Lifetime count of distinct days the child has practiced. MONOTONIC —
   *  never resets, never decreases. The child-safe consistency signal that
   *  replaced the old consecutive-day streak (no loss-aversion, no streak-shame). */
  daysPracticed: number;
  /** Lifetime count of distinct developmental domains EVER touched across all
   *  ledgers (0–5). MONOTONIC — a domain, once played, stays counted forever. */
  domainsEverTouched: number;
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
  { id: "explorer-badge", kind: "badge", label: "Explorer", emoji: "🧭", metric: "domainsEverTouched", threshold: 3, requirement: "Play in 3 different areas" },
  { id: "steady-title", kind: "title", label: "Steady", emoji: "🪴", metric: "daysPracticed", threshold: 3, requirement: "Practice on 3 different days" },
  { id: "bloom-frame", kind: "frame", label: "Bloom", emoji: "🌸", metric: "totalSessions", threshold: 10, requirement: "Complete 10 activities" },
  { id: "allrounder-badge", kind: "badge", label: "All-rounder", emoji: "🌈", metric: "domainsEverTouched", threshold: 5, requirement: "Play in all 5 areas" },
  { id: "devoted-title", kind: "title", label: "Devoted", emoji: "💛", metric: "daysPracticed", threshold: 7, requirement: "Practice on 7 different days" },
  { id: "star-frame", kind: "frame", label: "Star", emoji: "⭐", metric: "totalSessions", threshold: 25, requirement: "Complete 25 activities" },
  { id: "tree-frame", kind: "frame", label: "Mighty tree", emoji: "🌳", metric: "totalSessions", threshold: 50, requirement: "Complete 50 activities" },
];

/** The ledgers `lifetimeDomains` reads (a structural subset of usePracticeData). */
export interface LifetimeLedgers {
  speech: Pick<SpeechAttempt, "id">[];
  mimic: Pick<MimicSession, "id">[];
  adventures: Pick<AdventureResult, "id">[];
  events: Pick<PracticeEvent, "domain">[];
  missions: Pick<MissionRecord, "domain" | "completed">[];
}

/**
 * KID-02: the distinct developmental domains ever touched, from ALL ledgers.
 * Speech attempts and Mimic rounds are speech-domain play; adventures are
 * cognition; practice events and completed missions carry their own domain.
 * Pure and order-free — only ever grows as ledgers grow.
 */
export function lifetimeDomains(l: LifetimeLedgers): PracticeDomain[] {
  const out = new Set<PracticeDomain>();
  if (l.speech.length > 0 || l.mimic.length > 0) out.add("speech");
  if (l.adventures.length > 0) out.add("cognition");
  for (const e of l.events) out.add(e.domain);
  for (const m of l.missions) if (m.completed) out.add(m.domain);
  return [...out];
}

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
