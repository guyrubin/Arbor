import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ owner: { uid: "owner-a" } as { uid: string } | null, headers: vi.fn() }));
vi.mock("./firebase", () => ({ firebaseEnabled: true, auth: { get currentUser() { return h.owner; } } }));
vi.mock("./api", () => ({ authHeaders: h.headers }));
import {
  createBookAssetScope, fetchBookAssetResult, purgeBookAssets,
  retireBookAssetScopes, setBookAssetBackend, setBookAssetSleep,
  type BookAssetBackend, type CachedFile,
} from "./bookAssetStore";
import type { BookAssetsDoc } from "./library/bookAssetPaths";

const rel = "hero-sheets/synthetic/sit.webp";
const doc: BookAssetsDoc = { id: "synthetic-book", bookId: "synthetic-book", sheetId: "synthetic", setId: "synthetic", sheetManifest: { poses: { sit: { file: "sit.webp" } } }, files: [rel], bytes: 5, createdAt: "synthetic-version" };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let records: Map<string, CachedFile>;
let backend: BookAssetBackend;
let get: ReturnType<typeof vi.fn<BookAssetBackend["get"]>>;
let put: ReturnType<typeof vi.fn<BookAssetBackend["put"]>>;
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  h.owner = { uid: "owner-a" };
  h.headers.mockReset().mockResolvedValue({ Authorization: "Bearer synthetic-token" });
  records = new Map();
  get = vi.fn<BookAssetBackend["get"]>(async (id) => records.get(id));
  put = vi.fn<BookAssetBackend["put"]>(async (r) => { records.set(r.id, r); });
  backend = { get, put, deleteWhere: async (pred) => { for (const [id, r] of records) if (pred(r)) records.delete(id); } };
  setBookAssetBackend(backend);
  setBookAssetSleep(async () => {});
  fetcher = vi.fn(async () => new Response("synthetic bytes", { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { setBookAssetBackend(null); setBookAssetSleep(null); vi.unstubAllGlobals(); });

describe("private book owner and erase lifetimes", () => {
  it("namespaces device bytes by owner and never reuses unowned legacy records", async () => {
    records.set(`kid-a|${doc.bookId}|${doc.createdAt}|${rel}`, { id: `kid-a|${doc.bookId}|${doc.createdAt}|${rel}`, childId: "kid-a", blob: new Blob(["legacy"]) });
    expect(await fetchBookAssetResult("kid-a", doc, rel)).toHaveProperty("blob");
    await fetchBookAssetResult("kid-a", doc, rel);
    expect(fetcher).toHaveBeenCalledTimes(1);
    h.owner = { uid: "owner-b" };
    await fetchBookAssetResult("kid-a", doc, rel);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect([...records.values()].filter((r) => r.ownerId).map((r) => r.ownerId)).toEqual(["owner-a", "owner-b"]);
  });
  it("signed-out reads cannot touch cache, tokens or network", async () => {
    h.owner = null;
    expect(await fetchBookAssetResult("kid-a", doc, rel)).toEqual({ cancelled: true });
    expect(get).not.toHaveBeenCalled();
    expect(h.headers).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("a failed hosted token lookup never issues an anonymous private GET", async () => {
    h.headers.mockResolvedValue({});
    expect(await fetchBookAssetResult("kid-a", doc, rel, 1)).toEqual({ transient: true });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses only the private owner proxy and disables browser HTTP cache and redirects", async () => {
    await fetchBookAssetResult("kid-a", doc, rel);
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/children\/kid-a\/book-assets\/synthetic-book\/file\?path=/), expect.objectContaining({ cache: "no-store", redirect: "error", credentials: "same-origin", signal: expect.any(AbortSignal) }));
  });
  it.each(["get", "headers", "fetch", "body"])("owner change during %s suppresses bytes and all later writes", async (step) => {
    const gate = deferred<unknown>();
    if (step === "get") get.mockImplementationOnce(async () => { await gate.promise; return undefined; });
    if (step === "headers") h.headers.mockImplementationOnce(() => gate.promise);
    if (step === "fetch") fetcher.mockImplementationOnce(() => gate.promise);
    if (step === "body") fetcher.mockResolvedValueOnce({ ok: true, status: 200, blob: () => gate.promise });
    const pending = fetchBookAssetResult("kid-a", doc, rel);
    await tick();
    h.owner = { uid: "owner-b" };
    const values = { get: undefined, headers: { Authorization: "Bearer old-token" }, fetch: new Response("old"), body: new Blob(["old"]) };
    gate.resolve(values[step]);
    expect(await pending).toEqual({ cancelled: true });
    expect(records.size).toBe(0);
    expect(put).not.toHaveBeenCalled();
    if (step === "get" || step === "headers") expect(fetcher).not.toHaveBeenCalled();
  });
  it("the auth observer boundary prevents A → B → A revival even with reused owner identity", () => {
    const owner = h.owner;
    const scope = createBookAssetScope("kid-a");
    h.owner = { uid: "owner-b" };
    retireBookAssetScopes();
    h.owner = owner;
    expect(scope.current()).toBe(false);
    expect(scope.signal.aborted).toBe(true);
  });
  it("a retired child/session callback cannot revive after A → B → A", async () => {
    let current = true;
    const scope = createBookAssetScope("kid-a", () => current);
    current = false;
    expect(scope.current()).toBe(false);
    current = true;
    expect(await fetchBookAssetResult("kid-a", doc, rel, 1, scope)).toEqual({ cancelled: true });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a scope for a different child", async () => {
    const scope = createBookAssetScope("kid-b");
    expect(await fetchBookAssetResult("kid-a", doc, rel, 1, scope)).toEqual({ cancelled: true });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("erase closes a pending download and prevents a stale mounted doc acquiring another scope", async () => {
    const gate = deferred<Response>();
    fetcher.mockImplementationOnce(() => gate.promise);
    const pending = fetchBookAssetResult("kid-a", doc, rel);
    await tick();
    const purge = purgeBookAssets("kid-a");
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    gate.resolve(new Response("late"));
    await purge;
    expect(await pending).toEqual({ cancelled: true });
    expect(await fetchBookAssetResult("kid-a", doc, rel)).toEqual({ cancelled: true });
    expect(records.size).toBe(0);
  });
  it("erase waits for an in-flight put, then removes the late bytes before resolving", async () => {
    const gate = deferred<void>();
    put.mockImplementationOnce(async (r: CachedFile) => { await gate.promise; records.set(r.id, r); });
    const pending = fetchBookAssetResult("kid-a", doc, rel);
    await tick();
    expect(put).toHaveBeenCalledTimes(1);
    let purged = false;
    const purge = purgeBookAssets("kid-a").then(() => { purged = true; });
    await tick();
    expect(purged).toBe(false);
    gate.resolve();
    await purge;
    expect(await pending).toEqual({ cancelled: true });
    expect(records.size).toBe(0);
  });
  it("failed deletion still closes this erased child's reads in the active owner session", async () => {
    await fetchBookAssetResult("kid-a", doc, rel);
    backend.deleteWhere = async () => { throw Error("unavailable"); };
    await purgeBookAssets("kid-a");
    expect(records.size).toBe(1);
    expect(await fetchBookAssetResult("kid-a", doc, rel)).toEqual({ cancelled: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("failed erased-child bytes cannot revive under a new Firebase user object with the same uid", async () => {
    await fetchBookAssetResult("kid-a", doc, rel);
    backend.deleteWhere = async () => { throw Error("unavailable"); };
    await purgeBookAssets("kid-a");
    h.owner = { uid: "owner-a" };
    retireBookAssetScopes();
    expect(await fetchBookAssetResult("kid-a", doc, rel)).toEqual({ cancelled: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rechecks lifetime after the cache helper resolves, before returning its bytes", async () => {
    const scope = createBookAssetScope("kid-a");
    get.mockImplementationOnce(async (id: string) => ({ id, childId: "kid-a", ownerId: "owner-a",
      get blob() { queueMicrotask(() => scope.close()); return new Blob(["retired bytes"]); },
    }));
    expect(await fetchBookAssetResult("kid-a", doc, rel, 1, scope)).toEqual({ cancelled: true });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("a queued put retired behind another write is never dispatched", async () => {
    const gate = deferred<void>();
    put.mockImplementationOnce(async (r: CachedFile) => { await gate.promise; records.set(r.id, r); });
    const first = fetchBookAssetResult("kid-b", doc, rel);
    await tick();
    const second = fetchBookAssetResult("kid-a", doc, rel);
    await tick();
    const purge = purgeBookAssets("kid-a");
    gate.resolve();
    await Promise.all([first, second, purge]);
    expect(put).toHaveBeenCalledTimes(1);
    expect([...records.values()].map(r => r.childId)).toEqual(["kid-b"]);
  });
  it("child erase preserves sibling bytes and sibling scopes; sign-out revokes both", async () => {
    await fetchBookAssetResult("kid-a", doc, rel);
    await fetchBookAssetResult("kid-b", doc, rel);
    const sibling = createBookAssetScope("kid-b");
    await purgeBookAssets("kid-a");
    expect(sibling.current()).toBe(true);
    expect([...records.values()].map((r) => r.childId)).toEqual(["kid-b"]);
    await purgeBookAssets();
    expect(sibling.current()).toBe(false);
    expect(records.size).toBe(0);
    expect(createBookAssetScope("kid-b").current()).toBe(false);
  });
  it("cancelled retries neither issue another GET nor cache a failed attempt", async () => {
    const scope = createBookAssetScope("kid-a");
    fetcher.mockResolvedValue(new Response("", { status: 503 }));
    setBookAssetSleep(async () => scope.close());
    expect(await fetchBookAssetResult("kid-a", doc, rel, 4, scope)).toEqual({ cancelled: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(records.size).toBe(0);
  });
  it("a caller admission exception fails closed", () => {
    expect(createBookAssetScope("kid-a", () => { throw Error("retired"); }).current()).toBe(false);
  });
});
