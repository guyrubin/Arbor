import type { ContentConcern, ContentLocale } from "./governance";
import { hardMomentCards, type HardMomentCard, type HardMomentCategory } from "./hardMomentCards";
import { fitsHardMomentAge, hardMomentPublication, type HardMomentContext, type PilotRelease } from "./pilotRelease";

/** Call-time selection; unknown age/locale never opts a family into the pilot. */
export const inAgeBand = fitsHardMomentAge;

export function availableHardMomentCards(context: HardMomentContext, cards: HardMomentCard[] = hardMomentCards): HardMomentCard[] {
  return cards.filter((card) => hardMomentPublication(card, context) !== null);
}

export function byCategory(
  category: HardMomentCategory, cards: HardMomentCard[] = hardMomentCards,
  now = new Date(), ageMonths?: number | null, locale: ContentLocale = "en", release?: PilotRelease,
): HardMomentCard[] {
  return availableHardMomentCards({ now, ageMonths, locale, release }, cards).filter((card) => card.category === category);
}

export function byConcern(
  concern: ContentConcern, cards: HardMomentCard[] = hardMomentCards,
  now = new Date(), ageMonths?: number | null, locale: ContentLocale = "en", release?: PilotRelease,
): HardMomentCard[] {
  return availableHardMomentCards({ now, ageMonths, locale, release }, cards).filter((card) => card.concerns.includes(concern));
}

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
  ["מכות", "aggression"], ["בעיטות", "aggression"], ["פגיעה", "aggression"],
  ["שינה", "sleep"], ["מסך", "screens"], ["אוכל", "food"], ["ארוחה", "food"],
  ["פרידה", "separation"], ["היצמדות", "separation"], ["פחד", "fears"],
  ["סערה", "regulation"], ["זעם", "regulation"], ["מעבר", "transitions"],
  ["שינוי", "transitions"], ["אחים", "peer-conflict"], ["שיתוף", "peer-conflict"],
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

/** Deterministic concern matching, never a clinical inference about a child. */
export function matchToRecentBehaviors(
  behaviorCategories: string[], cards: HardMomentCard[] = hardMomentCards,
  now = new Date(), ageMonths?: number | null, locale: ContentLocale = "en", release?: PilotRelease,
): HardMomentCard[] {
  const concerns = concernsForBehaviors(behaviorCategories);
  if (concerns.length === 0) return [];
  const loweredBehaviors = behaviorCategories.map((b) => b.toLowerCase());
  return availableHardMomentCards({ now, ageMonths, locale, release }, cards)
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
