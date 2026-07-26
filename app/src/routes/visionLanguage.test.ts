/**
 * AIX-S1 — /api/vision language parity, against the REAL handler with a
 * stubbed model provider (harness mirrors todaysFocus.test.ts).
 *
 * ArborVision was the single biggest HE/EN parity breach among the AI
 * surfaces: the client never sent `language` and the /vision prompt carried
 * no language directive (unlike /digest), so a Hebrew parent got all-English
 * analysis back. These tests pin:
 *  - the Hebrew languageDirective in the /vision prompt for BOTH modes
 *    (observe + document), mirroring the /digest pattern,
 *  - no directive when the session is English,
 *  - the client-side threading (api.vision carries language; ArborVision
 *    sends getAiLanguage()) via source pins.
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

const HEBREW_DIRECTIVE = "עברית";
const SRC_ROOT = path.resolve(__dirname, "..");

let lastPrompt = "";
let draft: Record<string, unknown> = {};

const stubModelProvider = {
  generateJson: async ({ prompt }: { prompt: string }) => {
    lastPrompt = prompt;
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
  app.use(express.json({ limit: "10mb" }));
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

const IMAGE = { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" };

const postVision = async (body: unknown) => {
  const res = await fetch(`${baseUrl}/api/vision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
};

const OBSERVE_DRAFT = {
  offTopic: false,
  observations: ["הילדה מציירת בריכוז ליד השולחן."],
  possibleMeanings: [],
  tryToday: ["הציעו לה לספר על הציור."],
  avoid: [],
  nonDiagnosticNote: "תצפית בלבד — לא אבחנה.",
};

const DOCUMENT_DRAFT = {
  offTopic: false,
  documentType: "דוח גן",
  summary: "דוח חיובי מהגננת.",
  keyPoints: [],
  suggestedMemory: [],
  questionsForProfessional: [],
  handoffNote: "",
};

describe("/api/vision language directive (AIX-S1, mirrors /digest)", () => {
  it("observe mode carries the Hebrew directive for language:'he'", async () => {
    draft = { ...OBSERVE_DRAFT };
    lastPrompt = "";
    const { status, json } = await postVision({
      childId: "kid-he",
      image: IMAGE,
      mode: "observe",
      childProfile: { id: "kid-he", name: "Test Child", age: 4 },
      language: "he",
    });
    expect(status).toBe(200);
    expect(lastPrompt).toContain(HEBREW_DIRECTIVE);
    expect(lastPrompt).toContain("warm, natural Hebrew");
    expect(json.mode).toBe("observe");
    expect(String((json.observations as string[])[0])).toContain("מציירת");
  });

  it("document mode carries the Hebrew directive for language:'he'", async () => {
    draft = { ...DOCUMENT_DRAFT };
    lastPrompt = "";
    const { status } = await postVision({
      childId: "kid-he",
      image: IMAGE,
      mode: "document",
      childProfile: { id: "kid-he", name: "Test Child", age: 4 },
      language: "he",
    });
    expect(status).toBe(200);
    expect(lastPrompt).toContain(HEBREW_DIRECTIVE);
  });

  it("no directive when the session is English (default + explicit)", async () => {
    draft = { offTopic: false, observations: ["Drawing at the table."], possibleMeanings: [], tryToday: [], avoid: [], nonDiagnosticNote: "" };
    lastPrompt = "";
    await postVision({
      childId: "kid-en",
      image: IMAGE,
      mode: "observe",
      childProfile: { id: "kid-en", name: "Test Child", age: 4 },
    });
    expect(lastPrompt).not.toContain(HEBREW_DIRECTIVE);
    lastPrompt = "";
    await postVision({
      childId: "kid-en",
      image: IMAGE,
      mode: "observe",
      childProfile: { id: "kid-en", name: "Test Child", age: 4 },
      language: "en",
    });
    expect(lastPrompt).not.toContain(HEBREW_DIRECTIVE);
  });

  it("the safety gate and non-diagnostic contract survive the language edit", async () => {
    draft = { ...OBSERVE_DRAFT };
    lastPrompt = "";
    await postVision({
      childId: "kid-he",
      image: IMAGE,
      mode: "observe",
      childProfile: { id: "kid-he", name: "Test Child", age: 4 },
      language: "he",
    });
    expect(lastPrompt).toContain("IMAGE SAFETY GATE");
    expect(lastPrompt).toContain("Never diagnose");
  });
});

describe("AIX-S1 client threading (source-pinned)", () => {
  it("api.vision accepts and ArborVision sends the session AI language", () => {
    const apiSrc = fs.readFileSync(path.join(SRC_ROOT, "lib", "api.ts"), "utf8");
    expect(apiSrc).toMatch(/vision:\s*\(payload:\s*\{[^)]*language\?:\s*"en"\s*\|\s*"he"/);
    const visionSrc = fs.readFileSync(path.join(SRC_ROOT, "components", "coach", "ArborVision.tsx"), "utf8");
    expect(visionSrc).toContain("language: getAiLanguage()");
  });
});
