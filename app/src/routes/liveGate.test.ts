/**
 * live-enablement-gate (VC-7 + AI-V8, 2026-07-25 AI-excellence Wave 1) —
 * route-level tests against the REAL /api/live handlers with a spied SDK.
 *
 * What this pins closed:
 *   - VC-7: Live availability used to be solely `!config.geminiApiKey` — one
 *     env var (set for ANY other reason) away from routing every client's
 *     voice around the screened /voice path. /live/token is now gated on
 *     `config.liveEnabled && config.geminiApiKey`; LIVE_ENABLED defaults to
 *     FALSE and flipping it is the explicit GD-3 Guy gate.
 *   - AI-V8: the availability probe used to POST /live/token, minting (and
 *     discarding) a real single-use ephemeral token per CoachTab mount.
 *     GET /live/availability now answers from config alone — zero SDK calls,
 *     zero network — and the mount probe (CoachTab) uses it.
 *   - FW-NEW-P0: minted tokens pin the server persona + transcription-on into
 *     liveConnectConstraints, so a modified client cannot substitute the
 *     systemInstruction or disable transcription.
 *   - Metering: /api/live/token (and the upcoming /api/live/turn) sit under
 *     the same per-user AI quota as the other paid mints (429 path).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const sdkSpies = vi.hoisted(() => ({
  ctor: vi.fn(),
  create: vi.fn(async (_opts: unknown) => ({ name: "ephemeral-token-name" })),
}));

// Keep the real module (routes/api.ts statically imports `Type` from it) and
// stub ONLY the GoogleGenAI client the /live/token handler dynamically imports.
vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: class {
      authTokens = { create: sdkSpies.create };
      constructor(opts: unknown) {
        sdkSpies.ctor(opts);
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
import type { ModelProvider } from "../ai/modelRouter.js";
import { LIVE_SYSTEM_INSTRUCTION } from "../lib/livePersona.js";

const stubModelProvider = {
  async *streamText() {
    yield "";
  },
  generateJson: async () => ({}),
  async *generateJsonStream() {
    yield "{}";
  },
} as unknown as ModelProvider;

const framework = loadFramework();

function buildApp(config: ArborConfig, pre?: express.RequestHandler[]) {
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  if (pre) for (const mw of pre) app.use(["/api/live/token", "/api/live/turn"], mw);
  app.use(
    "/api",
    createApiRouter({
      config,
      modelProvider: stubModelProvider,
      memoryStore: new LocalMemoryStore(),
      shareStore: new LocalShareStore(),
      consentStore: new LocalConsentStore(),
      framework,
      entitlementStore,
      referralStore: createReferralStore(config, entitlementStore),
      counters: createCounterStore(config),
      consultStore: createConsultStore(config),
      adminMetrics: createAdminMetricsStore(config),
      waitlistStore: createWaitlistStore(config),
    }),
  );
  return app;
}

async function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

const servers: Server[] = [];
// flagOff: LIVE_ENABLED off but the key IS present — the exact VC-7 hazard shape.
let flagOffUrl = "";
// flagOn: both the flag and the key set — the deliberate GD-3-unlocked shape.
let flagOnUrl = "";
// keyless: flag on but no key — still unavailable (fail-closed on both legs).
let keylessUrl = "";

beforeAll(async () => {
  const flagOff = await listen(buildApp(createTestConfig()));
  const flagOn = await listen(buildApp(createTestConfig({ liveEnabled: true })));
  const keyless = await listen(buildApp(createTestConfig({ liveEnabled: true, geminiApiKey: undefined })));
  servers.push(flagOff.server, flagOn.server, keyless.server);
  flagOffUrl = flagOff.baseUrl;
  flagOnUrl = flagOn.baseUrl;
  keylessUrl = keyless.baseUrl;
});

const priorHourlyLimit = process.env.AI_USER_HOURLY_LIMIT;

afterAll(async () => {
  // Restore the env the metering test narrowed (worker processes are reused).
  if (priorHourlyLimit === undefined) delete process.env.AI_USER_HOURLY_LIMIT;
  else process.env.AI_USER_HOURLY_LIMIT = priorHourlyLimit;
  await Promise.all(
    servers.map((s) => new Promise<void>((resolve, reject) => s.close((e) => (e ? reject(e) : resolve())))),
  );
});

beforeEach(() => {
  sdkSpies.ctor.mockClear();
  sdkSpies.create.mockClear();
});

const getAvailability = async (base: string) => {
  const res = await fetch(`${base}/api/live/availability`);
  return { status: res.status, body: (await res.json()) as { available: boolean } };
};

const postToken = async (base: string) => {
  const res = await fetch(`${base}/api/live/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

describe("GET /api/live/availability (AI-V8) — config-only, never the SDK", () => {
  it("returns available:false when the key is present but LIVE_ENABLED is off (VC-7 hazard shape)", async () => {
    const { status, body } = await getAvailability(flagOffUrl);
    expect(status).toBe(200);
    expect(body).toEqual({ available: false });
  });

  it("returns available:false when the flag is on but no key is configured", async () => {
    const { body } = await getAvailability(keylessUrl);
    expect(body).toEqual({ available: false });
  });

  it("returns available:true only when BOTH the flag and the key are set", async () => {
    const { body } = await getAvailability(flagOnUrl);
    expect(body).toEqual({ available: true });
  });

  it("makes zero SDK constructor / authTokens.create calls and answers <50ms (no network)", async () => {
    await getAvailability(flagOnUrl); // warm-up (connection setup off the clock)
    const t0 = performance.now();
    const { body } = await getAvailability(flagOnUrl);
    const elapsed = performance.now() - t0;
    expect(body.available).toBe(true);
    expect(elapsed).toBeLessThan(50);
    expect(sdkSpies.ctor).not.toHaveBeenCalled();
    expect(sdkSpies.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/live/token (VC-7) — gated on liveEnabled && geminiApiKey", () => {
  it("returns available:false WITHOUT minting when the key is present but the flag is off", async () => {
    const { status, body } = await postToken(flagOffUrl);
    expect(status).toBe(200);
    expect(body.available).toBe(false);
    expect(body.token).toBeUndefined();
    expect(sdkSpies.ctor).not.toHaveBeenCalled();
    expect(sdkSpies.create).not.toHaveBeenCalled();
  });

  it("returns available:false without minting when the flag is on but the key is missing", async () => {
    const { body } = await postToken(keylessUrl);
    expect(body.available).toBe(false);
    expect(sdkSpies.create).not.toHaveBeenCalled();
  });

  it("flag-on + key-on mints a single-use token on the configured LIVE_MODEL", async () => {
    const { status, body } = await postToken(flagOnUrl);
    expect(status).toBe(200);
    expect(body.available).toBe(true);
    expect(body.token).toBe("ephemeral-token-name");
    expect(body.model).toBe("gemini-2.0-flash-live-001");
    expect(sdkSpies.create).toHaveBeenCalledTimes(1);
    const arg = sdkSpies.create.mock.calls[0][0] as any;
    expect(arg.config.uses).toBe(1);
    expect(typeof arg.config.expireTime).toBe("string");
  });

  it("FW-NEW-P0: the mint pins the server persona AND transcription-on into liveConnectConstraints", async () => {
    await postToken(flagOnUrl);
    const arg = sdkSpies.create.mock.calls[0][0] as any;
    const constraints = arg.config.liveConnectConstraints;
    expect(constraints.model).toBe("gemini-2.0-flash-live-001");
    // Byte-identical to the shared constant the client also uses — a modified
    // client cannot substitute the persona (the token constraint wins).
    expect(constraints.config.systemInstruction).toBe(LIVE_SYSTEM_INSTRUCTION);
    // Transcription cannot be disabled by the client either.
    expect(constraints.config.inputAudioTranscription).toEqual({});
    expect(constraints.config.outputAudioTranscription).toEqual({});
  });

  it("each voice toggle gets a FRESH token (one mint per POST, no caching)", async () => {
    await postToken(flagOnUrl);
    await postToken(flagOnUrl);
    expect(sdkSpies.create).toHaveBeenCalledTimes(2);
  });
});

describe("/api/live metering (VC-7 condition 4) — same per-user AI quota as other paid mints", () => {
  it("429s the third request when the hourly budget is 2 (Retry-After set)", async () => {
    // Load createAiQuota with a tiny budget the same way aiQuota.test.ts does.
    process.env.AI_USER_HOURLY_LIMIT = "2";
    vi.resetModules();
    const { createAiQuota } = await import("../server/aiQuota.js");
    const { MemoryCounterStore } = await import("../server/quotaStore.js");
    const metered = await listen(
      buildApp(createTestConfig(), [createAiQuota(new MemoryCounterStore())]),
    );
    servers.push(metered.server);

    expect((await postToken(metered.baseUrl)).status).toBe(200);
    expect((await postToken(metered.baseUrl)).status).toBe(200);
    const blocked = await fetch(`${metered.baseUrl}/api/live/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect(((await blocked.json()) as any).error).toMatch(/AI usage limit/i);
  });
});
