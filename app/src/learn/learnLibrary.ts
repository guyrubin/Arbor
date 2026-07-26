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
import type { LocalizedText } from "../content/governance";

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
}

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
 * Explainable ranking — nothing beyond what the why-line states:
 *  +2 the child's age falls inside the card's window (+1 within a year of it),
 *  +3 the card nurtures the Development Map focus domain (opportunity framing).
 * Ties keep catalogue order (stable sort) so results never shuffle.
 */
export function rankLearnCards(
  cards: LearnCard[],
  opts: { ageYears: number | null; focusDomain: string | null }
): LearnCard[] {
  const score = (c: LearnCard): number => {
    let s = 0;
    if (opts.ageYears != null) {
      if (opts.ageYears >= c.ageMin && opts.ageYears <= c.ageMax) s += 2;
      else if (opts.ageYears >= c.ageMin - 1 && opts.ageYears <= c.ageMax + 1) s += 1;
    }
    if (opts.focusDomain && c.domains.includes(opts.focusDomain)) s += 3;
    return s;
  };
  return [...cards].sort((a, b) => score(b) - score(a));
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
