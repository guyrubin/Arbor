/**
 * K2 block 4a — the book sheet's write path: PUT one WebP per pose / choice of
 * the child's CURRENT hero, then commit the BookAssetsDoc the reader reads.
 * Every refusal is pinned, and the sandbox's local folder runs the same path.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import type { AddressInfo } from "node:net";
import express, { type RequestHandler } from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./logger.js", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }, requestIdOf: () => "test" }));

import { createBookSheetRouter, LocalBookAssetsDocStore, isWebp, webpSize, type BookAssetsDocStore } from "./bookSheet";
import { createBookAssetsRouter, type BookAssetBucket, type BookAssetFile } from "./bookAssets";
import { LocalFsBookAssetBucket, localBookAssetBucket } from "./localBookAssetBucket";
import type { HeroPoseSource, StoredHero } from "./heroPoseRoute";
import type { EntitlementStore, Plan } from "./entitlements";
import { heroAvatarHash } from "../lib/heroSheetContract";
import { bookSheetDrawPoses } from "../lib/library/bookSheet";
import { missingBookPoses } from "../lib/library/bookPoses";
import { fiveSmoothStones as book } from "../lib/library/books/fiveSmoothStones";

const HERO = "data:image/png;base64,SEVSTw==";
const HASH = heroAvatarHash(HERO);
const OTHER = "0123456789abcdef";
const BOOK = "five-smooth-stones";

/** A minimal VP8X WebP of w x h (header only, padded to `bytes`). */
function webp(w: number, h: number, bytes = 64): Buffer {
  const b = Buffer.alloc(Math.max(bytes, 30));
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WEBP", 8, "latin1");
  b.write("VP8X", 12, "latin1");
  b.writeUInt32LE(10, 16);
  b[20] = 0x10;
  b.writeUIntLE(w - 1, 24, 3);
  b.writeUIntLE(h - 1, 27, 3);
  return b;
}

function memBucket() {
  const objects = new Map<string, { data: Buffer; metadata: Record<string, string> }>();
  const fileOf = (name: string): BookAssetFile => ({
    name,
    get metadata() {
      const o = objects.get(name);
      return o ? { size: String(o.data.length), metadata: o.metadata } : undefined;
    },
    exists: async () => [objects.has(name)],
    createReadStream: () => Readable.from([objects.get(name)?.data ?? Buffer.alloc(0)]),
    delete: async () => void objects.delete(name),
    save: async (data, opts) => void objects.set(name, { data, metadata: opts.metadata?.metadata ?? {} }),
  });
  const bucket: BookAssetBucket = { file: fileOf, getFiles: async ({ prefix }) => [[...objects.keys()].filter((k) => k.startsWith(prefix)).map(fileOf)] };
  return { bucket, objects };
}

const plans = (p: Record<string, Plan>): EntitlementStore => ({ async getPlan(uid) { return p[uid] ?? null; }, async getRecord(uid) { return p[uid] ? { plan: p[uid], status: "active" } : null; } });
const ownership: RequestHandler = (req, res, next) => {
  const uid = (req as { user?: { uid?: string } }).user?.uid;
  return req.params.childId === "kid1" && (uid === "owner" || uid === "free" || uid === undefined || uid === "local-sandbox") ? next() : res.status(403).json({ error: "no" });
};

function serve(opts: { hero?: StoredHero | null; local?: boolean; bucket?: BookAssetBucket; docs?: BookAssetsDocStore }) {
  const hero = opts.hero === undefined ? { photoUrl: HERO, source: "descriptor", anchor: null } : opts.hero;
  const heroSource: HeroPoseSource = { strictHash: !opts.local, async load() { return hero; } };
  const docs = opts.docs ?? new LocalBookAssetsDocStore();
  const mem = memBucket();
  const bucket = opts.bucket ?? mem.bucket;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const who = req.header("x-test-user");
    if (who) (req as { user?: { uid: string } }).user = { uid: who };
    next();
  });
  app.use("/api", createBookSheetRouter({ getBucket: async () => bucket, requireOwnership: ownership, heroSource, entitlements: plans({ owner: "plus", free: "free" }), docs, local: opts.local, now: () => "2026-10-09T12:00:00.000Z" }));
  app.use("/api", createBookAssetsRouter({ getBucket: async () => bucket, requireOwnership: ownership, allowLocal: opts.local }));
  let server: ReturnType<express.Express["listen"]>;
  let base = "";
  return {
    objects: mem.objects,
    docs,
    start: () => new Promise<void>((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; r(); }); }),
    stop: () => new Promise<void>((r) => server.close(() => r())),
    put: (rel: string, body: Buffer, q: Record<string, string | number> = {}, user: string | null = "owner", type = "image/webp") =>
      fetch(`${base}/api/children/kid1/book-assets/${BOOK}/file?${new URLSearchParams({ path: rel, ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)])) })}`, {
        method: "PUT",
        headers: { "content-type": type, ...(user ? { "x-test-user": user } : {}) },
        body,
      }),
    commit: (body: unknown, user: string | null = "owner", child = "kid1") =>
      fetch(`${base}/api/children/${child}/book-assets/${BOOK}/commit`, { method: "POST", headers: { "content-type": "application/json", ...(user ? { "x-test-user": user } : {}) }, body: JSON.stringify(body) }),
    get: (url: string, user: string | null = "owner") => fetch(base + url, { headers: user ? { "x-test-user": user } : {} }),
  };
}

const ANCHOR = { aspect: 0.5, footX: 0.5, footW: 0.4 };
const poseRel = (pose: string, hash = HASH) => `hero-sheets/h-${hash}/${pose}.webp`;

beforeEach(() => { process.env.ENFORCE_ENTITLEMENTS = "true"; });
afterEach(() => { delete process.env.ENFORCE_ENTITLEMENTS; });

describe("WebP checks", () => {
  it("reads the magic bytes and the canvas size", () => {
    expect(isWebp(webp(200, 400))).toBe(true);
    expect(webpSize(webp(200, 400))).toEqual({ w: 200, h: 400 });
    expect(isWebp(Buffer.from("\x89PNG\r\n\x1a\n" + "0".repeat(40), "latin1"))).toBe(false);
  });
});

describe("K2 4a: PUT a book sheet file", () => {
  const s = serve({});
  beforeAll(s.start);
  afterAll(s.stop);

  it("stores a pose of the current hero with its anchors", async () => {
    const r = await s.put(poseRel("look-up"), webp(200, 400), ANCHOR);
    expect(r.status).toBe(200);
    const o = s.objects.get(`children/kid1/books/${BOOK}/${poseRel("look-up")}`);
    expect(o?.metadata).toEqual({ aspect: "0.5", footX: "0.5", footW: "0.4" });
    // the parent's one Redraw is marked on the file (the commit carries it into the manifest)
    expect((await s.put(poseRel("sit"), webp(200, 400), { ...ANCHOR, redrawn: 1 })).status).toBe(200);
    expect(s.objects.get(`children/kid1/books/${BOOK}/${poseRel("sit")}`)?.metadata.redrawn).toBe("1");
    // a choice card needs no anchors
    expect((await s.put(`hero-sheets/h-${HASH}/choices/a.webp`, webp(800, 600))).status).toBe(200);
  });

  it("refuses every other caller, shape, hero, format and size", async () => {
    const code = async (r: Response) => [r.status, ((await r.json()) as { code?: string }).code];
    expect((await s.put(poseRel("look-up"), webp(200, 400), ANCHOR, null)).status).toBe(401);
    expect((await s.put(poseRel("look-up"), webp(200, 400), ANCHOR, "local-sandbox")).status).toBe(401);
    expect(await code(await s.put(poseRel("look-up"), webp(200, 400), ANCHOR, "free"))).toEqual([403, "hero_sheet_plan"]);
    for (const bad of [
      `narration/n-${HASH}/en/p1.mp3`,
      "manifest.json",
      `hero-sheets/dylan-v2/look-up.webp`,
      `hero-sheets/h-${HASH}/manifest.json`,
      `hero-sheets/h-${HASH}/prints/cover.webp`,
      `hero-sheets/h-${HASH}/kneel.webp`,
      `hero-sheets/h-${HASH}/idle.webp`,
      `hero-sheets/h-${HASH}/choices/d.webp`,
      `hero-sheets/h-${HASH}/../x.webp`,
    ]) expect(await code(await s.put(bad, webp(200, 400), ANCHOR)), bad).toEqual([400, "book_sheet_bad_path"]);
    expect(await code(await s.put(poseRel("look-up", OTHER), webp(200, 400), ANCHOR))).toEqual([409, "hero_changed"]);
    expect(await code(await s.put(poseRel("look-up"), Buffer.from("\x89PNG\r\n\x1a\n" + "0".repeat(60), "latin1"), ANCHOR))).toEqual([415, "book_sheet_not_webp"]);
    expect(await code(await s.put(poseRel("look-up"), webp(200, 400), ANCHOR, "owner", "image/png"))).toEqual([415, "book_sheet_not_webp"]);
    expect(await code(await s.put(poseRel("look-up"), webp(200, 400, 300 * 1024 + 1), ANCHOR))).toEqual([413, "book_sheet_too_large"]);
    expect(await code(await s.put(poseRel("look-up"), webp(200, 400), {}))).toEqual([400, "book_sheet_bad_anchor"]);
    expect(await code(await s.put(poseRel("look-up"), webp(200, 400), { ...ANCHOR, aspect: 0.8 }))).toEqual([400, "book_sheet_bad_anchor"]);
    expect(await code(await s.put(poseRel("look-up"), webp(200, 400), { ...ANCHOR, footX: 1.5 }))).toEqual([400, "book_sheet_bad_anchor"]);
  });

  it("refuses a missing hero and a photo-styled hero", async () => {
    const none = serve({ hero: null });
    await none.start();
    expect((await (await none.put(poseRel("look-up"), webp(200, 400), ANCHOR)).json()).code).toBe("hero_missing");
    await none.stop();
    const photo = serve({ hero: { photoUrl: HERO, source: "photo", anchor: null } });
    await photo.start();
    expect((await (await photo.put(poseRel("look-up"), webp(200, 400), ANCHOR)).json()).code).toBe("hero_photo_source");
    await photo.stop();
  });
});

describe("K2 4a: commit", () => {
  const draw = bookSheetDrawPoses(book);

  it("the builder draws 17 poses (worried-tunic is a costume-only pose)", () => {
    expect(draw).toHaveLength(17);
    expect(draw).not.toContain("worried-tunic");
  });

  it("dryRun reports what is missing; an incomplete sheet is refused; a complete one becomes the doc the reader reads", async () => {
    const s = serve({});
    await s.start();
    // an older hero's sheet is in the folder
    s.objects.set(`children/kid1/books/${BOOK}/${poseRel("look-up", OTHER)}`, { data: webp(10, 20), metadata: {} });
    const probe = await (await s.commit({ avatarHash: HASH, dryRun: true })).json();
    expect(probe.complete).toBe(false);
    expect(probe.missing.length).toBeGreaterThan(0);
    for (const pose of draw.slice(0, 5)) await s.put(poseRel(pose), webp(200, 400), ANCHOR);
    const half = await s.commit({ avatarHash: HASH });
    expect(half.status).toBe(409);
    expect((await half.json()).code).toBe("book_sheet_incomplete");
    expect(await s.docs.read("owner", "kid1", BOOK)).toBeNull();
    for (const pose of draw.slice(5)) await s.put(poseRel(pose), webp(200, 400), ANCHOR);
    await s.put(`hero-sheets/h-${HASH}/choices/b.webp`, webp(800, 600));
    await s.put(poseRel("sit"), webp(200, 400), { ...ANCHOR, redrawn: 1 });
    expect(await (await s.commit({ avatarHash: HASH, dryRun: true })).json()).toMatchObject({ complete: true, missing: [], committed: false, admin: false });
    const r = await s.commit({ avatarHash: HASH });
    expect(r.status).toBe(200);
    const out = await r.json();
    expect(out.removed).toBe(1);
    expect(out.local).toBeUndefined();
    expect((await (await s.commit({ avatarHash: HASH, dryRun: true })).json()).committed).toBe(true);
    const doc = await s.docs.read("owner", "kid1", BOOK);
    expect(doc).toMatchObject({ id: BOOK, bookId: BOOK, sheetId: `h-${HASH}`, setId: "none", createdAt: "2026-10-09T12:00:00.000Z" });
    expect(Object.keys(doc!.sheetManifest.poses).sort()).toEqual(draw);
    expect(doc!.sheetManifest.poses["look-up"]).toEqual({ file: "look-up.webp", ...ANCHOR });
    expect(doc!.sheetManifest.poses["look-up"].redrawn).toBeUndefined();
    expect(doc!.sheetManifest.poses.sit).toEqual({ file: "sit.webp", ...ANCHOR, redrawn: true });
    expect(doc!.sheetManifest.choices).toEqual({ b: "choices/b.webp" });
    expect(doc!.files).toContain(`hero-sheets/h-${HASH}/choices/b.webp`);
    // the older hero's folder is gone; the reader would open the book
    expect([...s.objects.keys()].some((k) => k.includes(OTHER))).toBe(false);
    expect(missingBookPoses(book, Object.keys(doc!.sheetManifest.poses))).toEqual([]);
    // the proxy serves the committed file to the owner
    expect((await s.get(`/api/children/kid1/book-assets/${BOOK}/file?path=${encodeURIComponent(poseRel("look-up"))}`)).status).toBe(200);
    await s.stop();
  });

  it("refuses: no caller, Free, another hero, a bad hash, and never replaces an admin-uploaded sheet", async () => {
    const docs = new LocalBookAssetsDocStore();
    await docs.write("owner", "kid1", { id: BOOK, bookId: BOOK, sheetId: "dylan-v2", setId: "dylan-v3", sheetManifest: { poses: {} }, files: [], bytes: 0, createdAt: "x" });
    const s = serve({ docs });
    await s.start();
    for (const pose of draw) await s.put(poseRel(pose), webp(200, 400), ANCHOR);
    expect((await s.commit({ avatarHash: HASH }, null)).status).toBe(401);
    expect((await (await s.commit({ avatarHash: HASH }, "free")).json()).code).toBe("hero_sheet_plan");
    expect((await s.commit({ avatarHash: HASH }, "stranger")).status).toBe(403);
    expect((await (await s.commit({ avatarHash: OTHER })).json()).code).toBe("hero_changed");
    expect((await s.commit({ avatarHash: "../x" })).status).toBe(400);
    expect((await (await s.commit({ avatarHash: HASH, dryRun: true })).json()).admin).toBe(true);
    const admin = await s.commit({ avatarHash: HASH });
    expect(admin.status).toBe(409);
    expect((await admin.json()).code).toBe("book_sheet_admin");
    expect((await docs.read("owner", "kid1", BOOK))!.sheetId).toBe("dylan-v2");
    await s.stop();
  });
});

describe("K2 4a: the sandbox runs the same path on a local folder", () => {
  let root = "";
  beforeAll(() => { root = mkdtempSync(path.join(os.tmpdir(), "book-assets-")); });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("the local caller writes, commits (the device keeps the doc) and reads back through the proxy", async () => {
    delete process.env.ENFORCE_ENTITLEMENTS; // the sandbox: unenforced = plus
    const bucket = new LocalFsBookAssetBucket(root);
    const s = serve({ local: true, bucket });
    await s.start();
    for (const pose of bookSheetDrawPoses(book)) expect((await s.put(poseRel(pose), webp(200, 400), ANCHOR, null)).status).toBe(200);
    const r = await s.commit({ avatarHash: HASH }, null);
    expect(r.status).toBe(200);
    const out = await r.json();
    expect(out.local).toBe(true);
    expect(out.doc.sheetManifest.poses.sit).toEqual({ file: "sit.webp", ...ANCHOR });
    const res = await s.get(`/api/children/kid1/book-assets/${BOOK}/file?path=${encodeURIComponent(poseRel("sit"))}`, null);
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString("latin1")).toBe("RIFF");
    // the listing never shows the metadata sidecars, and nothing escapes the root
    const [files] = await bucket.getFiles({ prefix: `children/kid1/books/${BOOK}/` });
    expect(files.every((f) => f.name.endsWith(".webp"))).toBe(true);
    expect(() => bucket.file("../../etc/passwd")).toThrow();
    await s.stop();
  });

  it("the sandbox folder is git-ignored (app/.data/) and used only without Firestore", () => {
    const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
    expect(localBookAssetBucket(app).root).toBe(path.join(app, ".data", "book-assets"));
    expect(readFileSync(path.join(app, ".gitignore"), "utf8")).toMatch(/^\.data\/$/m);
    const api = readFileSync(path.join(app, "src", "routes", "api.ts"), "utf8");
    expect(api).toContain('const localBooks = config.memoryAdapter !== "firestore";');
    expect(api).toMatch(/createBookAssetsRouter\(\{ getBucket: getBookBucket, requireOwnership, allowLocal: localBooks \}\)/);
  });
});
