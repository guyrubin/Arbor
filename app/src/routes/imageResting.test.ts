/**
 * B-KID-05 — image quota tells the truth ("resting", not "busy").
 *
 * Every image failure used to answer 503 "Image creation is busy… try again in
 * a moment" + Retry-After 15, including a spent quota that will not clear
 * until tomorrow. Driven against the REAL /generate-avatar handler with a
 * stubbed provider: quota exhaustion → 429 {code:"image_resting"} with NO
 * Retry-After; a transient overload keeps 503 + Retry-After 15.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApiRouter } from "./api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore, MemoryCounterStore } from "../server/quotaStore.js";
import { createEntitlementStore } from "../server/entitlements.js";
import { createReferralStore } from "../server/referral.js";
import { createConsultStore } from "../server/consultRequests.js";
import { createAdminMetricsStore } from "../server/adminMetrics.js";
import { createWaitlistStore } from "../server/waitlist.js";
import { createImageQuota, IMAGE_RESTING, imageFailureResponse, isImageQuotaExhausted } from "../server/imageQuota.js";
import { isTransientModelError } from "../ai/modelRetry.js";
import type { ModelProvider } from "../ai/modelRouter.js";

let nextImageError: unknown = null;

const stubModelProvider = {
  generateJson: async () => ({}),
  generateImage: async () => {
    if (nextImageError) throw nextImageError;
    return { mimeType: "image/png", data: "AAAA" };
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

const postAvatar = async () => {
  const res = await fetch(`${baseUrl}/api/generate-avatar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ style: "comichero", descriptors: {} }),
  });
  return { status: res.status, retryAfter: res.headers.get("Retry-After"), json: (await res.json()) as Record<string, unknown> };
};

const QUOTA_ZERO = Object.assign(
  new Error("[429 Too Many Requests] RESOURCE_EXHAUSTED: Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-2.5-flash-image"),
  { status: 429 },
);
const OVERLOADED = Object.assign(new Error("[503 Service Unavailable] The model is overloaded. Please try again later."), { status: 503 });

describe("B-KID-05 · /generate-avatar failure codes", () => {
  it("provider quota `limit: 0` → 429 image_resting, NO Retry-After", async () => {
    nextImageError = QUOTA_ZERO;
    const { status, retryAfter, json } = await postAvatar();
    expect(status).toBe(429);
    expect(json.code).toBe(IMAGE_RESTING);
    expect(json.retryable).toBe(false);
    expect(retryAfter).toBeNull();
    expect(JSON.stringify(json)).not.toMatch(/busy|in a moment|limit: 0/i);
  });

  it("transient overload keeps 503 + Retry-After 15", async () => {
    nextImageError = OVERLOADED;
    const { status, retryAfter, json } = await postAvatar();
    expect(status).toBe(503);
    expect(retryAfter).toBe("15");
    expect(json.code).toBeUndefined();
    expect(json.retryable).toBe(true);
  });

  it("success still succeeds", async () => {
    nextImageError = null;
    const { status, json } = await postAvatar();
    expect(status).toBe(200);
    expect(String(json.dataUrl)).toMatch(/^data:image\/png;base64,/);
  });
});

describe("B-KID-05 · the classifier and our own daily caps", () => {
  it("separates exhaustion from overload", () => {
    expect(isImageQuotaExhausted(QUOTA_ZERO)).toBe(true);
    expect(isImageQuotaExhausted(new Error("Quota exceeded for quota metric 'Images per day'"))).toBe(true);
    expect(isImageQuotaExhausted(OVERLOADED)).toBe(false);
    expect(isImageQuotaExhausted(new Error("RESOURCE_EXHAUSTED: rate limit, limit: 10"))).toBe(false);
    expect(imageFailureResponse(new Error("boom"), isTransientModelError, "fallback")).toEqual({ status: 500, body: { error: "fallback" } });
  });

  it("our per-user daily cap answers 429 image_resting with no Retry-After", async () => {
    process.env.IMAGE_GEN_DAILY_LIMIT = "1";
    const { vi } = await import("vitest");
    vi.resetModules();
    const fresh = (await import("../server/imageQuota.js")).createImageQuota;
    const mw = fresh(new MemoryCounterStore());
    const run = async () => {
      const res: any = { statusCode: 0, headers: {} as Record<string, string>, body: undefined,
        setHeader(k: string, v: string) { this.headers[k] = v; },
        status(c: number) { this.statusCode = c; return this; },
        json(p: unknown) { this.body = p; return this; } };
      let passed = false;
      await mw({ user: { uid: "kid-parent" } } as any, res, () => { passed = true; });
      return { res, passed };
    };
    expect((await run()).passed).toBe(true);
    const blocked = await run();
    expect(blocked.passed).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    expect(blocked.res.body.code).toBe(IMAGE_RESTING);
    expect(blocked.res.headers["Retry-After"]).toBeUndefined();
    delete process.env.IMAGE_GEN_DAILY_LIMIT;
    expect(typeof createImageQuota).toBe("function");
  });
});

describe("B-KID-05 · the client says 'resting' and offers no retry", () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");

  it("lib/api turns the code into a typed ApiError; isImageResting matches by code", async () => {
    const api = read("lib/api.ts");
    expect(api).toContain('if (res.status === 429 && errData?.code === IMAGE_RESTING) {');
    expect(api).toContain("throw new ApiError(IMAGE_RESTING, 429);");
    const mod = await import("../lib/api.js");
    expect(mod.IMAGE_RESTING).toBe(IMAGE_RESTING);
    expect(mod.isImageResting(new mod.ApiError(IMAGE_RESTING, 429))).toBe(true);
    expect(mod.isImageResting(new mod.ApiError("Image creation is busy.", 503))).toBe(false);
  });

  it("HeroFirstStep shows the resting line, hides the create door, keeps Continue with Sprout", () => {
    const step = read("components/kidmode/HeroFirstStep.tsx");
    const creator = read("components/profile/AvatarCreator.tsx");
    expect(creator).toContain("if (isImageResting(err)) {");
    expect(creator).toContain('return t("elev.hero.resting");');
    expect(step).toContain("onResting={() => {");
    expect(step).toContain('{t("elev.hero.resting")}');
    expect(step).toContain("{!resting && (");
    expect(step).toContain('data-testid="hero-step-continue"');
  });

  it("the copy ships EN + HE and never says busy / try again", async () => {
    const { en, he } = await import("../lib/i18nElevation/heroCreate.js");
    expect(en["elev.hero.resting"]).toMatch(/resting today/);
    expect(en["elev.hero.resting"]).toMatch(/Sprout/);
    expect(en["elev.hero.resting"]).not.toMatch(/busy|try again|moment/i);
    expect(he["elev.hero.resting"]).toMatch(/[֐-׿]/);
    expect(he["elev.hero.resting"]).toContain("ספראוט");
  });
});
