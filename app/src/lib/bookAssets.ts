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
 * - PR C (Everyday Plans): a PLAN book's narration is the child's own set
 *   under the pattern's registered doc (`bookAssets/{pattern}`, every page
 *   file in the child's name — lib/library/plans/planNarration); the entry
 *   carries it beside the shared plan sheet and the reader loads it from
 *   there. No doc, no file = silence.
 * - Never a model call.
 */
import { fetchBookAssetResult, openBookAssetReadScope } from "./bookAssetStore";
import type { BookAssetsDoc } from "./library/bookAssetPaths";
import { readCues, type CueTimes } from "./library/bookArtStates";
import { getLibraryBook } from "./library/books";
import { missingBookPoses } from "./library/bookPoses";
import type { HeroSheet } from "./library/heroSheet";
import { cueFileOf, sharedNarrationUrls } from "./library/narrationFiles";
import { PLAN_SHEET_BOOK_ID } from "./library/plans/planPoses";
import { planBookFromDoc } from "./library/plans/planBookDoc";
import { isPlanNarrationDoc, planNarrationDocId } from "./library/plans/planNarration";
import { activePlans } from "./plans/planWeek";
import { loadStaticJson } from "./library/staticJson";
import type { AnyBook } from "./library/types";
import { firebaseEnabled } from "./firebase";

/** K2 sandbox: a build WITHOUT Firebase (the local sandbox) keeps the book
 *  docs on the device (the builder's local commit, components/kidmode/hero/
 *  buildBookSheet.ts); a Firebase build reads the cloud collection only. */
export const bookDocsOnDevice = (): boolean => !firebaseEnabled;

export interface LibraryBookEntry {
  /** A canonical library book, or a composed PLAN book (B-BOOK-75). */
  book: AnyBook;
  /** The private files the reader uses: the book's own sheet, or (plan) the
   *  child's ONE shared plan sheet (`bookAssets/plan-poses`). */
  doc: BookAssetsDoc;
  /** PR C: a plan book's narration doc (`bookAssets/{pattern}`, the child's own
   *  set), when any of it is rendered; absent = the book reads in silence. */
  narration?: BookAssetsDoc;
}

/** The poses a bookAssets doc really has files for. */
function sheetPoses(doc: BookAssetsDoc): string[] | null {
  if (!doc?.sheetManifest?.poses || !Array.isArray(doc.files)) return null;
  return Object.keys(doc.sheetManifest.poses).filter((p) => doc.files.includes(`hero-sheets/${doc.sheetId}/${doc.sheetManifest.poses[p].file}`));
}

/** The books a child can open: a known library book whose sheet is complete,
 *  then (B-BOOK-75) each of the child's composed plan books whose poses the
 *  child's shared plan sheet covers. A plan book without a complete plan sheet
 *  is not offered (no silhouette, ever); the composer (B-BOOK-77) draws it. */
export function libraryBookEntries(docs: readonly BookAssetsDoc[], planDocs: readonly unknown[] = [], now: Date = new Date()): LibraryBookEntry[] {
  const out: LibraryBookEntry[] = [];
  for (const doc of docs) {
    // the plan sheet and a pattern's narration-only doc are never books to open
    const book = doc?.bookId && doc.bookId !== PLAN_SHEET_BOOK_ID && !isPlanNarrationDoc(doc) ? getLibraryBook(doc.bookId) : undefined;
    const poses = book ? sheetPoses(doc) : null;
    if (book && poses && missingBookPoses(book, poses).length === 0) out.push({ book, doc });
  }
  const planSheet = docs.find((d) => d?.bookId === PLAN_SHEET_BOOK_ID);
  const planPoses = planSheet ? sheetPoses(planSheet) : null;
  if (planSheet && planPoses) {
    // B-BOOK-78 (standard §6 step 5): an active plan inside its duration sits
    // FIRST in Tonight (the kid home opens the first entry); a plan past its
    // duration stays on the shelf after the canonical books.
    const first: LibraryBookEntry[] = [];
    for (const plan of activePlans(planDocs, now)) {
      const book = planBookFromDoc(plan.doc);
      if (!book || missingBookPoses(book, planPoses).length) continue;
      const narration = docs.find((d) => d?.bookId === planNarrationDocId(book.pattern) && isPlanNarrationDoc(d));
      (plan.daysLeft > 0 ? first : out).push({ book, doc: planSheet, ...(narration ? { narration } : {}) });
    }
    return [...first, ...out];
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
 * PR C: `opts.narration` (a plan book's own narration doc) is read for the
 * voice folder instead of `doc`; the sheet still comes from `doc`.
 */
export async function resolveBookAssets(
  childId: string,
  doc: BookAssetsDoc,
  folder: "en" | "he-m" | "he-f",
  opts: { onLate?: (next: ResolvedBookAssets) => void; lateRetryMs?: readonly number[]; sleep?: (ms: number) => Promise<void>; isCurrent?: () => boolean; narration?: BookAssetsDoc | null } = {},
): Promise<ResolvedBookAssets> {
  const scope = openBookAssetReadScope(childId, opts.isCurrent);
  const urls: string[] = [];
  let stopped = false;
  const revoke = () => {
    stopped = true;
    scope.close();
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  };
  try {
  const blobUrl = (blob: Blob) => {
    scope.assert();
    const u = URL.createObjectURL(blob);
    urls.push(u);
    return u;
  };
  const late: { rel: string; from: BookAssetsDoc; apply: (blob: Blob) => Promise<void> }[] = [];
  /** Fetch one file and apply it; a passing failure goes to the late list. */
  const take = async (rel: string, apply: (blob: Blob) => Promise<void>, from: BookAssetsDoc = doc) => {
    scope.assert();
    const r = await fetchBookAssetResult(childId, from, rel, 4, scope);
    scope.assert();
    if ("blob" in r) await apply(r.blob);
    else if ("transient" in r) late.push({ rel, from, apply });
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
  // PR C: a plan book's narration lives in its own doc (the child's set under the pattern)
  const voice = opts.narration ?? doc;
  const dir = `narration/${voice.setId}/${folder}/`;
  await inBatches(voice.files.filter((f) => f.startsWith(dir)), 6, (rel) => {
    const name = rel.slice(dir.length);
    if (name.endsWith(".cues.json")) {
      return take(rel, async (blob) => {
        try {
          cues[`${folder}/${name.slice(0, -".cues.json".length)}`] = readCues(JSON.parse(await blob.text()));
        } catch {
          /* a bad sidecar = the fractions */
        }
      }, voice);
    }
    return take(rel, async (blob) => {
      files[`${folder}/${name}`] = blobUrl(blob);
    }, voice);
  });
  await fillSharedNarration(voice.bookId, folder, files, cues);
  scope.assert();
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
        scope.assert();
        await sleep(wait);
        if (stopped) return;
        scope.assert();
        const round = late.splice(0);
        let arrived = false;
        for (const job of round) {
          const r = await fetchBookAssetResult(childId, job.from, job.rel, 1, scope);
          scope.assert();
          if ("blob" in r) {
            await job.apply(r.blob);
            arrived = true;
          } else if ("transient" in r) late.push(job);
        }
        if (arrived && !stopped) { scope.assert(); onLate(snapshot()); }
      }
    })().catch(revoke);
  }
  return snapshot();
  } catch (error) { revoke(); throw error; }
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
  const scope = openBookAssetReadScope(childId);
  try {
    const result = await fetchBookAssetResult(childId, doc, `hero-sheets/${doc.sheetId}/${print.file}`, 4, scope);
    scope.assert();
    return "blob" in result ? URL.createObjectURL(result.blob) : null;
  } finally { scope.close(); }
}
