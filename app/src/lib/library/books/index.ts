/**
 * lib/library/books — B-BOOK-02: the authored books of the new kid library.
 * Not wired into the production kid library yet (the proof is reviewed through
 * the DEV route only — components/library/devBookRoute.tsx).
 */
import type { Book } from "../types";
import { abramsLongRoad } from "./abramsLongRoad";

export const LIBRARY_BOOKS: Readonly<Record<string, Book>> = {
  [abramsLongRoad.id]: abramsLongRoad,
};

export function getLibraryBook(id: string): Book | undefined {
  return Object.prototype.hasOwnProperty.call(LIBRARY_BOOKS, id) ? LIBRARY_BOOKS[id] : undefined;
}
