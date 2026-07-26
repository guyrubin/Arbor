/**
 * AIR-9 — per-route deadline budgets against the REAL handlers.
 *
 *  - A stubbed never-resolving provider must produce a STRUCTURED CALM error
 *    within the route budget (504 JSON / SSE `error` event) — no indefinite
 *    parent-facing spinner, even when the provider ignores the AbortSignal
 *    entirely (the route races the budget at its own seam).
 *  - Aborting the client fetch must cancel the upstream call: the budget
 *    signal handed to the provider flips to aborted (spy).
 *
 * Budgets are env-tunable (ARBOR_BUDGET_<KIND>_MS) and read per-request, so
 * this suite shrinks them without module juggling.
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
import { newAbortError, type ModelCallBudget, type ModelProvider } from "../ai/modelRouter.js";

type StubMode = "respects_signal" | "ignores_signal";
let stubMode: StubMode = "respects_signal";
let receivedBudget: ModelCallBudget | undefined;

/** Never resolves. In `respects_signal` mode it rejects when the budget aborts
 *  (like the real providers); in `ignores_signal` mode it NEVER settles. */
const hang = (budget?: ModelCallBudget) =>
  new Promise<never>((_resolve, reject) => {
    if (stubMode === "respects_signal") {
      budget?.signal?.addEventListener("abort", () => reject(newAbortError()), { once: true });
    }
  });

const stubModelProvider = {
  generateJson: async (opts: { budget?: ModelCallBudget }) => {
    receivedBudget = opts.budget;
    return hang(opts.budget);
  },
  async *generateJsonStream(opts: { budget?: ModelCallBudget }) {
    receivedBudget = opts.budget;
    await hang(opts.budget);
    yield "";
  },
  async *streamText(opts: { budget?: ModelCallBudget }) {
    receivedBudget = opts.budget;
    await hang(opts.budget);
    yield "";
  },
} as unknown as ModelProvider;

let server: Server;
let baseUrl: string;

const BUDGET_ENV = ["ARBOR_BUDGET_ANALYSIS_MS", "ARBOR_BUDGET_COACH_MS", "ARBOR_BUDGET_VOICE_MS"] as const;
const PRIOR_ENV = Object.fromEntries(BUDGET_ENV.map((k) => [k, process.env[k]]));

beforeAll(async () => {
  process.env.ARBOR_BUDGET_ANALYSIS_MS = "200";
  process.env.ARBOR_BUDGET_COACH_MS = "200";
  process.env.ARBOR_BUDGET_VOICE_MS = "200";

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
  for (const k of BUDGET_ENV) {
    if (PRIOR_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = PRIOR_ENV[k];
  }
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

const CLEAN_BODY = {
  message: "She sang through the whole bath and we laughed together",
  childProfile: { id: "c1", name: "Test Child" },
};

describe("deadline expiry → structured calm error (AIR-9)", () => {
  it("/extract-log with a hung (signal-respecting) provider answers 504 calm within the budget", async () => {
    stubMode = "respects_signal";
    const t0 = Date.now();
    const res = await fetch(`${baseUrl}/api/extract-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CLEAN_BODY),
    });
    const elapsed = Date.now() - t0;
    const json = (await res.json()) as Record<string, string>;
    expect(res.status).toBe(504);
    expect(elapsed).toBeLessThan(5_000); // budget 200ms + slack, never a spinner
    // Calm parent register — no stack traces, no jargon, reassures the parent.
    expect(json.error).toMatch(/longer than usual/i);
    expect(json.details).toMatch(/Nothing is wrong with your question/i);
    expect(JSON.stringify(json)).not.toMatch(/abort|timeout|stack/i);
  });

  it("even a provider that IGNORES the signal cannot outlive the budget (route-seam race)", async () => {
    stubMode = "ignores_signal";
    const t0 = Date.now();
    const res = await fetch(`${baseUrl}/api/extract-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CLEAN_BODY),
    });
    expect(res.status).toBe(504);
    expect(Date.now() - t0).toBeLessThan(5_000);
  });

  it("/chat SSE emits a calm `error` event on deadline (never a dead stream)", async () => {
    stubMode = "respects_signal";
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(CLEAN_BODY),
    });
    const text = await res.text();
    expect(text).toContain("event: error");
    expect(text).toMatch(/longer than usual/i);
    expect(text).not.toMatch(/AbortError/);
  });
});

describe("client abort cancels the upstream call (AIR-9)", () => {
  it("aborting the client fetch flips the provider's budget signal to aborted", async () => {
    stubMode = "respects_signal";
    receivedBudget = undefined;
    // Long budget so ONLY the client abort can flip the signal.
    process.env.ARBOR_BUDGET_ANALYSIS_MS = "60000";
    try {
      const controller = new AbortController();
      const req = fetch(`${baseUrl}/api/extract-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(CLEAN_BODY),
        signal: controller.signal,
      }).catch(() => null);

      // Wait for the provider to receive the call, then hang up the client.
      for (let i = 0; i < 40 && !receivedBudget; i += 1) await new Promise((r) => setTimeout(r, 50));
      expect(receivedBudget?.signal).toBeTruthy();
      expect(receivedBudget!.signal!.aborted).toBe(false);
      controller.abort();
      await req;
      // The response 'close' handler aborts the upstream budget signal.
      for (let i = 0; i < 40 && !receivedBudget!.signal!.aborted; i += 1) await new Promise((r) => setTimeout(r, 50));
      expect(receivedBudget!.signal!.aborted).toBe(true);
    } finally {
      process.env.ARBOR_BUDGET_ANALYSIS_MS = "200";
    }
  });
});
