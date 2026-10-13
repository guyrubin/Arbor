/**
 * lib/bookAssetStore — B-BOOK release: the device copy of a child's private
 * book files (IndexedDB, the heroRenderStore pattern: injectable backend,
 * silent no-op without IndexedDB) and the ONE request that fills it: GET
 * /api/children/:childId/book-assets/:bookId/file (owner-checked, same origin)
 * with the parent's bearer token. Kept per owner + child + book + the metadata doc's
 * createdAt + path, so a re-upload fetches fresh copies. Purged with the child
 * (lib/childData erase) and on sign-out (AuthContext). Never a model call.
 * Small on purpose: childData and AuthContext import it without the books.
 * K2: a file that fails to load for a passing reason (429, 5xx, a network
 * error) is retried with backoff (Retry-After honoured) and is NEVER cached as
 * absent; only a 404 (or a path the doc does not list) is absent.
 */
import { authHeaders } from "./api";
import { heroSheetOwnerKey, subscribeHeroSheetOwner } from "./heroSheetStore";
import { bookAssetUrl, isBookAssetRel, type BookAssetsDoc } from "./library/bookAssetPaths";

export interface CachedFile {
  id: string;
  childId: string;
  /** Legacy rows without an owner are deliberately never reused. */
  ownerKey?: string;
  blob: Blob;
}

export interface BookAssetBackend {
  get(id: string): Promise<CachedFile | undefined>;
  put(rec: CachedFile): Promise<void>;
  deleteWhere(pred: (rec: CachedFile) => boolean): Promise<void>;
}

const DB_NAME = "arbor-book-assets";
const STORE = "book_files";

function createIdbBackend(): BookAssetBackend {
  let dbp: Promise<IDBDatabase> | null = null;
  const open = () =>
    (dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      let out!: T;
      req.onsuccess = () => {
        out = req.result;
      };
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  };
  return {
    get: (id) => run<CachedFile | undefined>("readonly", (s) => s.get(id) as IDBRequest<CachedFile | undefined>),
    put: async (rec) => {
      await run("readwrite", (s) => s.put(rec));
    },
    deleteWhere: async (pred) => {
      const all = await run<CachedFile[]>("readonly", (s) => s.getAll() as IDBRequest<CachedFile[]>);
      for (const rec of all ?? []) if (pred(rec)) await run("readwrite", (s) => s.delete(rec.id));
    },
  };
}

let backend: BookAssetBackend | null | undefined;
function cache(): BookAssetBackend | null {
  if (backend !== undefined) return backend;
  try {
    backend = typeof indexedDB !== "undefined" ? createIdbBackend() : null;
  } catch {
    backend = null;
  }
  return backend;
}

/** Test seam. */
export function setBookAssetBackend(next: BookAssetBackend | null): void {
  backend = next;
}

let purgeEpoch = 0;
const childEpochs = new Map<string, number>();
let mutations: Promise<unknown> = Promise.resolve();
function serialize<T>(action: () => Promise<T>): Promise<T> {
  const result = mutations.then(action, action);
  mutations = result.catch(() => undefined);
  return result;
}

export interface BookAssetReadScope {
  owner: string;
  childId: string;
  current: () => boolean;
  assert: () => void;
  close: () => void;
}

/** One scope covers a whole reader load, including batches and late retries.
 * A → B → A cannot revive an old request; erase retires it before I/O. */
export function openBookAssetReadScope(childId: string, isCurrent: () => boolean = () => true): BookAssetReadScope {
  const owner = heroSheetOwnerKey();
  const epoch = purgeEpoch, childEpoch = childEpochs.get(childId) ?? 0;
  let closed = false;
  const unsubscribe = subscribeHeroSheetOwner(() => { if (heroSheetOwnerKey() !== owner) closed = true; });
  const current = () => !closed && owner !== "signed-out" && heroSheetOwnerKey() === owner && purgeEpoch === epoch && (childEpochs.get(childId) ?? 0) === childEpoch && isCurrent();
  return {
    owner, childId, current,
    assert: () => { if (!current()) throw new Error("Book asset read retired"); },
    close: () => { closed = true; unsubscribe(); },
  };
}

/** A file's fate: its bytes, absent for good, or a passing failure (retry later). */
export type BookAssetFetch = { blob: Blob } | { missing: true } | { transient: true; retryAfterMs?: number };

let sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Test seam: the backoff's clock. */
export function setBookAssetSleep(next: ((ms: number) => Promise<void>) | null): void {
  sleep = next ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
}

/** One attempt: the device copy, else the owner-checked proxy. */
async function fetchOnce(childId: string, doc: BookAssetsDoc, rel: string, scope: BookAssetReadScope): Promise<BookAssetFetch> {
  scope.assert();
  const id = JSON.stringify([scope.owner, childId, doc.bookId, doc.createdAt, rel]);
  const c = cache();
  try {
    const hit = await c?.get(id);
    scope.assert();
    if (hit?.ownerKey === scope.owner) return { blob: hit.blob };
  } catch {
    /* cache unavailable: fetch */
  }
  scope.assert();
  let res: Response;
  try {
    const headers = await authHeaders();
    scope.assert();
    delete headers["Content-Type"];
    res = await fetch(bookAssetUrl(childId, doc.bookId, rel), { headers, credentials: "same-origin" });
  } catch {
    scope.assert();
    return { transient: true };
  }
  scope.assert();
  if (res.status === 429 || res.status >= 500) {
    const after = Number(res.headers.get("retry-after"));
    return { transient: true, ...(Number.isFinite(after) && after > 0 ? { retryAfterMs: Math.min(after * 1000, 8000) } : {}) };
  }
  if (!res.ok) return { missing: true };
  const blob = await res.blob();
  scope.assert();
  try {
    await serialize(async () => {
      scope.assert();
      await c?.put({ id, childId, ownerKey: scope.owner, blob });
      // A purge may start while IndexedDB commits. It is queued after us;
      // remove this row here too before returning stale bytes to a caller.
      if (!scope.current()) await c?.deleteWhere(rec => rec.id === id);
    });
  } catch {
    /* quota: play from memory this time */
  }
  scope.assert();
  return { blob };
}

/** One file, retried on a passing failure (backoff 0.5 s, 1 s, 2 s...). */
export async function fetchBookAssetResult(childId: string, doc: BookAssetsDoc, rel: string, tries = 4, readScope?: BookAssetReadScope): Promise<BookAssetFetch> {
  if (!isBookAssetRel(rel) || !doc.files.includes(rel)) return { missing: true };
  const scope = readScope ?? openBookAssetReadScope(childId);
  if (scope.childId !== childId) throw new Error("Book asset child changed");
  try {
  let last: BookAssetFetch = { transient: true };
  for (let i = 0; i < tries; i++) {
    scope.assert();
    last = await fetchOnce(childId, doc, rel, scope);
    if (!("transient" in last)) return last;
    if (i < tries - 1) await sleep(last.retryAfterMs ?? 500 * 2 ** i);
  }
  return last;
  } finally { if (!readScope) scope.close(); }
}

/** One file as a Blob (retried on a passing failure), else null. */
export async function fetchBookAsset(childId: string, doc: BookAssetsDoc, rel: string): Promise<Blob | null> {
  const r = await fetchBookAssetResult(childId, doc, rel);
  return "blob" in r ? r.blob : null;
}

/** Remove every cached file of one child (erase), or of everyone (sign-out). */
export async function purgeBookAssets(childId?: string): Promise<void> {
  if (childId === undefined) purgeEpoch++;
  else childEpochs.set(childId, (childEpochs.get(childId) ?? 0) + 1);
  try {
    const c = cache();
    await serialize(async () => { await c?.deleteWhere((rec) => childId === undefined || rec.childId === childId); });
  } catch {
    /* best effort */
  }
}

