/**
 * AI-03 — the retrieval keys the coach routes actually have.
 *
 * `/chat` and `/council` both called `retrieveKnowledgeCards({ ageBand:
 * childProfile?.ageBand, domains: childProfile?.domains, … })`. Neither field
 * exists on `ChildProfile` (see src/types.ts) and no client ever put them on
 * the wire, so BOTH were permanently `undefined`. `filterKnowledgeCards` then
 * skipped its age and domain filters entirely and scored every card on
 * `allowedUse` + `review_status` alone — meaning a 9-year-old's parent and a
 * 6-month-old's parent were grounded in the SAME cards, in the same order,
 * forever. The retrieval looked wired and was inert.
 *
 * This module derives the two keys from data the routes DO hold:
 *
 *   ageBand  ← the child's age in months (`lib/childAge`), bucketed onto the
 *              exact `age_bands` vocabulary the knowledge cards declare.
 *   domains  ← the parent's own question (a small bilingual keyword map) plus
 *              the parent-selected `activeGoals` domains on the profile.
 *
 * Both are UNDEFINED when nothing can be derived, so the filter degrades to
 * today's behaviour rather than to an empty result set — a question that
 * matches no keyword must still retrieve cards.
 *
 * CLINICAL FIREWALL: these are RETRIEVAL keys — they choose which reference
 * cards enter the prompt. Nothing here is scored, surfaced, or stored, and no
 * value derived here is ever rendered to a parent as a judgement about the
 * child.
 */
import { ageMonthsFromProfile, type ChildAgeProfile } from "../lib/childAge.js";

/** The age-band vocabulary the knowledge cards use in their front matter. */
export const KNOWLEDGE_AGE_BANDS = ["0-12m", "12-36m", "3-5y", "6-8y", "9-12y"] as const;
export type KnowledgeAgeBand = (typeof KNOWLEDGE_AGE_BANDS)[number];

/**
 * Months → the card vocabulary band. Ages past the top band clamp to "9-12y"
 * rather than returning nothing: an older child should still reach the oldest
 * written material instead of silently falling back to unfiltered retrieval.
 */
export const ageBandForMonths = (months: number | null | undefined): KnowledgeAgeBand | undefined => {
  if (typeof months !== "number" || !Number.isFinite(months) || months < 0) return undefined;
  if (months < 12) return "0-12m";
  if (months < 36) return "12-36m";
  if (months < 72) return "3-5y";
  if (months < 108) return "6-8y";
  return "9-12y";
};

/** The `activeGoals` domain vocabulary (PlayDomain) → knowledge-card domains. */
const GOAL_DOMAIN_TO_KNOWLEDGE: Record<string, string> = {
  regulation: "attachment_regulation",
  language: "language_communication",
  cognitive: "cognition_executive_function",
  social: "social_development",
  motor: "sensory_motor_patterns",
};

/**
 * Question keywords → knowledge-card domain. EN + HE, because the coach is
 * asked in both and a Hebrew question must not silently lose its domain key.
 * Deliberately small and literal: a miss costs nothing (the domain filter is
 * simply omitted), a false hit would narrow retrieval wrongly.
 */
const DOMAIN_KEYWORDS: ReadonlyArray<{ domain: string; words: readonly string[] }> = [
  {
    domain: "attachment_regulation",
    words: [
      "meltdown", "tantrum", "cry", "crying", "calm", "regulate", "upset", "angry", "anger",
      "clingy", "separation", "bedtime", "sleep", "comfort", "soothe", "big feelings",
      "התקף", "בכי", "בוכה", "כעס", "כועס", "להירגע", "הרגעה", "פרידה", "שינה", "לפני השינה",
    ],
  },
  {
    domain: "language_communication",
    words: [
      "talk", "talking", "speech", "speaking", "word", "words", "vocabulary", "stutter",
      "pronounce", "language", "bilingual", "says", "sentence",
      "מדבר", "מדברת", "דיבור", "מילים", "מילה", "שפה", "אוצר מילים", "משפט", "גמגום",
    ],
  },
  {
    domain: "cognition_executive_function",
    words: [
      "focus", "concentrate", "attention", "distract", "distracted", "homework", "memory",
      "plan", "planning", "organise", "organize", "impulse", "instructions",
      "ריכוז", "קשב", "מתרכז", "שיעורי בית", "זיכרון", "ארגון", "אימפולסיב", "הוראות",
    ],
  },
  {
    domain: "social_development",
    words: [
      "friend", "friends", "sibling", "share", "sharing", "play with", "playdate", "shy",
      "peers", "hitting", "bite", "biting", "turn taking",
      "חבר", "חברים", "אח", "אחות", "לשתף", "שיתוף", "ביישן", "מכה", "נושך", "תור",
    ],
  },
  {
    domain: "independence_adaptive_skills",
    words: [
      "dress", "dressing", "potty", "toilet", "eat", "eating", "picky", "feed", "self care",
      "brush teeth", "independent", "chores", "getting ready",
      "להתלבש", "גמילה", "שירותים", "אוכל", "אכילה", "בררן", "עצמאי", "עצמאות", "לצחצח",
    ],
  },
  {
    domain: "sensory_motor_patterns",
    words: [
      "sensory", "noise", "loud", "texture", "clumsy", "motor", "balance", "spinning",
      "overwhelmed by", "touch", "seams", "tags",
      "חושי", "רעש", "רועש", "מרקם", "מוטורי", "שיווי משקל", "מציף", "מגע",
    ],
  },
  {
    domain: "ecosystem_stressors",
    words: [
      "school", "teacher", "daycare", "kindergarten", "nursery", "moving house", "divorce",
      "new baby", "hospital", "screen time", "ipad", "tablet",
      "בית ספר", "גן", "מורה", "גננת", "גירושין", "מעבר דירה", "תינוק חדש", "מסך", "מסכים",
    ],
  },
];

/** Keyword-derived domains for one parent question. Order = declaration order. */
export const domainsFromQuestion = (message: unknown): string[] => {
  if (typeof message !== "string" || !message.trim()) return [];
  const haystack = message.toLowerCase();
  const out: string[] = [];
  for (const { domain, words } of DOMAIN_KEYWORDS) {
    if (words.some((w) => haystack.includes(w))) out.push(domain);
  }
  return out;
};

/** Parent-selected goal domains on the profile, mapped to card domains. */
export const domainsFromProfileGoals = (profile: unknown): string[] => {
  const goals = (profile as { activeGoals?: unknown } | null | undefined)?.activeGoals;
  if (!Array.isArray(goals)) return [];
  const out: string[] = [];
  for (const goal of goals) {
    const id = (goal as { domainId?: unknown } | null)?.domainId;
    if (typeof id !== "string") continue;
    const mapped = GOAL_DOMAIN_TO_KNOWLEDGE[id];
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
};

/**
 * Card types the GENERIC coach retrieval must not pull in.
 *
 * `escalation` cards (escalation-self-harm, escalation-medical-acute) declare
 * `allowed_uses: [coach_context]`, and once retrieval is actually keyed on the
 * question's domain they surface for ordinary "why the meltdowns" questions.
 * Two reasons they must not:
 *
 *  1. Escalation thresholds already reach the model unconditionally through
 *     NON_DIAGNOSTIC_CONTRACT, and a crisis INPUT is caught before the model
 *     runs (screenForImmediateEscalation), so nothing is lost here.
 *  2. LATENT DEFECT this sidesteps: renderCoachResponse embeds the retrieved
 *     card SLUGS in the text that screenModelOutput screens (a "Knowledge Cards
 *     Used" list item reading "escalation-self-harm"), and the lexical crisis
 *     floor reads that slug as crisis language in the model's own output — a
 *     false positive with no model involvement at all. So a routine
 *     bedtime answer grounded in that card gets BLOCKED and replaced with
 *     crisis resources. Server-authored citation ids should not be screened as
 *     model prose; until that is fixed at the rendering seam, the generic
 *     retrieval must not hand the screen a slug that trips it.
 *
 * Lens-selected scholar cards (loadCardsByIds) are untouched by this.
 */
export const COACH_EXCLUDED_CARD_TYPES = ["escalation"] as const;

export type RetrievalKeys = { ageBand?: string; domains?: string[] };

/**
 * THE call the coach routes make. `ageBand` and `domains` are omitted (not
 * empty) when nothing is derivable, so `filterKnowledgeCards` falls back to
 * exactly today's unfiltered scoring instead of matching zero cards.
 *
 * The question leads the domain list (it is what the parent asked about RIGHT
 * NOW); the profile's standing goals follow as a weaker signal.
 */
export const retrievalKeysFor = (
  childProfile: unknown,
  message: unknown,
  now?: Date,
): RetrievalKeys => {
  const keys: RetrievalKeys = {};
  const months =
    childProfile && typeof childProfile === "object"
      ? ageMonthsFromProfile(childProfile as ChildAgeProfile, now)
      : null;
  const band = ageBandForMonths(months);
  if (band) keys.ageBand = band;

  const domains: string[] = [];
  for (const d of [...domainsFromQuestion(message), ...domainsFromProfileGoals(childProfile)]) {
    if (!domains.includes(d)) domains.push(d);
  }
  if (domains.length > 0) keys.domains = domains;
  return keys;
};
