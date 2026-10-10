/**
 * B-BOOK release — a library book's cover on a kid card: the child's printed
 * cover (their own hero, from the private book files), else the cover plate
 * (the scene, no child). Fills its box (object-fit cover). Decorative: the
 * card around it carries the title.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createBookAssetScope } from "../../lib/bookAssetStore";
import { libraryBookCoverUrl, type LibraryBookEntry } from "../../lib/bookAssets";
import { plateSources } from "../../lib/library/bookPlates";
import { BOOK_PLATES } from "../../lib/library/books";

export function LibraryBookCover({ childId, entry }: { childId: string; entry: LibraryBookEntry }) {
  const readKey = useMemo(() => ({ childId, doc: entry.doc }), [childId, entry.doc]);
  const currentRead = useRef(readKey);
  currentRead.current = readKey;
  const [print, setPrint] = useState<{ readKey: typeof readKey; url: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    let url: string | null = null;
    const scope = createBookAssetScope(childId, () => live && currentRead.current === readKey);
    const retired = () => {
      if (url) URL.revokeObjectURL(url);
      url = null;
      if (live) setPrint(null);
    };
    scope.signal.addEventListener("abort", retired, { once: true });
    setPrint(null);
    void libraryBookCoverUrl(childId, entry.doc, scope)
      .then((u) => {
        url = u;
        if (live && scope.current()) setPrint({ readKey, url: u });
        else if (u) URL.revokeObjectURL(u);
      })
      .catch(() => {});
    return () => {
      live = false;
      scope.signal.removeEventListener("abort", retired);
      scope.close();
      if (url) URL.revokeObjectURL(url);
    };
  }, [childId, entry.doc]);
  const plate = BOOK_PLATES[entry.book.id]?.[entry.book.cover.plateId];
  const src = (print?.readKey === readKey ? print.url : null) ?? (plate ? plateSources(plate, { dev: false })[0] : null);
  if (!src) return null;
  return <img src={src} alt="" aria-hidden="true" draggable={false} decoding="async" data-library-book-cover={entry.book.id} style={{ position: "absolute", inset: 0, inlineSize: "100%", blockSize: "100%", objectFit: "cover" }} />;
}
