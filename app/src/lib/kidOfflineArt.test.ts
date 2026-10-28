/**
 * B-KID-78 (KB-42) — kid books work offline: the home hands the service
 * worker Tonight's cover, the last 3 opened books' covers and the theme's
 * tile art (web-sized webp only); the worker keeps them in a kid-art cache
 * that survives deploys and serves /visuals/** cache-first. The worker is
 * run for real here (public/sw.js in a vm with fake caches + fetch).
 */
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { KID_ART_MESSAGE_MAX, KID_RECENT_BOOKS, kidOfflineArtUrls, libraryBookArtUrls, offlineLibraryBooks, precacheKidArt, recentlyOpenedStoryIds } from "./kidOfflineArt";
import { KID_WORLD_TILE_IDS, kidArt, storyCoverKey } from "./kidThemeManifest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, "..", "..");
const swSource = readFileSync(path.join(APP, "public", "sw.js"), "utf8");

describe("what the home asks to keep", () => {
  it("the last 3 distinct books opened, newest first", () => {
    const runs = [
      { storyId: "a", startedAt: "2026-10-01T10:00:00Z" },
      { storyId: "b", startedAt: "2026-10-04T10:00:00Z" },
      { storyId: "a", startedAt: "2026-10-05T10:00:00Z" },
      { storyId: "c", startedAt: "2026-10-03T10:00:00Z" },
      { storyId: "d", startedAt: "2026-09-01T10:00:00Z" },
    ];
    expect(recentlyOpenedStoryIds(runs)).toEqual(["a", "b", "c"]);
    expect(KID_RECENT_BOOKS).toBe(3);
  });
  it("Tonight's cover + 3 recent covers (both web sizes) + every home tile (480) of the active theme; webp only, deduped", () => {
    // B-BOOK-31: only hero-free covers are kept (the storybook plates); a cover
    // that paints the reference family's child is shown nowhere, so never kept.
    const kept = kidOfflineArtUrls("storybook", "the-lantern-path", ["the-cloud-orchestra", "the-lantern-path", "noahs-ark", "the-little-bridge-builders"]);
    const lantern = kidArt("storybook", storyCoverKey("the-lantern-path"))!;
    expect(kept).toContain(lantern.src480);
    expect(kept).toContain(lantern.src);
    expect(kept).toContain(kidArt("storybook", storyCoverKey("the-cloud-orchestra"))!.src480);
    expect(kept.some((u) => u.includes("bridge-builders"))).toBe(false); // 4th recent: not kept
    const urls = kidOfflineArtUrls("film3d", "noahs-ark", ["david-and-goliath", "noahs-ark", "the-lantern-path", "jonah-and-the-great-fish"]);
    expect(urls.some((u) => u.includes("/cards/web/story-"))).toBe(false);
    for (const id of KID_WORLD_TILE_IDS) expect(urls).toContain(kidArt("film3d", `world.${id}.tile`)!.src480);
    expect(urls.every((u) => u.startsWith("/visuals/") && u.endsWith(".webp"))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.length).toBeLessThanOrEqual(40);
    // the storybook theme keeps ITS tiles, never film3d's
    expect(kidOfflineArtUrls("storybook", null, []).every((u) => !u.includes("/cards/web/"))).toBe(true);
  });
  it("posts to the active worker only; no worker = no-op", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("navigator", { serviceWorker: { controller: { postMessage } } });
    precacheKidArt(["/visuals/a-480.webp"]);
    expect(postMessage).toHaveBeenCalledWith({ type: "kid-art-precache", urls: ["/visuals/a-480.webp"] });
    vi.stubGlobal("navigator", {});
    expect(() => precacheKidArt(["/visuals/a-480.webp"])).not.toThrow();
    vi.unstubAllGlobals();
  });
  it("the kid home calls it", () => {
    const dash = readFileSync(path.join(__dirname, "..", "components", "kidmode", "KidDashboard.tsx"), "utf8");
    expect(dash).toContain("kidOfflineArtUrls(kidTheme, tonightsStoryId, recentlyOpenedStoryIds(heroRunsCol.items))");
    expect(dash).toContain("precacheKidArt(");
  });
});

/* ── the worker itself ─────────────────────────────────────────────────────── */
function bootWorker(online = true) {
  const stores = new Map<string, Map<string, string>>();
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    const key = (r: unknown) => (typeof r === "string" ? r : (r as { url: string }).url).replace("https://arbor.test", "");
    return {
      match: async (r: unknown) => m.get(key(r)),
      add: async (r: string) => { if (!online) throw new Error("offline"); m.set(key(r), `net:${key(r)}`); },
      addAll: async (rs: string[]) => { for (const r of rs) m.set(key(r), `net:${key(r)}`); },
      put: async (r: unknown, res: { body: string }) => { m.set(key(r), res.body); },
      keys: async () => [...m.keys()],
      delete: async (r: unknown) => m.delete(key(r)),
    };
  };
  const caches = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (k: string) => stores.delete(k),
    match: async (r: unknown) => {
      for (const m of stores.values()) { const hit = m.get(typeof r === "string" ? r : (r as { url: string }).url.replace("https://arbor.test", "")); if (hit) return hit; }
      return undefined;
    },
  };
  const listeners: Record<string, (e: unknown) => void> = {};
  const self = {
    location: { origin: "https://arbor.test" },
    addEventListener: (t: string, fn: (e: unknown) => void) => { listeners[t] = fn; },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => undefined) },
  };
  let version = 'net';
  const fetch = vi.fn(async (r: { url: string }) => {
    if (!online) throw new Error("offline");
    return { ok: true, body: `${version}:${r.url.replace("https://arbor.test", "")}`, clone() { return this; } };
  });
  vm.runInNewContext(swSource.replace(/__BUILD_ID__/g, "b2"), { self, caches, fetch, URL, Promise, Array, console, Response });
  const run = async (type: string, e: Record<string, unknown>) => {
    const work: Promise<unknown>[] = [];
    let response: Promise<unknown> | undefined;
    listeners[type]({ ...e, waitUntil: (p: Promise<unknown>) => { work.push(p); }, respondWith: (p: Promise<unknown>) => { response = p; } });
    const result = await response;
    await Promise.all(work);
    return result;
  };
  return { stores, run, fetch, self, setOnline: (v: boolean) => { online = v; }, setVersion: (v: string) => { version = v; } };
}

describe("public/sw.js keeps kid art across deploys", () => {
  it("accepts only web-sized webp under /visuals/ (max 40), stores them in the versioned kid-art cache", async () => {
    const w = bootWorker();
    await w.run("message", { data: { type: "kid-art-precache", urls: ["/visuals/cards/web/game-memory-480.webp", "/api/secret", "https://evil.test/x.webp", "/visuals/../index.html", "/visuals/x.png"] } });
    expect([...w.stores.get("arbor-kid-art-v1")!.keys()]).toEqual(["/visuals/cards/web/game-memory-480.webp"]);
    expect(swSource).toContain("const ART_MAX = 40;");
  });
  it("activate keeps this build's shell and the current art cache; drops old shells and old art versions", async () => {
    const w = bootWorker();
    for (const k of ["arbor-shell-b1", "arbor-shell-b2", "arbor-kid-art-v0", "arbor-kid-art-v1"]) w.stores.set(k, new Map());
    await w.run("activate", {});
    expect([...w.stores.keys()].sort()).toEqual(["arbor-kid-art-v1", "arbor-shell-b2"]);
  });
  it("/visuals/** is cache-first from the art cache: offline, a kept cover still loads", async () => {
    const w = bootWorker();
    await w.run("message", { data: { type: "kid-art-precache", urls: ["/visuals/cards/web/noahs-ark-480.webp"] } });
    w.setOnline(false);
    const res = await w.run("fetch", { request: { method: "GET", url: "https://arbor.test/visuals/cards/web/noahs-ark-480.webp", mode: "no-cors" } });
    expect(res).toBe("net:/visuals/cards/web/noahs-ark-480.webp");
  });
  it("online, a new /visuals/ file is fetched once and kept in the art cache", async () => {
    const w = bootWorker();
    await w.run("fetch", { request: { method: "GET", url: "https://arbor.test/visuals/worlds/v2/mind-vault-v2-480.webp", mode: "no-cors" } });
    await new Promise((r) => setTimeout(r, 0));
    expect(w.stores.get("arbor-kid-art-v1")!.has("/visuals/worlds/v2/mind-vault-v2-480.webp")).toBe(true);
  });
  it("the shell cache is still stamped per build (the repo's version bump) and the art cache is versioned by hand", () => {
    expect(swSource).toContain('const CACHE = "arbor-shell-__BUILD_ID__";');
    expect(swSource).toContain('const ART_VERSION = "v1";');
  });
});


describe('session-safe worker updates and bounded public artwork', () => {
  it('never force-activates, claims clients, or reloads an active page', async () => {
    const w = bootWorker(); await w.run('install', {}); await w.run('activate', {});
    expect(w.self.skipWaiting).not.toHaveBeenCalled(); expect(w.self.clients.claim).not.toHaveBeenCalled();
    const main = readFileSync(path.join(APP, 'src/main.tsx'), 'utf8');
    expect(main).not.toContain('window.location.reload()');
    expect(main).not.toContain("addEventListener('controllerchange'");
  });
  it('does not delete unrelated origin caches', async () => {
    const w = bootWorker(); w.stores.set('private-books-v1', new Map());
    await w.run('activate', {}); expect(w.stores.has('private-books-v1')).toBe(true);
  });
  it('paints kept art and refreshes a stable URL once per worker lifetime', async () => {
    const w = bootWorker(), url = '/visuals/a.webp';
    await w.run('message', { data: { type: 'kid-art-precache', urls: [url] } });
    w.setVersion('new');
    const request = { method: 'GET', url: `https://arbor.test${url}`, mode: 'no-cors' };
    expect(await w.run('fetch', { request })).toBe(`net:${url}`);
    expect(w.stores.get('arbor-kid-art-v1')?.get(url)).toBe(`new:${url}`);
    expect(await w.run('fetch', { request })).toBe(`new:${url}`);
    expect(w.fetch).toHaveBeenCalledOnce();
  });
  it('enforces a total cache cap across multiple precache messages', async () => {
    const w = bootWorker();
    for (let batch = 0; batch < 8; batch++) {
      await w.run('message', { data: { type: 'kid-art-precache', urls: Array.from({ length: 40 }, (_, n) => `/visuals/${batch}-${n}.webp`) } });
    }
    expect(w.stores.get('arbor-kid-art-v1')?.size).toBe(256);
    expect(w.stores.get('arbor-kid-art-v1')?.has('/visuals/7-39.webp')).toBe(true);
  });
  it('does not intercept API, cross-origin, or non-GET requests', async () => {
    const w = bootWorker();
    for (const request of [
      { method: 'GET', url: 'https://arbor.test/api/private' },
      { method: 'GET', url: 'https://storage.example/child.webp' },
      { method: 'POST', url: 'https://arbor.test/visuals/a.webp' },
    ]) expect(await w.run('fetch', { request })).toBeUndefined();
    expect(w.fetch).not.toHaveBeenCalled();
  });
});

/* ── B-BOOK-27 (T15): Tonight's library book + the last 3 finished ───────── */
describe("B-BOOK-27: a library book's shared art is kept offline", () => {
  it("the proof book: every page's plate, every art-state plate and every overlay — public webp, one message", async () => {
    const { fiveSmoothStones } = await import("./library/books/fiveSmoothStones");
    const { allBookPages } = await import("./library/bookShape");
    const { BOOK_PLATES } = await import("./library/books");
    const urls = libraryBookArtUrls(fiveSmoothStones);
    const table = BOOK_PLATES[fiveSmoothStones.id];
    for (const page of allBookPages(fiveSmoothStones)) {
      expect(urls, page.id).toContain(table[page.plateId].file);
      for (const st of page.artStates ?? []) if (st.plateId) expect(urls, `${page.id} ${st.id}`).toContain(table[st.plateId].file);
      for (const o of page.overlays ?? []) expect(urls, `${page.id} ${o.id}`).toContain(o.file);
    }
    expect(urls.every((u) => u.startsWith(`/visuals/books/${fiveSmoothStones.id}/`) && u.endsWith(".webp"))).toBe(true);
    for (const u of urls) expect(existsSync(path.join(APP, "public", u)), u).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });
  it("every book of the registry fits one worker message (so no plate of Tonight is cut off)", async () => {
    const { allBooks } = await import("./library/books");
    const { PLAN_FIXTURE_BOOKS } = await import("./library/plans/planBooks");
    expect(KID_ART_MESSAGE_MAX).toBe(Number(/const ART_MAX = (\d+);/.exec(swSource)![1]));
    for (const book of [...allBooks(), ...Object.values(PLAN_FIXTURE_BOOKS)]) expect(libraryBookArtUrls(book).length, book.id).toBeLessThanOrEqual(KID_ART_MESSAGE_MAX);
    // a plan plate painted in product reads through the signed-in route: never handed to the worker
    for (const book of Object.values(PLAN_FIXTURE_BOOKS)) expect(libraryBookArtUrls(book).every((u) => u.startsWith("/visuals/plans/")), book.id).toBe(true);
  });
  it("Tonight first, then up to 3 other books finished most recently (a plan book by its pattern id); unread books wait", () => {
    const e = (id: string, pattern?: string) => ({ book: (pattern ? { id, kind: "plan", pattern } : { id }) as never });
    const shelf = [e("tonight"), e("a"), e("b"), e("c"), e("d"), e("plan-x--1", "plan-x"), e("never-read")];
    const reads = [
      { bookId: "a", finishedAt: "2026-10-01T10:00:00Z" },
      { bookId: "b", finishedAt: "2026-10-05T10:00:00Z" },
      { bookId: "a", finishedAt: "2026-10-06T10:00:00Z" },
      { bookId: "c", finishedAt: "2026-09-01T10:00:00Z" },
      { bookId: "plan-x", finishedAt: "2026-10-04T10:00:00Z" },
      { bookId: "d", finishedAt: "2026-08-01T10:00:00Z" },
    ];
    expect(offlineLibraryBooks(shelf, reads).map((x) => (x.book as { id: string }).id)).toEqual(["tonight", "a", "b", "plan-x--1"]);
    expect(offlineLibraryBooks(shelf, []).map((x) => (x.book as { id: string }).id)).toEqual(["tonight"]);
    expect(offlineLibraryBooks([], reads)).toEqual([]);
  });
  it("the worker keeps the whole book from one message and serves a plate offline", async () => {
    const { fiveSmoothStones } = await import("./library/books/fiveSmoothStones");
    const urls = libraryBookArtUrls(fiveSmoothStones);
    const w = bootWorker();
    await w.run("message", { data: { type: "kid-art-precache", urls } });
    expect([...w.stores.get("arbor-kid-art-v1")!.keys()].sort()).toEqual([...urls].sort());
    w.setOnline(false);
    const res = await w.run("fetch", { request: { method: "GET", url: `https://arbor.test${urls[0]}`, mode: "no-cors" } });
    expect(res).toBe(`net:${urls[0]}`);
  });
  it("the kid home hands the worker Tonight's and the last finished books, one message per book", () => {
    const dash = readFileSync(path.join(__dirname, "..", "components", "kidmode", "KidDashboard.tsx"), "utf8");
    expect(dash).toContain("offlineLibraryBooks(onOpenBook ? libraryBooks : [], bookReadsCol.items).map((e) => libraryBookArtUrls(e.book).join(\"|\"))");
    expect(dash).toContain("useChildCollection<BookRead>(childProfile.id, BOOK_READS)");
    expect(dash).toMatch(/for \(const list of offlineBooksKey \? offlineBooksKey\.split\("\\n"\) : \[\]\) precacheKidArt\(/);
  });
});
