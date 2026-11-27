/**
 * bookReads — B-BOOK-51 (X28): the ONE finished-book ledger.
 *
 * `users/{uid}/children/{cid}/bookReads/{id}`: one row per book the child
 * read to its true ending in Kid Mode — a library book (the reader's
 * last-page → END transition through `trueEndingGate`, see
 * components/library/useBookProgress) or a legacy story (its finish). The row
 * is the catalogue book id, the language and the time. Never the path or the
 * choice the child took, never anything the child got right: a read is not
 * evidence about the child. Per-child data → CHILD_SUBCOLLECTIONS (export +
 * erase).
 *
 * WRITE: `bookReadRow` only, beside `trackBookFinished` (the same moment, the
 * same catalogue id), and only when `trueEndingGate` says this opening just
 * reached its true ending.
 *
 * READ: `ledgerFinishes` only. Every surface that asks "did this child finish
 * this book, and when" derives from it — the parent's exit recap (B-BOOK-47,
 * `lastReadSince`), the program hand-back (B-PROG-16, lib/programs/
 * sharedObject), the offline shelf (lib/kidOfflineArt) and the kid shelf's
 * read mark (components/kidmode/kidBooks, which also accepts the legacy
 * heroRuns completion shape). Stored rows are never rewritten: a row the
 * reader cannot trust (non-catalogue id, unparsable or future time) is
 * skipped, and a row written before `lang` was kept reads with `lang: null`.
 */
import type { AnyBook } from "./library/types";
import { isPlanBook } from "./library/types";
import { COVER, END, isEnding, type BookFlowState } from "./library/bookFlow";
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

/**
 * V2 true-ending semantics (B-BOOK-51): the ONE rule for "this opening
 * finished this book". Feed it every navigation step (the state before and
 * after); it answers true at most once per opening, when:
 *   1. the step is a forward turn from the LAST page of a committed path to
 *      END (a book with a decision has its choice made; the reducer already
 *      refuses to turn past an undone repair, and there is no page jump);
 *   2. the opening is armed: it did not open on a saved END. A resumed END is
 *      a finished book already counted — paging back off it and forward again
 *      is not a new finish. "Read again" (back to the cover) arms it, so a
 *      full re-read from a saved END is a finish;
 *   3. this opening has not finished already: END → back → END, or Read
 *      again inside the same opening, is the same sitting. Replays count as
 *      new finishes only in a new opening (close the book and open it again).
 * A resumed mid-book bookmark is armed: reaching the end from it is the first
 * true ending of that read.
 */
export function trueEndingGate(initial: Pick<BookFlowState, "at">): (book: AnyBook, before: BookFlowState, after: BookFlowState) => boolean {
  let armed = initial.at !== END;
  let done = false;
  return (book, before, after) => {
    if (after.at === COVER) armed = true;
    if (done || !armed || after.at !== END || before.at === END || !isEnding(book, before)) return false;
    done = true;
    return true;
  };
}

/** One ledger finish, as every reader sees it. `row` is the stored row itself. */
export interface LedgerFinish<T = unknown> {
  bookId: string;
  /** null: a row from before the language was kept. */
  lang: "en" | "he" | null;
  at: number;
  row: T;
}

/**
 * The ONE reader of the ledger. Accepts every stored row shape — the current
 * {id, bookId, lang, finishedAt} and the B-BOOK-13 shape (keys ⊆ {bookId,
 * lang, finishedAt}, no id, maybe no lang) — and skips, without touching, a
 * row whose book id is not a catalogue id (a child id, an edition key, a
 * padded or empty id) or whose time is unparsable or after `nowMs` (a device
 * clock error must never invent a finish).
 */
export function ledgerFinishes<T>(rows: readonly T[] | null | undefined, nowMs: number = Date.now()): LedgerFinish<T>[] {
  if (!Array.isArray(rows) || !Number.isFinite(nowMs)) return [];
  const out: LedgerFinish<T>[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as { bookId?: unknown; finishedAt?: unknown; lang?: unknown };
    const bookId = catalogueId(typeof r.bookId === "string" ? r.bookId.trim() : r.bookId);
    if (!bookId || typeof r.finishedAt !== "string" || !r.finishedAt.trim()) continue;
    const at = Date.parse(r.finishedAt);
    if (!Number.isFinite(at) || at < 0 || at > nowMs) continue;
    out.push({ bookId, lang: r.lang === "he" ? "he" : r.lang === "en" ? "en" : null, at, row });
  }
  return out;
}

/** The latest ledger finish of each book (catalogue id → time). */
export function lastFinishByBook(rows: readonly unknown[] | null | undefined, nowMs: number = Date.now()): Map<string, number> {
  const last = new Map<string, number>();
  for (const f of ledgerFinishes(rows, nowMs)) if (f.at > (last.get(f.bookId) ?? -Infinity)) last.set(f.bookId, f.at);
  return last;
}

/**
 * B-BOOK-47 / B-BOOK-51: select the latest genuine completed read from this
 * Kid Mode visit. Reject malformed, non-catalogue and future-dated rows:
 * device-clock mistakes or stale imported data must never invent a book-finish
 * hand-back. Apply the same catalogue-ID allow-list used when rows are written,
 * so an imported per-child/edition key cannot win the parent recap.
 *
 * `nowMs` is injectable to make the time boundary deterministic in tests; the
 * exit path uses the actual current clock. No story branch/choice is read.
 */
export function lastReadSince<T extends Pick<BookRead, "bookId" | "finishedAt">>(
  reads: readonly T[],
  sinceMs: number,
  nowMs: number = Date.now(),
): T | null {
  if (!Number.isFinite(sinceMs) || !Number.isFinite(nowMs) || nowMs < sinceMs) return null;
  let best: LedgerFinish<T> | null = null;
  for (const f of ledgerFinishes(reads, nowMs)) if (f.at >= sinceMs && (!best || f.at > best.at)) best = f;
  return best?.row ?? null;
}
