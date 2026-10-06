/**
 * B-BOOK release — the production door's data side: which library books a
 * child may see (a COMPLETE private hero sheet only), and how the private
 * files are read (owner-checked proxy, bearer token, device cache, blob URLs,
 * purged with the child).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({ authHeaders: async () => ({ "Content-Type": "application/json", Authorization: "Bearer T" }) }));

import { fetchBookAsset, purgeBookAssets, setBookAssetBackend, type BookAssetBackend, type CachedFile } from "./bookAssetStore";
import { libraryBookEntries, resolveBookAssets } from "./bookAssets";
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
      calls.push({ url, auth: new Headers(init.headers).get("authorization") });
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
    expect(Object.keys(r.narration.files).sort()).toEqual(["en/p1.mp3", "en/p9.mp3"]);
    expect(r.narration.cues).toEqual({ "en/p9": { flight: 6200, boom: 8100 } });
    expect(calls.some((c) => c.url.includes("he-m"))).toBe(false);
    r.revoke();
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
