import { describe, expect, it } from "vitest";
import { isVertexMultiRegion, vertexApiEndpoint } from "./vertexEndpoint.js";
import { VertexGeminiProvider } from "./modelRouter.js";
import { createTestConfig } from "../testConfig.js";
import { loadConfig } from "../config/env.js";

describe("B-GA-27 · Vertex multi-region endpoint for the deprecated SDK", () => {
  it("eu / us get the rep host; a regional location keeps the SDK default", () => {
    expect(vertexApiEndpoint("eu")).toBe("aiplatform.eu.rep.googleapis.com");
    expect(vertexApiEndpoint(" EU ")).toBe("aiplatform.eu.rep.googleapis.com");
    expect(vertexApiEndpoint("us")).toBe("aiplatform.us.rep.googleapis.com");
    expect(vertexApiEndpoint("europe-west4")).toBeUndefined();
    expect(vertexApiEndpoint("global")).toBeUndefined();
    expect(isVertexMultiRegion("eu")).toBe(true);
    expect(isVertexMultiRegion("europe-west3")).toBe(false);
  });

  it("images never follow the text location (europe-west3 or eu): the configured image list is the order", () => {
    for (const vertexLocation of ["europe-west3", "eu"]) {
      const provider = new VertexGeminiProvider(createTestConfig({
        arborEnv: "prod",
        vertexLocation,
        vertexImageRegions: ["europe-west4", "europe-west1", "europe-west3"],
      }));
      expect(provider.imageRegions(), vertexLocation).toEqual(["europe-west4", "europe-west1", "europe-west3"]);
    }
    const bare = new VertexGeminiProvider(createTestConfig({ arborEnv: "prod", vertexLocation: "europe-west3", gcpRegion: "europe-west4", vertexImageRegions: [] }));
    expect(bare.imageRegions()).toEqual(["europe-west4"]);
  });

  it("the prod env (VERTEX_LOCATION=europe-west3, GCP_REGION=europe-west4) keeps europe-west4 as the image primary", () => {
    const keys = ["VERTEX_LOCATION", "GCP_REGION", "VERTEX_IMAGE_REGIONS", "VERTEX_MODEL_STORY", "VERTEX_MODEL_ANALYSIS", "VERTEX_MODEL_HANDOFF"];
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    try {
      for (const k of keys) delete process.env[k];
      Object.assign(process.env, { VERTEX_LOCATION: "europe-west3", GCP_REGION: "europe-west4", VERTEX_IMAGE_REGIONS: "europe-west4,europe-west1,europe-west3" });
      const prod = loadConfig();
      expect(prod.vertexLocation).toBe("europe-west3");
      expect(prod.vertexImageRegions).toEqual(["europe-west4", "europe-west1", "europe-west3"]);
      delete process.env.VERTEX_LOCATION;
      const defaults = loadConfig();
      expect(defaults.vertexLocation).toBe("europe-west3"); // the text default follows the gemini-3.5-flash default
      expect([defaults.vertexModelStory, defaults.vertexModelAnalysis, defaults.vertexModelHandoff]).toEqual(["gemini-3.5-flash", "gemini-3.5-flash", "gemini-3.5-flash"]);
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  });
});
