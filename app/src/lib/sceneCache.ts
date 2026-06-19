/* Persistent, quota-safe cache for generated scene / comic images (backlog I5).
 *
 * Generated hero scenes are large data URLs. Previously each surface kept its own
 * in-memory Map, so every reload re-generated every beat — slow, and it re-paid
 * the image-gen cost each time. This shared cache persists a bounded LRU to
 * localStorage so the Academy stories (and, next, the Practice world-cards)
 * render INSTANTLY on return, and identical (avatar × scene) requests never
 * regenerate. In-flight dedup collapses concurrent requests for the same key.
 *
 * A later upgrade moves the store to Firebase Storage (server-side, cross-device)
 * — that decision is Guy-gated. Until then this is device-local. */

const NS = "arbor.sceneArt.v1";
// Data URLs are large (~100–400 KB each); cap entries to stay within the ~5 MB
// localStorage budget. LRU eviction keeps the active story warm.
const MAX_ENTRIES = 12;

const mem = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();
let hydrated = false;

/** localStorage if it exists and is usable, else null (SSR / node tests / private mode). */
function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  const s = safeStorage();
  if (!s) return;
  try {
    const raw = s.getItem(NS);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const [k, url] of Object.entries(obj)) {
      if (typeof url === "string" && url) mem.set(k, url);
    }
  } catch {
    /* corrupt — run mem-only */
  }
}

function persist(): void {
  const s = safeStorage();
  if (!s) return; // no storage → mem-only; never touch the cache here
  const serialize = () => {
    const obj: Record<string, string> = {};
    for (const [k, v] of mem) obj[k] = v;
    return JSON.stringify(obj);
  };
  try {
    s.setItem(NS, serialize());
  } catch {
    // Genuine quota rejection: drop the oldest half and retry once so the most
    // recent scenes still persist. If it still fails, stay mem-only.
    try {
      const keep = [...mem.entries()].slice(-Math.ceil(MAX_ENTRIES / 2));
      mem.clear();
      for (const [k, v] of keep) mem.set(k, v);
      s.setItem(NS, serialize());
    } catch {
      /* give up on persistence; mem cache still works this session */
    }
  }
}

/** Returns a cached scene image for `key`, or undefined. Marks it most-recent (LRU). */
export function getScene(key: string): string | undefined {
  hydrate();
  const v = mem.get(key);
  if (v !== undefined) {
    mem.delete(key);
    mem.set(key, v); // re-insert → most-recently-used
  }
  return v;
}

/** Stores a scene image, evicting the least-recently-used beyond the cap. */
export function setScene(key: string, url: string): void {
  hydrate();
  mem.delete(key);
  mem.set(key, url);
  while (mem.size > MAX_ENTRIES) {
    const oldest = mem.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    mem.delete(oldest);
  }
  persist();
}

/** Cost guard: return the cached image, an in-flight promise, or generate once. */
export function dedupeScene(key: string, generate: () => Promise<string>): Promise<string> {
  const cached = getScene(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = generate()
    .then((url) => {
      setScene(key, url);
      return url;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

/** Test/debug only — clears the in-memory cache (and the persisted copy). */
export function _resetSceneCache(): void {
  mem.clear();
  inFlight.clear();
  hydrated = false;
  try {
    localStorage.removeItem(NS);
  } catch {
    /* ignore */
  }
}
