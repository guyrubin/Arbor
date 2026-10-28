/**
 * lib/library/bookShape — B-BOOK-75: the ONE place that knows which parts a
 * kind of book has, so every consumer (flow, poses, sheet, bookmarks,
 * narration list, the reader) reads a canonical book and a PLAN book through
 * the same four questions and never reaches for `book.decision` directly.
 * Pure.
 */
import type { AnyBook, Book, Choice, Page } from "./types";
import { isPlanBook } from "./types";

/** The decision of a canonical book; a plan book has none. */
export function decisionOf(book: AnyBook): Book["decision"] | null {
  return isPlanBook(book) ? null : book.decision;
}

/** The choices a book offers ([] for a plan book). */
export function bookChoices(book: AnyBook): Choice[] {
  return decisionOf(book)?.choices ?? [];
}

/** The rejoin page id of a canonical book; null for a plan book. */
export function rejoinPageIdOf(book: AnyBook): string | null {
  return isPlanBook(book) ? null : book.rejoinPageId;
}

/** Every page a book can show: cover, linear pages, every branch page. */
export function allBookPages(book: AnyBook): Page[] {
  return [book.cover, ...book.pages, ...bookChoices(book).flatMap((c) => c.branch)];
}

/** The id narration files are keyed by: a plan book's pattern (its name-free
 *  pages are shared by every family who reads that pattern), else the book id. */
export function narrationBookId(book: AnyBook): string {
  return isPlanBook(book) ? book.pattern : book.id;
}
