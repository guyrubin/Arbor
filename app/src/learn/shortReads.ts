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
 */
import { topicBoost, type LearnCard } from "./learnLibrary";

export const SHORT_READS_SIZE = 3;

export interface ShortReads {
  reads: LearnCard[];
  /** Ids of the reads in `reads` that meet the open question. */
  matched: ReadonlySet<string>;
  /** The first read meets the question (the row may say "for your question"). */
  forTopic: boolean;
  /** The row mixes reads that meet the question with reads that do not. */
  markMatched: boolean;
  /** Show the row: it answers the question, or it is full. */
  show: boolean;
}

export function pickShortReads(ranked: readonly LearnCard[], topicText: string | null | undefined): ShortReads {
  const topic = (topicText ?? "").trim();
  const meets = (c: LearnCard) => topic.length > 0 && topicBoost(c, topic) > 0;
  const first = ranked.filter(meets);
  const firstIds = new Set(first.map((c) => c.id));
  const reads = [...first, ...ranked.filter((c) => !firstIds.has(c.id))].slice(0, SHORT_READS_SIZE);
  const matched = new Set(reads.filter((c) => firstIds.has(c.id)).map((c) => c.id));
  const forTopic = reads.length > 0 && matched.has(reads[0].id);
  return {
    reads,
    matched,
    forTopic,
    markMatched: forTopic && matched.size < reads.length,
    show: forTopic || reads.length >= SHORT_READS_SIZE,
  };
}
