/**
 * v3 EXTRA-FORYOU — the parent's open family question as a reading signal.
 *
 * The question ("How do we get through bedtime without a fight?") is the
 * parent's OWN words: the same class of input as a saved read or a logged
 * concern, never a score about the child. A read matches the question when the
 * two share a content word. Deterministic, no model call, EN and HE alike.
 *
 * How words are compared:
 *  · both sides are split into words and normalised with the search seam
 *    (case, niqqud, Hebrew final letters: lib/searchNormalize);
 *  · stop words and the generic words every parenting question carries
 *    ("child", "kids", "ילד", "הורים") are dropped from the QUESTION side, so a
 *    read never matches on them;
 *  · English words are reduced by a short suffix rule set (sleeping → sleep,
 *    tantrums → tantrum, cries → cry, hitting → hit);
 *  · Hebrew words also stand in for themselves without up to two one-letter
 *    prefixes (ו ה ב ל מ ש כ) and without a plural ending (ים, ות, יות);
 *  · two forms match when equal, or when the shorter (4+ letters) opens the
 *    longer one and the longer adds at most two letters (sleep / sleepy).
 *    A pair of prefix-stripped Hebrew forms needs 4+ letters, so two different
 *    words cannot meet on a three-letter remainder.
 *
 * Concepts (the reviewer's EN/HE parity fix): a parent who asks about
 * "bedtime" is asking about sleep, and so is one who asks about "השינה". Words
 * that name one of the content concern tags without using its word (CONCEPTS
 * below) carry that tag, so a read tagged with it counts the word as shared in
 * either language. Only words a parent uses for that one concern are listed;
 * ambiguous ones ("fight", "ריב", "morning") stay out.
 *
 * Import-free apart from the normaliser: the caller decides what text a read
 * offers (learnLibrary.cardTopicText), which concern tags it carries, and what
 * a match is worth.
 */
import { normalizeSearchText } from "../lib/searchNormalize";

interface Form {
  form: string;
  /** True when a Hebrew one-letter prefix was removed to reach this form. */
  prefixStripped: boolean;
}

/** One content word of the question with the forms it may match on. */
export interface TopicWord {
  word: string;
  forms: Form[];
  /** The concern tags this word names (CONCEPTS), usually none. */
  concepts: string[];
}

const HEBREW = /[א-ת]/;
const HE_PREFIXES = "והבלמשכ";
/** Plural endings, as normalised (final mem → מ). */
const HE_SUFFIXES = ["יות", "ימ", "ות"];

const STOP_EN = [
  "the", "and", "for", "with", "without", "about", "from", "into", "onto", "over", "under", "after", "before",
  "through", "during", "until", "because", "since", "around", "between",
  "while", "when", "what", "where", "which", "who", "whom", "whose", "how", "why", "than", "then", "there", "here",
  "this", "that", "these", "those", "our", "ours", "your", "yours", "his", "her", "hers", "their", "theirs", "them",
  "they", "she", "him", "you", "its", "not", "too", "very", "just", "only", "also", "but", "yet", "out", "off",
  "all", "any", "some", "each", "every", "other", "same", "much", "many", "more", "most", "less", "lot", "lots",
  "really", "always", "never", "still", "again", "ever", "even", "can", "could", "should", "would", "will", "shall",
  "may", "might", "must", "does", "did", "doing", "done", "has", "have", "having", "had", "been", "being", "are",
  "was", "were", "don", "doesn", "didn", "isn", "aren", "wasn", "won", "can't", "get", "gets", "getting", "got",
  "make", "makes", "making", "help", "helps", "want", "wants", "need", "needs", "know", "start", "deal",
  "handle", "manage", "way", "ways", "thing", "things", "like", "time", "times", "day", "days", "week", "weeks",
  "month", "months", "year", "years", "old", "today", "now", "home", "kid", "kids", "child", "children", "son",
  "sons", "daughter", "daughters", "toddler", "toddlers", "baby", "babies", "parent", "parents", "parenting", "mom",
  "mum", "dad", "family", "families", "boy", "boys", "girl", "girls", "big", "little", "small",
];

const STOP_HE = [
  "של", "את", "מה", "למה", "איך", "אם", "כי", "גם", "עם", "על", "אל", "זה", "זו", "זאת", "הוא", "היא", "הם", "הן",
  "אני", "אנחנו", "אתם", "אתן", "לא", "כן", "יש", "אין", "כל", "עוד", "רק", "כבר", "מאוד", "הרבה", "פחות", "יותר",
  "כמו", "אחרי", "לפני", "בלי", "עכשיו", "היום", "תמיד", "אף", "פעם", "איפה", "מתי", "מי", "ילד", "ילדה", "ילדים",
  "ילדות", "בן", "בת", "תינוק", "תינוקת", "פעוט", "פעוטה", "הורה", "הורים", "אמא", "אבא", "משפחה", "שלנו", "שלו",
  "שלה", "שלי", "שלכם", "שלהם", "לו", "לה", "לנו", "להם", "אותו", "אותה", "אותם", "צריך", "צריכה", "צריכים",
  "אפשר", "לעשות", "עושים", "בית", "זמן", "יום", "שבוע", "חודש", "שנה", "שנים", "דרך", "דבר", "דברים", "הכי", "שוב",
  "גדול", "גדולה", "קטן", "קטנה",
];

const STOP = new Set([...STOP_EN, ...STOP_HE].map(normalizeSearchText));

/**
 * Question words that name a content concern tag (content/governance
 * CONTENT_CONCERNS) without using its word, EN then HE, space-separated.
 * The English tag words themselves need no entry: a read's tags are part of
 * the text the question is compared with. Hebrew has no tag words, so its
 * plain words for each concern are listed here.
 */
const CONCEPTS: Readonly<Record<string, string>> = {
  sleep:
    "bedtime bed asleep nap night nighttime overnight wake waking woke nightmare crib " +
    "שינה לישון להירדם הירדמות נרדם נרדמת לילה לילות מיטה תנומה תנומות להשכיב מתעורר מתעוררת השכמה סיוט סיוטים",
  aggression:
    "hit bite biting kick punch aggressive violent " +
    "מכה מכות מרביץ מרביצה להרביץ נושך נושכת נשיכה נשיכות לנשוך בועט בועטת אלים אלימות תוקפנות",
  regulation:
    "tantrum meltdown scream yell angry anger upset frustrated frustration crying whining outburst calm " +
    "התקף התקפי זעם צורח צורחת צרחות צועק צועקת צעקות כועס כועסת כעס בוכה בכי תסכול מתוסכל מתוסכלת להירגע התפרצות התפרצויות",
  separation:
    "goodbye clingy clinging daycare preschool nursery kindergarten babysitter leaving " +
    "פרידה פרידות להיפרד נפרד נפרדת גנון מעון נצמד נצמדת מתגעגע מתגעגעת",
  food:
    "eat food meal dinner lunch breakfast picky vegetables veggies snack " +
    "האוכל באוכל לאכול אכילה ארוחה ארוחות ארוחת בררן בררנית ירקות חטיף חטיפים",
  screens:
    "tablet ipad phone youtube cartoons videos gaming device " +
    "מסך מסכים טאבלט טלפון סרטונים יוטיוב",
  fears:
    "afraid scared fear worried worry anxious anxiety monsters dark " +
    "פחד פחדים מפחד מפחדת חושש חוששת דאגה חרדה מפלצות חושך",
  "peer-conflict":
    "sibling sister brother sharing friends friend playground " +
    "אחות אחים לשתף שיתוף חברים",
  transitions: "switching hurry " + "מעבר מעברים",
  attention: "focus concentrate distracted " + "ריכוז להתרכז מוסח",
  routines: "routine schedule " + "שגרה שגרות",
};

/** Each concept word's matchable forms: an English word and its stem; a Hebrew
 *  word exactly as listed (its plural is listed beside it), so a prefix or a
 *  plural ending can never cut a listed word down to someone else's root. */
const CONCEPT_FORMS: ReadonlyArray<{ concern: string; forms: Form[] }> = Object.entries(CONCEPTS).flatMap(
  ([concern, list]) =>
    list
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => {
        const word = normalizeSearchText(w);
        return { concern, forms: HEBREW.test(word) ? [{ form: word, prefixStripped: false }] : formsOf(word) };
      }),
);

/** English suffix stripping: two passes at most, so "feelings" → "feel". */
export function stemEnglish(word: string): string {
  let s = word;
  for (let pass = 0; pass < 2; pass += 1) {
    const before = s;
    if (s.length > 4 && /ie[sd]$/.test(s)) s = `${s.slice(0, -3)}y`;
    else if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
    else if (s.length > 4 && s.endsWith("ed")) s = s.slice(0, -2);
    else if (s.length > 4 && /(?:s|x|z|ch|sh)es$/.test(s)) s = s.slice(0, -2);
    else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
    // "hitting" → "hitt" → "hit"; "stopped" → "stopp" → "stop" (a doubled l or s stays, as in fall or class).
    if (s !== before && /([b-df-hj-km-np-rtv-z])\1$/.test(s)) s = s.slice(0, -1);
    if (s === before) break;
  }
  return s;
}

/** A Hebrew word's forms: itself, without up to two prefixes, without a plural ending. */
function hebrewForms(word: string): Form[] {
  const bases: Form[] = [{ form: word, prefixStripped: false }];
  let w = word;
  for (let i = 0; i < 2 && w.length > 3 && HE_PREFIXES.includes(w[0]); i += 1) {
    w = w.slice(1);
    bases.push({ form: w, prefixStripped: true });
  }
  const out: Form[] = [];
  for (const base of bases) {
    out.push(base);
    for (const suffix of HE_SUFFIXES) {
      if (base.form.endsWith(suffix) && base.form.length - suffix.length >= 3) {
        out.push({ form: base.form.slice(0, -suffix.length), prefixStripped: base.prefixStripped });
      }
    }
  }
  return out;
}

function formsOf(word: string): Form[] {
  if (HEBREW.test(word)) return hebrewForms(word);
  const stem = stemEnglish(word);
  const forms: Form[] = [{ form: word, prefixStripped: false }];
  if (stem !== word && stem.length >= 3) forms.push({ form: stem, prefixStripped: false });
  return forms;
}

/** Normalised words of three letters or more; digits never count. */
function wordsOf(text: string): string[] {
  return normalizeSearchText(text)
    .split(/[^\p{L}\p{M}]+/u)
    .filter((w) => w.length >= 3);
}

function formsMatch(a: Form, b: Form): boolean {
  const min = a.prefixStripped && b.prefixStripped ? 4 : 3;
  if (a.form === b.form) return a.form.length >= min;
  const [short, long] = a.form.length <= b.form.length ? [a.form, b.form] : [b.form, a.form];
  return short.length >= Math.max(4, min) && long.length - short.length <= 2 && long.startsWith(short);
}

/** The concern tags a question word names, in CONCEPTS order (usually none). */
function conceptsOf(forms: Form[]): string[] {
  const out: string[] = [];
  for (const { concern, forms: names } of CONCEPT_FORMS) {
    if (out.includes(concern)) continue;
    if (forms.some((f) => names.some((n) => formsMatch(f, n)))) out.push(concern);
  }
  return out;
}

let lastTopic: { text: string; words: TopicWord[] } | null = null;

/** The question's content words (stop words and generic parenting words dropped). */
export function topicWords(text: string | null | undefined): TopicWord[] {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  if (lastTopic && lastTopic.text === raw) return lastTopic.words;
  const seen = new Set<string>();
  const words: TopicWord[] = [];
  for (const word of wordsOf(raw)) {
    if (seen.has(word)) continue;
    seen.add(word);
    const forms = formsOf(word);
    if (forms.some((f) => STOP.has(f.form))) continue;
    words.push({ word, forms, concepts: conceptsOf(forms) });
  }
  lastTopic = { text: raw, words };
  return words;
}

const textForms = new Map<string, Form[]>();

function formsOfText(text: string): Form[] {
  const hit = textForms.get(text);
  if (hit) return hit;
  const forms = wordsOf(text).flatMap(formsOf);
  textForms.set(text, forms);
  return forms;
}

/** How many of the question's content words a text shares (each counted once). */
export function sharedTopicWords(topic: TopicWord[], text: string): number {
  if (topic.length === 0 || !text) return 0;
  const target = formsOfText(text);
  return topic.filter((q) => q.forms.some((f) => target.some((t) => formsMatch(f, t)))).length;
}

/**
 * How a read meets the question, one count per question word: `direct` when
 * the read's text shares the word, else `concept` when the word names a concern
 * the read is tagged with ("bedtime" and a read tagged sleep). A word never
 * counts twice.
 */
export function topicOverlap(
  topic: TopicWord[],
  text: string,
  tags: readonly string[],
): { direct: number; concept: number } {
  let direct = 0;
  let concept = 0;
  if (topic.length === 0) return { direct, concept };
  const target = text ? formsOfText(text) : [];
  for (const q of topic) {
    if (q.forms.some((f) => target.some((t) => formsMatch(f, t)))) direct += 1;
    else if (q.concepts.some((c) => tags.includes(c))) concept += 1;
  }
  return { direct, concept };
}
