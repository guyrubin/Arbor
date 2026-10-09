/**
 * B-BOOK release — the production door's data side: which library books a
 * child may see (a COMPLETE private hero sheet only), and how the private
 * files are read (owner-checked proxy, bearer token, device cache, blob URLs,
 * purged with the child).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({ authHeaders: async () => ({ "Content-Type": "application/json", Authorization: "Bearer T" }) }));

import { fetchBookAsset, purgeBookAssets, setBookAssetBackend, type BookAssetBackend, type CachedFile } from "./bookAssetStore";
import { fillSharedNarration, libraryBookEntries, resolveBookAssets } from "./bookAssets";
import { bookPoseIds, missingBookPoses } from "./library/bookPoses";
import { fiveSmoothStones as book } from "./library/books/fiveSmoothStones";
import type { BookAssetsDoc } from "./library/bookAssetPaths";

const POSES = bookPoseIds(book);
function docWith(poses: string[], extra: Partial<BookAssetsDoc> = {}): BookAssetsDoc {
  const p = Object.fromEntries(poses.map((x) => [x, { file: `${x}.webp`, aspect: 0.6, footX: 0.5, footW: 0.3 }]));
  return {
    id: book.id,
    bookId: book.id,
    sheetId: "dylan-v2",
    setId: "dylan-v3",
    sheetManifest: { poses: p, prints: { cover: { file: "prints/cover.webp", w: 1920, h: 1280 } }, choices: { a: "choices/a.webp" } },
    files: [
      ...poses.map((x) => `hero-sheets/dylan-v2/${x}.webp`),
      "hero-sheets/dylan-v2/prints/cover.webp",
      "hero-sheets/dylan-v2/choices/a.webp",
      "narration/dylan-v3/en/p1.mp3",
      "narration/dylan-v3/en/p9.mp3",
      "narration/dylan-v3/en/p9.cues.json",
      "narration/dylan-v3/he-m/p1.mp3",
    ],
    bytes: 1,
    createdAt: "2026-10-06T10:00:00+00:00",
    ...extra,
  };
}

function memoryBackend(): BookAssetBackend & { recs: Map<string, CachedFile> } {
  const recs = new Map<string, CachedFile>();
  return {
    recs,
    get: async (id) => recs.get(id),
    put: async (r) => void recs.set(r.id, r),
    deleteWhere: async (pred) => {
      for (const [k, r] of recs) if (pred(r)) recs.delete(k);
    },
  };
}

describe("which books a child sees", () => {
  it("the book needs every page pose, repair end pose, costume pose and art-state pose", () => {
    for (const p of ["look-up", "stand-tall", "sit-hunched", "sling-release", "worried-tunic", "free-stretch", "walk-bread"]) expect(POSES, p).toContain(p);
  });

  it("a complete sheet opens the book; a sheet missing a pose (with no stopgap) or an unknown book never shows", () => {
    expect(libraryBookEntries([docWith(POSES)]).map((e) => e.book.id)).toEqual([book.id]);
    expect(libraryBookEntries([docWith(POSES.filter((p) => p !== "walk-bread"))])).toEqual([]);
    expect(libraryBookEntries([docWith(POSES, { bookId: "no-such-book" })])).toEqual([]);
    // a pose the manifest names but whose file was not uploaded does not count
    const d = docWith(POSES);
    expect(libraryBookEntries([{ ...d, files: d.files.filter((f) => !f.endsWith("/walk-bread.webp")) }])).toEqual([]);
    // the book's stopgaps count: a sheet without sling-release still opens (sling-swing-face-right stands in)
    expect(missingBookPoses(book, POSES.filter((p) => p !== "sling-release"))).toEqual([]);
  });
});

describe("reading the private files", () => {
  let backend: ReturnType<typeof memoryBackend>;
  const calls: { url: string; auth: string | null }[] = [];
  beforeEach(() => {
    backend = memoryBackend();
    setBookAssetBackend(backend);
    calls.length = 0;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, auth: new Headers(init?.headers).get("authorization") });
      // the shared set (public, static) answers its own cue times
      if (url.startsWith("/audio/")) return new Response(JSON.stringify({ flight: 15063, boom: 20437 }), { status: 200, headers: { "content-type": "application/json" } });
      const body = url.includes("cues.json") ? JSON.stringify({ flight: 6200, boom: 8100 }) : "BYTES";
      return new Response(body, { status: 200 });
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setBookAssetBackend(null);
  });

  it("fetches through the owner-checked proxy with the bearer token, once, then from the device", async () => {
    const d = docWith(POSES);
    const a = await fetchBookAsset("kid1", d, "narration/dylan-v3/en/p1.mp3");
    expect(a).not.toBeNull();
    expect(calls).toEqual([{ url: "/api/children/kid1/book-assets/five-smooth-stones/file?path=narration%2Fdylan-v3%2Fen%2Fp1.mp3", auth: "Bearer T" }]);
    await fetchBookAsset("kid1", d, "narration/dylan-v3/en/p1.mp3");
    expect(calls).toHaveLength(1);
    // never a path the doc does not list, never another shape
    expect(await fetchBookAsset("kid1", d, "narration/dylan-v3/en/p2.mp3")).toBeNull();
    expect(await fetchBookAsset("kid1", d, "../x.mp3")).toBeNull();
    expect(calls).toHaveLength(1);
    // a re-upload (new createdAt) fetches fresh copies
    await fetchBookAsset("kid1", { ...d, createdAt: "2026-10-07T00:00:00+00:00" }, "narration/dylan-v3/en/p1.mp3");
    expect(calls).toHaveLength(2);
  });

  it("resolves the sheet (poses, anchors, prints, choices) and ONE voice folder (files + cue sidecars) as blob URLs", async () => {
    const r = await resolveBookAssets("kid1", docWith(POSES), "en");
    expect(Object.keys(r.sheet.poses).sort()).toEqual([...POSES].sort());
    expect(r.sheet.poses["look-up"]).toMatch(/^blob:/);
    expect(r.sheet.anchors?.["look-up"]).toEqual({ aspect: 0.6, footX: 0.5, footW: 0.3 });
    expect(r.sheet.prints?.cover).toMatchObject({ width: 1920, height: 1280 });
    expect(r.sheet.choices?.a).toMatch(/^blob:/);
    const own = Object.entries(r.narration.files).filter(([, u]) => u.startsWith("blob:")).map(([k]) => k).sort();
    expect(own).toEqual(["en/p1.mp3", "en/p9.mp3"]);
    expect(r.narration.cues).toEqual({ "en/p9": { flight: 6200, boom: 8100 } });
    expect(calls.some((c) => c.url.includes("he-m"))).toBe(false);
    r.revoke();
  });

  const SHARED = "/audio/books/five-smooth-stones/shared-v3";
  const NAME_BEARING = ["cover.mp3", "p1.mp3", "p10.a.mp3", "p10.b.mp3", "p10.c.mp3"];

  it("K2: the child's own files win; the shared set fills only the name-free gaps; a name-bearing file is never shared", async () => {
    const d = docWith(POSES);
    const r = await resolveBookAssets("kid1", { ...d, files: [...d.files, "narration/dylan-v3/en/p2.wav"] }, "en");
    const f = r.narration.files;
    // own: .mp3, and a .wav twin keeps its page (the shared .mp3 never shadows it)
    expect(f["en/p1.mp3"]).toMatch(/^blob:/);
    expect(f["en/p9.mp3"]).toMatch(/^blob:/);
    expect(f["en/p2.wav"]).toMatch(/^blob:/);
    expect(f["en/p2.mp3"]).toBeUndefined();
    // the child's own sidecar stays with the child's own audio
    expect(r.narration.cues["en/p9"]).toEqual({ flight: 6200, boom: 8100 });
    // shared: the name-free gaps, from the public set of the same folder
    expect(f["en/p3.mp3"]).toBe(`${SHARED}/en/p3.mp3`);
    expect(f["en/p5-choice.b.mp3"]).toBe(`${SHARED}/en/p5-choice.b.mp3`);
    expect(f["en/p7b-after.mp3"]).toBe(`${SHARED}/en/p7b-after.mp3`);
    expect(f["en/p8.c.mp3"]).toBe(`${SHARED}/en/p8.c.mp3`);
    // never a name-bearing file from the shared set (the child lacks them: silence)
    for (const n of NAME_BEARING.filter((x) => x !== "p1.mp3")) expect(f[`en/${n}`], n).toBeUndefined();
    for (const [k, u] of Object.entries(f)) if (!u.startsWith("blob:")) expect(u, k).toBe(`${SHARED}/${k}`);
    // no cue sidecar fetched for a page the child has
    expect(calls.some((c) => c.url.startsWith("/audio/"))).toBe(false);
    r.revoke();
  });

  it("K2: he-f reads the he-m shared files for the name-free pages; never for a name-bearing one", async () => {
    const d = docWith(POSES);
    const r = await resolveBookAssets("kid1", { ...d, files: [...d.files.filter((x) => !x.startsWith("narration/")), "narration/dylan-v3/he-f/p1.mp3"] }, "he-f");
    const f = r.narration.files;
    expect(f["he-f/p1.mp3"]).toMatch(/^blob:/);
    expect(f["he-f/p2.mp3"]).toBe(`${SHARED}/he-m/p2.mp3`);
    expect(f["he-f/p8.a.mp3"]).toBe(`${SHARED}/he-m/p8.a.mp3`);
    for (const n of NAME_BEARING.filter((x) => x !== "p1.mp3")) expect(f[`he-f/${n}`], n).toBeUndefined();
    expect(Object.keys(f).every((k) => k.startsWith("he-f/"))).toBe(true);
    expect(Object.values(f).some((u) => u.includes("/he-f/"))).toBe(false);
    r.revoke();
  });

  it("K2: a page played from the shared set reads the shared cue sidecar (the child's stray sidecar is dropped)", async () => {
    const d = docWith(POSES);
    const r = await resolveBookAssets("kid1", { ...d, files: d.files.filter((x) => x !== "narration/dylan-v3/en/p9.mp3") }, "en");
    expect(r.narration.files["en/p9.mp3"]).toBe(`${SHARED}/en/p9.mp3`);
    expect(r.narration.cues["en/p9"]).toEqual({ flight: 15063, boom: 20437 });
    expect(calls.filter((c) => c.url.startsWith("/audio/")).map((c) => [c.url, c.auth])).toEqual([[`${SHARED}/en/p9.cues.json`, null]]);
    r.revoke();
  });

  it("K2: a book without a shared set (or an unknown book) gets nothing from it", async () => {
    const files: Record<string, string> = {};
    await fillSharedNarration("abrams-long-road", "en", files, {});
    await fillSharedNarration("no-such-book", "en", files, {});
    expect(files).toEqual({});
  });

  it("erase / sign-out remove the device copies", async () => {
    const d = docWith(POSES);
    await fetchBookAsset("kid1", d, "narration/dylan-v3/en/p1.mp3");
    await fetchBookAsset("kid2", d, "narration/dylan-v3/en/p1.mp3");
    await purgeBookAssets("kid1");
    expect([...backend.recs.values()].map((r) => r.childId)).toEqual(["kid2"]);
    await purgeBookAssets();
    expect(backend.recs.size).toBe(0);
  });
});
