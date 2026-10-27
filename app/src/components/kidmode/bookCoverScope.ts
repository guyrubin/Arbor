/**
 * B-BOOK-31 / B-KID-143 — an owned cover may be displayed only for the
 * account, child and immutable book-asset edition that fetched it.
 *
 * React state outlives prop changes by one render. The scope check must run
 * during render (not only in an effect), so a previously fetched child's
 * likeness is never the temporary placeholder for another child's cover.
 */
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";

export interface ScopedBookCoverPrint {
  scope: string;
  url: string;
}

export function bookCoverScopeKey(owner: string, childId: string, doc: BookAssetsDoc): string {
  return JSON.stringify([
    owner,
    childId,
    doc.bookId,
    doc.sheetId,
    doc.setId,
    doc.createdAt ?? null,
    doc.sheetManifest.prints?.cover?.file ?? null,
  ]);
}

export function visibleBookCoverPrint(state: ScopedBookCoverPrint | null, scope: string): string | null {
  return state?.scope === scope ? state.url : null;
}
