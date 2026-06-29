/**
 * AP-054 — Vocabulary aggregator for the Language Lab vocab view.
 *
 * Pure module: no I/O, no React, no side effects. All functions receive their
 * clock via an injected `nowMs` parameter so tests are fully deterministic.
 *
 * Design stance (per SLP board clearance + ASHA guidance, Core et al. 2013):
 *  - The COMBINED TOTAL across all languages is the meaningful number.
 *  - The per-language breakdown is SECONDARY neutral context (not a verdict).
 *  - No readiness score, percentile, or "catch up" framing is produced here.
 *  - "balance", "imbalance", "gap", "behind", "delay", "readiness",
 *    "screen", "assessment", "percentile" do not appear as output or concepts.
 */

export interface LangObservation {
  /** Firestore-collection document id (idempotent if the same phrase is
   *  logged again; or a unique timestamp-based id for each entry). */
  id: string;
  /** ISO-8601 timestamp the parent logged this. */
  timestamp: string;
  /** The language code as it appears in childProfile.languages[] — e.g.
   *  "Hebrew" or "English". Stored verbatim from the profile so no mapping
   *  step is needed and future language additions work without code changes. */
  language: string;
  /** The phrase/word the parent noted — free text, 1–120 chars. */
  phrase: string;
}

/** Per-language vocabulary count derived from logged observations. */
export interface LangCount {
  language: string;
  count: number;
}

/**
 * Aggregate logged phrase observations into per-language counts.
 *
 * Returns counts sorted descending by count (highest first) so the dominant
 * language is easy to lead with. Caller is responsible for the "combined
 * total leads" presentation rule.
 */
export function aggregateLangCounts(observations: LangObservation[]): LangCount[] {
  const map = new Map<string, number>();
  for (const obs of observations) {
    const lang = obs.language.trim();
    if (!lang) continue;
    map.set(lang, (map.get(lang) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);
}

/** Combined total across all languages. */
export function combinedTotal(counts: LangCount[]): number {
  return counts.reduce((s, c) => s + c.count, 0);
}

/**
 * Mix percentage for a single language: `lang.count / total * 100`, rounded
 * to the nearest integer. Returns 0 if total is 0.
 *
 * Naming: "mix %" — never "balance", "ratio", or "percentile".
 */
export function mixPct(langCount: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((langCount / total) * 100);
}

/** A single data point for the trend chart: date bucket + cumulative count. */
export interface TrendPoint {
  /** Human-readable label for the X axis, e.g. "Jun 1". */
  label: string;
  /** Cumulative observation count up to and including this bucket. */
  cumulativeTotal: number;
  /** Per-language cumulative counts keyed by language name. */
  byLanguage: Record<string, number>;
}

/**
 * Build a 90-day vocabulary growth trend in weekly buckets.
 *
 * Each bucket is a 7-day window; the last bucket covers the 7 days ending at
 * `nowMs`. Returns at most 13 points (13 weeks ≈ 91 days). Points are sorted
 * oldest-first for charting.
 *
 * The trend shows PER-LANGUAGE growth but NEVER characterizes one language as
 * "falling behind" — that framing is the caller's responsibility (and is
 * forbidden per the SLP board gate).
 */
export function buildVocabTrend(
  observations: LangObservation[],
  nowMs: number,
  windowDays = 90,
): TrendPoint[] {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const bucketCount = Math.ceil(windowDays / 7);
  const cutoff = nowMs - windowDays * 24 * 60 * 60 * 1000;

  // Collect all unique languages seen.
  const langs = [...new Set(observations.map((o) => o.language.trim()).filter(Boolean))];

  // Build bucket boundaries (oldest first).
  const buckets: { startMs: number; endMs: number; label: string }[] = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const endMs = nowMs - i * WEEK_MS;
    const startMs = endMs - WEEK_MS;
    const d = new Date(endMs);
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    buckets.push({ startMs, endMs, label });
  }

  // Sort observations by timestamp.
  const sorted = [...observations]
    .filter((o) => new Date(o.timestamp).getTime() >= cutoff)
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

  // Compute per-bucket incremental counts.
  const incrementalByBucket: Record<string, number>[] = buckets.map(() => ({}));
  for (const obs of sorted) {
    const ts = new Date(obs.timestamp).getTime();
    const lang = obs.language.trim();
    const idx = buckets.findIndex((b) => ts >= b.startMs && ts < b.endMs);
    if (idx >= 0) {
      incrementalByBucket[idx][lang] = (incrementalByBucket[idx][lang] ?? 0) + 1;
    }
  }

  // Convert to cumulative.
  const cumByLang: Record<string, number> = Object.fromEntries(langs.map((l) => [l, 0]));
  let cumTotal = 0;
  return buckets.map((bucket, i) => {
    const inc = incrementalByBucket[i];
    for (const lang of langs) {
      cumByLang[lang] = (cumByLang[lang] ?? 0) + (inc[lang] ?? 0);
    }
    cumTotal += Object.values(inc).reduce((s, v) => s + v, 0);
    return {
      label: bucket.label,
      cumulativeTotal: cumTotal,
      byLanguage: { ...cumByLang },
    };
  });
}
