/**
 * B-AI-02 — /analyze-behavior gains `language`, loses `intensityTrend`, and
 * reads the parent's recent steps; /generate-plan and /digest ground in
 * CompanionContext. Real handlers, stubbed model, injected ledger.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApiRouter } from "./api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import type { MemoryLedgerEvent, MemoryStore } from "../memory/types.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "../server/quotaStore.js";
import { createEntitlementStore } from "../server/entitlements.js";
import { createReferralStore } from "../server/referral.js";
import { createConsultStore } from "../server/consultRequests.js";
import { createAdminMetricsStore } from "../server/adminMetrics.js";
import { createWaitlistStore } from "../server/waitlist.js";
import type { CompanionLedgerSource } from "../server/companionContext.js";
import { NON_DIAGNOSTIC_CONTRACT } from "../contracts/coach.js";
import { buildDigestPrompt, computeWeeklyDigestStats } from "../server/digest.js";
import { buildAnalyzeBehaviorPrompt, buildGeneratePlanPrompt } from "../ai/prompts.js";

const prompts: Record<string, string> = {};
const provider = {
  generateJson: async ({ prompt }: { prompt: string }) => {
    if (prompt.includes("Analyze Arbor parent-logged observations")) {
      prompts.analyze = prompt;
      const he = prompt.includes("עברית");
      return {
        frequencyCount: { tantrum: 2 },
        intensityTrend: "rising",
        triggerBreakdown: [{ trigger: "transitions", percentage: 100 }],
        expertInsights: [{ heading: he ? "מה רואים" : "What we see", text: he ? "מעברים קשים יותר בערב." : "Evenings carry the transitions." }],
        actionPlanSuggestion: he ? "נסו התראה רכה." : "Try a soft heads-up.",
      };
    }
    if (prompt.includes("Generate a structured, non-diagnostic Arbor action plan")) {
      prompts.plan = prompt;
      return { title: "Plan", issue: "Transitions", phases: [], scripts: [], successIndicators: [] };
    }
    if (prompt.includes("WEEKLY DIGEST")) {
      prompts.digest = prompt;
      return { title: "t", subject: "s", preheader: "p", summary: "s", highlights: ["h"], watchFor: [], tryThisWeek: "Try naming the feeling first." };
    }
    return { safe: true, reason: "" };
  },
  async *generateJsonStream() { yield "{}"; },
  async *streamText() { yield ""; },
} as unknown as ModelProvider;

const now = Date.now();
const fact: MemoryLedgerEvent = {
  eventId: "e1", memoryId: "m1", familyId: "f", childId: "child-a", fact: "Transitions go better with a visual timer",
  status: "approved", eventType: "approved", createdAt: new Date(now - 86_400_000).toISOString(), source: "parent", retention: "3 months", actor: "parent",
};
const store: MemoryStore = { listEvents: async () => [fact], appendEvent: async () => {}, eraseChild: async () => 0 };
const ledger: CompanionLedgerSource = {
  load: async (uid, childId) => (uid === "parent-a" && childId === "child-a"
    ? { actionLoops: [{ recommendation: "2-minute warning before leaving", source: "digest", status: "completed", outcome: "not_today", acceptedAt: new Date(now - 2 * 86_400_000).toISOString() }], insights: [] }
    : { actionLoops: [], insights: [] }),
};

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
    companionLedgerSource: ledger,
  }));
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = (route: string, body: unknown) =>
  fetch(`${base}${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const logs = [{ id: "l1", behaviorType: "Tantrum", trigger: "transitions", timestamp: new Date(now - 3_600_000).toISOString(), intensity: 3 }];

describe("B-AI-02 — /analyze-behavior", () => {
  it("a HE request carries the Hebrew directive and returns HE expertInsights", async () => {
    const res = await post("/analyze-behavior", { logs, childProfile: { id: "child-a", age: 4 }, language: "he" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(prompts.analyze).toContain("עברית");
    expect(body.expertInsights[0].heading).toBe("מה רואים");
  });

  it("no intensityTrend in the prompt or the response (even when the model emits it)", async () => {
    const res = await post("/analyze-behavior", { logs, childProfile: { id: "child-a", age: 4 }, language: "en" });
    const body = await res.json();
    expect(prompts.analyze).not.toContain("intensityTrend");
    expect(body).not.toHaveProperty("intensityTrend");
    expect(prompts.analyze).not.toContain("עברית");
  });

  it("carries the parent's recent steps from the server ledger", () => {
    expect(prompts.analyze).toContain('- "2-minute warning before leaving" (parent reported: not today)');
  });
});

describe("B-AI-13 — /analyze-behavior returns counts only and never forwards notes", () => {
  // 7 logs: 4 Tantrum (3 transitions, 1 bedtime), 2 Hitting (transitions), 1 Moment (no trigger).
  const seven = [
    { behaviorType: "Tantrum", trigger: "transitions", notes: "NOTE-SENTINEL-1" },
    { behaviorType: "Tantrum", trigger: "transitions", response: "RESP-SENTINEL" },
    { behaviorType: "Tantrum", trigger: "transitions", resolutionNotes: "RES-SENTINEL" },
    { behaviorType: "Tantrum", trigger: "bedtime", sourceExcerpt: "EXCERPT-SENTINEL" },
    { behaviorType: "Hitting", trigger: "transitions", photoAttachment: "data:PHOTO-SENTINEL" },
    { behaviorType: "Hitting", trigger: "transitions", intensity: 5 },
    { behaviorType: "Moment", trigger: "", notes: "NOTE-SENTINEL-2" },
  ].map((l, i) => ({ id: `l${i}`, timestamp: new Date(now - i * 3_600_000).toISOString(), ...l }));

  it("a fixture with 7 logs returns whole-number counts, no proportional field (even when the model emits one)", async () => {
    const res = await post("/analyze-behavior", { logs: seven, childProfile: { id: "child-a", age: 4 }, language: "en" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.triggerBreakdown).toEqual([{ trigger: "transitions", count: 5 }, { trigger: "bedtime", count: 1 }]);
    expect(body.frequencyCount).toEqual({ Tantrum: 4, Hitting: 2, Moment: 1 });
    expect(JSON.stringify(body)).not.toMatch(/percent|ratio|share/i);
    for (const n of [...body.triggerBreakdown.map((r: { count: number }) => r.count), ...Object.values(body.frequencyCount) as number[]]) {
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it("the prompt carries no notes or other parent free text, even from a client that still sends them", () => {
    for (const sentinel of ["NOTE-SENTINEL", "RESP-SENTINEL", "RES-SENTINEL", "EXCERPT-SENTINEL", "PHOTO-SENTINEL"]) {
      expect(prompts.analyze).not.toContain(sentinel);
    }
    expect(prompts.analyze).toContain('"behaviorType":"Hitting","trigger":"transitions"');
  });

  it("the prompt asks for counts, never a share", () => {
    const task = prompts.analyze.slice(prompts.analyze.indexOf("Analyze Arbor parent-logged observations"));
    expect(task).not.toMatch(/percent|%/i);
    expect(task).toContain("triggerBreakdown lists each trigger with count = how many logs name it");
  });
});

describe("B-AI-02 — /generate-plan and /digest ground in CompanionContext", () => {
  it("the plan prompt gets approved facts + past outcomes", async () => {
    const res = await post("/generate-plan", { challengeTopic: "transitions", childProfile: { id: "child-a", age: 4 } });
    expect(res.status).toBe(200);
    expect(prompts.plan).toContain('- "Transitions go better with a visual timer"');
    expect(prompts.plan).toContain("(parent reported: not today)");
  });

  it("the digest prompt carries the not_today step so tryThisWeek does not repeat it", async () => {
    const res = await post("/digest", { childProfile: { id: "child-a", name: "Noa", age: 4 }, logs, milestones: [], language: "en" });
    expect(res.status).toBe(200);
    expect(prompts.digest).toContain('{"step":"2-minute warning before leaving","reported":"not today"}');
  });

  it("another child's request carries none of child-a's ledger", async () => {
    await post("/generate-plan", { challengeTopic: "sleep", childProfile: { id: "child-b", age: 3 } });
    expect(prompts.plan).not.toContain("2-minute warning");
  });
});

describe("B-AI-02 — firewall pointer-words scan over the three prompts", () => {
  const POINTER = /least practice|weakest|lowest[ -](band|share|scoring)|explore next|falling behind|on track|percentile|\bscore\b|intensityTrend/i;
  it("none of the three rendered prompts carries a pointer or verdict word", () => {
    const rendered = {
      digest: buildDigestPrompt({
        contract: NON_DIAGNOSTIC_CONTRACT, childJson: "{}", childName: "Noa",
        stats: computeWeeklyDigestStats([], []), recentSteps: [{ recommendation: "step", outcome: "helped" }],
      }),
      plan: buildGeneratePlanPrompt({
        developmentalFramework: "FW", childProfile: { age: 4 }, challengeTopic: "transitions", approvedFacts: ["f"],
        pastSteps: [{ recommendation: "s", status: "completed", outcome: "helped", acceptedAt: "2026-09-01T00:00:00Z" }],
      }),
      analyze: buildAnalyzeBehaviorPrompt({ developmentalFramework: "FW", childProfile: { age: 4 }, logs: [], languageDirective: "", pastSteps: [] }),
    };
    for (const [name, text] of Object.entries(rendered)) expect(text, name).not.toMatch(POINTER);
  });
});
