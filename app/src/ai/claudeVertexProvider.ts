import { GoogleAuth } from "google-auth-library";
import type { ArborConfig } from "../config/env.js";
import { coachResponseZodSchema } from "../contracts/coach.js";
import { withModelRetry } from "./modelRetry.js";
import { recordUsage, startCallTimer } from "./usage.js";
import type { GenerateJsonOptions, ModelRoute } from "./modelRouter.js";

const modelForRoute = (config: ArborConfig, route: ModelRoute) => {
  const map: Record<ModelRoute, string> = {
    coach_high_stakes: config.vertexModelChat,
    creative_low_risk: config.vertexModelStory,
    analysis_structured: config.vertexModelAnalysis,
    handoff_structured: config.vertexModelHandoff
  };
  return map[route];
};

const toAnthropicVertexModelId = (model: string) => {
  // Legacy pin: envs still carrying the 2024 shorthand keep resolving to the
  // dated v2 snapshot. Current-generation Claude models on Vertex use the bare
  // first-party id (e.g. claude-sonnet-5@anthropic -> claude-sonnet-5).
  if (model === "claude-3-5-sonnet@anthropic") return "claude-3-5-sonnet-v2@20241022";
  return model.replace(/@anthropic$/, "");
};

/**
 * AIR-4: Claude Sonnet 5 / Opus 4.7+ / Fable 5 reject non-default sampling
 * parameters (`temperature`/`top_p`/`top_k` return HTTP 400). Older Claude
 * models still accept them. Checked against the RESOLVED Vertex model id so a
 * pinned dated snapshot of a new-generation model is matched too.
 */
export const claudeRejectsSamplingParams = (resolvedModel: string): boolean =>
  /^claude-(sonnet-5|opus-4-[7-9]|fable|mythos)/i.test(resolvedModel);

const toJsonSchema = (schema: any): any => {
  if (!schema || typeof schema !== "object") return schema;
  const next: Record<string, any> = Array.isArray(schema) ? [] : {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "type" && typeof value === "string") {
      next[key] = value.toLowerCase();
    } else if (Array.isArray(value)) {
      next[key] = value.map((item) => toJsonSchema(item));
    } else {
      next[key] = toJsonSchema(value);
    }
  }
  return next;
};

const extractToolInput = (payload: any) => {
  const toolUse = payload?.content?.find((part: any) => part?.type === "tool_use" && part?.input);
  if (toolUse?.input) return toolUse.input;
  const text = payload?.content?.map((part: any) => part?.text || "").join("") || "";
  if (!text.trim()) throw new Error("Claude on Vertex returned no tool input or JSON text.");
  return JSON.parse(text.trim());
};

export class ClaudeVertexProvider {
  private readonly auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

  constructor(private readonly config: ArborConfig) {}

  async generateJson(options: GenerateJsonOptions) {
    return this.callClaude(options);
  }

  /**
   * AIR-1 (ask-cadence): REAL token streaming via the `:streamRawPredict`
   * Anthropic-on-Vertex endpoint. Yields the tool call's `input_json_delta`
   * partial-JSON chunks (or `text_delta` text when no schema is supplied) as
   * they generate, so /chat's first visible words no longer wait for the full
   * 8k-token structured contract. The consumer (routes/api.ts) accumulates the
   * chunks, screens the streamed prose per sentence, and zod-parses the
   * complete document at `done` — this seam stays validation-free on purpose.
   */
  async *generateJsonStream(options: GenerateJsonOptions) {
    const timer = startCallTimer();
    const { url, headers, body, model } = await this.buildRequest(options, true);
    const response = await withModelRetry(async () => {
      // AIR-9: the budget signal cancels the upstream fetch for real (stops billing).
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ ...body, stream: true }), signal: options.budget?.signal });
      if (!r.ok) {
        // Surface the status on the error so withModelRetry can detect 429/503 and back off.
        const err: any = new Error(`Claude on Vertex stream failed (${r.status}): ${await r.text()}`);
        err.status = r.status;
        throw err;
      }
      return r;
    }, 3, options.budget);
    if (!response.body) throw new Error("Claude on Vertex returned no response stream.");

    const usage: Record<string, number> = {};
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffered.indexOf("\n")) >= 0) {
          const line = buffered.slice(0, newline).trim();
          buffered = buffered.slice(newline + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let event: any;
          try {
            event = JSON.parse(payload);
          } catch {
            continue; // partial keep-alive noise — never break the stream on it
          }
          if (event?.type === "message_start" && event.message?.usage) Object.assign(usage, event.message.usage);
          if (event?.type === "message_delta" && event.usage) Object.assign(usage, event.usage);
          if (event?.type === "content_block_delta") {
            const delta = event.delta;
            const chunk = delta?.type === "input_json_delta" ? delta.partial_json : delta?.type === "text_delta" ? delta.text : "";
            if (chunk) { timer.markFirstChunk(); yield chunk as string; }
          }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch { /* stream already closed */ }
    }
    // EVAL-8: `model` here is already the RESOLVED Anthropic-on-Vertex id
    // (toAnthropicVertexModelId) — record it explicitly as resolvedModel.
    recordUsage({ route: options.route, provider: "vertex_claude", model, resolvedModel: model, promptVersion: options.promptVersion }, Object.keys(usage).length ? usage : undefined, timer.finish());
  }

  private async buildRequest(options: GenerateJsonOptions, stream: boolean) {
    if (!this.config.gcpProjectId) throw new Error("GCP_PROJECT_ID is required for Claude on Vertex.");
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();
    const token = typeof accessToken === "string" ? accessToken : accessToken?.token;
    if (!token) throw new Error("Could not acquire Google access token for Claude on Vertex.");

    const model = toAnthropicVertexModelId(modelForRoute(this.config, options.route));
    const method = stream ? "streamRawPredict" : "rawPredict";
    const url = `https://${this.config.vertexLocation}-aiplatform.googleapis.com/v1/projects/${this.config.gcpProjectId}/locations/${this.config.vertexLocation}/publishers/anthropic/models/${model}:${method}`;
    const schema = toJsonSchema(options.schema);
    const body = {
      anthropic_version: "vertex-2023-10-16",
      max_tokens: this.config.maxOutputTokens,
      // AIR-4: new-generation Claude models 400 on any sampling parameter —
      // omit temperature entirely for them (prompting steers behavior instead).
      ...(claudeRejectsSamplingParams(model) ? {} : { temperature: options.temperature ?? 0.45 }),
      system: "You are Arbor. Return structured data by calling the provided tool. Do not include markdown prose.",
      messages: [{ role: "user", content: options.prompt }],
      tools: schema ? [{
        name: "arbor_coach_response",
        description: "Structured Arbor parent coach response.",
        input_schema: schema
      }] : undefined,
      tool_choice: schema ? { type: "tool", name: "arbor_coach_response" } : undefined
    };
    return { url, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body, model };
  }

  private async callClaude(options: GenerateJsonOptions) {
    const timer = startCallTimer();
    const { url, headers, body, model } = await this.buildRequest(options, false);
    const payload = await withModelRetry(async () => {
      // AIR-9: the budget signal cancels the upstream fetch for real (stops billing).
      const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: options.budget?.signal });

      if (!response.ok) {
        // Surface the status on the error so withModelRetry can detect 429/503 and back off.
        const err: any = new Error(`Claude on Vertex failed (${response.status}): ${await response.text()}`);
        err.status = response.status;
        throw err;
      }
      return response.json();
    }, 3, options.budget);

    // EVAL-8: resolved id recorded explicitly (see stream path note above).
    recordUsage({ route: options.route, provider: "vertex_claude", model, resolvedModel: model, promptVersion: options.promptVersion }, payload?.usage, timer.finish());
    const parsed = extractToolInput(payload);
    if (options.route === "coach_high_stakes") return coachResponseZodSchema.parse(parsed);
    return parsed;
  }
}
