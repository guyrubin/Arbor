import { describe, expect, it, vi } from "vitest";
import { createTestConfig } from "../testConfig.js";
import { VertexGeminiProvider, type VertexClientFactory } from "./modelRouter.js";

const image = { data: "aGVsbG8=", mimeType: "image/png" };
const ok = { response: { candidates: [{ content: { parts: [{ inlineData: image }] } }], usageMetadata: {} } };
const saturated = () => Object.assign(new Error("got status: 429 Too Many Requests. Resource exhausted"), { status: 429 });
const factoryFor = (perRegion: Record<string, () => Promise<any>>, calls: string[]): VertexClientFactory => async (location) => ({
  getGenerativeModel: () => ({ generateContent: () => { calls.push(location); return (perRegion[location] ?? (() => Promise.reject(new Error(`no fixture for ${location}`))))(); } })
});
const quiet = () => { vi.spyOn(console, "warn").mockImplementation(() => {}); vi.spyOn(console, "info").mockImplementation(() => {}); };
const budget = (ms = 60000) => ({ signal: AbortSignal.timeout(ms), deadlineAt: Date.now() + ms, totalMs: ms });

describe("Vertex image generation — EU regional fallback (22 Sep 2026 europe-west4 saturation)", () => {
  it("moves to the next EU region when the primary returns 429, and returns that region's image", async () => {
    quiet();
    const calls: string[] = [];
    const provider = new VertexGeminiProvider(createTestConfig(), factoryFor({
      "europe-west4": () => Promise.reject(saturated()),
      "europe-west1": () => Promise.resolve(ok)
    }, calls));
    await expect(provider.generateImage({ prompt: "a garden", budget: budget() })).resolves.toEqual(image);
    // two bounded attempts in the primary region, then one success in the fallback
    expect(calls).toEqual(["europe-west4", "europe-west4", "europe-west1"]);
  });

  it("keeps the primary region alone when it succeeds (no extra clients, no fallback log)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const calls: string[] = [];
    const provider = new VertexGeminiProvider(createTestConfig(), factoryFor({ "europe-west4": () => Promise.resolve(ok) }, calls));
    await expect(provider.generateImage({ prompt: "a garden", budget: budget() })).resolves.toEqual(image);
    expect(calls).toEqual(["europe-west4"]);
    expect(info).not.toHaveBeenCalledWith("Arbor Image Region", expect.anything());
  });

  it("never sends family imagery to a non-EU region even if one is configured", () => {
    const provider = new VertexGeminiProvider(createTestConfig({ arborEnv: "prod", vertexImageRegions: ["europe-west4", "us-central1", "europe-west3"] }));
    expect(provider.imageRegions()).toEqual(["europe-west4", "europe-west3"]);
  });

  it("does not retry a content block (NO_IMAGE) in another region", async () => {
    quiet();
    const calls: string[] = [];
    const blocked = { response: { candidates: [{ finishReason: "NO_IMAGE", content: { parts: [] } }], usageMetadata: {} } };
    const provider = new VertexGeminiProvider(createTestConfig(), factoryFor({
      "europe-west4": () => Promise.resolve(blocked),
      "europe-west1": () => Promise.resolve(ok)
    }, calls));
    await expect(provider.generateImage({ prompt: "x", budget: budget() })).rejects.toThrow(/no image/i);
    expect(calls).toEqual(["europe-west4"]);
  });

  it("surfaces the last capacity error when every EU region is saturated", async () => {
    quiet();
    const calls: string[] = [];
    const provider = new VertexGeminiProvider(createTestConfig(), factoryFor({
      "europe-west4": () => Promise.reject(saturated()),
      "europe-west1": () => Promise.reject(saturated()),
      "europe-west3": () => Promise.reject(saturated())
    }, calls));
    await expect(provider.generateImage({ prompt: "x", budget: budget() })).rejects.toMatchObject({ status: 429 });
    expect(calls.filter((c) => c === "europe-west3").length).toBe(3);
  });

  it("skips a region where the image model is not offered (404) instead of failing the request", async () => {
    quiet();
    const calls: string[] = [];
    const notFound = Object.assign(new Error("Publisher Model `gemini-2.5-flash-image` was not found"), { status: 404 });
    const provider = new VertexGeminiProvider(createTestConfig(), factoryFor({
      "europe-west4": () => Promise.reject(saturated()),
      "europe-west1": () => Promise.reject(notFound),
      "europe-west3": () => Promise.resolve(ok)
    }, calls));
    await expect(provider.generateImage({ prompt: "x", budget: budget() })).resolves.toEqual(image);
    expect(calls.at(-1)).toBe("europe-west3");
  });
});
