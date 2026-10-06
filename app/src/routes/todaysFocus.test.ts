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
let lastSchema: { required?: string[]; properties?: Record<string, unknown> } = {};
let providerCalls = 0;
let draft: Record<string, unknown> = {};

const stubModelProvider = {
  generateJson: async ({ prompt, schema }: { prompt: string; schema?: { required?: string[]; properties?: Record<string, unknown> } }) => {
    lastPrompt = prompt;
    if (schema?.properties && "tryToday" in schema.properties) lastSchema = schema;
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

describe("B-AI-03 · the prompt states only what the parent logged", () => {
  it("count 0, no trigger → no trigger clause, 'no moments logged this week', a starter step, inputsUsed without topTrigger", async () => {
    draft = { focus: "A quiet week to notice what your child enjoys.", tryToday: "Try naming one feeling together at dinner." };
    lastPrompt = "";
    const { status, json } = await postFocus({
      childProfile: { id: "c-ai03-zero", name: "Test Child", age: 3 },
      signals: { count: 0 },
    });
    expect(status).toBe(200);
    expect(lastPrompt).not.toContain("transitions");
    expect(lastPrompt).not.toContain("most often around");
    expect(lastPrompt).toContain("no moments logged this week");
    expect(lastPrompt).toMatch(/age-appropriate starter step/);
    const inputs = json.inputsUsed as Record<string, unknown>;
    expect(inputs.momentCount).toBe(0);
    expect(inputs).not.toHaveProperty("topTrigger");
  });

  it("topTrigger '' with moments → the count only; never the 'transitions' default (B-TODAY-04 acceptance)", async () => {
    draft = { ...CLEAN_DRAFT };
    lastPrompt = "";
    const { json } = await postFocus({
      childProfile: { id: "c-ai03-empty", name: "Test Child", age: 4 },
      signals: { count: 3, topTrigger: "" },
    });
    expect(lastPrompt).toContain("3 moments.");
    expect(lastPrompt).not.toContain("transitions");
    expect(lastPrompt).not.toContain("most often around");
    expect(json.inputsUsed as Record<string, unknown>).not.toHaveProperty("topTrigger");
  });

  it("Hebrew, no trigger → neither 'transitions' nor 'מעברים' in the prompt", async () => {
    draft = { focus: "שבוע שקט.", tryToday: "נסו לקרוא יחד ספר קצר." };
    lastPrompt = "";
    await postFocus({ childProfile: { id: "c-ai03-he", name: "Test Child", age: 4 }, signals: { count: 0 }, language: "he" });
    expect(lastPrompt).toContain("עברית");
    expect(lastPrompt).not.toContain("transitions");
    expect(lastPrompt).not.toContain("מעברים");
  });

  it("a trigger sent with zero moments is not a fact — dropped from prompt and inputsUsed", async () => {
    draft = { ...CLEAN_DRAFT };
    lastPrompt = "";
    const { json } = await postFocus({ childProfile: { id: "c-ai03-orphan", name: "T", age: 4 }, signals: { count: 0, topTrigger: "bedtime" } });
    expect(lastPrompt).not.toContain("bedtime");
    expect(json.inputsUsed as Record<string, unknown>).not.toHaveProperty("topTrigger");
  });
});

/* ── B-TODAY-24: grounded step — sayThis + a truthful why-line input ──────── */
describe("B-TODAY-24 · /todays-focus returns one screened sayThis (≤140) and factCount", () => {
  it("the schema gains an OPTIONAL sayThis; required stays focus + tryToday", async () => {
    draft = { ...CLEAN_DRAFT, sayThis: "Two more minutes, then shoes on together." };
    providerCalls = 0;
    const { status, json } = await postFocus({ childProfile: { id: "c-say-1", name: "T", age: 4 }, signals: { count: 2 } });
    expect(status).toBe(200);
    expect(providerCalls).toBe(1); // model calls per focus unchanged (1)
    expect(Object.keys(lastSchema.properties ?? {})).toEqual(["focus", "tryToday", "sayThis"]);
    expect(lastSchema.required).toEqual(["focus", "tryToday"]);
    expect(json.sayThis).toBe("Two more minutes, then shoes on together.");
    expect(lastPrompt).toContain('"sayThis": ONE short sentence (under 140 characters)');
  });

  it("an over-long sayThis is dropped, never cut", async () => {
    draft = { ...CLEAN_DRAFT, sayThis: "x".repeat(141) };
    const { status, json } = await postFocus({ childProfile: { id: "c-say-2", name: "T", age: 4 }, signals: { count: 2 } });
    expect(status).toBe(200);
    expect(json).not.toHaveProperty("sayThis");
  });

  it("sayThis passes the SAME output screen: a diagnostic line blocks the whole focus (422)", async () => {
    draft = { ...CLEAN_DRAFT, sayThis: "Tell her she has autism and that is why." };
    const { status, json } = await postFocus({ childProfile: { id: "c-say-3", name: "T", age: 4 }, signals: { count: 2 } });
    expect(status).toBe(422);
    expect(JSON.stringify(json)).not.toContain("autism");
  });

  it("factCount is the count of approved facts placed in the context (0 with none)", async () => {
    draft = { ...CLEAN_DRAFT };
    const { json } = await postFocus({ childProfile: { id: "c-say-4", name: "T", age: 4 }, signals: { count: 2 } });
    expect((json.inputsUsed as Record<string, unknown>).factCount).toBe(0);
    const src = fs.readFileSync(path.join(__dirname, "api.ts"), "utf8");
    expect(src).toContain("factCount: approvedFacts.length");
    // The Hebrew directive covers every field now (focus, tryToday, sayThis).
    expect(src).toContain("Write every field in natural, warm Hebrew (עברית).");
  });

  it("today-focus-v1 is authored against this route (the suite's offline gate)", () => {
    const suite = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "evals", "today-focus-v1.eval.json"), "utf8")) as {
      suite: string; promptVersions: Record<string, string>; scenarios: { id: string; route?: string; locale?: string; safetyMustHold?: boolean }[];
    };
    expect(suite.suite).toBe("today-focus-v1");
    expect(suite.promptVersions.todays_focus).toBe("1.2.0");
    const ids = suite.scenarios.map((s) => s.id);
    for (const required of ["cold-start", "approved-fact-used", "not-today-not-repeated", "he-output", "two-child-isolation", "safety-trip-no-score-trend-diagnosis", "saythis-length"]) {
      expect(ids.some((id) => id.startsWith(required)), required).toBe(true);
    }
    for (const sc of suite.scenarios) {
      expect(sc.route).toBe("/api/todays-focus");
      expect(sc.safetyMustHold).toBe(true);
    }
  });
});

/* ── B-TODAY-11: local day accepted ±1 day; rev in the cache key ─────────── */
describe("B-TODAY-11 · /todays-focus dateKey + rev", () => {
  const serverDay = () => new Date().toISOString().slice(0, 10);
  const shift = (days: number) => new Date(Date.parse(`${serverDay()}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

  it("a client local day within ±1 of the server's UTC day is used; anything else falls back", async () => {
    draft = { ...CLEAN_DRAFT };
    const plus = await postFocus({ childProfile: { id: "c-day-1", name: "T", age: 4 }, signals: { count: 1 }, dateKey: shift(1) });
    expect(plus.json.dateKey).toBe(shift(1));
    const minus = await postFocus({ childProfile: { id: "c-day-2", name: "T", age: 4 }, signals: { count: 1 }, dateKey: shift(-1) });
    expect(minus.json.dateKey).toBe(shift(-1));
    const far = await postFocus({ childProfile: { id: "c-day-3", name: "T", age: 4 }, signals: { count: 1 }, dateKey: shift(3) });
    expect(far.json.dateKey).toBe(serverDay());
    const junk = await postFocus({ childProfile: { id: "c-day-4", name: "T", age: 4 }, signals: { count: 1 }, dateKey: "tomorrow" });
    expect(junk.json.dateKey).toBe(serverDay());
  });

  it("rev(count, lastOutcome, latestAt) is in the cache key: nothing new → cache hit; a new capture → one call", async () => {
    draft = { ...CLEAN_DRAFT };
    const body = (latestAt: string, count = 2) => ({ childProfile: { id: "c-rev", name: "T", age: 4 }, signals: { count, latestAt }, dateKey: serverDay() });
    providerCalls = 0;
    await postFocus(body("2026-10-02T06:00:00.000Z"));
    expect(providerCalls).toBe(1);
    await postFocus(body("2026-10-02T06:00:00.000Z"));
    expect(providerCalls).toBe(1); // re-open with nothing new: 0 calls
    await postFocus(body("2026-10-02T09:30:00.000Z", 3));
    expect(providerCalls).toBe(2); // a capture after it: one call
    const src = fs.readFileSync(path.join(__dirname, "api.ts"), "utf8");
    expect(src).toContain("const cacheKey = `${actorOf(req).uid}:${childProfile?.id ?? \"none\"}:${dateKey}:${lang}:${rev}`;");
  });
});
