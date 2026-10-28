/**
 * B-AIOPS-02 — POST /api/live/token reserves against the FAMILY's daily
 * realtime-voice allowance before the provider is touched. Pins:
 *   - two parents of one family share one allowance; another family does not
 *   - the token's expireTime is the reservation end (<= 5 min), with a
 *     one-minute newSessionExpireTime so a parked token cannot be spent later
 *   - exhaustion is a typed 429 `live_resting` with NO Retry-After and
 *     X-Live-Quota-* headers; nothing is minted
 *   - a "closed" usage report does not refund the reservation
 *   - a provider mint failure releases the slice (server fact, not client say-so)
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
import { MemoryLiveBudgetStore, LIVE_RESTING } from "../server/liveBudget.js";
import type { ModelProvider } from "../ai/modelRouter.js";

const FAMILY_OF: Record<string, string> = { "parent-a": "fam-1", "parent-b": "fam-1", "parent-c": "fam-2" };
const budget = new MemoryLiveBudgetStore();
let server: Server;
let base = "";
const priorPaid = process.env.LIVE_PAID_MINUTES_PER_DAY;

beforeAll(async () => {
  // Local config is unenforced → every parent resolves to Plus (20 min). Keep
  // the test short: 10 minutes = two 5-minute slices per family-day.
  process.env.LIVE_PAID_MINUTES_PER_DAY = "10";
  const config = createTestConfig({ liveEnabled: true });
  const entitlementStore = createEntitlementStore(config);
  const memoryStore = new LocalMemoryStore();
  (memoryStore as any).ensureFamilyForUser = async (uid: string) => ({ familyId: FAMILY_OF[uid] ?? `fam-${uid}` });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { uid: String(req.headers["x-test-uid"] || "parent-a") }; next(); });
  app.use("/api", createApiRouter({
    config, modelProvider: { generateJson: async () => ({}) } as unknown as ModelProvider,
    memoryStore, shareStore: new LocalShareStore(), consentStore: new LocalConsentStore(), framework: loadFramework(),
    entitlementStore, referralStore: createReferralStore(config, entitlementStore), counters: createCounterStore(config),
    consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config), waitlistStore: createWaitlistStore(config),
    liveBudgetStore: budget,
  }));
  server = await new Promise<Server>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  if (priorPaid === undefined) delete process.env.LIVE_PAID_MINUTES_PER_DAY; else process.env.LIVE_PAID_MINUTES_PER_DAY = priorPaid;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  budget.days.clear();
  sdk.create.mockClear();
  sdk.create.mockImplementation(async () => ({ name: "ephemeral-token-name" }));
});

const mint = async (uid: string, body: Record<string, unknown> = {}) => {
  const res = await fetch(`${base}/api/live/token`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-uid": uid }, body: JSON.stringify(body) });
  return { status: res.status, headers: res.headers, body: (await res.json()) as Record<string, any> };
};
const report = async (uid: string, sessionId: string, event: string) => {
  const res = await fetch(`${base}/api/live/usage`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-uid": uid }, body: JSON.stringify({ sessionId, event }) });
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

describe("B-AIOPS-02 — the family allowance at the mint route", () => {
  it("reserves a <=5-minute slice: the token expireTime is the reservation end and the response reports the budget", async () => {
    const before = Date.now();
    const { status, body } = await mint("parent-a");
    expect(status).toBe(200);
    expect(body.available).toBe(true);
    const expiresAt = Date.parse(body.expiresAt);
    expect(expiresAt - before).toBeGreaterThan(4 * 60_000);
    expect(expiresAt - before).toBeLessThanOrEqual(5 * 60_000 + 2_000);
    const arg = sdk.create.mock.calls[0][0] as any;
    expect(arg.config.expireTime).toBe(body.expiresAt);
    expect(Date.parse(arg.config.newSessionExpireTime) - before).toBeLessThanOrEqual(61_000);
    expect(body.budget).toMatchObject({ reservedMs: 5 * 60_000, remainingMs: 5 * 60_000, allowanceMs: 10 * 60_000 });
    expect(typeof body.usageSessionId).toBe("string");
  });

  it("two parents of one family share the allowance; a third mint is a typed 429 with no Retry-After and nothing minted", async () => {
    expect((await mint("parent-a")).status).toBe(200);
    expect((await mint("parent-b")).status).toBe(200);
    const blocked = await mint("parent-a");
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe(LIVE_RESTING);
    expect(blocked.body.retryable).toBe(false);
    expect(blocked.body.token).toBeUndefined();
    expect(blocked.headers.get("Retry-After")).toBeNull();
    expect(blocked.headers.get("X-Live-Quota-Remaining")).toBe("0");
    expect(blocked.headers.get("X-Live-Quota-Limit")).toBe(String(10 * 60));
    expect(blocked.headers.get("X-Live-Quota-Reset")).toMatch(/T00:00:00\.000Z$/);
    expect(sdk.create).toHaveBeenCalledTimes(2);
    // Another family is untouched.
    expect((await mint("parent-c")).status).toBe(200);
  });

  it("a 'closed' usage report records observed time but never refunds the reservation", async () => {
    const first = await mint("parent-a");
    const closed = await report("parent-a", first.body.usageSessionId, "closed");
    expect(closed.status).toBe(200);
    expect(closed.body).toEqual({ observedMs: 0, incomplete: false });
    expect((await mint("parent-b")).status).toBe(200);
    expect((await mint("parent-a")).status).toBe(429);
  });

  it("a provider mint failure releases the slice: the next attempt is not punished for a token that never existed", async () => {
    sdk.create.mockImplementationOnce(async () => { throw new Error("provider down"); });
    const failed = await mint("parent-a");
    expect(failed.status).toBe(200);
    expect(failed.body.available).toBe(false);
    expect((await mint("parent-a")).status).toBe(200);
    expect((await mint("parent-b")).status).toBe(200);
    expect((await mint("parent-a")).status).toBe(429);
  });

  it("a reservation-store outage refuses the mint (503) rather than minting an unbudgeted token", async () => {
    const spy = vi.spyOn(budget, "reserve").mockRejectedValueOnce(new Error("firestore unavailable"));
    const res = await mint("parent-a");
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("live_budget_unavailable");
    expect(sdk.create).not.toHaveBeenCalled();
  });
});
