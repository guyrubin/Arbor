/**
 * v3 EXTRA-FORYOU — the "Short reads" row on the For you, the parent hub.
 *
 * Input: the age-fit Learn reads in the hub's ranked order (the same signals
 * as today's read, the parent's open question included), today's read
 * already left out. Output: up to SHORT_READS_SIZE reads — the ones that meet
 * the question first, then the next ones in that same order — so the row is
 * full whenever the catalogue holds enough reads, with or without a question.
 *
 * Honesty: `forTopic` (the "for your question" title) only when the FIRST
 * read meets the question; `markMatched` asks the row to mark each read that
 * meets it when the row mixes both kinds. A read "meets" the question when
 * topicBoost lifts it (a shared word, or a word naming one of its concern
 * tags). Nothing here reads anything about the child.
 *
 * F-FORYOU-1 (the weekly concept): the concept the Scholar hub used to show
 * for the week can take the row's LAST slot. It never displaces a read that
 * meets the question: with three of those it stays out; otherwise the two
 * leading reads stay and the concept is third. The concept itself is chosen
 * by the hub (growth/scholarHub selectWeeklyArticle); this module only
 * places it, so it stays pure and catalogue-only.
 */
import { topicBoost, type LearnCard } from "./learnLibrary";

export const SHORT_READS_SIZE = 3;

export interface ShortReads<C = never> {
  reads: LearnCard[];
  /** The weekly concept, in the last slot, or null when it has no room. */
  concept: C | null;
  /** Ids of the reads in `reads` that meet the open question. */
  matched: ReadonlySet<string>;
  /** The first read meets the question (the row may say "for your question"). */
  forTopic: boolean;
  /** The row mixes reads that meet the question with reads (or the concept) that do not. */
  markMatched: boolean;
  /** Show the row: it answers the question, or it is full. */
  show: boolean;
}

export function pickShortReads<C = never>(
  ranked: readonly LearnCard[],
  topicText: string | null | undefined,
  weeklyConcept?: C | null,
): ShortReads<C> {
  const topic = (topicText ?? "").trim();
  const meets = (c: LearnCard) => topic.length > 0 && topicBoost(c, topic) > 0;
  const first = ranked.filter(meets);
  const firstIds = new Set(first.map((c) => c.id));
  // The concept has a slot only when the question does not fill the row.
  const concept = weeklyConcept != null && first.length < SHORT_READS_SIZE ? weeklyConcept : null;
  const readSlots = concept ? SHORT_READS_SIZE - 1 : SHORT_READS_SIZE;
  const reads = [...first, ...ranked.filter((c) => !firstIds.has(c.id))].slice(0, readSlots);
  const matched = new Set(reads.filter((c) => firstIds.has(c.id)).map((c) => c.id));
  const forTopic = reads.length > 0 && matched.has(reads[0].id);
  const size = reads.length + (concept ? 1 : 0);
  return {
    reads,
    concept,
    matched,
    forTopic,
    markMatched: forTopic && matched.size < size,
    show: forTopic || size >= SHORT_READS_SIZE,
  };
}
