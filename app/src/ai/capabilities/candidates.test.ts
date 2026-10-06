/**
 * B-PROV-07 — candidates become a list; entitlement weights the choice.
 * Unset AI_CANDIDATES_<ROUTE> = today's single candidate (prod unchanged);
 * a set list is parsed defensively against what the configured provider can
 * really dispatch, with honest region / training / retention flags.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestConfig } from "../../testConfig.js";
import { candidatesEnvKey, candidatesFor, defaultCandidateFor, parseCandidateList, PROVIDER_POSTURE } from "./candidates.js";
import { routeDecisionFor, VertexModelProvider, type ModelRoute } from "../modelRouter.js";
import { AiProviderError } from "./contracts.js";

vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getClient() {
      return { getAccessToken: async () => ({ token: "fake-adc-token" }) };
    }
  },
}));

const ROUTES: ModelRoute[] = ["coach_high_stakes", "creative_low_risk", "analysis_structured", "handoff_structured"];

describe("candidatesFor — unset env = today's single candidate", () => {
  it("every route yields exactly the default candidate (vertex, gemini_dev, mock)", () => {
    for (const config of [createTestConfig(), createTestConfig({ modelProvider: "gemini_dev" }), createTestConfig({ modelProvider: "mock" })]) {
      for (const route of ROUTES) {
        const list = candidatesFor(config, route, {});
        expect(list).toHaveLength(1);
        expect(list[0]).toEqual(defaultCandidateFor(config, route));
      }
    }
  });

  it("the env key is AI_CANDIDATES_<ROUTE>", () => {
    expect(candidatesEnvKey("coach_high_stakes")).toBe("AI_CANDIDATES_COACH_HIGH_STAKES");
  });

  it("honest flags per provider: vertex_claude / vertex_gemini eu, no training, 0 days; gemini_dev global, 30; mock global, 0", () => {
    const v = createTestConfig({ arborEnv: "prod" });
    expect(defaultCandidateFor(v, "coach_high_stakes")).toMatchObject({ ref: { provider: "vertex_claude", region: "eu" }, trainsOnCustomerData: false, retentionDays: 0 });
    expect(defaultCandidateFor(v, "analysis_structured")).toMatchObject({ ref: { provider: "vertex_gemini", region: "eu" }, trainsOnCustomerData: false, retentionDays: 0 });
    expect(defaultCandidateFor(createTestConfig({ modelProvider: "gemini_dev" }), "coach_high_stakes")).toMatchObject({ ref: { provider: "gemini_dev", region: "global" }, trainsOnCustomerData: false, retentionDays: 30 });
    expect(defaultCandidateFor(createTestConfig({ modelProvider: "mock" }), "coach_high_stakes")).toMatchObject({ ref: { provider: "mock", region: "global" }, trainsOnCustomerData: false, retentionDays: 0 });
    expect(PROVIDER_POSTURE).toEqual({
      vertex_claude: { trainsOnCustomerData: false, retentionDays: 0 },
      vertex_gemini: { trainsOnCustomerData: false, retentionDays: 0 },
      gemini_dev: { trainsOnCustomerData: false, retentionDays: 30 },
      mock: { trainsOnCustomerData: false, retentionDays: 0 },
    });
  });
});

describe("parseCandidateList — defensive", () => {
  const config = createTestConfig({ arborEnv: "prod" });

  it("parses provider:model[:region] in order, dedupes, and declares the REAL region", () => {
    const list = parseCandidateList(config, " vertex_claude:claude-sonnet-5@anthropic , vertex_gemini:gemini-2.5-flash:europe-west4, vertex_gemini:gemini-2.5-flash ");
    expect(list.map((c) => c.ref)).toEqual([
      { provider: "vertex_claude", model: "claude-sonnet-5@anthropic", region: "eu" },
      { provider: "vertex_gemini", model: "gemini-2.5-flash", region: "eu" },
    ]);
  });

  it("drops malformed, unknown, undispatchable, family-mismatched and region-lying entries", () => {
    const raw = [
      "", "nonsense", "a:b:c:d", "openai:gpt-5", // malformed / unknown provider
      "gemini_dev:gemini-2.5-flash", "mock:mock-fixtures", // MODEL_PROVIDER=vertex cannot dispatch these
      "vertex_gemini:claude-sonnet-5@anthropic", "vertex_claude:gemini-2.5-flash", // family mismatch
      "vertex_claude:claude-sonnet-5@anthropic:us-east5", // token says us, the calls go to eu
      "vertex_gemini:bad model id",
    ].join(",");
    expect(parseCandidateList(config, raw)).toEqual([]);
    expect(parseCandidateList(config, undefined)).toEqual([]);
    // An all-invalid list falls back to the single default candidate.
    expect(candidatesFor(config, "coach_high_stakes", { AI_CANDIDATES_COACH_HIGH_STAKES: raw })).toEqual([defaultCandidateFor(config, "coach_high_stakes")]);
  });

  it("gemini_dev and mock configs keep only their own provider", () => {
    expect(parseCandidateList(createTestConfig({ modelProvider: "gemini_dev" }), "vertex_claude:claude-sonnet-5@anthropic,gemini_dev:gemini-2.5-pro").map((c) => c.ref.provider)).toEqual(["gemini_dev"]);
    expect(parseCandidateList(createTestConfig({ modelProvider: "mock" }), "mock:other,mock:mock-fixtures").map((c) => c.ref.model)).toEqual(["mock-fixtures"]);
  });
});

describe("routeDecisionFor over a list, weighted by entitlement", () => {
  const KEY = "AI_CANDIDATES_COACH_HIGH_STAKES";
  let saved: string | undefined;
  beforeEach(() => { saved = process.env[KEY]; });
  afterEach(() => { if (saved === undefined) delete process.env[KEY]; else process.env[KEY] = saved; });

  it("free picks the cheaper model, paid the higher quality, none = the unweighted choice", () => {
    process.env[KEY] = "vertex_claude:claude-sonnet-5@anthropic,vertex_gemini:gemini-2.5-flash";
    const prod = createTestConfig({ arborEnv: "prod" });
    expect(routeDecisionFor(prod, "coach_high_stakes", "free")).toEqual({ route: "coach_high_stakes", provider: "vertex_gemini", model: "gemini-2.5-flash" });
    expect(routeDecisionFor(prod, "coach_high_stakes", "paid")).toEqual({ route: "coach_high_stakes", provider: "vertex_claude", model: "claude-sonnet-5@anthropic" });
    expect(routeDecisionFor(prod, "coach_high_stakes").provider).toBe("vertex_gemini");
  });

  it("an ineligible candidate is rejected before scoring: a non-EU Gemini location leaves only Claude", () => {
    process.env[KEY] = "vertex_claude:claude-sonnet-5@anthropic,vertex_gemini:gemini-2.5-flash";
    const split = createTestConfig({ arborEnv: "prod", vertexLocation: "us-central1" });
    expect(routeDecisionFor(split, "coach_high_stakes", "free").provider).toBe("vertex_claude");
    const allOut = createTestConfig({ arborEnv: "prod", vertexLocation: "us-central1", vertexClaudeLocation: "us-east5" });
    expect(() => routeDecisionFor(allOut, "coach_high_stakes", "paid")).toThrow(AiProviderError);
  });

  it("the Claude call goes to the POLICY-decided model, not VERTEX_MODEL_CHAT", async () => {
    process.env[KEY] = "vertex_claude:claude-opus-5-5@anthropic";
    const urls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: unknown) => {
      urls.push(String(url));
      return { ok: true, json: async () => ({ content: [{ type: "tool_use", input: { ok: true } }] }) } as unknown as Response;
    }) as typeof fetch;
    try {
      const provider = new VertexModelProvider(createTestConfig({ vertexModelChat: "claude-sonnet-5@anthropic" }));
      expect(provider.routeDecision("coach_high_stakes").model).toBe("claude-opus-5-5@anthropic");
      await provider.generateJson({ route: "coach_high_stakes", prompt: "x" } as never).catch(() => undefined);
      expect(urls[0]).toContain("/publishers/anthropic/models/claude-opus-5-5:rawPredict");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
