import express, { type RequestHandler } from "express";
import { Readable, Writable } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { inventoryChildBookAssets } from "./bookAssetExport";
import { createBookAssetsRouter, eraseChildBookAssets, type BookAssetBucket, type BookAssetFile } from "./bookAssets";
import { LocalFsBookAssetBucket } from "./localBookAssetBucket";
import { BOOK_EXPORT_CONCURRENT_READS, BOOK_EXPORT_DIGEST_HEADER, BOOK_EXPORT_LIMITS } from "../lib/library/bookAssetExportContract";
import { createHash } from "node:crypto";
import { bookAssetUrl } from "../lib/library/bookAssetPaths";

vi.mock("./logger.js", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }, requestIdOf: () => "synthetic" }));
import { logger } from "./logger.js";
// Dispatch real router handlers in memory: no listener, socket or external data.
const limiters = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock("./apiRateLimits.js", () => ({
  bookAssetLimiter: (...args: unknown[]) => { limiters.calls.push(args); return (_req: unknown, _res: unknown, next: () => void) => next(); },
  bookAssetRates: () => ({ reads: 600, writes: 120 }),
}));

const prefix = "children/synthetic-child/books/";
const asset = "synthetic-book/hero-sheets/synthetic/stand.png";
function fakeBucket(objects: Record<string, Buffer>, opts: { unknownSize?: boolean; failStream?: boolean; contentType?: string } = {}) {
  const reads: string[] = [];
  const lists: unknown[] = [];
  const deleted: string[] = [];
  const fileOf = (name: string): BookAssetFile => ({
    name, metadata: opts.unknownSize ? {} : { size: objects[name]?.byteLength, contentType: opts.contentType ?? "image/png" },
    exists: async () => [name in objects],
    createReadStream: () => {
      reads.push(name);
      if (opts.failStream) {
        let sent = false;
        return new Readable({ read() {
          if (sent) return;
          sent = true; this.push(Buffer.from("FIRST"));
          setImmediate(() => this.destroy(new Error("synthetic-private-object-name")));
        } });
      }
      return Readable.from([objects[name]]);
    },
    delete: async () => { deleted.push(name); delete objects[name]; },
  });
  const bucket: BookAssetBucket = {
    file: fileOf,
    // GCS-shaped paging: a page of `maxResults`, then a next query carrying a pageToken.
    getFiles: async (options) => {
      lists.push(options);
      const files = Object.keys(objects).filter((k) => k.startsWith(options.prefix)).map(fileOf);
      const from = Number(options.pageToken ?? 0);
      const limit = options.autoPaginate === false ? options.maxResults ?? files.length : files.length;
      const page = files.slice(from, from + limit);
      return from + limit < files.length ? [page, { ...options, pageToken: String(from + limit) }] : [page];
    },
  };
  return { bucket, reads, lists, deleted };
}

describe("B-BOOK-20 server inventory is bounded and scoped", () => {
  it("lists every allowed private file including orphaned bytes, excludes a sibling and flags unknown paths", async () => {
    const f = fakeBucket({
      [prefix + asset]: Buffer.from([0, 128, 255]),
      [prefix + "old-book/narration/old/en/p1.mp3"]: Buffer.from("NAME"),
      [prefix + "old-book/unknown-folder/private.txt"]: Buffer.from("NO"),
      ["children/synthetic-child2/books/" + asset]: Buffer.from("SIBLING"),
    });
    const inventory = await inventoryChildBookAssets(f.bucket, "synthetic-child");
    expect(inventory.status).toBe("incomplete");
    expect(inventory.issues).toEqual(["unsupported_path"]);
    expect(inventory.files).toEqual([
      { bookId: "old-book", path: "narration/old/en/p1.mp3", bytes: 4 },
      { bookId: "synthetic-book", path: "hero-sheets/synthetic/stand.png", bytes: 3 },
    ]);
    expect(f.reads).toEqual([]);
    expect(f.lists).toEqual([{ prefix, autoPaginate: false, maxResults: BOOK_EXPORT_LIMITS.inventoryPage }]);
    expect(JSON.stringify(inventory)).not.toMatch(/private.txt|SIBLING|synthetic-child2/);
  });

  it("never trusts a bucket that returns another prefix or a traversal path", async () => {
    const names = ["children/sibling/books/" + asset, prefix + "../secrets", prefix + "b/hero-sheets/../../secret.png"];
    const bucket = { getFiles: async () => [names.map((name) => ({ name, metadata: { size: 1 } }))] } as unknown as BookAssetBucket;
    const out = await inventoryChildBookAssets(bucket, "synthetic-child");
    expect(out.files).toEqual([]);
    expect(out.status).toBe("incomplete");
    expect(out.issues).toEqual(["unsupported_path"]);
    await expect(inventoryChildBookAssets(bucket, "../sibling")).rejects.toThrow("bad child id");
  });

  it("has explicit overflow, missing-bucket and unknown-size receipts, without reading bytes", async () => {
    const objects = Object.fromEntries(Array.from({ length: BOOK_EXPORT_LIMITS.files + 1 }, (_, i) => [prefix + `b/hero-sheets/s/p${i}.png`, Buffer.from("D")]));
    const f = fakeBucket(objects);
    const out = await inventoryChildBookAssets(f.bucket, "synthetic-child");
    expect(out.status).toBe("incomplete");
    expect(out.issues).toContain("inventory_limit");
    expect(out.files).toHaveLength(BOOK_EXPORT_LIMITS.files);
    expect(f.reads).toEqual([]);
    expect((await inventoryChildBookAssets(null, "synthetic-child")).issues).toEqual(["storage_unavailable"]);
    const unknown = await inventoryChildBookAssets(fakeBucket({ [prefix + asset]: Buffer.from("D") }, { unknownSize: true }).bucket, "synthetic-child");
    expect(unknown.status).toBe("incomplete");
    expect(unknown.files[0].bytes).toBeNull();
    expect(unknown.issues).toContain("unknown_size");
  });

  it("B-CAREPRO-50: pages the whole prefix, so a ten-book library is listed in full (no inventory_limit)", async () => {
    const objects = Object.fromEntries(Array.from({ length: 1500 }, (_, i) => [prefix + `b${i % 10}/hero-sheets/s/p${i}.png`, Buffer.from("D")]));
    const f = fakeBucket(objects);
    const out = await inventoryChildBookAssets(f.bucket, "synthetic-child");
    expect(out.status).toBe("complete");
    expect(out.issues).toEqual([]);
    expect(out.files).toHaveLength(1500);
    expect(f.lists).toHaveLength(2);
    // a continuation that names no page token cannot be followed: fail closed
    const stuck = { getFiles: async () => [[{ name: prefix + asset, metadata: { size: 1 } }], { nextPageToken: "x" }] } as unknown as BookAssetBucket;
    expect((await inventoryChildBookAssets(stuck, "synthetic-child")).issues).toContain("inventory_limit");
  });

  it("keeps local fixture listing bounded without narrowing the exact existing erase sweep", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "arbor-portability-synthetic-"));
    try {
      const bucket = new LocalFsBookAssetBucket(root);
      for (const name of [prefix + asset, prefix + "b/manifest.json", "children/sibling/books/" + asset]) await bucket.file(name).save!(Buffer.from("SYNTHETIC"), { contentType: "application/octet-stream" });
      const [files, next] = await bucket.getFiles({ prefix, autoPaginate: false, maxResults: 1 });
      expect(files).toHaveLength(1);
      expect(next).toBeTruthy();
      expect(await eraseChildBookAssets(bucket, "synthetic-child")).toBe(2);
      expect((await bucket.getFiles({ prefix: "children/" }))[0].map((f) => f.name)).toEqual(["children/sibling/books/" + asset]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

describe("authenticated export proxy (in-memory synthetic fixture)", () => {
  let router: express.Router;
  let bucket: BookAssetBucket | null;
  const ownership: RequestHandler = (req, res, next) => {
    const owner = (req as { user?: { uid: string } }).user?.uid;
    if (owner === "owner" && req.params.childId === "synthetic-child") next();
    else res.status(403).json({ error: "Forbidden" });
  };
  beforeAll(() => {
    router = createBookAssetsRouter({ getBucket: async () => bucket, requireOwnership: ownership, allowLocal: true, readsPerMin: 1000 });
  });
  const manifest = "/api/children/synthetic-child/book-assets/export-manifest";
  const url = bookAssetUrl("synthetic-child", "synthetic-book", "hero-sheets/synthetic/stand.png") + "&export=1";
  const get = (path: string, user?: string): Promise<Response> => new Promise((resolve, reject) => {
    const chunks: Buffer[] = [], headers = new Headers();
    let completed = false;
    const response = new Writable({ write(chunk, _encoding, next) { chunks.push(Buffer.from(chunk)); next(); } });
    const res = Object.assign(response, {
      statusCode: 200, headersSent: false,
      setHeader(name: string, value: string) { headers.set(name, value); return res; },
      status(code: number) { res.statusCode = code; return res; },
      json(value: unknown) { headers.set("content-type", "application/json"); res.end(JSON.stringify(value)); return res; },
    });
    response.on("pipe", () => { res.headersSent = true; });
    response.on("finish", () => {
      completed = true;
      resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers }));
    });
    response.on("error", reject);
    response.on("close", () => { if (!completed) reject(new Error("synthetic stream interrupted")); });
    const requestUrl = new URL(path, "http://synthetic.invalid");
    const req = { method: "GET", url: requestUrl.pathname.replace(/^\/api/, "") + requestUrl.search,
      query: Object.fromEntries(requestUrl.searchParams), ...(user ? { user: { uid: user } } : {}) };
    // Router is middleware; Express only supplies these request/response fields
    // for this route. Any unexpected route escape fails the test.
    (router as unknown as RequestHandler)(req as express.Request, res as unknown as express.Response, (error?: unknown) => {
      reject(error ?? new Error("unexpected route escape"));
    });
  });

  it("requires verified ownership for both inventory and bytes even in local-sandbox mode", async () => {
    const f = fakeBucket({ [prefix + asset]: Buffer.from("DATA") });
    bucket = f.bucket;
    for (const endpoint of [manifest, url]) {
      expect((await get(endpoint)).status).toBe(401);
      expect((await get(endpoint, "local-sandbox")).status).toBe(401);
      expect((await get(endpoint, "stranger")).status).toBe(403);
      expect((await get(endpoint.replace("synthetic-child", "sibling"), "owner")).status).toBe(403);
    }
    expect(f.lists).toEqual([]);
    expect(f.reads).toEqual([]);
    const inventory = await get(manifest, "owner");
    expect(inventory.status).toBe(200);
    expect(inventory.headers.get("cache-control")).toBe("private, no-store");
    expect((await inventory.json()).files[0].bytes).toBe(4);
    const bytes = await get(url, "owner");
    expect(bytes.headers.get("cache-control")).toBe("private, no-store");
    // B-CAREPRO-50: the export read carries the server's digest, type and length.
    expect(bytes.headers.get(BOOK_EXPORT_DIGEST_HEADER)).toBe(createHash("sha256").update("DATA").digest("hex"));
    expect(bytes.headers.get("content-type")).toBe("image/png");
    expect(bytes.headers.get("content-length")).toBe("4");
    expect(await bytes.text()).toBe("DATA");
  });

  it("critic r1: an export read is typed by the stored media type, never by its path", async () => {
    bucket = fakeBucket({ [prefix + asset]: Buffer.from("DATA") }, { contentType: "audio/mpeg; codecs=mp3" }).bucket;
    expect((await get(url, "owner")).headers.get("content-type")).toBe("audio/mpeg");
    const untyped = fakeBucket({ [prefix + asset]: Buffer.from("DATA") }, { contentType: "" });
    bucket = untyped.bucket;
    expect((await get(url, "owner")).headers.get("content-type")).toBe("application/octet-stream");
  });

  it("critic r1: export=1 keeps the reader's per-minute rate (its own budget, never a higher one)", () => {
    limiters.calls.length = 0;
    createBookAssetsRouter({ getBucket: async () => null, requireOwnership: ownership });
    expect(limiters.calls).toEqual([["read", undefined], ["read", 600]]);
    limiters.calls.length = 0;
    createBookAssetsRouter({ getBucket: async () => null, requireOwnership: ownership, readsPerMin: 1000 });
    expect(limiters.calls[1]).toEqual(["read", 1000]);
  });

  it("critic r1: at most BOOK_EXPORT_CONCURRENT_READS export reads per account are in flight; the next is told to retry", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const objects = { [prefix + asset]: Buffer.from("DATA") };
    const f = fakeBucket(objects);
    const slowFile = (name: string): BookAssetFile => ({ ...f.bucket.file(name), exists: async () => { await gate; return [true]; } });
    bucket = { ...f.bucket, file: slowFile };
    const held = Array.from({ length: BOOK_EXPORT_CONCURRENT_READS }, () => get(url, "owner"));
    await new Promise((r) => setImmediate(r));
    const extra = await get(url, "owner");
    expect(extra.status).toBe(429);
    expect(extra.headers.get("retry-after")).toBe("1");
    release();
    for (const r of await Promise.all(held)) expect(r.status).toBe(200);
    expect((await get(url, "owner")).status).toBe(200); // slots come back
  });

  it("B-CAREPRO-50: an export read over the per-file cap is refused (413), never streamed", async () => {
    const f = fakeBucket({ [prefix + asset]: Buffer.alloc(BOOK_EXPORT_LIMITS.fileBytes + 1) });
    bucket = f.bucket;
    const res = await get(url, "owner");
    expect(res.status).toBe(413);
    expect(res.headers.get(BOOK_EXPORT_DIGEST_HEADER)).toBeNull();
  });

  it("rejects traversal/unknown shapes and reports missing known-shape files without disclosure", async () => {
    bucket = fakeBucket({}).bucket;
    expect((await get(bookAssetUrl("synthetic-child", "b", "../secret") + "&export=1", "owner")).status).toBe(400);
    expect((await get(bookAssetUrl("synthetic-child", "b", "unknown/x.png") + "&export=1", "owner")).status).toBe(400);
    expect((await get(url, "owner")).status).toBe(404);
  });

  it("returns a generic inventory failure and never logs private storage errors", async () => {
    bucket = { getFiles: async () => { throw new Error("private-child-name or token"); } } as unknown as BookAssetBucket;
    const res = await get(manifest, "owner");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Book file inventory unavailable" });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("terminates a partial export stream as failed instead of cleanly ending a successful 200", async () => {
    bucket = fakeBucket({ [prefix + asset]: Buffer.from("DATA") }, { failStream: true }).bucket;
    await expect((async () => { const res = await get(url, "owner"); return res.arrayBuffer(); })()).rejects.toThrow();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
