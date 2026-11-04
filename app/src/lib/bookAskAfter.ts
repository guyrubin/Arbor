/**
 * bookAskAfter — B-BOOK-47: the finished book's title and its AUTHORED
 * ask-after question, for the parent's exit recap (parent register only).
 * One question per book, written for every path: never the path or the
 * choice the child took (the read ledger does not even hold one). A library
 * book: `parent.askAfter`; a plan book: its pattern's `parent.askAfter`; a
 * legacy story: the first `parentReflection` question. The child's name token
 * is filled with the first name.
 */
import { getLibraryBook } from "./library/books";
import { getPattern } from "./library/plans/planBooks";
import { fillHero, heGender, lineFor } from "./library/bookText";
import type { BookLine } from "./library/types";
import { getStorySpec } from "./heroJourneys";

export interface BookAskAfter {
  title: string;
  question: string;
}

/**
 * B-BOOK-47: the Hebrew ask-after of the six shelf stories, which carry no
 * authored Hebrew reflection question. Parent register: the parent asks the
 * child, so the question speaks to ONE child in the singular second person
 * (wave-3 carry-over: the first pass addressed the parents in the plural).
 * Every verb is in a form whose unpointed spelling is the same for a boy and
 * a girl (past tense, "לך"), so one string serves both; only David's needs a
 * gendered adjective (קטן / קטנה). One question per story (Moses's two became
 * one). No niqqud. Each follows the story's first English question. AI-written,
 * native review owed (B-GA-03 packet).
 */
export const SHELF_ASK_AFTER_HE: Readonly<Record<string, { m: string; f: string }>> = {
  "david-and-goliath": { m: "מתי הרגשת קטן היום, כמו דוד?", f: "מתי הרגשת קטנה היום, כמו דוד?" },
  "moses-and-pharaoh": both("מה עזר לך לדבר עם המלך, גם כשהיה מפחיד?"),
  "noahs-ark": both("למה המשכת לבנות את התיבה, גם כשצחקו?"),
  "jonah-and-the-great-fish": both("למה רצית לברוח בהתחלה?"),
  "joseph-and-his-brothers": both("היו ימים קשים מאוד. מה עזר לך להמשיך לקוות?"),
  "jacob-wrestling-the-angel": both("המאבק נמשך כל הלילה. מה עזר לך להחזיק מעמד?"),
};

function both(q: string): { m: string; f: string } {
  return { m: q, f: q };
}

/** Parent copy carries no niqqud or cantillation (the kid books do); maqaf and
 *  punctuation stay. */
export function withoutNiqqud(text: string): string {
  return text.replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, "");
}

export function bookAskAfter(bookId: string, lang: "en" | "he", gender: "boy" | "girl" | string | undefined, name: string): BookAskAfter | null {
  const r = resolve(bookId, lang, gender, name);
  return r && lang === "he" ? { title: withoutNiqqud(r.title), question: withoutNiqqud(r.question) } : r;
}

function resolve(bookId: string, lang: "en" | "he", gender: "boy" | "girl" | string | undefined, name: string): BookAskAfter | null {
  const g = heGender(gender === "girl" ? "girl" : gender === "boy" ? "boy" : undefined);
  const line = (l: BookLine) => fillHero(lineFor(l, lang, g), name, lang).trim();
  const book = getLibraryBook(bookId);
  if (book) return { title: lang === "he" ? book.title.he : book.title.en, question: line(book.parent.askAfter) };
  const plan = getPattern(bookId);
  if (plan) return { title: lang === "he" ? plan.title.he : plan.title.en, question: line(plan.parent.askAfter) };
  const story = getStorySpec(bookId);
  if (story) {
    // A story without an authored Hebrew question is named by its title alone
    // (never an English question inside a Hebrew line; HeroJourneyTab's rule).
    const q = lang === "he" ? (story.parentReflection.questionsHe?.[0] ?? SHELF_ASK_AFTER_HE[story.id]?.[g]) : story.parentReflection.questions[0];
    const title = lang === "he" ? story.titleHe || story.title : story.title;
    return { title, question: q ? fillHero(q, name, lang).trim() : "" };
  }
  return null;
}
