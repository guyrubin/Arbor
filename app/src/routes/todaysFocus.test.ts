/**
 * AIR-5 — /api/todays-focus route tests against the REAL handler with a
 * stubbed model provider.
 *
 * The Today card used to POST /api/chat (the heaviest route in the app) and
 * silently burn the free plan's daily coach meter on an ambient card. The
 * dedicated lightweight endpoint must:
 *  - run the analysis route with the 2-field schema and NON_DIAGNOSTIC_CONTRACT,
 *  - pass its output through screenModelOutput BEFORE returning (firewall
 *    condition 1 — never the first unscreened parent-facing generative surface),
 *  - cache per user+child per day, serving ONLY screened payloads (condition 4),
 *  - keep verdict primitives (avg intensity / milestone %) out of the prompt,
 *  - sit inside the hourly AI quota but OUTSIDE the coach meter (source-pinned
 *    against createApp.ts below).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import * as fs from "node:fs";
import * as path from "node:path";
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
import type { ModelProvider } from "../ai/modelRouter.js";

let lastPrompt = "";
let providerCalls = 0;
let draft: Record<string, unknown> = {};

const stubModelProvider = {
  generateJson: async ({ prompt }: { prompt: string }) => {
    lastPrompt = prompt;
    providerCalls += 1;
    return draft;
  },
  async *streamText() {
    yield "";
  },
  async *generateJsonStream() {
    yield "{}";
  },
} as unknown as ModelProvider;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const config = createTestConfig();
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
    }),
  );
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

const postFocus = async (body: unknown) => {
  const res = await fetch(`${baseUrl}/api/todays-focus`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, json: (await res.json()) as Record<string, unknown> };
};

const CLEAN_DRAFT = {
  focus: "Mornings have been busiest around transitions this week.",
  tryToday: "Try a two-minute warning before leaving the house today.",
};

describe("/api/todays-focus happy path (AIR-5)", () => {
  it("returns the screened 2-field focus with a dateKey", async () => {
    draft = { ...CLEAN_DRAFT };
    const { status, json } = await postFocus({
      childProfile: { id: "c-happy", name: "Test Child", age: 4 },
      signals: { count: 4, topTrigger: "transitions" },
    });
    expect(status).toBe(200);
    expect(json.focus).toContain("transitions");
    expect(json.tryToday).toContain("two-minute warning");
    expect(String(json.text)).toContain("transitions");
    expect(json.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("embeds NON_DIAGNOSTIC_CONTRACT and the flat signals — never verdict primitives", async () => {
    draft = { ...CLEAN_DRAFT };
    lastPrompt = "";
    await postFocus({
      childProfile: { id: "c-prompt", name: "Test Child", age: 4 },
      signals: { count: 7, topTrigger: "bedtime", avg: 4.2, milestonesPercent: 63 },
    });
    expect(lastPrompt).toContain("Never diagnose");
    expect(lastPrompt).toContain("7 moments");
    expect(lastPrompt).toContain('"bedtime"');
    // Wave-3 clinical subtraction stays pinned server-side: intensity averages
    // and milestone percentages never reach the model even when a client sends them.
    expect(lastPrompt).not.toContain("4.2");
    expect(lastPrompt).not.toContain("63");
    expect(lastPrompt).not.toMatch(/average intensity/i);
    expect(lastPrompt).not.toMatch(/milestone readiness/i);
  });

  it("carries the Hebrew directive for language:'he'", async () => {
    draft = { focus: "הבקרים היו עמוסים סביב מעברים השבוע.", tryToday: "נסו התראה של שתי דקות לפני יציאה." };
    lastPrompt = "";
    const { status, json } = await postFocus({
      childProfile: { id: "c-he", name: "Test Child", age: 4 },
      signals: { count: 2, topTrigger: "מעברים" },
      language: "he",
    });
    expect(status).toBe(200);
    expect(lastPrompt).toContain("עברית");
    expect(String(json.text)).toContain("מעברים");
  });
});

describe("/api/todays-focus output screen (AIR-5 firewall condition 1)", () => {
  it("a diagnostic draft is blocked with 422 and the text never reaches the response", async () => {
    draft = {
      focus: "Your child has autism and this explains the week.",
      tryToday: "Start a treatment plan.",
    };
    const { status, json } = await postFocus({
      childProfile: { id: "c-flagged", name: "Test Child", age: 4 },
      signals: { count: 3, topTrigger: "transitions" },
    });
    expect(status).toBe(422);
    expect(JSON.stringify(json)).not.toContain("autism");
    expect(json.text).toBeUndefined();
  });

  it("a flagged draft is never cached — the next call re-generates", async () => {
    draft = { ...CLEAN_DRAFT };
    providerCalls = 0;
    const { status } = await postFocus({
      childProfile: { id: "c-flagged", name: "Test Child", age: 4 },
      signals: { count: 3, topTrigger: "transitions" },
    });
    expect(status).toBe(200);
    expect(providerCalls).toBe(1);
  });
});

describe("/api/todays-focus daily cache (AIR-5 firewall condition 4)", () => {
  it("second call same user+child+day serves the cached screened payload without a model call", async () => {
    draft = { ...CLEAN_DRAFT };
    providerCalls = 0;
    const first = await postFocus({
      childProfile: { id: "c-cache", name: "Test Child", age: 4 },
      signals: { count: 5, topTrigger: "transitions" },
    });
    const second = await postFocus({
      childProfile: { id: "c-cache", name: "Test Child", age: 4 },
      signals: { count: 5, topTrigger: "transitions" },
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(providerCalls).toBe(1);
    expect(second.json.text).toEqual(first.json.text);
  });

  it("a different child misses the cache", async () => {
    draft = { ...CLEAN_DRAFT };
    providerCalls = 0;
    await postFocus({ childProfile: { id: "c-cache-a", name: "A" }, signals: { count: 1 } });
    await postFocus({ childProfile: { id: "c-cache-b", name: "B" }, signals: { count: 1 } });
    expect(providerCalls).toBe(2);
  });
});

describe("createApp wiring (AIR-5/AIR-6 metering, source-pinned)", () => {
  const createAppSrc = fs.readFileSync(path.resolve(__dirname, "../server/createApp.ts"), "utf8");
  const quotaBlock = /app\.use\(\s*\[[\s\S]*?\],\s*createAiQuota\(counters\)\s*\);/.exec(createAppSrc)?.[0] ?? "";

  it("/api/todays-focus sits INSIDE the hourly AI quota", () => {
    expect(quotaBlock).toContain('"/api/todays-focus"');
  });

  it("/api/todays-focus never touches the coach meter (X-Coach-Remaining unaffected)", () => {
    const gateLine = /app\.use\(\s*\[[^\]]*\],\s*createCoachGate\([\s\S]*?\)\);/.exec(createAppSrc)?.[0] ?? "";
    expect(gateLine).toContain('"/api/chat"');
    expect(gateLine).toContain('"/api/council"');
    expect(gateLine).not.toContain("todays-focus");
  });

  it("/api/tts left the model-call quota for its own char meter (AIR-6)", () => {
    expect(quotaBlock).not.toContain('"/api/tts"');
    expect(createAppSrc).toContain('app.use("/api/tts", createTtsQuota(counters))');
  });
});
