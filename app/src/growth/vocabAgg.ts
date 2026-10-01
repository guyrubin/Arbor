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
 * B-GROWTH-14 — per-language counts in the PROFILE's languages, in profile
 * order, zeros included ("Russian 3 · Hebrew 0"). Any logged language the
 * profile no longer lists follows after, so no logged word disappears.
 * Never a share, never a ranking, never an assumption about which two
 * languages a family speaks.
 */
export function profileLangCounts(profileLanguages: readonly string[], counts: readonly LangCount[]): LangCount[] {
  const byLang = new Map(counts.map((c) => [c.language, c.count] as const));
  const listed = profileLanguages.map((l) => l.trim()).filter(Boolean);
  const out: LangCount[] = listed.map((language) => ({ language, count: byLang.get(language) ?? 0 }));
  for (const c of counts) if (!listed.includes(c.language)) out.push(c);
  return out;
}

/** One calendar month of logged words. `month` is 0-based (Date#getUTCMonth). */
export interface MonthCount {
  year: number;
  month: number;
  count: number;
}

/**
 * B-GROWTH-14 — words logged per calendar month (UTC), newest first, at most
 * `max` months (default 6). Months with nothing logged are omitted: this is a
 * plain list of what the parent wrote down, not a time series to read a curve
 * into.
 */
export function monthlyWordCounts(observations: readonly LangObservation[], max = 6): MonthCount[] {
  const map = new Map<string, MonthCount>();
  for (const o of observations) {
    const d = new Date(o.timestamp);
    if (Number.isNaN(d.getTime())) continue;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const key = `${year}-${month}`;
    const cur = map.get(key) ?? { year, month, count: 0 };
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .sort((a, b) => (b.year - a.year) || (b.month - a.month))
    .slice(0, Math.max(0, max));
}
