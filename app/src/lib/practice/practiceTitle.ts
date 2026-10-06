/**
 * P5 critic r1 on #/overview (product P0-1, 6 Oct): the root of the fold
 * overflow was the whole 21-word practice "do" set as a four-line display
 * title. The card's title is now a SHORT headline taken from the do itself
 * (never new copy, so the reviewed words stay the reviewed words); the full
 * do renders under it at body size. The pack's "do ≤ 25 words" is the
 * practice text, not the headline.
 *
 * Rule, EN and HE alike:
 *  1. Split the do on its clause boundaries ("." "," ";" ":" " — ").
 *  2. The first clause is the title — unless it only sets the scene ("When
 *     your baby smiles…", "At a meal", "בגינה", "כש…"): then the next
 *     clause, the action, is.
 *  3. A clause under three words, or one that ends mid-phrase ("say a
 *     short", "…או"), takes the following clause with it.
 *  4. Over the word limit, the clause is cut before the last joining word
 *     that keeps it within the limit and does not leave it hanging ("and",
 *     "with", "on"… / "עם", "על", a ו- conjunction…; never at "or" / "או",
 *     which mostly joins two nouns).
 *  5. Last resort: the first `limit` words.
 */
export const PRACTICE_TITLE_MAX_WORDS = 8;

type Lang = "en" | "he";

const BOUNDARY = /\s+[—–]\s+|[.,;:!?](?:\s+|$)/u;

const JOIN_EN = new Set([
  "and", "but", "so", "then", "while", "during", "with", "without", "in", "on", "at", "from",
  "for", "that", "to", "until", "as", "by", "near", "onto", "into", "inside", "outside", "within",
  "between", "under", "over", "across", "around", "through", "after", "before", "when", "where",
  "about", "toward", "towards", "next", "using", "like",
]);
const SCENE_EN = new Set([...JOIN_EN, "if", "whenever", "once", "every", "or", "a", "an", "the", "each", "tonight", "today", "this", "any"]);
const DANGLING_EN = new Set([
  "a", "an", "the", "or", "and", "your", "their", "his", "her", "its", "one", "some", "short", "small",
  "little", "big", "calm", "quiet", "simple", "warm", "gentle", "cheerful", "same", "very", "more",
  "few", "soft", "safe", "large", "new", "old", "bright", "light", "open", "real", "each", "well",
  "already", "roughly", "close", "is", "at", "in", "on", "of", "to", "from", "with", "by", "for",
  "about", "child's", "baby's",
]);

const JOIN_HE = new Set([
  "עם", "על", "ליד", "בזמן", "כדי", "אל", "מול", "לאורך", "בלי", "עד", "אחרי", "לפני",
  "בתוך", "מתחת", "מעל", "כמו", "כש", "כאשר", "אם", "בין", "שבה", "אשר", "תוך", "לקראת",
]);
const DANGLING_HE = new Set(["או", "של", "עם", "על", "ליד", "את", "קצת", "כמו", "אל", "מול", "תוך", "בכל", "כל", "באותו", "לא", "לקראת"]);

const words = (s: string): string[] => s.split(/\s+/u).filter(Boolean);
const bare = (w: string): string => w.replace(/[^\p{L}'’/]/gu, "");

const isJoin = (w: string, lang: Lang): boolean => {
  const b = bare(w);
  if (lang === "en") return JOIN_EN.has(b.toLowerCase());
  // a glued ו- conjunction ("והצביעו", "ותנו") opens a second action
  return JOIN_HE.has(b) || (b.length > 3 && b.startsWith("ו") && !b.startsWith("וו"));
};

const isDangling = (w: string | undefined, lang: Lang): boolean => {
  if (!w) return true;
  const b = bare(w);
  return lang === "en" ? DANGLING_EN.has(b.toLowerCase()) : DANGLING_HE.has(b);
};

/** A clause that sets the scene instead of naming the action. Hebrew
 *  imperatives (plural) end in ו; a clause that opens otherwise — "בגינה",
 *  "ברגע רגוע", "כשהוא…" — is the scene. */
const isScene = (clause: string, lang: Lang): boolean => {
  const first = bare(words(clause)[0] ?? "");
  if (lang === "en") return SCENE_EN.has(first.toLowerCase());
  return JOIN_HE.has(first) || /^(?:כש|כאשר|אם)/u.test(first) || !first.endsWith("ו");
};

/** "or" / "או" and "of" / "של" mostly join two nouns: a cut there is a second choice. */
const isWeakJoin = (w: string, lang: Lang): boolean =>
  lang === "en" ? ["or", "of"].includes(bare(w).toLowerCase()) : ["או", "של"].includes(bare(w));

function cutToLimit(clause: string, lang: Lang, limit: number): string {
  const w = words(clause);
  if (w.length <= limit) return clause;
  for (const weakOk of [false, true]) {
    for (let i = Math.min(limit, w.length - 1); i >= 3; i -= 1) {
      const weak = isWeakJoin(w[i], lang);
      if ((weak ? weakOk : isJoin(w[i], lang)) && !isDangling(w[i - 1], lang)) return w.slice(0, i).join(" ");
    }
  }
  // last resort: the first `limit` words, never ending on a hanging word
  const cut = w.slice(0, limit);
  while (cut.length > 3 && isDangling(cut[cut.length - 1], lang)) cut.pop();
  return cut.join(" ");
}

/** The headline of a practice's "do" text (already in the page language). */
export function practiceTitle(doText: string, lang: Lang, limit = PRACTICE_TITLE_MAX_WORDS): string {
  const text = (doText ?? "").trim();
  if (!text) return "";
  const clauses = text.split(BOUNDARY).map((c) => c.trim()).filter(Boolean);
  let i = 0;
  // skip scene-setting clauses and one-word lists ("a trip, guests, a cold")
  while (i < clauses.length - 1 && (isScene(clauses[i], lang) || words(clauses[i]).length < 2)) i += 1;
  if (isScene(clauses[i], lang)) i = 0; // every clause is scene-like: keep the first
  let clause = clauses[i];
  while (i < clauses.length - 1 && (words(clause).length < 3 || isDangling(words(clause).at(-1), lang))) {
    i += 1;
    clause = `${clause}, ${clauses[i]}`;
  }
  let title = cutToLimit(clause.replace(/[.,;:!?]+$/u, ""), lang, limit);
  if (lang === "en") title = title.charAt(0).toUpperCase() + title.slice(1);
  return title;
}

/** True when the headline already says the whole do (the card then shows no body line). */
export const titleIsWholeDo = (title: string, doText: string): boolean =>
  title.trim().toLowerCase() === doText.trim().replace(/[.!?]+$/u, "").trim().toLowerCase();
