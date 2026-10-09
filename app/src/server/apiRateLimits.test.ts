/**
 * K2 — the book-asset routes leave the per-IP /api limit for a per-account
 * one: a book's first open (every private file at once) never hits 429, and
 * families behind one IP do not share the budget. The global limit still holds
 * everywhere else.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import type { AddressInfo } from "node:net";
import express, { type RequestHandler } from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./logger.js", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }, requestIdOf: () => "test" }));

import { API_PER_IP_PER_MIN, apiRateLimit, bookAssetRates, isBookAssetRoute } from "./apiRateLimits";
import { createBookAssetsRouter, type BookAssetBucket, type BookAssetFile } from "./bookAssets";
import { createBookSheetRouter, LocalBookAssetsDocStore } from "./bookSheet";
import type { EntitlementStore, Plan } from "./entitlements";

const here = path.dirname(fileURLToPath(import.meta.url));
const BOOK = "five-smooth-stones";
const HASH = "0123456789abcdef";

const FILES = Array.from({ length: 60 }, (_, i) => `hero-sheets/h-${HASH}/p${i}.webp`);
function bucket(): BookAssetBucket {
  const fileOf = (name: string): BookAssetFile => ({
    name,
    exists: async () => [true],
    createReadStream: () => Readable.from([Buffer.from("RIFF")]),
    delete: async () => undefined,
  });
  return { file: fileOf, getFiles: async () => [[]] };
}
const plans = (p: Record<string, Plan>): EntitlementStore => ({ async getPlan(uid) { return p[uid] ?? null; }, async getRecord(uid) { return p[uid] ? { plan: p[uid], status: "active" } : null; } });
const open: RequestHandler = (_req, _res, next) => next();

describe("the book-asset routes leave the per-IP /api limit", () => {
  it("matches exactly the proxy, the sheet's PUT and commit, and the narration route", () => {
    for (const p of ["/children/kid1/book-assets/five-smooth-stones/file", "/children/kid1/book-assets/b/commit", "/children/kid1/book-narration"]) expect(isBookAssetRoute(p), p).toBe(true);
    for (const p of ["/hero-pose", "/children/kid1/photos", "/children/kid1/book-assets/b/other", "/chat", "/children/kid1/book-assets/b/file/x"]) expect(isBookAssetRoute(p), p).toBe(false);
    expect(bookAssetRates()).toEqual({ reads: 600, writes: 120 });
  });

  it("createApp mounts the one global limiter (with the skip) and nothing else", () => {
    const app = readFileSync(path.join(here, "createApp.ts"), "utf8");
    expect(app).toContain('app.use("/api", apiRateLimit());');
    expect(app).not.toMatch(/\brateLimit\(/);
  });
});

describe("per-account limits on one IP", () => {
  let base = "";
  let server: ReturnType<express.Express["listen"]>;
  beforeEach(() => { process.env.ENFORCE_ENTITLEMENTS = "true"; });
  afterEach(() => { delete process.env.ENFORCE_ENTITLEMENTS; });
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", apiRateLimit());
    app.use((req, _res, next) => {
      const who = req.header("x-test-user");
      if (who) (req as { user?: { uid: string } }).user = { uid: who };
      next();
    });
    app.get("/api/ping", (_req, res) => { res.json({ ok: true }); });
    app.use("/api", createBookAssetsRouter({ getBucket: async () => bucket(), requireOwnership: open }));
    app.use("/api", createBookSheetRouter({
      getBucket: async () => bucket(), requireOwnership: open, docs: new LocalBookAssetsDocStore(), writesPerMin: 3,
      heroSource: { strictHash: false, async load() { return null; } }, entitlements: plans({ famA: "plus", famB: "plus" }),
    }));
    await new Promise<void>((r) => { server = app.listen(0, () => r()); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  const get = (url: string, uid: string) => fetch(base + url, { headers: { "x-test-user": uid } });
  const commit = (uid: string) => fetch(`${base}/api/children/kid1/book-assets/${BOOK}/commit`, { method: "POST", headers: { "x-test-user": uid, "content-type": "application/json" }, body: JSON.stringify({ avatarHash: HASH, dryRun: true }) });

  it("a first open of the book (60 private files) never hits 429; the global limit still holds elsewhere", async () => {
    const codes = await Promise.all(FILES.map((rel) => get(`/api/children/kid1/book-assets/${BOOK}/file?path=${encodeURIComponent(rel)}`, "famA").then((r) => r.status)));
    expect(codes.filter((c) => c === 429)).toEqual([]);
    expect(codes.every((c) => c === 200)).toBe(true);
    const pings: number[] = [];
    for (let i = 0; i <= API_PER_IP_PER_MIN; i++) pings.push((await get("/api/ping", "famA")).status);
    expect(pings.slice(0, API_PER_IP_PER_MIN).every((c) => c === 200)).toBe(true);
    expect(pings[API_PER_IP_PER_MIN]).toBe(429);
  });

  it("families behind one IP do not share the budget (writes keyed on the account)", async () => {
    for (let i = 0; i < 3; i++) expect((await commit("famA")).status).not.toBe(429);
    const over = await commit("famA");
    expect(over.status).toBe(429);
    expect((await over.json()).code).toBe("book_assets_rate");
    expect((await commit("famB")).status).not.toBe(429);
  });
});
