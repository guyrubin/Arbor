/**
 * AI-CAP-2 + AI-CAP-3 — /api/extract-log route tests against the REAL handler
 * with a stubbed model provider.
 *
 * AI-CAP-2: the extraction prompt carries a Hebrew directive when
 * language==='he' (mirroring /chat's languageDirective) so a Hebrew parent's
 * draft comes back in Hebrew — while behaviorType/context stay schema-valued
 * for the AI-CAP-8 taxonomy mapping.
 *
 * AI-CAP-3 (firewall condition): the TYPED capture path reuses this endpoint;
 * its escalation screen must keep answering 409 + escalationCategory so the
 * client renders the crisis surface and writes ZERO draft fields.
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
import { CANONICAL_BEHAVIOR_TYPES } from "../content/behaviorTaxonomy.js";
import type { ModelProvider } from "../ai/modelRouter.js";

// Captured by the stub on every generateJson call.
let lastPrompt = "";
// Draft the stub returns — overridable per test.
let draft: Record<string, unknown> = {};

const stubModelProvider = {
  generateJson: async ({ prompt }: { prompt: string }) => {
    lastPrompt = prompt;
    return draft;
  },
  async *streamText() {
    yield "";
  },
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

const postExtract = async (body: unknown) => {
  const res = await fetch(`${baseUrl}/api/extract-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
};

const BASE = {
  message: "She screamed through the whole bath and I held her until she calmed down",
  childProfile: { id: "c1", name: "Test Child" },
};

describe("/api/extract-log language directive (AI-CAP-2)", () => {
  it("language:'he' injects the Hebrew directive into the prompt", async () => {
    lastPrompt = "";
    draft = { behaviorType: "Bath meltdown", intensity: 3, durationMinutes: 10, context: "Home", trigger: "אמבטיה", response: "החזקתי אותה", notes: "" };
    const { status } = await postExtract({ ...BASE, language: "he" });
    expect(status).toBe(200);
    expect(lastPrompt).toContain("עברית");
    expect(lastPrompt).toContain('Write "trigger", "response" and "notes" in natural, warm Hebrew');
    // behaviorType/context explicitly stay schema-valued — the taxonomy
    // mapping and clamps keep working on an HE draft.
    expect(lastPrompt).toContain('Keep "behaviorType" as a short English label');
  });

  it("no language (or 'en') keeps the prompt directive-free", async () => {
    lastPrompt = "";
    draft = { behaviorType: "Bath meltdown", intensity: 3, durationMinutes: 10, context: "Home", trigger: "", response: "", notes: "" };
    await postExtract(BASE);
    expect(lastPrompt).not.toContain("עברית");
    lastPrompt = "";
    await postExtract({ ...BASE, language: "en" });
    expect(lastPrompt).not.toContain("עברית");
  });

  it("the prompt names the canonical six from the shared taxonomy (AI-CAP-8)", async () => {
    lastPrompt = "";
    draft = { behaviorType: "X", intensity: 3, durationMinutes: 10, context: "Home", trigger: "", response: "", notes: "" };
    await postExtract(BASE);
    for (const type of CANONICAL_BEHAVIOR_TYPES) {
      expect(lastPrompt).toContain(type);
    }
  });
});

describe("/api/extract-log escalation contract for the typed path (AI-CAP-3)", () => {
  it("a crisis description answers 409 + escalationCategory and never reaches the model", async () => {
    lastPrompt = "__untouched__";
    const { status, json } = await postExtract({
      ...BASE,
      message: "I am thinking about suicide",
      language: "he",
    });
    expect(status).toBe(409);
    expect(json.escalationCategory).toBe("self_harm");
    // Fail-closed: the model is never consulted on an escalated input.
    expect(lastPrompt).toBe("__untouched__");
  });

  it("an empty message answers 400", async () => {
    const { status } = await postExtract({ childProfile: BASE.childProfile });
    expect(status).toBe(400);
  });

  it("a clean description passes the draft through", async () => {
    draft = { behaviorType: "Screen shutoff meltdown", intensity: 4, durationMinutes: 15, context: "Home", trigger: "tablet off", response: "stayed close", notes: "" };
    const { status, json } = await postExtract(BASE);
    expect(status).toBe(200);
    expect(json.behaviorType).toBe("Screen shutoff meltdown");
    expect(json.intensity).toBe(4);
  });
});

/* B-LOOP-06 — a moment becomes milestone EVIDENCE: the server builds the
   candidates (catalogue, in the child's window), the model may only choose
   among them, anything else is dropped, and a request without candidates is
   byte-identical to before (no block, no key). */
describe("/api/extract-log milestone match (B-LOOP-06)", () => {
  const birth = new Date();
  birth.setMonth(birth.getMonth() - 26);
  const TODDLER = { id: "c26", name: "Test Child", birthDate: birth.toISOString().slice(0, 10) };
  const LEGACY = { behaviorType: "Moment", intensity: 1, durationMinutes: 10, context: "Home", trigger: "said big ball", response: "", notes: "" };
  const ask = (ids: unknown, match: unknown) => {
    lastPrompt = "";
    draft = { ...LEGACY, milestoneMatch: match };
    return postExtract({ message: "She said big ball at the park", childProfile: TODDLER, milestoneCandidateIds: ids });
  };

  it("candidates are server-built: catalogue ids in the window only (no ahead-of-band, no unknown, no duplicates)", async () => {
    await ask(["cdc-24m-3", "cdc-24m-3", "cdc-18m-2", "cdc-36m-1", "custom-xyz", 42], null);
    expect(lastPrompt).toContain("Milestone match (optional)");
    expect(lastPrompt).toContain("- cdc-24m-3 · words · ");
    expect(lastPrompt).toContain("- cdc-18m-2 · ");
    expect(lastPrompt).not.toContain("cdc-36m-1");
    expect(lastPrompt).not.toContain("custom-xyz");
    expect(lastPrompt.match(/- cdc-24m-3 /g)?.length).toBe(1);
  });

  it("a listed id survives with the catalogue's shelf", async () => {
    const { status, json } = await ask(["cdc-24m-3", "cdc-24m-9"], { shelf: "feelings", milestoneId: "cdc-24m-3", confidence: "high" });
    expect(status).toBe(200);
    expect(json.milestoneMatch).toEqual({ shelf: "words", milestoneId: "cdc-24m-3", confidence: "high" });
  });

  it("a response with an id not in the candidate list is dropped", async () => {
    const { json } = await ask(["cdc-24m-3"], { shelf: "words", milestoneId: "cdc-36m-1", confidence: "high" });
    expect(json.milestoneMatch).toBeNull();
  });

  it("low confidence names the shelf only, never a milestone to tick; a bad shelf is dropped", async () => {
    expect((await ask(["cdc-24m-3"], { shelf: "words", milestoneId: "cdc-24m-3", confidence: "low" })).json.milestoneMatch).toEqual({ shelf: "words", confidence: "low" });
    expect((await ask(["cdc-24m-3"], { shelf: "sleep", confidence: "low" })).json.milestoneMatch).toEqual({ shelf: "sleep", confidence: "low" });
    expect((await ask(["cdc-24m-3"], { shelf: "behind", confidence: "low" })).json.milestoneMatch).toBeNull();
  });

  it("no candidates ⇒ no block in the prompt and no milestoneMatch key: the legacy fields byte for byte", async () => {
    lastPrompt = "";
    draft = { ...LEGACY };
    const { json } = await postExtract({ message: "She said big ball at the park", childProfile: TODDLER });
    expect(lastPrompt).not.toContain("Milestone match");
    expect("milestoneMatch" in json).toBe(false);
    expect(JSON.stringify(json)).toBe(JSON.stringify(LEGACY));
    // ids for a child with no age give no candidates either
    lastPrompt = "";
    await postExtract({ message: "She said big ball", childProfile: { id: "x", name: "N" }, milestoneCandidateIds: ["cdc-24m-3"] });
    expect(lastPrompt).not.toContain("Milestone match");
  });
});
