/**
 * B-PROV-12 — acknowledgement is ENFORCED at the token mint, before any
 * reservation or provider call: a request that does not acknowledge the
 * runtime route's approved notice is a typed 428 naming that notice; an
 * acknowledgement of a different route (or none) can never mint.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const sdk = vi.hoisted(() => ({ create: vi.fn(async (_opts: unknown) => ({ name: "ephemeral-token-name" })) }));
vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return { ...actual, GoogleGenAI: class { authTokens = { create: sdk.create }; } };
});

import { createApiRouter } from "./api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "../server/quotaStore.js";
import { createEntitlementStore } from "../server/entitlements.js";
import { createReferralStore } from "../server/referral.js";
import { createConsultStore } from "../server/consultRequests.js";
import { createAdminMetricsStore } from "../server/adminMetrics.js";
import { createWaitlistStore } from "../server/waitlist.js";
import { MemoryLiveBudgetStore } from "../server/liveBudget.js";
import type { ArborConfig } from "../config/env.js";
import type { ModelProvider } from "../ai/modelRouter.js";

const budget = new MemoryLiveBudgetStore();
const servers: Server[] = [];
const serve = async (over: Partial<ArborConfig>) => {
  const config = { ...createTestConfig({ liveEnabled: true }), ...over };
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter({
    config, modelProvider: { generateJson: async () => ({}) } as unknown as ModelProvider,
    memoryStore: new LocalMemoryStore(), shareStore: new LocalShareStore(), consentStore: new LocalConsentStore(), framework: loadFramework(),
    entitlementStore, referralStore: createReferralStore(config, entitlementStore), counters: createCounterStore(config),
    consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config), waitlistStore: createWaitlistStore(config),
    liveBudgetStore: budget,
  }));
  const server = await new Promise<Server>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};
let globalBase = "";
let euBase = "";
beforeAll(async () => {
  globalBase = await serve({});
  euBase = await serve({ liveVertexEu: true, gcpProjectId: "arbor-test", liveVertexLocation: "europe-west4", liveGlobalExceptionUntil: undefined });
});
afterAll(async () => { await Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r())))); });
beforeEach(() => { sdk.create.mockClear(); budget.days.clear(); });

const availability = async (base: string) => (await fetch(`${base}/api/live/availability`)).json() as Promise<Record<string, any>>;
const mint = async (base: string, body: Record<string, unknown>) => {
  const res = await fetch(`${base}/api/live/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

describe("B-PROV-12 — the runtime route's notice, enforced at the mint", () => {
  it("availability names the approved notice of the route a tap would take", async () => {
    expect((await availability(globalBase)).notice).toEqual({ id: "google-global-realtime-v1" });
    expect((await availability(euBase)).notice).toEqual({ id: "google-eu-realtime-v1" });
  });

  it("no acknowledgement → 428 naming the notice; nothing reserved, nothing minted", async () => {
    const res = await mint(globalBase, { language: "en" });
    expect(res.status).toBe(428);
    expect(res.body).toEqual({ available: false, code: "voice_notice_required", notice: { id: "google-global-realtime-v1" } });
    expect(sdk.create).not.toHaveBeenCalled();
    expect(budget.days.size).toBe(0);
  });

  it("an acknowledgement of another route (provider/region change) cannot be reused", async () => {
    const res = await mint(euBase, { noticeAck: "google-global-realtime-v1" });
    expect(res.status).toBe(428);
    expect(res.body.notice).toEqual({ id: "google-eu-realtime-v1" });
    expect((await mint(globalBase, { noticeAck: "device-speech-v1" })).status).toBe(428);
    expect((await mint(globalBase, { noticeAck: ["google-global-realtime-v1"] })).status).toBe(428);
    expect(sdk.create).not.toHaveBeenCalled();
  });

  it("the matching acknowledgement mints", async () => {
    const res = await mint(globalBase, { noticeAck: "google-global-realtime-v1" });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(sdk.create).toHaveBeenCalledTimes(1);
    expect((await mint(euBase, { noticeAck: "google-eu-realtime-v1" })).status).toBe(200);
  });
});
