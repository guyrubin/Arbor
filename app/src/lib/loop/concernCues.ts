/**
 * B-LOOP-06 (extract_log 1.3.1) — the ONE list of words that mark a capture
 * as a worry or as something the child does NOT (yet) do. Such a capture is
 * never milestone evidence: the extract_log prompt names these cues to the
 * model (ai/prompts.ts renderMilestoneMatchBlock) and the server drops any
 * match on a description that carries one (server/milestoneMatch.ts
 * `describesConcernOrAbsence`, which also reuses the condition-question
 * screen). Prompt and guard read the same list, so they cannot drift.
 *
 * Over-matching is the safe direction here: a missed proposal costs the
 * parent one tap on a shelf; a wrong one ticks a milestone off a worry.
 */
export const CONCERN_CUES_EN: readonly string[] = [
  "doesn't", "can't", "still not", "won't", "isn't yet", "not yet",
  "worried", "concerned", "afraid",
];

export const CONCERN_CUES_HE: readonly string[] = [
  "לא", "עדיין לא", "אף פעם לא", "דואג/ת", "מודאג/ת",
];

/** English: negated ability or a worry word, apostrophe-tolerant (' or ’). */
const EN_RE = new RegExp(
  [
    String.raw`\b(?:doesn|can|won|isn|didn|hasn|haven)['’]?t\b`,
    String.raw`\b(?:does|can|will|is|did|has|have)\s+not\b`,
    String.raw`\bcannot\b`,
    String.raw`\b(?:still|not)\s+(?:not|yet)\b`,
    String.raw`\bnever\b`,
    String.raw`\bworr(?:y|ies|ied|ying)\b`,
    String.raw`\bconcern(?:s|ed|ing)?\b`,
    String.raw`\bafraid\b`,
  ].join("|"),
  "i",
);

/** Hebrew: the negation word as a whole word (with a glued ו / ש / כש), or
 *  a worry stem in any gender or number (דואג, דואגת, מודאגים…). */
const HE_RE = new RegExp(
  String.raw`(?<!\p{L})(?:ו|ש|כש)?לא(?!\p{L})|(?<!\p{L})(?:ו|ש)?(?:מודאג|דואג)\p{L}*`,
  "u",
);

/**
 * Live judge on 1.3.1 (6 Oct): "We went to grandma's and had pasta" still
 * came back as a Food shelf. An EVENT-ONLY description — an outing, a visit,
 * a meal — names no skill; a shelf-only proposal on it is dropped by the
 * server (a listed milestone id the model matched with high confidence still
 * stands: that is the model saying a skill was shown, and the parent taps).
 * Data, not inline regexes: EN phrases match as words, HE words as whole
 * words with a glued ו.
 */
export const EVENT_CUES_EN: readonly string[] = [
  "we went to", "we went", "went to", "we had", "had", "we ate", "ate", "we visited", "visited",
  "we were at", "we spent", "we drove", "we took",
];

export const EVENT_CUES_HE: readonly string[] = [
  "הלכנו", "אכלנו", "ביקרנו", "היינו", "נסענו", "טיילנו", "בילינו", "יצאנו",
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const EVENT_EN_RE = new RegExp(`\\b(?:${EVENT_CUES_EN.map(escapeRe).join("|")})\\b`, "i");
const EVENT_HE_RE = new RegExp(`(?<!\\p{L})ו?(?:${EVENT_CUES_HE.map(escapeRe).join("|")})(?!\\p{L})`, "u");

/** True when the description reads as an event (an outing, a visit, a meal). */
export const hasEventCue = (text: unknown): boolean =>
  typeof text === "string" && text.trim() !== "" && (EVENT_EN_RE.test(text) || EVENT_HE_RE.test(text));

/** True when the description voices a worry or a skill the child does not show. */
export const hasConcernCue = (text: unknown): boolean =>
  typeof text === "string" && text.trim() !== "" && (EN_RE.test(text) || HE_RE.test(text));
