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

type Entry = { url: string; at: number };

const mem = new Map<string, Entry>();

function evictOldest(n: number): void {
  if (n <= 0) return;
  const byAge = [...mem.entries()].sort((a, b) => a[1].at - b[1].at);
  for (let i = 0; i < n && i < byAge.length; i++) mem.delete(byAge[i][0]);
}

/** Read a cached panel data-URL (touches LRU recency), or undefined. */
export function getScene(key: string): string | undefined {
  const e = mem.get(key);
  if (!e) return undefined;
  e.at = Date.now();
  return e.url;
}

/** Store a panel data-URL under `key`, enforcing the LRU bound. */
export function setScene(key: string, url: string): void {
  mem.set(key, { url, at: Date.now() });
  if (mem.size > MAX_ENTRIES) evictOldest(mem.size - MAX_ENTRIES);
}

const inFlight = new Map<string, Promise<string>>();

/**
 * Resolve a panel from cache → an in-flight request → `gen()`, caching the
 * result. Concurrent calls with the same key share one generation, so flipping
 * between beats (or Story-Journey ↔ Comic Reader) never double-pays.
 */
export async function resolveScene(key: string, gen: () => Promise<string>): Promise<string> {
  const cached = getScene(key);
  if (cached) return cached;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const run = gen()
    .then((url) => {
      setScene(key, url);
      return url;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, run);
  return run;
}

/** Test/QA reset hook — clears the cache. */
export function _resetSceneCache(): void {
  mem.clear();
  inFlight.clear();
}
