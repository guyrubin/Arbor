/**
 * B-AIOPS-01: retries, fallbacks and charged failures leave a content-free
 * receipt. A 429 with no usage is not a receipt. A billed reply the product
 * rejects is.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "../server/logger.js";
import { createTestConfig } from "../testConfig.js";
import { VertexGeminiProvider, type VertexClientFactory } from "./modelRouter.js";

const usage = (prompt: number, output: number) => ({ promptTokenCount: prompt, candidatesTokenCount: output, totalTokenCount: prompt + output });
const linesOf = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter((c) => c[0] === "ai.usage").map((c) => c[1] as Record<string, unknown>);
const textFactory = (generateContent: () => Promise<unknown>): VertexClientFactory =>
  async () => ({ getGenerativeModel: () => ({ generateContent }) });
const imageFactory = (perRegion: Record<string, () => Promise<unknown>>, calls: string[]): VertexClientFactory =>
  async (location) => ({ getGenerativeModel: () => ({ generateContent: () => { calls.push(location); return (perRegion[location] ?? (() => Promise.reject(new Error(`no fixture for ${location}`))))(); } }) });
const budget = (ms = 60_000) => ({ signal: AbortSignal.timeout(ms), deadlineAt: Date.now() + ms, totalMs: ms });
const quiet = () => { vi.spyOn(console, "warn").mockImplementation(() => {}); vi.spyOn(console, "info").mockImplementation(() => {}); };
const PROMPT = "CHILD-NAME-מאיה-SECRET";

afterEach(() => vi.restoreAllMocks());

describe("B-AIOPS-01 retries, fallbacks, charged failures", () => {
  it("a 429 then a success is one receipt with retries 1 and no prompt", async () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    let n = 0;
    const provider = new VertexGeminiProvider(createTestConfig(), textFactory(async () => {
      n += 1;
      if (n === 1) throw Object.assign(new Error("429"), { status: 429 });
      return { response: { candidates: [{ content: { parts: [{ text: "{\"ok\":true}" }] } }], usageMetadata: usage(3, 2) } };
    }));
    await expect(provider.generateJson({ route: "analysis_structured", prompt: PROMPT, promptVersion: "1.2.3" })).resolves.toEqual({ ok: true });
    const lines = linesOf(spy);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ retries: 1, fallback: false, chargedFailure: false, promptTokens: 3, outputTokens: 2, promptVersion: "1.2.3" });
    expect(JSON.stringify(lines)).not.toContain("מאיה");
    expect(JSON.stringify(lines)).not.toContain("CHILD-NAME");
  }, 10_000);

  it("usage on a failed attempt is its own charged-failure receipt, then the success", async () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    let n = 0;
    const provider = new VertexGeminiProvider(createTestConfig(), textFactory(async () => {
      n += 1;
      if (n === 1) throw Object.assign(new Error("503"), { status: 503, usageMetadata: usage(8, 1) });
      return { response: { candidates: [{ content: { parts: [{ text: "{\"ok\":true}" }] } }], usageMetadata: usage(8, 4) } };
    }));
    await expect(provider.generateJson({ route: "analysis_structured", prompt: PROMPT })).resolves.toEqual({ ok: true });
    const lines = linesOf(spy);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ chargedFailure: true, retries: 0, promptTokens: 8, outputTokens: 1 });
    expect(lines[1]).toMatchObject({ chargedFailure: false, retries: 1, promptTokens: 8, outputTokens: 4 });
    expect(JSON.stringify(lines)).not.toContain("מאיה");
  }, 10_000);

  it("a billed reply that will not parse is a charged failure and is not retried", async () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    let n = 0;
    const provider = new VertexGeminiProvider(createTestConfig(), textFactory(async () => {
      n += 1;
      return { response: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "not-json מאיה" }] } }], usageMetadata: usage(11, 4) } };
    }));
    await expect(provider.generateJson({ route: "analysis_structured", prompt: PROMPT })).rejects.toThrow(/malformed JSON/i);
    expect(n).toBe(1);
    const lines = linesOf(spy);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ chargedFailure: true, retries: 0, promptTokens: 11, outputTokens: 4 });
    expect(JSON.stringify(lines)).not.toContain("מאיה");
    expect(JSON.stringify(lines)).not.toContain("not-json");
  });

  it("an image 429 then another region is fallback, retries 0, and the 429 is not a receipt", async () => {
    quiet();
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const calls: string[] = [];
    const image = { data: "aGVsbG8=", mimeType: "image/png" };
    const saturated = () => Object.assign(new Error("429"), { status: 429 });
    const ok = { response: { candidates: [{ content: { parts: [{ inlineData: image }] } }], usageMetadata: usage(5, 80) } };
    const provider = new VertexGeminiProvider(createTestConfig(), imageFactory({
      "europe-west4": () => Promise.reject(saturated()),
      "europe-west1": () => Promise.resolve(ok),
    }, calls));
    await expect(provider.generateImage({ prompt: PROMPT, budget: budget() })).resolves.toEqual(image);
    expect(calls).toEqual(["europe-west4", "europe-west4", "europe-west1"]);
    const lines = linesOf(spy);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ fallback: true, retries: 0, chargedFailure: false, imageCount: 1, promptTokens: 5 });
    expect(JSON.stringify(lines)).not.toContain("מאיה");
  }, 15_000);

  it("a blocked image with tokens is one charged failure and stays in that region", async () => {
    quiet();
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const calls: string[] = [];
    const blocked = { response: { candidates: [{ finishReason: "NO_IMAGE", content: { parts: [] } }], usageMetadata: usage(20, 0) } };
    const provider = new VertexGeminiProvider(createTestConfig(), imageFactory({
      "europe-west4": () => Promise.resolve(blocked),
      "europe-west1": () => Promise.resolve(blocked),
    }, calls));
    await expect(provider.generateImage({ prompt: PROMPT, budget: budget() })).rejects.toThrow(/no image/i);
    expect(calls).toEqual(["europe-west4"]);
    const lines = linesOf(spy);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ chargedFailure: true, imageCount: 0, fallback: false, promptTokens: 20 });
    expect(JSON.stringify(lines)).not.toContain("מאיה");
  });
});
