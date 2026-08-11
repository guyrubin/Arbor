/**
 * Learn Library — Arbor's browsable developmental-education layer (Academy).
 *
 * One content atom (LearnCard) in the clarity+capture shape: 5 key points a
 * parent can scan in 30 seconds, a full read behind them, one thing to try
 * today, and a coach seam. Static curated catalogue — no AI call at browse
 * time, no child-data write (saving a bookmark stores the card id only).
 *
 * Design rules (binding, inherited from Scholar Hub AP-055):
 *  - General developmental education only. No per-child claim, no outcome
 *    statement, no effect-size assertion, no diagnosis-shaped copy.
 *  - Wide-normal ranges are stated as ranges; "when to ask a professional"
 *    copy routes to guidance, never to verdicts.
 *  - Personalization is explainable in one sentence: the child's age band and
 *    the Development Map focus domain (framed as an opportunity, never a
 *    deficit) float matching cards up. Nothing else is inferred.
 */
import type { ContentConcern, LocalizedText } from "../content/governance";

export type LearnCategoryId =
  | "minds"
  | "language"
  | "feelings"
  | "behavior"
  | "sleep"
  | "play"
  | "screens"
  | "eating"
  | "motion"
  | "parent";

export interface LearnCategory {
  id: LearnCategoryId;
  label: LocalizedText;
  /** Material Symbols Rounded ligature for chips and hero bands. */
  msIcon: string;
  /** PASTEL tone key (lib/tokens.ts) — soft/ink tint pair for this shelf. */
  tone: "mint" | "coral" | "lav" | "yellow" | "pink" | "sky";
  /** framework.json domain ids this shelf nurtures (Development Map link). */
  domains: string[];
}

export interface LearnCard {
  id: string;
  category: LearnCategoryId;
  /** framework.json domain ids — used for focus-domain ranking. */
  domains: string[];
  /** Inclusive age window in whole years (display + ranking only, wide-normal). */
  ageMin: number;
  ageMax: number;
  /** Invitational reading-time indicator only. */
  minutes: number;
  title: LocalizedText;
  /** One-line hook shown on the grid card. */
  hook: LocalizedText;
  /** Exactly five scannable key points — the 30-second read. */
  keyPoints: LocalizedText[];
  /** Full read — editorial paragraphs separated by \n\n. */
  body: LocalizedText;
  /** One concrete, low-effort thing to try today. */
  tryToday: LocalizedText;
  /** Coach composer seed — a question, in the parent's voice. */
  ask: LocalizedText;
  /**
   * Optional ContentConcern tags (governance vocabulary) bridging this card to
   * behavior-log and hard-moment surfaces. Defaults to the category's tags via
   * cardConcerns() — set only when a card is narrower than its shelf.
   */
  concerns?: ContentConcern[];
}

/** Shelf-level concern defaults (governance vocabulary; observational tags). */
const CATEGORY_CONCERNS: Record<LearnCategoryId, ContentConcern[]> = {
  minds: ["attention"],
  language: [],
  feelings: ["regulation", "separation", "fears"],
  behavior: ["aggression", "transitions", "regulation"],
  sleep: ["sleep", "routines"],
  play: ["attention", "peer-conflict"],
  screens: ["screens"],
  eating: ["food", "routines"],
  motion: [],
  parent: ["regulation"],
};

/** A card's effective concern tags: explicit tags, else its shelf's defaults. */
export const cardConcerns = (card: LearnCard): ContentConcern[] =>
  card.concerns ?? CATEGORY_CONCERNS[card.category];

/** Bookmark record — the card id only; no child data beyond the reference. */
export interface SavedLearnItem {
  id: string;
  savedAt: string;
}

export const LEARN_CATEGORIES: LearnCategory[] = [
  {
    id: "minds",
    label: { en: "Growing Minds", he: "מוח מתפתח" },
    msIcon: "psychology",
    tone: "lav",
    domains: ["cognition_executive_function"],
  },
  {
    id: "language",
    label: { en: "Language & Communication", he: "שפה ותקשורת" },
    msIcon: "forum",
    tone: "sky",
    domains: ["language_communication"],
  },
  {
    id: "feelings",
    label: { en: "Big Feelings", he: "רגשות גדולים" },
    msIcon: "favorite",
    tone: "pink",
    domains: ["attachment_regulation"],
  },
  {
    id: "behavior",
    label: { en: "Behavior & Limits", he: "התנהגות וגבולות" },
    msIcon: "balance",
    tone: "coral",
    domains: ["attachment_regulation", "independence_adaptive_skills"],
  },
  {
    id: "sleep",
    label: { en: "Sleep", he: "שינה" },
    msIcon: "bedtime",
    tone: "mint",
    domains: ["independence_adaptive_skills"],
  },
  {
    id: "play",
    label: { en: "Play & Learning", he: "משחק ולמידה" },
    msIcon: "toys",
    tone: "yellow",
    domains: ["cognition_executive_function", "social_development"],
  },
  {
    id: "screens",
    label: { en: "Screens & Digital", he: "מסכים ודיגיטל" },
    msIcon: "devices",
    tone: "sky",
    domains: ["ecosystem_stressors"],
  },
  {
    id: "eating",
    label: { en: "Eating & Growing", he: "אכילה וגדילה" },
    msIcon: "restaurant",
    tone: "coral",
    domains: ["independence_adaptive_skills"],
  },
  {
    id: "motion",
    label: { en: "Body & Motion", he: "גוף ותנועה" },
    msIcon: "directions_run",
    tone: "mint",
    domains: ["sensory_motor_patterns"],
  },
  {
    id: "parent",
    label: { en: "The Parent", he: "ההורה" },
    msIcon: "self_improvement",
    tone: "lav",
    domains: ["ecosystem_stressors", "attachment_regulation"],
  },
];

export const learnCategoryById = (id: LearnCategoryId): LearnCategory =>
  LEARN_CATEGORIES.find((c) => c.id === id) ?? LEARN_CATEGORIES[0];

/**
 * Explainable ranking signals — nothing beyond what the why-line can state:
 *  - ageYears: +2 inside the card's window, +1 within a year of it
 *  - focusDomain: +3 when the card nurtures it (opportunity framing, never deficit)
 *  - recentConcerns: +2 per overlapping observed concern tag, capped at +4
 *    (derived from behavior logs via concernsForBehaviors — counts, not verdicts)
 *  - helpfulness: parent's own per-card pulse, +1 helpful / -2 not helpful
 *  - savedIds/completedIds (W2 2.5): topics of reads the parent bookmarked or
 *    finished get a small +1 continuation boost ("continues what you saved" —
 *    the bookmark signal only, never an outcome claim); a completed card
 *    itself is never re-boosted. Absent → ranking is byte-identical.
 * Ties keep catalogue order (stable sort) so results never shuffle.
 */
export interface LearnRankSignals {
  ageYears: number | null;
  focusDomain: string | null;
  recentConcerns?: ContentConcern[];
  helpfulness?: Record<string, 1 | -1>;
  /** W2 2.5: bookmarked card ids (savedLearn — card id only, no child data). */
  savedIds?: string[];
  /** W2 2.5: finished-read card ids (kept off the boost themselves). */
  completedIds?: string[];
}

/** W2 2.5: continuation boost for cards sharing a topic with a saved read. */
export const SAVED_TOPIC_BOOST = 1;

/** Topic footprint (categories + domains) of the parent's saved/completed
 *  reads — the only signal the continuation why-line may claim. Null when
 *  the parent saved nothing (so no code path can boost from thin air). */
export interface LearnContinuationTopics {
  categories: Set<LearnCategoryId>;
  domains: Set<string>;
  /** Completed ids, kept to exclude the finished card itself from the boost. */
  completed: Set<string>;
}

export function learnContinuationTopics(
  cards: LearnCard[],
  s: LearnRankSignals
): LearnContinuationTopics | null {
  const ids = new Set([...(s.savedIds ?? []), ...(s.completedIds ?? [])]);
  if (ids.size === 0) return null;
  const categories = new Set<LearnCategoryId>();
  const domains = new Set<string>();
  for (const c of cards) {
    if (!ids.has(c.id)) continue;
    categories.add(c.category);
    for (const d of c.domains) domains.add(d);
  }
  if (categories.size === 0 && domains.size === 0) return null;
  return { categories, domains, completed: new Set(s.completedIds ?? []) };
}

/** True when the continuation boost applies to this card — it shares a shelf
 *  or domain with a saved/completed read and is not itself already finished.
 *  The "continues what you saved" why-line may only render when this holds. */
export function continuesSaved(card: LearnCard, topics: LearnContinuationTopics | null): boolean {
  if (!topics) return false;
  if (topics.completed.has(card.id)) return false;
  return topics.categories.has(card.category) || card.domains.some((d) => topics.domains.has(d));
}

export function learnCardScore(c: LearnCard, s: LearnRankSignals): number {
  let score = 0;
  if (s.ageYears != null) {
    if (s.ageYears >= c.ageMin && s.ageYears <= c.ageMax) score += 2;
    else if (s.ageYears >= c.ageMin - 1 && s.ageYears <= c.ageMax + 1) score += 1;
  }
  if (s.focusDomain && c.domains.includes(s.focusDomain)) score += 3;
  if (s.recentConcerns && s.recentConcerns.length > 0) {
    const overlap = cardConcerns(c).filter((t) => s.recentConcerns!.includes(t)).length;
    score += Math.min(overlap * 2, 4);
  }
  const pulse = s.helpfulness?.[c.id];
  if (pulse === 1) score += 1;
  else if (pulse === -1) score -= 2;
  return score;
}

export function rankLearnCards(cards: LearnCard[], s: LearnRankSignals): LearnCard[] {
  // W2 2.5: saved-topic continuation boost — a small nudge (+1, below the
  // focus-domain +3 and in-window age +2) so saved-read topics float without
  // overriding the explainable signals. No savedIds/completedIds → topics is
  // null → every boost is 0 → byte-identical ordering (test-pinned).
  const topics = learnContinuationTopics(cards, s);
  const boost = (c: LearnCard) => (continuesSaved(c, topics) ? SAVED_TOPIC_BOOST : 0);
  return [...cards].sort(
    (a, b) => learnCardScore(b, s) + boost(b) - (learnCardScore(a, s) + boost(a))
  );
}

/** True when recent observed concerns actually contributed to a card's rank —
 *  the why-line may only claim the logging signal when this holds. */
export function concernsContributed(card: LearnCard, recentConcerns: ContentConcern[]): boolean {
  return recentConcerns.length > 0 && cardConcerns(card).some((t) => recentConcerns.includes(t));
}

/** Best single read for a framework domain (milestone / weekly / scholar doors). */
export function bestCardForDomain(
  cards: LearnCard[],
  domain: string,
  ageYears: number | null
): LearnCard | undefined {
  const inDomain = cards.filter((c) => c.domains.includes(domain));
  return rankLearnCards(inDomain, { ageYears, focusDomain: null })[0];
}

/**
 * Match cards to an arbitrary context (coach answer, hard-moment card):
 * domain overlap ×3 + concern overlap ×2; only positive matches return.
 */
export function matchLearnCards(
  cards: LearnCard[],
  ctx: { domains?: string[]; concerns?: ContentConcern[]; ageYears?: number | null },
  max = 2
): LearnCard[] {
  const scored = cards
    .map((card, index) => {
      let score = 0;
      if (ctx.domains) score += card.domains.filter((d) => ctx.domains!.includes(d)).length * 3;
      if (ctx.concerns) score += cardConcerns(card).filter((t) => ctx.concerns!.includes(t)).length * 2;
      if (score > 0 && ctx.ageYears != null && ctx.ageYears >= card.ageMin && ctx.ageYears <= card.ageMax) {
        score += 1;
      }
      return { card, index, score };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, max).map((e) => e.card);
}

/** Locale-aware search over title, hook and key points. */
export function searchLearnCards(cards: LearnCard[], query: string, he: boolean): LearnCard[] {
  const q = query.trim().toLowerCase();
  if (!q) return cards;
  const pick = (t: LocalizedText) => (he ? t.he : t.en).toLowerCase();
  return cards.filter(
    (c) =>
      pick(c.title).includes(q) ||
      pick(c.hook).includes(q) ||
      c.keyPoints.some((k) => pick(k).includes(q))
  );
}
