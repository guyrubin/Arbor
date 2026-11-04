/** A stored private book sheet (including pose blobs) is visible only to its
 * exact account, child, book, hero and immutable manifest revision.
 * React renders on prop changes before effects can clear stale state. */
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";

export interface ScopedBookValue<T> {
  scope: string;
  value: T;
}

export function bookSheetOwnerScope(owner: string, childId: string, bookId: string, avatarHash: string): string {
  return JSON.stringify([owner, childId, bookId, avatarHash]);
}

export function bookSheetAssetScope(ownerScope: string, doc: BookAssetsDoc): string {
  return JSON.stringify([
    ownerScope, doc.id, doc.bookId, doc.sheetId, doc.setId, doc.createdAt ?? null,
    doc.files, doc.sheetManifest?.poses ?? null,
  ]);
}

export function visibleScopedBookValue<T>(stored: ScopedBookValue<T> | null, activeScope: string): T | null {
  return stored && stored.scope === activeScope ? stored.value : null;
}

/** Never render a private book-sheet document from an unconfirmed snapshot.
 * A cached/pending Firestore read is not proof that this account may view the
 * document; the same rule applies after listener failures or sign-out. */
export function confirmedBookSheetDoc<T extends BookAssetsDoc>(
  owner: string, confirmed: boolean, error: boolean,
  rows: readonly T[], bookId: string, sheetId: string,
): T | null {
  if (owner === "signed-out" || !confirmed || error) return null;
  return rows.find((row) => row?.bookId === bookId && row.sheetId === sheetId) ?? null;
}

/** A redraw result is also private data: a matching component scope alone does
 * not validate an account's still-pending or failed collection read. */
export function confirmedScopedBookValue<T>(
  owner: string, confirmed: boolean, error: boolean,
  stored: ScopedBookValue<T> | null, activeScope: string,
): T | null {
  if (owner === "signed-out" || !confirmed || error) return null;
  return visibleScopedBookValue(stored, activeScope);
}
