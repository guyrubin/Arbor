/**
 * COST-2: token-usage telemetry.
 *
 * Normalizes the three usage shapes Arbor sees — @google/genai, @google-cloud/vertexai
 * (both `*TokenCount`) and Anthropic-on-Vertex (`input_tokens`/`output_tokens`) — into
 * one type, and emits a structured `ai.usage` log line per model call. The lines are
 * Cloud Logging native, so cost can be sliced by route / provider / model / user.
 */
import { logger } from "../server/logger.js";
import { currentRequestContext } from "../server/requestContext.js";
import type { ModelRoute, ProviderId } from "./modelRouter.js";

export type TokenUsage = {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
};

/** Coerce a provider's raw usage metadata into a uniform {@link TokenUsage}, or null if absent. */
export const normalizeUsage = (raw: any): TokenUsage | null => {
  if (!raw || typeof raw !== "object") return null;
  // Gemini (genai + Vertex): promptTokenCount / candidatesTokenCount / totalTokenCount.
  if (raw.totalTokenCount != null || raw.promptTokenCount != null || raw.candidatesTokenCount != null) {
    const promptTokens = Number(raw.promptTokenCount || 0);
    const outputTokens = Number(raw.candidatesTokenCount || 0);
    return {
      promptTokens,
      outputTokens,
      totalTokens: Number(raw.totalTokenCount || promptTokens + outputTokens),
    };
  }
  // Anthropic (Claude on Vertex): input_tokens / output_tokens.
  if (raw.input_tokens != null || raw.output_tokens != null) {
    const promptTokens = Number(raw.input_tokens || 0);
    const outputTokens = Number(raw.output_tokens || 0);
    return { promptTokens, outputTokens, totalTokens: promptTokens + outputTokens };
  }
  return null;
};

/** Emit one `ai.usage` line, enriched with the active request's id + uid. Never throws. */
export const recordUsage = (
  meta: { route: ModelRoute; provider: ProviderId; model: string },
  raw: any
): void => {
  try {
    const usage = normalizeUsage(raw);
    if (!usage) return;
    const ctx = currentRequestContext();
    logger.info("ai.usage", {
      requestId: ctx?.requestId ?? null,
      userUid: ctx?.uid ?? null,
      route: meta.route,
      provider: meta.provider,
      model: meta.model,
      promptTokens: usage.promptTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    });
  } catch {
    /* telemetry must never break a request */
  }
};
