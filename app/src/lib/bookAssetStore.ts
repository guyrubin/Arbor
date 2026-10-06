/**
 * lib/bookAssetStore — B-BOOK release: the device copy of a child's private
 * book files (IndexedDB, the heroRenderStore pattern: injectable backend,
 * silent no-op without IndexedDB) and the ONE request that fills it: GET
 * /api/children/:childId/book-assets/:bookId/file (owner-checked, same origin)
 * with the parent's bearer token. Kept per child + book + the metadata doc's
 * createdAt + path, so a re-upload fetches fresh copies. Purged with the child
 * (lib/childData erase) and on sign-out (AuthContext). Never a model call.
 * Small on purpose: childData and AuthContext import it without the books.
 */
import { authHeaders } from "./api";
import { bookAssetUrl, isBookAssetRel, type BookAssetsDoc } from "./library/bookAssetPaths";

export interface CachedFile {
  id: string;
  childId: string;
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

/** One file as a Blob: the device copy, else the owner-checked proxy. */
export async function fetchBookAsset(childId: string, doc: BookAssetsDoc, rel: string): Promise<Blob | null> {
  if (!isBookAssetRel(rel) || !doc.files.includes(rel)) return null;
  const id = `${childId}|${doc.bookId}|${doc.createdAt}|${rel}`;
  const c = cache();
  try {
    const hit = await c?.get(id);
    if (hit) return hit.blob;
  } catch {
    /* cache unavailable: fetch */
  }
  const headers = await authHeaders();
  delete headers["Content-Type"];
  const res = await fetch(bookAssetUrl(childId, doc.bookId, rel), { headers, credentials: "same-origin" });
  if (!res.ok) return null;
  const blob = await res.blob();
  try {
    await c?.put({ id, childId, blob });
  } catch {
    /* quota: play from memory this time */
  }
  return blob;
}

/** Remove every cached file of one child (erase), or of everyone (sign-out). */
export async function purgeBookAssets(childId?: string): Promise<void> {
  try {
    await cache()?.deleteWhere((rec) => childId === undefined || rec.childId === childId);
  } catch {
    /* best effort */
  }
}

