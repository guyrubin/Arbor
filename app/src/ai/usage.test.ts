import { describe, expect, it } from "vitest";
import { normalizeUsage } from "./usage.js";

describe("normalizeUsage", () => {
  it("reads the Gemini / Vertex usageMetadata shape", () => {
    expect(
      normalizeUsage({ promptTokenCount: 1200, candidatesTokenCount: 300, totalTokenCount: 1500 })
    ).toEqual({ promptTokens: 1200, outputTokens: 300, totalTokens: 1500 });
  });

  it("derives total when Gemini omits totalTokenCount", () => {
    expect(normalizeUsage({ promptTokenCount: 100, candidatesTokenCount: 40 })).toEqual({
      promptTokens: 100,
      outputTokens: 40,
      totalTokens: 140,
    });
  });

  it("reads the Anthropic (Claude on Vertex) usage shape", () => {
    expect(normalizeUsage({ input_tokens: 800, output_tokens: 250 })).toEqual({
      promptTokens: 800,
      outputTokens: 250,
      totalTokens: 1050,
    });
  });

  it("returns null when usage is missing or unrecognized", () => {
    expect(normalizeUsage(null)).toBeNull();
    expect(normalizeUsage(undefined)).toBeNull();
    expect(normalizeUsage({})).toBeNull();
    expect(normalizeUsage({ somethingElse: 1 })).toBeNull();
  });
});
