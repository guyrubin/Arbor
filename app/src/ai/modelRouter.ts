import { GoogleGenAI, type Schema } from "@google/genai";
import { GoogleAuth } from "google-auth-library";
import type { ArborConfig } from "../config/env.js";

export type ModelRoute =
  | "coach_high_stakes"
  | "creative_low_risk"
  | "analysis_structured"
  | "handoff_structured";

export type GenerateJsonOptions = {
  route: ModelRoute;
  prompt: string;
  schema?: Schema | Record<string, unknown>;
  temperature?: number;
};

export type ProviderId = "gemini_dev" | "vertex_gemini" | "vertex_claude";

export type RouteDecision = {
  route: ModelRoute;
  provider: ProviderId;
  model: string;
};

export type ModelProvider = {
  generateJson(options: GenerateJsonOptions): Promise<unknown>;
  generateJsonStream(options: GenerateJsonOptions): AsyncIterable<string>;
  routeDecision(route: ModelRoute): RouteDecision;
  /**
   * H-04 — Generate a single illustration for a story page. Returns a data URL
   * (data:image/png;base64,…) or null when image generation is unavailable
   * (no key, unsupported provider, or any failure). Callers must degrade
   * gracefully; an illustration is a delight, never a dependency.
   */
  generateImage?(prompt: string): Promise<string | null>;
};

export const modelForRoute = (config: ArborConfig, route: ModelRoute) => {
  if (config.modelProvider === "gemini_dev") return config.geminiModel;

  const map: Record<ModelRoute, string> = {
    coach_high_stakes: config.vertexModelChat,
    creative_low_risk: config.vertexModelStory,
    analysis_structured: config.vertexModelAnalysis,
    handoff_structured: config.vertexModelHandoff
  };
  return map[route];
};

export const routeDecisionFor = (config: ArborConfig, route: ModelRoute): RouteDecision => {
  if (config.modelProvider === "gemini_dev") {
    return { route, provider: "gemini_dev", model: config.geminiModel };
  }

  if (route === "coach_high_stakes") {
    return { route, provider: "vertex_claude", model: config.vertexModelChat };
  }

  return { route, provider: "vertex_gemini", model: modelForRoute(config, route) };
};

export const toAnthropicVertexModelId = (model: string) => {
  if (model === "claude-3-5-sonnet@anthropic") return "claude-3-5-sonnet-v2@20241022";
  return model.replace(/@anthropic$/, "");
};

export class GeminiDevProvider implements ModelProvider {
  private readonly ai: GoogleGenAI;

  constructor(private readonly config: ArborConfig) {
    if (!config.geminiApiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined. Arbor AI calls will fail until configured.");
    }
    this.ai = new GoogleGenAI({
      apiKey: config.geminiApiKey || "MOCK_KEY",
      httpOptions: { headers: { "User-Agent": "arbor-private-beta" } }
    });
  }

  routeDecision(route: ModelRoute) {
    return routeDecisionFor(this.config, route);
  }

  async generateJson(options: GenerateJsonOptions) {
    this.assertApiKey();
    const response = await this.ai.models.generateContent({
      model: modelForRoute(this.config, options.route),
      contents: options.prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: options.schema as Schema,
        temperature: options.temperature ?? 0.4
      }
    });
    return JSON.parse(response.text.trim());
  }

  async *generateJsonStream(options: GenerateJsonOptions) {
    this.assertApiKey();
    const responseStream = await this.ai.models.generateContentStream({
      model: modelForRoute(this.config, options.route),
      contents: options.prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: options.schema as Schema,
        temperature: options.temperature ?? 0.4
      }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) yield chunk.text;
    }
  }

  async generateImage(prompt: string): Promise<string | null> {
    if (!this.config.geminiApiKey) return null;
    try {
      const ai = this.ai as any;
      // Preferred path: Imagen image generation.
      if (typeof ai.models.generateImages === "function") {
        const result = await ai.models.generateImages({
          model: this.config.geminiImageModel,
          prompt,
          config: { numberOfImages: 1, aspectRatio: "4:3" }
        });
        const bytes = result?.generatedImages?.[0]?.image?.imageBytes;
        if (bytes) return `data:image/png;base64,${bytes}`;
      }
      // Fallback: multimodal model returning inline image data.
      const response = await this.ai.models.generateContent({
        model: this.config.geminiImageModel,
        contents: prompt,
        config: { responseModalities: ["IMAGE", "TEXT"] } as any
      });
      const parts = (response as any)?.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        const data = part?.inlineData?.data;
        const mime = part?.inlineData?.mimeType || "image/png";
        if (data) return `data:${mime};base64,${data}`;
      }
      return null;
    } catch (error) {
      console.warn("[Arbor Image] Illustration generation failed:", (error as Error)?.message);
      return null;
    }
  }

  private assertApiKey() {
    if (!this.config.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured for local Arbor development.");
    }
  }
}

export class ClaudeVertexProvider {
  private readonly auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

  constructor(private readonly config: ArborConfig) {}

  async generateJson(options: GenerateJsonOptions) {
    const text = await this.callClaude(options);
    return JSON.parse(text.trim());
  }

  async *generateJsonStream(options: GenerateJsonOptions) {
    yield await this.callClaude(options);
  }

  private async callClaude(options: GenerateJsonOptions) {
    if (!this.config.gcpProjectId) throw new Error("GCP_PROJECT_ID is required for Claude on Vertex.");
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();
    const token = typeof accessToken === "string" ? accessToken : accessToken?.token;
    if (!token) throw new Error("Could not acquire Google access token for Claude on Vertex.");

    const model = toAnthropicVertexModelId(options.route === "coach_high_stakes" ? this.config.vertexModelChat : modelForRoute(this.config, options.route));
    const url = `https://${this.config.vertexLocation}-aiplatform.googleapis.com/v1/projects/${this.config.gcpProjectId}/locations/${this.config.vertexLocation}/publishers/anthropic/models/${model}:rawPredict`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        anthropic_version: "vertex-2023-10-16",
        max_tokens: 4096,
        temperature: options.temperature ?? 0.35,
        system: "Return valid JSON only. Do not include markdown fences.",
        messages: [{ role: "user", content: options.prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude on Vertex failed (${response.status}): ${await response.text()}`);
    }

    const payload = await response.json() as { content?: { type: string; text?: string }[] };
    const text = payload.content?.map((part) => part.text || "").join("") || "";
    if (!text.trim()) throw new Error("Claude on Vertex returned an empty response.");
    return text;
  }
}

export class VertexGeminiProvider {
  private vertexPromise: Promise<any> | null = null;

  constructor(private readonly config: ArborConfig) {}

  async generateJson(options: GenerateJsonOptions) {
    const model = await this.getModel(options.route);
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: options.prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: options.schema,
        temperature: options.temperature ?? 0.35
      }
    });
    const text = result.response?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
    return JSON.parse(text.trim());
  }

  async *generateJsonStream(options: GenerateJsonOptions) {
    const model = await this.getModel(options.route);
    const result = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: options.prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: options.schema,
        temperature: options.temperature ?? 0.35
      }
    });

    for await (const item of result.stream) {
      const text = item.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
      if (text) yield text;
    }
  }

  private async getModel(route: ModelRoute) {
    if (!this.vertexPromise) {
      this.vertexPromise = import("@google-cloud/vertexai").then(({ VertexAI }) => new VertexAI({
        project: this.config.gcpProjectId,
        location: this.config.vertexLocation
      }));
    }
    const vertex = await this.vertexPromise;
    return vertex.getGenerativeModel({ model: modelForRoute(this.config, route) });
  }
}

export class VertexModelProvider implements ModelProvider {
  private readonly claude: ClaudeVertexProvider;
  private readonly gemini: VertexGeminiProvider;

  constructor(private readonly config: ArborConfig) {
    this.claude = new ClaudeVertexProvider(config);
    this.gemini = new VertexGeminiProvider(config);
  }

  routeDecision(route: ModelRoute) {
    return routeDecisionFor(this.config, route);
  }

  generateJson(options: GenerateJsonOptions) {
    return this.providerFor(options.route).generateJson(options);
  }

  generateJsonStream(options: GenerateJsonOptions) {
    return this.providerFor(options.route).generateJsonStream(options);
  }

  private providerFor(route: ModelRoute) {
    return route === "coach_high_stakes" ? this.claude : this.gemini;
  }
}

export const createModelProvider = (config: ArborConfig): ModelProvider => {
  if (config.modelProvider === "vertex") return new VertexModelProvider(config);
  return new GeminiDevProvider(config);
};
