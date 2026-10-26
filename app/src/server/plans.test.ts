/**
 * B-KID-167 — the visibility gate on the server (GA DoD 3): an UNSIGNED
 * pattern is composable only in the sandbox and for the owner allow-list; a
 * signed one for everyone who owns the child; the composition must fit the
 * pattern's sourced menu; the words are never in the request or the response.
 */
import express, { type RequestHandler } from "express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPlansRouter, MemoryPlanBookDocStore, viewerOf } from "./plans";

type Cfg = Parameters<typeof createPlansRouter>[0]["config"];

const base: Cfg = { plansReviewed: {}, plansOwnerUids: ["owner-uid"], plansOwnerEmails: ["guy@example.test"], memoryAdapter: "firestore", arborEnv: "prod" };

function serve(cfg: Cfg, user: { uid: string; email?: string } | null, store = new MemoryPlanBookDocStore()) {
  const app = express();
  app.use((req, _res, next) => {
    if (user) (req as any).user = user;
    next();
  });
  const ownership: RequestHandler = (req, res, next) => (String(req.params.childId) === "victims-kid" ? res.status(403).json({ error: "Not authorized for this child." }) : next());
  app.use("/api", createPlansRouter({ config: cfg, requireOwnership: ownership, store, now: () => "2026-10-26T20:00:00.000Z" }));
  return new Promise<{ url: string; close: () => void; store: MemoryPlanBookDocStore }>((resolve) => {
    const server = app.listen(0, () => resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`, close: () => server.close(), store }));
  });
}

const good = { pattern: "plan-poo-sit", lang: "en", stepMenuIds: ["sit-after-meal", "the-box", "just-try"], minutes: 5, time: "evening", boxItemIds: ["book", "soap-bubbles"], durationDays: 21 };
const post = (url: string, body: unknown) => fetch(`${url}/children/kid-1/plan-books`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("B-KID-167: GET /plans/visibility", () => {
  const servers: { close: () => void }[] = [];
  afterAll(() => servers.forEach((s) => s.close()));

  it("a family outside the allow-list sees every pattern unsigned and not composable", async () => {
    const s = await serve(base, { uid: "family-1" });
    servers.push(s);
    const r = await fetch(`${s.url}/plans/visibility`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.reviewed["plan-poo-sit"]).toEqual({ en: false, he: false });
    expect(body.composable["plan-poo-sit"]).toEqual({ en: false, he: false });
    expect(Object.keys(body.composable)).toHaveLength(8);
  });

  it("the owner (uid or verified email) may compose an unsigned pattern; nothing reads as reviewed", async () => {
    const byUid = await serve(base, { uid: "owner-uid" });
    const byEmail = await serve(base, { uid: "someone", email: "Guy@Example.test" });
    servers.push(byUid, byEmail);
    for (const s of [byUid, byEmail]) {
      const body = await (await fetch(`${s.url}/plans/visibility`)).json();
      expect(body.reviewed["plan-poo-sit"]).toEqual({ en: false, he: false });
      expect(body.composable["plan-poo-sit"]).toEqual({ en: true, he: true });
    }
  });

  it("a signed language is composable for everyone; only a literal true signs", async () => {
    const s = await serve({ ...base, plansReviewed: { "plan-poo-sit": { en: true, he: "yes" as unknown as boolean }, "plan-made-up": { en: true } } }, { uid: "family-1" });
    servers.push(s);
    const body = await (await fetch(`${s.url}/plans/visibility`)).json();
    expect(body.reviewed["plan-poo-sit"]).toEqual({ en: true, he: false });
    expect(body.composable["plan-poo-sit"]).toEqual({ en: true, he: false });
    expect(body.reviewed["plan-made-up"]).toBeUndefined();
  });

  it("the local sandbox (no token, local adapter, not prod) composes everything; prod never counts as sandbox", () => {
    expect(viewerOf({} as express.Request, { ...base, memoryAdapter: "local", arborEnv: "local" }).sandbox).toBe(true);
    expect(viewerOf({} as express.Request, { ...base, memoryAdapter: "local", arborEnv: "prod" }).sandbox).toBe(false);
    expect(viewerOf({} as express.Request, base).sandbox).toBe(false);
    expect(viewerOf({ user: { uid: "u" } } as unknown as express.Request, { ...base, memoryAdapter: "local", arborEnv: "local" }).sandbox).toBe(false);
  });
});

describe("B-KID-167: POST /children/:childId/plan-books", () => {
  const servers: { close: () => void }[] = [];
  afterAll(() => servers.forEach((s) => s.close()));

  it("refuses an unsigned pattern for a family outside the allow-list (403 plan_unsigned) and writes nothing", async () => {
    const s = await serve(base, { uid: "family-1" });
    servers.push(s);
    const r = await post(s.url, good);
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe("plan_unsigned");
    expect(s.store.docs.size).toBe(0);
  });

  it("the owner composes an unsigned pattern: the doc holds the choices and the approval, never the words", async () => {
    const s = await serve(base, { uid: "owner-uid" });
    servers.push(s);
    const r = await post(s.url, good);
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.persisted).toBe(true);
    expect(body.why).toBe("owner");
    expect(body.doc).toEqual({
      id: "plan-poo-sit.kid-1",
      bookId: "plan-poo-sit.kid-1",
      kind: "plan",
      pattern: "plan-poo-sit",
      lang: "en",
      stepMenuIds: ["sit-after-meal", "the-box", "just-try"],
      minutes: 5,
      time: "evening",
      boxItemIds: ["book", "soap-bubbles"],
      durationDays: 21,
      approvedAt: "2026-10-26T20:00:00.000Z",
      approvedBy: "owner-uid",
      createdAt: "2026-10-26T20:00:00.000Z",
      updatedAt: "2026-10-26T20:00:00.000Z",
      status: "active",
    });
    expect(JSON.stringify(body)).not.toMatch(/tummy|poo |wonder box/i);
    expect(s.store.docs.get("owner-uid:kid-1:plan-poo-sit.kid-1")).toEqual(body.doc);
  });

  it("a signed pattern composes for any owner of the child", async () => {
    const s = await serve({ ...base, plansReviewed: { "plan-poo-sit": { en: true } } }, { uid: "family-1" });
    servers.push(s);
    expect((await post(s.url, good)).status).toBe(201);
    expect((await post(s.url, { ...good, lang: "he" })).status).toBe(403);
  });

  it("refuses a composition outside the pattern's menu or bounds (400, problems named)", async () => {
    const s = await serve(base, { uid: "owner-uid" });
    servers.push(s);
    const r = await post(s.url, { ...good, stepMenuIds: ["the-box", "the-box", "just-try"], minutes: 25, time: "whenever", boxItemIds: ["sweets"], durationDays: 90 });
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.code).toBe("plan_bad_composition");
    expect(body.problems.map((p: { code: string }) => p.code).sort()).toEqual(["bad_box_item", "bad_duration", "bad_minutes", "bad_step", "bad_time"]);
    expect(s.store.docs.size).toBe(0);
  });

  it("another family's child is refused by ownership; an unknown or unauthored pattern is 404", async () => {
    const s = await serve(base, { uid: "owner-uid" });
    servers.push(s);
    const other = await fetch(`${s.url}/children/victims-kid/plan-books`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(good) });
    expect(other.status).toBe(403);
    expect((await post(s.url, { ...good, pattern: "plan-anything" })).status).toBe(404);
    expect((await post(s.url, { ...good, pattern: "plan-new-food" })).status).toBe(404);
  });

  it("the sandbox gets the doc back to keep on the device (persisted: false)", async () => {
    const s = await serve({ ...base, memoryAdapter: "local", arborEnv: "local" }, null);
    servers.push(s);
    const r = await post(s.url, good);
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.persisted).toBe(false);
    expect(body.why).toBe("sandbox");
    expect(body.doc.approvedBy).toBe("local-sandbox");
    expect(s.store.docs.size).toBe(0);
  });
});
