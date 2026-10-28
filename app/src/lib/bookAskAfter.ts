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

export function bookAskAfter(bookId: string, lang: "en" | "he", gender: "boy" | "girl" | string | undefined, name: string): BookAskAfter | null {
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
    const q = lang === "he" ? story.parentReflection.questionsHe?.[0] : story.parentReflection.questions[0];
    const title = lang === "he" ? story.titleHe || story.title : story.title;
    return { title, question: q ? fillHero(q, name, lang).trim() : "" };
  }
  return null;
}
