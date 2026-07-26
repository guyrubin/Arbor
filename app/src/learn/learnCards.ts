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

export const LEARN_CARDS: LearnCard[] = [
  ...LEARN_CARDS_CORE,
  ...LEARN_CARDS_MORE,
  ...LEARN_CARDS_BATCH2A,
  ...LEARN_CARDS_BATCH2B,
  ...LEARN_CARDS_BATCH2C,
];

export const learnCardById = (id: string): LearnCard | undefined =>
  LEARN_CARDS.find((c) => c.id === id);
