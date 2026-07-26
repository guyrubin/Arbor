/**
 * AI-V1 + AIR-2 + AI-V5 (voice-cadence, 2026-07-25) — route tests for the
 * sentence-streaming /voice path and the /api/tts screened-token skip.
 *
 * Firewall CONDITIONS asserted here:
 *  - AI-V1 (1): the screen runs on the CUMULATIVE alias-restored text at each
 *    sentence boundary — a flagged sentence stops the stream, prior clean
 *    sentences were already released, and the flagged text is in NO SSE frame;
 *  - AI-V1 (2): ENABLE_OUTPUT_SAFETY_CLASSIFIER=true keeps the full-buffer
 *    behavior (one delta), config-gated;
 *  - AI-V5 (1-4): /api/tts skips ONLY the model re-screen on a valid HMAC
 *    token; absent / expired / one-char-altered text gets the FULL screen,
 *    and the lexical floor runs UNCONDITIONALLY even with a valid token.
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
import { mintTtsToken, verifyTtsToken, TTS_TOKEN_TTL_MS } from "../server/ttsToken.js";
import type { ModelProvider } from "../ai/modelRouter.js";

// Stub ADC so the "google" TTS provider needs no credentials or network.
vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getClient() {
      return { getAccessToken: async () => ({ token: "fake-adc-token" }) };
    }
  },
}));

// ── Instrumented stub provider ──────────────────────────────────────────────
let providerChunks: string[] = [];
let providerDelayMs = 0;
let generateJsonCalls = 0;
let timeline: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const stubModelProvider = {
  async *streamText() {
    for (let i = 0; i < providerChunks.length; i++) {
      if (providerDelayMs) await sleep(providerDelayMs);
      timeline.push(`provider:yield:${i + 1}`);
      yield providerChunks[i];
    }
    timeline.push("provider:done");
  },
  generateJson: async () => {
    generateJsonCalls += 1;
    return { safe: true, reason: "" };
  },
  async *generateJsonStream() {
    yield "{}";
  },
} as unknown as ModelProvider;

let server: Server;
let baseUrl: string;
let cloudTtsCalls = 0;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  // Neural TTS ON so /api/tts is live; Cloud TTS synth itself is faked below.
  const config = createTestConfig({ ttsProvider: "google" } as any);
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

  // Intercept ONLY the Cloud TTS synth call; everything else uses real fetch.
  globalThis.fetch = ((input: any, init?: any) => {
    if (String(input).includes("texttospeech.googleapis.com")) {
      cloudTtsCalls += 1;
      return Promise.resolve({
        ok: true,
        json: async () => ({ audioContent: "QkFTRTY0QVVESU8=" }),
        text: async () => "",
      } as unknown as Response);
    }
    return realFetch(input, init);
  }) as typeof fetch;
});

afterAll(async () => {
  globalThis.fetch = realFetch;
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

beforeEach(() => {
  providerChunks = [];
  providerDelayMs = 0;
  generateJsonCalls = 0;
  cloudTtsCalls = 0;
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

/** Stream /api/voice, recording each delta arrival on the shared timeline so
 *  cadence is asserted CAUSALLY against provider progress. */
async function postVoiceStreamed(body: unknown): Promise<{ events: SseEvent[]; raw: string }> {
  const res = await realFetch(`${baseUrl}/api/voice`, {
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
const deltaText = (events: SseEvent[]) => deltas(events).map((e) => String(e.data.text ?? "")).join("");
const doneOf = (events: SseEvent[]) => events.find((e) => e.event === "done")?.data;

const SENTENCES = [
  "First, get low and quiet near your child. ",
  "Then name what you see in one short sentence. ",
  "Afterwards, reconnect for a minute before talking.",
];

describe("/api/voice sentence streaming (AI-V1 + AIR-2)", () => {
  it("a 3-sentence reply arrives as >=3 deltas, byte-identical in total, first delta BEFORE the provider finishes", async () => {
    providerChunks = [...SENTENCES];
    providerDelayMs = 20;
    const { events } = await postVoiceStreamed({ message: "Help with meltdowns", language: "en" });
    expect(deltas(events).length).toBeGreaterThanOrEqual(3);
    // Concatenated deltas reconstruct the exact restored reply.
    expect(deltaText(events)).toBe(SENTENCES.join(""));
    // Causal cadence: the first sentence was released before generation ended.
    const firstDeltaAt = timeline.indexOf("client:delta:1");
    const providerDoneAt = timeline.indexOf("provider:done");
    expect(firstDeltaAt).toBeGreaterThanOrEqual(0);
    expect(firstDeltaAt).toBeLessThan(providerDoneAt);
    expect(doneOf(events)?.outputBlocked).toBeUndefined();
  });

  it("flagged sentence 2: sentence 1 is emitted, the flagged text is in NO SSE frame, calm fallback + visible blocked done, stream stops", async () => {
    providerChunks = [
      "It is really common for kids to test the same limit. ",
      "Honestly, Noah is autistic and that explains it. ",
      "SENTINEL-NEVER-DELIVERED. ",
    ];
    providerDelayMs = 10;
    const { events, raw } = await postVoiceStreamed({ message: "Why does he keep doing this?", language: "en" });
    // Clean sentence 1 was released as its own delta before the flag…
    expect(deltas(events)[0]?.data.text).toBe("It is really common for kids to test the same limit. ");
    // …the flagged draft appears in NO frame…
    expect(raw).not.toContain("Noah is autistic");
    // …generation was stopped at the flagged boundary (chunk 3 never yielded)…
    expect(raw).not.toContain("SENTINEL-NEVER-DELIVERED");
    // …and the calm fallback + visible blocked state landed.
    expect(deltaText(events)).toContain("I want to be careful here");
    const done = doneOf(events);
    expect(done?.outputBlocked).toBe(true);
    expect(done?.blockedCategory).toBe("diagnosis");
  });

  it("ENABLE_OUTPUT_SAFETY_CLASSIFIER=true keeps today's full-buffer behavior: exactly ONE delta after the semantic screen", async () => {
    vi.stubEnv("ENABLE_OUTPUT_SAFETY_CLASSIFIER", "true");
    providerChunks = [...SENTENCES];
    const { events } = await postVoiceStreamed({ message: "Help with meltdowns", language: "en" });
    expect(deltas(events)).toHaveLength(1);
    expect(String(deltas(events)[0].data.text)).toBe(SENTENCES.join("").trim());
    expect(generateJsonCalls).toBe(1); // the semantic classifier ran once, on the whole reply
    expect(doneOf(events)?.outputBlocked).toBeUndefined();
  });

  it("each sentence delta carries a screened-sentence token verifiable for EXACTLY that text (AI-V5 condition 1)", async () => {
    providerChunks = [...SENTENCES];
    const { events } = await postVoiceStreamed({ message: "Help with meltdowns", language: "en" });
    const sentenceDeltas = deltas(events);
    expect(sentenceDeltas.length).toBeGreaterThanOrEqual(3);
    for (const d of sentenceDeltas) {
      const tts = d.data.tts as { text: string; token: string };
      expect(typeof tts?.token).toBe("string");
      expect(tts.text).toBe(String(d.data.text).trim());
      expect(verifyTtsToken(tts.token, tts.text, "en")).toBe(true);
      // One character altered → the token is worthless.
      expect(verifyTtsToken(tts.token, `${tts.text}!`, "en")).toBe(false);
      // Wrong lang → worthless.
      expect(verifyTtsToken(tts.token, tts.text, "he")).toBe(false);
    }
  });

  it("an empty model reply still speaks the calm default line", async () => {
    providerChunks = [];
    const { events } = await postVoiceStreamed({ message: "hm", language: "en" });
    expect(deltaText(events)).toContain("Let's take this one step at a time");
    expect(doneOf(events)).toBeDefined();
  });
});

describe("/api/tts screened-token skip (AI-V5)", () => {
  const CLEAN = "Take a slow breath together and name the feeling.";

  const postTts = async (body: unknown) =>
    realFetch(`${baseUrl}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("a valid token skips ONLY the model re-screen (semantic classifier not called)", async () => {
    vi.stubEnv("ENABLE_OUTPUT_SAFETY_CLASSIFIER", "true");
    const res = await postTts({ text: CLEAN, language: "en", screenedToken: mintTtsToken(CLEAN, "en") });
    expect(res.status).toBe(200);
    expect((await res.json()).audio).toBeTruthy();
    expect(generateJsonCalls).toBe(0);
    expect(cloudTtsCalls).toBe(1);
  });

  it("an absent token gets the FULL screen", async () => {
    vi.stubEnv("ENABLE_OUTPUT_SAFETY_CLASSIFIER", "true");
    const res = await postTts({ text: CLEAN, language: "en" });
    expect(res.status).toBe(200);
    expect(generateJsonCalls).toBe(1);
  });

  it("one-char-altered text with a valid token is FULLY screened (condition 4)", async () => {
    vi.stubEnv("ENABLE_OUTPUT_SAFETY_CLASSIFIER", "true");
    const token = mintTtsToken(CLEAN, "en");
    const res = await postTts({ text: `${CLEAN} `, language: "en", screenedToken: token });
    expect(res.status).toBe(200);
    expect(generateJsonCalls).toBe(1); // token mismatch → full screen ran
  });

  it("an expired token gets the FULL screen", async () => {
    vi.stubEnv("ENABLE_OUTPUT_SAFETY_CLASSIFIER", "true");
    const expired = mintTtsToken(CLEAN, "en", Date.now() - TTS_TOKEN_TTL_MS - 1000);
    const res = await postTts({ text: CLEAN, language: "en", screenedToken: expired });
    expect(res.status).toBe(200);
    expect(generateJsonCalls).toBe(1);
  });

  it("a wrong-language token gets the FULL screen", async () => {
    vi.stubEnv("ENABLE_OUTPUT_SAFETY_CLASSIFIER", "true");
    const res = await postTts({ text: CLEAN, language: "he", screenedToken: mintTtsToken(CLEAN, "en") });
    expect(res.status).toBe(200);
    expect(generateJsonCalls).toBe(1);
  });

  it("the lexical floor runs UNCONDITIONALLY: flagged text with a valid token is still 422 (condition 3)", async () => {
    const flagged = "Mia has autism and needs therapy.";
    const res = await postTts({ text: flagged, language: "en", screenedToken: mintTtsToken(flagged, "en") });
    expect(res.status).toBe(422);
    expect(cloudTtsCalls).toBe(0); // nothing was synthesized
  });

  it("UnsafeTtsOutputError 422 path without any token stays green", async () => {
    const res = await postTts({ text: "Give 5 mg melatonin tonight.", language: "en" });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("cannot be spoken");
  });
});
