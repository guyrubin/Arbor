/**
 * B-BOOK release — the new library books THIS child can open in Kid Mode:
 * a book from lib/library whose `bookAssets` doc (the child's private hero
 * sheet + narration, uploaded by an admin) covers every pose the book needs.
 * Cloud-only (the files live in Storage); a sandbox child, or a child without
 * assets, gets [] — and the kid home is exactly as before (no silhouette, no
 * empty card).
 */
import { useMemo } from "react";
import { useChildCollection } from "../../hooks/useChildCollection";
import { libraryBookEntries, type LibraryBookEntry } from "../../lib/bookAssets";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";

export function useChildLibraryBooks(childId: string): LibraryBookEntry[] {
  const col = useChildCollection<BookAssetsDoc>(childId, "bookAssets");
  return useMemo(() => (col.remote && col.loaded ? libraryBookEntries(col.items) : []), [col.items, col.remote, col.loaded]);
}
