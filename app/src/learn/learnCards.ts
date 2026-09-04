/**
 * Learn Library — assembled seed catalogue (P1: 20 cards, 2 per shelf).
 * Batches stay separate files so authoring waves land as additive diffs.
 */
import type { LearnCard } from "./learnLibrary";
import { LEARN_CARDS_CORE } from "./learnCardsCore";
import { LEARN_CARDS_MORE } from "./learnCardsMore";
import { LEARN_CARDS_BATCH2A } from "./learnCardsBatch2a";
import { LEARN_CARDS_BATCH2B } from "./learnCardsBatch2b";
import { LEARN_CARDS_BATCH2C } from "./learnCardsBatch2c";
import { LEARN_CARDS_BATCH3A } from "./learnCardsBatch3a";
import { LEARN_CARDS_BATCH3B } from "./learnCardsBatch3b";
import { LEARN_CARDS_BATCH3C } from "./learnCardsBatch3c";
import { LEARN_CARDS_BATCH4A } from "./learnCardsBatch4a";
import { LEARN_CARDS_BATCH4B } from "./learnCardsBatch4b";
import { publishedLearnPilotCards } from "./learnPilotRelease";

/**
 * Batch 4 ships under the editorial pilot, so it is assembled THROUGH the
 * release contract rather than spread in directly. Every Learn consumer reads
 * this one registry, so a card that fails the contract — withdrawn, expired,
 * edited away from its pinned digest, or missing Hebrew — is unreachable
 * everywhere at once, with no second code path to disagree.
 *
 * The window is evaluated when this module is first imported. That is the
 * intended granularity for a months-long pilot: a running session keeps the
 * catalogue it started with, and the next load re-evaluates.
 */
const LEARN_CARDS_PILOT = publishedLearnPilotCards([...LEARN_CARDS_BATCH4A, ...LEARN_CARDS_BATCH4B]);

export const LEARN_CARDS: LearnCard[] = [
  ...LEARN_CARDS_CORE,
  ...LEARN_CARDS_MORE,
  ...LEARN_CARDS_BATCH2A,
  ...LEARN_CARDS_BATCH2B,
  ...LEARN_CARDS_BATCH2C,
  ...LEARN_CARDS_BATCH3A,
  ...LEARN_CARDS_BATCH3B,
  ...LEARN_CARDS_BATCH3C,
  ...LEARN_CARDS_PILOT,
];

export const learnCardById = (id: string): LearnCard | undefined =>
  LEARN_CARDS.find((c) => c.id === id);
