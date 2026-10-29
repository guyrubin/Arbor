/**
 * K2 — the book-asset routes leave the shared /api budgets for a per-account
 * one: a book's first open (every private file at once) never hits 429, and
 * families behind one IP do not share the budget.
 *
 * B-INF-16 — the shared budgets themselves. The old single limit (30 a minute
 * per IP, before auth) 429'd every call on the fourth Sharing load in a minute
 * and made families behind one address share 30. Pinned here: a per-account
 * budget after auth, a read and a write ceiling per IP before it, and the
 * strict groups (model calls, invites, exports) keeping 30 a minute per IP each.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import type { AddressInfo } from "node:net";
import express, { type RequestHandler } from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./logger.js", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }, requestIdOf: () => "test" }));

import {
  API_PER_ACCOUNT_PER_MIN, API_READS_PER_IP_PER_MIN, API_WRITES_PER_IP_PER_MIN, STRICT_PER_IP_PER_MIN,
  apiAccountRateLimit, apiRateLimit, liveUsageRateLimit, bookAssetRates, isBookAssetRoute, strictRouteGroup,
} from "./apiRateLimits";
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
/** The test stand-in for createAuthMiddleware: the x-test-user header is the verified uid. */
const fakeAuth: RequestHandler = (req, _res, next) => {
  const who = req.header("x-test-user");
  if (who) (req as { user?: { uid: string } }).user = { uid: who };
  next();
};

/** createApp's order: the per-IP limits, auth, the per-account budget, then the routes. */
async function stand(routes: (app: express.Express) => void) {
  const app = express();
  app.use(express.json());
  app.use("/api", apiRateLimit());
  app.use(fakeAuth);
  app.use("/api", apiAccountRateLimit());
  routes(app);
  app.use("/api", (_req, res) => { res.json({ ok: true }); });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (method: string, url: string, uid?: string) => fetch(base + url, { method, headers: { ...(uid ? { "x-test-user": uid } : {}), "content-type": "application/json" }, ...(method === "GET" ? {} : { body: "{}" }) });
  return { call, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

describe("the book-asset routes leave the shared /api budgets", () => {
  it("matches exactly the proxy, the sheet's PUT and commit, and the narration route", () => {
    for (const p of ["/children/kid1/book-assets/five-smooth-stones/file", "/children/kid1/book-assets/b/commit", "/children/kid1/book-narration", "/children/kid1/plan-narration"]) expect(isBookAssetRoute(p), p).toBe(true);
    for (const p of ["/hero-pose", "/children/kid1/photos", "/children/kid1/book-assets/b/other", "/chat", "/children/kid1/book-assets/b/file/x"]) expect(isBookAssetRoute(p), p).toBe(false);
    expect(bookAssetRates()).toEqual({ reads: 600, writes: 120 });
  });

  it("createApp mounts the per-IP limits before auth and the per-account budget after it, and no other limiter", () => {
    const app = readFileSync(path.join(here, "createApp.ts"), "utf8");
    const ip = app.indexOf('app.use("/api", apiRateLimit());');
    const auth = app.indexOf('app.use("/api", createAuthMiddleware(config));');
    const account = app.indexOf('app.use("/api", apiAccountRateLimit());');
    const routes = app.indexOf('app.use("/api", createApiRouter(');
    expect(ip).toBeGreaterThan(0);
    expect(auth).toBeGreaterThan(ip);
    expect(account).toBeGreaterThan(auth);
    expect(routes).toBeGreaterThan(account);
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
    app.use(fakeAuth);
    app.use("/api", apiAccountRateLimit());
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

  it("a first open of the book (60 private files) never hits 429 and spends none of the account's budget", async () => {
    const codes = await Promise.all(FILES.map((rel) => get(`/api/children/kid1/book-assets/${BOOK}/file?path=${encodeURIComponent(rel)}`, "famA").then((r) => r.status)));
    expect(codes.filter((c) => c === 429)).toEqual([]);
    expect(codes.every((c) => c === 200)).toBe(true);
    const pings: number[] = [];
    for (let i = 0; i <= API_PER_ACCOUNT_PER_MIN; i++) pings.push((await get("/api/ping", "famA")).status);
    expect(pings.slice(0, API_PER_ACCOUNT_PER_MIN).every((c) => c === 200)).toBe(true);
    expect(pings[API_PER_ACCOUNT_PER_MIN]).toBe(429);
  });

  it("families behind one IP do not share the budget (writes keyed on the account)", async () => {
    for (let i = 0; i < 3; i++) expect((await commit("famA")).status).not.toBe(429);
    const over = await commit("famA");
    expect(over.status).toBe(429);
    expect((await over.json()).code).toBe("book_assets_rate");
    expect((await commit("famB")).status).not.toBe(429);
  });
});

it("usage reports have an account budget without consuming the shared budgets", async () => {
  const app = express();
  app.use("/api", apiRateLimit());
  app.use((req, _res, next) => { (req as any).user = { uid: req.header("x-test-user") || "a" }; next(); });
  app.use("/api", apiAccountRateLimit(3));
  app.post("/api/live/usage", liveUsageRateLimit(2), (_req, res) => res.json({ ok: true }));
  app.get("/api/ping", (_req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const report = (uid: string) => fetch(`${base}/api/live/usage`, { method: "POST", headers: { "x-test-user": uid } });
    expect((await report("a")).status).toBe(200);
    expect((await report("a")).status).toBe(200);
    expect((await report("a")).status).toBe(429);
    expect((await report("b")).status).toBe(200);
    for (let n = 0; n < 3; n++) expect((await fetch(`${base}/api/ping`, { headers: { "x-test-user": "a" } })).status).toBe(200);
    expect((await fetch(`${base}/api/ping`, { headers: { "x-test-user": "a" } })).status).toBe(429);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

describe("B-INF-16 · the per-IP limit does not break a normal page visit", () => {
  it("pins the budgets", () => {
    expect({ reads: API_READS_PER_IP_PER_MIN, writes: API_WRITES_PER_IP_PER_MIN, account: API_PER_ACCOUNT_PER_MIN, strict: STRICT_PER_IP_PER_MIN })
      .toEqual({ reads: 600, writes: 120, account: 300, strict: 30 });
  });

  it("every model route in createApp and in the AI caller inventory is in the strict model group", () => {
    const app = readFileSync(path.join(here, "createApp.ts"), "utf8");
    const listed = /const modelRoutes = \[([\s\S]*?)\];/.exec(app);
    expect(listed).toBeTruthy();
    const fromApp = [...listed![1].matchAll(/"\/api(\/[^"]+)"/g)].map((m) => m[1]);
    expect(fromApp.length).toBeGreaterThanOrEqual(19);
    const inventory = readFileSync(path.join(here, "..", "..", "..", "docs", "architecture", "ai-caller-inventory.md"), "utf8");
    const fromInventory = [...inventory.matchAll(/^\| api POST (\/[^ |]+) \|/gm)].map((m) => m[1]);
    expect(fromInventory.length).toBeGreaterThanOrEqual(20);
    for (const route of [...fromApp, ...fromInventory, "/chat", "/council", "/plans/phrase"]) expect(strictRouteGroup("POST", route), route).toBe("model");
  });

  it("invites and exports are strict; the page's reads are not", () => {
    for (const route of ["/shares", "/co-parent/invitations", "/digest/email-send", "/waitlist"]) expect(strictRouteGroup("POST", route), route).toBe("invite");
    for (const route of ["/privacy/export/kid1", "/children/kid1/book-assets/export-manifest"]) expect(strictRouteGroup("GET", route), route).toBe("export");
    // Negative controls: the Sharing, Care team and Now reads, the TTS capability probe, a revoke.
    for (const [method, route] of [["GET", "/shares"], ["GET", "/shared-with-me"], ["GET", "/entitlement"], ["GET", "/tts"], ["GET", "/plans/visibility"],
      ["GET", "/memory/kid1"], ["GET", "/live/availability"], ["DELETE", "/shares/g1"], ["GET", "/co-parent/invitations"]] as const) {
      expect(strictRouteGroup(method, route), `${method} ${route}`).toBeNull();
    }
  });

  it("three loads of Sharing, Care team and Now in a minute, for two parents on one IP, never answer 429", async () => {
    // The request mix measured on the dev sandbox (StrictMode doubles effects there), 29 Oct.
    const boot = [["GET", "/api/entitlement"], ["GET", "/api/tts"], ["GET", "/api/plans/visibility"], ["GET", "/api/memory/kid1"], ["GET", "/api/memory/kid1"]];
    const roster = [["GET", "/api/shares?childId=kid1&history=1"], ["GET", "/api/shares?childId=kid1&history=1"], ["GET", "/api/shared-with-me"], ["GET", "/api/shared-with-me"]];
    const pages = { sharing: [...boot, ...roster], careTeam: [...boot, ...roster], now: [...boot, ["POST", "/api/digest"]] };
    const s = await stand(() => undefined);
    try {
      const codes: number[] = [];
      for (let round = 0; round < 3; round++) for (const page of [pages.sharing, pages.careTeam, pages.now]) for (const uid of ["parentA", "parentB"]) {
        for (const [method, url] of page) codes.push((await s.call(method, url, uid)).status);
      }
      expect(codes.length).toBe(2 * 3 * (9 + 9 + 6));
      expect(codes.filter((c) => c === 429)).toEqual([]);
    } finally { await s.close(); }
  });

  it("one family member's budget is their own: the next one on the same IP still reads", async () => {
    const s = await stand(() => undefined);
    try {
      for (let n = 0; n < API_PER_ACCOUNT_PER_MIN; n++) expect((await s.call("GET", "/api/shares", "parentA")).status).toBe(200);
      const over = await s.call("GET", "/api/shares", "parentA");
      expect(over.status).toBe(429);
      expect((await over.json()).code).toBe("api_account_rate");
      expect((await s.call("GET", "/api/shares", "parentB")).status).toBe(200);
    } finally { await s.close(); }
  });

  it.each([
    ["model", "POST", "/api/chat"],
    ["invite", "POST", "/api/shares"],
    ["export", "GET", "/api/children/kid1/book-assets/export-manifest"],
  ] as const)("the %s routes keep their own 30 a minute per IP, across accounts", async (group, method, url) => {
    const s = await stand(() => undefined);
    try {
      for (let n = 0; n < STRICT_PER_IP_PER_MIN; n++) expect((await s.call(method, url, n % 2 ? "parentA" : "parentB")).status).toBe(200);
      const over = await s.call(method, url, "parentC");
      expect(over.status).toBe(429);
      expect((await over.json()).code).toBe(`api_${group}_rate`);
      // The page's own reads are untouched by a spent strict group.
      expect((await s.call("GET", "/api/shares", "parentC")).status).toBe(200);
    } finally { await s.close(); }
  });

  it("the per-IP read and write ceilings hold across accounts and signed out", async () => {
    const s = await stand(() => undefined);
    try {
      const uids = ["a", "b", "c"];
      for (let n = 0; n < API_READS_PER_IP_PER_MIN; n++) expect((await s.call("GET", "/api/entitlement", uids[n % 3])).status).toBe(200);
      const reads = await s.call("GET", "/api/entitlement", "d");
      expect(reads.status).toBe(429);
      expect((await reads.json()).code).toBe("api_ip_reads");
      for (let n = 0; n < API_WRITES_PER_IP_PER_MIN; n++) expect((await s.call("DELETE", "/api/shares/g1", uids[n % 3])).status).toBe(200);
      const writes = await s.call("DELETE", "/api/shares/g1");
      expect(writes.status).toBe(429);
      expect((await writes.json()).code).toBe("api_ip_writes");
    } finally { await s.close(); }
  });
});
