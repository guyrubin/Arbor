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
 * Bounded: at most MAX_PAGES entries (LRU by lastUsed). Cross-DEVICE durability
 * stays the separate Guy-gated Firebase Storage decision (GG-6) — until then
 * another device honestly shows "Rebuild this book".
 */

/** Bounded entry count — data URLs are large; keep the on-disk set small. */
export const MAX_PAGES = 30;

export interface ComicPageRecord {
  /** Primary key: `${childId}|${sceneKey}` (sceneKey = heroComics.comicKey). */
  key: string;
  childId: string;
  dataUrl: string;
  /** LRU recency stamp (ms epoch); reads touch it. */
  lastUsed: number;
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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
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
}

const recordKey = (childId: string, sceneKey: string): string => `${childId}|${sceneKey}`;

/** Read a persisted page data-URL (touches LRU recency), or undefined. */
export async function getComicPage(childId: string, sceneKey: string): Promise<string | undefined> {
  const b = resolveBackend();
  if (!b) return undefined;
  try {
    const rec = await b.get(recordKey(childId, sceneKey));
    if (!rec) return undefined;
    // Touch recency (best effort — a failed touch never fails the read).
    void b.put({ ...rec, lastUsed: Date.now() }).catch(() => {});
    return rec.dataUrl;
  } catch {
    return undefined;
  }
}

/** Existence probe without loading the page art (for shelf-badge honesty). */
export async function hasComicPage(childId: string, sceneKey: string): Promise<boolean> {
  const b = resolveBackend();
  if (!b) return false;
  try {
    return await b.has(recordKey(childId, sceneKey));
  } catch {
    return false;
  }
}

/** Persist one page data-URL, evicting least-recently-used entries beyond the
 *  MAX_PAGES bound. Never throws (durability is best effort). */
export async function putComicPage(childId: string, sceneKey: string, dataUrl: string): Promise<void> {
  const b = resolveBackend();
  if (!b) return;
  try {
    await b.put({ key: recordKey(childId, sceneKey), childId, dataUrl, lastUsed: Date.now() });
    const all = await b.getAll();
    if (all.length > MAX_PAGES) {
      const surplus = [...all].sort((x, y) => x.lastUsed - y.lastUsed).slice(0, all.length - MAX_PAGES);
      for (const rec of surplus) await b.delete(rec.key);
    }
  } catch {
    /* best effort */
  }
}

/** GDPR erase hook: remove every persisted page for one child. */
export async function purgeComicPages(childId: string): Promise<void> {
  const b = resolveBackend();
  if (!b) return;
  try {
    const all = await b.getAll();
    for (const rec of all) {
      if (rec.childId === childId) await b.delete(rec.key);
    }
  } catch {
    /* best effort */
  }
}

/** Sign-out hook: remove every persisted page for every child on this device. */
export async function purgeAllComicPages(): Promise<void> {
  const b = resolveBackend();
  if (!b) return;
  try {
    await b.clear();
  } catch {
    /* best effort */
  }
}
