/**
 * B-ASKJB-25 — "Find the pattern" and plan generation answer in the family's
 * language; `intensityTrend` stays out of the schema. Real handlers, stubbed
 * model (the provider answers in Hebrew only when the prompt asks for it).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApiRouter } from "./api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import type { MemoryStore } from "../memory/types.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "../server/quotaStore.js";
import { createEntitlementStore } from "../server/entitlements.js";
import { createReferralStore } from "../server/referral.js";
import { createConsultStore } from "../server/consultRequests.js";
import { createAdminMetricsStore } from "../server/adminMetrics.js";
import { createWaitlistStore } from "../server/waitlist.js";
import { PROMPT_VERSIONS, buildGeneratePlanPrompt, jsonLanguageDirective } from "../ai/prompts.js";

const seen: { plan?: string; analyze?: string; analyzeSchema?: unknown; planVersion?: string } = {};
const provider = {
  generateJson: async ({ prompt, schema, promptVersion }: { prompt: string; schema?: unknown; promptVersion?: string }) => {
    const he = prompt.includes("עברית");
    if (prompt.includes("Generate a structured, non-diagnostic Arbor action plan")) {
      seen.plan = prompt;
      seen.planVersion = promptVersion;
      return he
        ? { title: "מעברים רגועים", issue: "מעברים", phases: [{ name: "שבוע ראשון", description: "התראה רכה", steps: [{ text: "התראה של שתי דקות" }] }], scripts: [], successIndicators: ["פחות בכי במעברים"] }
        : { title: "Calmer transitions", issue: "Transitions", phases: [{ name: "Week one", description: "Soft heads-up", steps: [{ text: "Two-minute warning" }] }], scripts: [], successIndicators: ["Fewer tears at transitions"] };
    }
    if (prompt.includes("Analyze Arbor parent-logged observations")) {
      seen.analyze = prompt;
      seen.analyzeSchema = schema;
      return {
        frequencyCount: {}, triggerBreakdown: [],
        expertInsights: [{ heading: he ? "מה רואים" : "What we see", text: he ? "ערבים קשים יותר." : "Evenings are harder." }],
        actionPlanSuggestion: he ? "נסו התראה רכה." : "Try a soft heads-up.",
      };
    }
    return { safe: true, reason: "" };
  },
  async *generateJsonStream() { yield "{}"; },
  async *streamText() { yield ""; },
} as unknown as ModelProvider;

const store: MemoryStore = { listEvents: async () => [], appendEvent: async () => {}, eraseChild: async () => 0 };

let server: Server;
let base: string;
beforeAll(async () => {
  const config = createTestConfig();
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { uid: "parent-a" }; next(); });
  app.use("/api", createApiRouter({
    config, modelProvider: provider, memoryStore: store, shareStore: new LocalShareStore(),
    consentStore: new LocalConsentStore(), framework: loadFramework(), entitlementStore,
    referralStore: createReferralStore(config, entitlementStore), counters: createCounterStore(config),
    consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config), waitlistStore: createWaitlistStore(config),
    companionLedgerSource: { load: async () => ({ actionLoops: [], insights: [] }) },
  }));
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = (route: string, body: unknown) =>
  fetch(`${base}${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const HEBREW = /[֐-׿]/;
const LATIN_WORD = /[A-Za-z]{2,}/;

describe("B-ASKJB-25 — the plan builder carries the shared language directive", () => {
  it("language 'he' renders the HE directive; EN/absent stays byte-identical to 1.0.0", () => {
    const args = { developmentalFramework: "FW", childProfile: { age: 4 }, challengeTopic: "transitions" };
    const he = buildGeneratePlanPrompt({ ...args, languageDirective: jsonLanguageDirective("he") });
    expect(he).toContain("עברית");
    // 1.3.0 (B-ASKJB-35 a): the return line closes on the successIndicators rule, then the directive.
    expect(he.trimEnd().endsWith("never shown as a list of things to watch the child for." + jsonLanguageDirective("he"))).toBe(true);
    expect(buildGeneratePlanPrompt({ ...args, languageDirective: jsonLanguageDirective("en") })).toBe(buildGeneratePlanPrompt(args));
    expect(jsonLanguageDirective(undefined)).toBe("");
  });

  it("generate_plan is versioned past 1.0.0 (the directive changed the template)", () => {
    // 1.1.0 (B-ASKJB-25) → 1.2.0 (B-ASKJB-27: the record blocks; planPrompt.test.ts)
    // → 1.3.0 (B-ASKJB-35 a: the step rules).
    expect(PROMPT_VERSIONS.generate_plan.version).toBe("1.3.0");
  });
});

describe("B-ASKJB-25 — /generate-plan answers in the family's language", () => {
  it("a HE request carries the HE directive and the plan renders Hebrew titles", async () => {
    const res = await post("/generate-plan", { challengeTopic: "מעברים", childProfile: { id: "child-a", age: 4 }, language: "he" });
    expect(res.status).toBe(200);
    const plan = await res.json();
    expect(seen.plan).toContain(jsonLanguageDirective("he"));
    expect(seen.planVersion).toBe(PROMPT_VERSIONS.generate_plan.version);
    for (const text of [plan.title, plan.issue, ...plan.phases.map((p: { name: string }) => p.name), ...plan.successIndicators]) {
      expect(text).toMatch(HEBREW);
      expect(text).not.toMatch(LATIN_WORD);
    }
  });

  it("an EN request carries no directive", async () => {
    const res = await post("/generate-plan", { challengeTopic: "transitions", childProfile: { id: "child-a", age: 4 }, language: "en" });
    expect(res.status).toBe(200);
    expect(seen.plan).not.toContain("עברית");
  });
});

describe("B-ASKJB-25 — /analyze-behavior: language in, intensityTrend out", () => {
  const logs = [{ id: "l1", behaviorType: "Tantrum", trigger: "transitions", timestamp: new Date().toISOString(), intensity: 3 }];
  it("a HE request carries the same directive and returns HE insights", async () => {
    const res = await post("/analyze-behavior", { logs, childProfile: { id: "child-a", age: 4 }, language: "he" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(seen.analyze).toContain(jsonLanguageDirective("he"));
    expect(body.expertInsights[0].heading).toMatch(HEBREW);
  });

  it("the schema neither requires nor declares intensityTrend; the prompt never names it", () => {
    const schema = seen.analyzeSchema as { required: string[]; properties: Record<string, unknown> };
    expect(schema.required).not.toContain("intensityTrend");
    expect(Object.keys(schema.properties)).not.toContain("intensityTrend");
    expect(seen.analyze).not.toContain("intensityTrend");
  });

  it("the client sends language on both calls and the analysis type has no trend field", () => {
    const src = path.resolve(__dirname, "..");
    const api = readFileSync(path.join(src, "lib/api.ts"), "utf8");
    for (const route of ["/api/generate-plan", "/api/analyze-behavior"]) {
      const at = api.indexOf(`"${route}"`);
      expect(at, route).toBeGreaterThan(-1);
      expect(api.slice(at, at + 160), route).toContain("language: getAiLanguage()");
    }
    const types = readFileSync(path.join(src, "types.ts"), "utf8");
    const analysis = types.slice(types.indexOf("export interface BehaviorAnalysis"));
    expect(analysis.slice(0, analysis.indexOf("\n}"))).not.toMatch(/^\s*intensityTrend\??:/m);
  });
});
