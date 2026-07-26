import { GoogleGenAI, type Schema } from "@google/genai";
import type { ArborConfig } from "../config/env.js";
import { ClaudeVertexProvider } from "./claudeVertexProvider.js";
import { abortableIterate, raceWithAbort, withModelRetry, type ModelCallBudget } from "./modelRetry.js";
import { recordUsage, startCallTimer } from "./usage.js";
import { providerRegion, routePolicyFor, selectProvider, type ProviderCandidate } from "./capabilities/policy.js";
import type { CapabilityRequest } from "./capabilities/contracts.js";

export { withModelRetry, isAbortError, newAbortError, type ModelCallBudget } from "./modelRetry.js";

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
  /** AIR-9: route deadline budget — aborts/frees the upstream call. */
  budget?: ModelCallBudget;
  /** EVAL-6: PROMPT_VERSIONS version of the prompt behind this call — stamped
   *  into the ai.usage telemetry event so eval results tie to the prompt. */
  promptVersion?: string;
};

/** Options for image GENERATION (Gemini 2.5 Flash Image). No JSON schema; optional
 *  reference images steer style/consistency (e.g. a prior character asset). */
export type GenerateImageOptions = {
  prompt: string;
  images?: ImagePart[];
  /** AIR-9: route deadline budget — aborts/frees the upstream call. */
  budget?: ModelCallBudget;
};

/**
 * AIR-3: per-route Gemini thinking budget. Gemini 2.5 Flash ships with dynamic
 * thinking ON, so trivial latency-critical calls (capture extraction, the voice
 * reply, digest, Today's Focus) were paying seconds of invisible thinking
 * tokens for no quality gain. `analysis_structured` (which also carries the
 * /voice streamText replies) turns thinking OFF; coach/creative routes keep the
 * model default (dynamic). Only applied to models that accept a zero budget
 * (2.5 Flash family — 2.5 Pro rejects 0, and non-2.5 models reject the field).
 * Note: this also covers the optional semantic classifier call — acceptable by
 * design (default-OFF, fails open); the lexical floor is untouched.
 */
export const thinkingConfigForRoute = (
  route: ModelRoute,
  model: string,
): { thinkingBudget: number } | undefined =>
  route === "analysis_structured" && /gemini-2\.5-flash/i.test(model) && !/image/i.test(model)
    ? { thinkingBudget: 0 }
    : undefined;

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

export type StreamTextOptions = {
  route: ModelRoute;
  prompt: string;
  temperature?: number;
  /** AIR-9: route deadline budget — aborts/frees the upstream call. */
  budget?: ModelCallBudget;
  /** EVAL-6: prompt version stamped into the ai.usage event (see prompts.ts). */
  promptVersion?: string;
};

export type ModelProvider = {
  generateJson(options: GenerateJsonOptions): Promise<unknown>;
  generateJsonStream(options: GenerateJsonOptions): AsyncIterable<string>;
  /** Plain-text token stream — used by the realtime streaming voice coach. */
  streamText(options: StreamTextOptions): AsyncIterable<string>;
  /** Generate a stylized image (avatars, story scenes). Always routed to a Gemini image model. */
  generateImage(options: GenerateImageOptions): Promise<GeneratedImage>;
  routeDecision(route: ModelRoute): RouteDecision;
};

/** The raw config→model map (no policy). Internal: production callers go
 *  through modelForRoute / routeDecisionFor, which enforce the route policy. */
const modelIdForRoute = (config: ArborConfig, route: ModelRoute) => {
  if (config.modelProvider === "gemini_dev") return config.geminiModel;

  const map: Record<ModelRoute, string> = {
    coach_high_stakes: config.vertexModelChat,
    creative_low_risk: config.vertexModelStory,
    analysis_structured: config.vertexModelAnalysis,
    handoff_structured: config.vertexModelHandoff
  };
  return map[route];
};

// ── COACH-3: the ai/capabilities policy layer is WIRED here, not scaffolding.
// Every structured-text/stream route decision executes selectProvider against
// the RoutePolicy built from ArborConfig, so provider eligibility (region /
// no-training / retention) is actually enforced on production request paths —
// and fails closed (AiProviderError "policy_denied") on a misconfigured region
// instead of silently routing family data to an ineligible provider.

const CANDIDATE_SCORE = { quality: 3, safety: 3, reliability: 3, latencyFitness: 3, costFitness: 3 } as const;

/** The single provider candidate the current config yields for a route,
 *  declared with its real residency/retention posture for the policy gate. */
export const structuredTextCandidateFor = (config: ArborConfig, route: ModelRoute): ProviderCandidate => {
  if (config.modelProvider === "gemini_dev") {
    return {
      // AI-Studio developer API has no regional endpoint — declared honestly as
      // "global", which the route policy only admits outside prod.
      ref: { provider: "gemini_dev", model: config.geminiModel, region: "global" },
      capabilities: ["structured_text", "text_stream"],
      audiences: ["parent", "professional", "internal"],
      dataClasses: ["public", "account", "child_profile"],
      trainsOnCustomerData: false,
      retentionDays: 30,
      score: CANDIDATE_SCORE
    };
  }
  return {
    ref: {
      provider: route === "coach_high_stakes" ? "vertex_claude" : "vertex_gemini",
      model: modelIdForRoute(config, route),
      region: providerRegion(config.vertexLocation)
    },
    capabilities: ["structured_text", "text_stream"],
    audiences: ["parent", "professional", "internal"],
    dataClasses: ["public", "account", "child_profile"],
    trainsOnCustomerData: false,
    retentionDays: 0,
    score: CANDIDATE_SCORE
  };
};

/** Policy-enforced model id for a route (throws policy_denied when the
 *  configured provider violates the route policy — fail closed). */
export const modelForRoute = (config: ArborConfig, route: ModelRoute) =>
  routeDecisionFor(config, route).model;

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
  const request: CapabilityRequest<"structured_text"> = {
    capability: "structured_text",
    route,
    audience: "parent",
    locale: "en",
    dataClasses: ["child_profile"],
    risk: route === "coach_high_stakes" ? "high" : "moderate"
  };
  const decision = selectProvider(request, routePolicyFor(config), [structuredTextCandidateFor(config, route)]);
  return { route, provider: decision.selected.ref.provider as ProviderId, model: decision.selected.ref.model };
};

export const toAnthropicVertexModelId = (model: string) => {
  // Legacy pin: the 2024 shorthand keeps resolving to the dated v2 snapshot.
  // Current-generation Claude models on Vertex use the bare first-party id
  // (e.g. claude-sonnet-5@anthropic -> claude-sonnet-5).
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
    const timer = startCallTimer();
    const thinking = thinkingConfigForRoute(options.route, model);
    const response = await withModelRetry(() =>
      this.ai.models.generateContent({
        model,
        contents: buildGenAiContents(options.prompt, options.images) as any,
        config: {
          responseMimeType: "application/json",
          responseSchema: options.schema as Schema,
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: this.config.maxOutputTokens,
          ...(thinking ? { thinkingConfig: thinking } : {}),
          ...(options.budget?.signal ? { abortSignal: options.budget.signal } : {})
        }
      }), 3, options.budget
    );
    recordUsage({ route: options.route, provider: "gemini_dev", model, promptVersion: options.promptVersion }, (response as any)?.usageMetadata, timer.finish());
    const finishReason = (response as any)?.candidates?.[0]?.finishReason;
    return parseModelJson(response.text, finishReason);
  }

  async *generateJsonStream(options: GenerateJsonOptions) {
    this.assertApiKey();
    const model = modelForGeminiRequest(this.config, options.route, options.images);
    const timer = startCallTimer();
    const thinking = thinkingConfigForRoute(options.route, model);
    const responseStream = await withModelRetry(() =>
      this.ai.models.generateContentStream({
        model,
        contents: buildGenAiContents(options.prompt, options.images) as any,
        config: {
          responseMimeType: "application/json",
          responseSchema: options.schema as Schema,
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: this.config.maxOutputTokens,
          ...(thinking ? { thinkingConfig: thinking } : {}),
          ...(options.budget?.signal ? { abortSignal: options.budget.signal } : {})
        }
      }), 3, options.budget
    );

    let usage: any;
    for await (const chunk of abortableIterate(responseStream, options.budget?.signal)) {
      if ((chunk as any).usageMetadata) usage = (chunk as any).usageMetadata;
      if (chunk.text) { timer.markFirstChunk(); yield chunk.text; }
    }
    recordUsage({ route: options.route, provider: "gemini_dev", model, promptVersion: options.promptVersion }, usage, timer.finish());
  }

  async *streamText(options: StreamTextOptions) {
    this.assertApiKey();
    const model = modelForRoute(this.config, options.route);
    const timer = startCallTimer();
    const thinking = thinkingConfigForRoute(options.route, model);
    const responseStream = await withModelRetry(() =>
      this.ai.models.generateContentStream({
        model,
        contents: options.prompt,
        config: {
          temperature: options.temperature ?? 0.5,
          maxOutputTokens: this.config.maxOutputTokens,
          ...(thinking ? { thinkingConfig: thinking } : {}),
          ...(options.budget?.signal ? { abortSignal: options.budget.signal } : {})
        }
      }), 3, options.budget
    );
    let usage: any;
    for await (const chunk of abortableIterate(responseStream, options.budget?.signal)) {
      if ((chunk as any).usageMetadata) usage = (chunk as any).usageMetadata;
      if (chunk.text) { timer.markFirstChunk(); yield chunk.text; }
    }
    recordUsage({ route: options.route, provider: "gemini_dev", model, promptVersion: options.promptVersion }, usage, timer.finish());
  }

  async generateImage(options: GenerateImageOptions): Promise<GeneratedImage> {
    this.assertApiKey();
    const timer = startCallTimer();
    const response = await withModelRetry(() =>
      this.ai.models.generateContent({
        model: this.config.geminiImageModel,
        contents: buildGenAiContents(options.prompt, options.images) as any,
        config: {
          responseModalities: ["IMAGE"],
          ...(options.budget?.signal ? { abortSignal: options.budget.signal } : {})
        } as any
      }), 3, options.budget
    );
    recordUsage({ route: "creative_low_risk", provider: "gemini_dev", model: this.config.geminiImageModel }, (response as any)?.usageMetadata, timer.finish());
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
    const timer = startCallTimer();
    const thinking = thinkingConfigForRoute(options.route, modelId);
    // The @google-cloud/vertexai SDK exposes no per-call abort hook, so the
    // call is RACED against the budget signal (frees the request; billing for
    // an already-issued generation is bounded by maxOutputTokens).
    const result: any = await withModelRetry(() =>
      raceWithAbort(model.generateContent({
        contents: [{ role: "user", parts: buildVertexParts(options.prompt, options.images) }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: options.schema,
          temperature: options.temperature ?? 0.35,
          maxOutputTokens: this.config.maxOutputTokens,
          ...(thinking ? { thinkingConfig: thinking } : {})
        } as any
      }), options.budget?.signal), 3, options.budget
    );
    recordUsage({ route: options.route, provider: "vertex_gemini", model: modelId, promptVersion: options.promptVersion }, result.response?.usageMetadata, timer.finish());
    const candidate = result.response?.candidates?.[0];
    const text = candidate?.content?.parts?.map((part: any) => part.text || "").join("") || "";
    return parseModelJson(text, candidate?.finishReason);
  }

  async *generateJsonStream(options: GenerateJsonOptions) {
    const modelId = modelForGeminiRequest(this.config, options.route, options.images);
    const model = await this.getModel(options.route, options.images);
    const timer = startCallTimer();
    const thinking = thinkingConfigForRoute(options.route, modelId);
    const result: any = await withModelRetry(() =>
      raceWithAbort(model.generateContentStream({
        contents: [{ role: "user", parts: buildVertexParts(options.prompt, options.images) }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: options.schema,
          temperature: options.temperature ?? 0.35,
          maxOutputTokens: this.config.maxOutputTokens,
          ...(thinking ? { thinkingConfig: thinking } : {})
        } as any
      }), options.budget?.signal), 3, options.budget
    );

    let usage: any;
    for await (const item of abortableIterate<any>(result.stream, options.budget?.signal)) {
      if (item.usageMetadata) usage = item.usageMetadata;
      const text = item.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
      if (text) { timer.markFirstChunk(); yield text; }
    }
    recordUsage({ route: options.route, provider: "vertex_gemini", model: modelId, promptVersion: options.promptVersion }, usage ?? (await result.response)?.usageMetadata, timer.finish());
  }

  async *streamText(options: StreamTextOptions) {
    const modelId = modelForRoute(this.config, options.route);
    const model = await this.getModel(options.route);
    const timer = startCallTimer();
    const thinking = thinkingConfigForRoute(options.route, modelId);
    const result: any = await withModelRetry(() =>
      raceWithAbort(model.generateContentStream({
        contents: [{ role: "user", parts: [{ text: options.prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.5,
          maxOutputTokens: this.config.maxOutputTokens,
          ...(thinking ? { thinkingConfig: thinking } : {})
        } as any
      }), options.budget?.signal), 3, options.budget
    );
    let usage: any;
    for await (const item of abortableIterate<any>(result.stream, options.budget?.signal)) {
      if (item.usageMetadata) usage = item.usageMetadata;
      const text = item.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
      if (text) { timer.markFirstChunk(); yield text; }
    }
    recordUsage({ route: options.route, provider: "vertex_gemini", model: modelId, promptVersion: options.promptVersion }, usage ?? (await result.response)?.usageMetadata, timer.finish());
  }

  async generateImage(options: GenerateImageOptions): Promise<GeneratedImage> {
    const model = await this.getImageModel();
    const timer = startCallTimer();
    const result: any = await withModelRetry(() =>
      raceWithAbort(model.generateContent({
        contents: [{ role: "user", parts: buildVertexParts(options.prompt, options.images) }],
        generationConfig: { responseModalities: ["IMAGE"] }
      }), options.budget?.signal), 3, options.budget
    );
    recordUsage({ route: "creative_low_risk", provider: "vertex_gemini", model: this.config.vertexModelImage }, result.response?.usageMetadata, timer.finish());
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
