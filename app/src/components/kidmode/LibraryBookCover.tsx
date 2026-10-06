/**
 * B-BOOK release — a library book's cover on a kid card: the child's printed
 * cover (their own hero, from the private book files), else the cover plate
 * (the scene, no child). Fills its box (object-fit cover). Decorative: the
 * card around it carries the title.
 */
import { useEffect, useState } from "react";
import { libraryBookCoverUrl, type LibraryBookEntry } from "../../lib/bookAssets";
import { plateSources } from "../../lib/library/bookPlates";
import { BOOK_PLATES } from "../../lib/library/books";

export function LibraryBookCover({ childId, entry }: { childId: string; entry: LibraryBookEntry }) {
  const [print, setPrint] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let url: string | null = null;
    void libraryBookCoverUrl(childId, entry.doc)
      .then((u) => {
        url = u;
        if (live) setPrint(u);
        else if (u) URL.revokeObjectURL(u);
      })
      .catch(() => {});
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [childId, entry.doc]);
  const plate = BOOK_PLATES[entry.book.id]?.[entry.book.cover.plateId];
  const src = print ?? (plate ? plateSources(plate, { dev: false })[0] : null);
  if (!src) return null;
  return <img src={src} alt="" aria-hidden="true" draggable={false} decoding="async" data-library-book-cover={entry.book.id} style={{ position: "absolute", inset: 0, inlineSize: "100%", blockSize: "100%", objectFit: "cover" }} />;
}
