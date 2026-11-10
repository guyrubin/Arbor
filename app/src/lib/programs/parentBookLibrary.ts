/** Parent-only projection of books already available to this family. */
import type { LibraryBookEntry } from "../bookAssets";
import { isPlanBook } from "../library/types";
import { canonicalBookHandback, type CanonicalSharedObject, type ReviewedCanonicalBinding } from "./canonicalBookHandback";

/** Intentionally empty until exact-copy clinical and native-Hebrew reviews exist. */
export const REVIEWED_CANONICAL_BINDINGS: readonly ReviewedCanonicalBinding[] = [];
export interface ParentPracticeBook { entry: LibraryBookEntry; object: CanonicalSharedObject }

export function reviewedParentBooks(entries: readonly LibraryBookEntry[], bindings = REVIEWED_CANONICAL_BINDINGS): ParentPracticeBook[] {
  return entries.flatMap(entry => {
    if (isPlanBook(entry.book)) return [];
    const matching = bindings.filter(binding => binding.bookId === entry.book.id);
    if (matching.length !== 1 || entries.filter(e => e.book.id === entry.book.id).length !== 1) return [];
    const object = canonicalBookHandback(entry.book, matching[0]);
    return object ? [{ entry, object }] : [];
  });
}

/** A catalogue pattern resolves only to the family's one composed book. */
export function ownedHandbackBook(entries: readonly LibraryBookEntry[], objectId: string): LibraryBookEntry | null {
  const matches = entries.filter(({ book }) => isPlanBook(book) ? book.pattern === objectId : book.id === objectId);
  return matches.length === 1 ? matches[0] : null;
}

