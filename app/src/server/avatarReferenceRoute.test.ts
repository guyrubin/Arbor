import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApiRouter } from "../routes/api.js";
import { createTestConfig } from "../testConfig.js";
import { loadFramework } from "../services/framework.js";
import { LocalMemoryStore } from "../memory/localMemoryStore.js";
import { LocalShareStore } from "../sharing/shares.js";
import { LocalConsentStore } from "../sharing/consent.js";
import { createCounterStore } from "./quotaStore.js";
import { createEntitlementStore } from "./entitlements.js";
import { createReferralStore } from "./referral.js";
import { createConsultStore } from "./consultRequests.js";
import { createAdminMetricsStore } from "./adminMetrics.js";
import { createWaitlistStore } from "./waitlist.js";
import type { ModelProvider } from "../ai/modelRouter.js";

describe("scene/comic avatar reference continuity", () => {
  const calls: { prompt: string; images?: { data: string; mimeType: string }[] }[] = [];
  const model = {
    generateJson: async () => ({}),
    generateImage: async (req: typeof calls[number]) => { calls.push(req); return { data: "a", mimeType: "image/png" }; },
    async *streamText() {}, async *generateJsonStream() {},
  } as unknown as ModelProvider;
  let server: Server;
  let baseUrl = "";
  beforeAll(async () => {
    const config = createTestConfig();
    const entitlementStore = createEntitlementStore(config);
    const app = express();
    app.use(express.json({ limit: "12mb" }));
    app.use("/api", createApiRouter({ config, modelProvider: model, memoryStore: new LocalMemoryStore(), consentStore: new LocalConsentStore(),
      shareStore: new LocalShareStore(), framework: loadFramework(), entitlementStore,
      referralStore: createReferralStore(config, entitlementStore), counters: createCounterStore(config),
      consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config), waitlistStore: createWaitlistStore(config) }));
    await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
  const post = (route: string, extra: Record<string, unknown>) => fetch(`${baseUrl}/api/${route}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imagePrompt: "A friendly playroom", theme: "Sharing blocks", ...extra }),
  });

  for (const route of ["generate-scene", "generate-comic"]) {
    describe(route, () => {
      it.each(["", false, {}, { dataUrl: "" }, "broken", "data:text/plain;base64,aGVybw==", "data:image/png;base64,%%%", "data:image/png;base64,a"])(
        "rejects invalid supplied reference %j before calling the model", async (avatar) => {
          calls.length = 0;
          const response = await post(route, { avatar });
          expect(response.status).toBe(400);
          expect(await response.json()).toMatchObject({ code: "invalid_avatar_reference" });
          expect(calls).toHaveLength(0);
        });

      it("rejects an oversized reference before calling the model", async () => {
        calls.length = 0;
        const response = await post(route, { avatar: { dataUrl: `data:image/png;base64,${"A".repeat(8 * 1024 * 1024 + 4)}` } });
        expect(response.status).toBe(413);
        expect(await response.json()).toMatchObject({ code: "invalid_avatar_reference" });
        expect(calls).toHaveLength(0);
      });

      it.each([undefined, null])("retains intentional no-reference behavior (%s)", async (avatar) => {
        calls.length = 0;
        expect((await post(route, { avatar })).status).toBe(200);
        expect(calls).toHaveLength(1);
        expect(calls[0].images).toBeUndefined();
      });

      it.each(["data:image/png;base64,aGVybw==", { dataUrl: "data:image/png;base64,aGVybw==" }])(
        "passes the supplied reference unchanged (%j)", async (avatar) => {
          calls.length = 0;
          expect((await post(route, { avatar })).status).toBe(200);
          expect(calls).toHaveLength(1);
          expect(calls[0].images).toEqual([{ mimeType: "image/png", data: "aGVybw==" }]);
          expect(calls[0].prompt).toContain("Preserve the reference");
        });
    });
  }
});
