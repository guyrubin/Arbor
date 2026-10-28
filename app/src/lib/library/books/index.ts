/**
 * lib/library/books — B-BOOK-02: the authored books of the new kid library and
 * their plate tables. Not wired into the production kid library (the proof is
 * reviewed through the DEV route only — components/library/devBookRoute.tsx).
 *
 * - LIBRARY_BOOKS: real books — "Five Smooth Stones" (the proof, RULINGS BR1).
 * - FIXTURE_BOOKS: "Abram's Long Road", the engine's test fixture, reviewable
 *   on the DEV route.
 */
import type { BookPlate, PlateTable } from "../bookPlates";
import { getPlanFixtureBook } from "../plans/planBooks";
import { planPlateTable } from "../plans/planPlates";
import { isPlanBook, type AnyBook, type Book } from "../types";
import { abramsLongRoad, abramsLongRoadPlates } from "./abramsLongRoad";
import { fiveSmoothStones, fiveSmoothStonesPlates } from "./fiveSmoothStones";

export const LIBRARY_BOOKS: Readonly<Record<string, Book>> = {
  [fiveSmoothStones.id]: fiveSmoothStones,
};

/** The book the DEV review route opens when none is named. */
export const DEFAULT_REVIEW_BOOK = fiveSmoothStones.id;

export const FIXTURE_BOOKS: Readonly<Record<string, Book>> = {
  [abramsLongRoad.id]: abramsLongRoad,
};

/** Plate tables, keyed by book id. */
export const BOOK_PLATES: Readonly<Record<string, PlateTable>> = {
  [fiveSmoothStones.id]: fiveSmoothStonesPlates,
  [abramsLongRoad.id]: abramsLongRoadPlates,
};

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** A real book, else a fixture book, else undefined. */
export function getLibraryBook(id: string): Book | undefined {
  if (own(LIBRARY_BOOKS, id)) return LIBRARY_BOOKS[id];
  return own(FIXTURE_BOOKS, id) ? FIXTURE_BOOKS[id] : undefined;
}

export function getPlate(bookId: string, plateId: string): BookPlate | undefined {
  const table = own(BOOK_PLATES, bookId) ? BOOK_PLATES[bookId] : undefined;
  return table && own(table, plateId) ? table[plateId] : undefined;
}

/** Every book the DEV route and the tests know (real + fixtures). */
export function allBooks(): Book[] {
  return [...Object.values(LIBRARY_BOOKS), ...Object.values(FIXTURE_BOOKS)];
}

/** B-BOOK-75: a book of ANY kind the DEV route and the tests know — a real or
 *  fixture canonical book, else a composed fixture PLAN book (`<pattern>--demo`).
 *  Production plan books are per-child documents (lib/library/plans/planBookDoc),
 *  never looked up here. */
export function getAnyBook(id: string): AnyBook | undefined {
  return getLibraryBook(id) ?? getPlanFixtureBook(id);
}

/** The plate table a book reads from: its own (canonical) or its pattern's
 *  shared table (plan). */
export function bookPlatesFor(book: AnyBook): PlateTable {
  if (isPlanBook(book)) return planPlateTable(book.pattern);
  return own(BOOK_PLATES, book.id) ? BOOK_PLATES[book.id] : {};
}
