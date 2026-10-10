/** Real store + resolver/erase functions, synthetic SDK, transport and device
 * backend. This is callback/lifetime evidence, not IndexedDB or rendered QA. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ owner: { uid: "owner-a" } as { uid: string } | null, erase: vi.fn(), comic: vi.fn() }));
vi.mock("./firebase", () => ({ firebaseEnabled: true, auth: { get currentUser() { return h.owner; } }, db: null }));
vi.mock("./api", () => ({ authHeaders: async () => ({ Authorization: "Bearer synthetic-token" }), api: { privacyErase: h.erase } }));
vi.mock("./comicPageStore", () => ({ purgeComicPages: h.comic }));
vi.mock("./heroRenderStore", () => ({ purgeHeroRenders: vi.fn(async () => {}) }));
import { createBookAssetScope, fetchBookAssetResult, purgeBookAssets, retireBookAssetScopes, setBookAssetBackend, setBookAssetSleep, type CachedFile } from "./bookAssetStore";
import { libraryBookCoverUrl, resolveBookAssets } from "./bookAssets";
import { deleteChildData, eraseEverything } from "./childData";
import type { BookAssetsDoc } from "./library/bookAssetPaths";
const rel = "hero-sheets/synthetic/sit.webp";
const doc: BookAssetsDoc = { id: "synthetic-book", bookId: "synthetic-book", sheetId: "synthetic", setId: "synthetic", sheetManifest: { poses: { sit: { file: "sit.webp" } }, prints: { cover: { file: "prints/cover.webp" } } }, files: [rel, "hero-sheets/synthetic/prints/cover.webp"], bytes: 5, createdAt: "synthetic-version" };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const tick = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
let records: Map<string, CachedFile>;
let fetcher: ReturnType<typeof vi.fn>;
let created: ReturnType<typeof vi.spyOn>;
let revoked: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  h.owner = { uid: "owner-a" }; records = new Map(); h.erase.mockReset().mockResolvedValue({ erased: { memoryEvents: 0, shares: 0 } }); h.comic.mockReset().mockResolvedValue(undefined);
  setBookAssetBackend({ get: async id => records.get(id), put: async r => { records.set(r.id, r); }, deleteWhere: async pred => { for (const [id, rec] of records) if (pred(rec)) records.delete(id); } });
  setBookAssetSleep(async () => {});
  fetcher = vi.fn(async () => new Response("synthetic")); vi.stubGlobal("fetch", fetcher);
  let id = 0; created = vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:synthetic-${++id}`); revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => { setBookAssetBackend(null); setBookAssetSleep(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("production private-book lifetimes", () => {
  it("retires the entire multi-file read and its already-created URLs during a passive owner transition", async () => {
    const gate = deferred<Response>();
    fetcher.mockImplementation(async (url: string) => url.includes("prints") ? gate.promise : new Response("synthetic"));
    const pending = resolveBookAssets("kid-a", doc, "en");
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await tick(); expect(created).toHaveBeenCalledTimes(1);
    h.owner = { uid: "owner-b" }; retireBookAssetScopes();
    expect(revoked).toHaveBeenCalledWith("blob:synthetic-1");
    gate.resolve(new Response("late old owner")); await rejected;
    expect(created).toHaveBeenCalledTimes(1);
    expect([...records.values()].every(r => r.ownerId === "owner-a")).toBe(true);
  });
  it("does not start a new batch under the next owner after a prior file completes", async () => {
    const priorCreate = created.getMockImplementation()!;
    created.mockImplementationOnce((blob) => { const url = priorCreate(blob); h.owner = { uid: "owner-b" }; retireBookAssetScopes(); return url; });
    await expect(resolveBookAssets("kid-a", doc, "en")).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["owner", "erase", "close"])("stops background retries after %s retirement and revokes the already-returned URLs", async (reason) => {
    const gate = deferred<void>(); const onLate = vi.fn();
    fetcher.mockImplementation(async (url: string) => new Response("synthetic", { status: url.includes("prints") ? 503 : 200 }));
    const result = await resolveBookAssets("kid-a", doc, "en", { onLate, sleep: () => gate.promise, lateRetryMs: [1] });
    const requests = fetcher.mock.calls.length;
    if (reason === "owner") { h.owner = { uid: "owner-b" }; retireBookAssetScopes(); }
    if (reason === "erase") await purgeBookAssets("kid-a");
    if (reason === "close") result.revoke();
    gate.resolve(); await tick();
    expect(fetcher).toHaveBeenCalledTimes(requests); expect(onLate).not.toHaveBeenCalled();
    expect(revoked).toHaveBeenCalledWith(result.sheet.poses.sit);
  });
  it("closing a scope during initial loading suppresses cover allocation", async () => {
    const scope = createBookAssetScope("kid-a"); const gate = deferred<Response>(); fetcher.mockReturnValue(gate.promise);
    const pending = libraryBookCoverUrl("kid-a", doc, scope);
    await tick(); scope.close(); gate.resolve(new Response("late cover"));
    expect(await pending).toBeNull(); expect(created).not.toHaveBeenCalled();
  });
  it.each([["deleteChildData", deleteChildData], ["eraseEverything", eraseEverything]] as const)("%s retires cached reads before awaiting its server erasure", async (_name, erase) => {
    await fetchBookAssetResult("kid-a", doc, rel);
    const scope = createBookAssetScope("kid-a"); const gate = deferred<unknown>(); h.erase.mockReturnValue(gate.promise);
    const pending = erase("owner-a", "kid-a");
    expect(scope.signal.aborted).toBe(true);
    expect(await fetchBookAssetResult("kid-a", doc, rel)).toEqual({ cancelled: true });
    gate.resolve({ erased: { memoryEvents: 0, shares: 0 } }); await pending;
    expect(records.size).toBe(0);
  });
  it("erase revokes before a delayed unrelated client purge too", async () => {
    const scope = createBookAssetScope("kid-a"); const gate = deferred<void>(); h.comic.mockReturnValue(gate.promise);
    const pending = eraseEverything("owner-a", "kid-a"); await tick();
    expect(scope.signal.aborted).toBe(true); gate.resolve(); await pending;
  });
});
