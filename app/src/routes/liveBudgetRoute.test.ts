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
const priorSlice = process.env.LIVE_RESERVATION_MINUTES;

beforeAll(async () => {
  // Local config is unenforced → every parent resolves to Plus (20 min). Keep
  // the test short: 10 minutes = two 5-minute slices per family-day.
  process.env.LIVE_PAID_MINUTES_PER_DAY = "10";
  // These cases count 5-minute slices; the 60-second default has its own case.
  process.env.LIVE_RESERVATION_MINUTES = "5";
  const config = createTestConfig({ liveEnabled: true });
  const entitlementStore = createEntitlementStore(config);
  const memoryStore = new LocalMemoryStore();
  (memoryStore as any).ensureFamilyForUser = async (uid: string) => ({ familyId: FAMILY_OF[uid] ?? `fam-${uid}` });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { uid: String(req.headers["x-test-uid"] || "parent-a") }; next(); });
  app.use("/api", createApiRouter({
    config, modelProvider: {
      generateJson: async () => ({}),
      // The fallback loop's model: two short sentences (49 characters).
      streamText: async function* () { yield "Try one calm word. "; yield "Then wait a beat."; },
    } as unknown as ModelProvider,
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
  if (priorSlice === undefined) delete process.env.LIVE_RESERVATION_MINUTES; else process.env.LIVE_RESERVATION_MINUTES = priorSlice;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  budget.days.clear();
  sdk.create.mockClear();
  sdk.create.mockImplementation(async () => ({ name: "ephemeral-token-name" }));
});

const mint = async (uid: string, body: Record<string, unknown> = {}) => {
  // B-PROV-12: every mint acknowledges the runtime route's approved notice.
  const res = await fetch(`${base}/api/live/token`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-uid": uid }, body: JSON.stringify({ noticeAck: "google-global-realtime-v1", ...body }) });
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

const voice = async (uid: string, message: string, init: RequestInit = {}) => {
  const res = await fetch(`${base}/api/voice`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-uid": uid },
    body: JSON.stringify({ message, childProfile: { id: "child-1", name: "Synthetic" }, language: "en" }), ...init });
  return { status: res.status, headers: res.headers, text: await res.text() };
};
const settled = () => new Promise((resolve) => setTimeout(resolve, 50));
const familyDay = () => [...budget.days.values()].find((d) => d.familyId === "fam-1");

describe("B-AIOPS-02 — the fallback loop (/api/voice) spends the same family allowance", () => {
  it("a fallback turn is charged the spoken length the server handled, shared with the Live mint", async () => {
    const turn = await voice("parent-a", "How do I calm bedtime?"); // 22 characters
    expect(turn.status).toBe(200);
    expect(turn.headers.get("X-Live-Quota-Limit")).toBe(String(10 * 60));
    await settled();
    const doc = familyDay()!;
    const charged = Object.values(doc.reservations).find((r) => r.kind === "turn")!;
    // (22 + 36 released) characters at 14/s, rounded up = 5 s; never the 30 s reserve.
    expect(charged.settledMs).toBe(Math.ceil(((22 + "Try one calm word. Then wait a beat.".length) / 14) * 1000));
    expect(doc.consumedMs).toBe(charged.settledMs);
  });

  it("once Live has spent the allowance, the fallback turn is a typed 429 live_resting (no Retry-After) and the model is never called", async () => {
    expect((await mint("parent-a")).status).toBe(200);
    expect((await mint("parent-b")).status).toBe(200);
    const refused = await voice("parent-b", "Can we keep talking?");
    expect(refused.status).toBe(429);
    expect(JSON.parse(refused.text)).toMatchObject({ code: LIVE_RESTING, retryable: false });
    expect(refused.headers.get("Retry-After")).toBeNull();
    expect(refused.headers.get("X-Live-Quota-Remaining")).toBe("0");
  });

  it("a crisis turn is never metered and never refused: the resources answer even with the allowance spent", async () => {
    expect((await mint("parent-a")).status).toBe(200);
    expect((await mint("parent-b")).status).toBe(200);
    const crisis = await voice("parent-a", "I want to kill myself");
    expect(crisis.status).toBe(200);
    expect(crisis.text).toContain("event: done");
    expect(crisis.text).toContain("escalation");
    expect(Object.values(familyDay()!.reservations).some((r) => r.kind === "turn")).toBe(false);
  });

  it("a reservation-store outage refuses the fallback turn (503) instead of running an unbudgeted one", async () => {
    const spy = vi.spyOn(budget, "reserveTurn").mockRejectedValueOnce(new Error("firestore unavailable"));
    const res = await voice("parent-a", "Hello?");
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(JSON.parse(res.text).code).toBe("voice_budget_unavailable");
  });
});

describe("B-AIOPS-02 — timeout and caller-gone on the mint", () => {
  it("a provider that never answers is abandoned at the mint deadline and its slice released", async () => {
    process.env.LIVE_MINT_DEADLINE_MS = "100";
    sdk.create.mockImplementationOnce(() => new Promise(() => {}));
    const hung = await mint("parent-a");
    delete process.env.LIVE_MINT_DEADLINE_MS;
    expect(hung.status).toBe(200);
    expect(hung.body.available).toBe(false);
    expect(hung.body.token).toBeUndefined();
    // Nothing was charged: both 5-minute slices are still there.
    expect((await mint("parent-a")).status).toBe(200);
    expect((await mint("parent-b")).status).toBe(200);
    expect((await mint("parent-a")).status).toBe(429);
  });

  it("a caller that hung up before the token arrived never holds it: its slice is released", async () => {
    let deliver: (v: { name: string }) => void = () => {};
    sdk.create.mockImplementationOnce(() => new Promise((resolve) => { deliver = resolve; }));
    const controller = new AbortController();
    const pending = fetch(`${base}/api/live/token`, { method: "POST", headers: { "Content-Type": "application/json", "x-test-uid": "parent-a" }, body: JSON.stringify({ noticeAck: "google-global-realtime-v1" }), signal: controller.signal }).catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 50));
    controller.abort();
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 50));
    deliver({ name: "late-token" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(Object.keys(familyDay()?.reservations ?? {})).toHaveLength(0);
    expect((await mint("parent-a")).status).toBe(200);
    expect((await mint("parent-b")).status).toBe(200);
  });
});

describe("B-AIOPS-02 P1-1 — the default slice is one minute", () => {
  it("a mint reserves 60 s: the token ends a minute out and the response says what the family has left", async () => {
    delete process.env.LIVE_RESERVATION_MINUTES;
    try {
      const before = Date.now();
      const { status, body } = await mint("parent-a");
      expect(status).toBe(200);
      expect(body.budget).toMatchObject({ reservedMs: 60_000, remainingMs: 9 * 60_000 });
      expect(Date.parse(body.expiresAt) - before).toBeLessThanOrEqual(61_000);
      expect(Date.parse(body.expiresAt) - before).toBeGreaterThan(55_000);
    } finally {
      process.env.LIVE_RESERVATION_MINUTES = "5";
    }
  });
});

describe("round 3/4 — renewal at the mint route", () => {
  it("a renewal names the caller's own OPENED usage session; unopened or someone else's is a 409 that reserves and mints nothing", async () => {
    delete process.env.LIVE_RESERVATION_MINUTES;
    try {
      const first = await mint("parent-a");
      expect(first.status).toBe(200);
      expect(first.body.budget.reservedMs).toBe(60_000);
      const created = sdk.create.mock.calls.length;
      const unopened = await mint("parent-a", { renewOf: first.body.usageSessionId });
      expect(unopened.status).toBe(409);
      expect(unopened.body.code).toBe("live_renewal_invalid");
      expect((await report("parent-a", first.body.usageSessionId, "opened")).status).toBe(200);
      const foreign = await mint("parent-b", { renewOf: first.body.usageSessionId });
      expect(foreign.status).toBe(409);
      expect(sdk.create.mock.calls.length).toBe(created);
      const renewed = await mint("parent-a", { renewOf: first.body.usageSessionId });
      expect(renewed.status).toBe(200);
      // Round 4: the renewal is twice the renewed slice (10 paid minutes in
      // this file: 1, then 2 of the remaining 9), chained onto its end.
      expect(renewed.body.budget).toMatchObject({ reservedMs: 2 * 60_000, remainingMs: 7 * 60_000 });
      expect(Date.parse(renewed.body.expiresAt) - Date.parse(first.body.expiresAt)).toBe(2 * 60_000);
      const arg = sdk.create.mock.calls.at(-1)![0] as any;
      expect(arg.config.expireTime).toBe(renewed.body.expiresAt);
    } finally {
      process.env.LIVE_RESERVATION_MINUTES = "5";
    }
  });

  it("round 5: a provider failure on the first renewal releases it; the retry renews the same slice; nothing double-reserved", async () => {
    delete process.env.LIVE_RESERVATION_MINUTES;
    try {
      const first = await mint("parent-a");
      expect(first.status).toBe(200);
      expect((await report("parent-a", first.body.usageSessionId, "opened")).status).toBe(200);
      // The provider answers 503 to the first renewal's mint.
      sdk.create.mockImplementationOnce(async () => { throw Object.assign(new Error("Service Unavailable"), { status: 503 }); });
      const failed = await mint("parent-a", { renewOf: first.body.usageSessionId });
      expect(failed.body.available).toBe(false);
      const retry = await mint("parent-a", { renewOf: first.body.usageSessionId });
      expect(retry.status).toBe(200);
      expect(retry.body.available).toBe(true);
      expect(retry.body.budget).toMatchObject({ reservedMs: 2 * 60_000, remainingMs: 7 * 60_000 });
      expect(Date.parse(retry.body.expiresAt) - Date.parse(first.body.expiresAt)).toBe(2 * 60_000);
      // One first slice and one renewal on the family-day ledger.
      const live = Object.values([...budget.days.values()][0].reservations).filter((r) => r.kind !== "turn");
      expect(live).toHaveLength(2);
      // The renewal that was delivered renews its slice once: a further retry is refused.
      const third = await mint("parent-a", { renewOf: first.body.usageSessionId });
      expect(third.status).toBe(409);
    } finally {
      process.env.LIVE_RESERVATION_MINUTES = "5";
    }
  });

  it("round 4: a CLOSED usage session is no renewal: 409, nothing reserved or minted", async () => {
    delete process.env.LIVE_RESERVATION_MINUTES;
    try {
      const first = await mint("parent-a");
      expect(first.status).toBe(200);
      expect((await report("parent-a", first.body.usageSessionId, "opened")).status).toBe(200);
      expect((await report("parent-a", first.body.usageSessionId, "closed")).status).toBe(200);
      const created = sdk.create.mock.calls.length;
      const closed = await mint("parent-a", { renewOf: first.body.usageSessionId });
      expect(closed.status).toBe(409);
      expect(closed.body.code).toBe("live_renewal_invalid");
      expect(sdk.create.mock.calls.length).toBe(created);
      // Nothing was reserved: the family still has all but the first minute.
      const next = await mint("parent-a");
      expect(next.body.budget.remainingMs).toBe(8 * 60_000);
    } finally {
      process.env.LIVE_RESERVATION_MINUTES = "5";
    }
  });
});
