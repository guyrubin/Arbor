import { GoogleAuth } from "google-auth-library";
import type { ArborConfig } from "../config/env.js";
import { coachResponseZodSchema } from "../contracts/coach.js";
import { withModelRetry } from "./modelRetry.js";
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
  if (model === "claude-3-5-sonnet@anthropic") return "claude-3-5-sonnet-v2@20241022";
  return model.replace(/@anthropic$/, "");
};

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

  async *generateJsonStream(options: GenerateJsonOptions) {
    yield JSON.stringify(await this.callClaude(options));
  }

  private async callClaude(options: GenerateJsonOptions) {
    if (!this.config.gcpProjectId) throw new Error("GCP_PROJECT_ID is required for Claude on Vertex.");
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();
    const token = typeof accessToken === "string" ? accessToken : accessToken?.token;
    if (!token) throw new Error("Could not acquire Google access token for Claude on Vertex.");

    const model = toAnthropicVertexModelId(modelForRoute(this.config, options.route));
    const url = `https://${this.config.vertexLocation}-aiplatform.googleapis.com/v1/projects/${this.config.gcpProjectId}/locations/${this.config.vertexLocation}/publishers/anthropic/models/${model}:rawPredict`;
    const schema = toJsonSchema(options.schema);
    const payload = await withModelRetry(async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          anthropic_version: "vertex-2023-10-16",
          max_tokens: this.config.maxOutputTokens,
          temperature: options.temperature ?? 0.45,
          system: "You are Arbor. Return structured data by calling the provided tool. Do not include markdown prose.",
          messages: [{ role: "user", content: options.prompt }],
          tools: schema ? [{
            name: "arbor_coach_response",
            description: "Structured Arbor parent coach response.",
            input_schema: schema
          }] : undefined,
          tool_choice: schema ? { type: "tool", name: "arbor_coach_response" } : undefined
        })
      });

      if (!response.ok) {
        // Surface the status on the error so withModelRetry can detect 429/503 and back off.
        const err: any = new Error(`Claude on Vertex failed (${response.status}): ${await response.text()}`);
        err.status = response.status;
        throw err;
      }
      return response.json();
    });

    const parsed = extractToolInput(payload);
    if (options.route === "coach_high_stakes") return coachResponseZodSchema.parse(parsed);
    return parsed;
  }
}
