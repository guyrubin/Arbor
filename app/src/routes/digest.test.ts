/**
 * B-AI-16 (VETO-FIRST privacy) — /api/digest reads counts, types, contexts
 * and outcomes only. An OLDER client still posts full BehaviorLog rows; the
 * route drops trigger / notes / response (and every other free-text field)
 * before the stats are computed, so none of it reaches the prompt or the
 * response. EN + HE digest still generates.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import fs from "node:fs";
import path from "node:path";
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

const SENTINELS = ["TRIGGER-SENTINEL", "NOTE-SENTINEL", "RESP-SENTINEL", "RES-SENTINEL", "PHOTO-SENTINEL", "EXCERPT-SENTINEL", "MILESTONE-SENTINEL"];

let prompts: string[] = [];
const stubModelProvider = {
  generateJson: async ({ prompt }: { prompt: string }) => {
    prompts.push(prompt);
    return {
      title: "This week",
      subject: "Your week",
      preheader: "A short look back",
      summary: "You noticed a few moments this week.",
      highlights: ["You wrote moments down on two days."],
      watchFor: [],
      tryThisWeek: "Name the next step before it starts.",
    };
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
  app.use(express.json({ limit: "2mb" }));
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

beforeEach(() => {
  prompts = [];
});

const NOW = Date.now();
const oldClientLog = (i: number) => ({
  id: `l${i}`,
  timestamp: new Date(NOW - (i + 1) * 3_600_000).toISOString(),
  behaviorType: "Tantrum",
  intensity: 4,
  durationMinutes: 10,
  trigger: "TRIGGER-SENTINEL the shoes again",
  response: "RESP-SENTINEL we left the park",
  notes: "NOTE-SENTINEL she said she hates me",
  context: "Public",
  resolved: i === 0,
  resolutionNotes: "RES-SENTINEL",
  photoAttachment: "data:image/png;base64,PHOTO-SENTINEL",
  sourceExcerpt: "EXCERPT-SENTINEL",
});

const post = async (route: string, body: unknown) => {
  const res = await fetch(`${baseUrl}/api${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
};

describe("B-AI-16 · /api/digest allow-list (an older client's full rows)", () => {
  for (const language of ["en", "he"] as const) {
    it(`${language}: the digest generates from counts, and no free text reaches the prompt or the response`, async () => {
      const { status, text } = await post("/digest", {
        childProfile: { id: "c1", age: 4 },
        logs: [oldClientLog(0), oldClientLog(1), oldClientLog(2)],
        milestones: [{ id: "m1", title: "MILESTONE-SENTINEL first word", checked: true }, { id: "m2", title: "MILESTONE-SENTINEL", checked: false }],
        language,
      });
      expect(status).toBe(200);
      const json = JSON.parse(text);
      expect(json.generated).toBe("ai");
      // The counts survived the allow-list (types, contexts, outcomes).
      expect(json.stats.momentsLogged).toBe(3);
      expect(json.stats.resolvedCount).toBe(1);
      expect(json.stats.topBehavior).toBe("Tantrum");
      expect(json.stats.topContext).toBe("Public");
      expect(json.stats.milestonesDone).toBe(1);
      expect(prompts.length).toBeGreaterThan(0);
      const digestPrompt = prompts.join("\n");
      if (language === "he") expect(digestPrompt).toContain("עברית");
      for (const sentinel of SENTINELS) {
        expect(digestPrompt, `${language} prompt: ${sentinel}`).not.toContain(sentinel);
        expect(text, `${language} response: ${sentinel}`).not.toContain(sentinel);
      }
    });
  }

  it("the email preview route reads the same allow-list", async () => {
    const { status, text } = await post("/digest/email-preview", {
      childProfile: { id: "c1", age: 4 },
      logs: [oldClientLog(0)],
      milestones: [{ id: "m1", title: "MILESTONE-SENTINEL", checked: true }],
      language: "en",
    });
    expect(status).toBe(200);
    for (const sentinel of SENTINELS) expect(text, sentinel).not.toContain(sentinel);
  });

  it("every computeWeeklyDigestStats call in routes/api.ts is fed through the allow-list", () => {
    const src = fs.readFileSync(path.join(__dirname, "api.ts"), "utf8");
    const calls = [...src.matchAll(/computeWeeklyDigestStats\(([^\n]*)\)/g)].map((m) => m[1]);
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const args of calls) expect(args).toMatch(/^toDigestLogInputs\(logs\), toDigestMilestoneInputs\(milestones\)/);
  });
});
