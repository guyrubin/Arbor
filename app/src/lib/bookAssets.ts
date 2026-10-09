/**
 * lib/bookAssets — B-BOOK release: the client side of a child's private book
 * files (server/bookAssets.ts, lib/library/bookAssetPaths.ts).
 *
 * - The metadata doc (`bookAssets/{bookId}`, a child collection registered in
 *   CHILD_SUBCOLLECTIONS) says which files exist; a book is offered to the
 *   child only when its hero sheet covers every pose the book needs
 *   (`libraryBookEntries`).
 * - Each file comes from lib/bookAssetStore (the device copy, else the
 *   owner-checked proxy); the reader gets `blob:` URLs.
 * - K2 shared narration: the book's NAME-FREE pages are rendered once for
 *   every child (lib/library/narrationFiles, public/audio/books/<book>/<set>/).
 *   The child's own files win; the shared set fills only the name-free gaps
 *   (he-f reads he-m where the words are the same); a name-bearing file is
 *   NEVER taken from it. A cue sidecar follows its audio: a page played from
 *   the shared set reads the shared sidecar (static JSON, loadStaticJson).
 * - Never a model call.
 */
import { fetchBookAsset } from "./bookAssetStore";
import type { BookAssetsDoc } from "./library/bookAssetPaths";
import { readCues, type CueTimes } from "./library/bookArtStates";
import { getLibraryBook } from "./library/books";
import { missingBookPoses } from "./library/bookPoses";
import type { HeroSheet } from "./library/heroSheet";
import { cueFileOf, sharedNarrationUrls } from "./library/narrationFiles";
import { loadStaticJson } from "./library/staticJson";
import type { Book } from "./library/types";

export interface LibraryBookEntry {
  book: Book;
  doc: BookAssetsDoc;
}

/** The books a child can open: a known library book whose sheet is complete. */
export function libraryBookEntries(docs: readonly BookAssetsDoc[]): LibraryBookEntry[] {
  const out: LibraryBookEntry[] = [];
  for (const doc of docs) {
    const book = doc?.bookId ? getLibraryBook(doc.bookId) : undefined;
    if (!book || !doc.sheetManifest?.poses || !Array.isArray(doc.files)) continue;
    const poses = Object.keys(doc.sheetManifest.poses).filter((p) => doc.files.includes(`hero-sheets/${doc.sheetId}/${doc.sheetManifest.poses[p].file}`));
    if (missingBookPoses(book, poses).length === 0) out.push({ book, doc });
  }
  return out;
}

/** A few requests at a time. */
async function inBatches<T>(items: readonly T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

export interface ResolvedBookAssets {
  sheet: HeroSheet;
  /** For BookReader's `assets`: `<folder>/<file>` → blob URL, and the cue sidecars. */
  narration: { files: Record<string, string>; cues: Record<string, CueTimes> };
  /** Release the blob URLs (the reader closed). */
  revoke: () => void;
}

/** The child's hero sheet (blob URLs) and the narration of one voice folder. */
export async function resolveBookAssets(childId: string, doc: BookAssetsDoc, folder: "en" | "he-m" | "he-f"): Promise<ResolvedBookAssets> {
  const urls: string[] = [];
  const url = async (rel: string): Promise<string | null> => {
    const blob = await fetchBookAsset(childId, doc, rel);
    if (!blob) return null;
    const u = URL.createObjectURL(blob);
    urls.push(u);
    return u;
  };
  const base = `hero-sheets/${doc.sheetId}/`;
  const m = doc.sheetManifest;
  const sheet: HeroSheet = { id: doc.sheetId, poses: {}, anchors: {}, prints: {}, choices: {} };
  await inBatches(Object.entries(m.poses), 6, async ([pose, v]) => {
    const u = await url(base + v.file);
    if (!u) return;
    sheet.poses[pose] = u;
    if (typeof v.aspect === "number" && typeof v.footX === "number" && typeof v.footW === "number") sheet.anchors![pose] = { aspect: v.aspect, footX: v.footX, footW: v.footW };
  });
  await inBatches(Object.entries(m.prints ?? {}), 3, async ([pageId, v]) => {
    const u = await url(base + v.file);
    if (u) sheet.prints![pageId] = { url: u, width: v.w ?? 1920, height: v.h ?? 1280 };
  });
  await inBatches(Object.entries(m.choices ?? {}), 3, async ([cid, file]) => {
    const u = await url(base + file);
    if (u) sheet.choices![cid] = u;
  });
  const files: Record<string, string> = {};
  const cues: Record<string, CueTimes> = {};
  const dir = `narration/${doc.setId}/${folder}/`;
  await inBatches(doc.files.filter((f) => f.startsWith(dir)), 6, async (rel) => {
    const name = rel.slice(dir.length);
    if (name.endsWith(".cues.json")) {
      const blob = await fetchBookAsset(childId, doc, rel);
      if (!blob) return;
      try {
        cues[`${folder}/${name.slice(0, -".cues.json".length)}`] = readCues(JSON.parse(await blob.text()));
      } catch {
        /* a bad sidecar = the fractions */
      }
      return;
    }
    const u = await url(rel);
    if (u) files[`${folder}/${name}`] = u;
  });
  await fillSharedNarration(doc.bookId, folder, files, cues);
  return { sheet, narration: { files, cues }, revoke: () => urls.forEach((u) => URL.revokeObjectURL(u)) };
}

/** K2: the book's shared name-free files fill the gaps in the child's own
 *  narration (`files` / `cues`, keyed `<folder>/<file>`, filled in place). A
 *  page the child has as .mp3 or .wav keeps the child's file and sidecar. */
export async function fillSharedNarration(
  bookId: string,
  folder: "en" | "he-m" | "he-f",
  files: Record<string, string>,
  cues: Record<string, CueTimes>,
): Promise<void> {
  const book = getLibraryBook(bookId);
  if (!book) return;
  const shared = sharedNarrationUrls(book, folder);
  const sidecars: [string, string][] = [];
  for (const [name, src] of Object.entries(shared)) {
    if (!name.endsWith(".mp3")) continue;
    const key = `${folder}/${name}`;
    if (files[key] || files[key.replace(/\.mp3$/, ".wav")]) continue;
    files[key] = src;
    const cue = cueFileOf(name);
    const stem = `${folder}/${name.slice(0, -".mp3".length)}`;
    delete cues[stem];
    if (Object.prototype.hasOwnProperty.call(shared, cue)) sidecars.push([stem, shared[cue]]);
  }
  await Promise.all(
    sidecars.map(async ([stem, src]) => {
      const raw = await loadStaticJson(src);
      if (raw) cues[stem] = readCues(raw);
    }),
  );
}

/** The cover picture for a book card: the child's printed cover (blob URL),
 *  else null (the caller shows the plate). */
export async function libraryBookCoverUrl(childId: string, doc: BookAssetsDoc): Promise<string | null> {
  const print = doc.sheetManifest.prints?.cover;
  if (!print) return null;
  const blob = await fetchBookAsset(childId, doc, `hero-sheets/${doc.sheetId}/${print.file}`);
  return blob ? URL.createObjectURL(blob) : null;
}
