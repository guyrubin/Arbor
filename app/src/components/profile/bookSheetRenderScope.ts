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
