/**
 * B-AIOPS-03 — Live unavailability and the prepay alarm at the real routes,
 * delivered to a fake sink on a fixed clock (28 Oct 2026). Pins:
 *   - three failed mints fire `live_unavailable/mint_failed`; a delivered
 *     token after the quiet window resolves it
 *   - a minted session whose audio never came up (`failed` usage event) is
 *     `connect_failed`; an `opened` session after the quiet window resolves it;
 *     a session that had opened never counts
 *   - production with the residency exception lapsed fires `residency_denied`
 *   - a reservation-store outage fires `budget_store_unavailable`
 *   - the prepay balance is readable by the founder only and alarms at 20 %
 *   - no incident carries the child's name, the uid or any request text
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
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
import { MemoryPrepayCounter } from "../server/prepayBalance.js";
import { createOpsAlerts, type OpsIncident } from "../server/opsAlerts.js";
import type { ArborConfig } from "../config/env.js";
import type { ModelProvider } from "../ai/modelRouter.js";

const T0 = Date.parse("2026-10-28T09:00:00.000Z");
const MIN = 60_000;
let clockNow = T0;
const servers: Server[] = [];
afterAll(async () => { await Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r())))); });

const start = async (over: Partial<ArborConfig> = {}) => {
  const delivered: OpsIncident[] = [];
  const alerts = createOpsAlerts({ owner: "Guy", sinks: [{ async deliver(i) { delivered.push(i); } }], now: () => clockNow });
  const config = { ...createTestConfig({ liveEnabled: true }), ...over };
  const entitlementStore = createEntitlementStore(config);
  const memoryStore = new LocalMemoryStore();
  (memoryStore as any).ensureFamilyForUser = async (uid: string) => ({ familyId: `fam-${uid}` });
  const counter = new MemoryPrepayCounter();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { uid: String(req.headers["x-test-uid"] || "uid-123"), email: String(req.headers["x-test-email"] || "parent@example.com") }; next(); });
  app.use("/api", createApiRouter({
    config, modelProvider: { generateJson: async () => ({}) } as unknown as ModelProvider,
    memoryStore, shareStore: new LocalShareStore(), consentStore: new LocalConsentStore(), framework: loadFramework(),
    entitlementStore, referralStore: createReferralStore(config, entitlementStore), counters: createCounterStore(config),
    consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config), waitlistStore: createWaitlistStore(config),
    liveBudgetStore: new MemoryLiveBudgetStore(), opsAlerts: alerts, prepayCounter: counter,
  }));
  const server = await new Promise<Server>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = async (path: string, body: unknown, uid = "uid-123") => {
    const res = await fetch(`${base}/api${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-uid": uid }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  const get = async (path: string, email: string) => {
    const res = await fetch(`${base}/api${path}`, { headers: { "x-test-email": email } });
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  const mintBody = { childProfile: { id: "child-7c1", name: "Synthetic Child" }, language: "en", noticeAck: "google-global-realtime-v1" };
  return { delivered, alerts, counter, post, get, mint: (uid = "uid-123") => post("/live/token", mintBody, uid) };
};
const contentFree = (incidents: OpsIncident[]) => {
  const json = JSON.stringify(incidents);
  for (const bit of ["Synthetic Child", "child-7c1", "uid-123", "parent@example.com", "provider down"]) expect(json).not.toContain(bit);
};

beforeEach(() => {
  clockNow = T0;
  sdk.create.mockReset();
  sdk.create.mockImplementation(async () => ({ name: "ephemeral-token-name" }));
});

describe("signal 3 — Live unavailability (mint and connect failures)", () => {
  it("three failed mints fire mint_failed, dated and owned; a delivered token after the quiet window resolves it", async () => {
    const h = await start();
    sdk.create.mockImplementation(async () => { throw new Error("provider down"); });
    for (const uid of ["a", "b", "c"]) expect((await h.mint(uid)).body.available).toBe(false);
    await h.alerts.flush();
    expect(h.delivered).toEqual([expect.objectContaining({ signal: "live_unavailable", reason: "mint_failed", state: "firing", count: 3,
      at: "2026-10-28T09:00:00.000Z", owner: "Guy", runbook: "docs/ops/incident-alerts.md#live-unavailable" })]);
    sdk.create.mockImplementation(async () => ({ name: "ephemeral-token-name" }));
    clockNow = T0 + 16 * MIN;
    expect((await h.mint("d")).status).toBe(200);
    await h.alerts.flush();
    expect(h.delivered[1]).toMatchObject({ reason: "mint_failed", state: "resolved", at: "2026-10-28T09:16:00.000Z" });
    contentFree(h.delivered);
  });

  it("a minted session whose audio never came up is connect_failed; an opened session after the hour resolves it", async () => {
    const h = await start();
    const ids: string[] = [];
    for (const uid of ["a", "b", "c", "d"]) ids.push((await h.mint(uid)).body.usageSessionId);
    // A session that opened and then reports failed is NOT a connect failure.
    expect((await h.post("/live/usage", { sessionId: ids[3], event: "opened" }, "d")).status).toBe(200);
    expect((await h.post("/live/usage", { sessionId: ids[3], event: "failed" }, "d")).status).toBe(200);
    await h.alerts.flush();
    expect(h.delivered).toEqual([]);
    for (const [i, uid] of ["a", "b", "c"].entries()) expect((await h.post("/live/usage", { sessionId: ids[i], event: "failed" }, uid)).status).toBe(200);
    await h.alerts.flush();
    expect(h.delivered).toEqual([expect.objectContaining({ reason: "connect_failed", state: "firing", count: 3, windowMinutes: 60 })]);
    clockNow = T0 + 61 * MIN;
    const fresh = await h.mint("e");
    await h.post("/live/usage", { sessionId: fresh.body.usageSessionId, event: "opened" }, "e");
    await h.alerts.flush();
    expect(h.delivered[1]).toMatchObject({ reason: "connect_failed", state: "resolved", at: "2026-10-28T10:01:00.000Z" });
    contentFree(h.delivered);
  });

  it("production with the residency exception lapsed fires residency_denied at once", async () => {
    const h = await start({ arborEnv: "prod", liveGlobalExceptionUntil: undefined, liveVertexEu: false });
    const denied = await h.mint();
    expect(denied.status).toBe(503);
    expect(denied.body.code).toBe("live_residency_denied");
    await h.alerts.flush();
    expect(h.delivered).toEqual([expect.objectContaining({ reason: "residency_denied", state: "firing", count: 1 })]);
  });

  it("a reservation-store outage fires budget_store_unavailable after three refusals", async () => {
    const h = await start();
    sdk.create.mockClear();
    // Break the store the router holds by making every family-day write throw.
    const original = MemoryLiveBudgetStore.prototype.reserve;
    MemoryLiveBudgetStore.prototype.reserve = async () => { throw new Error("firestore unavailable"); };
    try {
      for (const uid of ["a", "b", "c"]) expect((await h.mint(uid)).status).toBe(503);
    } finally {
      MemoryLiveBudgetStore.prototype.reserve = original;
    }
    await h.alerts.flush();
    expect(h.delivered).toEqual([expect.objectContaining({ reason: "budget_store_unavailable", state: "firing" })]);
    expect(sdk.create).not.toHaveBeenCalled();
  });
});

describe("signal 4 — the prepay balance: readable by the founder, alarm at 20 %", () => {
  const ledger = { credit: 10, currency: "EUR", since: "2026-10-28", perLiveMinute: 0.5 };
  it("every delivered Live token counts its reserved slice; at 20 % of the credit the alarm fires once; the founder reads the balance", async () => {
    const saved = process.env.ARBOR_ADMIN_EMAILS;
    process.env.ARBOR_ADMIN_EMAILS = "founder@example.com";
    try {
      const h = await start({ aiPrepayLedger: ledger });
      // €10 credit at €0.50/min = 20 min; 20 % = €2 left = 16 reserved minutes.
      for (const uid of ["a", "b", "c"]) expect((await h.mint(uid)).status).toBe(200); // 15 min → €2.50 left
      await new Promise((r) => setTimeout(r, 20));
      await h.alerts.flush();
      expect(h.delivered).toEqual([]);
      expect((await h.mint("d")).status).toBe(200); // 20 min → €0 left
      await new Promise((r) => setTimeout(r, 20));
      await h.alerts.flush();
      expect(h.delivered).toEqual([expect.objectContaining({ signal: "prepay_low", reason: "below_20_percent", state: "firing",
        at: "2026-10-28T09:00:00.000Z", owner: "Guy", prepay: { remaining: 0, credit: 10, currency: "EUR" } })]);
      const read = await h.get("/admin/prepay", "founder@example.com");
      expect(read.status).toBe(200);
      expect(read.body).toMatchObject({ configured: true, credit: 10, currency: "EUR", since: "2026-10-28", liveMinutes: 20, spent: 10, remaining: 0, low: true });
      expect((await h.get("/admin/prepay", "parent@example.com")).status).toBe(403);
      contentFree(h.delivered);
    } finally {
      if (saved === undefined) delete process.env.ARBOR_ADMIN_EMAILS; else process.env.ARBOR_ADMIN_EMAILS = saved;
    }
  });

  it("with the ledger off, the balance reads as not configured and nothing alarms", async () => {
    const saved = process.env.ARBOR_ADMIN_EMAILS;
    process.env.ARBOR_ADMIN_EMAILS = "founder@example.com";
    try {
      const h = await start();
      expect((await h.mint()).status).toBe(200);
      expect((await h.get("/admin/prepay", "founder@example.com")).body).toEqual({ configured: false });
      expect(h.counter.totals.size).toBe(0);
    } finally {
      if (saved === undefined) delete process.env.ARBOR_ADMIN_EMAILS; else process.env.ARBOR_ADMIN_EMAILS = saved;
    }
  });
});
