import { GoogleGenAI, ThinkingLevel, type Schema } from "@google/genai";
import type { ArborConfig } from "../config/env.js";
import { withDefaultModelDeadlines } from "./modelDeadlines.js";
import { ClaudeVertexProvider } from "./claudeVertexProvider.js";
import { abortableIterate, isAbortError, isTransientModelError, newRetryAccounting, raceWithAbort, usageFromError, withModelRetry, type ModelCallBudget } from "./modelRetry.js";
import { recordChargedFailures, recordUsage, startCallTimer, type UsageMeta } from "./usage.js";
import { providerRegion, routePolicyFor, selectProvider, type ProviderCandidate } from "./capabilities/policy.js";
import type { AiEntitlement, CapabilityRequest } from "./capabilities/contracts.js";
import { candidatesFor, defaultCandidateFor } from "./capabilities/candidates.js";
import { MockModelProvider } from "./mockProvider.js";
import { vertexApiEndpoint } from "./vertexEndpoint.js";

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
 * model default (dynamic). The 2.5 Flash family takes a zero budget (2.5 Pro
 * rejects 0). B-GA-27 (probed on Vertex 9 Oct): the 3.x Flash line is switched
 * with thinkingLevel — gemini-3.5-flash rejects thinkingBudget when a document
 * or image rides with a responseSchema (400 "Thinking budget is not supported
 * for this model": every /vision import failed); MINIMAL gives 0 thought
 * tokens and ~1 s instead of ~17 s on a voice-sized prompt. gemini-3.8-flash
 * rejects MINIMAL; LOW is its lowest level.
 * Note: this also covers the optional semantic classifier call — acceptable by
 * design (default-OFF, fails open); the lexical floor is untouched.
 */
export const thinkingConfigForRoute = (
  route: ModelRoute,
  model: string,
): { thinkingBudget: number } | { thinkingLevel: ThinkingLevel } | undefined => {
  if (route !== "analysis_structured" || /image/i.test(model)) return undefined;
  // The Flash generation, parsed once (no literal model id: eval:safety pins every id).
  const generation = /gemini-(\d+(?:\.\d+)?)-flash/i.exec(model)?.[1];
  if (generation === "2.5") return { thinkingBudget: 0 };
  if (generation === "3.5") return { thinkingLevel: ThinkingLevel.MINIMAL };
  if (generation?.startsWith("3")) return { thinkingLevel: ThinkingLevel.LOW };
  return undefined;
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

/** B-INF-04: "mock" = ai/mockProvider.ts fixtures (sandbox only; prod refuses it in config/env.ts). */
export type ProviderId = "gemini_dev" | "vertex_gemini" | "vertex_claude" | "mock";

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

// ── COACH-3: the ai/capabilities policy layer is WIRED here, not scaffolding.
// Every structured-text/stream route decision executes selectProvider against
// the RoutePolicy built from ArborConfig, so provider eligibility (region /
// no-training / retention) is actually enforced on production request paths —
// and fails closed (AiProviderError "policy_denied") on a misconfigured region
// instead of silently routing family data to an ineligible provider.
// B-PROV-07: the candidates are a LIST (ai/capabilities/candidates.ts); unset
// AI_CANDIDATES_<ROUTE> = today's single candidate per route.

/** Today's single provider candidate for a route (the configured provider +
 *  model), declared with its real residency/retention posture. */
export const structuredTextCandidateFor = (config: ArborConfig, route: ModelRoute): ProviderCandidate =>
  defaultCandidateFor(config, route);

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

/** B-PROV-07: policy-enforced decision over the route's candidate list;
 *  `entitlement` weights the choice between eligible candidates (free → cost,
 *  paid → quality); absent → today's unweighted policy. */
export const routeDecisionFor = (config: ArborConfig, route: ModelRoute, entitlement?: AiEntitlement): RouteDecision => {
  const request: CapabilityRequest<"structured_text"> = {
    capability: "structured_text",
    route,
    audience: "parent",
    locale: "en",
    dataClasses: ["child_profile"],
    risk: route === "coach_high_stakes" ? "high" : "moderate",
    ...(entitlement ? { entitlement } : {})
  };
  const decision = selectProvider(request, routePolicyFor(config, request), candidatesFor(config, route));
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
    const accounting = newRetryAccounting();
    const meta = { route: options.route, provider: "gemini_dev" as const, model, promptVersion: options.promptVersion };
    let raw: unknown;
    try {
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
        }), 3, options.budget, accounting
      );
      raw = (response as any)?.usageMetadata;
      const finishReason = (response as any)?.candidates?.[0]?.finishReason;
      const parsed = parseModelJson(response.text, finishReason);
      recordUsage({ ...meta, retries: accounting.retries }, raw, timer.finish(), accounting);
      return parsed;
    } catch (err) {
      recordChargedFailures(meta, timer.finish(), accounting);
      if (raw !== undefined) recordUsage({ ...meta, chargedFailure: true, retries: accounting.retries }, raw, timer.finish());
      throw err;
    }
  }

  async *generateJsonStream(options: GenerateJsonOptions) {
    this.assertApiKey();
    const model = modelForGeminiRequest(this.config, options.route, options.images);
    const timer = startCallTimer();
    const thinking = thinkingConfigForRoute(options.route, model);
    const accounting = newRetryAccounting();
    const meta = { route: options.route, provider: "gemini_dev" as const, model, promptVersion: options.promptVersion };
    let responseStream;
    try {
      responseStream = await withModelRetry(() =>
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
        }), 3, options.budget, accounting
      );
    } catch (err) {
      recordChargedFailures(meta, timer.finish(), accounting);
      throw err;
    }
    recordChargedFailures(meta, timer.finish(), accounting);

    let usage: any;
    let completed = false;
    try {
      for await (const chunk of abortableIterate<any>(responseStream, options.budget?.signal)) {
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
        if (chunk.text) { timer.markFirstChunk(); yield chunk.text; }
      }
      completed = true;
    } finally {
      // B-AIOPS-01: a stream stopped early (output screen, abort, deadline, a
      // closed client) still bills what was generated; it keeps its receipt.
      if (!completed) recordUsage({ ...meta, endedEarly: true, retries: accounting.retries }, usage, timer.finish());
    }
    recordUsage({ ...meta, retries: accounting.retries }, usage, timer.finish());
  }

  async *streamText(options: StreamTextOptions) {
    this.assertApiKey();
    const model = modelForRoute(this.config, options.route);
    const timer = startCallTimer();
    const thinking = thinkingConfigForRoute(options.route, model);
    const accounting = newRetryAccounting();
    const meta = { route: options.route, provider: "gemini_dev" as const, model, promptVersion: options.promptVersion };
    let responseStream;
    try {
      responseStream = await withModelRetry(() =>
        this.ai.models.generateContentStream({
          model,
          contents: options.prompt,
          config: {
            temperature: options.temperature ?? 0.5,
            maxOutputTokens: this.config.maxOutputTokens,
            ...(thinking ? { thinkingConfig: thinking } : {}),
            ...(options.budget?.signal ? { abortSignal: options.budget.signal } : {})
          }
        }), 3, options.budget, accounting
      );
    } catch (err) {
      recordChargedFailures(meta, timer.finish(), accounting);
      throw err;
    }
    recordChargedFailures(meta, timer.finish(), accounting);
    let usage: any;
    let completed = false;
    try {
      for await (const chunk of abortableIterate<any>(responseStream, options.budget?.signal)) {
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
        if (chunk.text) { timer.markFirstChunk(); yield chunk.text; }
      }
      completed = true;
    } finally {
      // B-AIOPS-01: a stream stopped early (output screen, abort, deadline, a
      // closed client) still bills what was generated; it keeps its receipt.
      if (!completed) recordUsage({ ...meta, endedEarly: true, retries: accounting.retries }, usage, timer.finish());
    }
    recordUsage({ ...meta, retries: accounting.retries }, usage, timer.finish());
  }

  async generateImage(options: GenerateImageOptions): Promise<GeneratedImage> {
    this.assertApiKey();
    const timer = startCallTimer();
    const accounting = newRetryAccounting();
    const meta = { route: "creative_low_risk" as const, provider: "gemini_dev" as const, model: this.config.geminiImageModel };
    let raw: unknown;
    try {
      const response = await withModelRetry(() =>
        this.ai.models.generateContent({
          model: this.config.geminiImageModel,
          contents: buildGenAiContents(options.prompt, options.images) as any,
          config: {
            responseModalities: ["IMAGE"],
            ...(options.budget?.signal ? { abortSignal: options.budget.signal } : {})
          } as any
        }), 3, options.budget, accounting
      );
      raw = (response as any)?.usageMetadata;
      const image = extractInlineImage((response as any)?.candidates);
      recordUsage({ ...meta, retries: accounting.retries, imageCount: 1 }, raw, timer.finish(), accounting);
      return image;
    } catch (err) {
      recordChargedFailures(meta, timer.finish(), accounting);
      if (raw !== undefined) recordUsage({ ...meta, chargedFailure: true, retries: accounting.retries, imageCount: 0 }, raw, timer.finish());
      throw err;
    }
  }

  private assertApiKey() {
    if (!this.config.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured for local Arbor development.");
    }
  }
}

/** Vertex SDK client factory, injectable so region fallback is testable without the SDK. */
export type VertexClientFactory = (location: string) => Promise<any>;

/** The SDK cannot cancel unary calls. Keep one receipt if an issued call
 * settles after the route has ended, without returning its content or retrying.
 * A server shutdown or a promise that never settles still needs billing reconciliation. */
function lateUnaryUsage(meta: UsageMeta, timer: ReturnType<typeof startCallTimer>, retries: number, image = false) {
  const write = (raw: unknown) => recordUsage({
    ...meta, retries, endedEarly: true, chargedFailure: raw != null,
    ...(image ? { imageCount: 0 } : {}),
  }, raw, timer.finish());
  return {
    resolved: (result: any) => write(result.response?.usageMetadata),
    rejected: (error: unknown) => write(usageFromError(error)),
  };
}

/** An abandoned startup can still return an SDK stream and an independently
 * running aggregate promise. Observe only usage; never pull or return content.
 * Iterator cleanup is best-effort, not proof of upstream cancellation. */
function lateStreamUsage(meta: UsageMeta, timer: ReturnType<typeof startCallTimer>, retries: number) {
  const write = (raw: unknown) => recordUsage({
    ...meta, retries, endedEarly: true, chargedFailure: raw != null,
  }, raw, timer.finish());
  return {
    resolved: (result: any) => {
      void Promise.resolve(result.response).then(
        (response) => write(response?.usageMetadata),
        (error) => write(usageFromError(error)),
      );
      try { void Promise.resolve(result.stream[Symbol.asyncIterator]().return?.()).catch(() => {}); } catch { /* cleanup */ }
    },
    rejected: (error: unknown) => write(usageFromError(error)),
  };
}

/** Observe the SDK's aggregate rejection immediately, even while a consumer
 * is paused or has stopped reading. Keep one receipt in finally, including
 * final-response failures. Final waits share the route budget. Early exits
 * retain the immediate partial receipt; later totals require reconciliation. */
async function* vertexStreamText(
  result: any, timer: ReturnType<typeof startCallTimer>, signal: AbortSignal | undefined,
  record: (usage: unknown, completed: boolean, chargedFailure: boolean) => void,
): AsyncIterable<string> {
  const aggregate = Promise.resolve(result.response).then(
    (response) => ({ ok: true as const, raw: response?.usageMetadata }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  let usage: unknown;
  let completed = false;
  let chargedFailure = false;
  try {
    for await (const item of abortableIterate<any>(result.stream, signal)) {
      if (item.usageMetadata) usage = item.usageMetadata;
      const text = item.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
      if (text) { timer.markFirstChunk(); yield text; }
    }
    const final = await raceWithAbort(aggregate, signal);
    if (final.ok === false) throw final.error;
    usage = final.raw ?? usage;
    completed = true;
  } catch (error) {
    const billed = usageFromError(error);
    if (billed) { usage = billed; chargedFailure = true; }
    throw error;
  } finally {
    record(usage, completed, chargedFailure);
  }
}

/** A region is skipped (never thrown from) when the model is absent there. */
const isModelUnavailableInRegion = (err: any): boolean => {
  const status = err?.status ?? err?.code ?? err?.response?.status;
  return status === 404 || /NOT_FOUND|not found|is not supported in/i.test(String(err?.message || ""));
};

export class VertexGeminiProvider {
  private readonly vertexByLocation = new Map<string, Promise<any>>();

  constructor(
    private readonly config: ArborConfig,
    private readonly vertexFactory: VertexClientFactory = async (location) => {
      const { VertexAI } = await import("@google-cloud/vertexai");
      const apiEndpoint = vertexApiEndpoint(location);
      return new VertexAI({ project: this.config.gcpProjectId, location, ...(apiEndpoint ? { apiEndpoint } : {}) });
    }
  ) {}

  /** Ordered image regions admitted by the route policy (EU-only in prod); a
   *  configured non-EU fallback is dropped here rather than silently moving
   *  family imagery out of region. B-GA-27: images never follow the text
   *  `vertexLocation` — the list is `vertexImageRegions` (GCP_REGION first,
   *  prod europe-west4), else `gcpRegion` alone. */
  imageRegions(): string[] {
    const policy = routePolicyFor(this.config);
    const configured = this.config.vertexImageRegions?.length ? this.config.vertexImageRegions : [this.config.gcpRegion];
    const ordered = Array.from(new Set(configured));
    return ordered.filter((location) => policy.allowedRegions.includes(providerRegion(location)));
  }

  async generateJson(options: GenerateJsonOptions) {
    const modelId = modelForGeminiRequest(this.config, options.route, options.images);
    const model = await this.getModel(options.route, options.images);
    const timer = startCallTimer();
    const thinking = thinkingConfigForRoute(options.route, modelId);
    const accounting = newRetryAccounting();
    const meta = { route: options.route, provider: "vertex_gemini" as const, model: modelId, promptVersion: options.promptVersion };
    // The @google-cloud/vertexai SDK exposes no per-call abort hook, so the
    // call is RACED against the budget signal (frees the request; billing for
    // an already-issued generation is bounded by maxOutputTokens).
    let raw: unknown;
    try {
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
        }), options.budget?.signal, lateUnaryUsage(meta, timer, accounting.retries)), 3, options.budget, accounting
      );
      raw = result.response?.usageMetadata;
      const candidate = result.response?.candidates?.[0];
      const text = candidate?.content?.parts?.map((part: any) => part.text || "").join("") || "";
      const parsed = parseModelJson(text, candidate?.finishReason);
      recordUsage({ ...meta, retries: accounting.retries }, raw, timer.finish(), accounting);
      return parsed;
    } catch (err) {
      recordChargedFailures(meta, timer.finish(), accounting);
      if (raw !== undefined) recordUsage({ ...meta, chargedFailure: true, retries: accounting.retries }, raw, timer.finish());
      throw err;
    }
  }

  async *generateJsonStream(options: GenerateJsonOptions) {
    const modelId = modelForGeminiRequest(this.config, options.route, options.images);
    const model = await this.getModel(options.route, options.images);
    const timer = startCallTimer();
    const thinking = thinkingConfigForRoute(options.route, modelId);
    const accounting = newRetryAccounting();
    const meta = { route: options.route, provider: "vertex_gemini" as const, model: modelId, promptVersion: options.promptVersion };
    let result: any;
    try {
      result = await withModelRetry(() =>
        raceWithAbort(model.generateContentStream({
          contents: [{ role: "user", parts: buildVertexParts(options.prompt, options.images) }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: options.schema,
            temperature: options.temperature ?? 0.35,
            maxOutputTokens: this.config.maxOutputTokens,
            ...(thinking ? { thinkingConfig: thinking } : {})
          } as any
        }), options.budget?.signal, lateStreamUsage(meta, timer, accounting.retries)), 3, options.budget, accounting
      );
    } catch (err) {
      recordChargedFailures(meta, timer.finish(), accounting);
      throw err;
    }
    recordChargedFailures(meta, timer.finish(), accounting);

    yield* vertexStreamText(result, timer, options.budget?.signal, (usage, completed, chargedFailure) => {
      recordUsage({ ...meta, retries: accounting.retries, chargedFailure, ...(!completed ? { endedEarly: true } : {}) }, usage, timer.finish());
    });
  }

  async *streamText(options: StreamTextOptions) {
    const modelId = modelForRoute(this.config, options.route);
    const model = await this.getModel(options.route);
    const timer = startCallTimer();
    const thinking = thinkingConfigForRoute(options.route, modelId);
    const accounting = newRetryAccounting();
    const meta = { route: options.route, provider: "vertex_gemini" as const, model: modelId, promptVersion: options.promptVersion };
    let result: any;
    try {
      result = await withModelRetry(() =>
        raceWithAbort(model.generateContentStream({
          contents: [{ role: "user", parts: [{ text: options.prompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.5,
            maxOutputTokens: this.config.maxOutputTokens,
            ...(thinking ? { thinkingConfig: thinking } : {})
          } as any
        }), options.budget?.signal, lateStreamUsage(meta, timer, accounting.retries)), 3, options.budget, accounting
      );
    } catch (err) {
      recordChargedFailures(meta, timer.finish(), accounting);
      throw err;
    }
    recordChargedFailures(meta, timer.finish(), accounting);
    yield* vertexStreamText(result, timer, options.budget?.signal, (usage, completed, chargedFailure) => {
      recordUsage({ ...meta, retries: accounting.retries, chargedFailure, ...(!completed ? { endedEarly: true } : {}) }, usage, timer.finish());
    });
  }

  async generateImage(options: GenerateImageOptions): Promise<GeneratedImage> {
    const regions = this.imageRegions();
    const parts = buildVertexParts(options.prompt, options.images);
    const accounting = newRetryAccounting();
    let lastErr: unknown;
    for (let index = 0; index < regions.length; index += 1) {
      const location = regions[index];
      const isLast = index === regions.length - 1;
      if (options.budget?.signal?.aborted) throw lastErr ?? new Error("Image generation aborted");
      const model = await this.getImageModel(location);
      const timer = startCallTimer();
      const meta = { route: "creative_low_risk" as const, provider: "vertex_gemini" as const, model: this.config.vertexModelImage, fallback: index > 0 };
      let raw: unknown;
      try {
        // Two in-region attempts before moving on: a saturated region rarely
        // clears within one backoff, and the route deadline (60 s) has to
        // cover every region in the list.
        const result: any = await withModelRetry(() =>
          raceWithAbort(model.generateContent({
            contents: [{ role: "user", parts }],
            generationConfig: { responseModalities: ["IMAGE"] }
          }), options.budget?.signal, lateUnaryUsage(meta, timer, accounting.retries, true)), isLast ? 3 : 2, options.budget, accounting
        );
        raw = result.response?.usageMetadata;
        // A blocked/empty candidate is a content verdict for THIS request, not
        // a capacity signal: it must not be retried in another region.
        const image = extractInlineImage(result.response?.candidates);
        recordUsage({ ...meta, retries: accounting.retries, imageCount: 1 }, raw, timer.finish(), accounting);
        if (index > 0) console.info("Arbor Image Region", { primary: regions[0], used: location, attemptsBefore: index });
        return image;
      } catch (err) {
        recordChargedFailures(meta, timer.finish(), accounting);
        if (raw !== undefined) recordUsage({ ...meta, chargedFailure: true, retries: accounting.retries, imageCount: 0 }, raw, timer.finish());
        lastErr = err;
        const capacity = isTransientModelError(err) || isModelUnavailableInRegion(err);
        if (isLast || !capacity || isAbortError(err)) throw err;
        if (options.budget?.deadlineAt && options.budget.deadlineAt - Date.now() < 8000) throw err;
        console.warn("Arbor Image Region Fallback", {
          from: location, to: regions[index + 1],
          status: (err as any)?.status ?? (err as any)?.code ?? null,
          reason: String((err as any)?.message || err).slice(0, 120)
        });
      }
    }
    throw lastErr;
  }

  private async getModel(route: ModelRoute, images?: ImagePart[]) {
    const vertex = await this.getVertex(this.config.vertexLocation);
    return vertex.getGenerativeModel({ model: modelForGeminiRequest(this.config, route, images) });
  }

  private async getImageModel(location: string) {
    const vertex = await this.getVertex(location);
    return vertex.getGenerativeModel({ model: this.config.vertexModelImage });
  }

  private getVertex(location: string) {
    let pending = this.vertexByLocation.get(location);
    if (!pending) {
      pending = this.vertexFactory(location);
      this.vertexByLocation.set(location, pending);
    }
    return pending;
  }
}

export class VertexModelProvider implements ModelProvider {
  private readonly claude: ClaudeVertexProvider;
  private readonly gemini: VertexGeminiProvider;
  constructor(private readonly config: ArborConfig) {
    // B-PROV-07: Claude calls the POLICY-decided model (the candidate list may
    // name a Claude model other than VERTEX_MODEL_CHAT).
    this.claude = new ClaudeVertexProvider(config, (route) => modelForRoute(config, route));
    this.gemini = new VertexGeminiProvider(config);
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
    // A Live API key must not silently move images to another quota pool or
    // global endpoint. Respect MODEL_PROVIDER=vertex for image generation too.
    return this.gemini.generateImage(options);
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
  if (config.modelProvider === "mock") {
    // B-INF-04: refuse here too, independent of env.ts, so no code path can
    // hand a production app the fixture provider.
    if (config.arborEnv === "prod") throw new Error("MODEL_PROVIDER=mock is refused in production.");
    return withDefaultModelDeadlines(new MockModelProvider());
  }
  return withDefaultModelDeadlines(config.modelProvider === "vertex" ? new VertexModelProvider(config) : new GeminiDevProvider(config));
};
