/**
 * bookReads — B-BOOK-51 (X28): the ONE finished-book ledger.
 *
 * `users/{uid}/children/{cid}/bookReads/{id}`: one row per book the child
 * read to its true ending in Kid Mode — a library book (the reader's
 * last-page → END transition; a saved or resumed END never counts, see
 * components/library/useBookProgress) or a legacy story (its finish). The row
 * is the catalogue book id, the language and the time. Never the path or the
 * choice the child took, never anything the child got right: a read is not
 * evidence about the child. Per-child data → CHILD_SUBCOLLECTIONS (export +
 * erase). Readers: the parent's exit recap (B-BOOK-47) names the last book
 * read and its authored ask-after question.
 */
import type { AnyBook } from "./library/types";
import { isPlanBook } from "./library/types";
import { catalogueId } from "./kpiEvents";

export const BOOK_READS = "bookReads";

export interface BookRead {
  id: string;
  /** The catalogue id (a plan book: its pattern id, never its per-child row id). */
  bookId: string;
  lang: "en" | "he";
  finishedAt: string;
}

/** The catalogue id of a book (what analytics and the ledger name). */
export function catalogueBookId(book: AnyBook): string {
  return isPlanBook(book) ? book.pattern : book.id;
}

/** The ledger row of one finished read, or null for a non-catalogue id. */
export function bookReadRow(bookId: string, lang: string, now: Date): BookRead | null {
  const id = catalogueId(bookId);
  if (!id) return null;
  return { id: `${id}--${now.getTime()}`, bookId: id, lang: lang === "he" ? "he" : "en", finishedAt: now.toISOString() };
}

/** One finish per opening: the first call yields true, every later call false. */
export function finishOnce(): () => boolean {
  let done = false;
  return () => {
    if (done) return false;
    done = true;
    return true;
  };
}

/** The latest read finished at or after `sinceMs` (the Kid Mode session's start). */
export function lastReadSince(reads: readonly Pick<BookRead, "bookId" | "finishedAt">[], sinceMs: number): Pick<BookRead, "bookId" | "finishedAt"> | null {
  let best: Pick<BookRead, "bookId" | "finishedAt"> | null = null;
  let bestMs = -Infinity;
  for (const r of reads) {
    const ms = typeof r?.finishedAt === "string" ? Date.parse(r.finishedAt) : NaN;
    if (!Number.isFinite(ms) || ms < sinceMs || typeof r.bookId !== "string") continue;
    if (ms > bestMs) { best = r; bestMs = ms; }
  }
  return best;
}
