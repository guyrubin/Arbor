/**
 * B-KID-78 (KB-42) — kid books work offline: the home hands the service
 * worker Tonight's cover, the last 3 opened books' covers and the theme's
 * tile art (web-sized webp only); the worker keeps them in a kid-art cache
 * that survives deploys and serves /visuals/** cache-first. The worker is
 * run for real here (public/sw.js in a vm with fake caches + fetch).
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { KID_RECENT_BOOKS, kidOfflineArtUrls, precacheKidArt, recentlyOpenedStoryIds } from "./kidOfflineArt";
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
    const urls = kidOfflineArtUrls("film3d", "noahs-ark", ["david-and-goliath", "noahs-ark", "the-lantern-path", "jonah-and-the-great-fish"]);
    const noah = kidArt("film3d", storyCoverKey("noahs-ark"))!;
    expect(urls).toContain(noah.src480);
    expect(urls).toContain(noah.src);
    expect(urls).toContain(kidArt("film3d", storyCoverKey("david-and-goliath"))!.src480);
    expect(urls.some((u) => u.includes("jonah"))).toBe(false); // 4th recent: not kept
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
    skipWaiting: () => undefined,
    clients: { claim: async () => undefined },
  };
  const fetch = async (r: { url: string }) => {
    if (!online) throw new Error("offline");
    return { ok: true, body: `net:${r.url.replace("https://arbor.test", "")}`, clone() { return this; } };
  };
  vm.runInNewContext(swSource.replace(/__BUILD_ID__/g, "b2"), { self, caches, fetch, URL, Promise, Array, console });
  const run = async (type: string, e: Record<string, unknown>) => {
    let done: Promise<unknown> = Promise.resolve();
    listeners[type]({ ...e, waitUntil: (p: Promise<unknown>) => { done = p; }, respondWith: (p: Promise<unknown>) => { done = p; } });
    return done;
  };
  return { stores, run, setOnline: (v: boolean) => { online = v; } };
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
