/**
 * lib/library/bookAssetPaths — B-BOOK release: the ONE rule for where a
 * child's private book files live and which relative paths may be asked for.
 * Shared by the server proxy (server/bookAssets.ts), the client loader
 * (lib/bookAssets.ts) and the admin upload script (scripts/upload-book-
 * assets.py mirrors it). Pure: no imports.
 *
 * Storage (server-only; storage.rules grants clients nothing outside
 * users/{uid}/): `children/{childId}/books/{bookId}/<rel>` where <rel> is
 *   hero-sheets/{sheetId}/<pose>.webp | .png
 *   hero-sheets/{sheetId}/choices/<choiceId>.webp | .png
 *   hero-sheets/{sheetId}/prints/<pageId>.webp | .png
 *   (K2: PNG too - Safari cannot encode WebP from a canvas, so an iPhone
 *   parent's device uploads PNG; lib/library/bookSheet)
 *   hero-sheets/{sheetId}/manifest.json
 *   narration/{setId}/<en|he-m|he-f>/<file>.mp3 | .wav | .cues.json
 *   manifest.json
 * These files show (likeness) or speak (name) the child: they are never in
 * git and never on a public path; the app reads them only through
 * GET /api/children/:childId/book-assets/:bookId/file?path=<rel> (owner-checked).
 */

/** An id segment: letters, digits, '-', '_' (1-64). */
export const BOOK_ASSET_ID = /^[A-Za-z0-9_-]{1,64}$/;

const SEG = "[A-Za-z0-9_-]{1,64}";
const REL = new RegExp(
  "^(?:" +
    "manifest\\.json" +
    `|hero-sheets/${SEG}/(?:(?:choices|prints)/)?${SEG}\\.(?:webp|png)` +
    `|hero-sheets/${SEG}/manifest\\.json` +
    `|narration/${SEG}/(?:en|he-m|he-f)/${SEG}(?:\\.${SEG})*\\.(?:mp3|wav|json)` +
    ")$",
);

/** May this relative path be stored / served? (No "..", no other shape.) */
export function isBookAssetRel(rel: string): boolean {
  return typeof rel === "string" && rel.length <= 200 && !rel.includes("..") && !rel.includes("//") && REL.test(rel);
}

/** The Storage prefix of every book file of one child (the erase sweep). */
export function childBookAssetPrefix(childId: string): string {
  if (!BOOK_ASSET_ID.test(childId)) throw new Error("bad child id");
  return `children/${childId}/books/`;
}

/** The Storage object name of one file. */
export function bookAssetObject(childId: string, bookId: string, rel: string): string {
  if (!BOOK_ASSET_ID.test(bookId) || !isBookAssetRel(rel)) throw new Error("bad book asset path");
  return `${childBookAssetPrefix(childId)}${bookId}/${rel}`;
}

/** The content type a file is served with. */
export function bookAssetContentType(rel: string): string {
  if (rel.endsWith(".webp")) return "image/webp";
  if (rel.endsWith(".png")) return "image/png";
  if (rel.endsWith(".mp3")) return "audio/mpeg";
  if (rel.endsWith(".wav")) return "audio/wav";
  return "application/json";
}

/** The app's URL for one file (same origin; the caller adds its bearer token). */
export function bookAssetUrl(childId: string, bookId: string, rel: string): string {
  return `/api/children/${encodeURIComponent(childId)}/book-assets/${encodeURIComponent(bookId)}/file?path=${encodeURIComponent(rel)}`;
}

/** The Firestore metadata of one child's book files:
 *  users/{uid}/children/{childId}/bookAssets/{bookId} (registered in
 *  CHILD_SUBCOLLECTIONS: exported and erased with the child). Written by the
 *  admin upload script. */
export interface BookAssetsDoc {
  /** = bookId. */
  id: string;
  bookId: string;
  sheetId: string;
  /** The narration set the reader plays (the first of `sets`). */
  setId: string;
  sets?: string[];
  /** The hero sheet's manifest (poses with anchors, prints, choices). */
  sheetManifest: {
    /** `redrawn`: the parent's one Redraw of a built book pose is spent (K2 4d). */
    poses: Record<string, { file: string; aspect?: number; footX?: number; footW?: number; redrawn?: boolean }>;
    prints?: Record<string, { file: string; w?: number; h?: number }>;
    choices?: Record<string, string>;
  };
  /** Every stored relative path (isBookAssetRel). */
  files: string[];
  bytes: number;
  createdAt: string;
}
