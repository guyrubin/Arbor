/**
 * B-AIOPS-07 — book, image, game and guide routes on the real handlers.
 *
 * This is a local measurement of the route machinery (mock provider, no
 * outbound model call). It is not a Vertex latency sample. List-price cost
 * uses the dated price table for one useful result at the token counts below.
 * Provider-bill match stays with B-AIOPS-01.
 */
// Plus image allowance is 3/day. Raise it before the quota module loads so the
// sample can be n=20. These are list-price and route measurements, not a bill.
process.env.IMAGE_PLUS_PER_DAY = "1000";
process.env.IMAGE_PLUS_PER_MONTH = "1000";
process.env.IMAGE_PLUS_HERO_PER_30D = "1000";
process.env.IMAGE_GEN_GLOBAL_DAILY_LIMIT = "1000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
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
import { estimateCostUsd } from "../ai/priceTable.js";
import type { ModelCallBudget, ModelProvider } from "../ai/modelRouter.js";

const SAMPLES = 20;
const CRISIS = "My child says he wants to die";
/** List-price assumption for one useful text result (prompt + answer). */
const TEXT_USAGE = { promptTokens: 800, outputTokens: 400, totalTokens: 1200 };
/** 1,290 image-output tokens is the model-facts "about $0.039" 1024 image, plus a short prompt. */
const IMAGE_USAGE = { promptTokens: 200, outputTokens: 1290, totalTokens: 1490 };

type Kind = "book" | "image" | "game" | "guide";
type RouteCase = {
  family: Kind;
  name: string;
  path: string;
  body: Record<string, unknown>;
  model: "creative_low_risk" | "analysis_structured" | "image";
  ok: (payload: unknown) => boolean;
};

const child = { id: "c1", name: "Sam", age: 5 };
const hero = {
  scenes: [{ beatId: "call", title: "A walk", narration: "Sam walked up the hill.", imagePrompt: "the hero on a hill", sfx: ["step"], dialogue: "On we go" }],
  choices: [{ id: "a", label: "I walk on", consequence: "Sam keeps going" }],
  reflection: { practiced: ["keeping on"], questions: ["What did Sam try?"] },
};
const bedtime = { title: "The tower", pages: ["Sam built a tall tower."], illustrationPrompt: "blocks on a table", discussionQuestions: ["What did you build?"], summary: "Sam built a tower and put the blocks away." };
const adventure = {
  title: "Blocks", emoji: "🧭", intro: "Sam plays with blocks.",
  scenes: [{ prompt: "Which block is next?", skill: "sequencing", choices: [
    { text: "The blue one", emoji: "•", correct: true, feedback: "That one fits." },
    { text: "The red one", emoji: "•", correct: false, feedback: "Look again." },
    { text: "The green one", emoji: "•", correct: false, feedback: "Try the next one." },
  ] }],
};
const explain = { explanation: "Taking turns is something children practice together.", tryToday: "Say: your turn, then my turn." };

const ROUTES: RouteCase[] = [
  { family: "book", name: "hero journey", path: "/generate-hero-journey", body: { storyId: "david-and-goliath", childName: "Sam", age: 6, language: "en" }, model: "creative_low_risk", ok: (p) => typeof (p as { storyId?: string }).storyId === "string" },
  { family: "book", name: "bedtime story", path: "/generate-bedtime-story", body: { childName: "Sam", age: 4, language: "en", dayEvents: [{ description: "Built a tall block tower", tone: "positive" }] }, model: "creative_low_risk", ok: (p) => Array.isArray((p as { pages?: unknown }).pages) },
  { family: "image", name: "scene", path: "/generate-scene", body: { imagePrompt: "A friendly playroom with blocks" }, model: "image", ok: (p) => String((p as { dataUrl?: string }).dataUrl || "").startsWith("data:image/") },
  { family: "image", name: "comic", path: "/generate-comic", body: { theme: "Sharing blocks", style: "comichero" }, model: "image", ok: (p) => String((p as { dataUrl?: string }).dataUrl || "").startsWith("data:image/") },
  { family: "image", name: "avatar", path: "/generate-avatar", body: { descriptors: { vibe: "cheerful" }, style: "storybook" }, model: "image", ok: (p) => String((p as { dataUrl?: string }).dataUrl || "").startsWith("data:image/") },
  { family: "game", name: "adventure", path: "/generate-adventure", body: { childProfile: child }, model: "creative_low_risk", ok: (p) => Array.isArray((p as { scenes?: unknown }).scenes) && (p as { scenes: unknown[] }).scenes.length > 0 },
  { family: "guide", name: "explain", path: "/explain", body: { subject: "Taking turns", details: "A child learning to share blocks", language: "en", childProfile: child }, model: "analysis_structured", ok: (p) => typeof (p as { explanation?: string }).explanation === "string" && typeof (p as { tryToday?: string }).tryToday === "string" },
];

let mode: "ok" | "hang" | "exhaust" | "boom" = "ok";
let calls = 0;
let lastBudget: ModelCallBudget | undefined;
const models: string[] = [];
// creative_low_risk serves three routes. The test sets `jsonBody` before each request.
let jsonBody: unknown = hero;

const hang = (budget?: ModelCallBudget) => new Promise<never>(() => { lastBudget = budget; });
const stub = {
  generateJson: async (opts: { route?: string; budget?: ModelCallBudget }) => {
    calls += 1;
    models.push(opts.route ?? "missing");
    lastBudget = opts.budget;
    if (mode === "hang") return hang(opts.budget);
    if (mode === "boom") throw new Error("private provider diagnostic");
    return jsonBody;
  },
  generateImage: async (opts: { budget?: ModelCallBudget }) => {
    calls += 1;
    models.push("image");
    lastBudget = opts.budget;
    if (mode === "hang") return hang(opts.budget);
    if (mode === "exhaust") throw new Error("RESOURCE_EXHAUSTED private provider diagnostic");
    return { data: "aGVsbG8=", mimeType: "image/png" };
  },
  async *streamText() {},
  async *generateJsonStream() {},
} as unknown as ModelProvider;

let server: Server;
let baseUrl: string;
const prior: Record<string, string | undefined> = {};
const BUDGET_ENV = ["ARBOR_BUDGET_COACH_MS", "ARBOR_BUDGET_ANALYSIS_MS", "ARBOR_BUDGET_IMAGE_MS"] as const;

beforeAll(async () => {
  for (const key of BUDGET_ENV) prior[key] = process.env[key];
  const { createApiRouter } = await import("./api.js");
  const config = createTestConfig();
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter({
    config,
    modelProvider: stub,
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
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const key of BUDGET_ENV) {
    if (prior[key] === undefined) delete process.env[key];
    else process.env[key] = prior[key];
  }
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

const post = async (path: string, body: unknown, signal?: AbortSignal) => {
  const started = Date.now();
  const res = await fetch(`${baseUrl}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const text = await res.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { status: res.status, ms: Date.now() - started, payload, retryAfter: res.headers.get("retry-after") };
};

/** Nearest-rank percentile. `sorted` must already be ascending. */
const percentile = (sorted: number[], p: number) => {
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
};

describe("B-AIOPS-07 creation routes", () => {
  it("measures success, refusal, deadline, cancel, retry, model and list-price cost", async () => {
    mode = "ok";
    const rows: Record<string, unknown>[] = [];

    for (const route of ROUTES) {
      jsonBody = route.model === "analysis_structured" ? explain : route.name === "bedtime story" ? bedtime : route.name === "adventure" ? adventure : hero;
      const before = calls;
      // Explain caches a repeated subject for the day. Each sample uses a new
      // detail so the times are the handler, not the cache.
      const bodyFor = (i: number) => route.path === "/explain"
        ? { ...route.body, details: `A child learning to share blocks, sample ${i}` }
        : route.body;
      const warm = await post(route.path, bodyFor(0));
      expect(warm.status, `${route.name} warm ${JSON.stringify(warm.payload)}`).toBe(200);
      expect(route.ok(warm.payload), route.name).toBe(true);
      expect(models.at(-1), route.name).toBe(route.model);

      const samples: number[] = [];
      let ok = 0;
      for (let i = 1; i <= SAMPLES; i += 1) {
        const res = await post(route.path, bodyFor(i));
        if (res.status === 200 && route.ok(res.payload)) ok += 1;
        samples.push(res.ms);
      }
      samples.sort((a, b) => a - b);
      const p50 = percentile(samples, 50);
      const p95 = percentile(samples, 95);
      expect(ok, route.name).toBe(SAMPLES);
      expect(p50).toBeLessThanOrEqual(p95);
      expect(p95, route.name).toBeLessThan(5_000);
      const repeatBefore = calls;
      const repeat = await post(route.path, bodyFor(1));
      const repeatCalls = calls - repeatBefore;
      if (route.path === "/explain") expect(repeatCalls, "explain cache").toBe(0);
      expect(repeat.status, route.name).toBe(200);
      rows.push({ family: route.family, name: route.name, samples: SAMPLES, ok, p50, p95, model: route.model, calls: calls - before, repeatCalls });
    }

    const refusals: { name: string; status: number; calls: number }[] = [];
    const refuse = async (name: string, path: string, body: unknown, status: number) => {
      const before = calls;
      const res = await post(path, body);
      expect(res.status, name).toBe(status);
      expect(calls - before, name).toBe(0);
      refusals.push({ name, status, calls: 0 });
    };
    await refuse("hero unknown story", "/generate-hero-journey", { storyId: "no-such-story", childName: "Sam", age: 6, language: "en" }, 404);
    await refuse("bedtime crisis", "/generate-bedtime-story", { childName: "Sam", age: 4, dayEvents: [{ description: CRISIS }] }, 409);
    await refuse("scene crisis", "/generate-scene", { imagePrompt: CRISIS }, 409);
    await refuse("comic crisis", "/generate-comic", { theme: CRISIS, dialogue: CRISIS }, 409);
    await refuse("avatar crisis", "/generate-avatar", { descriptors: { vibe: CRISIS } }, 409);
    await refuse("adventure crisis", "/generate-adventure", { childProfile: { ...child, challenges: [CRISIS] } }, 409);
    await refuse("explain crisis", "/explain", { subject: CRISIS, details: CRISIS, childProfile: child }, 409);
    await refuse("book narration ids only", "/children/sam/book-narration", { bookId: "five-smooth-stones", lang: "en", file: "cover.mp3", name: "Sam" }, 400);

    jsonBody = { ...hero, scenes: [{ ...hero.scenes[0], narration: "Your child has autism." }] };
    const blockedBefore = calls;
    const blocked = await post("/generate-hero-journey", ROUTES[0].body);
    expect(blocked.status).toBe(422);
    expect((blocked.payload as { outputBlocked?: boolean }).outputBlocked).toBe(true);
    expect(JSON.stringify(blocked.payload)).not.toContain("autism");
    expect(calls - blockedBefore).toBe(1);

    for (const key of BUDGET_ENV) process.env[key] = "200";
    mode = "hang";
    const deadlines: { name: string; status: number; ms: number }[] = [];
    for (const route of ROUTES) {
      const body = route.path === "/explain" ? { ...route.body, details: "deadline sample, not cached" } : route.body;
      const res = await post(route.path, body);
      expect(res.status, route.name).toBe(504);
      expect(JSON.stringify(res.payload)).toMatch(/longer than usual/i);
      expect(JSON.stringify(res.payload)).not.toMatch(/abort|RESOURCE_EXHAUSTED|stack/i);
      expect(res.ms, route.name).toBeLessThan(5_000);
      deadlines.push({ name: route.name, status: res.status, ms: res.ms });
    }

    for (const key of BUDGET_ENV) process.env[key] = "60000";
    let cancelled = 0;
    for (const route of ROUTES) {
      lastBudget = undefined;
      const controller = new AbortController();
      const body = route.path === "/explain" ? { ...route.body, details: `cancel sample ${route.name}` } : route.body;
      const pending = post(route.path, body, controller.signal).catch(() => null);
      for (let i = 0; i < 40 && !lastBudget; i += 1) await new Promise((r) => setTimeout(r, 25));
      expect(lastBudget?.signal?.aborted, route.name).toBe(false);
      controller.abort();
      await pending;
      for (let i = 0; i < 40 && !lastBudget!.signal!.aborted; i += 1) await new Promise((r) => setTimeout(r, 25));
      expect(lastBudget!.signal!.aborted, route.name).toBe(true);
      cancelled += 1;
    }

    mode = "boom";
    for (const [name, path, body] of [
      ["adventure", "/generate-adventure", { childProfile: child }],
      ["explain", "/explain", { subject: "Taking turns", details: "provider failure sample", language: "en", childProfile: child }],
    ] as const) {
      const failed = await post(path, body);
      expect(failed.status, name).toBe(500);
      expect(JSON.stringify(failed.payload), name).not.toContain("private provider diagnostic");
    }

    mode = "exhaust";
    const scene = await post("/generate-scene", { imagePrompt: "A friendly playroom with blocks" });
    expect(scene.status).toBe(503);
    expect(scene.retryAfter).toBe("15");
    expect(JSON.stringify(scene.payload)).not.toContain("private provider diagnostic");

    const textCost = estimateCostUsd("gemini-3.5-flash", TEXT_USAGE);
    const imageCost = estimateCostUsd("gemini-2.5-flash-image", IMAGE_USAGE);
    expect(textCost).toBeCloseTo(800 * 1.65 / 1e6 + 400 * 9.9 / 1e6, 6);
    expect(imageCost).toBeCloseTo(200 * 0.3 / 1e6 + 1290 * 30 / 1e6, 6);

    const summary = {
      samples: SAMPLES,
      rows,
      refusals: refusals.length,
      outputBlocked: 1,
      deadlines: deadlines.length,
      cancelled,
      retryableImage: 1,
      listPriceUsdPerUsefulResult: { text: textCost, image: imageCost },
    };
    console.log(`B-AIOPS-07 ${JSON.stringify(summary)}`);
    expect(refusals).toHaveLength(8);
    expect(cancelled).toBe(ROUTES.length);
    expect(deadlines).toHaveLength(ROUTES.length);
  }, 60_000);
});
