/**
 * S3 — persistent scene-art cache.
 *
 * Generated comic/scene panels are large data URLs. Without persistence, every
 * reload re-pays image generation for an identical (avatar × story × beat) — a
 * real cost burn and a slow "first paint" on return visits. This caches panels
 * in localStorage behind an in-memory mirror, with a quota-safe LRU (evict the
 * oldest entries on QuotaExceeded) and an in-flight dedupe so concurrent
 * identical requests share one network call.
 *
 * Keys come from `heroComics.comicKey`, so Story-Journey beats (HeroScenePlayer)
 * and Comic Reader pages (heroComics.generatePage) share cache hits. The
 * server-side, cross-device cache (Firebase Storage) is intentionally deferred
 * (Guy-gated); this is the device-local layer.
 */

const LS_KEY = "arbor.sceneArt.v1";
/** Bounded entry count — data URLs are large, so keep the working set small. */
const MAX_ENTRIES = 60;

type Entry = { url: string; at: number };

const mem = new Map<string, Entry>();
let loaded = false;

/** Safe localStorage accessor — undefined in SSR/native/test without DOM. */
function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function load(): void {
  if (loaded) return;
  loaded = true;
  const ls = storage();
  if (!ls) return;
  try {
    const raw = ls.getItem(LS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, Entry>;
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v.url === "string") mem.set(k, { url: v.url, at: Number(v.at) || 0 });
    }
  } catch {
    /* corrupt/unavailable — start empty, the in-memory cache still works */
  }
}

function evictOldest(n: number): void {
  if (n <= 0) return;
  const byAge = [...mem.entries()].sort((a, b) => a[1].at - b[1].at);
  for (let i = 0; i < n && i < byAge.length; i++) mem.delete(byAge[i][0]);
}

function persist(): void {
  const ls = storage();
  if (!ls) return;
  const serialize = () => {
    const obj: Record<string, Entry> = {};
    for (const [k, v] of mem) obj[k] = v;
    return JSON.stringify(obj);
  };
  try {
    ls.setItem(LS_KEY, serialize());
  } catch {
    // QuotaExceeded (or similar): drop the oldest half and retry once.
    evictOldest(Math.ceil(mem.size / 2));
    try {
      ls.setItem(LS_KEY, serialize());
    } catch {
      /* give up persisting — the in-memory cache still serves this session */
    }
  }
}

/** Read a cached panel data-URL (touches LRU recency), or undefined. */
export function getScene(key: string): string | undefined {
  load();
  const e = mem.get(key);
  if (!e) return undefined;
  e.at = Date.now();
  return e.url;
}

/** Store a panel data-URL under `key`, enforcing the LRU bound + persistence. */
export function setScene(key: string, url: string): void {
  load();
  mem.set(key, { url, at: Date.now() });
  if (mem.size > MAX_ENTRIES) evictOldest(mem.size - MAX_ENTRIES);
  persist();
}

const inFlight = new Map<string, Promise<string>>();

/**
 * Resolve a panel from cache → an in-flight request → `gen()`, persisting the
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

/** Test/QA reset hook — clears both layers. */
export function _resetSceneCache(): void {
  mem.clear();
  inFlight.clear();
  loaded = false;
  const ls = storage();
  try {
    ls?.removeItem(LS_KEY);
  } catch {
    /* noop */
  }
}
