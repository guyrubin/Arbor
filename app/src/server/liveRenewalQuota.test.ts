/**
 * B-AIOPS-02 round 3 — a verified Live renewal does not spend the per-user
 * hourly AI cap (it is bounded by the family's daily voice allowance: at most
 * a couple per talk), so a long talk is never cut by its own seams. Every
 * other model request — a first mint included — still counts.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

let server: Server;
let base = "";
const prior = process.env.AI_USER_HOURLY_LIMIT;
let isLiveRenewalRequest: (req: { method?: string; originalUrl?: string; body?: unknown }) => boolean;

beforeAll(async () => {
  process.env.AI_USER_HOURLY_LIMIT = "2";
  vi.resetModules();
  const quota = await import("./aiQuota.js");
  const { MemoryCounterStore } = await import("./quotaStore.js");
  isLiveRenewalRequest = quota.isLiveRenewalRequest;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { uid: "parent-a" }; next(); });
  app.use(["/api/live/token", "/api/voice"], quota.createAiQuota(new MemoryCounterStore()));
  app.post(["/api/live/token", "/api/voice"], (_req, res) => { res.json({ ok: true }); });
  server = await new Promise<Server>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  if (prior === undefined) delete process.env.AI_USER_HOURLY_LIMIT; else process.env.AI_USER_HOURLY_LIMIT = prior;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.status);

describe("renewal mints are outside the hourly AI cap", () => {
  it("the cap still binds first mints; renewals pass however many there are and do not use it up", async () => {
    expect(await post("/api/live/token", {})).toBe(200);
    for (let i = 0; i < 5; i++) expect(await post("/api/live/token", { renewOf: "00000000-0000-4000-8000-000000000000" })).toBe(200);
    expect(await post("/api/live/token", {})).toBe(200);
    expect(await post("/api/live/token", {})).toBe(429);
    expect(await post("/api/voice", { renewOf: "x" })).toBe(429); // only the Live token route knows renewals
  });

  it("only a POST to the token route with a string renewOf is a renewal", () => {
    expect(isLiveRenewalRequest({ method: "POST", originalUrl: "/api/live/token", body: { renewOf: "id" } })).toBe(true);
    expect(isLiveRenewalRequest({ method: "POST", originalUrl: "/api/live/token?x=1", body: { renewOf: "id" } })).toBe(true);
    expect(isLiveRenewalRequest({ method: "GET", originalUrl: "/api/live/token", body: { renewOf: "id" } })).toBe(false);
    expect(isLiveRenewalRequest({ method: "POST", originalUrl: "/api/live/token", body: { renewOf: 7 } })).toBe(false);
    expect(isLiveRenewalRequest({ method: "POST", originalUrl: "/api/voice", body: { renewOf: "id" } })).toBe(false);
  });
});
