/**
 * POST /api/live/turn (VC-2 + VC-3, 2026-07-25 AI-excellence Wave 1) — route
 * tests against the REAL handler.
 *
 * Pins, per the firewall CONDITIONS:
 *  - role "user" → screenForImmediateEscalation (never a reimplementation);
 *    a self_harm transcript returns stop_crisis with renderEscalationMarkdown
 *    VERBATIM resources (containing 988) + the localized spoken redirect;
 *  - role "model" → screenModelOutput (the same function /chat and /voice
 *    gate on); flagged output returns stop_blocked + the /chat-parity blocked
 *    markdown;
 *  - EVERY turn is logged via logger.info("live.turn") with {requestId, uid,
 *    role, chars, verdictCategory} and NEVER the transcript text;
 *  - requireChildOwnership rejects a non-owner childId (403, fail closed);
 *  - a screening error is a 500, never a clean verdict (client fails closed).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { createApiRouter } from "./api.js";
import { createTestConfig } from "../testConfig.js";
import type { ArborConfig } from "../config/env.js";
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
import { logger } from "../server/logger.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import type { MemoryStore } from "../memory/types.js";

const stubModelProvider = {
  async *streamText() {
    yield "";
  },
  generateJson: async () => ({}),
  async *generateJsonStream() {
    yield "{}";
  },
} as unknown as ModelProvider;

const framework = loadFramework();

function buildApp(config: ArborConfig, opts: { memoryStore?: MemoryStore; user?: { uid: string } } = {}) {
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  if (opts.user) {
    app.use((req, _res, next) => {
      (req as any).user = opts.user;
      next();
    });
  }
  app.use(
    "/api",
    createApiRouter({
      config,
      modelProvider: stubModelProvider,
      memoryStore: opts.memoryStore ?? new LocalMemoryStore(),
      shareStore: new LocalShareStore(),
      consentStore: new LocalConsentStore(),
      framework,
      entitlementStore,
      referralStore: createReferralStore(config, entitlementStore),
      counters: createCounterStore(config),
      consultStore: createConsultStore(config),
      adminMetrics: createAdminMetricsStore(config),
      waitlistStore: createWaitlistStore(config),
    }),
  );
  return app;
}

async function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

const servers: Server[] = [];
let baseUrl = "";

beforeAll(async () => {
  const main = await listen(buildApp(createTestConfig()));
  servers.push(main.server);
  baseUrl = main.baseUrl;
});

afterAll(async () => {
  await Promise.all(
    servers.map((s) => new Promise<void>((resolve, reject) => s.close((e) => (e ? reject(e) : resolve())))),
  );
});

const infoSpy = vi.spyOn(logger, "info");
beforeEach(() => infoSpy.mockClear());

const postTurn = async (body: unknown, base = baseUrl) => {
  const res = await fetch(`${base}/api/live/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

const liveTurnLogs = () =>
  infoSpy.mock.calls.filter(([msg]) => msg === "live.turn").map(([, fields]) => fields as Record<string, unknown>);

describe("POST /api/live/turn — user role (VC-2)", () => {
  it("a self_harm transcript returns stop_crisis with verbatim resources containing 988", async () => {
    const text = "I am afraid I want to die";
    const { status, body } = await postTurn({ role: "user", text });
    expect(status).toBe(200);
    expect(body.action).toBe("stop_crisis");
    expect(body.category).toBe("self_harm");
    expect(body.resourcesMarkdown).toContain("988");
    expect(body.resourcesMarkdown).toContain("### Get help now");
    expect(typeof body.spokenText).toBe("string");
    // The spoken redirect restates no numbers — they travel in resourcesMarkdown.
    expect(body.spokenText).not.toContain("988");
  });

  it("language:'he' returns the Hebrew spoken redirect (VC-6 parity)", async () => {
    const { body } = await postTurn({ role: "user", text: "I want to die", language: "he" });
    expect(body.action).toBe("stop_crisis");
    expect(body.spokenText).toMatch(/[֐-׿]/);
  });

  it("a clean parent turn continues", async () => {
    const { status, body } = await postTurn({ role: "user", text: "Bedtime keeps taking an hour, what can I try?" });
    expect(status).toBe(200);
    expect(body).toEqual({ action: "continue" });
  });
});

describe("POST /api/live/turn — model role (VC-1/VC-3)", () => {
  it("a diagnostic model transcript returns stop_blocked with the /chat-parity markdown", async () => {
    const { status, body } = await postTurn({ role: "model", text: "Noah is autistic and needs therapy." });
    expect(status).toBe(200);
    expect(body.action).toBe("stop_blocked");
    expect(body.category).toBe("diagnosis");
    expect(body.blockedMarkdown).toContain("Let's pause here");
    expect(typeof body.spokenText).toBe("string");
  });

  it("a dosing model transcript is blocked too", async () => {
    const { body } = await postTurn({ role: "model", text: "Give 3 mg of melatonin before bed." });
    expect(body.action).toBe("stop_blocked");
    expect(body.category).toBe("medication");
  });

  it("language:'he' returns the Hebrew spoken blocked fallback", async () => {
    const { body } = await postTurn({ role: "model", text: "This indicates ADHD.", language: "he" });
    expect(body.action).toBe("stop_blocked");
    expect(body.spokenText).toMatch(/[֐-׿]/);
  });

  it("a clean model turn continues", async () => {
    const { body } = await postTurn({ role: "model", text: "Try naming the feeling and keeping the goodbye short." });
    expect(body).toEqual({ action: "continue" });
  });
});

describe("POST /api/live/turn — audit log (VC-3 condition 2)", () => {
  it("logs BOTH roles with {role, chars, verdictCategory} and never the transcript", async () => {
    const userText = "I want to die tonight honestly";
    const modelText = "Noah is autistic and needs therapy.";
    await postTurn({ role: "user", text: userText });
    await postTurn({ role: "model", text: modelText });
    await postTurn({ role: "user", text: "a clean check-in about bedtime" });

    const logs = liveTurnLogs();
    expect(logs.length).toBe(3);
    expect(logs[0]).toMatchObject({ role: "user", chars: userText.length, verdictCategory: "self_harm" });
    expect(logs[1]).toMatchObject({ role: "model", chars: modelText.length, verdictCategory: "diagnosis" });
    expect(logs[2]).toMatchObject({ role: "user", verdictCategory: null });
    for (const fields of logs) {
      expect(typeof fields.uid).toBe("string");
      expect(typeof fields.requestId).toBe("string");
      const serialized = JSON.stringify(fields);
      expect(serialized).not.toContain("want to die");
      expect(serialized).not.toContain("autistic");
      expect(serialized).not.toContain("bedtime");
    }
  });
});

describe("POST /api/live/turn — authorization + validation", () => {
  it("400s on a missing/invalid role or empty text", async () => {
    expect((await postTurn({ role: "system", text: "x" })).status).toBe(400);
    expect((await postTurn({ role: "user" })).status).toBe(400);
    expect((await postTurn({ role: "model", text: "   " })).status).toBe(400);
  });

  it("403s a childId the authenticated parent does not own (fail closed)", async () => {
    const notOwner = Object.assign(new LocalMemoryStore(), {
      ownsChild: async () => false,
    }) as unknown as MemoryStore;
    const denied = await listen(buildApp(createTestConfig(), { memoryStore: notOwner, user: { uid: "parent-a" } }));
    servers.push(denied.server);
    const { status } = await postTurn({ role: "user", text: "hello there", childId: "someone-elses-child" }, denied.baseUrl);
    expect(status).toBe(403);
  });

  it("owned childId passes through to the screen", async () => {
    const owner = Object.assign(new LocalMemoryStore(), {
      ownsChild: async () => true,
    }) as unknown as MemoryStore;
    const owned = await listen(buildApp(createTestConfig(), { memoryStore: owner, user: { uid: "parent-a" } }));
    servers.push(owned.server);
    const { status, body } = await postTurn({ role: "user", text: "a calm question about mornings", childId: "my-child" }, owned.baseUrl);
    expect(status).toBe(200);
    expect(body).toEqual({ action: "continue" });
  });

  it("uses the canonical screens, not a reimplementation (source guard)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(path.join(__dirname, "api.ts"), "utf8");
    const handler = /router\.post\("\/live\/turn"[\s\S]*?\n  \}\);/.exec(src)?.[0] ?? "";
    expect(handler).toContain("screenForImmediateEscalation({ text })");
    expect(handler).toContain("screenModelOutput(modelProvider, text)");
    expect(handler).toContain("renderEscalationMarkdown(match)");
    expect(handler).toContain("renderBlockedOutputMarkdown()");
    // Fail closed on unexpected screening errors: 500, never a clean verdict.
    expect(handler).toContain('res.status(500)');
    expect(handler).not.toMatch(/catch[\s\S]*action:\s*"continue"/);
  });
});
