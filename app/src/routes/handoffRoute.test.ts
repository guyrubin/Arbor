/**
 * B-CAREPRO-12 — /api/generate-handoff input allow-list, against the REAL
 * router with a stub provider (explainRoute.test.ts harness). This file is the
 * offline gate for evals/school-handoff-v1.eval.json: it loads the suite and
 * runs every deterministic-tier scenario.
 *
 * The School Brief used to post every behaviour log (free-text notes
 * included) and the whole milestone catalogue, and the route put both into
 * the prompt verbatim; only the child's name was redacted.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApiRouter, allowListHandoffInput } from "./api.js";
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

const SUITE_FILE = path.resolve(__dirname, "..", "..", "..", "evals", "school-handoff-v1.eval.json");
type Scenario = { id: string; tier: string; input: Record<string, any>; expected_behavior: string };
const suite = JSON.parse(fs.readFileSync(SUITE_FILE, "utf8")) as { suite: string; scenarios: Scenario[] };

const CLEAN_DRAFT = {
  title: "School note",
  date: "2026-10-01",
  overview: "Mia does best with a warning before a change.",
  keyStrengths: ["Curious"],
  classroomChallenges: ["Leaving a favourite activity"],
  languageSupportPlan: ["Short phrases"],
  suggestedTeacherStrategies: ["Give a two-minute warning"],
  crisisEscalationTrigger: "If refusals last much longer than usual for two weeks, mention it to the family.",
};
const DIAGNOSTIC_DRAFT = { ...CLEAN_DRAFT, overview: "Mia has ADHD and needs medication." };

let draft: Record<string, unknown> = CLEAN_DRAFT;
let prompts: string[] = [];
const stubModelProvider = {
  generateJson: async ({ prompt }: { prompt: string }) => {
    prompts.push(prompt);
    return draft;
  },
  async *streamText() { yield ""; },
  async *generateJsonStream() { yield "{}"; },
} as unknown as ModelProvider;

let server: Server;
let baseUrl = "";

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
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

const DAY = 86_400_000;
/** Scenario logs carry `ageDays`; turn them into what a client posts. */
const toWire = (input: Record<string, any>) => {
  const now = Date.now();
  const logs = (input.logs ?? []).map(({ ageDays, ...rest }: Record<string, any>) => {
    const ts = new Date(now - (ageDays ?? 0) * DAY).toISOString();
    return input.rawTimestampsOnly ? { ...rest, timestamp: ts } : { ...rest, day: ts.slice(0, 10) };
  });
  return { childProfile: { id: "c-handoff", name: "Mia", age: 4 }, logs, milestones: input.milestones ?? [], audience: "teacher", language: input.language };
};

const run = async (scenario: Scenario) => {
  prompts = [];
  draft = scenario.input.stubbedDraftDiagnostic ? DIAGNOSTIC_DRAFT : CLEAN_DRAFT;
  const res = await fetch(`${baseUrl}/api/generate-handoff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toWire(scenario.input)),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown>, prompt: prompts[0] ?? "" };
};

const byId = (id: string) => {
  const s = suite.scenarios.find((x) => x.id === id);
  if (!s) throw new Error(`scenario ${id} missing from ${suite.suite}`);
  return s;
};

describe(`${suite.suite} — deterministic tier against the real handler`, () => {
  it("the suite is loaded and every deterministic scenario has a case below", () => {
    const deterministic = suite.scenarios.filter((s) => s.tier === "deterministic").map((s) => s.id);
    expect(deterministic.sort()).toEqual([
      "handoff-allowlist-strips-notes-en",
      "handoff-hebrew-directive",
      "handoff-older-client-raw-logs",
      "handoff-output-screen-409",
      "safety-trip-handoff-input",
    ]);
  });

  it("handoff-allowlist-strips-notes-en: the prompt carries only the allow-listed fields", async () => {
    const { status, prompt } = await run(byId("handoff-allowlist-strips-notes-en"));
    expect(status).toBe(200);
    expect(prompt).toContain("Transition Refusal");
    expect(prompt).toContain("leaving the park");
    expect(prompt).toContain("two-minute warning");
    expect(prompt).toContain("Uses five-word sentences");
    for (const banned of ["PRIVATE-NOTE", "PRIVATE-EXCERPT", "base64", "OLD-TRIGGER", "PRIVATE-CATALOGUE-TEXT", "NOT-OBSERVED", "\"intensity\"", "\"durationMinutes\"", "\"notes\""]) {
      expect(prompt, `prompt leaks ${banned}`).not.toContain(banned);
    }
  });

  it("handoff-hebrew-directive: the Hebrew directive and the Hebrew log reach the prompt", async () => {
    const { status, prompt } = await run(byId("handoff-hebrew-directive"));
    expect(status).toBe(200);
    expect(prompt).toContain("Hebrew (עברית)");
    expect(prompt).toContain("יציאה מהגן");
  });

  it("handoff-older-client-raw-logs: day derived from timestamp, notes dropped", async () => {
    const { status, prompt } = await run(byId("handoff-older-client-raw-logs"));
    expect(status).toBe(200);
    expect(prompt).toContain("lights off");
    expect(prompt).toMatch(/"day":"\d{4}-\d{2}-\d{2}"/);
    expect(prompt).not.toContain("PRIVATE-NOTE-legacy");
    expect(prompt).not.toContain("\"timestamp\"");
  });

  it("safety-trip-handoff-input: 409 + escalationCategory, model never called", async () => {
    const { status, json } = await run(byId("safety-trip-handoff-input"));
    expect(status).toBe(409);
    expect(json.escalationCategory).toBeTruthy();
    expect(prompts).toHaveLength(0);
  });

  it("handoff-output-screen-409: a diagnostic draft never returns as a brief", async () => {
    const { status, json } = await run(byId("handoff-output-screen-409"));
    expect(status).toBe(409);
    expect(json.escalationCategory).toBeTruthy();
    expect(JSON.stringify(json)).not.toContain("ADHD");
  });

  it("an older client's NOTES still trip the escalation screen (in memory, never in the prompt)", async () => {
    prompts = [];
    const res = await fetch(`${baseUrl}/api/generate-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childProfile: { name: "Mia", age: 4 }, logs: [{ behaviorType: "Meltdown", trigger: "bedtime", response: "hug", notes: "he said he wants to hurt himself", timestamp: new Date().toISOString() }], milestones: [] }),
    });
    expect(res.status).toBe(409);
    expect(prompts).toHaveLength(0);
  });
});

describe("allowListHandoffInput — the pure allow-list", () => {
  const NOW = Date.parse("2026-10-01T12:00:00Z");

  it("keeps exactly {behaviorType, trigger, response, day} and drops anything older than 30 days", () => {
    const out = allowListHandoffInput(
      [
        { behaviorType: "A", trigger: "t", response: "r", day: "2026-09-25", notes: "secret", intensity: 5 },
        { behaviorType: "B", trigger: "t", response: "r", day: "2026-08-01" },
        "garbage",
        null,
      ],
      [{ domain: "language", title: "T", description: "catalogue", checked: true }, { domain: "motor", title: "U", checked: false }],
      NOW,
    );
    expect(out.logs).toEqual([{ behaviorType: "A", trigger: "t", response: "r", day: "2026-09-25" }]);
    expect(out.milestones).toEqual([{ domain: "language", title: "T" }]);
  });

  it("NEGATIVE CONTROL: the pre-change prompt line embedded the raw logs", () => {
    const raw = [{ behaviorType: "A", notes: "secret" }];
    expect(`Key Logged Behaviors: ${JSON.stringify(raw)}`).toContain("secret");
    expect(`Key Logged Behaviors: ${JSON.stringify(allowListHandoffInput(raw, [], NOW).logs)}`).not.toContain("secret");
  });
});
