/**
 * K2 block 4 — the sandbox dry run of the BOOK sheet, end to end without
 * spending and without Firebase: the real /hero-pose handler with
 * MODEL_PROVIDER=mock (book poses anchored on the idle this server drew) ->
 * the device builder (PNG decode, keyBookSprite, anchors) -> the real write
 * routes over the sandbox's local folder (PUT each file, commit) -> the doc the
 * device keeps -> the owner-checked proxy serving every file the doc lists.
 * Only the browser's WebP encoder and canvas are stand-ins here.
 */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { inflateSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import express, { type RequestHandler } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../../server/logger.js", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }, requestIdOf: () => "test" }));

import { MemoryCounterStore } from "../../../server/quotaStore";
import { createHeroPoseHandler, LocalHeroPoseSource } from "../../../server/heroPoseRoute";
import { createBookSheetRouter, LocalBookAssetsDocStore } from "../../../server/bookSheet";
import { createBookAssetsRouter } from "../../../server/bookAssets";
import { LocalFsBookAssetBucket } from "../../../server/localBookAssetBucket";
import { heroAvatarHash } from "../../../lib/heroSheetContract";
import { bookAssetUrl, type BookAssetsDoc } from "../../../lib/library/bookAssetPaths";
import { bookSheetDrawPoses } from "../../../lib/library/bookSheet";
import { missingBookPoses } from "../../../lib/library/bookPoses";
import { fiveSmoothStones as book } from "../../../lib/library/books/fiveSmoothStones";
import { bookSheetApi, buildBookSheet, keepLocalBookDoc, type BookBuilderDeps } from "./buildBookSheet";
import { choiceCardPlans } from "./choiceCards";
import type { RgbaImage } from "./heroKeyer";

const HERO = "data:image/png;base64,TU9DSyBIRVJP";
const HASH = heroAvatarHash(HERO);

function decodePng(dataUrl: string): RgbaImage {
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  let off = 8, w = 0, h = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("latin1", off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") { w = body.readUInt32BE(0); h = body.readUInt32BE(4); }
    if (type === "IDAT") idat.push(body);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) data.set(raw.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1)), y * w * 4);
  return { width: w, height: h, data };
}

/** The browser's WebP encoder stand-in: a VP8X header of the image's size. */
function fakeWebp(w: number, h: number): Blob {
  const b = Buffer.alloc(64);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(56, 4);
  b.write("WEBPVP8X", 8, "latin1");
  b.writeUInt32LE(10, 16);
  b.writeUIntLE(w - 1, 24, 3);
  b.writeUIntLE(h - 1, 27, 3);
  return new Blob([b], { type: "image/webp" });
}

describe("K2 block 4: sandbox dry run — route (mock) -> book builder -> local folder -> the doc the reader reads", () => {
  let root = "";
  let base = "";
  let server: ReturnType<express.Express["listen"]>;
  const source = new LocalHeroPoseSource();
  const generate = vi.fn(async () => { throw new Error("no model call in the dry run"); });
  beforeAll(async () => {
    delete process.env.ENFORCE_ENTITLEMENTS; // the sandbox: unenforced = plus
    root = mkdtempSync(path.join(os.tmpdir(), "book-sheet-dry-"));
    const bucket = new LocalFsBookAssetBucket(root);
    const entitlements = { async getPlan() { return null; }, async getRecord() { return null; } };
    const open: RequestHandler = (_req, _res, next) => next();
    const app = express();
    app.use(express.json());
    app.post("/api/hero-pose", createHeroPoseHandler({ source, counters: new MemoryCounterStore(), requireUid: false, mock: true, generate, entitlements, fail: (res, e) => { res.status(500).json({ error: String(e) }); } }));
    app.use("/api", createBookSheetRouter({ getBucket: async () => bucket, requireOwnership: open, heroSource: source, entitlements, docs: new LocalBookAssetsDocStore(), local: true }));
    app.use("/api", createBookAssetsRouter({ getBucket: async () => bucket, requireOwnership: open, allowLocal: true }));
    await new Promise<void>((r) => { server = app.listen(0, () => r()); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    rmSync(root, { recursive: true, force: true });
  });

  it("a described hero whose game idle exists gets Five Smooth Stones with the mock hero on every page, no model call", async () => {
    source.remember("local-sandbox", "kid1", { hero: { dataUrl: HERO, source: "descriptor" } });
    const api = bookSheetApi("kid1", book.id, base);
    // before the game's idle: the book poses are refused (nothing drawn, nothing committed)
    const early = await api.requestPose({ childId: "kid1", pose: "sit", avatarHash: HASH });
    expect(early).toMatchObject({ ok: false, code: "hero_book_anchor_missing" });
    // the game sheet's idle (the anchor the server remembers in the sandbox)
    expect((await api.requestPose({ childId: "kid1", pose: "idle", avatarHash: HASH })).ok).toBe(true);

    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const deps: BookBuilderDeps = {
      ...api,
      decode: async (u) => decodePng(u),
      encodeWebp: async (img) => fakeWebp(img.width, img.height),
      choiceCards: async (b, sprites) => Object.fromEntries(choiceCardPlans(b, new Map([...sprites].map(([p, s]) => [p, s.anchor]))).map((p) => [p.choiceId, fakeWebp(800, 600)])),
      keepLocalDoc: keepLocalBookDoc("kid1", storage),
      sleep: async () => {},
    };
    const r = await buildBookSheet({ childId: "kid1", avatarHash: HASH }, deps);
    expect(r).toMatchObject({ status: "complete", skipped: [], calls: 17 });
    expect(generate).not.toHaveBeenCalled();

    // the device kept the doc (the sandbox's useChildLibraryBooks reads it)
    const docs = JSON.parse(mem.get("arbor.bookAssets.kid1")!) as BookAssetsDoc[];
    expect(docs).toHaveLength(1);
    const doc = docs[0];
    expect(doc).toMatchObject({ bookId: book.id, sheetId: `h-${HASH}`, setId: "none" });
    expect(Object.keys(doc.sheetManifest.poses).sort()).toEqual(bookSheetDrawPoses(book));
    expect(missingBookPoses(book, Object.keys(doc.sheetManifest.poses))).toEqual([]);
    expect(doc.sheetManifest.choices).toEqual({ a: "choices/a.webp", b: "choices/b.webp", c: "choices/c.webp" });
    for (const v of Object.values(doc.sheetManifest.poses)) expect(v.aspect! > 0 && v.footX! > 0 && v.footX! < 1).toBe(true);
    // every listed file comes back through the owner-checked proxy
    for (const rel of doc.files) {
      const res = await fetch(base + bookAssetUrl("kid1", book.id, rel));
      expect(res.status, rel).toBe(200);
    }
    // a second run finds the book already showing this hero: nothing drawn
    const again = await buildBookSheet({ childId: "kid1", avatarHash: HASH }, deps);
    expect(again.status).toBe("already");
  }, 120_000);
});
