/**
 * B-CAREPRO-33 · "Still true?" — the profile facts every Care document quotes
 * carry an as-of date.
 *
 * lane-LIVE #2: "Entering Bilingual Kindergarten in 3 months" sat on My Child,
 * Consult and the School Brief months after it stopped being true, because a
 * profile field had no date. `ChildProfile.factsAsOf` records WHEN the parent
 * last wrote (or confirmed) each quoted fact; ProfileEditDrawer stamps the
 * fields whose value changed, "Keep" stamps a confirmation, and Profile asks
 * "Still true?" once a fact is older than 90 days. The packet says
 * "Setting (as of {month})".
 *
 * Pure: no React, no Firebase.
 */

/** The profile fields a Care document quotes. */
export const FACT_FIELDS = ["schoolContext", "languages", "challenges", "strengths"] as const;
export type FactField = (typeof FACT_FIELDS)[number];
export type FactsAsOf = Partial<Record<FactField, string>>;

/** A fact older than this asks "Still true?". */
export const FACT_STALE_MS = 90 * 24 * 60 * 60 * 1000;

const norm = (v: unknown): string =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).join("\n") : typeof v === "string" ? v.trim() : "";

/**
 * The `factsAsOf` to write with a profile save: every quoted field whose value
 * CHANGED is stamped `nowIso`; unchanged fields keep their date (a save that
 * only renames the child does not make the school line "fresh").
 */
export function stampChangedFacts(
  prev: Partial<Record<FactField, unknown>> & { factsAsOf?: FactsAsOf },
  next: Partial<Record<FactField, unknown>>,
  nowIso: string,
): FactsAsOf {
  const out: FactsAsOf = { ...(prev.factsAsOf ?? {}) };
  for (const f of FACT_FIELDS) {
    if (!(f in next)) continue;
    if (norm(prev[f]) !== norm(next[f])) out[f] = nowIso;
  }
  return out;
}

/** "Keep" — the parent confirms one fact is still true today. */
export function confirmFact(prevAsOf: FactsAsOf | undefined, field: FactField, nowIso: string): FactsAsOf {
  return { ...(prevAsOf ?? {}), [field]: nowIso };
}

/** True when the fact has a date older than 90 days (no date = never asked:
 *  an undated fact predates this feature and is stamped on the next save). */
export function isFactStale(asOfIso: string | undefined, nowMs: number): boolean {
  if (!asOfIso) return false;
  const t = Date.parse(asOfIso);
  return Number.isFinite(t) && nowMs - t > FACT_STALE_MS;
}

/** "October 2026" / "אוקטובר 2026" — the as-of month in the reader's language. */
export function factMonthLabel(asOfIso: string, lang: "en" | "he"): string {
  const t = Date.parse(asOfIso);
  if (!Number.isFinite(t)) return "";
  try {
    return new Date(t).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  } catch {
    return new Date(t).toISOString().slice(0, 7);
  }
}
