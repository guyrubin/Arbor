/**
 * B-PROV-01 — the realtime path goes through the provider policy.
 *
 * Production pins every AI route to region "eu". Live minted on the GLOBAL AI
 * Studio endpoint without asking. Now the current path is an honest
 * `region: "global"` candidate that production admits only under the dated
 * exception (LIVE_GLOBAL_EXCEPTION_UNTIL), and the Vertex `eu` attempt sits
 * behind LIVE_VERTEX_EU. Driven against the REAL router with a stubbed SDK.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const sdk = vi.hoisted(() => ({
  ctor: vi.fn(),
  create: vi.fn(async (_opts: unknown) => ({ name: "ephemeral-token-name" })),
}));
vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: class {
      authTokens = { create: sdk.create };
      constructor(opts: unknown) {
        sdk.ctor(opts);
      }
    },
  };
});

import { createApiRouter } from "./api.js";
import { createTestConfig } from "../testConfig.js";
import type { ArborConfig } from "../config/env.js";
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
import { logger } from "../server/logger.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import { LIVE_GLOBAL_EXCEPTION_UNTIL, liveExceptionFromEnv } from "../ai/liveResidency.js";

const servers: Server[] = [];
afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise<void>((res, rej) => s.close((e) => (e ? rej(e) : res())))));
});
beforeEach(() => {
  sdk.ctor.mockClear();
  sdk.create.mockClear();
  sdk.create.mockImplementation(async () => ({ name: "ephemeral-token-name" }));
});

const DAY = 86_400_000;
const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

async function serve(over: Partial<ArborConfig>): Promise<string> {
  const config = createTestConfig({ arborEnv: "prod", liveEnabled: true, geminiApiKey: "test-key", ...over });
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter({
    config,
    modelProvider: { generateJson: async () => ({}) } as unknown as ModelProvider,
    memoryStore: new LocalMemoryStore(),
    shareStore: new LocalShareStore(),
    consentStore: new LocalConsentStore(),
    framework: loadFramework(),
    entitlementStore,
    referralStore: createReferralStore(config, entitlementStore),
    counters: createCounterStore(config),
    consultStore: createConsultStore(config),
    adminMetrics: createAdminMetricsStore(config),
    waitlistStore: createWaitlistStore(config),
  }));
  const server = await new Promise<Server>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const availability = async (base: string) => (await fetch(`${base}/api/live/availability`)).json() as Promise<Record<string, unknown>>;
const token = async (base: string) => {
  const res = await fetch(`${base}/api/live/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

describe("B-PROV-01 · production Live under the dated residency exception", () => {
  it("prod with no exception → /live/availability false, /live/token 503, nothing minted", async () => {
    const base = await serve({ liveGlobalExceptionUntil: undefined });
    expect(await availability(base)).toEqual({ available: false });
    const { status, body } = await token(base);
    expect(status).toBe(503);
    expect(body).toMatchObject({ available: false, code: "live_residency_denied" });
    expect(sdk.ctor).not.toHaveBeenCalled();
    expect(sdk.create).not.toHaveBeenCalled();
  });

  it("prod with a future exception → mints on the global key, availability carries exceptionUntil, the decision is logged", async () => {
    const until = isoDay(30);
    const base = await serve({ liveGlobalExceptionUntil: until });
    expect(await availability(base)).toEqual({ available: true, exceptionUntil: until });
    const info = vi.spyOn(logger, "info");
    const { status, body } = await token(base);
    expect(status).toBe(200);
    expect(body.available).toBe(true);
    expect(body.token).toBe("ephemeral-token-name");
    expect(sdk.ctor).toHaveBeenCalledWith({ apiKey: "test-key" });
    const logged = info.mock.calls.find(([msg]) => msg === "Live provider decision");
    expect(logged?.[1]).toMatchObject({ region: "global", exception_until: until });
    info.mockRestore();
  });

  it("after the date (clock fixture: exception ended yesterday) → denied and exceptionUntil absent", async () => {
    const base = await serve({ liveGlobalExceptionUntil: isoDay(-1) });
    const avail = await availability(base);
    expect(avail).toEqual({ available: false });
    expect(avail).not.toHaveProperty("exceptionUntil");
    expect((await token(base)).status).toBe(503);
    expect(sdk.create).not.toHaveBeenCalled();
  });

  it("the exception's last day still admits (end of day, UTC)", async () => {
    const base = await serve({ liveGlobalExceptionUntil: isoDay(0) });
    expect((await availability(base)).available).toBe(true);
  });
});

describe("B-PROV-01 · the Vertex `eu` attempt (LIVE_VERTEX_EU)", () => {
  it("EU path on: available after the exception, no exceptionUntil, mints on Vertex europe-west4 — never the global key", async () => {
    const base = await serve({ liveGlobalExceptionUntil: isoDay(-1), liveVertexEu: true, liveVertexLocation: "europe-west4", gcpProjectId: "arbor-prod" });
    expect(await availability(base)).toEqual({ available: true });
    const { status } = await token(base);
    expect(status).toBe(200);
    expect(sdk.ctor).toHaveBeenCalledWith({ vertexai: true, project: "arbor-prod", location: "europe-west4" });
    expect(sdk.ctor).not.toHaveBeenCalledWith({ apiKey: "test-key" });
  });

  it("EU path outranks the global one even while the exception runs", async () => {
    const base = await serve({ liveGlobalExceptionUntil: isoDay(30), liveVertexEu: true, gcpProjectId: "arbor-prod" });
    expect(await availability(base)).toEqual({ available: true });
    await token(base);
    expect(sdk.ctor).toHaveBeenCalledWith(expect.objectContaining({ vertexai: true }));
  });

  it("a failed EU mint is a 503 (browser fallback), never a silent hop to global", async () => {
    sdk.create.mockImplementation(async () => { throw new Error("Ephemeral auth tokens is only supported in the Gemini Developer API."); });
    const base = await serve({ liveGlobalExceptionUntil: isoDay(30), liveVertexEu: true, gcpProjectId: "arbor-prod" });
    const { status, body } = await token(base);
    expect(status).toBe(503);
    expect(body).toMatchObject({ available: false, code: "live_eu_unavailable" });
    expect(sdk.ctor).toHaveBeenCalledTimes(1);
  });
});

describe("B-PROV-01 · the env contract", () => {
  it("unset → the program's dated default; off → none; garbage → none (fail closed)", () => {
    expect(LIVE_GLOBAL_EXCEPTION_UNTIL).toBe("2026-10-31");
    expect(liveExceptionFromEnv(undefined)).toBe("2026-10-31");
    expect(liveExceptionFromEnv("2026-11-15")).toBe("2026-11-15");
    expect(liveExceptionFromEnv("off")).toBeUndefined();
    expect(liveExceptionFromEnv("")).toBeUndefined();
    expect(liveExceptionFromEnv("next month")).toBeUndefined();
  });

  it("non-prod still answers available without an exception date (dev key is global by policy)", async () => {
    const base = await serve({ arborEnv: "local", liveGlobalExceptionUntil: undefined });
    expect(await availability(base)).toEqual({ available: true });
  });
});
