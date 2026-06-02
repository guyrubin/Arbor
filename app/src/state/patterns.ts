import type { BehaviorLog } from "../types";

/**
 * K-09 — Longitudinal pattern detection (the "notices before the parent does"
 * moment). Deterministic and side-effect free so it is unit testable without a
 * model. Small on purpose: flag the few things worth a parent's attention, not
 * a wall of charts.
 */

export type Pattern = {
  kind: "frequent" | "rising" | "recurring_trigger";
  title: string;
  detail: string;
  severity: "info" | "watch";
};

const mean = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

const STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "and", "or", "in", "on", "at", "for", "with", "was", "is",
  "being", "told", "asked", "when", "his", "her", "their", "they", "it", "that", "this", "off"
]);

const keywords = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));

export const detectPatterns = (logs: BehaviorLog[]): Pattern[] => {
  if (logs.length < 3) return [];
  const patterns: Pattern[] = [];

  // 1. Most frequent behavior type.
  const counts = new Map<string, number>();
  for (const log of logs) counts.set(log.behaviorType, (counts.get(log.behaviorType) || 0) + 1);
  const [topType, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  if (topCount >= 3) {
    const share = Math.round((topCount / logs.length) * 100);
    patterns.push({
      kind: "frequent",
      title: `${topType} keeps coming up`,
      detail: `${topCount} of the last ${logs.length} logged moments (${share}%) were ${topType.toLowerCase()}.`,
      severity: share >= 50 ? "watch" : "info"
    });
  }

  // 2. Rising intensity over time (oldest → newest).
  const chronological = [...logs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (chronological.length >= 4) {
    const half = Math.floor(chronological.length / 2);
    const earlier = mean(chronological.slice(0, half).map((l) => l.intensity));
    const later = mean(chronological.slice(half).map((l) => l.intensity));
    if (later - earlier >= 0.75) {
      patterns.push({
        kind: "rising",
        title: "Intensity has been climbing",
        detail: `Average intensity rose from ${earlier.toFixed(1)} to ${later.toFixed(1)} across recent logs. Worth a calm look at what changed.`,
        severity: "watch"
      });
    }
  }

  // 3. A trigger keyword that recurs across multiple logs.
  const keywordCounts = new Map<string, number>();
  for (const log of logs) {
    const seen = new Set(keywords(log.trigger));
    for (const word of seen) keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
  }
  const [topWord, wordCount] = [...keywordCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  if (wordCount >= 3) {
    patterns.push({
      kind: "recurring_trigger",
      title: `"${topWord}" shows up a lot`,
      detail: `The word "${topWord}" appears in the trigger for ${wordCount} logged moments — a possible common thread.`,
      severity: "info"
    });
  }

  return patterns;
};
