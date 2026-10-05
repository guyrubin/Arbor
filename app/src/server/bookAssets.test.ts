/**
 * B-BOOK release — a child's private book files: the path rule, the
 * owner-checked proxy, the erase sweep (counted), and their registration in
 * export / erase (CHILD_SUBCOLLECTIONS, /privacy/erase, account deletion).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import type { AddressInfo } from "node:net";
import express, { type RequestHandler } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./logger.js", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }, requestIdOf: () => "test" }));

import { createBookAssetsRouter, eraseChildBookAssets, type BookAssetBucket, type BookAssetFile } from "./bookAssets";
import { bookAssetObject, bookAssetUrl, childBookAssetPrefix, isBookAssetRel } from "../lib/library/bookAssetPaths";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(path.join(here, "..", rel), "utf8");

function fakeBucket(objects: Record<string, string>) {
  const deleted: string[] = [];
  const fileOf = (name: string): BookAssetFile => ({
    name,
    exists: async () => [name in objects],
    createReadStream: () => Readable.from([Buffer.from(objects[name] ?? "")]),
    delete: async () => {
      deleted.push(name);
      delete objects[name];
    },
  });
  const bucket: BookAssetBucket = {
    file: fileOf,
    getFiles: async ({ prefix }) => [Object.keys(objects).filter((k) => k.startsWith(prefix)).map(fileOf)],
  };
  return { bucket, deleted };
}

describe("book asset paths", () => {
  it("allows exactly the hero sheet, print, choice, manifest and narration shapes", () => {
    for (const ok of [
      "hero-sheets/dylan-v2/look-up.webp",
      "hero-sheets/dylan-v2/prints/cover.webp",
      "hero-sheets/dylan-v2/choices/a.webp",
      "hero-sheets/dylan-v2/manifest.json",
      "narration/dylan-v3/en/p1.mp3",
      "narration/dylan-v3/he-f/p10.a.mp3",
      "narration/dylan-v3/he-m/p5-choice.c.mp3",
      "narration/dylan-v3/en/p9.cues.json",
      "narration/dylan-v2-expressive/en/p2b.wav",
      "manifest.json",
    ]) expect(isBookAssetRel(ok), ok).toBe(true);
    for (const bad of [
      "../x.webp",
      "hero-sheets/../../users/u/x.webp",
      "hero-sheets/dylan-v2/look-up.png",
      "narration/dylan-v3/fr/p1.mp3",
      "narration/dylan-v3/en/p1.mp3?x",
      "hero-sheets//look-up.webp",
      "/hero-sheets/dylan-v2/look-up.webp",
      "photos/1.jpg",
      "",
    ]) expect(isBookAssetRel(bad), bad).toBe(false);
    expect(bookAssetObject("kid1", "five-smooth-stones", "narration/dylan-v3/en/p1.mp3")).toBe("children/kid1/books/five-smooth-stones/narration/dylan-v3/en/p1.mp3");
    expect(() => childBookAssetPrefix("../x")).toThrow();
    expect(bookAssetUrl("kid1", "five-smooth-stones", "hero-sheets/s/prints/cover.webp")).toBe("/api/children/kid1/book-assets/five-smooth-stones/file?path=hero-sheets%2Fs%2Fprints%2Fcover.webp");
  });
});

describe("the owner-checked proxy", () => {
  const objects: Record<string, string> = {
    "children/kid1/books/five-smooth-stones/hero-sheets/dylan-v2/look-up.webp": "WEBP",
    "children/kid1/books/five-smooth-stones/narration/dylan-v3/en/p1.mp3": "MP3",
  };
  const { bucket } = fakeBucket(objects);
  const ownership: RequestHandler = (req, res, next) => (req.params.childId === "kid1" && (req as { user?: { uid?: string } }).user?.uid === "owner" ? next() : res.status(403).json({ error: "no" }));
  let base = "";
  let server: ReturnType<express.Express["listen"]>;
  beforeAll(async () => {
    const app = express();
    app.use((req, _res, next) => {
      const who = req.header("x-test-user");
      if (who) (req as { user?: { uid: string } }).user = { uid: who };
      next();
    });
    app.use("/api", createBookAssetsRouter({ getBucket: async () => bucket, requireOwnership: ownership }));
    await new Promise<void>((r) => {
      server = app.listen(0, () => r());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  const get = (url: string, user?: string) => fetch(base + url, { headers: user ? { "x-test-user": user } : {} });

  it("serves the owner's file with its type and a private cache header", async () => {
    const res = await get(bookAssetUrl("kid1", "five-smooth-stones", "hero-sheets/dylan-v2/look-up.webp"), "owner");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(await res.text()).toBe("WEBP");
    const mp3 = await get(bookAssetUrl("kid1", "five-smooth-stones", "narration/dylan-v3/en/p1.mp3"), "owner");
    expect(mp3.headers.get("content-type")).toBe("audio/mpeg");
  });

  it("fails closed: no verified caller 401, another family 403, a bad path 400, a missing file 404", async () => {
    expect((await get(bookAssetUrl("kid1", "five-smooth-stones", "hero-sheets/dylan-v2/look-up.webp"))).status).toBe(401);
    expect((await get(bookAssetUrl("kid1", "five-smooth-stones", "hero-sheets/dylan-v2/look-up.webp"), "local-sandbox")).status).toBe(401);
    expect((await get(bookAssetUrl("kid1", "five-smooth-stones", "hero-sheets/dylan-v2/look-up.webp"), "stranger")).status).toBe(403);
    expect((await get("/api/children/kid1/book-assets/five-smooth-stones/file?path=..%2F..%2Fusers%2Fx", "owner")).status).toBe(400);
    expect((await get(bookAssetUrl("kid1", "five-smooth-stones", "hero-sheets/dylan-v2/sit.webp"), "owner")).status).toBe(404);
  });
});

describe("erase: the sweep counts the files, and both erase paths run it", () => {
  it("removes every file under children/<childId>/books/ and only those", async () => {
    const { bucket, deleted } = fakeBucket({
      "children/kid1/books/b/hero-sheets/s/a.webp": "",
      "children/kid1/books/b/narration/v/en/p1.mp3": "",
      "children/kid10/books/b/hero-sheets/s/a.webp": "",
      "users/u/children/kid1/photos/1.jpg": "",
    });
    expect(await eraseChildBookAssets(bucket, "kid1")).toBe(2);
    expect(deleted.sort()).toEqual(["children/kid1/books/b/hero-sheets/s/a.webp", "children/kid1/books/b/narration/v/en/p1.mp3"]);
    expect(await eraseChildBookAssets(null, "kid1")).toBe(0);
    expect(await eraseChildBookAssets(bucket, "../x")).toBe(0);
  });

  it("is wired into /privacy/erase (counted into storageFiles), the account deletion, and CHILD_SUBCOLLECTIONS", () => {
    const api = src("routes/api.ts");
    const erase = api.slice(api.indexOf('router.post("/privacy/erase"'), api.indexOf('router.post("/privacy/erase"') + 4000);
    expect(erase).toContain("eraseChildBookAssets(");
    expect(erase).toMatch(/storageFiles = photoFiles\.length \+ bookFiles/);
    expect(api).toContain("createBookAssetsRouter(");
    expect(src("server/accountDeletion.ts")).toContain("eraseChildBookAssets(");
    expect(src("lib/childData.ts")).toMatch(/"bookAssets",/);
  });
});
