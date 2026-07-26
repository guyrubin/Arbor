/**
 * AIR-8 — route tests: /api/tts is a REAL request-time consumer of the boot
 * CapabilityRegistry. With the registry supplied (production wiring via
 * createApp), BOTH branches — the HMAC screened-token skip and the full-screen
 * path — resolve synthesis through registry.get("speech_synthesis",
 * provider).execute, and a registry without the adapter fails CLOSED (503,
 * visible degrade to the browser floor — never a silent direct provider call).
 * The unconditional lexical floor still guards the registry path (422).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
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
import { mintTtsToken } from "../server/ttsToken.js";
import { CapabilityRegistry } from "../ai/capabilities/registry.js";
import type { CapabilityAdapter } from "../ai/capabilities/contracts.js";
import type { TtsInput, TtsResult } from "../server/tts.js";
import type { ModelProvider } from "../ai/modelRouter.js";

const stubModelProvider = {
  generateJson: async () => ({ safe: true, reason: "" }),
} as unknown as ModelProvider;

/** A fake speech_synthesis adapter: proves resolution went THROUGH the registry
 *  (its fixed audio payload can only come from registry dispatch). */
const executeCalls: TtsInput[] = [];
const fakeAdapter: CapabilityAdapter<"speech_synthesis", TtsInput, TtsResult> = {
  capability: "speech_synthesis",
  provider: { provider: "google", model: "cloud-tts-v1", region: "eu" },
  execute: async (input) => {
    executeCalls.push(input);
    return { audio: "UkVHSVNUUlk=", mimeType: "audio/mpeg" };
  },
};

const startServer = async (registry: CapabilityRegistry) => {
  const config = createTestConfig({ ttsProvider: "google" } as any);
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createApiRouter({
      config,
      modelProvider: stubModelProvider,
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
      aiCapabilityRegistry: registry,
    }),
  );
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
};

describe("/api/tts resolves through the CapabilityRegistry (AIR-8)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const registry = new CapabilityRegistry();
    registry.register(fakeAdapter);
    ({ server, baseUrl } = await startServer(registry));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  });

  beforeEach(() => {
    executeCalls.length = 0;
  });

  it("full-screen path: synthesis is produced by registry.get(...).execute, not a direct provider call", async () => {
    const res = await fetch(`${baseUrl}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Take a slow breath together.", language: "en" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ audio: "UkVHSVNUUlk=", mimeType: "audio/mpeg" });
    expect(executeCalls).toEqual([{ text: "Take a slow breath together.", lang: "en" }]);
  });

  it("HMAC screened-token path also dispatches through the registry", async () => {
    const text = "Name the feeling out loud together.";
    const res = await fetch(`${baseUrl}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: "en", screenedToken: mintTtsToken(text, "en") }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).audio).toBe("UkVHSVNUUlk=");
    expect(executeCalls).toHaveLength(1);
  });

  it("route-level lexical floor still blocks unsafe text before the registry is reached (422)", async () => {
    const res = await fetch(`${baseUrl}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Your child has autism and needs treatment.", language: "en" }),
    });
    expect(res.status).toBe(422);
    expect(executeCalls).toHaveLength(0);
  });
});

describe("/api/tts fails CLOSED when the registry lacks the speech_synthesis adapter (AIR-8)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Registry present but EMPTY — not_configured must surface as a visible
    // 503 degrade, never a silent fallback to the direct provider path.
    ({ server, baseUrl } = await startServer(new CapabilityRegistry()));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  });

  it("returns 503 configured:false on both branches", async () => {
    const text = "Take a slow breath together.";
    const plain = await fetch(`${baseUrl}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: "en" }),
    });
    expect(plain.status).toBe(503);
    expect(await plain.json()).toEqual({ configured: false });

    const tokened = await fetch(`${baseUrl}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: "en", screenedToken: mintTtsToken(text, "en") }),
    });
    expect(tokened.status).toBe(503);
    expect(await tokened.json()).toEqual({ configured: false });
  });
});
