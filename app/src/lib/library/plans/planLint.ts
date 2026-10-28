/**
 * lib/library/plans/planLint — B-KID-167 (standard §2, §5; extends the
 * B-BOOK-33 manuscript lint for PLAN books). Pure rules over the child's text
 * of a composed plan book, each returning the lines that break it:
 *
 *  - words per page, by band (EN ≤ 25 / 40 / 55; HE ≤ 34 for 5–7);
 *  - first person: never "you" / "your"; never should / must / have to about
 *    the child (a negated "do not have to" is the no-pressure rule and passes);
 *  - the descriptive : directive sentence ratio ≥ 2 : 1 over the whole book
 *    (Carol Gray) — a plan that is mostly instructions is a chore chart;
 *  - zero virtue nouns and zero diagnosis nouns, EN and HE (the shared §5
 *    lists plus the pattern's own banned words);
 *  - zero verdicts ("good boy", "big boy now", "I am brave" as a conclusion);
 *  - `{name}` only on the cover name line and a frame line; no Hebrew prefix
 *    glued to `{name}`; HE-f present on every line; NFC;
 *  - no digit on a child page except a time ("5 minutes" / "5 דקות").
 *
 * The directive detector is a word list, not a parser: a sentence counts as
 * directive when it is a first-person plan act ("we sit", "I set my timer",
 * "we just try"). Tests plant violations and prove each rule bites.

 *
 * The word lists are pipe-joined strings split at runtime, so no single
 * word literal here reads as a Material Symbols glyph name to the icon-font
 * subset scanner (scripts/build-icon-font).
 */
import { allBookPages } from "../bookShape";
import type { BookLine, PlanBook } from "../types";

export type PlanBand = "3-4" | "5-7" | "8-10";

export const EN_WORD_CAP: Record<PlanBand, number> = { "3-4": 25, "5-7": 40, "8-10": 55 };
export const HE_WORD_CAP: Record<PlanBand, number> = { "3-4": 22, "5-7": 34, "8-10": 46 };

/** Diagnosis nouns a plan never says to a child (standard §5). */
export const DIAGNOSIS_NOUNS_EN = "constipation|encopresis|anxiety|disorder|delay|phobia|tantrum|problem|diagnosis|symptom|condition".split("|");
export const DIAGNOSIS_NOUNS_HE = "עצירות|חרדה|הפרעה|איחור|בעיה|התקף|אבחנה|תסמין".split("|");

/** Virtue nouns (kid-books-standard §3; the lint bans them as conclusions
 *  about the child). */
export const VIRTUE_NOUNS_EN = "brave|bravery|courage|courageous|good boy|good girl|big boy|big girl|clever|smart|kind|kindness|patient|patience|strong|responsible|mature|proud of you|well done|good job".split("|");
export const VIRTUE_NOUNS_HE = "אמיץ|אמיצה|אומץ|ילד טוב|ילדה טובה|ילד גדול|ילדה גדולה|גיבור|גיבורה|חכם|חכמה|כל הכבוד|מנומס|מנומסת|אחראי|אחראית".split("|");

/** Second person and pressure modals (negated "do not have to" passes). */
const YOU_EN = /\b(you|your|yours|yourself)\b/i;
const MODAL_EN = /(?<!\b(?:not|never|don't|do not|doesn't|does not)\s)\b(should|must|have to|has to|need to|ought to)\b/i;
const YOU_HE = /(^|\s)(אתה|אתם|אתן|שלך|שלכם|שלכן)(\s|[.,!?]|$)/;
const MODAL_HE = /(?<!לא )(חייב|חייבת|צריך|צריכה|אסור)(\s|[.,!?]|$)/;

/** A digit is allowed only as a time: "5 minutes" / "5 דקות" / "5 min". */
const DIGIT_NOT_TIME = /\d+(?!\s*(?:minutes?|min|דקות|דקה)(?![\p{L}]))/u;

/** First-person plan acts (the directive sentences). */
const DIRECTIVE_EN = /\b(we|i)\s+(just\s+)?(sit|sits|try|tries|put|set|take|go|wait|hold|stay|come|say|breathe|blow|taste|pick|start|stop|turn|count|get|brush|lie|walk|hug|do them|do it|do the)\b/i;
const DIRECTIVE_HE = /(^|\s)(אנחנו|אני)\s+(רק\s+)?(יושב|יושבת|יושבים|מנסה|מנסים|שמים|שם|שמה|הולכים|הולך|הולכת|מחכים|מחכה|נושמים|נושם|נושמת|מנשף|מנשפת|מנשפים|טועם|טועמת|טועמים|עושים|עושה|מתחילים|עוצרים|סופרים|נשכב|נשכבת|נשכבים|מצחצח|מצחצחת|מצחצחים|שוכבים|שוכב|שוכבת|קמים|קם|קמה)(\s|[.,!?]|$)/;

export interface LintHit {
  rule: string;
  pageId: string;
  lang: "en" | "he-m" | "he-f";
  text: string;
  detail?: string;
}

export const words = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]|\{name\}/u.test(w)).length;

/** Sentences of a line (EN or HE), trimmed, non-empty. */
export function sentences(text: string): string[] {
  return text
    .replace(/\{name\}/g, "Name")
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isDirective(sentence: string, lang: "en" | "he"): boolean {
  return lang === "en" ? DIRECTIVE_EN.test(sentence) : DIRECTIVE_HE.test(sentence);
}

/** Pages the child reads: cover + pages; the cover's text is its cover line. */
function childLines(book: PlanBook): { pageId: string; line: BookLine; frame: boolean }[] {
  const out: { pageId: string; line: BookLine; frame: boolean }[] = [];
  for (const p of allBookPages(book)) {
    out.push({ pageId: p.id, line: p.text, frame: false });
    if (p.closing) out.push({ pageId: p.id, line: p.closing, frame: true });
  }
  return out;
}

const variants = (line: BookLine): ["en" | "he-m" | "he-f", string][] => [["en", line.en], ["he-m", line.he.m], ["he-f", line.he.f]];

const hasWordEn = (text: string, w: string) => new RegExp(`(?<![\\p{L}])${w.replace(/\s+/g, "\\s+")}(?![\\p{L}])`, "iu").test(text);
const hasWordHe = (text: string, w: string) => new RegExp(`(^|[^\\p{L}])(?:[והבלמשכ]{0,2})${w}(?![\\p{L}])`, "u").test(text);

/** The band of a composed book from its age bands (the widest it claims). */
export function bandOf(book: Pick<PlanBook, "ageBands">): PlanBand {
  if (book.ageBands.some((b) => b === "6-8y" || b === "9-12y")) return book.ageBands.some((b) => b === "36m" || b === "48m" || b === "60m") ? "5-7" : "8-10";
  if (book.ageBands.every((b) => b === "24m" || b === "30m" || b === "36m" || b === "48m")) return "3-4";
  return "5-7";
}

/** Every lint hit on a composed plan book (empty = clean). */
export function lintPlanBook(book: PlanBook, opts: { band?: PlanBand; bannedEn?: string[]; bannedHe?: string[] } = {}): LintHit[] {
  const band = opts.band ?? bandOf(book);
  const hits: LintHit[] = [];
  const en = [...DIAGNOSIS_NOUNS_EN, ...(opts.bannedEn ?? [])];
  const he = [...DIAGNOSIS_NOUNS_HE, ...(opts.bannedHe ?? [])];
  let descriptive = 0;
  let directive = 0;
  const lines = childLines(book);

  for (const { pageId, line, frame } of lines) {
    for (const [lang, text] of variants(line)) {
      const isHe = lang !== "en";
      if (!text.trim()) hits.push({ rule: "missing", pageId, lang, text });
      if (isHe && text !== text.normalize("NFC")) hits.push({ rule: "not-nfc", pageId, lang, text });
      if (isHe && !/[֐-׿]/.test(text)) hits.push({ rule: "hebrew", pageId, lang, text });
      if (!isHe && /[֐-׿]/.test(text)) hits.push({ rule: "hebrew-in-en", pageId, lang, text });
      const cap = isHe ? HE_WORD_CAP[band] : EN_WORD_CAP[band];
      if (pageId !== "cover" && !frame && words(text) > cap) hits.push({ rule: "words", pageId, lang, text, detail: `${words(text)} > ${cap}` });
      if (isHe ? YOU_HE.test(text) : YOU_EN.test(text)) hits.push({ rule: "second-person", pageId, lang, text });
      if (isHe ? MODAL_HE.test(text) : MODAL_EN.test(text)) hits.push({ rule: "pressure-modal", pageId, lang, text });
      for (const w of isHe ? he : en) if (isHe ? hasWordHe(text, w) : hasWordEn(text, w)) hits.push({ rule: "diagnosis-noun", pageId, lang, text, detail: w });
      for (const w of isHe ? VIRTUE_NOUNS_HE : VIRTUE_NOUNS_EN) if (isHe ? hasWordHe(text, w) : hasWordEn(text, w)) hits.push({ rule: "virtue-noun", pageId, lang, text, detail: w });
      if (DIGIT_NOT_TIME.test(text)) hits.push({ rule: "digit", pageId, lang, text });
      if (/\{name\}/.test(text) && !(pageId === "cover" || frame)) hits.push({ rule: "name-placement", pageId, lang, text });
      if (isHe && /[והבלמשכ]\{name\}/.test(text)) hits.push({ rule: "name-prefix", pageId, lang, text });
      if (lang === "en" && pageId !== "cover" && !frame) {
        for (const s of sentences(text)) (isDirective(s, "en") ? directive++ : descriptive++);
      }
    }
  }
  if (/\{name\}/.test(book.title.en + book.title.he)) hits.push({ rule: "name-placement", pageId: "title", lang: "en", text: book.title.en });
  if (directive > 0 && descriptive / directive < 2) hits.push({ rule: "ratio", pageId: "book", lang: "en", text: `${descriptive} descriptive : ${directive} directive`, detail: "descriptive:directive must be ≥ 2:1" });
  if (directive === 0) hits.push({ rule: "ratio", pageId: "book", lang: "en", text: "no directive sentence", detail: "a plan tells at least one act" });
  return hits;
}

/** The descriptive : directive counts (for the review packet). */
export function sentenceRatio(book: PlanBook): { descriptive: number; directive: number } {
  let descriptive = 0;
  let directive = 0;
  for (const p of book.pages) for (const s of sentences(p.text.en)) (isDirective(s, "en") ? directive++ : descriptive++);
  return { descriptive, directive };
}
