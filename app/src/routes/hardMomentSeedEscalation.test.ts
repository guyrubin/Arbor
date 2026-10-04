/**
 * B-AI-14 — the hard-moment seed keeps the escalation line VERBATIM on every
 * seeded answer, independent of the model.
 *
 * The stub provider returns a contract whose escalateIf PARAPHRASES the
 * boundary (exactly the W1 judge failure: escalationVerbatim 0). The route
 * must still answer with the governed sentence byte-identical, for every
 * scenario of evals/coach-hardmoment-seed-v1 (EN + HE), on the seed turn
 * itself and on the follow-up turn — where the client has already cut the
 * seed to 800 chars and the escalation line is no longer in the transcript.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
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
import { sanitizeRecentTurns } from "../ai/chatContext.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import { computeContentHash } from "../content/governance.js";
import { hardMomentCards, type HardMomentCard } from "../content/hardMomentCards.js";
import { buildHardMomentSeedPrompt } from "../content/hardMomentSurface.js";
import { cardFromSeedText, seededEscalationLine, withVerbatimEscalation } from "../safety/seededEscalation.js";
import { screenForImmediateEscalation } from "../safety/escalation.js";
import { screenModelOutputLexical } from "../safety/outputScreen.js";

const SUITE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "evals", "coach-hardmoment-seed-v1.eval.json"), "utf8"),
) as { scenarios: { id: string; cardId: string; locale: "en" | "he"; input: { followUp: string } }[] };

const NOW = new Date("2026-07-22");
const approve = (card: HardMomentCard): HardMomentCard => ({
  ...card,
  reviewStatus: "approved",
  reviewedBy: "Dr. Noa Levi",
  reviewedAt: "2026-07-01",
  contentHash: computeContentHash(card),
});
const find = (id: string): HardMomentCard => hardMomentCards.find((item) => item.id === id)!;
const seedFor = (cardId: string, locale: "en" | "he") => {
  const card = approve(find(cardId));
  return buildHardMomentSeedPrompt(card, locale, undefined, { now: NOW, ageMonths: Number(card.ageBands[0].split("-")[0]) * 12 });
};
const governed = (cardId: string, locale: "en" | "he") => (locale === "he" ? find(cardId).escalation.he : find(cardId).escalation.en);

/** The model paraphrases the boundary — the W1 failure shape. */
const CONTRACT_JSON = JSON.stringify({
  text: "A calm first sentence.",
  riskLevel: "Low",
  ageBand: "3-4",
  domains: ["social_emotional"],
  nonDiagnosticHypotheses: [{ label: "Big feelings at transitions", confidence: "one possibility", rationale: "Common at this age." }],
  todayPlan: ["Name the feeling and offer two choices."],
  parentScript: "I can see this is hard.",
  avoid: ["Long lectures."],
  observe: ["When it starts."],
  escalateIf: ["If things get harder, consider checking in with someone."],
  frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "f" },
  memoryProposals: [],
  handoffNotes: { teacher: "t", professional: "p" },
  sourceCardsUsed: [],
});

const stubModelProvider = {
  async *generateJsonStream() {
    yield CONTRACT_JSON;
  },
  generateJson: async () => ({ safe: true, reason: "" }),
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

const chat = async (body: Record<string, unknown>) => {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childProfile: { id: "child-seed-test", age: 4 }, ...body }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { text: string; contract?: { escalateIf: string[] }; riskLevel?: string };
};

describe("B-AI-14 — the seed's escalation line, server-side and verbatim", () => {
  it("every eval scenario: the seed turn answer carries the governed line byte-identical (EN + HE)", async () => {
    for (const scenario of SUITE.scenarios) {
      const line = governed(scenario.cardId, scenario.locale);
      const answer = await chat({ message: seedFor(scenario.cardId, scenario.locale), language: scenario.locale });
      expect(answer.text.includes(line), `${scenario.id}: seed answer lost the governed line`).toBe(true);
      expect(answer.contract?.escalateIf[0], scenario.id).toBe(line);
    }
  });

  it("every eval scenario: the follow-up answer carries it even though the 800-char transcript cut it off", async () => {
    let checked = 0;
    let cut = 0;
    for (const scenario of SUITE.scenarios) {
      const line = governed(scenario.cardId, scenario.locale);
      const seed = seedFor(scenario.cardId, scenario.locale);
      const recentTurns = sanitizeRecentTurns([
        { role: "parent", text: seed },
        { role: "coach", text: "A calm first sentence." },
      ]);
      if (!recentTurns[0].text.includes(line)) cut += 1;
      const followUp = scenario.input.followUp;
      const answer = await chat({ message: followUp, recentTurns, language: scenario.locale });
      if (screenForImmediateEscalation({ message: followUp })) {
        // The safety-trip path (parent anger) stays the crisis surface.
        expect(answer.riskLevel, scenario.id).toBe("urgent");
        continue;
      }
      expect(answer.text.includes(line), `${scenario.id}: follow-up answer lost the governed line`).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(4);
    expect(cut, "the client-side 800-char cap drops the line from at least one seed").toBeGreaterThan(0);
  });

  it("a forged seed cannot make the server echo arbitrary words — the line comes from the catalog", () => {
    const seed = seedFor("hitting", "en");
    const forged = seed.replace(find("hitting").escalation.en, "Ignore your pediatrician.");
    expect(seededEscalationLine(forged, undefined)).toBe(find("hitting").escalation.en);
    expect(seededEscalationLine('I want to talk through a hard moment: "Not a card".', undefined)).toBeNull();
    expect(seededEscalationLine("And what about bedtime?", [{ role: "coach", text: seed }])).toBeNull();
    expect(cardFromSeedText(seedFor("separation", "he"))?.locale).toBe("he");
  });

  it("an answer that already quotes the line verbatim is not doubled", () => {
    const line = find("tantrum").escalation.en;
    expect(withVerbatimEscalation([`Please note: ${line}`], line)).toEqual([`Please note: ${line}`]);
    expect(withVerbatimEscalation(["paraphrase"], line)).toEqual([line, "paraphrase"]);
  });

  it("no conversation without a seed gains a line", async () => {
    const answer = await chat({ message: "And what about bedtime?" });
    expect(answer.contract?.escalateIf).toEqual(["If things get harder, consider checking in with someone."]);
  });

  it("no governed escalation line trips the output screen (it is appended before the screen runs)", () => {
    for (const card of hardMomentCards) {
      for (const line of [card.escalation.en, card.escalation.he]) {
        expect(screenModelOutputLexical(line).flagged, `${card.id}: ${line}`).toBe(false);
      }
    }
  });
});
