/**
 * B-BOOK release — a library book's cover on a kid card: the child's printed
 * cover (their own hero, from the private book files), else (B-BOOK-26) the
 * cover plate's picture window with the child's OWN hero composited where the
 * book puts it — the reader's own stacked layout (pageWindowFractions, the
 * same layout object as <BookPage>), from the child's approved book sheet
 * through the owner-checked proxy. Never a shared picture of another child;
 * when the hero cannot be fetched, the plate window alone (a complete cover).
 * Decorative: the card around it carries the title.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { libraryBookCoverUrl, type LibraryBookEntry } from "../../lib/bookAssets";
import { fetchBookAsset } from "../../lib/bookAssetStore";
import { pageWindowFractions, type FracRect, type SpriteAnchor } from "../../lib/library/bookPageLayout";
import { plateSources } from "../../lib/library/bookPlates";
import { bookPlatesFor } from "../../lib/library/books";
import { heroSheetOwnerKey, subscribeHeroSheetOwner } from "../../lib/heroSheetStore";
import { bookCoverScopeKey, visibleBookCoverPrint, type ScopedBookCoverPrint } from "./bookCoverScope";
import { usePlanPlateSrcs } from "../../lib/plans/planPlateSource";

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
  // B-BOOK-26: the child's own cover pose, from their approved sheet (same owner/child/edition scope as the print).
  const cover = entry.book.cover;
  const own = coverHeroPose(entry);
  const pose = own?.pose ?? null;
  const poseFile = own?.rel ?? null;
  const [sprite, setSprite] = useState<ScopedBookCoverPrint | null>(null);
  useEffect(() => {
    let live = true;
    let url: string | null = null;
    setSprite(null);
    if (owner !== "signed-out" && poseFile) {
      void fetchBookAsset(childId, entry.doc, poseFile)
        .then((blob) => {
          if (!blob) return;
          const u = URL.createObjectURL(blob);
          url = u;
          if (live) setSprite({ scope, url: u });
          else URL.revokeObjectURL(u);
        })
        .catch(() => { if (live) setSprite(null); });
    }
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [owner, childId, entry.doc, scope, poseFile]);
  const plate = bookPlatesFor(entry.book)[cover.plateId];
  const win = useMemo(
    () => pageWindowFractions(cover, {
      plate,
      slot: cover.hero && pose ? { ...cover.hero, pose } : cover.hero,
      anchorOf: (p) => (p === pose ? own?.anchor : undefined),
    }),
    [cover, plate, pose, own?.anchor],
  );
  // B-BOOK-75 plates: a plan plate in shared storage is read through the signed-in route (blob: URL).
  const plateSrcs = usePlanPlateSrcs(plate ? plateSources(plate, { dev: false }) : []);
  const printed = visibleBookCoverPrint(print, scope);
  if (printed) return <img src={printed} alt="" aria-hidden="true" draggable={false} decoding="async" data-library-book-cover={entry.book.id} data-cover-hero="own-print" style={{ position: "absolute", inset: 0, inlineSize: "100%", blockSize: "100%", objectFit: "cover" }} />;
  const plateSrc = plateSrcs[0] ?? null;
  if (!plateSrc) return null;
  return <CoverWindow bookId={entry.book.id} plateSrc={plateSrc} heroSrc={visibleBookCoverPrint(sprite, scope)} win={win} />;
}

/** The child's own cover pose in their approved book sheet: the file (under
 *  THEIR sheet), its measured anchor, after the reader's stopgap rule
 *  (Book.poseFallbacks). null = the sheet has no picture for the cover. */
export function coverHeroPose(entry: Pick<LibraryBookEntry, "book" | "doc">): { pose: string; rel: string; anchor?: SpriteAnchor } | null {
  const poses = entry.doc.sheetManifest.poses ?? {};
  const has = (p: string) => Object.prototype.hasOwnProperty.call(poses, p);
  const asked = entry.book.cover.hero?.pose ?? null;
  if (!asked) return null;
  const stopgap = entry.book.poseFallbacks?.[asked];
  const pose = has(asked) ? asked : stopgap && has(stopgap) ? stopgap : null;
  if (!pose) return null;
  const p = poses[pose];
  const anchor = p.aspect != null && p.footX != null && p.footW != null ? { aspect: p.aspect, footX: p.footX, footW: p.footW } : undefined;
  return { pose, rel: `hero-sheets/${entry.doc.sheetId}/${p.file}`, ...(anchor ? { anchor } : {}) };
}

/** The cover's picture window: the plate, and the child's own hero where the
 *  book's layout puts it. Without the hero: the plate window alone (complete). */
export function CoverWindow({ bookId, plateSrc, heroSrc, win }: { bookId: string; plateSrc: string; heroSrc: string | null; win: ReturnType<typeof pageWindowFractions> }) {
  return (
    <span aria-hidden="true" data-library-book-cover={bookId} data-cover-hero={heroSrc && win.hero ? "own" : "none"} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* The book's 3:4 picture window, centred (object-fit: cover of the window).
          Physical left: book art is never mirrored in Hebrew (bookPageLayout). */}
      <span style={{ position: "absolute", insetBlock: 0, left: "50%", blockSize: "100%", aspectRatio: "3 / 4", transform: "translateX(-50%)" }}>
        <img src={plateSrc} alt="" draggable={false} decoding="async" style={fracStyle(win.plate)} />
        {heroSrc && win.hero && (
          <img src={heroSrc} alt="" draggable={false} decoding="async" data-cover-own-hero="" style={{ ...fracStyle(win.hero), objectFit: "contain", objectPosition: "50% 100%", transform: win.hero.flip ? "scaleX(-1)" : undefined }} />
        )}
      </span>
    </span>
  );
}

const pct = (n: number) => `${Math.round(n * 100000) / 1000}%`;
const fracStyle = (r: FracRect): CSSProperties => ({ position: "absolute", left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h), maxInlineSize: "none" });
