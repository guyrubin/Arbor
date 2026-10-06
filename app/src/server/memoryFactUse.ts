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

let unusedTotal = 0;

/** Turns with approved facts whose answer named none of them (process lifetime). */
export const memoryFactUnusedCount = (): number => unusedTotal;

/** Record one ungrounded answer; returns the running total. */
export const recordMemoryFactUnused = (): number => {
  unusedTotal += 1;
  return unusedTotal;
};
