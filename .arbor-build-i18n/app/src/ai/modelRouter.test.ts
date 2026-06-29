import { describe, expect, it } from "vitest";
import { createTestConfig } from "../testConfig.js";
import { modelForGeminiRequest, routeDecisionFor, toAnthropicVertexModelId, type ModelRoute } from "./modelRouter.js";

describe("model route decisions", () => {
  it("routes high-stakes coach calls to Claude on Vertex and other routes to Gemini on Vertex", () => {
    const config = createTestConfig();
    const expected: Record<ModelRoute, { provider: string; model: string }> = {
      coach_high_stakes: { provider: "vertex_claude", model: "claude-3-5-sonnet@anthropic" },
      creative_low_risk: { provider: "vertex_gemini", model: "gemini-2.5-flash" },
      analysis_structured: { provider: "vertex_gemini", model: "gemini-2.5-pro" },
      handoff_structured: { provider: "vertex_gemini", model: "gemini-2.5-flash" }
    };

    for (const route of Object.keys(expected) as ModelRoute[]) {
      expect(routeDecisionFor(config, route)).toMatchObject(expected[route]);
    }
  });

  it("routes every local development route to the Gemini dev provider", () => {
    const config = createTestConfig({ modelProvider: "gemini_dev" });
    expect(routeDecisionFor(config, "coach_high_stakes")).toMatchObject({
      provider: "gemini_dev",
      model: "gemini-2.5-flash"
    });
  });

  it("normalizes the Claude shorthand to the Vertex Anthropic model id", () => {
    expect(toAnthropicVertexModelId("claude-3-5-sonnet@anthropic")).toBe("claude-3-5-sonnet-v2@20241022");
  });

  it("uses a Gemini model for image requests even when the route normally maps to Claude", () => {
    const config = createTestConfig({
      vertexModelChat: "claude-3-5-sonnet@anthropic",
      vertexModelAnalysis: "gemini-2.5-pro",
    });

    expect(modelForGeminiRequest(config, "coach_high_stakes", [{ data: "QUJD", mimeType: "image/png" }]))
      .toBe("gemini-2.5-pro");
  });
});
