/**
 * Learn Library — assembled seed catalogue (P1: 20 cards, 2 per shelf).
 * Batches stay separate files so authoring waves land as additive diffs.
 */
import type { LearnCard } from "./learnLibrary";
import { LEARN_CARDS_CORE } from "./learnCardsCore";
import { LEARN_CARDS_MORE } from "./learnCardsMore";

export const LEARN_CARDS: LearnCard[] = [...LEARN_CARDS_CORE, ...LEARN_CARDS_MORE];

export const learnCardById = (id: string): LearnCard | undefined =>
  LEARN_CARDS.find((c) => c.id === id);
