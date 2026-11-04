/* B-ASKJB-35 round 2 (critic P1) — mock mode (sandbox, demo, capture) must
 * answer a plan request with the PREPARED plan. The mock provider picks its
 * fixture by the route schema's required keys (ai/mockProvider CURATED
 * signature); when the plan schema dropped successIndicators without the
 * fixture following, every field read the generic schema filler ("A calm,
 * ordinary moment to notice."). This pins the pairing through the real route
 * and the real mock provider, and the route-only half that stays here: the
 * "signs it's working" list never reaches the parent (prompt and schema are
 * main's generate_plan 1.2.1; the prompt half is parked). Synthetic data. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
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
import { MockModelProvider, mockFixtureIdFor } from "../ai/mockProvider.js";
import { PROMPT_VERSIONS } from "../ai/prompts.js";
import type { GenerateJsonOptions, ModelProvider } from "../ai/modelRouter.js";

const seen: { schema?: unknown; version?: string } = {};
const mock = new MockModelProvider();
const provider = new Proxy(mock, {
  get(target, prop, receiver) {
    if (prop === "generateJson") {
      return (o: GenerateJsonOptions) => { seen.schema = o.schema; seen.version = o.promptVersion; return target.generateJson(o); };
    }
    const v = Reflect.get(target, prop, receiver);
    return typeof v === "function" ? v.bind(target) : v;
  },
}) as unknown as ModelProvider;

let server: Server;
let base = "";
beforeAll(async () => {
  const config = createTestConfig({ modelProvider: "mock" });
  const entitlements = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { uid: "synthetic-parent-mockplan" }; next(); });
  app.use("/api", createApiRouter({
    config, modelProvider: provider, memoryStore: new LocalMemoryStore(), shareStore: new LocalShareStore(), consentStore: new LocalConsentStore(),
    framework: loadFramework(), entitlementStore: entitlements, referralStore: createReferralStore(config, entitlements),
    counters: createCounterStore(config), consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config),
    waitlistStore: createWaitlistStore(config),
  }));
  server = await new Promise<Server>((done) => { const s = app.listen(0, "127.0.0.1", () => done(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((done) => server.close(() => done())); });

const plan = async (language: "en" | "he") => {
  const res = await fetch(`${base}/api/generate-plan`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeTopic: language === "he" ? "מעברים" : "Leaving the playground", childProfile: { id: "synthetic-child-mockplan", age: 4 }, language }) });
  return { status: res.status, body: (await res.json()) as { title?: string; phases?: { steps?: { text?: string }[] }[]; scripts?: { say?: string }[]; successIndicators?: unknown } };
};

describe("B-ASKJB-35 · mock mode answers a plan request with the prepared plan", () => {
  it("the schema the route sends is the one the plan fixture is keyed on (fails on the broken pairing)", async () => {
    await plan("en");
    expect(mockFixtureIdFor(seen.schema)).toBe("generate_plan");
    // NEGATIVE CONTROL: the schema without successIndicators (the parked 1.4.0
    // shape) matches NO fixture unless the fixture moves with it.
    const s = seen.schema as { required: string[] };
    expect(mockFixtureIdFor({ ...s, required: s.required.filter((k) => k !== "successIndicators") })).toBeNull();
    expect(seen.version).toBe(PROMPT_VERSIONS.generate_plan.version);
  });

  it("EN + HE: the prepared plan renders, never the generic filler", async () => {
    const en = await plan("en");
    expect(en.status).toBe(200);
    expect(en.body.title).toBe("Smoother switches");
    expect(en.body.phases?.[0]?.steps?.[0]?.text).toBe("Give a two-minute heads-up.");
    expect(en.body.scripts?.[0]?.say).toBe("Two more minutes, then we wash hands.");
    const he = await plan("he");
    expect(he.body.title).toBe("מעברים רכים יותר");
    expect(JSON.stringify([en.body, he.body])).not.toContain("A calm, ordinary moment to notice.");
  });

  it("route half (stays here): the signs-it's-working list never reaches the parent, though the fixture carries one", async () => {
    const { body } = await plan("en");
    expect(body.successIndicators).toEqual([]);
    expect(PROMPT_VERSIONS.generate_plan.version).toBe("1.2.1");
  });
});
