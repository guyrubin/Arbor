/**
 * B-AI-11 (cited sources) — /api/chat and /api/council show as sources ONLY the
 * knowledge cards the model cited that were also supplied in the prompt. The
 * defect: when the model cited nothing, both routes copied every supplied card
 * id into sourceCardsUsed, so the parent saw the whole supplied set as "used".
 *
 * Synthetic data only; the model is a deterministic stub (no network).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
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
import type { ModelProvider } from "../ai/modelRouter.js";

const contractFor = (sourceCardsUsed: string[]) => ({
  text: "Keep the same three bedtime steps every night. The repetition is the message.",
  riskLevel: "Low",
  ageBand: "3-4",
  domains: ["social_emotional"],
  nonDiagnosticHypotheses: [
    { label: "Wanting predictability at bedtime", confidence: "one possibility", rationale: "Common at this age." },
  ],
  todayPlan: ["Do the same three steps in the same order."],
  parentScript: "First bath, then book, then lights.",
  avoid: ["Adding new steps at the last minute."],
  observe: ["Which step the standoff starts at."],
  escalateIf: ["Sleep stays disrupted for several weeks."],
  frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "f" },
  memoryProposals: [],
  handoffNotes: { teacher: "", professional: "" },
  sourceCardsUsed,
});

let cited: string[] = [];
const stubModelProvider = {
  async *generateJsonStream() {
    yield JSON.stringify(contractFor(cited));
  },
  async generateJson(options: any) {
    if (options?.route === "creative_low_risk") {
      return { takeaway: "Predictable steps help a small child settle.", suggestion: "Keep the order the same." };
    }
    return { safe: true, reason: "" };
  },
  async *streamText() { yield ""; },
} as unknown as ModelProvider;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const config = createTestConfig();
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter({
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
  }));
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

beforeEach(() => { cited = []; });

const CHILD = { id: "c1", name: "Mia", age: 4 };

async function post(route: "chat" | "council"): Promise<{ text: string; contract: Record<string, any> }> {
  const res = await fetch(`${baseUrl}/api/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "How do I handle the bedtime standoff?",
      childProfile: CHILD,
      scholarLens: "Integrated Balanced",
      ...(route === "council" ? { contextChildId: CHILD.id } : {}),
    }),
  });
  expect(res.status).toBe(200);
  return res.json();
}

for (const route of ["chat", "council"] as const) {
  describe(`/api/${route} shown sources (B-AI-11)`, () => {
    it("cites a subset of the supplied cards → only that subset is shown", async () => {
      // Learn the supplied set, then cite one card from it.
      const probe = await post(route);
      const supplied: string[] = probe.contract.suppliedCardIds;
      // Negative control: the route really supplied several cards.
      expect(supplied.length).toBeGreaterThan(1);
      cited = [supplied[supplied.length - 1]];
      const { contract } = await post(route);
      expect(contract.sourceCardsUsed).toEqual(cited);
      expect(contract.sourceCards.map((c: { id: string }) => c.id)).toEqual(cited);
      expect(contract.suppliedCardIds).toEqual(supplied);
    });

    it("cites none → no shown sources, never every supplied id", async () => {
      const { text, contract } = await post(route);
      expect(contract.suppliedCardIds.length).toBeGreaterThan(0);
      expect(contract.sourceCardsUsed).toEqual([]);
      expect(contract.sourceCards).toEqual([]);
      expect(contract.citedCardIds).toEqual([]);
      for (const id of contract.suppliedCardIds) expect(text).not.toContain(`- ${id}`);
    });

    it("cites an unknown id → dropped from shown sources, kept as a raw citation", async () => {
      const probe = await post(route);
      const known = probe.contract.suppliedCardIds[0];
      cited = ["made-up-card-id", known];
      const { text, contract } = await post(route);
      expect(contract.sourceCardsUsed).toEqual([known]);
      expect(contract.sourceCards.map((c: { id: string }) => c.id)).toEqual([known]);
      expect(contract.citedCardIds).toEqual(["made-up-card-id", known]);
      expect(text).not.toContain("made-up-card-id");
    });
  });
}
