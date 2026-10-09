/**
 * K2 acceptance — a child's FIRST open of Five Smooth Stones: every private
 * file (17 sprites + 3 choice cards) fetched in one burst, through the real
 * per-IP /api limit and the book routes' per-account limit, alongside the
 * app's other /api calls in the same minute. Never a 429 on a book file, and
 * every page's hero resolves (the sandbox's first open lost p1's hero to 13
 * 429s from the shared per-IP limit).
 */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express, { type RequestHandler } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../server/logger.js", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }, requestIdOf: () => "test" }));

import { apiRateLimit } from "../../server/apiRateLimits";
import { createBookAssetsRouter } from "../../server/bookAssets";
import { createBookSheetRouter, LocalBookAssetsDocStore } from "../../server/bookSheet";
import { LocalFsBookAssetBucket } from "../../server/localBookAssetBucket";
import { fetchBookAssetResult, setBookAssetBackend } from "../../lib/bookAssetStore";
import { resolveBookAssets } from "../../lib/bookAssets";
import { heroSpriteUrl, resolvePose } from "../../lib/library/heroSheet";
import { bookSheetDrawPoses } from "../../lib/library/bookSheet";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";
import { fiveSmoothStones as book } from "../../lib/library/books/fiveSmoothStones";
import type { Page } from "../../lib/library/types";

const HASH = "0123456789abcdef";
const CHILD = "kid1";

function webp(w: number, h: number): Buffer {
  const b = Buffer.alloc(64);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(56, 4);
  b.write("WEBPVP8X", 8, "latin1");
  b.writeUInt32LE(10, 16);
  b.writeUIntLE(w - 1, 24, 3);
  b.writeUIntLE(h - 1, 27, 3);
  return b;
}

describe("K2 acceptance: a book's first open never meets a 429, and every page has its hero", () => {
  let root = "";
  let base = "";
  let server: ReturnType<express.Express["listen"]>;
  let doc: BookAssetsDoc;
  const statuses: number[] = [];
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    delete process.env.ENFORCE_ENTITLEMENTS; // the sandbox: unenforced = plus
    root = mkdtempSync(path.join(os.tmpdir(), "book-first-open-"));
    const bucket = new LocalFsBookAssetBucket(root);
    const open: RequestHandler = (_req, _res, next) => next();
    const app = express();
    app.use(express.json());
    app.use("/api", apiRateLimit()); // the real per-IP limit (30 a minute)
    app.get("/api/ping", (_req, res) => { res.json({ ok: true }); });
    app.use("/api", createBookAssetsRouter({ getBucket: async () => bucket, requireOwnership: open, allowLocal: true }));
    app.use("/api", createBookSheetRouter({ getBucket: async () => bucket, requireOwnership: open, heroSource: { strictHash: false, async load() { return null; } }, entitlements: { async getPlan() { return null; }, async getRecord() { return null; } }, docs: new LocalBookAssetsDocStore(), local: true }));
    await new Promise<void>((r) => { server = app.listen(0, () => r()); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    // the sheet as the builder leaves it: 17 poses + 3 cards, committed
    const put = (rel: string, q: Record<string, string> = {}) =>
      realFetch(`${base}/api/children/${CHILD}/book-assets/${book.id}/file?${new URLSearchParams({ path: rel, ...q })}`, { method: "PUT", headers: { "content-type": "image/webp" }, body: webp(200, 400) });
    for (const pose of bookSheetDrawPoses(book)) expect((await put(`hero-sheets/h-${HASH}/${pose}.webp`, { aspect: "0.5", footX: "0.5", footW: "0.4" })).status).toBe(200);
    for (const c of book.decision.choices) expect((await put(`hero-sheets/h-${HASH}/choices/${c.id}.webp`)).status).toBe(200);
    const commit = await realFetch(`${base}/api/children/${CHILD}/book-assets/${book.id}/commit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ avatarHash: HASH }) });
    expect(commit.status).toBe(200);
    doc = ((await commit.json()) as { doc: BookAssetsDoc }).doc;
    // the app's same-origin requests, counted
    setBookAssetBackend(null);
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const res = await realFetch(url.startsWith("/") ? base + url : url, init);
      if (url.includes("/book-assets/")) statuses.push(res.status);
      return res;
    });
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await new Promise<void>((r) => server.close(() => r()));
    rmSync(root, { recursive: true, force: true });
  });

  it("all private files in one burst, with the app's other calls in the same minute: no 429, every page's hero resolves", async () => {
    expect(doc.files).toHaveLength(20);
    // the rest of the app is busy on the same IP (the per-IP budget is spent)
    const pings = await Promise.all(Array.from({ length: 35 }, () => realFetch(`${base}/api/ping`).then((r) => r.status)));
    expect(pings).toContain(429);
    // the burst: every file at once, then the reader's own resolve
    const burst = await Promise.all(doc.files.map((rel) => fetchBookAssetResult(CHILD, doc, rel, 1)));
    expect(burst.every((r) => "blob" in r)).toBe(true);
    const resolved = await resolveBookAssets(CHILD, doc, "en");
    expect(statuses.filter((s) => s === 429)).toEqual([]);
    expect(statuses.every((s) => s === 200)).toBe(true);
    // every page, branch page, repair end and art state shows the child's hero
    const pages: Page[] = [book.cover, ...book.pages, ...book.decision.choices.flatMap((c) => c.branch)];
    const poses = pages.flatMap((p) => [p.hero?.pose, p.repair?.heroAfter?.pose, ...(p.artStates ?? []).map((s) => s.pose)]).filter((x): x is string => !!x);
    for (const pose of poses) {
      const shown = resolvePose(resolved.sheet, pose, book.poseFallbacks);
      expect(heroSpriteUrl(resolved.sheet, shown), pose).toMatch(/^blob:/);
    }
    expect(Object.keys(resolved.sheet.choices ?? {}).sort()).toEqual(["a", "b", "c"]);
    resolved.revoke();
  });
});
