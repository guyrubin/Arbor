/**
 * B-AI-14 (coach-core 1.5.1) — a routine /chat answer is never routed to the
 * crisis surface by the model's OWN escalateIf threshold line.
 *
 * Live coach-core-v1 on 1813b2e8: "How do I handle the bedtime standoff?"
 * (input screen null, not seeded) came back as the self-harm crisis surface.
 * escalateIf-drop rule ratified by the orchestrator 6 Oct (four conditions):
 *  (1) a flagged PROSE span keeps routing to crisis exactly as today;
 *  (2) the seeded path is unchanged (prompt parity pin in ai/prompts.test.ts;
 *      here: a seeded turn never runs the drop);
 *  (3) NAMED scenarios below — "prose-flagged → crisis" and
 *      "escalateIf-only → dropped + logged" (counter asserted) — plus the
 *      judge's sentence as the negative control;
 *  (4) the judge's transcript field is synthetic-only (evals/README.md).
 *
 * Stubbed provider (no network). The live phrase the orchestrator quoted
 * ("If he ever talks about wanting to hurt himself, call a crisis line") does
 * NOT trip the lexical floor (a help-directive frame exempts it), so the
 * fixtures use a sentence the floor does flag; the probe is pinned below.
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
import type { ModelProvider } from "../ai/modelRouter.js";
import { hardMomentCards } from "../content/hardMomentCards.js";
import { hardMomentEvalSeedMessage } from "../eval/acceptance.js";
import { screenForImmediateEscalation } from "../safety/escalation.js";
import { screenModelOutputLexical } from "../safety/outputScreen.js";
import { NEUTRAL_THRESHOLD_LINE, crisisThresholdIndices, routineThresholdDropCount, withoutCrisisThresholds } from "../safety/routineThresholds.js";

const BEDTIME = "How do I handle the bedtime standoff?";
/** A model-authored threshold the crisis floor flags on its own (self_harm). */
const CRISIS_THRESHOLD = "If she talks about suicide or self-harm, get urgent support.";
const ROUTINE_THRESHOLD = "If bedtime battles happen most nights for several weeks, talk it through with your pediatrician.";

const CONTRACT = {
  text: "Bedtime standoffs are common and tiring. A short, predictable routine helps. Keep the lights low.",
  riskLevel: "Low",
  ageBand: "3-4",
  domains: ["social_emotional"],
  nonDiagnosticHypotheses: [{ label: "Testing limits at bedtime", confidence: "one possibility", rationale: "Common at this age." }],
  todayPlan: ["Offer two choices about pyjamas, then start the same three steps."],
  parentScript: "It's bedtime. Do you want the blue or the green pyjamas?",
  avoid: ["Long negotiations."],
  observe: ["What happens right before the standoff."],
  escalateIf: [ROUTINE_THRESHOLD],
  frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "f" },
  memoryProposals: [],
  handoffNotes: { teacher: "t", professional: "p" },
  sourceCardsUsed: [],
};
let modelJson = JSON.stringify(CONTRACT);
const withContract = (patch: Record<string, unknown>) => {
  modelJson = JSON.stringify({ ...CONTRACT, ...patch });
};

const stubModelProvider = {
  async *generateJsonStream() {
    yield modelJson;
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
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  modelJson = JSON.stringify(CONTRACT);
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

type Payload = {
  text: string;
  riskLevel?: string;
  outputBlocked?: boolean;
  blockedCategory?: string;
  escalationCategory?: string;
  contract?: { escalateIf: string[]; text?: string; governedEscalation?: string };
};

const post = async (message: string, sse: boolean, language: "en" | "he" = "en"): Promise<{ payload: Payload; raw: string }> => {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: sse ? { "Content-Type": "application/json", Accept: "text/event-stream" } : { "Content-Type": "application/json" },
    body: JSON.stringify({ message, childProfile: { id: "eval-synthetic-child", name: "Noa", age: 4 }, language }),
  });
  expect(res.status).toBe(200);
  if (!sse) {
    const payload = (await res.json()) as Payload;
    return { payload, raw: JSON.stringify(payload) };
  }
  const raw = await res.text();
  const done = raw.split("\n\n").find((frame) => frame.startsWith("event: done\n"));
  expect(done, "SSE stream had no done frame").toBeDefined();
  return { payload: JSON.parse(done!.split("\n").find((l) => l.startsWith("data: "))!.slice(6)) as Payload, raw };
};

const isCrisis = (p: Payload) => p.riskLevel === "urgent" && p.blockedCategory === "crisis";

describe("B-AI-14 (coach-core 1.5.1) — fixtures and the input-side negative control", () => {
  it("NEGATIVE CONTROL: the judge's exact sentence trips no input screen", () => {
    expect(screenForImmediateEscalation({ message: BEDTIME })).toBeNull();
  });

  it("the fixture threshold trips the crisis floor on its own; the routine and neutral lines do not; the orchestrator's live phrase is exempt (help directive)", () => {
    expect(screenModelOutputLexical(CRISIS_THRESHOLD).category).toBe("crisis");
    expect(screenModelOutputLexical(ROUTINE_THRESHOLD).flagged).toBe(false);
    expect(screenModelOutputLexical(NEUTRAL_THRESHOLD_LINE.en).flagged).toBe(false);
    expect(screenModelOutputLexical(NEUTRAL_THRESHOLD_LINE.he).flagged).toBe(false);
    expect(screenModelOutputLexical("If he ever talks about wanting to hurt himself, call a crisis line").flagged).toBe(false);
  });

  it("withoutCrisisThresholds drops only the flagged entries, never mutates, fills an emptied slot with the neutral line", () => {
    const c = { escalateIf: [CRISIS_THRESHOLD, ROUTINE_THRESHOLD] };
    expect(crisisThresholdIndices(c.escalateIf)).toEqual([0]);
    expect(withoutCrisisThresholds(c, "en")).toEqual({ contract: { escalateIf: [ROUTINE_THRESHOLD] }, dropped: 1 });
    expect(c.escalateIf).toHaveLength(2);
    expect(withoutCrisisThresholds({ escalateIf: [CRISIS_THRESHOLD] }, "he").contract.escalateIf).toEqual([NEUTRAL_THRESHOLD_LINE.he]);
    expect(withoutCrisisThresholds({ escalateIf: [ROUTINE_THRESHOLD] }, "en").dropped).toBe(0);
  });
});

describe("B-AI-14 (coach-core 1.5.1) — route scenarios (stubbed provider)", () => {
  for (const sse of [false, true]) {
    it(`NEGATIVE CONTROL, ${sse ? "SSE" : "JSON"}: "${BEDTIME}" with a clean contract → the routine payload, no crisis category`, async () => {
      withContract({});
      const before = routineThresholdDropCount();
      const { payload } = await post(BEDTIME, sse);
      expect(payload.contract?.escalateIf).toEqual([ROUTINE_THRESHOLD]);
      expect(payload.blockedCategory).toBeUndefined();
      expect(payload.escalationCategory).toBeUndefined();
      expect(payload.outputBlocked).toBeUndefined();
      expect(payload.riskLevel).toBeUndefined();
      expect(routineThresholdDropCount()).toBe(before);
    });

    it(`escalateIf-only → dropped + logged, ${sse ? "SSE" : "JSON"}: the routine contract, the flagged entry gone, the counter +1`, async () => {
      withContract({ escalateIf: [CRISIS_THRESHOLD, ROUTINE_THRESHOLD] });
      const before = routineThresholdDropCount();
      try {
        const { payload, raw } = await post(BEDTIME, sse);
        expect(isCrisis(payload)).toBe(false);
        expect(payload.blockedCategory).toBeUndefined();
        expect(payload.contract?.escalateIf).toEqual([ROUTINE_THRESHOLD]);
        expect(raw.includes("suicide")).toBe(false);
        expect(routineThresholdDropCount()).toBe(before + 1);
      } finally {
        withContract({});
      }
    });
  }

  it("escalateIf-only, the ONLY threshold: dropped, the neutral line fills the slot (min-1 contract kept), counter +1", async () => {
    withContract({ escalateIf: [CRISIS_THRESHOLD] });
    const before = routineThresholdDropCount();
    try {
      const { payload } = await post(BEDTIME, false);
      expect(isCrisis(payload)).toBe(false);
      expect(payload.contract?.escalateIf).toEqual([NEUTRAL_THRESHOLD_LINE.en]);
      expect(routineThresholdDropCount()).toBe(before + 1);
    } finally {
      withContract({});
    }
  });

  for (const field of ["text", "parentScript"] as const) {
    it(`prose-flagged → crisis (${field}): the same sentence in prose still routes to the crisis surface, exactly as before; no drop counted`, async () => {
      const prose = field === "text" ? `${CONTRACT.text} ${CRISIS_THRESHOLD}` : CRISIS_THRESHOLD;
      withContract({ [field]: prose, escalateIf: [CRISIS_THRESHOLD] });
      const before = routineThresholdDropCount();
      try {
        const { payload } = await post(BEDTIME, false);
        expect(isCrisis(payload)).toBe(true);
        expect(payload.escalationCategory).toBe("self_harm");
        expect(payload.outputBlocked).toBe(true);
        expect(routineThresholdDropCount()).toBe(before);
      } finally {
        withContract({});
      }
    });
  }

  it("seeded path unchanged: a seeded turn never runs the drop (the governed line replaces escalateIf), and prose crisis still routes to crisis", async () => {
    const card = hardMomentCards.find((c) => c.id === "hitting")!;
    const seeded = hardMomentEvalSeedMessage(card, "en", "Noa", "What now?");
    const before = routineThresholdDropCount();
    withContract({ escalateIf: [CRISIS_THRESHOLD] });
    try {
      const plain = await post(seeded, false);
      expect(plain.payload.contract?.governedEscalation).toBe(card.escalation.en);
      expect(plain.payload.contract?.escalateIf).toEqual([]);
      withContract({ text: `${CONTRACT.text} ${CRISIS_THRESHOLD}`, escalateIf: [CRISIS_THRESHOLD] });
      const prose = await post(seeded, false);
      expect(isCrisis(prose.payload)).toBe(true);
      expect(routineThresholdDropCount()).toBe(before);
    } finally {
      withContract({});
    }
  });
});
