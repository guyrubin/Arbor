/**
 * GD-1 reviewer-preview — route-level tests against the REAL /api/entitlement
 * handler (the existing authenticated bootstrap payload the client reads via
 * useEntitlement). What this pins:
 *
 *  1. The reviewer flag flows ONLY to the allow-listed email: a non-reviewer
 *     authenticated payload NEVER carries clinicalReviewer:true.
 *  2. No draft egress rides along: the bootstrap payload contains none of the
 *     draft hard-moment copy (bundle presence of content/hardMomentCards.ts is
 *     a PRE-EXISTING property of the client build gated at the render layer;
 *     the server must not add an egress path).
 *  3. FAIL-CLOSED: with CLINICAL_REVIEWER_EMAILS unset (empty list) nobody —
 *     including the reviewer's own email — gets the flag.
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
import { hardMomentCards } from "../content/hardMomentCards.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import type { ArborConfig } from "../config/env.js";

const REVIEWER = "reviewer@example.com";

const stubModelProvider = {
  async *streamText() { yield ""; },
  generateJson: async () => ({}),
  async *generateJsonStream() { yield "{}"; },
} as unknown as ModelProvider;

const buildApp = (config: ArborConfig) => {
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  // Test-only auth injection: the header stands in for the verified Firebase
  // token the prod authMiddleware would have resolved to req.user.
  app.use((req, _res, next) => {
    const email = req.headers["x-test-email"];
    if (typeof email === "string" && email) {
      (req as any).user = { uid: `uid-${email}`, email };
    }
    next();
  });
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
  return app;
};

let allowServer: Server;
let allowBase: string;
let emptyServer: Server;
let emptyBase: string;

beforeAll(async () => {
  const allowApp = buildApp(createTestConfig({ clinicalReviewerEmails: [REVIEWER] }));
  const emptyApp = buildApp(createTestConfig()); // CLINICAL_REVIEWER_EMAILS unset → []
  await new Promise<void>((resolve) => { allowServer = allowApp.listen(0, "127.0.0.1", resolve); });
  await new Promise<void>((resolve) => { emptyServer = emptyApp.listen(0, "127.0.0.1", resolve); });
  allowBase = `http://127.0.0.1:${(allowServer.address() as AddressInfo).port}`;
  emptyBase = `http://127.0.0.1:${(emptyServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => allowServer.close((e) => (e ? reject(e) : resolve())));
  await new Promise<void>((resolve, reject) => emptyServer.close((e) => (e ? reject(e) : resolve())));
});

const getEntitlement = async (base: string, email?: string) => {
  const res = await fetch(`${base}/api/entitlement`, {
    headers: email ? { "x-test-email": email } : {},
  });
  const raw = await res.text();
  return { status: res.status, raw, body: JSON.parse(raw) as Record<string, unknown> };
};

describe("/api/entitlement — reviewer flag (GD-1)", () => {
  it("carries clinicalReviewer:true ONLY for the allow-listed reviewer email", async () => {
    const { status, body } = await getEntitlement(allowBase, REVIEWER);
    expect(status).toBe(200);
    expect(body.clinicalReviewer).toBe(true);
  });

  it("matches case-insensitively (login email casing must not lock the reviewer out)", async () => {
    const { body } = await getEntitlement(allowBase, "Reviewer@Example.COM");
    expect(body.clinicalReviewer).toBe(true);
  });

  it("a non-reviewer authenticated payload NEVER carries clinicalReviewer:true", async () => {
    const { status, body, raw } = await getEntitlement(allowBase, "parent@example.com");
    expect(status).toBe(200);
    expect(body.clinicalReviewer).toBe(false);
    expect(raw).not.toContain('"clinicalReviewer":true');
  });

  it("an unauthenticated request never carries the flag", async () => {
    const { body, raw } = await getEntitlement(allowBase);
    expect(body.clinicalReviewer).toBe(false);
    expect(raw).not.toContain('"clinicalReviewer":true');
  });

  it("FAIL-CLOSED: with CLINICAL_REVIEWER_EMAILS unset even the reviewer email gets false", async () => {
    const { status, body, raw } = await getEntitlement(emptyBase, REVIEWER);
    expect(status).toBe(200);
    expect(body.clinicalReviewer).toBe(false);
    expect(raw).not.toContain('"clinicalReviewer":true');
  });
});

describe("/api/entitlement — no draft egress rides the bootstrap", () => {
  it("the payload contains no draft hard-moment copy, for any caller", async () => {
    for (const email of [REVIEWER, "parent@example.com", undefined]) {
      const { raw } = await getEntitlement(allowBase, email);
      for (const card of hardMomentCards) {
        expect(raw, `payload leaked card "${card.id}" title`).not.toContain(card.title.en);
        expect(raw, `payload leaked card "${card.id}" HE title`).not.toContain(card.title.he);
        expect(raw, `payload leaked card "${card.id}" escalation`).not.toContain(card.escalation.en);
      }
    }
  });
});
