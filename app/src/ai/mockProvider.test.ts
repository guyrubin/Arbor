/**
 * B-INF-04 — MODEL_PROVIDER=mock answers every AI route with deterministic,
 * schema-valid fixtures and ZERO outbound calls.
 *
 * The real API router runs in-process on the provider createModelProvider
 * builds for a mock config; globalThis.fetch is wrapped so any request that
 * is not this test talking to its own server is counted as outbound (and
 * refused). A Today / Ask / Kid pass over the AI routes must answer (200,
 * answered fields present, EN + HE) with the outbound count at 0.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApiRouter } from "../routes/api.js";
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
import { buildCapabilityRegistry } from "../server/createApp.js";
import { createModelProvider, routeDecisionFor, type ModelProvider } from "./modelRouter.js";
import { createCoachResponseGeminiSchema, coachResponseZodSchema } from "../contracts/coach.js";
import { MockModelProvider, focusAnchorLine, mockFixtureIdFor, mockJsonFor } from "./mockProvider.js";
import { stepFitsPractice } from "./journalContext.js";
import { practiceMaterial } from "../server/companionContext.js";
import { PRACTICES } from "../content/practices.js";
import type { ArborConfig } from "../config/env.js";

const config: ArborConfig = { ...createTestConfig(), modelProvider: "mock" };
let provider: ModelProvider;
let server: Server;
let baseUrl: string;
let outbound: string[] = [];
const realFetch = globalThis.fetch;

beforeAll(async () => {
  provider = createModelProvider(config);
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(
    "/api",
    createApiRouter({
      config,
      modelProvider: provider,
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
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith(baseUrl)) return realFetch(input, init);
    outbound.push(url);
    throw new Error(`B-INF-04: outbound call under MODEL_PROVIDER=mock: ${url}`);
  }) as typeof fetch;
});

afterAll(async () => {
  globalThis.fetch = realFetch;
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

const CHILD = { id: "child-mock", age: 4 };
const NOW = Date.now();
const LOGS = [0, 1, 2].map((i) => ({
  id: `l${i}`,
  timestamp: new Date(NOW - (i + 1) * 3_600_000).toISOString(),
  behaviorType: "Tantrum",
  intensity: 3,
  durationMinutes: 10,
  trigger: "end of play",
  context: "Home",
  resolved: i === 0,
}));

const post = async (route: string, body: Record<string, unknown>, headers: Record<string, string> = {}) => {
  const res = await fetch(`${baseUrl}/api${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
};

const HEBREW = /[֐-׿]/;

describe("B-INF-04 · the mock provider", () => {
  it("is what createModelProvider builds for MODEL_PROVIDER=mock, and the route decision says so", () => {
    expect(provider.routeDecision("coach_high_stakes")).toEqual({ route: "coach_high_stakes", provider: "mock", model: "mock-fixtures" });
    expect(routeDecisionFor(config, "analysis_structured").provider).toBe("mock");
    expect(() => buildCapabilityRegistry(config, provider)).not.toThrow();
  });

  it("refuses to build for a production config even if env validation were bypassed", () => {
    expect(() => createModelProvider({ ...config, arborEnv: "prod" })).toThrow(/refused in production/);
  });

  it("the coach fixture parses against the real coach contract (EN + HE)", () => {
    const schema = createCoachResponseGeminiSchema(loadFramework());
    expect(mockFixtureIdFor(schema)).toBe("coach_chat");
    for (const prompt of ["Q", "Q\nIMPORTANT: Write every human-readable text value in the JSON response in natural, warm Hebrew (עברית)."]) {
      expect(() => coachResponseZodSchema.parse(mockJsonFor({ prompt, schema }))).not.toThrow();
    }
  });

  it("is deterministic: the same call returns the same fixture", async () => {
    const mock = new MockModelProvider();
    const opts = { route: "analysis_structured" as const, prompt: "p", schema: { type: "OBJECT", required: ["focus", "tryToday"], properties: { focus: { type: "STRING" }, tryToday: { type: "STRING" } } } };
    expect(await mock.generateJson(opts)).toEqual(await mock.generateJson(opts));
    expect(mock.calls).toBe(2);
  });
});

describe("B-INF-04 · a Today / Ask / Kid pass answers every AI route with zero outbound calls", () => {
  const PASS: { name: string; route: string; body: Record<string, unknown>; headers?: Record<string, string>; answered: RegExp }[] = [
    { name: "Ask · coach chat (four-block answer)", route: "/chat", body: { message: "He melts down when play ends.", childProfile: CHILD }, answered: /"parentScript"/ },
    { name: "Ask · coach chat streamed", route: "/chat", body: { message: "He melts down when play ends.", childProfile: CHILD }, headers: { Accept: "text/event-stream" }, answered: /event: done/ },
    { name: "Today · todays-focus", route: "/todays-focus", body: { childProfile: CHILD, signals: { count: 3, topTrigger: "end of play" } }, answered: /"tryToday"/ },
    { name: "Weekly · digest", route: "/digest", body: { childProfile: CHILD, logs: LOGS, milestones: [{ checked: true }] }, answered: /"generated":"ai"/ },
    { name: "Behaviors · analyze-behavior", route: "/analyze-behavior", body: { childProfile: CHILD, logs: LOGS }, answered: /"expertInsights"/ },
    { name: "Plan · generate-plan", route: "/generate-plan", body: { childProfile: CHILD, challengeTopic: "transitions" }, answered: /"phases"/ },
    { name: "Care · generate-handoff", route: "/generate-handoff", body: { childProfile: CHILD, logs: LOGS, milestones: [] }, answered: /"overview"/ },
    { name: "Capture · extract-log", route: "/extract-log", body: { message: "He threw the cup when I turned off the tablet.", childProfile: CHILD }, answered: /"behaviorType"/ },
    { name: "Kid · generate-bedtime-story", route: "/generate-bedtime-story", body: { childName: "Sam", age: 4, dayEvents: [{ kind: "moment", description: "Built a tall tower", time: "17:00" }] }, answered: /"pages"/ },
    { name: "Kid · generate-adventure", route: "/generate-adventure", body: { childProfile: CHILD }, answered: /"scenes"/ },
  ];

  it.each(PASS)("$name (EN)", async ({ route, body, headers, answered }) => {
    const before = outbound.length;
    const { status, text } = await post(route, body, headers);
    expect(status, text.slice(0, 300)).toBe(200);
    expect(text).toMatch(answered);
    expect(outbound.slice(before)).toEqual([]);
  });

  it("Hebrew sessions get Hebrew fixtures (coach, todays-focus, digest, capture)", async () => {
    const chat = await post("/chat", { message: "הוא בוכה כשהמשחק נגמר.", childProfile: CHILD, language: "he" });
    expect(chat.status).toBe(200);
    expect(HEBREW.test(JSON.parse(chat.text).contract.parentScript)).toBe(true);
    const digest = await post("/digest", { childProfile: CHILD, logs: LOGS, milestones: [], language: "he" });
    expect(HEBREW.test(JSON.parse(digest.text).summary)).toBe(true);
    const capture = await post("/extract-log", { message: "הוא זרק את הכוס כשכיביתי את הטאבלט.", childProfile: CHILD, language: "he" });
    expect(HEBREW.test(JSON.parse(capture.text).trigger)).toBe(true);
  });

  /* P7-DESIGN fix r1 (sandbox mock): Today HE logged a 422 whenever the
     chooser's pick was a sleep practice — the fixed fixture ("transitions
     after play") failed the route's coherence gate (stepFitsPractice). The
     focus now echoes the FIRST candidate's do-line, so it is coherent with
     whatever the date picks, in EN and HE; sayThis stays ONE sentence. */
  it("todays-focus stays coherent with the chooser's pick (a sleep practice): 200 in EN + HE, the step shares the practice's words", async () => {
    const journal = { candidatePracticeIds: ["pr-sleep-08", "pr-cdc-24m-4"], shelfCoverage: { sleep: 0, words: 3, food: 2, feelings: 2, play: 2, moving: 2, hands: 2, school: 2, family: 2 } };
    for (const language of ["en", "he"] as const) {
      const before = outbound.length;
      const { status, text } = await post("/todays-focus", { childProfile: { ...CHILD, id: `c-mock-coh-${language}`, age: 2 }, signals: { count: 2 }, journal, language });
      expect(status, text.slice(0, 300)).toBe(200);
      const json = JSON.parse(text);
      expect(stepFitsPractice(`${json.focus ?? ""} ${json.tryToday ?? ""}`, practiceMaterial("pr-sleep-08")), text.slice(0, 300)).toBe(true);
      if (language === "he") expect(HEBREW.test(json.tryToday)).toBe(true);
      expect(outbound.slice(before)).toEqual([]);
    }
    // NEGATIVE CONTROL (the residue reproduced): the old fixed fixture fails the same gate on sleep picks, EN and HE
    const sleepIds = PRACTICES.filter((p) => p.shelf === "sleep").map((p) => p.id);
    expect(sleepIds.some((id) => !stepFitsPractice("Transitions after play Give a two-minute heads-up before the next switch.", practiceMaterial(id)))).toBe(true);
    expect(sleepIds.some((id) => !stepFitsPractice("מעברים אחרי משחק לתת התראה של שתי דקות לפני המעבר הבא.", practiceMaterial(id)))).toBe(true);
    // ...and the anchored mock passes it for EVERY sleep practice, EN + HE
    for (const id of sleepIds) {
      for (const lang of ["en", "he"] as const) {
        const p = PRACTICES.find((x) => x.id === id)!;
        const prompt = `${lang === "he" ? "עברית\n" : ""}- ${id} · sleep · do: ${JSON.stringify(p.do.en)} · say: ${JSON.stringify(p.say.en)}`;
        const out = mockJsonFor({ prompt, schema: { type: "OBJECT", required: ["focus", "tryToday", "sayThis"], properties: { focus: { type: "STRING" }, tryToday: { type: "STRING" }, sayThis: { type: "STRING" } } } }) as Record<string, string>;
        expect(stepFitsPractice(`${out.focus} ${out.tryToday}`, practiceMaterial(id)), `${lang} ${id}: ${out.tryToday}`).toBe(true);
        if (lang === "he") expect(HEBREW.test(out.tryToday), id).toBe(true);
      }
    }
  });

  it("focusAnchorLine reads the FIRST candidate's do-line, else the set practice's say; nothing without a journal", () => {
    const block = ["x", `- pr-a · sleep · do: ${JSON.stringify('Draw the "bedtime" steps together.')} · say: "s"`, '- pr-b · words · do: "Other." · say: "t"'].join("\n");
    expect(focusAnchorLine(block)).toBe('Draw the "bedtime" steps together.');
    expect(focusAnchorLine("Today's practice: 'Same bedtime as every night.' (done). It is what the parent is already trying today")).toBe("Same bedtime as every night.");
    expect(focusAnchorLine("no journal here")).toBeNull();
    const plain = mockJsonFor({ prompt: "p", schema: { type: "OBJECT", required: ["focus", "tryToday", "sayThis"], properties: { focus: { type: "STRING" }, tryToday: { type: "STRING" }, sayThis: { type: "STRING" } } } }) as Record<string, string>;
    expect(plain.focus).toBe("Transitions after play"); // no journal block → the curated fixture, unchanged
    expect(plain.sayThis.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length).toBe(1);
  });

  it("the whole pass made zero outbound calls", () => {
    expect(outbound).toEqual([]);
  });
});
