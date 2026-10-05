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
import { KID_WORLD_TILE_IDS, kidArt, storyCoverKey, worldTileKey, type KidArt, type KidThemeId } from "./kidThemeManifest";

export const KID_RECENT_BOOKS = 3;

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
  if (tonightStoryId) cover(kidArt(theme, storyCoverKey(tonightStoryId)));
  for (const id of recentStoryIds.slice(0, KID_RECENT_BOOKS)) cover(kidArt(theme, storyCoverKey(id)));
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
