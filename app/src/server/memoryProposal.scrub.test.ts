import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  toParentWords,
  scrubMemoryProposals,
  isPlainParentWords,
  PLAIN_PARENT_WORDS_CLAUSE,
  SEVERITY_WORDS,
} from "./parentWordsScrub.js";
import { findClinicalDiagnosisTerm } from "../lib/clinicalScan.js";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApiRouter } from "../routes/api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { foldMemoryEvents } from "../memory/memoryService.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "./quotaStore.js";
import { createEntitlementStore } from "./entitlements.js";
import { createReferralStore } from "./referral.js";
import { createConsultStore } from "./consultRequests.js";
import { createAdminMetricsStore } from "./adminMetrics.js";
import { createWaitlistStore } from "./waitlist.js";
import type { ModelProvider } from "../ai/modelRouter.js";

/**
 * OBJ-JOURNAL-05 / OBJ-STORIES-01 — the two strings captured in the run,
 * verbatim, as the fixtures. Both reached a parent surface: the first as a
 * fact the parent was asked to approve, the second as the bedtime
 * "For the family" line.
 */
const CAPTURED_MEMORY_PROPOSAL =
  "Dylan experiences severe transition anxiety, which manifest as refusal to leave the house in the morning.";
const CAPTURED_BEDTIME_SUMMARY =
  "Today Dylan demonstrated impressive fine motor skills and sustained focus, along with a growing social connection.";

/** The vocabulary the item names as the thing that must not survive. */
const BANNED = /\b(severe|anxiety|deficit|impressive|demonstrated)\b/i;

describe("OBJ-JOURNAL-05 · negative control — the raw strings are what the scan rejects", () => {
  it("both captured strings carry the banned vocabulary before the scrub", () => {
    expect(BANNED.test(CAPTURED_MEMORY_PROPOSAL)).toBe(true);
    expect(BANNED.test(CAPTURED_BEDTIME_SUMMARY)).toBe(true);
    // …and both would pass through untouched on the pre-fix path, which is
    // exactly what shipping `structured.memoryProposals` straight to
    // appendMemoryProposals did.
    expect(isPlainParentWords(CAPTURED_MEMORY_PROPOSAL)).toBe(false);
    expect(isPlainParentWords(CAPTURED_BEDTIME_SUMMARY)).toBe(false);
  });
});

describe("OBJ-JOURNAL-05 · the memory proposal is scrubbed before render", () => {
  const scrubbed = toParentWords(CAPTURED_MEMORY_PROPOSAL);

  it("drops the severity adjective and the clinical noun", () => {
    expect(BANNED.test(scrubbed)).toBe(false);
    expect(scrubbed.toLowerCase()).not.toContain("severe");
    expect(scrubbed.toLowerCase()).not.toContain("anxiety");
    expect(scrubbed.toLowerCase()).not.toContain("manifest");
  });

  it("still says what was observed, and still names the child", () => {
    expect(scrubbed).toContain("Dylan");
    expect(scrubbed.toLowerCase()).toContain("hard time with changes");
    expect(scrubbed.toLowerCase()).toContain("refusal to leave the house");
  });

  it("is idempotent — scrubbing the scrubbed text changes nothing", () => {
    expect(toParentWords(scrubbed)).toBe(scrubbed);
    expect(isPlainParentWords(scrubbed)).toBe(true);
  });

  it("scrubMemoryProposals rewrites the fact and keeps the rest of the record", () => {
    const out = scrubMemoryProposals([
      { fact: CAPTURED_MEMORY_PROPOSAL, source: "chat", retention: "12m" },
    ]);
    expect(out).toHaveLength(1);
    expect(BANNED.test(out[0].fact)).toBe(false);
    expect(out[0].source).toBe("chat");
    expect(out[0].retention).toBe("12m");
  });

  it("fails closed: a proposal that cannot be put in parent words is DROPPED, not softened", () => {
    const out = scrubMemoryProposals([
      { fact: "Dylan has a diagnosis of autism spectrum disorder.", source: "chat", retention: "12m" },
      { fact: "Dylan likes to line up his cars before bed.", source: "chat", retention: "12m" },
    ]);
    expect(out.map((p) => p.fact)).toEqual(["Dylan likes to line up his cars before bed."]);
  });

  it("a non-array/absent proposal list yields an empty list, never a throw", () => {
    expect(scrubMemoryProposals(undefined)).toEqual([]);
    expect(scrubMemoryProposals(null)).toEqual([]);
  });
});

describe("OBJ-STORIES-01 · the bedtime 'For the family' line is scrubbed", () => {
  const scrubbed = toParentWords(CAPTURED_BEDTIME_SUMMARY);

  it("carries none of the banned vocabulary and no domain nouns", () => {
    expect(BANNED.test(scrubbed)).toBe(false);
    for (const noun of ["fine motor", "sustained focus", "social connection"]) {
      expect(scrubbed.toLowerCase()).not.toContain(noun);
    }
  });

  it("still reads as an observation of the day", () => {
    expect(scrubbed).toContain("Dylan");
    expect(scrubbed.toLowerCase()).toContain("showed");
    expect(scrubbed.length).toBeGreaterThan(20);
  });
});

describe("the scrub never leaves a clinical-diagnosis term standing", () => {
  it("every severity word is removed wherever it appears", () => {
    for (const w of SEVERITY_WORDS) {
      const out = toParentWords(`Dylan had a ${w} morning at the park.`);
      expect(out.toLowerCase(), `"${w}" survived`).not.toContain(w);
    }
  });

  it("output is always clean against the shared fail-closed scanner", () => {
    for (const raw of [CAPTURED_MEMORY_PROPOSAL, CAPTURED_BEDTIME_SUMMARY]) {
      expect(findClinicalDiagnosisTerm(toParentWords(raw))).toBeNull();
    }
  });

  it("empty in, empty out", () => {
    expect(toParentWords("")).toBe("");
    expect(toParentWords(null)).toBe("");
    expect(toParentWords(undefined)).toBe("");
  });
});

describe("the clause and the wiring are both present", () => {
  it("the clause names the two things it forbids", () => {
    expect(PLAIN_PARENT_WORDS_CLAUSE).toContain("plain parent words");
    expect(PLAIN_PARENT_WORDS_CLAUSE).toMatch(/No developmental domain nouns/);
    expect(PLAIN_PARENT_WORDS_CLAUSE).toMatch(/No severity or grading adjectives/);
  });

  it("routes/api.ts scrubs the chat memory-proposal call site and the bedtime summary", () => {
    const api = fs.readFileSync(path.resolve(__dirname, "..", "routes", "api.ts"), "utf8");
    const scrubbedCalls = api.match(/appendMemoryProposals\(memoryStore, childId, scrubMemoryProposals\(/g) ?? [];
    expect(scrubbedCalls).toHaveLength(1);
    expect(api).toContain("structured.memoryProposals = [];");
    expect(api).not.toMatch(/appendMemoryProposals\(memoryStore, childId, structured\.memoryProposals/);
    expect(api).toContain("PLAIN_PARENT_WORDS_CLAUSE");
    expect(api).toMatch(/\.summary = toParentWords\(/);
  });
});

/* ── B-CAREPRO-06 — the third write path: POST /memory/:childId/propose ──────
 * /chat and /council scrubbed at append; /propose appended the raw string.
 * Run against the REAL router with a local memory store. */
describe("B-CAREPRO-06 · /memory/:childId/propose stores the scrubbed text", () => {
  const memoryStore = new LocalMemoryStore();
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const config = createTestConfig();
    const entitlementStore = createEntitlementStore(config);
    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createApiRouter({
        config,
        modelProvider: {} as unknown as ModelProvider,
        memoryStore,
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

  const propose = (childId: string, fact: string) =>
    fetch(`${baseUrl}/api/memory/${childId}/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fact, source: "rhythm" }),
    });

  const stored = async (childId: string) =>
    foldMemoryEvents(await memoryStore.listEvents(childId), childId).map((i) => i.fact);

  it("the captured proposal is stored in plain parent words", async () => {
    const res = await propose("c-propose-1", CAPTURED_MEMORY_PROPOSAL);
    expect(res.status).toBe(200);
    const facts = await stored("c-propose-1");
    expect(facts).toHaveLength(1);
    expect(facts[0]).toBe(toParentWords(CAPTURED_MEMORY_PROPOSAL));
    expect(BANNED.test(facts[0])).toBe(false);
    // NEGATIVE CONTROL: what the pre-fix path stored is what the scan rejects.
    expect(BANNED.test(CAPTURED_MEMORY_PROPOSAL)).toBe(true);
  });

  it("a fact that cannot be put in parent words is not stored at all", async () => {
    const res = await propose("c-propose-2", "Dylan has a diagnosis of autism spectrum disorder.");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { items: unknown[] }).items).toEqual([]);
    expect(await stored("c-propose-2")).toEqual([]);
  });

  it("a plain parent fact is stored unchanged", async () => {
    await propose("c-propose-3", "Dylan likes to line up his cars before bed.");
    expect(await stored("c-propose-3")).toEqual(["Dylan likes to line up his cars before bed."]);
  });
});
