/**
 * B-ASKJB-27 — plans generated from the record: behaviour counts, approved
 * facts, past outcomes. Real /api/generate-plan handler, stub model, stub
 * memory store and stub action ledger (the analyzeBehavior.language harness).
 *
 * Guy G6: moment text stays OFF — the counts carry a canonical type and a
 * whole number, nothing else, and the server re-validates that shape. Private
 * mode and a refused memory permission render NO memory block. A step the
 * parent reported "not today" twice is named as avoid-repeating-unchanged.
 * Also the offline gate of evals/plan-v1.eval.json.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApiRouter } from "./api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import type { MemoryLedgerEvent, MemoryStore } from "../memory/types.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "../server/quotaStore.js";
import { createEntitlementStore } from "../server/entitlements.js";
import { createReferralStore } from "../server/referral.js";
import { createConsultStore } from "../server/consultRequests.js";
import { createAdminMetricsStore } from "../server/adminMetrics.js";
import { createWaitlistStore } from "../server/waitlist.js";
import type { CompanionLedgerSource } from "../server/companionContext.js";
import { PROMPT_VERSIONS, buildGeneratePlanPrompt } from "../ai/prompts.js";
import { recentTypeCounts, sanitizeTypeCounts } from "../lib/planRecord.js";

const seen: { plan?: string; version?: string } = {};
const provider = {
  generateJson: async ({ prompt, promptVersion }: { prompt: string; promptVersion?: string }) => {
    if (prompt.includes("Generate a structured, non-diagnostic Arbor action plan")) {
      seen.plan = prompt;
      seen.version = promptVersion;
      return { title: "Calmer exits", issue: "Transitions", phases: [{ name: "Week one", description: "Warn first", steps: [{ text: "Two-minute warning", completed: false }] }], scripts: [], successIndicators: ["Fewer tears at the gate"] };
    }
    return { safe: true, reason: "" };
  },
  async *generateJsonStream() { yield "{}"; },
  async *streamText() { yield ""; },
} as unknown as ModelProvider;

const now = Date.now();
const FACT = "Transitions go better with a visual timer";
const fact: MemoryLedgerEvent = {
  eventId: "e1", memoryId: "m1", familyId: "f", childId: "child-a", fact: FACT,
  status: "approved", eventType: "approved", createdAt: new Date(now - 86_400_000).toISOString(), source: "parent", retention: "3 months", actor: "parent",
};
// ownsChild: parent-a owns child-a only — child-z is someone else's child.
const store: MemoryStore = {
  listEvents: async () => [fact], appendEvent: async () => {}, eraseChild: async () => 0,
  ownsChild: async (uid: string, childId: string) => uid === "parent-a" && childId === "child-a",
} as MemoryStore;
const ledger: CompanionLedgerSource = {
  load: async (uid, childId) => (uid === "parent-a" && childId === "child-a"
    ? {
        actionLoops: [
          { recommendation: "Leave with a song", source: "plan", status: "completed", outcome: "not_today", acceptedAt: new Date(now - 3 * 86_400_000).toISOString() },
          { recommendation: "Leave with a song", source: "plan", status: "completed", outcome: "not_today", acceptedAt: new Date(now - 2 * 86_400_000).toISOString() },
          { recommendation: "Two-minute warning", source: "plan", status: "completed", outcome: "helped", acceptedAt: new Date(now - 86_400_000).toISOString() },
        ],
        insights: [],
      }
    : { actionLoops: [], insights: [] }),
};

let server: Server;
let base: string;
beforeAll(async () => {
  const config = createTestConfig();
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { uid: "parent-a" }; next(); });
  app.use("/api", createApiRouter({
    config, modelProvider: provider, memoryStore: store, shareStore: new LocalShareStore(),
    consentStore: new LocalConsentStore(), framework: loadFramework(), entitlementStore,
    referralStore: createReferralStore(config, entitlementStore), counters: createCounterStore(config),
    consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config), waitlistStore: createWaitlistStore(config),
    companionLedgerSource: ledger,
  }));
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = (body: unknown) =>
  fetch(`${base}/generate-plan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const MEMORY_HEADER = "Parent-approved facts about this child";

describe("B-ASKJB-27 — the plan reads the record", () => {
  it("counts reach the prompt as type: number only; the prompt version is 1.2.0", async () => {
    const res = await post({
      challengeTopic: "transitions", childProfile: { id: "child-a", age: 4 },
      recentTypeCounts: [{ type: "Transition Refusal", count: 6 }, { type: "Sleep Meltdown", count: 2 }],
    });
    expect(res.status).toBe(200);
    expect(seen.plan).toContain("What the parent logged in the last 21 days");
    expect(seen.plan).toContain('- "Transition Refusal": 6');
    expect(seen.plan).toContain('- "Sleep Meltdown": 2');
    expect(seen.version).toBe("1.2.1");
    expect(PROMPT_VERSIONS.generate_plan.version).toBe("1.2.1");
  });

  it("counts NEVER include text: free-text types, text fields and non-integers are dropped", async () => {
    await post({
      challengeTopic: "transitions", childProfile: { id: "child-a", age: 4 },
      recentTypeCounts: [
        { type: "bit his sister at dinner SENTINEL-TYPE", count: 3 },
        { type: "Transition Refusal", count: 2, notes: "SENTINEL-NOTE" },
        { type: "Sibling Conflict", count: 2.5 },
        { type: "Moment", count: 9 },
        "SENTINEL-STRING",
      ],
    });
    expect(seen.plan).not.toContain("SENTINEL");
    expect(seen.plan).toContain('- "Transition Refusal": 2');
    expect(seen.plan).not.toContain('"Sibling Conflict"');
    expect(seen.plan).not.toContain('"Moment"');
  });

  it("approved facts reach the prompt when the parent may read this child's memory", async () => {
    await post({ challengeTopic: "transitions", childProfile: { id: "child-a", age: 4 } });
    expect(seen.plan).toContain(MEMORY_HEADER);
    expect(seen.plan).toContain(FACT);
  });

  it("private mode → no memory block", async () => {
    await post({ challengeTopic: "transitions", childProfile: { id: "child-a", age: 4 }, privateMode: true });
    expect(seen.plan).not.toContain(MEMORY_HEADER);
    expect(seen.plan).not.toContain(FACT);
  });

  it("no memory permission → no memory block (another family's child)", async () => {
    await post({ challengeTopic: "transitions", childProfile: { id: "child-z", age: 4 } });
    expect(seen.plan).not.toContain(MEMORY_HEADER);
    expect(seen.plan).not.toContain(FACT);
  });

  it("a step reported 'not today' twice is named as avoid-repeating-unchanged; a helped step is not", async () => {
    await post({ challengeTopic: "transitions", childProfile: { id: "child-a", age: 4 } });
    const block = seen.plan!.slice(seen.plan!.indexOf("twice or more"));
    expect(seen.plan).toContain('Steps the parent reported "not today" twice or more. Avoid repeating these unchanged');
    expect(block).toContain('- "Leave with a song"');
    expect(block.split("Return JSON")[0]).not.toContain("Two-minute warning");
  });

  it("no counts and no twice-not-today → the 1.1.0 bytes (block-free parity)", () => {
    const args = { developmentalFramework: "FW", childProfile: { age: 4 }, challengeTopic: "t", approvedFacts: ["f"] };
    expect(buildGeneratePlanPrompt({ ...args, recentTypeCounts: [] })).toBe(buildGeneratePlanPrompt(args));
    const once = [{ recommendation: "x", status: "completed" as const, outcome: "not_today" as const, acceptedAt: "2026-10-01" }];
    expect(buildGeneratePlanPrompt({ ...args, pastSteps: once })).not.toContain("twice or more");
  });
});

describe("B-ASKJB-27 — lib/planRecord (client counts, server sanitizer)", () => {
  const at = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();
  it("counts canonical non-Moment types over 21 days, newest window only, most first", () => {
    const logs = [
      { behaviorType: "Transition Refusal", timestamp: at(1), notes: "TEXT" },
      { behaviorType: "Transition Refusal", timestamp: at(20) },
      { behaviorType: "Transition Refusal", timestamp: at(22) },
      { behaviorType: "Sleep Meltdown", timestamp: at(3) },
      { behaviorType: "Moment", timestamp: at(1) },
      { behaviorType: "a custom free label", timestamp: at(1) },
    ];
    expect(recentTypeCounts(logs, now)).toEqual([{ type: "Transition Refusal", count: 2 }, { type: "Sleep Meltdown", count: 1 }]);
    expect(JSON.stringify(recentTypeCounts(logs, now))).not.toContain("TEXT");
  });
  it("the sanitizer keeps one row per canonical type and caps the count", () => {
    expect(sanitizeTypeCounts([{ type: "Food Refusal", count: 5000 }, { type: "Food Refusal", count: 1 }])).toEqual([{ type: "Food Refusal", count: 999 }]);
    expect(sanitizeTypeCounts("nope")).toEqual([]);
    expect(sanitizeTypeCounts([{ type: "Food Refusal", count: 0 }])).toEqual([]);
  });
  it("PlansTab's context sends the counts (source scan)", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const ctx = readFileSync(path.resolve(here, "../context/ArborContext.tsx"), "utf8");
    expect(ctx).toContain("recentTypeCounts: recentTypeCounts(behaviorLogs, Date.now())");
  });
});

describe("B-ASKJB-27 — plan-v1 (the deterministic stub suite) is authored against this route", () => {
  it("names generate_plan 1.2.0 and covers counts, HE, approved fact, private mode, isolation, safety-trip", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const suite = JSON.parse(readFileSync(path.resolve(here, "..", "..", "..", "evals", "plan-v1.eval.json"), "utf8")) as {
      suite: string; promptVersions: Record<string, string>; scenarios: { id: string; route?: string; safetyMustHold?: boolean }[];
    };
    expect(suite.suite).toBe("plan-v1");
    expect(suite.promptVersions.generate_plan).toBe(PROMPT_VERSIONS.generate_plan.version);
    const ids = suite.scenarios.map((s) => s.id);
    for (const required of ["counts-grounded-en", "counts-grounded-he", "approved-fact-used", "private-mode-no-memory", "two-child-isolation", "safety-trip"]) {
      expect(ids.some((id) => id.startsWith(required)), required).toBe(true);
    }
    for (const sc of suite.scenarios) {
      expect(sc.route).toBe("/api/generate-plan");
      expect(sc.safetyMustHold).toBe(true);
    }
  });
});
