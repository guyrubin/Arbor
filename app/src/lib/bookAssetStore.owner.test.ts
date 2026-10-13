import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ owner: "parent-a", listeners: new Set<() => void>() }));
vi.mock("./heroSheetStore", () => ({ heroSheetOwnerKey: () => h.owner, subscribeHeroSheetOwner: (fn: () => void) => { h.listeners.add(fn); return () => h.listeners.delete(fn); } }));
vi.mock("./api", () => ({ authHeaders: async () => ({ Authorization: `Bearer ${h.owner}` }) }));
import { fetchBookAssetResult, openBookAssetReadScope, purgeBookAssets, setBookAssetBackend, type CachedFile } from "./bookAssetStore";
import { resolveBookAssets } from "./bookAssets";
import type { BookAssetsDoc } from "./library/bookAssetPaths";
const rel = "hero-sheets/saved/idle.webp";
const doc: BookAssetsDoc = { id: "book", bookId: "book", sheetId: "saved", setId: "voice", createdAt: "frozen", sheetManifest: { poses: { idle: { file: "idle.webp" } } }, files: [rel], bytes: 5 };
const rows = new Map<string, CachedFile>();
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
const owner = (value: string) => { h.owner = value; h.listeners.forEach(fn => fn()); };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const backend = () => ({ get: async (id: string) => rows.get(id), put: async (row: CachedFile) => { rows.set(row.id, row); }, deleteWhere: async (predicate: (r: CachedFile) => boolean) => { for (const [id, row] of rows) if (predicate(row)) rows.delete(id); } });
beforeEach(() => { rows.clear(); h.owner = "parent-a"; h.listeners.clear(); setBookAssetBackend(backend()); vi.stubGlobal("fetch", vi.fn(async () => new Response(h.owner))); });
afterEach(() => { setBookAssetBackend(null); vi.unstubAllGlobals(); });
describe("private book cache scope", () => {
  it("isolates same child/book ids across owners and ignores legacy unowned rows", async () => {
    rows.set(`kid|book|frozen|${rel}`, { id: `kid|book|frozen|${rel}`, childId: "kid", blob: new Blob(["legacy"]) });
    const a = await fetchBookAssetResult("kid", doc, rel); expect("blob" in a && await a.blob.text()).toBe("parent-a");
    await fetchBookAssetResult("kid", doc, rel); expect(fetch).toHaveBeenCalledTimes(1);
    owner("parent-b"); const b = await fetchBookAssetResult("kid", doc, rel);
    expect("blob" in b && await b.blob.text()).toBe("parent-b"); expect(fetch).toHaveBeenCalledTimes(2);
    expect([...rows.values()].filter(r => r.ownerKey).map(r => r.ownerKey).sort()).toEqual(["parent-a", "parent-b"]);
  });
  it("rejects cached bytes when the owner changes during the cache read", async () => {
    const gate = deferred<CachedFile>();
    setBookAssetBackend({ ...backend(), get: () => gate.promise });
    const reading = fetchBookAssetResult("kid", doc, rel); const assertion = expect(reading).rejects.toThrow("retired");
    owner("parent-b"); gate.resolve({ id: "old", childId: "kid", ownerKey: "parent-a", blob: new Blob(["old"]) });
    await assertion; expect(fetch).not.toHaveBeenCalled();
  });
  it("latches A → B → A and blocks a late body from being returned or cached", async () => {
    const body = deferred<Blob>(); vi.stubGlobal("fetch", vi.fn(async () => ({ status: 200, ok: true, blob: () => body.promise })));
    const reading = fetchBookAssetResult("kid", doc, rel); const assertion = expect(reading).rejects.toThrow("retired");
    await flush(); owner("parent-b"); owner("parent-a"); body.resolve(new Blob(["old"]));
    await assertion; expect(rows.size).toBe(0);
  });
  it("serializes purge behind an in-flight put and never resurrects erased bytes", async () => {
    const gate = deferred<void>(), started = deferred<void>(); const base = backend();
    setBookAssetBackend({ ...base, put: async row => { started.resolve(); await gate.promise; await base.put(row); } });
    const reading = fetchBookAssetResult("kid", doc, rel); const assertion = expect(reading).rejects.toThrow("retired");
    await started.promise; const erasing = purgeBookAssets("kid"); gate.resolve();
    await Promise.all([assertion, erasing]); expect(rows.size).toBe(0);
  });
  it("an erase retires only that child's scope; sign-out purge retires all", async () => {
    const a = openBookAssetReadScope("a"), b = openBookAssetReadScope("b");
    await purgeBookAssets("a"); expect(a.current()).toBe(false); expect(b.current()).toBe(true);
    await purgeBookAssets(); expect(b.current()).toBe(false); a.close(); b.close();
  });
  it("one reader scope covers later batches and releases partial URLs when its caller retires", async () => {
    const gate = deferred<Response>(); let current = true;
    const create = vi.spyOn(URL, "createObjectURL"), revoke = vi.spyOn(URL, "revokeObjectURL");
    const poses = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`pose${i}`, { file: `pose${i}.webp` }]));
    vi.stubGlobal("fetch", vi.fn((url: string) => url.includes("pose1") ? gate.promise : Promise.resolve(new Response("bytes"))));
    const reading = resolveBookAssets("kid", { ...doc, sheetManifest: { poses }, files: Object.values(poses).map(p => `hero-sheets/saved/${p.file}`) }, "en", { isCurrent: () => current });
    const assertion = expect(reading).rejects.toThrow("retired"); await flush(); current = false; gate.resolve(new Response("late")); await assertion;
    expect(fetch).toHaveBeenCalledTimes(6); expect(revoke).toHaveBeenCalledTimes(create.mock.calls.length);
    create.mockRestore(); revoke.mockRestore();
  });
});
