import { GoogleGenAI, type Schema } from "@google/genai";
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

export type ModelProvider = {
  generateJson(options: GenerateJsonOptions): Promise<unknown>;
  generateJsonStream(options: GenerateJsonOptions): AsyncIterable<string>;
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

  private assertApiKey() {
    if (!this.config.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured for local Arbor development.");
    }
  }
}

export class VertexModelProvider implements ModelProvider {
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
      this.vertexPromise = import("@google-cloud/vertexai").then(({ VertexAI }) => {
        const vertex = new VertexAI({
          project: this.config.gcpProjectId,
          location: this.config.vertexLocation
        });
        return vertex;
      });
    }
    const vertex = await this.vertexPromise;
    return vertex.getGenerativeModel({ model: modelForRoute(this.config, route) });
  }
}

export const createModelProvider = (config: ArborConfig): ModelProvider => {
  if (config.modelProvider === "vertex") return new VertexModelProvider(config);
  return new GeminiDevProvider(config);
};
