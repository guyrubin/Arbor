/** B-BOOK-66 technical preparation. No default bindings and no host activation.
 * A canonical book may join the existing Parent host only after a reviewer
 * supplies an explicit shelf and an exact snapshot of the parent copy.
 * Reading completion supplies no choice, score, inferred trait or observation.
 */
import type { Book, ParentPractice } from "../library/types";
import type { ShelfId } from "../shelves/registry";
import { SHELVES } from "../shelves/registry";
import { sharedObjectEligible, type SharedObject } from "./sharedObject";

export interface ReviewedCanonicalBinding {
  bookId: string;
  shelf: ShelfId;
  /** canonicalParentSnapshot(book), reviewed as a whole; edits invalidate it. */
  snapshot: string;
  clinicalEvidence: string;
  nativeHebrewEvidence: string;
}

export interface CanonicalSharedObject extends SharedObject {
  practises: readonly ParentPractice[];
}

/** Explicit projection: never serializes child reading state or story choices. */
export function canonicalParentSnapshot(book: Book): string {
  return JSON.stringify({
    id: book.id, title: book.title, coverLine: book.coverLine,
    tomorrow: book.parent.tomorrow ?? null, askAfter: book.parent.askAfter,
    practises: (book.parent.practises ?? []).map(({ id, act }) => ({ id, act })),
  });
}

const present = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export function canonicalBookHandback(book: Book, binding?: ReviewedCanonicalBinding | null): CanonicalSharedObject | null {
  if (!binding || (book.kind && book.kind !== "canonical") || book.id !== binding.bookId
    || !SHELVES.some(s => s.id === binding.shelf)
    || !present(binding.clinicalEvidence) || !present(binding.nativeHebrewEvidence)
    || binding.snapshot !== canonicalParentSnapshot(book) || !book.parent.tomorrow) return null;
  const acts = book.parent.practises ?? [];
  if (acts.length < 1 || acts.length > 2 || new Set(acts.map(p => p.id)).size !== acts.length
    || acts.some(p => !present(p.id) || !present(p.act.en) || !present(p.act.he))) return null;
  const object: CanonicalSharedObject = {
    id: book.id, shelf: binding.shelf, title: { ...book.title }, coverLine: { ...book.coverLine },
    tomorrow: { ...book.parent.tomorrow }, askAfter: { en: book.parent.askAfter.en, he: { ...book.parent.askAfter.he } },
    practises: acts.map(({ id, act }) => ({ id, act: { en: act.en, he: act.he } })),
  };
  return sharedObjectEligible(object) ? object : null;
}

/** Parent Together filter preparation. Unknown facets yield no guessed match. */
export function canonicalBooksPractising(objects: readonly CanonicalSharedObject[], practiceId: string): CanonicalSharedObject[] {
  const id = practiceId.trim();
  return id ? objects.filter(o => o.practises.some(p => p.id === id)) : [];
}
