/**
 * voice-safety-hotfix (VC-4 + VC-6) — route-level tests against the REAL
 * /api/voice handler with a stubbed model stream.
 *
 * The two prod fail-opens this pins closed:
 *   - VC-4: /voice used to bury the escalation category in the SSE `done`
 *     event with NO resources — voice parents got strictly less crisis help
 *     than typists. The done payload now carries `resourcesMarkdown` =
 *     renderEscalationMarkdown(match) VERBATIM (so the
 *     CRITICAL_HELPLINE_LITERALS tripwire covers this path too), and the
 *     blocked branch carries `blockedMarkdown` for a visible blocked state
 *     with /chat parity.
 *   - VC-6: the spoken escalation/blocked fallbacks were hardcoded English —
 *     a Hebrew parent mid-crisis heard an English sentence. Both fallbacks
 *     are now served from a he/en map keyed on the request `language`.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
import {
  screenForImmediateEscalation,
  renderEscalationMarkdown,
  CRITICAL_HELPLINE_LITERALS,
} from "../safety/escalation.js";
import { renderBlockedOutputMarkdown } from "../safety/outputScreen.js";
import type { ModelProvider } from "../ai/modelRouter.js";

const HEBREW = /[֐-׿]/;

// Script for the stubbed model stream — set per test.
let voiceReply = "";

const stubModelProvider = {
  async *streamText() {
    yield voiceReply;
  },
  // Semantic output classifier is OFF by default (env not set) — never called.
  generateJson: async () => ({ safe: true, reason: "" }),
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

type SseEvent = { event: string; data: Record<string, unknown> };

async function postVoice(body: unknown): Promise<{ status: number; events: SseEvent[]; raw: string }> {
  const res = await fetch(`${baseUrl}/api/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
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
  return { status: res.status, events, raw };
}

const deltaText = (events: SseEvent[]) =>
  events.filter((e) => e.event === "delta").map((e) => String(e.data.text ?? "")).join("");
const doneOf = (events: SseEvent[]) => events.find((e) => e.event === "done")?.data;

describe("/api/voice escalation (VC-4)", () => {
  it("carries resourcesMarkdown = renderEscalationMarkdown(match) VERBATIM in the done payload, with 988 on screen", async () => {
    const message = "I am thinking about suicide";
    const expectedMatch = screenForImmediateEscalation({ message });
    expect(expectedMatch?.category).toBe("self_harm");

    const { status, events } = await postVoice({ message, language: "en" });
    expect(status).toBe(200);
    const done = doneOf(events);
    expect(done?.escalation).toBe("self_harm");
    // VERBATIM — byte identity with the approved /chat escalation surface.
    expect(done?.resourcesMarkdown).toBe(renderEscalationMarkdown(expectedMatch!));
    expect(String(done?.resourcesMarkdown)).toContain("988");
    // The CRITICAL_HELPLINE_LITERALS tripwire covers this path: every critical
    // number is present in what the voice parent sees on screen.
    for (const literal of CRITICAL_HELPLINE_LITERALS) {
      expect(String(done?.resourcesMarkdown)).toContain(literal);
    }
    // The spoken redirect is the calm EN fallback, not the resources dump.
    expect(deltaText(events)).toContain("I want to make sure you get the right help");
  });

  it("VC-6: language 'he' + a self_harm message returns a HEBREW spoken fallback delta", async () => {
    const { events } = await postVoice({ message: "אני חושב להתאבד", language: "he" });
    const spoken = deltaText(events);
    expect(HEBREW.test(spoken)).toBe(true);
    expect(spoken).not.toContain("I want to make sure");
    const done = doneOf(events);
    expect(done?.escalation).toBe("self_harm");
    // Resources stay the approved verbatim markdown (HE copy gated on GG-4).
    expect(String(done?.resourcesMarkdown)).toContain("988");
  });
});

describe("/api/voice blocked output (VC-4 + VC-6)", () => {
  it("a flagged EN output speaks the EN fallback and dones with outputBlocked + blockedMarkdown (parity with /chat)", async () => {
    voiceReply = "Mia has autism and needs therapy.";
    const { events } = await postVoice({ message: "My child cries at drop-off", language: "en" });
    const spoken = deltaText(events);
    expect(spoken).toContain("I want to be careful here");
    // The flagged draft appears in NO SSE frame.
    expect(JSON.stringify(events)).not.toContain("autism");
    const done = doneOf(events);
    expect(done?.outputBlocked).toBe(true);
    expect(done?.blockedMarkdown).toBe(renderBlockedOutputMarkdown());
  });

  it("VC-6: a flagged HE output returns the HEBREW blocked fallback", async () => {
    voiceReply = "יש למיה אוטיזם";
    const { events } = await postVoice({ message: "הבוקר היה קשה עם הילד", language: "he" });
    const spoken = deltaText(events);
    expect(HEBREW.test(spoken)).toBe(true);
    expect(spoken).not.toContain("I want to be careful here");
    expect(spoken).not.toContain("אוטיזם");
    const done = doneOf(events);
    expect(done?.outputBlocked).toBe(true);
    expect(done?.blockedMarkdown).toBe(renderBlockedOutputMarkdown());
  });
});

describe("/api/voice clean pass-through (regression floor)", () => {
  it("a clean reply streams unchanged with a plain done payload", async () => {
    voiceReply = "Take a slow breath together. Then name the feeling out loud.";
    const { events } = await postVoice({ message: "My child cries at drop-off", language: "en" });
    expect(deltaText(events)).toBe(voiceReply);
    const done = doneOf(events);
    expect(done).toBeDefined();
    expect(done?.escalation).toBeUndefined();
    expect(done?.outputBlocked).toBeUndefined();
  });
});
