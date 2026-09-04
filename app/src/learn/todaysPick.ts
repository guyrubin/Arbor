/**
 * LC-04 — "Today's pick" for the Learn hub.
 *
 * The hub's ONE move used to be `catalog.find((m) => !done[m.id])`: the first
 * unfinished course in FILE ORDER. Every parent got the same course, forever,
 * and the real explainable ranking (`learn/learnLibrary.rankLearnCards` — age,
 * focus domain, observed concerns, the parent's own pulse, saved topics) lived
 * one pill away in the Learn Library.
 *
 * This module is the ranking, mounted on the hub. It is PURE and deterministic:
 *
 *  · the pick is drawn from the AGE-VISIBLE catalogue only — a card the parent
 *    cannot see in the library can never be "today's pick";
 *  · cards are scored by the SAME `learnCardScore` + saved-topic boost the
 *    library rail uses (one ranking, no fork);
 *  · ties are broken by a per-day seed (`childId` + `YYYY-MM-DD`), so the pick
 *    is stable for the whole day and rotates tomorrow without any stored state.
 *
 * CLINICAL FIREWALL: nothing here reads or emits a score about the child. The
 * ranking signals are the parent's own inputs (age band, what they logged, what
 * they saved, what they marked helpful) and the output is one editorial read.
 */
import {
  SAVED_TOPIC_BOOST,
  continuesSaved,
  learnCardScore,
  learnContinuationTopics,
  type LearnCard,
  type LearnRankSignals,
} from "./learnLibrary";

/** UTC day key (YYYY-MM-DD) — the day half of the tiebreak seed. */
export function pickDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Cards inside the child's age window. STRICT window (not the ±1 year the
 * score is generous with) — the hub promises one read for *this* child today.
 * Unknown age (null) → the whole catalogue, and an empty result degrades to
 * the whole catalogue rather than to no pick at all.
 */
export function ageVisibleLearnCards(cards: LearnCard[], ageYears: number | null): LearnCard[] {
  if (ageYears == null) return cards;
  const inBand = cards.filter((c) => ageYears >= c.ageMin && ageYears <= c.ageMax);
  return inBand.length > 0 ? inBand : cards;
}

/**
 * FNV-1a over `${childId}|${dayKey}` — a stable, dependency-free 32-bit seed.
 * Same child + same day → same number, in every process and every locale.
 */
export function pickSeed(childId: string, dayKey: string): number {
  let hash = 0x811c9dc5;
  const input = `${childId}|${dayKey}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface TodaysPickOptions {
  childId: string;
  /** UTC day key from `pickDayKey` — the caller owns "now". */
  dayKey: string;
}

export interface TodaysPickResult {
  card: LearnCard;
  /** How many cards shared the winning score (the seed chose among these). */
  tied: number;
  /** True when the parent's observed concerns contributed to the winning score. */
  fromConcerns: boolean;
  /** True when a saved/finished read's topic boosted the winning card. */
  fromSaved: boolean;
}

/**
 * Today's read: the top-ranked age-visible card, ties broken by the per-day
 * seed. Returns null only when the catalogue itself is empty.
 */
export function todaysLearnPick(
  cards: LearnCard[],
  signals: LearnRankSignals,
  opts: TodaysPickOptions
): TodaysPickResult | null {
  const visible = ageVisibleLearnCards(cards, signals.ageYears);
  if (visible.length === 0) return null;

  const topics = learnContinuationTopics(cards, signals);
  const scored = visible.map((card) => ({
    card,
    score: learnCardScore(card, signals) + (continuesSaved(card, topics) ? SAVED_TOPIC_BOOST : 0),
  }));
  const best = scored.reduce((max, e) => (e.score > max ? e.score : max), -Infinity);
  const winners = scored.filter((e) => e.score === best).map((e) => e.card);

  const card = winners[pickSeed(opts.childId, opts.dayKey) % winners.length];
  const concerns = signals.recentConcerns ?? [];
  return {
    card,
    tied: winners.length,
    // Only claim a signal that actually moved this card: the concern overlap is
    // re-derived here rather than asserted, so the why-line can never overstate.
    fromConcerns:
      concerns.length > 0 && learnCardScore(card, signals) > learnCardScore(card, { ...signals, recentConcerns: [] }),
    fromSaved: continuesSaved(card, topics),
  };
}
