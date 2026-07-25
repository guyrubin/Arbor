import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MAX_PAGES,
  _resetComicPageStore,
  _setComicPageBackend,
  getComicPage,
  hasComicPage,
  purgeAllComicPages,
  purgeComicPages,
  putComicPage,
  type ComicPageBackend,
  type ComicPageRecord,
} from "./comicPageStore";

/**
 * AIX-S5 — device-local comic-page store.
 *
 * The store logic (LRU bound, per-child keying, per-child + full purge,
 * graceful no-IDB degradation) runs against an injected in-memory backend so
 * it is fully testable in the node environment. The IndexedDB backend is the
 * thin browser adapter over the same interface.
 */

function memBackend() {
  const map = new Map<string, ComicPageRecord>();
  const backend: ComicPageBackend = {
    async get(key) { return map.get(key); },
    async has(key) { return map.has(key); },
    async put(rec) { map.set(rec.key, { ...rec }); },
    async delete(key) { map.delete(key); },
    async getAll() { return [...map.values()]; },
    async clear() { map.clear(); },
  };
  return { map, backend };
}

let mem: ReturnType<typeof memBackend>;

beforeEach(() => {
  mem = memBackend();
  _setComicPageBackend(mem.backend);
});

afterEach(() => {
  _resetComicPageStore();
});

describe("comicPageStore — put/get/has", () => {
  it("round-trips a page data-URL keyed per child", async () => {
    await putComicPage("child-a", "comic3|story|en|0|h1", "data:image/png;base64,AAA");
    expect(await getComicPage("child-a", "comic3|story|en|0|h1")).toBe("data:image/png;base64,AAA");
    expect(await hasComicPage("child-a", "comic3|story|en|0|h1")).toBe(true);
    // Same scene key under a DIFFERENT child is a miss — per-child keying.
    expect(await getComicPage("child-b", "comic3|story|en|0|h1")).toBeUndefined();
    expect(await hasComicPage("child-b", "comic3|story|en|0|h1")).toBe(false);
  });

  it("records carry the childId (purge dimension)", async () => {
    await putComicPage("child-a", "k1", "data:1");
    const rec = [...mem.map.values()][0];
    expect(rec.childId).toBe("child-a");
    expect(rec.key).toBe("child-a|k1");
  });
});

describe("comicPageStore — LRU bound", () => {
  it(`keeps at most MAX_PAGES (${MAX_PAGES}) entries, evicting least-recently-used`, async () => {
    for (let i = 0; i < MAX_PAGES; i++) {
      await putComicPage("c", `k${i}`, `data:${i}`);
      // Deterministic recency order (Date.now can tie within a ms).
      mem.map.get(`c|k${i}`)!.lastUsed = i;
    }
    // Touch k0 so it becomes most-recently-used.
    mem.map.get("c|k0")!.lastUsed = MAX_PAGES + 1;
    await putComicPage("c", "overflow", "data:overflow");
    mem.map.get("c|overflow")!.lastUsed = MAX_PAGES + 2;
    // One eviction happened; the evicted entry is the LRU one (k1), not k0.
    expect(mem.map.size).toBe(MAX_PAGES);
    expect(await hasComicPage("c", "k0")).toBe(true);
    expect(await hasComicPage("c", "overflow")).toBe(true);
    expect(await hasComicPage("c", "k1")).toBe(false);
  });
});

describe("comicPageStore — GDPR purge hooks", () => {
  it("purgeComicPages removes ONLY the erased child's pages", async () => {
    await putComicPage("erased-child", "k1", "data:1");
    await putComicPage("erased-child", "k2", "data:2");
    await putComicPage("sibling", "k1", "data:3");
    await purgeComicPages("erased-child");
    expect(await hasComicPage("erased-child", "k1")).toBe(false);
    expect(await hasComicPage("erased-child", "k2")).toBe(false);
    expect(await hasComicPage("sibling", "k1")).toBe(true);
  });

  it("purgeAllComicPages clears every child's pages (sign-out)", async () => {
    await putComicPage("a", "k1", "data:1");
    await putComicPage("b", "k1", "data:2");
    await purgeAllComicPages();
    expect(mem.map.size).toBe(0);
  });
});

describe("comicPageStore — graceful degradation without IndexedDB", () => {
  it("all operations no-op (never throw) when no backend is available", async () => {
    _setComicPageBackend(null);
    await expect(putComicPage("c", "k", "data:1")).resolves.toBeUndefined();
    await expect(getComicPage("c", "k")).resolves.toBeUndefined();
    await expect(hasComicPage("c", "k")).resolves.toBe(false);
    await expect(purgeComicPages("c")).resolves.toBeUndefined();
    await expect(purgeAllComicPages()).resolves.toBeUndefined();
  });

  it("a throwing backend degrades to safe defaults", async () => {
    const boom: ComicPageBackend = {
      get: async () => { throw new Error("boom"); },
      has: async () => { throw new Error("boom"); },
      put: async () => { throw new Error("boom"); },
      delete: async () => { throw new Error("boom"); },
      getAll: async () => { throw new Error("boom"); },
      clear: async () => { throw new Error("boom"); },
    };
    _setComicPageBackend(boom);
    await expect(getComicPage("c", "k")).resolves.toBeUndefined();
    await expect(hasComicPage("c", "k")).resolves.toBe(false);
    await expect(putComicPage("c", "k", "d")).resolves.toBeUndefined();
    await expect(purgeComicPages("c")).resolves.toBeUndefined();
    await expect(purgeAllComicPages()).resolves.toBeUndefined();
  });
});
