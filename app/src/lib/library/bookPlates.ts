/**
 * lib/library/bookPlates — B-BOOK-01 (+ RULINGS BR6): the plate model of the
 * new kid library (lane B §4.8: a registry beside kidThemeManifest, not an
 * extension of it). A plate is a 3:2 master (target 1536x1024 WebP or 2K),
 * child-free and text-free, at `public/visuals/books/<bookId>/<plateId>.webp`.
 * The plate author owns, in master space: the 3:4 phone window (`window.cx`),
 * the calm text zone of a spread page (`textZone`), and the choice-card focus
 * rects of a decision plate (`focus`). A branch variant is an edit of a base
 * plate (`variantOf`). Each book ships its own plate table next to its data
 * (lib/library/books/*); this module holds no book.
 *
 * Provenance starts EMPTY: a plate is only proven child-free / text-free when
 * Fable has viewed it (lane B §4.9). Until the real plates exist the DEV build
 * falls back to a flat placeholder at `public/_dev/plates/<bookId>/<plateId>.webp`
 * (scripts/dev-book-placeholders.py; `public/_dev/` is git-ignored). The
 * production build never resolves a placeholder.
 *
 * No imports from api/* — reading a book requests static files only.
 */

export type LightRig = "morning" | "day" | "golden" | "dusk" | "night";

/** A rect in fractions of the master plate. */
export interface PlateRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BookPlate {
  id: string;
  bookId: string;
  /** Public URL of the real master plate. */
  file: string;
  width: number;
  height: number;
  light: LightRig;
  /** Key light along x (> 0 = from the left); a slot's own lightDx wins. */
  lightDx?: number;
  /** The base plate this one is an edit of (a branch variant). */
  variantOf?: string;
  /** The authored 3:4 window: its centre x (fraction of the master). */
  window: { cx: number };
  /** The calm zone for the paper text panel on a spread page (logical side). */
  textZone?: "inline-start" | "inline-end" | "bottom";
  /** Decision plates: the crop shown on each choice card, keyed by choice id. */
  focus?: Record<string, PlateRect>;
  /** Optional foreground occluder (alpha WebP, same box as the master). */
  fg?: string;
  provenance: {
    childFree: boolean;
    textFree: boolean;
    /** Who viewed the plate full size (lane B §4.9); null = not yet viewed. */
    reviewedBy: string | null;
  };
}

export type PlateTable = Readonly<Record<string, BookPlate>>;

/** The master plate size the proof plates are authored at. */
export const PLATE_MASTER = { width: 1536, height: 1024 } as const;

/** A plate entry with the path convention and empty provenance. */
export function makePlate(
  bookId: string,
  id: string,
  light: LightRig,
  extra: Partial<Omit<BookPlate, "id" | "bookId" | "file" | "light">> = {},
): BookPlate {
  return {
    id,
    bookId,
    file: `/visuals/books/${bookId}/${id}.webp`,
    width: PLATE_MASTER.width,
    height: PLATE_MASTER.height,
    light,
    window: { cx: 0.5 },
    provenance: { childFree: false, textFree: false, reviewedBy: null },
    ...extra,
  };
}

/** The DEV placeholder for a plate (never committed, never in production). */
export function devPlaceholderPath(bookId: string, plateId: string): string {
  return `/_dev/plates/${bookId}/${plateId}.webp`;
}

/** The sources to try, in order: the real plate, then (DEV only) the
 *  placeholder. The renderer advances on an image error, so a missing real
 *  file falls back without a request to anything but static files. */
export function plateSources(p: BookPlate, opts: { dev: boolean }): string[] {
  return opts.dev ? [p.file, devPlaceholderPath(p.bookId, p.id)] : [p.file];
}

/** The sources of an overlay layer: its own file, then (DEV only) the
 *  placeholder convention `public/_dev/overlays/<bookId>/<overlayId>.webp`. */
export function overlaySources(bookId: string, overlay: { id: string; file: string }, opts: { dev: boolean }): string[] {
  return opts.dev ? [overlay.file, `/_dev/overlays/${bookId}/${overlay.id}.webp`] : [overlay.file];
}

/** CSS background geometry that shows `rect` of a plate inside a box of
 *  `boxW` x `boxH` px (cover-fit, centred on the rect, never stretched). */
export function focusBackground(p: { width: number; height: number }, rect: PlateRect, boxW: number, boxH: number): { size: string; position: string } {
  const rw = rect.w * p.width;
  const rh = rect.h * p.height;
  const scale = Math.max(boxW / rw, boxH / rh);
  const bgW = p.width * scale;
  const bgH = p.height * scale;
  const cx = (rect.x + rect.w / 2) * bgW;
  const cy = (rect.y + rect.h / 2) * bgH;
  const left = Math.min(0, Math.max(boxW - bgW, boxW / 2 - cx));
  const top = Math.min(0, Math.max(boxH - bgH, boxH / 2 - cy));
  return { size: `${bgW.toFixed(1)}px ${bgH.toFixed(1)}px`, position: `${left.toFixed(1)}px ${top.toFixed(1)}px` };
}
