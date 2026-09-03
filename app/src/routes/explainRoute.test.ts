/**
 * AI-01 (server half) + AI-19 — /api/explain and /api/todays-focus
 * `inputsUsed`, against the REAL router with a stubbed model provider (the
 * todaysFocus.test.ts harness).
 *
 * /explain is the lightweight generator the non-coach surfaces (Milestones ›
 * Explain / Analyze gaps, Behaviors › co-regulation script) switch to instead
 * of POSTing /api/chat. The load-bearing contract, pinned here:
 *  - a 2-field structured payload {explanation, tryToday} — never the coach's
 *    internal markdown (Frame Routing / Pending Memory Review / Knowledge
 *    Cards Used / Handoff Note),
 *  - NO memory proposals: even when the model volunteers `memoryProposals`,
 *    the child's memory ledger stays EMPTY (the /chat path would have written
 *    pending facts from a synthetic UI prompt),
 *  - NON_DIAGNOSTIC_CONTRACT embedded, promptProfile allow-list applied,
 *  - screenModelOutput BEFORE return (422 on a diagnostic draft),
 *  - per-day cache keyed uid/child/lang/subject(+details digest),
 *  - source scan: appendMemoryProposals is called ONLY from the /chat,
 *    /council and the explicit parent-initiated /memory/:childId/propose
 *    handlers.
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

const memoryStore = new LocalMemoryStore();
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
      memoryStore,
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

const post = async (route: string, body: unknown) => {
  const res = await fetch(`${baseUrl}/api/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
};

const CLEAN_DRAFT = {
  explanation: "Stacking blocks is how hands and eyes learn to work together; most children explore it through play around this age.",
  tryToday: "Sit on the floor with three blocks and say: your turn, my turn.",
};

// A model that "helpfully" emits the coach contract's internals. The route
// must drop every one of these on the floor.
const CHATTY_DRAFT = {
  ...CLEAN_DRAFT,
  memoryProposals: [{ fact: "Mia refuses shoes every morning", source: "explain", retention: "90d" }],
  frameRouting: { aim: "x", twoAxes: "y", story: "z", shadow: "s", marriage: "m", shepherd: "p" },
  handoffNotes: { teacher: "note", professional: "note" },
  sourceCardsUsed: ["card-1"],
};

const INTERNAL_MARKDOWN = ["Frame Routing", "Pending Memory Review", "Knowledge Cards Used", "Handoff Note", "Age band:", "memoryProposals", "frameRouting"];

describe("/api/explain happy path (AI-01)", () => {
  it("returns the screened 2-field payload and never the coach's internal markdown", async () => {
    draft = { ...CHATTY_DRAFT };
    const { status, json } = await post("explain", {
      childProfile: { id: "c-explain", name: "Mia", age: 3 },
      subject: "Stacks 4 blocks",
      language: "en",
    });
    expect(status).toBe(200);
    expect(json.explanation).toContain("Stacking blocks");
    expect(json.tryToday).toContain("your turn");
    expect(String(json.text)).toContain("Stacking blocks");
    expect(json.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const wire = JSON.stringify(json);
    for (const marker of INTERNAL_MARKDOWN) expect(wire, `response leaks "${marker}"`).not.toContain(marker);
    expect(wire).not.toContain("refuses shoes");
  });

  it("writes NOTHING to the child's memory ledger even when the model volunteers memoryProposals", async () => {
    draft = { ...CHATTY_DRAFT };
    await post("explain", {
      childProfile: { id: "c-explain-mem", name: "Mia", age: 3 },
      subject: "Points to pictures in a book",
    });
    const events = await memoryStore.listEvents("c-explain-mem");
    expect(events).toEqual([]);
  });

  it("embeds NON_DIAGNOSTIC_CONTRACT, the subject and the parent's details — and the promptProfile allow-list (AI-12)", async () => {
    draft = { ...CLEAN_DRAFT };
    lastPrompt = "";
    await post("explain", {
      childProfile: {
        id: "c-explain-prompt",
        name: "Mia",
        age: 3,
        riskLevel: "High",
        photoUrl: "data:image/png;base64,AAAAQUFB",
        avatar: { style: "storybook", source: "photo", createdAt: "2026-01-01" },
        interests: ["Trains"],
      },
      subject: "Analyze checked vs unchecked milestones",
      details: "Checked: 3 (motor)\nUnchecked: 2 (language)",
    });
    expect(lastPrompt).toContain("Never diagnose");
    expect(lastPrompt).toContain("Subject: Analyze checked vs unchecked milestones");
    expect(lastPrompt).toContain("Checked: 3 (motor)");
    expect(lastPrompt).toContain("Trains");
    for (const leak of ["riskLevel", "photoUrl", "data:image", "base64,AAAA", "storybook", "c-explain-prompt"]) {
      expect(lastPrompt, `prompt leaks ${leak}`).not.toContain(leak);
    }
  });

  it("carries the Hebrew directive for language:'he'", async () => {
    draft = { explanation: "בניית מגדל קוביות מלמדת תיאום יד-עין.", tryToday: "שבו על הרצפה עם שלוש קוביות." };
    lastPrompt = "";
    const { status, json } = await post("explain", {
      childProfile: { id: "c-explain-he", name: "Mia", age: 3 },
      subject: "בונה מגדל של 4 קוביות",
      language: "he",
    });
    expect(status).toBe(200);
    expect(lastPrompt).toContain("עברית");
    expect(String(json.explanation)).toContain("קוביות");
  });

  it("400 without a subject; 409 professional routing on an escalation subject, model never invoked", async () => {
    draft = { ...CLEAN_DRAFT };
    const missing = await post("explain", { childProfile: { id: "c-x", name: "Mia" } });
    expect(missing.status).toBe(400);
    providerCalls = 0;
    const bait = await post("explain", {
      childProfile: { id: "c-bait", name: "Mia", age: 3 },
      subject: "Co-regulation script",
      details: "Trigger: he said he wants to hurt himself",
    });
    expect(bait.status).toBe(409);
    expect(bait.json.escalationCategory).toBeTruthy();
    expect(providerCalls).toBe(0);
  });
});

describe("/api/explain output screen + cache", () => {
  it("a diagnostic draft is blocked with 422 and never reaches the response", async () => {
    draft = { explanation: "Your child has autism and this explains the gap.", tryToday: "Start a treatment plan." };
    const { status, json } = await post("explain", {
      childProfile: { id: "c-explain-flag", name: "Mia", age: 3 },
      subject: "Waves bye-bye",
    });
    expect(status).toBe(422);
    expect(JSON.stringify(json)).not.toContain("autism");
    expect(json.text).toBeUndefined();
  });

  it("a flagged draft is never cached; a screened one is served from cache for the same subject and re-generated for a different one", async () => {
    draft = { ...CLEAN_DRAFT };
    providerCalls = 0;
    const first = await post("explain", { childProfile: { id: "c-explain-flag", name: "Mia", age: 3 }, subject: "Waves bye-bye" });
    expect(first.status).toBe(200);
    expect(providerCalls).toBe(1);
    const second = await post("explain", { childProfile: { id: "c-explain-flag", name: "Mia", age: 3 }, subject: "Waves bye-bye" });
    expect(second.json.explanation).toEqual(first.json.explanation);
    expect(providerCalls).toBe(1);
    await post("explain", { childProfile: { id: "c-explain-flag", name: "Mia", age: 3 }, subject: "Waves bye-bye", details: "Checked: 1" });
    expect(providerCalls).toBe(2);
    await post("explain", { childProfile: { id: "c-explain-flag", name: "Mia", age: 3 }, subject: "Claps hands" });
    expect(providerCalls).toBe(3);
  });
});

describe("/api/todays-focus inputsUsed (AI-19)", () => {
  const CLEAN_FOCUS = {
    focus: "Mornings have been busiest around transitions this week.",
    tryToday: "Try a two-minute warning before leaving the house today.",
  };

  it("returns counts + the parent-tagged category + the outcome enum, nothing else", async () => {
    draft = { ...CLEAN_FOCUS };
    const { status, json } = await post("todays-focus", {
      childProfile: { id: "c-focus-inputs", name: "Mia", age: 4 },
      signals: { count: 7, topTrigger: "bedtime", lastActionRecommendation: "two-minute warning", lastActionOutcome: "helped", avg: 4.2, milestonesPercent: 63 },
    });
    expect(status).toBe(200);
    expect(json.inputsUsed).toEqual({ momentCount: 7, topTrigger: "bedtime", lastActionOutcome: "helped" });
    const wire = JSON.stringify(json.inputsUsed);
    expect(wire).not.toContain("4.2");
    expect(wire).not.toContain("63");
    expect(wire).not.toMatch(/avg|percent|intensity|two-minute warning/i);
  });

  it("omits the optional fields when the parent tagged nothing", async () => {
    draft = { ...CLEAN_FOCUS };
    const { json } = await post("todays-focus", {
      childProfile: { id: "c-focus-inputs-empty", name: "Mia", age: 4 },
      signals: { count: 0 },
    });
    expect(json.inputsUsed).toEqual({ momentCount: 0 });
  });
});

describe("source scan — appendMemoryProposals is called only from /chat, /council and the parent-initiated /memory propose", () => {
  const apiSrc = fs.readFileSync(path.resolve(__dirname, "api.ts"), "utf8");
  // Split the router into handler slices at every `router.<verb>("<path>"`.
  const HANDLER_HEAD = /router\.(?:get|post|patch|put|delete)\(\s*"([^"]+)"/g;
  const slices: { route: string; body: string }[] = [];
  const heads = [...apiSrc.matchAll(HANDLER_HEAD)];
  heads.forEach((m, i) => {
    const start = m.index ?? 0;
    const end = i + 1 < heads.length ? (heads[i + 1].index ?? apiSrc.length) : apiSrc.length;
    slices.push({ route: m[1], body: apiSrc.slice(start, end) });
  });
  const callers = slices.filter((s) => /\bappendMemoryProposals\(/.test(s.body)).map((s) => s.route);

  it("negative control: the walker sees the /chat and /council handlers and they DO call appendMemoryProposals", () => {
    expect(slices.some((s) => s.route === "/explain")).toBe(true);
    expect(callers).toContain("/chat");
    expect(callers).toContain("/council");
  });

  it("no other handler proposes memory — in particular not /explain", () => {
    expect([...new Set(callers)].sort()).toEqual(["/chat", "/council", "/memory/:childId/propose"].sort());
  });

  it("/explain never renders the coach contract and runs on the analysis route with the 2-field schema", () => {
    const explain = slices.find((s) => s.route === "/explain")?.body ?? "";
    expect(explain).not.toContain("renderCoachResponse(");
    expect(explain).not.toContain("appendMemoryProposals(");
    expect(explain).toContain('route: "analysis_structured"');
    expect(explain).toContain('required: ["explanation", "tryToday"]');
    expect(explain).toContain("screenModelOutput(modelProvider, text)");
    expect(explain).toContain("NON_DIAGNOSTIC_CONTRACT");
    expect(explain).toContain("promptProfile(childProfile)");
  });
});
