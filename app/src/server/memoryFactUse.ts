/**
 * B-AI-14 (coach_chat 1.5.3, coach-core) — did the answer USE an approved fact?
 *
 * Live coach-core-v1 on 1.5.1 and again on 1.5.2: the approved fact
 * "Transitions go better with a 5-minute sand timer." reached the prompt, was
 * counted (approvedMemoryFactsUsed 1) and was ignored — the answer built a
 * visual schedule instead (groundedness 0). The prompt now puts the facts
 * first; this is the server-side signal beside it: on a /chat turn with
 * approved facts, an answer whose `text` and `todayPlan` name none of them
 * bumps `memory_fact_unused`. It NEVER blocks or rewrites the answer — the
 * judge decides grounding; the counter only makes misses visible in logs.
 *
 * A fact is "named" when one of its distinctive windows appears in the answer:
 * two consecutive CONTENT words of the fact (stopwords and pure numbers
 * dropped, lower-cased, punctuation stripped), matched against the answer's
 * content words in the same normalisation. Two words, not three: the
 * scenario's own grounded answer says "the sand timer", which no three-word
 * window of "a 5-minute sand timer" matches, while "sand timer" does. A fact
 * with a single content word uses that word (when it has 5+ letters).
 * Hebrew is matched on whitespace words (particles stay glued, so a Hebrew
 * miss is more likely than an English one — the counter over-reports there,
 * which is the safe direction for a never-blocking signal).
 */

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "so", "to", "of", "in", "on", "at", "by", "for", "with", "from", "into", "onto",
  "is", "are", "was", "were", "be", "been", "being", "it", "its", "this", "that", "these", "those", "as", "than", "then",
  "he", "she", "they", "him", "her", "them", "his", "their", "we", "us", "our", "you", "your", "i", "me", "my",
  "do", "does", "did", "go", "goes", "went", "get", "gets", "got", "have", "has", "had", "can", "will", "would", "should",
  "better", "best", "more", "most", "very", "really", "just", "when", "what", "how", "all", "any", "some", "no", "not",
]);

/** Lower-cased content words (letters required; stopwords and bare numbers dropped). */
export const contentWords = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && /\p{L}/u.test(word) && !STOPWORDS.has(word));

/** The distinctive windows of one fact: consecutive content-word pairs, or one long word. */
export const factWindows = (fact: string): string[] => {
  const words = contentWords(fact);
  if (words.length >= 2) {
    const pairs: string[] = [];
    for (let i = 0; i + 1 < words.length; i += 1) pairs.push(`${words[i]} ${words[i + 1]}`);
    return pairs;
  }
  return words.filter((word) => word.length >= 5);
};

/** True when the answer's text or todayPlan names at least one window of at least one fact. */
export const answerUsesApprovedFact = (
  facts: readonly string[],
  answer: { text?: string; todayPlan?: readonly string[] },
): boolean => {
  const haystack = ` ${contentWords([answer.text ?? "", ...(answer.todayPlan ?? [])].join(" \n ")).join(" ")} `;
  return facts.some((fact) => factWindows(fact).some((window) => haystack.includes(` ${window} `)));
};

/**
 * B-AI-14 (route, 6 Oct) — an applicable approved fact always reaches the
 * answer. coach-memory-grounding scored groundedness 0 on three prompt
 * versions in a row (gemini-2.5-flash ignored "Transitions go better with a
 * 5-minute sand timer." even rendered first), so the route stops relying on
 * the prompt: on a /chat turn whose answer names none of the turn's approved
 * facts (the memory_fact_unused signal above), the server writes the
 * top-ranked fact (selectApprovedFacts' order = applicability to this turn)
 * as todayPlan step 1 in the parent's own words, from the keyed template
 * `coach.memory.factStep`, and stamps it with the fact's memory id. One step
 * per answer; a plan already at three steps loses its last step. The caller
 * screens the rendered answer afterwards like every other field. Never on a
 * seeded follow-up (the short shape has no todayPlan).
 */
export const MAX_TODAY_PLAN_STEPS = 3;

export type FactStepProvenance = { step: number; memoryId: string; kind: "approved_fact" };

/** The fact as a clause: trailing punctuation dropped; EN first letter lower-cased (not an acronym). */
export const factClause = (fact: string, language: "en" | "he"): string => {
  const trimmed = fact.trim().replace(/[.!?…]+$/u, "").trim();
  if (language !== "en" || trimmed.length === 0) return trimmed;
  const first = trimmed.charAt(0);
  const second = trimmed.charAt(1);
  const acronym = second !== "" && second === second.toUpperCase() && second !== second.toLowerCase();
  return acronym ? trimmed : first.toLowerCase() + trimmed.slice(1);
};

/** Fill the template's `{fact}` WITHOUT bidi isolation (the step is stored on the contract, not only displayed). */
export const factStepText = (template: string, fact: string, language: "en" | "he"): string =>
  template.split("{fact}").join(factClause(fact, language));

/** Insert the fact step as todayPlan[0] (cap 3: the model's last step goes) and stamp its provenance. Mutates. */
export function groundTodayPlanOnFact<T extends { todayPlan: string[]; todayPlanProvenance?: FactStepProvenance[] }>(
  contract: T,
  fact: { text: string; sourceId: string },
  stepText: string,
): T {
  contract.todayPlan = [stepText, ...contract.todayPlan].slice(0, MAX_TODAY_PLAN_STEPS);
  contract.todayPlanProvenance = [{ step: 0, memoryId: fact.sourceId, kind: "approved_fact" }];
  return contract;
}

let unusedTotal = 0;

/** Turns with approved facts whose answer named none of them (process lifetime). */
export const memoryFactUnusedCount = (): number => unusedTotal;

/** Record one ungrounded answer; returns the running total. */
export const recordMemoryFactUnused = (): number => {
  unusedTotal += 1;
  return unusedTotal;
};
