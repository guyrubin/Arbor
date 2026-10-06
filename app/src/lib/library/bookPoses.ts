/**
 * lib/library/bookPoses — B-BOOK release: which hero poses a book needs, and
 * whether a child's hero sheet covers them (the production door shows a book
 * ONLY to a child whose sheet is complete for it — no silhouette, ever).
 * Pure.
 */
import type { Book, Page } from "./types";

function pagesOf(book: Book): Page[] {
  return [book.cover, ...book.pages, ...book.decision.choices.flatMap((c) => c.branch)];
}

/** Every pose id the book can show: page slots, repair end slots, costume
 *  slots and art-state poses. */
export function bookPoseIds(book: Book): string[] {
  const out = new Set<string>();
  for (const p of pagesOf(book)) {
    if (p.hero) out.add(p.hero.pose);
    if (p.repair?.heroAfter) out.add(p.repair.heroAfter.pose);
    for (const s of Object.values(p.heroAlt ?? {})) out.add(s.pose);
    for (const st of p.artStates ?? []) if (st.pose) out.add(st.pose);
  }
  return [...out].sort();
}

/** The poses the sheet lacks for this book (a pose counts as present when the
 *  sheet has it or the book's stopgap for it). Empty = complete. */
export function missingBookPoses(book: Book, sheetPoses: Iterable<string>): string[] {
  const have = new Set(sheetPoses);
  return bookPoseIds(book).filter((pose) => !have.has(pose) && !(book.poseFallbacks?.[pose] && have.has(book.poseFallbacks[pose])));
}
