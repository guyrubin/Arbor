import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createTestConfig } from "../testConfig.js";
import { AiProviderError } from "./capabilities/contracts.js";
import { modelForGeminiRequest, modelForRoute, routeDecisionFor, thinkingConfigForRoute, toAnthropicVertexModelId, type ModelRoute } from "./modelRouter.js";

describe("model route decisions", () => {
  it("routes high-stakes coach calls to Claude on Vertex and other routes to Gemini on Vertex", () => {
    const config = createTestConfig();
    const expected: Record<ModelRoute, { provider: string; model: string }> = {
      coach_high_stakes: { provider: "vertex_claude", model: "claude-sonnet-5@anthropic" },
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
    // Legacy pin keeps resolving envs that still carry the 2024 shorthand.
    expect(toAnthropicVertexModelId("claude-3-5-sonnet@anthropic")).toBe("claude-3-5-sonnet-v2@20241022");
  });

  // AIR-4: alias→resolved-id assertion for the current coach model — the id
  // pinned in evals/pinned-models.json must match what the provider calls.
  it("resolves the current Claude Sonnet alias to the bare Vertex publisher id", () => {
    expect(toAnthropicVertexModelId("claude-sonnet-5@anthropic")).toBe("claude-sonnet-5");
  });

  // EVAL-8: the pin file IS the eval-to-prod identity contract — assert the
  // alias→snapshot resolution recorded there matches the live resolver, so a
  // resolver change can never silently diverge from what the evals validated.
  it("evals/pinned-models.json alias→resolved pairs match toAnthropicVertexModelId", () => {
    const pinned = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "evals", "pinned-models.json"), "utf8"),
    ) as { routes: Record<string, { alias: string; resolved: string }>; legacy?: Record<string, string> };
    for (const [route, pin] of Object.entries(pinned.routes)) {
      expect(toAnthropicVertexModelId(pin.alias), `route ${route}`).toBe(pin.resolved);
    }
    for (const [alias, resolved] of Object.entries(pinned.legacy ?? {})) {
      expect(toAnthropicVertexModelId(alias)).toBe(resolved);
    }
  });

  // COACH-3: every route decision now executes selectProvider — provider
  // eligibility (region / no-training / retention) is enforced fail-closed.
  it("fails closed with policy_denied when the configured Vertex region violates the EU route policy", () => {
    const config = createTestConfig({ vertexLocation: "us-central1" });
    for (const route of ["coach_high_stakes", "analysis_structured"] as ModelRoute[]) {
      expect(() => routeDecisionFor(config, route)).toThrow(AiProviderError);
      try {
        routeDecisionFor(config, route);
      } catch (error) {
        expect((error as AiProviderError).code).toBe("policy_denied");
      }
      expect(() => modelForRoute(config, route)).toThrow(/No eligible provider/i);
    }
  });

  it("keeps the EU Vertex config and the local gemini_dev config eligible (behavior unchanged)", () => {
    expect(modelForRoute(createTestConfig(), "coach_high_stakes")).toBe("claude-sonnet-5@anthropic");
    expect(modelForRoute(createTestConfig({ modelProvider: "gemini_dev" }), "coach_high_stakes")).toBe("gemini-2.5-flash");
  });

  it("denies the region-less gemini_dev provider in prod (EU-only policy)", () => {
    const config = createTestConfig({ modelProvider: "gemini_dev", arborEnv: "prod" });
    expect(() => routeDecisionFor(config, "creative_low_risk")).toThrow(AiProviderError);
  });

  it("uses a Gemini model for image requests even when the route normally maps to Claude", () => {
    const config = createTestConfig({
      vertexModelChat: "claude-sonnet-5@anthropic",
      vertexModelAnalysis: "gemini-2.5-pro",
    });

    expect(modelForGeminiRequest(config, "coach_high_stakes", [{ data: "QUJD", mimeType: "image/png" }]))
      .toBe("gemini-2.5-pro");
  });
});

// AIR-3: fast-path routes stop paying default dynamic-thinking latency.
describe("per-route Gemini thinking budget (AIR-3)", () => {
  it("turns thinking OFF for analysis_structured on 2.5 Flash (covers /extract-log, /voice streamText, /digest, Today's Focus)", () => {
    expect(thinkingConfigForRoute("analysis_structured", "gemini-2.5-flash")).toEqual({ thinkingBudget: 0 });
    expect(thinkingConfigForRoute("analysis_structured", "gemini-2.5-flash-lite")).toEqual({ thinkingBudget: 0 });
  });

  it("keeps the model default (dynamic thinking) for coach and creative routes", () => {
    expect(thinkingConfigForRoute("coach_high_stakes", "gemini-2.5-flash")).toBeUndefined();
    expect(thinkingConfigForRoute("creative_low_risk", "gemini-2.5-flash")).toBeUndefined();
    expect(thinkingConfigForRoute("handoff_structured", "gemini-2.5-flash")).toBeUndefined();
  });

  it("never sends a zero budget to models that reject it (2.5 Pro min 128; non-2.5 models reject the field)", () => {
    expect(thinkingConfigForRoute("analysis_structured", "gemini-2.5-pro")).toBeUndefined();
    expect(thinkingConfigForRoute("analysis_structured", "gemini-2.0-flash")).toBeUndefined();
    expect(thinkingConfigForRoute("analysis_structured", "claude-sonnet-5@anthropic")).toBeUndefined();
    expect(thinkingConfigForRoute("analysis_structured", "gemini-2.5-flash-image")).toBeUndefined();
  });
});
