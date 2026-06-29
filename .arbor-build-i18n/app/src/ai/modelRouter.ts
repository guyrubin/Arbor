import { GoogleGenAI, type Schema } from "@google/genai";
import type { ArborConfig } from "../config/env.js";
import { ClaudeVertexProvider } from "./claudeVertexProvider.js";
import { withModelRetry } from "./modelRetry.js";
import { recordUsage } from "./usage.js";

export { withModelRetry } from "./modelRetry.js";

export type ModelRoute =
  | "coach_high_stakes"
  | "creative_low_risk"
  | "analysis_structured"
  | "handoff_structured";

/** An inline image part (base64 data without the `data:` prefix). VIS-1. */
export type ImagePart = { data: string; mimeType: string };

export type GenerateJsonOptions = {
  route: ModelRoute;
  prompt: string;
  schema?: Schema | Record<string, unknown>;
  temperature?: number;
  /** Optional images for multimodal (vision / document) requests. */
  images?: ImagePart[];
};

/** Options for image GENERATION (Gemini 2.5 Flash Image). No JSON schema; optional
 *  reference images steer style/consistency (e.g. a prior character asset). */
export type GenerateImageOptions = {
  prompt: string;
  images?: ImagePart[];
};

/** A generated image returned as raw base64 (no `data:` prefix). */
export type GeneratedImage = { data: string; mimeType: string };

/** Pull the first inline image out of a model `candidates` array (genai + vertex shapes). */
export const extractInlineImage = (candidates: any): GeneratedImage => {
  const parts = candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part?.inlineData ?? part?.inline_data;
    if (inline?.data) {
      return { data: inline.data, mimeType: inline.mimeType ?? inline.mime_type ?? "image/png" };
    }
  }
  const finishReason = candidates?.[0]?.finishReason;
  throw new Error(
    finishReason && finishReason !== "STOP"
      ? `Image generation returned no image (finishReason: ${finishReason}); the request was likely blocked.`
      : "Image generation returned no image content."
  );
};

/** Build a `contents` value for @google/genai: a bare string, or text + images. */
export const buildGenAiContents = (prompt: string, images?: ImagePart[]) => {
  if (!images?.length) return prompt;
  return [
    { text: prompt },
    ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
  ];
};

/** Build a Vertex `parts` array: text followed by any inline images. */
export const buildVertexParts = (prompt: string, images?: ImagePart[]) => [
  { text: prompt },
  ...(images || []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
];

/** Parse model JSON output, surfacing truncation/safety blocks instead of a raw SyntaxError. */
export const parseModelJson = (text: string | undefined, finishReason?: string): unknown => {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    throw new Error(
      finishReason
        ? `Model returned no content (finishReason: ${finishReason}); the response was likely blocked or truncated.`
        : "Model returned an empty response."
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    if (finishReason && finishReason !== "STOP") {
      throw new Error(
        `Model output was incomplete (finishReason: ${finishReason}); JSON could not be parsed. Consider raising MAX_OUTPUT_TOKENS.`
      );
    }
    throw new Error("Model returned malformed JSON that could not be parsed.");
  }
};

export type ProviderId = "gemini_dev" | "vertex_gemini" | "vertex_claude";

export type RouteDecision = {
  route: ModelRoute;
  provider: ProviderId;
  model: string;
};

export type StreamTextOptions = { route: ModelRoute; prompt: string; temperature?: number };

export type ModelProvider = {
  generateJson(options: GenerateJsonOptions): Promise<unknown>;
  generateJsonStream(options: GenerateJsonOptions): AsyncIterable<string>;
  /** Plain-text token stream — used by the realtime streaming voice coach. */
  streamText(options: StreamTextOptions): AsyncIterable<string>;
  /** Generate a stylized image (avatars, story scenes). Always routed to a Gemini image model. */
  generateImage(options: GenerateImageOptions): Promise<GeneratedImage>;
  routeDecision(route: ModelRoute): RouteDecision;
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

const isClaudeVertexModel = (model: string) => /^claude-/i.test(model);

export const modelForGeminiRequest = (config: ArborConfig, route: ModelRoute, images?: ImagePart[]) => {
  const routeModel = modelForRoute(config, route);
  if (!images?.length || !isClaudeVertexModel(routeModel)) return routeModel;

  const multimodalModel = [
    config.vertexModelAnalysis,
    config.vertexModelStory,
    config.vertexModelHandoff,
    config.geminiModel
  ].find((model) => model && !isClaudeVertexModel(model));

  if (!multimodalModel) {
    throw new Error("No Gemini model is configured for multimodal image requests.");
  }
  return multimodalModel;
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
    const model = modelForGeminiRequest(this.config, options.route, options.images);
    const response = await withModelRetry(() =>
      this.ai.models.generateContent({
        model,
        contents: buildGenAiContents(options.prompt, options.images) as any,
        config: {
          responseMimeType: "application/json",
          responseSchema: options.schema as Schema,
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: this.config.maxOutputTokens
        }
      })
    );
    recordUsage({ route: options.route, provider: "gemini_dev", model }, (response as any)?.usageMetadata);
    const finishReason = (response as any)?.candidates?.[0]?.finishReason;
    return parseModelJson(response.text, finishReason);
  }

  async *generateJsonStream(options: GenerateJsonOptions) {
    this.assertApiKey();
    const model = modelForGeminiRequest(this.config, options.route, options.images);
    const responseStream = await withModelRetry(() =>
      this.ai.models.generateContentStream({
        model,
        contents: buildGenAiContents(options.prompt, options.images) as any,
        config: {
          responseMimeType: "application/json",
          responseSchema: options.schema as Schema,
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: this.config.maxOutputTokens
        }
      })
    );

    let usage: any;
    for await (const chunk of responseStream) {
      if ((chunk as any).usageMetadata) usage = (chunk as any).usageMetadata;
      if (chunk.text) yield chunk.text;
    }
    recordUsage({ route: options.route, provider: "gemini_dev", model }, usage);
  }

  async *streamText(options: StreamTextOptions) {
    this.assertApiKey();
    const model = modelForRoute(this.config, options.route);
    const responseStream = await withModelRetry(() =>
      this.ai.models.generateContentStream({
        model,
        contents: options.prompt,
        config: { temperature: options.temperature ?? 0.5, maxOutputTokens: this.config.maxOutputTokens }
      })
    );
    let usage: any;
    for await (const chunk of responseStream) {
      if ((chunk as any).usageMetadata) usage = (chunk as any).usageMetadata;
      if (chunk.text) yield chunk.text;
    }
    recordUsage({ route: options.route, provider: "gemini_dev", model }, usage);
  }

  async generateImage(options: GenerateImageOptions): Promise<GeneratedImage> {
    this.assertApiKey();
    const response = await withModelRetry(() =>
      this.ai.models.generateContent({
        model: this.config.geminiImageModel,
        contents: buildGenAiContents(options.prompt, options.images) as any,
        config: { responseModalities: ["IMAGE"] } as any
      })
    );
    recordUsage({ route: "creative_low_risk", provider: "gemini_dev", model: this.config.geminiImageModel }, (response as any)?.usageMetadata);
    return extractInlineImage((response as any)?.candidates);
  }

  private assertApiKey() {
    if (!this.config.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured for local Arbor development.");
    }
  }
}

export class VertexGeminiProvider {
  private vertexPromise: Promise<any> | null = null;

  constructor(private readonly config: ArborConfig) {}

  async generateJson(options: GenerateJsonOptions) {
    const modelId = modelForGeminiRequest(this.config, options.route, options.images);
    const model = await this.getModel(options.route, options.images);
    const result: any = await withModelRetry(() =>
      model.generateContent({
        contents: [{ role: "user", parts: buildVertexParts(options.prompt, options.images) }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: options.schema,
          temperature: options.temperature ?? 0.35,
          maxOutputTokens: this.config.maxOutputTokens
        }
      })
    );
    recordUsage({ route: options.route, provider: "vertex_gemini", model: modelId }, result.response?.usageMetadata);
    const candidate = result.response?.candidates?.[0];
    const text = candidate?.content?.parts?.map((part: any) => part.text || "").join("") || "";
    return parseModelJson(text, candidate?.finishReason);
  }

  async *generateJsonStream(options: GenerateJsonOptions) {
    const modelId = modelForGeminiRequest(this.config, options.route, options.images);
    const model = await this.getModel(options.route, options.images);
    const result: any = await withModelRetry(() =>
      model.generateContentStream({
        contents: [{ role: "user", parts: buildVertexParts(options.prompt, options.images) }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: options.schema,
          temperature: options.temperature ?? 0.35,
          maxOutputTokens: this.config.maxOutputTokens
        }
      })
    );

    let usage: any;
    for await (const item of result.stream) {
      if (item.usageMetadata) usage = item.usageMetadata;
      const text = item.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
      if (text) yield text;
    }
    recordUsage({ route: options.route, provider: "vertex_gemini", model: modelId }, usage ?? (await result.response)?.usageMetadata);
  }

  async *streamText(options: StreamTextOptions) {
    const modelId = modelForRoute(this.config, options.route);
    const model = await this.getModel(options.route);
    const result: any = await withModelRetry(() =>
      model.generateContentStream({
        contents: [{ role: "user", parts: [{ text: options.prompt }] }],
        generationConfig: { temperature: options.temperature ?? 0.5, maxOutputTokens: this.config.maxOutputTokens }
      })
    );
    let usage: any;
    for await (const item of result.stream) {
      if (item.usageMetadata) usage = item.usageMetadata;
      const text = item.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
      if (text) yield text;
    }
    recordUsage({ route: options.route, provider: "vertex_gemini", model: modelId }, usage ?? (await result.response)?.usageMetadata);
  }

  async generateImage(options: GenerateImageOptions): Promise<GeneratedImage> {
    const model = await this.getImageModel();
    const result: any = await withModelRetry(() =>
      model.generateContent({
        contents: [{ role: "user", parts: buildVertexParts(options.prompt, options.images) }],
        generationConfig: { responseModalities: ["IMAGE"] }
      })
    );
    recordUsage({ route: "creative_low_risk", provider: "vertex_gemini", model: this.config.vertexModelImage }, result.response?.usageMetadata);
    return extractInlineImage(result.response?.candidates);
  }

  private async getModel(route: ModelRoute, images?: ImagePart[]) {
    const vertex = await this.getVertex();
    return vertex.getGenerativeModel({ model: modelForGeminiRequest(this.config, route, images) });
  }

  private async getImageModel() {
    const vertex = await this.getVertex();
    return vertex.getGenerativeModel({ model: this.config.vertexModelImage });
  }

  private async getVertex() {
    if (!this.vertexPromise) {
      this.vertexPromise = import("@google-cloud/vertexai").then(({ VertexAI }) => new VertexAI({
        project: this.config.gcpProjectId,
        location: this.config.vertexLocation
      }));
    }
    return this.vertexPromise;
  }
}

export class VertexModelProvider implements ModelProvider {
  private readonly claude: ClaudeVertexProvider;
  private readonly gemini: VertexGeminiProvider;
  /** AI-Studio Gemini for IMAGES only: same model (gemini-2.5-flash-image) but a
   *  separate quota pool from Vertex, which 429s under arcade/story load. Active
   *  only when GEMINI_API_KEY is set; otherwise images stay on Vertex. */
  private readonly genaiImages: GeminiDevProvider | null;

  constructor(private readonly config: ArborConfig) {
    this.claude = new ClaudeVertexProvider(config);
    this.gemini = new VertexGeminiProvider(config);
    this.genaiImages = config.geminiApiKey ? new GeminiDevProvider(config) : null;
  }

  routeDecision(route: ModelRoute) {
    return routeDecisionFor(this.config, route);
  }

  generateJson(options: GenerateJsonOptions) {
    return this.providerFor(options).generateJson(options);
  }

  streamText(options: StreamTextOptions) {
    // Plain-text voice streaming always uses the Gemini provider.
    return this.gemini.streamText(options);
  }

  generateImage(options: GenerateImageOptions) {
    // Image generation always uses the Gemini image model (Claude can't render
    // images). Prefer the AI-Studio path (separate quota) when a key is set,
    // else Vertex (which 429s under load).
    return (this.genaiImages ?? this.gemini).generateImage(options);
  }

  generateJsonStream(options: GenerateJsonOptions) {
    return this.providerFor(options).generateJsonStream(options);
  }

  private providerFor(options: GenerateJsonOptions) {
    if (options.images?.length) return this.gemini;
    return isClaudeVertexModel(modelForRoute(this.config, options.route)) ? this.claude : this.gemini;
  }
}

export const createModelProvider = (config: ArborConfig): ModelProvider => {
  if (config.modelProvider === "vertex") return new VertexModelProvider(config);
  return new GeminiDevProvider(config);
};
