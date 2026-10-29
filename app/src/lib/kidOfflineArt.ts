/**
 * kidOfflineArt — B-KID-78 (KB-42): the art a child needs to read offline.
 *
 * The kid home asks the service worker (public/sw.js, "kid-art-precache") to
 * keep: Tonight's cover, the covers of the last 3 books the child opened, and
 * the home tile art of the active theme. Web-sized webp only (the 480 px
 * derivatives; a book cover also its large derivative, which the reader's
 * full-bleed page uses). Device-local cache, no child data leaves the page —
 * the message carries art paths only.
 */
import { KID_WORLD_TILE_IDS, kidArt, storyCoverArt, worldTileKey, type KidArt, type KidThemeId } from "./kidThemeManifest";
import { allBookPages } from "./library/bookShape";
import { bookPlatesFor } from "./library/books";
import { isPlanBook, type AnyBook } from "./library/types";

export const KID_RECENT_BOOKS = 3;
/** The most art URLs the worker warms from one message (public/sw.js ART_MAX). */
export const KID_ART_MESSAGE_MAX = 40;

const webp = (u: string | undefined): u is string => !!u && u.startsWith("/visuals/") && u.endsWith(".webp");

/** The last `n` distinct stories the child opened, newest first. */
export function recentlyOpenedStoryIds(runs: readonly { storyId: string; startedAt?: string; completedAt?: string }[], n = KID_RECENT_BOOKS): string[] {
  const sorted = [...runs].sort((a, b) => {
    const ta = a.startedAt ?? a.completedAt ?? "";
    const tb = b.startedAt ?? b.completedAt ?? "";
    return ta < tb ? 1 : ta > tb ? -1 : 0;
  });
  const out: string[] = [];
  for (const r of sorted) {
    if (!out.includes(r.storyId)) out.push(r.storyId);
    if (out.length >= n) break;
  }
  return out;
}

/** The art paths to keep offline for this theme (deduped, webp only). */
export function kidOfflineArtUrls(theme: KidThemeId, tonightStoryId: string | null | undefined, recentStoryIds: readonly string[]): string[] {
  const urls: string[] = [];
  const cover = (a: KidArt | null) => { if (a) urls.push(a.src480, a.src); };
  if (tonightStoryId) cover(storyCoverArt(theme, tonightStoryId));
  for (const id of recentStoryIds.slice(0, KID_RECENT_BOOKS)) cover(storyCoverArt(theme, id));
  for (const id of KID_WORLD_TILE_IDS) {
    const tile = kidArt(theme, worldTileKey(id));
    if (tile) urls.push(tile.src480);
  }
  return [...new Set(urls.filter(webp))];
}

/** Hand the list to the active service worker (no-op without one). */
export function precacheKidArt(urls: readonly string[]): void {
  try {
    const controller = (globalThis.navigator as Navigator | undefined)?.serviceWorker?.controller;
    if (!controller || urls.length === 0) return;
    controller.postMessage({ type: "kid-art-precache", urls: [...urls] });
  } catch {
    /* no service worker: the art simply loads online */
  }
}

/**
 * B-BOOK-27 (T15): every SHARED art file a library book reads — the plate of
 * each page and art state, and each overlay — as public webp paths, in the
 * order a read meets them. Never a sprite, print or narration: those are the
 * child's private files, kept on this device (IndexedDB arbor-book-assets,
 * lib/bookAssetStore) by the book's first open. A plan plate painted in
 * product reads through the signed-in route and is not a /visuals path, so
 * it is left out (the worker never caches /api).
 */
export function libraryBookArtUrls(book: AnyBook): string[] {
  const table = bookPlatesFor(book);
  const urls: string[] = [];
  for (const page of allBookPages(book)) {
    const plates = [page.plateId, ...(page.artStates ?? []).map((st) => st.plateId).filter((id): id is string => !!id)];
    for (const id of plates) if (Object.prototype.hasOwnProperty.call(table, id)) urls.push(table[id].file);
    for (const o of page.overlays ?? []) urls.push(o.file);
  }
  return [...new Set(urls.filter(webp))];
}

/**
 * B-BOOK-27 (T15): the library books to keep offline — Tonight's (the shelf's
 * first entry) and up to `n` other books the child finished most recently
 * (the one read ledger, bookReads; a plan book is read under its pattern id).
 */
export function offlineLibraryBooks<T extends { book: AnyBook }>(
  entries: readonly T[],
  reads: readonly { bookId: string; finishedAt?: string }[],
  n = KID_RECENT_BOOKS,
): T[] {
  if (!entries.length) return [];
  const readId = (e: T) => (isPlanBook(e.book) ? e.book.pattern : e.book.id);
  const last = new Map<string, string>();
  for (const r of reads) if (typeof r.bookId === "string" && (r.finishedAt ?? "") > (last.get(r.bookId) ?? "")) last.set(r.bookId, r.finishedAt ?? "");
  const [tonight, ...rest] = entries;
  const recent = rest.filter((e) => last.has(readId(e))).sort((a, b) => (last.get(readId(b))! > last.get(readId(a))! ? 1 : last.get(readId(b))! < last.get(readId(a))! ? -1 : 0));
  return [tonight, ...recent.slice(0, n)];
}
