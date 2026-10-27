/**
 * B-BOOK release — a library book's cover on a kid card: the child's printed
 * cover (their own hero, from the private book files), else the cover plate
 * (the scene, no child). Fills its box (object-fit cover). Decorative: the
 * card around it carries the title.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { libraryBookCoverUrl, type LibraryBookEntry } from "../../lib/bookAssets";
import { plateSources } from "../../lib/library/bookPlates";
import { bookPlatesFor } from "../../lib/library/books";
import { heroSheetOwnerKey, subscribeHeroSheetOwner } from "../../lib/heroSheetStore";
import { bookCoverScopeKey, visibleBookCoverPrint, type ScopedBookCoverPrint } from "./bookCoverScope";

export function LibraryBookCover({ childId, entry }: { childId: string; entry: LibraryBookEntry }) {
  // This component can survive a child or auth switch. Checking only in the
  // fetch effect is too late: React renders the previous child's private blob
  // once with the new props. Gate every rendered URL by the CURRENT owner,
  // child and book-asset edition, then fall back to the shared hero-free plate.
  const owner = useSyncExternalStore(subscribeHeroSheetOwner, heroSheetOwnerKey, heroSheetOwnerKey);
  const scope = bookCoverScopeKey(owner, childId, entry.doc);
  const [print, setPrint] = useState<ScopedBookCoverPrint | null>(null);
  useEffect(() => {
    let live = true;
    let url: string | null = null;
    setPrint(null);
    if (owner !== "signed-out") {
      void libraryBookCoverUrl(childId, entry.doc)
        .then((u) => {
          url = u;
          if (live) setPrint(u ? { scope, url: u } : null);
          else if (u) URL.revokeObjectURL(u);
        })
        .catch(() => { if (live) setPrint(null); });
    }
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [owner, childId, entry.doc, scope]);
  const plate = bookPlatesFor(entry.book)[entry.book.cover.plateId];
  const src = visibleBookCoverPrint(print, scope) ?? (plate ? plateSources(plate, { dev: false })[0] : null);
  if (!src) return null;
  return <img src={src} alt="" aria-hidden="true" draggable={false} decoding="async" data-library-book-cover={entry.book.id} style={{ position: "absolute", inset: 0, inlineSize: "100%", blockSize: "100%", objectFit: "cover" }} />;
}
