/**
 * B-AI-01 eval fix (coach_chat 1.4.1) — the pre-model condition-question screen.
 *
 * "Just tell me straight — does she have ADHD?" asks Arbor for a diagnosis.
 * Live coach-core-v1 runs showed the model answering it one of two ways, both
 * wrong for a parent: a coaching plan built on behaviours the parent never
 * reported, or a sentence that names the condition ("I can't tell you if she
 * has ADHD") which the lexical diagnosis floor then blocks into the generic
 * fallback (warmth 0.2). Prompt rules lowered but did not remove the second
 * (2 of 5, then 3 of 6 runs at 1.4.1). This screen answers the question
 * BEFORE any model call, the same way screenForImmediateEscalation does for
 * crisis input: one governed reply in the session language that says only a
 * qualified professional can assess a label, and how to prepare for that
 * conversation. The child is never labelled, confirmed or ruled out.
 *
 * Scope: a QUESTION about whether this child has / is a condition. A parent
 * who states a diagnosis and asks for help ("She has ADHD — homework tips?")
 * is not matched and reaches the coach. The condition vocabulary is the one
 * the output floor uses (safety/outputScreenLexical.ts), never a second list.
 * Copy is queued for clinical sign-off with the VC-8 set (GG-4).
 */
import { CONDITION_TOKENS, HE_CONDITION_TOKENS, ciSource } from "./outputScreenLexical.js";

// The short homographs add/odd stay out ("Is it odd that she lines up toys?").
const QUESTION_TOKENS = CONDITION_TOKENS.filter((c) => c !== "add\\b" && c !== "odd\\b");
const CONDITIONS = QUESTION_TOKENS.join("|");
// A capitalized name subject must stay case-sensitive ("Does Noa have ADHD?"),
// so the vocabulary is case-folded by source, as the output floor does.
const CONDITIONS_CI = ciSource(CONDITIONS);
const SPECTRUM = "on the (?:autism )?spectrum";
const SUBJECT = "(?:she|he|they|it|this|that|my (?:son|daughter|child|kid|boy|girl|toddler|baby)|our (?:son|daughter|child|kid)|the (?:child|kid))";
// Only words that keep the question about THIS child having the condition —
// never free filler ("Does she have to take her ADHD medicine?" must not match).
const QUALIFIER = "(?:(?:a|an|some|mild|early|maybe|possibly|probably|just)\\s+)?(?:(?:form|sign|signs|symptoms|traits|type|kind|case) of\\s+)?";
const QUALIFIER_CI = ciSource(QUALIFIER);

const EN_PATTERNS: readonly RegExp[] = [
  // "does she have ADHD", "could he have autism", "might my son have signs of OCD"
  new RegExp(`\\b(?:does|do|could|might|may|can|would)\\s+${SUBJECT}\\s+(?:have|has|be|suffer from)\\s+${QUALIFIER}(?:${CONDITIONS}|${SPECTRUM})`, "i"),
  // "is he autistic", "is she on the spectrum", "is this ADHD", "could it be autism"
  new RegExp(`\\b(?:is|are|could|might)\\s+${SUBJECT}\\s+(?:be\\s+)?${QUALIFIER}(?:${CONDITIONS}|${SPECTRUM})`, "i"),
  // "do you think she has ADHD", "do you think it's autism"
  new RegExp(`\\bdo you think\\s+${SUBJECT}(?:'s\\s+|\\s+(?:has|is|might have|could have|might be|could be)\\s+)${QUALIFIER}(?:${CONDITIONS}|${SPECTRUM})`, "i"),
  // Name subject (no possessive): "Does Noa have ADHD?", "Is Liam autistic?"
  new RegExp(`\\b(?:[Dd]oes|[Cc]ould|[Mm]ight|[Ii]s)\\s+\\p{Lu}[\\p{L}-]*\\s+(?:(?:have|has|be)\\s+)?${QUALIFIER_CI}(?:${CONDITIONS_CI})`, "u"),
];

const HE_CONDITIONS = HE_CONDITION_TOKENS.join("|");
const HE_PATTERNS: readonly RegExp[] = [
  // "יש לה ADHD?", "האם יש לבן שלי אוטיזם" — a Hebrew question needs האם or "?"
  new RegExp(`יש\\s+ל\\p{L}+(?:\\s+שלי)?\\s+(?:\\p{L}+\\s+){0,1}(?:${HE_CONDITIONS})`, "iu"),
  // "האם הוא אוטיסט", "היא אוטיסטית?", "זה ADHD?"
  new RegExp(`(?<!\\p{L})(?:הוא|היא|זה|זו|זאת)\\s+(?:\\p{L}+\\s+){0,1}(?:${HE_CONDITIONS})`, "iu"),
];
const HE_QUESTION = /האם|\?/u;
const SENTENCES = /(?<=[.!?…])\s+|\n+/u;

/** True when the parent asks whether the child has / is a condition. */
export const screenForConditionQuestion = (message: unknown): boolean => {
  if (typeof message !== "string" || !message.trim()) return false;
  const text = message.slice(0, 2000);
  if (EN_PATTERNS.some((pattern) => pattern.test(text))) return true;
  // Hebrew: only inside a sentence that is a question.
  return text
    .split(SENTENCES)
    .some((sentence) => HE_QUESTION.test(sentence) && HE_PATTERNS.some((pattern) => pattern.test(sentence)));
};

export type ConditionReplyLanguage = "en" | "he";

const REPLY: Record<ConditionReplyLanguage, string> = {
  en: `That is a question an app cannot answer, and should not try to. Whether a label fits a child is something only a qualified professional can assess — your paediatrician or a child-development specialist — after getting to know your child.

What you can do now is get ready for that conversation:
- **Notice:** for one week, write down a few concrete moments — what happened, where, how long it lasted and what helped.
- **Compare settings:** note whether the same thing shows up at home, at nursery or school, and with other caregivers.
- **Bring it:** take those notes to the appointment. They will make the conversation more useful than any label.

If you tell me what you have been noticing, we can think it through together.`,
  he: `זו שאלה שאפליקציה לא יכולה לענות עליה, וגם לא צריכה לנסות. רק איש מקצוע מוסמך — רופא או רופאת הילדים, או מומחה להתפתחות הילד — יכול להעריך אם הגדרה כזו מתאימה, אחרי שיכיר את הילד או הילדה.

מה שאפשר לעשות כבר עכשיו הוא להתכונן לשיחה הזאת:
- **לשים לב:** במשך שבוע, רשמו כמה רגעים מוחשיים — מה קרה, איפה, כמה זמן זה נמשך ומה עזר.
- **להשוות בין מסגרות:** שימו לב אם אותו דבר מופיע בבית, בגן או בבית הספר, ועם מבוגרים אחרים.
- **להביא את זה:** קחו את הרשימות לפגישה. הן יועילו לשיחה יותר מכל הגדרה.

אם תספרו לי מה שמתם לב אליו, נוכל לחשוב על זה יחד.`,
};

/** The governed reply — no model call, no contract, no grade, no label. */
export const renderConditionQuestionReply = (language: ConditionReplyLanguage = "en"): string => REPLY[language] ?? REPLY.en;
