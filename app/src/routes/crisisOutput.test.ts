/**
 * VC-8 (crisis output category, 2026-07-25 AI-excellence Wave 1) — route-level
 * tests against the REAL handlers with a stubbed model, pinning the firewall
 * CONDITIONS:
 *  - a harm-normalizing MODEL output is flagged with category "crisis" and
 *    routes to the crisis fallback + resources (renderEscalationMarkdown
 *    VERBATIM — CRITICAL_HELPLINE_LITERALS tripwire), NEVER the generic
 *    renderBlockedOutputMarkdown;
 *  - same-PR coverage of /voice, /chat, and the /live/turn model-role screen;
 *  - the flagged draft appears in NO frame of any response;
 *  - the voice path SPEAKS the localized crisis redirect (VC-6 he/en parity)
 *    and the `escalation` done key stops the hands-free loop (handleVoiceDone).
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
import { escalationMatchForCategory, renderEscalationMarkdown } from "../safety/escalation.js";
import { renderBlockedOutputMarkdown } from "../safety/outputScreen.js";
import type { ModelProvider } from "../ai/modelRouter.js";

const HEBREW = /[֐-׿]/;

// The canonical VC-8 canary: harm-NORMALIZING model language that no
// input-side (first-person) pattern matches.
const CANARY = "It sounds like you want to hurt him — and that's understandable after a day like this.";

// Scripts for the stubbed model — set per test.
let voiceReply = "";
let chatContractText = "";

/** A minimal VALID coach contract whose parentScript carries the probe text. */
const chatContractJson = () =>
  JSON.stringify({
    riskLevel: "Low",
    ageBand: "3-4",
    domains: ["social_emotional"],
    nonDiagnosticHypotheses: [
      { label: "Big feelings at transitions", confidence: "one possibility", rationale: "Common at this age." },
    ],
    todayPlan: ["Name the feeling and offer two choices."],
    parentScript: chatContractText,
    avoid: ["Long lectures in the moment."],
    observe: ["When it starts and how long it lasts."],
    escalateIf: ["The pattern intensifies for two weeks."],
    frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "f" },
    memoryProposals: [],
    handoffNotes: { teacher: "t", professional: "p" },
    sourceCardsUsed: [],
  });

const stubModelProvider = {
  async *streamText() {
    yield voiceReply;
  },
  // Semantic output classifier is OFF (env not set) — never called.
  generateJson: async () => ({ safe: true, reason: "" }),
  async *generateJsonStream() {
    yield chatContractJson();
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

const postJson = async (path: string, body: unknown) => {
  const res = await fetch(`${baseUrl}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

describe("/api/voice crisis OUTPUT (VC-8)", () => {
  it("speaks the crisis redirect (not the blocked fallback) and dones with escalation + verbatim resources", async () => {
    voiceReply = CANARY;
    const { status, events, raw } = await postVoice({ message: "The evenings are so hard lately", language: "en" });
    expect(status).toBe(200);
    // The spoken line is the CRISIS redirect, not the generic blocked fallback.
    const spoken = deltaText(events);
    expect(spoken).toContain("I want to make sure you get the right help");
    expect(spoken).not.toContain("I want to be careful here");
    // The flagged draft appears in NO SSE frame.
    expect(raw).not.toContain("want to hurt him");
    const done = doneOf(events);
    expect(done?.escalation).toBe("caregiver_distress");
    expect(done?.blockedCategory).toBe("crisis");
    // Resources are renderEscalationMarkdown VERBATIM — never the generic blocked markdown.
    expect(done?.resourcesMarkdown).toBe(renderEscalationMarkdown(escalationMatchForCategory("caregiver_distress")));
    expect(done?.resourcesMarkdown).not.toBe(renderBlockedOutputMarkdown());
    expect(String(done?.resourcesMarkdown)).toContain("988");
  });

  it("VC-6 parity: language 'he' speaks the HEBREW crisis redirect", async () => {
    voiceReply = "Maybe he wants to die — many kids say that and it means nothing.";
    const { events } = await postVoice({ message: "ערב קשה", language: "he" });
    const spoken = deltaText(events);
    expect(HEBREW.test(spoken)).toBe(true);
    expect(spoken).not.toContain("I want to make sure");
    const done = doneOf(events);
    expect(done?.escalation).toBe("self_harm");
    expect(String(done?.resourcesMarkdown)).toContain("988");
  });

  it("the legitimate help-referral sentence still streams clean (allow-list)", async () => {
    voiceReply = "If you're having thoughts of suicide or self-harm, call or text 988 now.";
    const { events } = await postVoice({ message: "I feel stretched thin", language: "en" });
    expect(deltaText(events)).toBe(voiceReply);
    const done = doneOf(events);
    expect(done?.escalation).toBeUndefined();
    expect(done?.outputBlocked).toBeUndefined();
  });
});

describe("/api/chat crisis OUTPUT (VC-8)", () => {
  it("routes a harm-normalizing contract to the crisis surface, never renderBlockedOutputMarkdown", async () => {
    chatContractText = CANARY;
    const { status, body } = await postJson("/chat", {
      message: "Bedtime keeps exploding, what do I do?",
      childProfile: { id: "c1", name: "Mia" },
    });
    expect(status).toBe(200);
    expect(body.outputBlocked).toBe(true);
    expect(body.blockedCategory).toBe("crisis");
    expect(body.riskLevel).toBe("urgent");
    expect(body.escalationCategory).toBe("caregiver_distress");
    expect(body.text).toBe(renderEscalationMarkdown(escalationMatchForCategory("caregiver_distress")));
    expect(body.text).not.toBe(renderBlockedOutputMarkdown());
    // Real crisis numbers reach the parent on this path too (the full
    // CRITICAL_HELPLINE_LITERALS tripwire spans all categories jointly —
    // escalationLiteralsIntact() covers that; here we pin this category's).
    expect(String(body.text)).toContain("112");
    expect(String(body.text)).toContain("988");
    // The flagged draft never leaves the server.
    expect(JSON.stringify(body)).not.toContain("want to hurt him");
  });

  it("a diagnosis-flagged contract still gets the generic blocked markdown (unchanged routing)", async () => {
    chatContractText = "Mia has autism and needs therapy.";
    const { body } = await postJson("/chat", {
      message: "Why the meltdowns?",
      childProfile: { id: "c1", name: "Mia" },
    });
    expect(body.outputBlocked).toBe(true);
    expect(body.blockedCategory).toBe("diagnosis");
    expect(body.text).toBe(renderBlockedOutputMarkdown());
  });

  it("a clean contract passes through untouched (regression floor)", async () => {
    chatContractText = "Try saying: I can see this is hard. Let's take one breath together.";
    const { body } = await postJson("/chat", {
      message: "Bedtime script please",
      childProfile: { id: "c1", name: "Mia" },
    });
    expect(body.outputBlocked).toBeUndefined();
    expect(body.contract?.parentScript).toBe(chatContractText);
  });
});

describe("/api/live/turn model-role crisis OUTPUT (VC-8, VC-3 screen)", () => {
  it("a harm-normalizing model transcript returns stop_crisis with verbatim resources + spoken redirect", async () => {
    const { status, body } = await postJson("/live/turn", { role: "model", text: CANARY, language: "en" });
    expect(status).toBe(200);
    expect(body.action).toBe("stop_crisis");
    expect(body.category).toBe("caregiver_distress");
    expect(body.resourcesMarkdown).toBe(renderEscalationMarkdown(escalationMatchForCategory("caregiver_distress")));
    expect(body.blockedMarkdown).toBeUndefined();
    expect(body.spokenText).toContain("I want to make sure you get the right help");
  });

  it("a self-harm-echoing model transcript stops with self_harm resources containing 988", async () => {
    const { body } = await postJson("/live/turn", {
      role: "model",
      text: "Thinking about suicide is one way some parents cope with this exhaustion.",
    });
    expect(body.action).toBe("stop_crisis");
    expect(body.category).toBe("self_harm");
    expect(String(body.resourcesMarkdown)).toContain("988");
  });

  it("language 'he' returns the Hebrew spoken crisis redirect", async () => {
    const { body } = await postJson("/live/turn", { role: "model", text: CANARY, language: "he" });
    expect(body.action).toBe("stop_crisis");
    expect(HEBREW.test(String(body.spokenText))).toBe(true);
  });

  it("diagnosis output still returns stop_blocked (unchanged routing)", async () => {
    const { body } = await postJson("/live/turn", { role: "model", text: "Noah is autistic and needs therapy." });
    expect(body.action).toBe("stop_blocked");
    expect(body.category).toBe("diagnosis");
  });

  it("the legitimate help-referral model sentence continues (allow-list)", async () => {
    const { body } = await postJson("/live/turn", {
      role: "model",
      text: "If you ever feel you might hurt your child, call 112 right away.",
    });
    expect(body).toEqual({ action: "continue" });
  });
});
