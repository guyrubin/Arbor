/**
 * S3 — scene-art cache (in-memory).
 *
 * Generated comic/scene panels are large data URLs; this de-dupes generation and
 * reuses panels within a session so flipping between beats (or Story-Journey ↔
 * Comic Reader) never re-pays. Keys come from `heroComics.comicKey`, so both
 * surfaces share hits.
 *
 * IMPORTANT: this cache is intentionally **memory-only**. An earlier version
 * persisted entries to localStorage, but generated images are multi-MB data
 * URLs and a few of them exhaust the ~5MB localStorage quota — which then makes
 * *other* app-wide localStorage writes (Firebase Auth, preferences, attribution)
 * throw QuotaExceededError, causing a broad regression. Cross-device / cross-
 * session persistence is the deferred, Guy-gated Firebase Storage layer, NOT
 * localStorage.
 */

/** Bounded entry count — data URLs are large, so keep the working set small. */
const MAX_ENTRIES = 24;

// Map insertion-order is used as the LRU order: re-inserting on read bumps an
// entry to most-recently-used. Eviction always removes the map's first key.
const mem = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

// Throttle concurrent generations: many cards or beats mounting at once would
// otherwise fire a dozen image-gen calls in parallel — choking the renderer and
// the cost budget. At most MAX_CONCURRENT run at a time; the rest queue.
const MAX_CONCURRENT = 2;
let activeGens = 0;
const genQueue: Array<() => void> = [];

function pump(): void {
  while (activeGens < MAX_CONCURRENT && genQueue.length) {
    const job = genQueue.shift()!;
    activeGens++;
    job();
  }
}

/** Read a cached panel data-URL (touches LRU recency), or undefined. */
export function getScene(key: string): string | undefined {
  const v = mem.get(key);
  if (v !== undefined) {
    // Re-insert → most-recently-used (Map preserves insertion order).
    mem.delete(key);
    mem.set(key, v);
  }
  return v;
}

/** Store a panel data-URL under `key`, enforcing the LRU bound. */
export function setScene(key: string, url: string): void {
  mem.delete(key);
  mem.set(key, url);
  while (mem.size > MAX_ENTRIES) {
    const oldest = mem.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    mem.delete(oldest);
  }
}

/**
 * Resolve a panel from cache → an in-flight request → a throttled `gen()` call,
 * caching the result. Concurrent calls with the same key share one generation, so
 * flipping between beats (or Story-Journey ↔ Comic Reader) never double-pays.
 * At most MAX_CONCURRENT generations run in parallel; the rest are queued.
 */
export function resolveScene(key: string, gen: () => Promise<string>): Promise<string> {
  const cached = getScene(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = new Promise<string>((resolve, reject) => {
    genQueue.push(() => {
      gen()
        .then((url) => { setScene(key, url); resolve(url); })
        .catch(reject)
        .finally(() => { activeGens--; pump(); });
    });
    pump();
  }).finally(() => { inFlight.delete(key); });
  inFlight.set(key, p);
  return p;
}

/**
 * Alias for `resolveScene` — same implementation, exported under the caps-branch
 * name so WorldScene.tsx and any other caps consumer compiles without changes.
 */
export const dedupeScene = resolveScene;

/** Test/QA reset hook — clears the cache and any in-flight/queued state. */
export function _resetSceneCache(): void {
  mem.clear();
  inFlight.clear();
  genQueue.length = 0;
  activeGens = 0;
}
