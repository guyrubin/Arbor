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

/** True when the description voices a worry or a skill the child does not show. */
export const hasConcernCue = (text: unknown): boolean =>
  typeof text === "string" && text.trim() !== "" && (EN_RE.test(text) || HE_RE.test(text));
