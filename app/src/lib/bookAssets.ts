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
import { fetchBookAsset, fetchBookAssetResult } from "./bookAssetStore";
import type { BookAssetsDoc } from "./library/bookAssetPaths";
import { readCues, type CueTimes } from "./library/bookArtStates";
import { getLibraryBook } from "./library/books";
import { missingBookPoses } from "./library/bookPoses";
import type { HeroSheet } from "./library/heroSheet";
import { cueFileOf, sharedNarrationUrls } from "./library/narrationFiles";
import { loadStaticJson } from "./library/staticJson";
import type { Book } from "./library/types";
import { firebaseEnabled } from "./firebase";

/** K2 sandbox: a build WITHOUT Firebase (the local sandbox) keeps the book
 *  docs on the device (the builder's local commit, components/kidmode/hero/
 *  buildBookSheet.ts); a Firebase build reads the cloud collection only. */
export const bookDocsOnDevice = (): boolean => !firebaseEnabled;

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
async function inBatches<T>(items: readonly T[], size: number, fn: (item: T) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

export interface ResolvedBookAssets {
  sheet: HeroSheet;
  /** For BookReader's `assets`: `<folder>/<file>` → blob URL, and the cue sidecars. */
  narration: { files: Record<string, string>; cues: Record<string, CueTimes> };
  /** Release the blob URLs (the reader closed). */
  revoke: () => void;
}

/** The waits between the background retries of a file that failed for a
 *  passing reason (after its own quick retries): ~1 minute in all. */
export const LATE_RETRY_MS = [2000, 4000, 8000, 16000, 30000];

/**
 * The child's hero sheet (blob URLs) and the narration of one voice folder.
 * K2: a file that fails for a passing reason (429, 5xx, network) after its
 * quick retries is never treated as absent: it is retried in the background
 * and `onLate` hands the reader a new snapshot the moment it arrives (the page
 * shows the hero then). Only a 404 is absent. `revoke` also stops the retries.
 */
export async function resolveBookAssets(
  childId: string,
  doc: BookAssetsDoc,
  folder: "en" | "he-m" | "he-f",
  opts: { onLate?: (next: ResolvedBookAssets) => void; lateRetryMs?: readonly number[]; sleep?: (ms: number) => Promise<void> } = {},
): Promise<ResolvedBookAssets> {
  const urls: string[] = [];
  let stopped = false;
  const late: { rel: string; apply: (blob: Blob) => Promise<void> }[] = [];
  const blobUrl = (blob: Blob) => {
    const u = URL.createObjectURL(blob);
    urls.push(u);
    return u;
  };
  /** Fetch one file and apply it; a passing failure goes to the late list. */
  const take = async (rel: string, apply: (blob: Blob) => Promise<void>) => {
    const r = await fetchBookAssetResult(childId, doc, rel);
    if ("blob" in r) await apply(r.blob);
    else if ("transient" in r) late.push({ rel, apply });
  };
  const base = `hero-sheets/${doc.sheetId}/`;
  const m = doc.sheetManifest;
  const sheet: HeroSheet = { id: doc.sheetId, poses: {}, anchors: {}, prints: {}, choices: {} };
  await inBatches(Object.entries(m.poses), 6, ([pose, v]) =>
    take(base + v.file, async (blob) => {
      sheet.poses[pose] = blobUrl(blob);
      if (typeof v.aspect === "number" && typeof v.footX === "number" && typeof v.footW === "number") sheet.anchors![pose] = { aspect: v.aspect, footX: v.footX, footW: v.footW };
    }),
  );
  await inBatches(Object.entries(m.prints ?? {}), 3, ([pageId, v]) =>
    take(base + v.file, async (blob) => {
      sheet.prints![pageId] = { url: blobUrl(blob), width: v.w ?? 1920, height: v.h ?? 1280 };
    }),
  );
  await inBatches(Object.entries(m.choices ?? {}), 3, ([cid, file]) =>
    take(base + file, async (blob) => {
      sheet.choices![cid] = blobUrl(blob);
    }),
  );
  const files: Record<string, string> = {};
  const cues: Record<string, CueTimes> = {};
  const dir = `narration/${doc.setId}/${folder}/`;
  await inBatches(doc.files.filter((f) => f.startsWith(dir)), 6, (rel) => {
    const name = rel.slice(dir.length);
    if (name.endsWith(".cues.json")) {
      return take(rel, async (blob) => {
        try {
          cues[`${folder}/${name.slice(0, -".cues.json".length)}`] = readCues(JSON.parse(await blob.text()));
        } catch {
          /* a bad sidecar = the fractions */
        }
      });
    }
    return take(rel, async (blob) => {
      files[`${folder}/${name}`] = blobUrl(blob);
    });
  });
  await fillSharedNarration(doc.bookId, folder, files, cues);
  const revoke = () => {
    stopped = true;
    urls.forEach((u) => URL.revokeObjectURL(u));
  };
  const snapshot = (): ResolvedBookAssets => ({
    sheet: { ...sheet, poses: { ...sheet.poses }, anchors: { ...sheet.anchors }, prints: { ...sheet.prints }, choices: { ...sheet.choices } },
    narration: { files: { ...files }, cues: { ...cues } },
    revoke,
  });
  if (late.length && opts.onLate) {
    const onLate = opts.onLate;
    const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    void (async () => {
      for (const wait of opts.lateRetryMs ?? LATE_RETRY_MS) {
        if (stopped || !late.length) return;
        await sleep(wait);
        if (stopped) return;
        const round = late.splice(0);
        let arrived = false;
        for (const job of round) {
          const r = await fetchBookAssetResult(childId, doc, job.rel, 1);
          if ("blob" in r) {
            await job.apply(r.blob);
            arrived = true;
          } else if ("transient" in r) late.push(job);
        }
        if (arrived && !stopped) onLate(snapshot());
      }
    })();
  }
  return snapshot();
}

/** K2: the book's shared name-free files fill the gaps in the child's own
 *  narration (the file and cue maps, keyed `<folder>/<file>`, filled in place). A
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
