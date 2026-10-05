/**
 * lib/library/books — B-BOOK-02: the authored books of the new kid library and
 * their plate tables. Not wired into the production kid library (the proof is
 * reviewed through the DEV route only — components/library/devBookRoute.tsx).
 *
 * - LIBRARY_BOOKS: real books (empty until the David and Goliath file lands,
 *   RULINGS BR1 — add it here with its plate table).
 * - FIXTURE_BOOKS: "Abram's Long Road", the engine's test fixture, reviewable
 *   on the DEV route.
 */
import type { BookPlate, PlateTable } from "../bookPlates";
import type { Book } from "../types";
import { abramsLongRoad, abramsLongRoadPlates } from "./abramsLongRoad";

export const LIBRARY_BOOKS: Readonly<Record<string, Book>> = {};

export const FIXTURE_BOOKS: Readonly<Record<string, Book>> = {
  [abramsLongRoad.id]: abramsLongRoad,
};

/** Plate tables, keyed by book id. */
export const BOOK_PLATES: Readonly<Record<string, PlateTable>> = {
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
