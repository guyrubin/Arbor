import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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
import { createCounterStore } from "../server/quotaStore.js";
import { createEntitlementStore } from "../server/entitlements.js";
import { createReferralStore } from "../server/referral.js";
import { createConsultStore } from "../server/consultRequests.js";
import { createAdminMetricsStore } from "../server/adminMetrics.js";
import { createWaitlistStore } from "../server/waitlist.js";
import type { ModelProvider } from "../ai/modelRouter.js";

import { screenStructuredModelOutput } from "../safety/structuredOutput.js";

const UNSAFE = "Your child has autism. Give 10 mg of medication daily.";
let output: unknown = {};
let providerCalls = 0;
let authenticated = false;
const memoryStore = new LocalMemoryStore();
Object.assign(memoryStore, { ownsChild: async (uid: string) => uid === "owner" });
const consentStore = new LocalConsentStore();
const model = {
  generateJson: async () => { providerCalls++; return output; },
  generateImage: async () => { providerCalls++; return { data: "a", mimeType: "image/png" }; },
  async *streamText() {}, async *generateJsonStream() {},
} as unknown as ModelProvider;
let server: Server;
let baseUrl: string;
beforeAll(async () => {
  const config = createTestConfig();
  const entitlementStore = createEntitlementStore(config);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { if (authenticated) (req as any).user = { uid: "outsider" }; next(); });
  app.use("/api", createApiRouter({ config, modelProvider: model, memoryStore, consentStore,
    shareStore: new LocalShareStore(), framework: loadFramework(), entitlementStore,
    referralStore: createReferralStore(config, entitlementStore), counters: createCounterStore(config),
    consultStore: createConsultStore(config), adminMetrics: createAdminMetricsStore(config), waitlistStore: createWaitlistStore(config) }));
  await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
const post = async (route: string, body: unknown) => fetch(`${baseUrl}/api/${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const childProfile = { id: "synthetic-child", name: "Noa", age: 4 };
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
const cases = [
  ["extract-log", { message: "We waited together before leaving.", childProfile }, { notes: UNSAFE }],
  ["vision", { image, childProfile }, { observations: [UNSAFE] }],
  ["generate-plan", { challengeTopic: "Taking turns", childProfile }, { phases: [{ steps: [{ text: UNSAFE }] }] }],
  ["generate-story", { childName: "Noa", age: 4, topic: "Taking turns", moral: "Sharing" }, { pages: [UNSAFE] }],
  ["generate-bedtime-story", { childName: "Noa", age: 4, dayEvents: [{ description: "Built a tower", tone: "positive" }] }, { pages: [UNSAFE] }],
  ["generate-adventure", { childProfile }, { title: "Play", scenes: [{ prompt: "Pick a block", skill: "logic", choices: [{ text: "Blue", correct: true, feedback: UNSAFE }, { text: "Red", correct: false, feedback: "Try again" }, { text: "Green", correct: false, feedback: "Try again" }] }] }],
] as const;
it.each(cases)("blocks unsafe nested model prose from %s", async (route, body, draft) => {
  authenticated = false; output = draft;
  const response = await post(route, body);
  expect(response.status).toBe(422);
  const payload = await response.json();
  expect(payload.outputBlocked).toBe(true);
  expect(JSON.stringify(payload)).not.toContain(UNSAFE);
});
it("allows a safe reviewed capture draft through unchanged", async () => {
  authenticated = false; output = { notes: "Waited together before leaving.", trigger: "Time to go", response: "Offered a hand" };
  const response = await post("extract-log", { message: "We waited together before leaving.", childProfile });
  expect(response.status).toBe(200); expect(await response.json()).toEqual(output);
});
it.each(["vision", "generate-avatar", "score-utterance"])("does not borrow another child's processing consent on %s", async route => {
  authenticated = true; providerCalls = 0;
  const consent = vi.spyOn(consentStore, "isActive").mockResolvedValue(true);
  try {
    const response = await post(route, { childId: "someone-elses-child", childProfile, image, photo: image, audio: "data:audio/webm;base64,YQ==" });
    expect(response.status).toBe(403); expect(providerCalls).toBe(0); expect(consent).not.toHaveBeenCalled();
  } finally { authenticated = false; consent.mockRestore(); }
});
it("fails closed on oversized structured output instead of silently skipping fields", async () => {
  expect((await screenStructuredModelOutput(model, { pages: Array(5000).fill("safe") })).flagged).toBe(true);
  expect((await screenStructuredModelOutput(model, { pages: ["safe".repeat(30000), UNSAFE] })).flagged).toBe(true);
});

const imageRoutes = [
  ["generate-avatar", { descriptors: { vibe: "cheerful" } }],
  ["generate-scene", { imagePrompt: "A friendly playroom" }],
  ["generate-comic", { theme: "Sharing blocks" }],
] as const;
it.each(imageRoutes)("returns a retryable temporary response for image capacity on %s", async (route, body) => {
  authenticated = false;
  const generate = vi.spyOn(model, "generateImage").mockRejectedValue(new Error("RESOURCE_EXHAUSTED private provider diagnostic"));
  try {
    const response = await post(route, body);
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("15");
    const payload = await response.json();
    expect(payload.retryable).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("private provider diagnostic");
  } finally { generate.mockRestore(); }
});
it.each(imageRoutes)("keeps provider diagnostics out of permanent image failures on %s", async (route, body) => {
  authenticated = false;
  const generate = vi.spyOn(model, "generateImage").mockRejectedValue(new Error("private provider diagnostic"));
  try {
    const response = await post(route, body);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private provider diagnostic");
  } finally { generate.mockRestore(); }
});
