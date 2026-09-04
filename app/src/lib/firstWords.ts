/* ════════════════════════════════════════════════════════════════════════════
   firstWords — GP-33: the first-words ledger.

   The Language Lab has been writing parent-logged phrases to the registered
   `langObs` child collection for months, and the child's RECORD never showed
   them: the surface contract for the language route still says
   threadWrite: "none", and the Lab itself leads with generic activity cards
   while the child's own words sit last on the page.

   A word a child said is a keepsake — a phrase and the day it was first
   written down — not an aggregate. This module turns the raw observation sink
   into that ledger: newest first, one row per DISTINCT phrase (a phrase logged
   again keeps its FIRST date, which is the whole point of "first words"), plus
   the two counts the hub can honestly show.

   CLINICAL FIREWALL: counts, phrases and dates only. No vocabulary size
   expectation, no per-language mix percentage, no comparison to any norm, no
   "should be saying N words by now". growth/vocabAgg owns the Lab's own
   aggregate view; this module deliberately re-derives nothing from it.

   Pure, clock-injected, no React — unit-testable in the node suite.
   ════════════════════════════════════════════════════════════════════════════ */
import type { LangObservation } from "../growth/vocabAgg";

export interface FirstWordRow {
  /** The observation id that first recorded this phrase. */
  id: string;
  /** The phrase exactly as the parent typed it. */
  phrase: string;
  /** The language name exactly as it appears in childProfile.languages[]. */
  language: string;
  /** ISO timestamp of the FIRST time this phrase was written down. */
  firstLoggedAt: string;
}

export interface FirstWordsLedger {
  /** Distinct phrases, newest FIRST-logged first. */
  rows: FirstWordRow[];
  /** Number of distinct phrases in the record. */
  wordCount: number;
  /** Number of distinct languages those phrases were logged in. */
  languageCount: number;
}

const clean = (s: string | undefined): string => (typeof s === "string" ? s.trim() : "");

/** Case- and whitespace-insensitive identity for "the same phrase again". */
const phraseKey = (phrase: string, language: string): string =>
  `${language.toLocaleLowerCase()}::${phrase.replace(/\s+/g, " ").toLocaleLowerCase()}`;

/**
 * Fold the raw `langObs` sink into the ledger. Observations with an empty
 * phrase or language are dropped (the Lab's own writer already guards this;
 * legacy rows may not). A phrase logged more than once collapses to its
 * EARLIEST timestamp — that is the date the record should keep.
 */
export function buildFirstWordsLedger(
  observations: readonly LangObservation[],
  limit = 6,
): FirstWordsLedger {
  const byPhrase = new Map<string, FirstWordRow>();
  for (const obs of observations) {
    const phrase = clean(obs?.phrase);
    const language = clean(obs?.language);
    const at = clean(obs?.timestamp);
    if (!phrase || !language || !at) continue;
    const key = phraseKey(phrase, language);
    const existing = byPhrase.get(key);
    if (!existing || new Date(at).getTime() < new Date(existing.firstLoggedAt).getTime()) {
      byPhrase.set(key, { id: clean(obs.id) || key, phrase, language, firstLoggedAt: at });
    }
  }
  const all = [...byPhrase.values()].sort(
    (a, b) => new Date(b.firstLoggedAt).getTime() - new Date(a.firstLoggedAt).getTime(),
  );
  return {
    rows: limit > 0 ? all.slice(0, limit) : all,
    wordCount: all.length,
    languageCount: new Set(all.map((r) => r.language.toLocaleLowerCase())).size,
  };
}
