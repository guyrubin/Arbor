/**
 * ASK-1 + AIR-1 (ask-cadence, 2026-07-25 AI-excellence Wave 2) — route tests
 * for real /api/chat streaming.
 *
 * Firewall CONDITIONS asserted here:
 *  - AIR-1 (1): sentence deltas are screened via screenModelOutputLexical on
 *    the CUMULATIVE, alias-RESTORED prose (screen AFTER the stream restorer);
 *  - AIR-1 (3): the acceptance anchor — a response containing 'Mia has autism'
 *    mid-stream NEVER renders the flagged sentence in ANY SSE frame;
 *  - AIR-1 (2): the semantic classifier (when enabled) still gates `done`;
 *    deltas keep streaming and the done payload is the blocked fallback the
 *    client retracts to (client half in lib/chatStream.test.ts);
 *  - AIR-1 (5): escalation pre-screen and blocked-fallback payload shapes are
 *    byte-identical to the pre-cadence behavior;
 *  - ASK-1 Phase 1: `status` events carry honest milestone STAGE KEYS only
 *    (memory → sources → plan) — no English copy for HE sessions to leak.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import express from "express";
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
import { screenForImmediateEscalation, renderEscalationMarkdown } from "../safety/escalation.js";
import { renderBlockedOutputMarkdown } from "../safety/outputScreen.js";
import type { ModelProvider } from "../ai/modelRouter.js";

const HEBREW = /[֐-׿]/;

// ── Instrumented stub provider ──────────────────────────────────────────────
/** The coach contract the stub streams; `text` leads (schema order). */
const contractFor = (text: string, extra: Record<string, unknown> = {}) => ({
  text,
  riskLevel: "Low",
  ageBand: "3-4",
  domains: ["social_emotional"],
  nonDiagnosticHypotheses: [
    { label: "Big feelings at transitions", confidence: "one possibility", rationale: "Common at this age." },
  ],
  todayPlan: ["Name the feeling and offer two choices."],
  parentScript: "I can see this is hard. Let's take one breath together.",
  avoid: ["Long lectures in the moment."],
  observe: ["When it starts and how long it lasts."],
  escalateIf: ["The pattern intensifies for two weeks."],
  frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "f" },
  memoryProposals: [],
  handoffNotes: { teacher: "t", professional: "p" },
  sourceCardsUsed: [],
  ...extra,
});

let providerDocument = "";
let providerChunkSize = 8;
let providerDelayMs = 0;
let modelInvocations = 0;
let classifierVerdict: { safe: boolean; reason: string } = { safe: true, reason: "" };
let timeline: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const stubModelProvider = {
  async *generateJsonStream() {
    modelInvocations += 1;
    for (let i = 0; i < providerDocument.length; i += providerChunkSize) {
      if (providerDelayMs) await sleep(providerDelayMs);
      timeline.push(`provider:yield:${Math.floor(i / providerChunkSize) + 1}`);
      yield providerDocument.slice(i, i + providerChunkSize);
    }
    timeline.push("provider:done");
  },
  generateJson: async () => classifierVerdict,
  async *streamText() {
    yield "";
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

beforeEach(() => {
  providerDocument = "";
  providerChunkSize = 8;
  providerDelayMs = 0;
  modelInvocations = 0;
  classifierVerdict = { safe: true, reason: "" };
  timeline = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── SSE helpers ─────────────────────────────────────────────────────────────
type SseEvent = { event: string; data: Record<string, any> };

const parseSse = (raw: string): SseEvent[] => {
  const events: SseEvent[] = [];
  for (const block of raw.split("\n\n")) {
    if (!block.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) events.push({ event, data: JSON.parse(dataLines.join("\n")) });
  }
  return events;
};

/** Stream /api/chat, logging each delta arrival on the shared timeline so
 *  cadence is asserted CAUSALLY against provider progress. */
async function postChatStreamed(body: unknown): Promise<{ events: SseEvent[]; raw: string }> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
  });
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let sseBuf = "";
  let raw = "";
  let deltaCount = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    raw += chunk;
    sseBuf += chunk;
    let idx: number;
    while ((idx = sseBuf.indexOf("\n\n")) >= 0) {
      const block = sseBuf.slice(0, idx);
      sseBuf = sseBuf.slice(idx + 2);
      const [ev] = parseSse(`${block}\n\n`);
      if (!ev) continue;
      if (ev.event === "delta") timeline.push(`client:delta:${++deltaCount}`);
      if (ev.event === "done") timeline.push("client:done");
    }
  }
  return { events: parseSse(raw), raw };
}

const deltas = (events: SseEvent[]) => events.filter((e) => e.event === "delta");
const statuses = (events: SseEvent[]) => events.filter((e) => e.event === "status");
const deltaText = (events: SseEvent[]) => deltas(events).map((e) => String(e.data.text ?? "")).join("");
const doneOf = (events: SseEvent[]) => events.find((e) => e.event === "done")?.data;

const PROSE = "You're not alone — mornings are a very common battleground. Try laying out two choices tonight. A small sense of control often melts the standoff. It usually eases within a week or two.";

describe("/api/chat real streaming (ASK-1 Phase 2 + AIR-1)", () => {
  it("a 3-sentence prose lead arrives as >=3 deltas, first delta BEFORE the provider finishes; done carries text + contract", async () => {
    providerDocument = JSON.stringify(contractFor(PROSE));
    providerDelayMs = 5;
    const { events } = await postChatStreamed({ message: "Mornings are war", childProfile: { id: "c1", name: "Mia" } });

    expect(deltas(events).length).toBeGreaterThanOrEqual(3);
    // Concatenated deltas are a byte-exact PREFIX of the prose (the trailing
    // fragment with no sentence boundary arrives via `done`, never as a delta).
    expect(deltaText(events).length).toBeGreaterThan(0);
    expect(PROSE.startsWith(deltaText(events))).toBe(true);
    expect(deltas(events)[0].data.text).toBe("You're not alone — mornings are a very common battleground. ");
    // Causal cadence: first visible words BEFORE generation finished.
    const firstDeltaAt = timeline.indexOf("client:delta:1");
    const providerDoneAt = timeline.indexOf("provider:done");
    expect(firstDeltaAt).toBeGreaterThanOrEqual(0);
    expect(firstDeltaAt).toBeLessThan(providerDoneAt);

    const done = doneOf(events);
    expect(done?.outputBlocked).toBeUndefined();
    expect(String(done?.text)).toContain(PROSE); // rendered answer leads with the streamed prose
    expect(done?.contract?.text).toBe(PROSE);
    expect(done?.contract?.parentScript).toBeTruthy();
  });

  it("status events are honest milestone STAGE KEYS in order (memory → sources → plan) with NO copy in any language", async () => {
    providerDocument = JSON.stringify(contractFor(PROSE));
    const { events } = await postChatStreamed({ message: "Mornings are war", childProfile: { id: "c1", name: "Mia" } });
    const stages = statuses(events).map((e) => e.data.stage);
    expect(stages).toEqual(["memory", "sources", "plan"]);
    for (const s of statuses(events)) {
      expect(Object.keys(s.data)).toEqual(["stage"]); // stage key ONLY — the client owns localized copy
    }
    // The old character-counter events are gone.
    expect(events.some((e) => e.event === "chunk")).toBe(false);
  });

  it("ACCEPTANCE ANCHOR: 'Mia has autism' mid-stream never renders — prior clean sentence delivered, blocked done, tail never yielded", async () => {
    const flaggedProse = "It is really common for kids to test the same limit. Mia has autism and that explains it. SENTINEL-NEVER-DELIVERED.";
    providerDocument = JSON.stringify(contractFor(flaggedProse));
    providerChunkSize = 6;
    providerDelayMs = 2;
    const { events, raw } = await postChatStreamed({ message: "Why does she keep doing this?", childProfile: { id: "c1", name: "Mia" } });

    // Clean sentence 1 was released before the flag…
    expect(deltas(events)[0]?.data.text).toBe("It is really common for kids to test the same limit. ");
    // …the flagged sentence appears in NO SSE frame…
    expect(raw).not.toContain("has autism");
    expect(raw).not.toContain("SENTINEL-NEVER-DELIVERED");
    // …and done is the standard blocked payload (client retracts the bubble).
    const done = doneOf(events);
    expect(done?.outputBlocked).toBe(true);
    expect(done?.blockedCategory).toBe("diagnosis");
    expect(done?.text).toBe(renderBlockedOutputMarkdown());
    expect(done?.contract).toBeUndefined(); // structured panels never ship on a flag
    // Generation stopped at the flag: the provider never finished the document.
    expect(timeline.indexOf("provider:done")).toBe(-1);
  });

  it("classifier ON (ENABLE_OUTPUT_SAFETY_CLASSIFIER=true): deltas still stream, and a done-time semantic flag returns the blocked payload for the client to retract to", async () => {
    vi.stubEnv("ENABLE_OUTPUT_SAFETY_CLASSIFIER", "true");
    classifierVerdict = { safe: false, reason: "sounded diagnostic" };
    providerDocument = JSON.stringify(contractFor(PROSE));
    const { events } = await postChatStreamed({ message: "Mornings are war", childProfile: { id: "c1", name: "Mia" } });

    // Streaming was NOT suppressed by the classifier (unlike /voice, /chat
    // always streams the lexically-screened prose)…
    expect(deltas(events).length).toBeGreaterThanOrEqual(3);
    // …but done is the RETRACTABLE blocked payload.
    const done = doneOf(events);
    expect(done?.outputBlocked).toBe(true);
    expect(done?.blockedCategory).toBe("semantic_unsafe");
    expect(done?.text).toBe(renderBlockedOutputMarkdown());
  });

  it("escalation pre-screen unchanged: crisis input → immediate done with verbatim resources, model NEVER invoked, no deltas", async () => {
    providerDocument = JSON.stringify(contractFor(PROSE));
    const message = "Sometimes I am afraid I will hurt my child when it gets this bad.";
    const match = screenForImmediateEscalation({ message });
    expect(match).toBeTruthy();
    const { events } = await postChatStreamed({ message, childProfile: { id: "c1", name: "Mia" } });

    expect(modelInvocations).toBe(0);
    expect(deltas(events)).toHaveLength(0);
    expect(statuses(events)).toHaveLength(0);
    const done = doneOf(events);
    expect(done?.riskLevel).toBe("urgent");
    expect(done?.escalationCategory).toBe(match!.category);
    expect(done?.text).toBe(renderEscalationMarkdown(match!));
    expect(String(done?.text)).toContain("988");
  });

  it("HE prose streams as Hebrew deltas (RTL content untouched)", async () => {
    const heProse = "זה מאבק מוכר מאוד בגיל הזה. נסו להכין שתי אפשרויות בערב. תחושת שליטה קטנה מרגיעה את ההתנגדות.";
    providerDocument = JSON.stringify(contractFor(heProse));
    const { events } = await postChatStreamed({ message: "בקרים קשים", childProfile: { id: "c1", name: "נועה" }, language: "he" });
    expect(deltas(events).length).toBeGreaterThanOrEqual(2);
    expect(HEBREW.test(deltaText(events))).toBe(true);
    expect(doneOf(events)?.contract?.text).toBe(heProse);
  });

  it("alias restoration precedes the screen AND the deltas: [Child] in the model prose reaches the parent as the real name", async () => {
    providerDocument = JSON.stringify(contractFor("It helps to narrate what [Child] is feeling. Try that at the door today."));
    const { events } = await postChatStreamed({ message: "Door dramas", childProfile: { id: "c1", name: "Mia" } });
    expect(deltaText(events)).toContain("Mia is feeling");
    expect(deltaText(events)).not.toContain("[Child]");
  });

  it("the non-SSE path is unchanged: plain JSON payload, no streaming artifacts", async () => {
    providerDocument = JSON.stringify(contractFor(PROSE));
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Mornings are war", childProfile: { id: "c1", name: "Mia" } }),
    });
    expect(res.headers.get("content-type") || "").toContain("application/json");
    const body = await res.json();
    expect(body.contract?.text).toBe(PROSE);
    expect(String(body.text)).toContain(PROSE);
  });

  it("a pre-cadence contract WITHOUT a text field still settles cleanly (zero deltas, full done)", async () => {
    const legacy = { ...contractFor(""), text: undefined } as Record<string, unknown>;
    delete legacy.text;
    providerDocument = JSON.stringify(legacy);
    const { events } = await postChatStreamed({ message: "Mornings are war", childProfile: { id: "c1", name: "Mia" } });
    expect(deltas(events)).toHaveLength(0);
    const done = doneOf(events);
    expect(done?.outputBlocked).toBeUndefined();
    expect(done?.contract?.parentScript).toBeTruthy();
  });
});
