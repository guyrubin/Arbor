import { isPublishableContent, type ContentConcern } from "./governance";
import { hardMomentCards, type HardMomentCard, type HardMomentCategory } from "./hardMomentCards";

/**
 * CONT-6 (AR-CAP-07) — the pure search/recommendation API over the governed
 * hard-moment schema. This is what the AR-CONT-01 surfaces (Behaviors / Today /
 * Ask Arbor) and the future AR-CAP-06 routing consume.
 *
 * FAIL-CLOSED: every selector filters through isPublishableContent at call
 * time, so a draft or retired record is NEVER returned — the whole module goes
 * dark until named clinical review stamps the pack (GD-10).
 */

function publishable(cards: HardMomentCard[], now: Date): HardMomentCard[] {
  return cards.filter((card) => isPublishableContent(card, now));
}

/** Published cards for one hard-moment category, in authored order. */
export function byCategory(
  category: HardMomentCategory,
  cards: HardMomentCard[] = hardMomentCards,
  now: Date = new Date(),
): HardMomentCard[] {
  return publishable(cards, now).filter((card) => card.category === category);
}

/** Published cards tagged with one parent-concern, in authored order. */
export function byConcern(
  concern: ContentConcern,
  cards: HardMomentCard[] = hardMomentCards,
  now: Date = new Date(),
): HardMomentCard[] {
  return publishable(cards, now).filter((card) => card.concerns.includes(concern));
}

/**
 * Keyword → concern routing for free-text behavior-log types ("Transition
 * Refusal", "Sibling Conflict", …). Internal metadata only — matching is
 * case-insensitive substring over the lowercased behavior string.
 */
const BEHAVIOR_KEYWORD_CONCERNS: [string, ContentConcern][] = [
  ["transition", "transitions"],
  ["change", "transitions"],
  ["screen", "screens"],
  ["sibling", "peer-conflict"],
  ["peer", "peer-conflict"],
  ["friend", "peer-conflict"],
  ["teas", "peer-conflict"],
  ["food", "food"],
  ["meal", "food"],
  ["eat", "food"],
  ["sleep", "sleep"],
  ["bedtime", "sleep"],
  ["night", "sleep"],
  ["hit", "aggression"],
  ["kick", "aggression"],
  ["bite", "aggression"],
  ["push", "aggression"],
  ["aggress", "aggression"],
  ["separation", "separation"],
  ["drop-off", "separation"],
  ["dropoff", "separation"],
  ["goodbye", "separation"],
  ["cling", "separation"],
  ["attention", "attention"],
  ["listen", "attention"],
  ["focus", "attention"],
  ["fear", "fears"],
  ["afraid", "fears"],
  ["scared", "fears"],
  ["meltdown", "regulation"],
  ["tantrum", "regulation"],
  ["sensory", "regulation"],
  ["overload", "regulation"],
  ["whin", "regulation"],
  ["morning", "routines"],
  ["dress", "routines"],
  ["bath", "routines"],
  ["teeth", "routines"],
  ["routine", "routines"],
];

/** Map free-text behavior-log categories to the controlled concern vocabulary. */
export function concernsForBehaviors(behaviorCategories: string[]): ContentConcern[] {
  const matched = new Set<ContentConcern>();
  for (const raw of behaviorCategories) {
    const text = raw.toLowerCase();
    for (const [keyword, concern] of BEHAVIOR_KEYWORD_CONCERNS) {
      if (text.includes(keyword)) matched.add(concern);
    }
  }
  return Array.from(matched);
}

/**
 * Rank published cards against recent behavior-log categories: score = number
 * of matched concerns a card carries (moment/id match adds one), highest
 * first, authored order as the tiebreak. Cards with no overlap are omitted;
 * draft/retired records never appear regardless of match strength.
 */
export function matchToRecentBehaviors(
  behaviorCategories: string[],
  cards: HardMomentCard[] = hardMomentCards,
  now: Date = new Date(),
): HardMomentCard[] {
  const concerns = concernsForBehaviors(behaviorCategories);
  if (concerns.length === 0) return [];
  const loweredBehaviors = behaviorCategories.map((b) => b.toLowerCase());
  return publishable(cards, now)
    .map((card, index) => {
      let score = card.concerns.filter((c) => concerns.includes(c)).length;
      const moment = (card.moment ?? card.id).toLowerCase();
      if (loweredBehaviors.some((b) => b.includes(moment))) score += 1;
      return { card, index, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.card);
}
