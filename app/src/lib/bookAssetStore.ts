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
import { auth, firebaseEnabled } from "./firebase";
import { bookAssetUrl, isBookAssetRel, type BookAssetsDoc } from "./library/bookAssetPaths";

export interface CachedFile {
  id: string;
  childId: string;
  /** Absent on legacy records, which are deliberately never reused. */
  ownerId?: string;
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
  retireBookAssetScopes();
  blockedOwners = new WeakSet();
  erasedChildren = new Map();
  backend = next;
}

/** A scope holds no token or child content. It is one non-revivable reading
 * lifetime, bound to the authenticated owner and child. `isCurrent`
 * must also check the caller's child/session/version at every async boundary. */
export interface BookAssetScope {
  readonly ownerId: string;
  readonly childId: string;
  readonly signal: AbortSignal;
  current(): boolean;
  close(): void;
}

const localOwner = { uid: "local-sandbox" };
const currentOwner = () => firebaseEnabled ? auth?.currentUser ?? null : localOwner;
const activeScopes = new Set<BookAssetScope>();
const knownScopes = new WeakSet<BookAssetScope>();
let blockedOwners = new WeakSet<object>();
let erasedChildren = new Map<string, Set<string>>();

/** Existing auth transitions revoke even A → B → A work before React paints. */
export function retireBookAssetScopes(): void {
  for (const scope of [...activeScopes]) scope.close();
}

export function createBookAssetScope(childId: string, isCurrent: () => boolean = () => true): BookAssetScope {
  const owner = currentOwner();
  const controller = new AbortController();
  const scope: BookAssetScope = {
    ownerId: owner?.uid ?? "",
    childId,
    signal: controller.signal,
    current: () => {
      let live = false;
      try {
        live = !!owner && currentOwner() === owner && !blockedOwners.has(owner)
          && !erasedChildren.get(owner.uid)?.has(childId) && /^[A-Za-z0-9_-]{1,64}$/.test(childId)
          && !controller.signal.aborted && isCurrent();
      } catch { /* a failed admission check is closed */ }
      if (!live) scope.close();
      return live;
    },
    close: () => {
      controller.abort();
      activeScopes.delete(scope);
    },
  };
  knownScopes.add(scope);
  activeScopes.add(scope);
  scope.current();
  return scope;
}

/** All device mutations share a queue: purge cannot finish in front of an
 * older in-flight put. Checks inside the queue also block a stale queued put. */
let mutations: Promise<unknown> = Promise.resolve();
function mutate<T>(job: () => Promise<T>): Promise<T> {
  const result = mutations.then(job, job);
  mutations = result.catch(() => undefined);
  return result;
}

/** A file's fate. Cancellation is terminal; it never schedules a retry. */
export type BookAssetFetch = { blob: Blob } | { missing: true } | { transient: true; retryAfterMs?: number } | { cancelled: true };

let sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Test seam: the backoff's clock. */
export function setBookAssetSleep(next: ((ms: number) => Promise<void>) | null): void {
  sleep = next ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
}

const cancelled = (): BookAssetFetch => ({ cancelled: true });

/** Existing registered private device store, owner-namespaced. */
async function fetchScopedFile(scope: BookAssetScope, doc: BookAssetsDoc, rel: string): Promise<BookAssetFetch> {
  if (!knownScopes.has(scope) || !scope.current()) return cancelled();
  const id = JSON.stringify([scope.ownerId, scope.childId, doc.bookId, doc.createdAt, "private", rel]);
  const c = cache();
  try {
    const hit = await c?.get(id);
    if (!scope.current()) return cancelled();
    if (hit?.ownerId === scope.ownerId && hit.childId === scope.childId) return { blob: hit.blob };
  } catch { /* cache unavailable: fetch */ }
  if (!scope.current()) return cancelled();
  let res: Response;
  try {
    const headers = await authHeaders();
    if (!scope.current()) return cancelled();
    delete headers["Content-Type"];
    // Unlike the sandbox proxy, the hosted private route cannot work without
    // authentication. Do not turn a failed token lookup into an anonymous GET.
    if (firebaseEnabled && !headers.Authorization) return { transient: true };
    res = await fetch(bookAssetUrl(scope.childId, doc.bookId, rel), { headers, credentials: "same-origin", cache: "no-store", redirect: "error", signal: scope.signal });
  } catch {
    return scope.current() ? { transient: true } : cancelled();
  }
  if (!scope.current()) return cancelled();
  if (res.status === 429 || res.status >= 500) {
    const after = Number(res.headers.get("retry-after"));
    return { transient: true, ...(Number.isFinite(after) && after > 0 ? { retryAfterMs: Math.min(after * 1000, 8000) } : {}) };
  }
  if (!res.ok) return { missing: true };
  let blob: Blob;
  try { blob = await res.blob(); } catch { return scope.current() ? { transient: true } : cancelled(); }
  if (!scope.current()) return cancelled();
  try {
    await mutate(async () => {
      if (!scope.current() || !c) return;
      await c.put({ id, ownerId: scope.ownerId, childId: scope.childId, blob });
      // A scope can retire while IndexedDB commits; remove that exact write
      // before another queued write or erase may complete.
      if (!scope.current()) await c.deleteWhere((rec) => rec.id === id);
    });
  } catch { /* quota: play from memory only in the still-current scope */ }
  return scope.current() ? { blob } : cancelled();
}

/** One private file, with its original calling shape preserved. A caller may
 * supply its reading scope so Close, sibling changes and metadata replacement
 * cancel initial work and retries. Unscoped legacy callers still get owner /
 * erase protection for the complete request. */
export async function fetchBookAssetResult(childId: string, doc: BookAssetsDoc, rel: string, tries = 4, scope?: BookAssetScope): Promise<BookAssetFetch> {
  if (!isBookAssetRel(rel) || !doc.files.includes(rel)) return { missing: true };
  const ownScope = scope ?? createBookAssetScope(childId);
  if (ownScope.childId !== childId) return cancelled();
  try {
    let last: BookAssetFetch = { transient: true };
    for (let i = 0; i < tries; i++) {
      if (!ownScope.current()) return cancelled();
      last = await fetchScopedFile(ownScope, doc, rel);
      if (!ownScope.current()) return cancelled();
      if (!("transient" in last)) return last;
      if (i < tries - 1) await sleep(last.retryAfterMs ?? 500 * 2 ** i);
    }
    return last;
  } finally { if (!scope) ownScope.close(); }
}

/** One file as a Blob (retried on a passing failure), else null. */
export async function fetchBookAsset(childId: string, doc: BookAssetsDoc, rel: string, scope?: BookAssetScope): Promise<Blob | null> {
  const ownScope = scope ?? createBookAssetScope(childId);
  try {
    const r = await fetchBookAssetResult(childId, doc, rel, 4, ownScope);
    return ownScope.current() && "blob" in r ? r.blob : null;
  } finally { if (!scope) ownScope.close(); }
}

/** Remove every cached file of one child (erase), or of everyone (sign-out).
 * Invalidation is synchronous, BEFORE the first await. A deleted child cannot
 * acquire another scope for this owner in this runtime, even if its stale doc is
 * still mounted. The ordinary sign-out caller retires immediately as well. */
export async function purgeBookAssets(childId?: string): Promise<void> {
  const owner = currentOwner();
  if (owner) {
    if (childId === undefined) blockedOwners.add(owner);
    else {
      const ids = erasedChildren.get(owner.uid) ?? new Set<string>();
      ids.add(childId);
      erasedChildren.set(owner.uid, ids);
    }
  }
  for (const scope of [...activeScopes]) if (childId === undefined || scope.childId === childId) scope.close();
  const c = cache();
  try {
    await mutate(async () => { await c?.deleteWhere((rec) => childId === undefined || rec.childId === childId); });
  } catch { /* best effort; revoked scopes remain inaccessible */ }
}
