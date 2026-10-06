/**
 * B-PROV-03 — Claude on the Vertex `eu` multi-region endpoint.
 * VERTEX_CLAUDE_LOCATION (config.vertexClaudeLocation, default "eu") decides
 * the Claude host + location; Gemini routes keep VERTEX_LOCATION.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaudeVertexProvider, DEFAULT_VERTEX_CLAUDE_LOCATION, claudeVertexLocation, claudeVertexUrl } from "./claudeVertexProvider.js";
import { createTestConfig } from "../testConfig.js";
import { loadConfig } from "../config/env.js";

vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getClient() {
      return { getAccessToken: async () => ({ token: "fake-adc-token" }) };
    }
  },
}));

describe("claudeVertexUrl (pure)", () => {
  it("the multi-region `eu` uses aiplatform.eu.rep.googleapis.com with locations/eu", () => {
    expect(claudeVertexUrl({ location: "eu", projectId: "arborprd-westeu", model: "claude-opus-5-5", method: "rawPredict" }))
      .toBe("https://aiplatform.eu.rep.googleapis.com/v1/projects/arborprd-westeu/locations/eu/publishers/anthropic/models/claude-opus-5-5:rawPredict");
    expect(claudeVertexUrl({ location: "EU", projectId: "p", model: "claude-sonnet-5", method: "streamRawPredict" }))
      .toBe("https://aiplatform.eu.rep.googleapis.com/v1/projects/p/locations/eu/publishers/anthropic/models/claude-sonnet-5:streamRawPredict");
  });

  it("a regional value keeps the regional host and location", () => {
    expect(claudeVertexUrl({ location: "europe-west4", projectId: "p", model: "claude-sonnet-5", method: "rawPredict" }))
      .toBe("https://europe-west4-aiplatform.googleapis.com/v1/projects/p/locations/europe-west4/publishers/anthropic/models/claude-sonnet-5:rawPredict");
    expect(claudeVertexUrl({ location: "us-east5", projectId: "p", model: "claude-sonnet-5", method: "streamRawPredict" }))
      .toBe("https://us-east5-aiplatform.googleapis.com/v1/projects/p/locations/us-east5/publishers/anthropic/models/claude-sonnet-5:streamRawPredict");
  });
});

describe("VERTEX_CLAUDE_LOCATION default", () => {
  let saved: string | undefined;
  beforeEach(() => { saved = process.env.VERTEX_CLAUDE_LOCATION; delete process.env.VERTEX_CLAUDE_LOCATION; });
  afterEach(() => {
    if (saved === undefined) delete process.env.VERTEX_CLAUDE_LOCATION;
    else process.env.VERTEX_CLAUDE_LOCATION = saved;
  });

  it("is `eu` when the env is unset (loadConfig) and when a hand-built config omits it", () => {
    expect(DEFAULT_VERTEX_CLAUDE_LOCATION).toBe("eu");
    expect(loadConfig().vertexClaudeLocation).toBe("eu");
    expect(claudeVertexLocation({})).toBe("eu");
    expect(claudeVertexLocation(createTestConfig())).toBe("eu");
  });

  it("reads the env when set", () => {
    process.env.VERTEX_CLAUDE_LOCATION = "europe-west4";
    expect(loadConfig().vertexClaudeLocation).toBe("europe-west4");
  });
});

describe("ClaudeVertexProvider calls the configured Claude location (not VERTEX_LOCATION)", () => {
  const realFetch = globalThis.fetch;
  let urls: string[] = [];
  beforeEach(() => {
    urls = [];
    globalThis.fetch = (async (url: unknown) => {
      urls.push(String(url));
      return {
        ok: true,
        json: async () => ({ content: [{ type: "tool_use", input: { ok: true } }], usage: { input_tokens: 1, output_tokens: 1 } }),
      } as unknown as Response;
    }) as typeof fetch;
  });
  afterEach(() => { globalThis.fetch = realFetch; });

  it("default config → the eu multi-region endpoint, even with VERTEX_LOCATION=europe-west4", async () => {
    const provider = new ClaudeVertexProvider(createTestConfig({ vertexLocation: "europe-west4" }));
    await provider.generateJson({ route: "analysis_structured", prompt: "hi" } as never);
    expect(urls[0]).toMatch(/^https:\/\/aiplatform\.eu\.rep\.googleapis\.com\/v1\/projects\/arbor-test\/locations\/eu\/publishers\/anthropic\/models\/[^:]+:rawPredict$/);
  });

  it("a regional VERTEX_CLAUDE_LOCATION → the regional endpoint", async () => {
    const provider = new ClaudeVertexProvider(createTestConfig({ vertexClaudeLocation: "europe-west4" }));
    await provider.generateJson({ route: "analysis_structured", prompt: "hi" } as never);
    expect(urls[0]).toMatch(/^https:\/\/europe-west4-aiplatform\.googleapis\.com\/v1\/projects\/arbor-test\/locations\/europe-west4\//);
  });
});
