/**
 * MOB-22 — pre-generate the first comic while the parent is still choosing
 * domains (OnboardingFlow step 3), so the wow overlay opens on a page instead
 * of a spinner at the finish line.
 *
 * - Sprout hero (no avatar exists yet at step 3); the wow re-generates with
 *   the fresh hero ONLY when the parent created one in step 4.
 * - Idempotent per child + adventure (HERO_STORIES[0] — the same first canon
 *   story WowOnboarding draws): one in-flight promise, one cached page. A
 *   second prefetch call, and the wow's read, share it (guard:
 *   firstComicPrefetch.test.ts).
 * - Failure (PaywallError, network, quota) caches nothing and never throws —
 *   the wow then follows its own generate → fallback-template path.
 * - Module map only (data-URL art never persists — W5.4 doctrine).
 */
import { api } from "./api";
import { STORY_COMIC } from "./heroComics";
import { HERO_STORIES } from "./heroJourneys";

type Generate = (payload: Parameters<typeof api.generateComic>[0]) => Promise<{ dataUrl: string }>;

interface Entry {
  promise: Promise<string | null>;
  url: string | null;
  settled: boolean;
}

const cache = new Map<string, Entry>();

export const FIRST_STORY_ID = HERO_STORIES[0].id;
const key = (childId: string) => `${childId}:${FIRST_STORY_ID}`;

/**
 * Start (or join) the first-comic generation for this child. Returns the
 * shared promise; resolves to the page data-URL or null on any failure.
 */
export function prefetchFirstComic(
  childId: string,
  opts: { heroName: string; lang: "en" | "he" },
  deps: { generate?: Generate } = {},
): Promise<string | null> {
  if (!childId) return Promise.resolve(null);
  const k = key(childId);
  const existing = cache.get(k);
  if (existing) return existing.promise;

  const copy = STORY_COMIC[FIRST_STORY_ID];
  const generate = deps.generate ?? api.generateComic;
  const he = opts.lang === "he";
  const entry: Entry = { promise: Promise.resolve(null), url: null, settled: false };
  entry.promise = (async () => {
    try {
      const res = await generate({
        heroName: opts.heroName,
        theme: he ? copy.themeHe : copy.theme,
        dialogue: he ? copy.dialogueHe : copy.dialogue,
        sfx: he ? [...copy.sfxHe] : [...copy.sfx],
        style: "comichero",
      });
      entry.url = res?.dataUrl || null;
    } catch {
      entry.url = null;
    }
    entry.settled = true;
    return entry.url;
  })();
  cache.set(k, entry);
  return entry.promise;
}

/** The wow's read: null when nothing was prefetched for this child (no fetch is started here). */
export function awaitPrefetchedComic(childId: string): Promise<string | null> {
  const entry = cache.get(key(childId));
  return entry ? entry.promise : Promise.resolve(null);
}

/** Synchronous peek (settled pages only). */
export function peekPrefetchedComic(childId: string): string | null {
  const entry = cache.get(key(childId));
  return entry?.settled ? entry.url : null;
}

/** Test-only. */
export function __resetFirstComicPrefetch(): void {
  cache.clear();
}
