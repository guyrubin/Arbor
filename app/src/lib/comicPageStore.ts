/**
 * AIX-S5 — device-local comic-page store (IndexedDB).
 *
 * Saved comic books persist METADATA only (heroComics.SavedComicMeta); the art
 * lived only in the memory scene cache, so every new session silently re-paid a
 * full ~6-image build behind a "Read again" promise. This store makes the art
 * durable ON THIS DEVICE: generated page data-URLs are written through here and
 * read back before any /generate-comic call.
 *
 * IndexedDB is deliberate: the banned prior regression was localStorage image
 * persistence (multi-MB data URLs exhaust the ~5MB quota and break unrelated
 * app writes — see lib/sceneCache.ts). IndexedDB has no such shared quota cliff.
 *
 * FIREWALL CONDITIONS (AIX-S5 ruling — all four hold here):
 *  1. Purged on child erase (lib/childData.wipeClientChildData) and on
 *     sign-out (AuthContext.signOut) — a GDPR-erased child leaves no comic
 *     pages on the device.
 *  2. Keyed per child: every record carries `childId` and the primary key is
 *     `${childId}|${sceneKey}`; purge is per-child or all.
 *  3. Device-local ONLY — this module never imports the API layer, never calls
 *     fetch, and nothing may upload/sync its contents (comicShelfDurability
 *     test locks the import allow-list and the no-network rule).
 *  4. The honesty copy layer ("Rebuild this book") ships with it (ComicsTab).
 *
 * Bounded (B-KID-49, KB-07 interim): at most MAX_PAGES entries AND at most a
 * quarter of the origin's storage quota (navigator.storage.estimate). Eviction
 * takes pages that belong to NO shelved book first (LRU), and a shelved book's
 * pages only after those — a saved book is never emptied to make room for a
 * stray scene. The first shelved book asks the browser once to make storage
 * persistent (navigator.storage.persist). Cross-DEVICE durability
 * stays the separate Guy-gated Firebase Storage decision (GG-6) — until then
 * another device honestly shows "Rebuild this book".
 */

/** Bounded entry count — data URLs are large; keep the on-disk set small. */
import { invalidateSceneCache } from "./sceneCache";

export const MAX_PAGES = 240;

/** Fraction of the origin quota the page store may use (KB-07). */
export const QUOTA_SHARE = 0.25;

export interface ComicPageRecord {
  /** Primary key: `${childId}|${sceneKey}` (sceneKey = heroComics.comicKey). */
  key: string;
  childId: string;
  dataUrl: string;
  /** LRU recency stamp (ms epoch); reads touch it. */
  lastUsed: number;
  /** B-KID-49: the page belongs to a book on a shelf (evicted last). */
  shelved?: boolean;
}

/** The slice of `navigator.storage` this module reads. Injectable for tests. */
export interface StorageManagerLike {
  estimate?: () => Promise<{ quota?: number; usage?: number }>;
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

/**
 * Minimal async backend the store logic runs against. The default backend is
 * IndexedDB (browser); node tests inject an in-memory implementation via
 * `_setComicPageBackend`, and environments without IndexedDB degrade to a
 * silent no-op (never throw — durability is an enhancement, not a dependency).
 */
export interface ComicPageBackend {
  get(key: string): Promise<ComicPageRecord | undefined>;
  /** Existence probe that must NOT load the (large) record value. */
  has(key: string): Promise<boolean>;
  put(record: ComicPageRecord): Promise<void>;
  delete(key: string): Promise<void>;
  /** All records (used for LRU eviction + per-child purge). */
  getAll(): Promise<ComicPageRecord[]>;
  clear(): Promise<void>;
}

const DB_NAME = "arbor-comic-pages";
const STORE = "pages";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    let result!: T;
    req.onsuccess = () => { result = req.result; };
    req.onerror = () => reject(req.error);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function createIdbBackend(): ComicPageBackend {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => (dbPromise ??= openDb());
  return {
    async get(key) {
      return (await tx<ComicPageRecord | undefined>(await db(), "readonly", (s) => s.get(key) as IDBRequest<ComicPageRecord | undefined>)) ?? undefined;
    },
    async has(key) {
      // getKey never materializes the multi-MB value — cheap shelf probes.
      const found = await tx<IDBValidKey | undefined>(await db(), "readonly", (s) => s.getKey(key));
      return found !== undefined;
    },
    async put(record) {
      await tx(await db(), "readwrite", (s) => s.put(record));
    },
    async delete(key) {
      await tx(await db(), "readwrite", (s) => s.delete(key));
    },
    async getAll() {
      return (await tx<ComicPageRecord[]>(await db(), "readonly", (s) => s.getAll() as IDBRequest<ComicPageRecord[]>)) ?? [];
    },
    async clear() {
      await tx(await db(), "readwrite", (s) => s.clear());
    },
  };
}

let backend: ComicPageBackend | null | undefined;
let storageManager: StorageManagerLike | null | undefined;
let persistAsked = false;

function resolveStorage(): StorageManagerLike | null {
  if (storageManager !== undefined) return storageManager;
  try {
    storageManager = typeof navigator !== "undefined" && navigator.storage ? navigator.storage : null;
  } catch {
    storageManager = null;
  }
  return storageManager;
}

/** Test hook: inject navigator.storage (or null for none). */
export function _setStorageManager(m: StorageManagerLike | null): void {
  storageManager = m;
  persistAsked = false;
}

/** The byte budget: QUOTA_SHARE of the reported quota, or unbounded when the
 *  browser reports none (the entry cap still applies). */
async function byteBudget(): Promise<number> {
  try {
    const est = await resolveStorage()?.estimate?.();
    return est?.quota && est.quota > 0 ? Math.floor(est.quota * QUOTA_SHARE) : Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** B-KID-49: which records go when the store is over its caps — unshelved
 *  pages first, oldest first; shelved pages only after every unshelved one.
 *  Pure (exported for the test). */
export function evictionOrder(all: readonly ComicPageRecord[], maxPages: number, maxBytes: number): ComicPageRecord[] {
  const order = [...all].sort((x, y) => (Number(Boolean(x.shelved)) - Number(Boolean(y.shelved))) || (x.lastUsed - y.lastUsed));
  let count = all.length;
  let bytes = all.reduce((n, r) => n + r.dataUrl.length, 0);
  const out: ComicPageRecord[] = [];
  for (const rec of order) {
    if (count <= maxPages && bytes <= maxBytes) break;
    out.push(rec);
    count -= 1;
    bytes -= rec.dataUrl.length;
  }
  return out;
}
let globalPurgeEpoch = 0;
const childPurgeEpoch = new Map<string, number>();
let mutationChain: Promise<void> = Promise.resolve();

function mutate<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationChain.then(operation, operation);
  mutationChain = result.then(() => undefined, () => undefined);
  return result;
}

export type ComicPageEpoch = Readonly<{
  childId: string;
  global: number;
  child: number;
}>;

/** Capture before an async generation/read begins. A later erase invalidates
 * the token so late work cannot recreate or return the erased child's bytes. */
export function captureComicPageEpoch(childId: string): ComicPageEpoch {
  return {
    childId,
    global: globalPurgeEpoch,
    child: childPurgeEpoch.get(childId) ?? 0,
  };
}

export function comicPageEpochIsCurrent(epoch: ComicPageEpoch): boolean {
  return epoch.global === globalPurgeEpoch
    && epoch.child === (childPurgeEpoch.get(epoch.childId) ?? 0);
}

function resolveBackend(): ComicPageBackend | null {
  if (backend !== undefined) return backend;
  try {
    backend = typeof indexedDB !== "undefined" ? createIdbBackend() : null;
  } catch {
    backend = null;
  }
  return backend;
}

/** Test hook: inject a backend (or null to simulate no-IDB environments). */
export function _setComicPageBackend(b: ComicPageBackend | null): void {
  backend = b;
}

/** Test hook: forget the injected/default backend so it re-resolves. */
export function _resetComicPageStore(): void {
  backend = undefined;
  storageManager = undefined;
  persistAsked = false;
  globalPurgeEpoch = 0;
  childPurgeEpoch.clear();
  mutationChain = Promise.resolve();
}

const recordKey = (childId: string, sceneKey: string): string => `${childId}|${sceneKey}`;

/** Read a persisted page data-URL (touches LRU recency), or undefined. */
export async function getComicPage(childId: string, sceneKey: string): Promise<string | undefined> {
  const b = resolveBackend();
  if (!b) return undefined;
  const epoch = captureComicPageEpoch(childId);
  const key = recordKey(childId, sceneKey);
  try {
    const rec = await b.get(key);
    if (!rec || !comicPageEpochIsCurrent(epoch)) return undefined;
    await mutate(async () => {
      if (!comicPageEpochIsCurrent(epoch)) return;
      await b.put({ ...rec, lastUsed: Date.now() });
    }).catch(() => {});
    if (!comicPageEpochIsCurrent(epoch)) return undefined;
    return rec.dataUrl;
  } catch {
    return undefined;
  }
}

/** Existence probe without loading the page art (for shelf-badge honesty). */
export async function hasComicPage(childId: string, sceneKey: string): Promise<boolean> {
  const b = resolveBackend();
  if (!b) return false;
  const epoch = captureComicPageEpoch(childId);
  try {
    const found = await b.has(recordKey(childId, sceneKey));
    return comicPageEpochIsCurrent(epoch) && found;
  } catch {
    return false;
  }
}

/** Persist one page data-URL, evicting least-recently-used entries beyond the
 *  MAX_PAGES bound. Never throws (durability is best effort). */
export async function putComicPage(
  childId: string,
  sceneKey: string,
  dataUrl: string,
  epoch: ComicPageEpoch = captureComicPageEpoch(childId),
): Promise<void> {
  const b = resolveBackend();
  if (!b || epoch.childId !== childId || !comicPageEpochIsCurrent(epoch)) return;
  const key = recordKey(childId, sceneKey);
  try {
    await mutate(async () => {
      if (!comicPageEpochIsCurrent(epoch)) return;
      // A re-written page keeps its shelf membership.
      const shelved = (await b.has(key)) ? Boolean((await b.get(key))?.shelved) : false;
      await b.put({ key, childId, dataUrl, lastUsed: Date.now(), ...(shelved ? { shelved } : {}) });
      if (!comicPageEpochIsCurrent(epoch)) return;
      const all = await b.getAll();
      if (!comicPageEpochIsCurrent(epoch)) return;
      const surplus = evictionOrder(all, MAX_PAGES, await byteBudget());
      for (const rec of surplus) {
        if (!comicPageEpochIsCurrent(epoch)) return;
        await b.delete(rec.key);
      }
    });
  } catch {
    /* best effort */
  }
}

/**
 * B-KID-49: the pages of a book that just went onto a shelf are evicted last.
 * The first call on this device also asks the browser to keep the store
 * (navigator.storage.persist — no prompt in Chromium/Firefox for a used site).
 * Never throws.
 */
export async function markComicPagesShelved(childId: string, sceneKeys: readonly string[]): Promise<void> {
  const b = resolveBackend();
  if (!b || sceneKeys.length === 0) return;
  const epoch = captureComicPageEpoch(childId);
  try {
    await mutate(async () => {
      for (const sceneKey of sceneKeys) {
        if (!comicPageEpochIsCurrent(epoch)) return;
        const rec = await b.get(recordKey(childId, sceneKey));
        if (rec && !rec.shelved) await b.put({ ...rec, shelved: true });
      }
    });
  } catch {
    /* best effort */
  }
  if (!persistAsked) {
    persistAsked = true;
    try {
      const sm = resolveStorage();
      if (sm?.persist && !(await sm.persisted?.())) await sm.persist();
    } catch {
      /* best effort */
    }
  }
}

/** GDPR erase hook: remove every persisted page for one child. */
export async function purgeComicPages(childId: string): Promise<void> {
  const b = resolveBackend();
  childPurgeEpoch.set(childId, (childPurgeEpoch.get(childId) ?? 0) + 1);
  invalidateSceneCache();
  if (!b) return;
  try {
    await mutate(async () => {
      const all = await b.getAll();
      for (const rec of all) {
        if (rec.childId === childId) await b.delete(rec.key);
      }
    });
  } catch {
    /* best effort */
  }
}

/** Sign-out hook: remove every persisted page for every child on this device. */
export async function purgeAllComicPages(): Promise<void> {
  const b = resolveBackend();
  globalPurgeEpoch += 1;
  invalidateSceneCache();
  if (!b) return;
  try {
    await mutate(() => b.clear());
  } catch {
    /* best effort */
  }
}
