import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookAssetsDoc } from "../../../lib/library/bookAssetPaths";
const h = vi.hoisted(() => ({ owner: "owner-a", headers: vi.fn() }));
vi.mock("../../../lib/heroSheetStore", async original => ({
  ...await original<typeof import("../../../lib/heroSheetStore")>(), heroSheetOwnerKey: () => h.owner,
}));
vi.mock("../../../lib/api", async original => ({
  ...await original<typeof import("../../../lib/api")>(), authHeaders: () => h.headers(),
}));
import { afterBookSheet, browserNarrationDeps, buildBookNarration, ensureBookNarration, resetBookNarrationForTest,
  type NarrationBuilderDeps, type NarrationCall } from "./buildBookNarration";
const child = { id: "synthetic-child", name: "Aster", gender: "girl" as const };
const ok = (): NarrationCall => ({ ok: true, cached: true, complete: true });
const memory = () => { const m = new Map<string, string>(); return {
  m, getItem: (key: string) => m.get(key) ?? null, setItem: (key: string, value: string) => { m.set(key, value); },
}; };
const fake = (): NarrationBuilderDeps & { render: ReturnType<typeof vi.fn>; keepLocalDoc: ReturnType<typeof vi.fn>; sleep: ReturnType<typeof vi.fn> } => ({
  render: vi.fn(async () => ok()), keepLocalDoc: vi.fn(async () => {}), sleep: vi.fn(async () => {}),
});
beforeEach(() => { h.owner = "owner-a"; h.headers.mockReset().mockResolvedValue({ "content-type": "application/json" }); resetBookNarrationForTest(); });
afterEach(() => vi.unstubAllGlobals());

describe("parent narration job lifetime", () => {
  it("shares a pending phrase and deduplicates confirmed success even without storage", async () => {
    const f = fake(); let finish!: (v: NarrationCall) => void;
    f.render.mockImplementationOnce(() => new Promise<NarrationCall>(resolve => { finish = resolve; }));
    const first = ensureBookNarration(child, "he-f", f, null);
    const second = ensureBookNarration(child, "he-f", f, null);
    expect(second).toBe(first); expect(f.render).toHaveBeenCalledOnce();
    finish(ok()); expect((await first)?.status).toBe("complete"); expect(f.render).toHaveBeenCalledTimes(5);
    expect(ensureBookNarration(child, "he-f", f, null)).toBeNull();
  });
  it("a refused attempt can retry on the next explicit entry, not a page reload", async () => {
    const f = fake(); f.render.mockResolvedValueOnce({ ok: false, status: 403, code: "book_narration_plan" });
    expect(await ensureBookNarration(child, "en", f, null)).toMatchObject({ status: "not-started" });
    expect(await ensureBookNarration(child, "en", f, null)).toMatchObject({ status: "complete" });
    expect(f.render).toHaveBeenCalledTimes(6);
  });
  it("owner A's confirmed marker cannot skip owner B's same child/name/folder", async () => {
    const store = memory(); await ensureBookNarration(child, "en", fake(), store);
    expect(JSON.parse(store.m.get(`arbor.bookNarration.${child.id}`)!).owner).toBe("owner-a");
    h.owner = "owner-b"; const b = fake(); await ensureBookNarration(child, "en", b, store);
    expect(b.render).toHaveBeenCalledTimes(5);
    expect(JSON.parse(store.m.get(`arbor.bookNarration.${child.id}`)!).owner).toBe("owner-b");
  });
  it("does not trust an unowned old completion marker", async () => {
    const store = memory(); store.setItem(`arbor.bookNarration.${child.id}`, "Aster|girl|en");
    const f = fake(); await ensureBookNarration(child, "en", f, store); expect(f.render).toHaveBeenCalledTimes(5);
  });
  it("stops after a delayed response when the captured child lifetime changes", async () => {
    const f = fake(), store = memory(); let current = true, finish!: (v: NarrationCall) => void;
    f.render.mockImplementationOnce(() => new Promise<NarrationCall>(resolve => { finish = resolve; }));
    const job = ensureBookNarration(child, "en", f, store, { ownerKey: h.owner, isCurrent: () => current });
    current = false; finish(ok());
    expect(await job).toMatchObject({ stoppedBy: "scope_changed" }); expect(f.render).toHaveBeenCalledOnce();
    expect(f.keepLocalDoc).not.toHaveBeenCalled(); expect(store.m.size).toBe(0); expect(afterBookSheet(child.id, f)).toBeNull();
  });
  it("A–B–A cannot revive the retired job or delete the new job's lease", async () => {
    let lease = {}, finishOld!: (v: NarrationCall) => void, finishNew!: (v: NarrationCall) => void;
    const oldLease = lease, a = fake(), b = fake();
    a.render.mockImplementationOnce(() => new Promise<NarrationCall>(resolve => { finishOld = resolve; }));
    b.render.mockImplementationOnce(() => new Promise<NarrationCall>(resolve => { finishNew = resolve; }));
    const old = ensureBookNarration(child, "en", a, null, { ownerKey: h.owner, isCurrent: () => lease === oldLease });
    h.owner = "owner-b"; lease = {}; h.owner = "owner-a"; const newLease = lease;
    const fresh = ensureBookNarration(child, "en", b, null, { ownerKey: h.owner, isCurrent: () => lease === newLease });
    finishOld(ok()); expect(await old).toMatchObject({ stoppedBy: "scope_changed" });
    expect(ensureBookNarration(child, "en", b, null, { ownerKey: h.owner, isCurrent: () => lease === newLease })).toBe(fresh);
    finishNew(ok()); expect((await fresh)?.status).toBe("complete");
    expect(a.render).toHaveBeenCalledOnce(); expect(b.render).toHaveBeenCalledTimes(5);
  });
  it("a corrected name supersedes the previous configuration's pending result", async () => {
    const old = fake(), next = fake(); let finish!: (v: NarrationCall) => void;
    old.render.mockImplementationOnce(() => new Promise<NarrationCall>(resolve => { finish = resolve; }));
    const pending = ensureBookNarration(child, "en", old, null);
    await ensureBookNarration({ ...child, name: "Fern" }, "en", next, null);
    finish(ok()); expect(await pending).toMatchObject({ stoppedBy: "scope_changed" }); expect(old.render).toHaveBeenCalledOnce();
  });
  it("stops between rate-limit retries without issuing another request", async () => {
    const f = fake(); let current = true;
    f.render.mockResolvedValue({ ok: false, status: 429, code: "book_assets_rate" });
    f.sleep.mockImplementation(async () => { current = false; });
    expect(await ensureBookNarration(child, "en", f, null, { ownerKey: h.owner, isCurrent: () => current })).toMatchObject({ stoppedBy: "scope_changed" });
    expect(f.render).toHaveBeenCalledOnce();
  });
  it("a local write failure is not a confirmed success marker", async () => {
    const f = fake(); f.render.mockResolvedValue({ ok: true, complete: true, cached: true, local: true, doc: { id: "synthetic-book" } as BookAssetsDoc });
    f.keepLocalDoc.mockRejectedValue(new Error("storage unavailable"));
    const store = memory(); expect(await ensureBookNarration(child, "en", f, store)).toMatchObject({ stoppedBy: "local_storage" });
    expect(store.m.size).toBe(0);
  });
  it("a completed sheet cannot start narration with no deliberate entry intent", () => {
    const f = fake(); expect(afterBookSheet(child.id, f)).toBeNull(); expect(f.render).not.toHaveBeenCalled();
  });
  it("new owner or signed-out state cannot resume a previous owner's sheet continuation", async () => {
    await ensureBookNarration(child, "en", fake(), null);
    h.owner = "owner-b"; expect(afterBookSheet(child.id, fake())).toBeNull();
    h.owner = "signed-out"; expect(ensureBookNarration(child, "en", fake(), null)).toBeNull();
  });
});

describe("browser request admission", () => {
  it("rechecks the lifetime after awaiting credentials, before issuing a POST", async () => {
    let current = true, headers!: (v: Record<string, string>) => void;
    h.headers.mockImplementation(() => new Promise(resolve => { headers = resolve; }));
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const req = browserNarrationDeps(child.id, () => current).render({ bookId: "five-smooth-stones", lang: "en", file: "cover.mp3" });
    current = false; headers({ Authorization: "Bearer synthetic" });
    expect(await req).toMatchObject({ ok: false, code: "scope_changed" }); expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps request bodies to IDs and folder/file, never child name or profile", async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ complete: true, cached: true }) })); vi.stubGlobal("fetch", fetch);
    await browserNarrationDeps(child.id).render({ bookId: "five-smooth-stones", lang: "he-f", file: "cover.mp3" });
    expect((fetch.mock.calls as unknown[][])[0][0]).toBe(`/api/children/${child.id}/book-narration`);
    const init = (fetch.mock.calls as unknown[][])[0][1] as RequestInit;
    expect(Object.keys(JSON.parse(init.body as string)).sort()).toEqual(["bookId", "file", "lang"]);
  });
  it("does not keep a returned local document after the caller's scope retires", async () => {
    const f = fake(); let current = true;
    f.render.mockImplementation(async () => { current = false; return { ok: true, complete: true, cached: true, local: true, doc: {} as BookAssetsDoc }; });
    expect(await buildBookNarration({ childId: child.id, folder: "en" }, { ...f, isCurrent: () => current })).toMatchObject({ stoppedBy: "scope_changed" });
    expect(f.keepLocalDoc).not.toHaveBeenCalled();
  });
});
