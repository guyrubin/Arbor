/**
 * COST-2: token-usage telemetry.
 *
 * Normalizes the three usage shapes Arbor sees — @google/genai, @google-cloud/vertexai
 * (both `*TokenCount`) and Anthropic-on-Vertex (`input_tokens`/`output_tokens`) — into
 * one type, and emits a structured `ai.usage` log line per model call. The lines are
 * Cloud Logging native, so cost can be sliced by route / provider / model / user.
 *
 * EVAL-7: every event now also carries latency — `totalMs` (all calls) and
 * `firstChunkMs` (streams) — captured at the modelRouter provider seams. This is
 * the single data source the cadence budgets (EVAL-2/EVAL-4) and the founder
 * dashboard's p50/p95 read; eval runners must consume these fields rather than
 * re-instrumenting.
 */
import { logger } from "../server/logger.js";
import { currentRequestContext } from "../server/requestContext.js";
import { recordUsageRollup } from "../server/usageRollup.js";
import type { ModelRoute, ProviderId } from "./modelRouter.js";

export type TokenUsage = {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
};

/** EVAL-7: latency measured at the provider seam (never in route handlers). */
export type CallTiming = {
  /** Wall-clock ms from just before the provider call to completion. */
  totalMs: number;
  /** Streams only: ms until the first chunk was yielded. */
  firstChunkMs?: number;
};

/** Millisecond timer for the provider seams — one place to keep the convention. */
export const startCallTimer = () => {
  const t0 = Date.now();
  let firstChunkMs: number | undefined;
  return {
    /** Call at the first yielded chunk (idempotent). */
    markFirstChunk: () => { if (firstChunkMs === undefined) firstChunkMs = Date.now() - t0; },
    /** Snapshot the timing for recordUsage. */
    finish: (): CallTiming => ({ totalMs: Date.now() - t0, ...(firstChunkMs !== undefined ? { firstChunkMs } : {}) }),
  };
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

/** Provider-seam call metadata for one `ai.usage` event.
 *  EVAL-6/EVAL-8: `promptVersion` ties the event to the PROMPT_VERSIONS entry
 *  that produced the call ("unversioned" when the call site has no registered
 *  prompt yet), and `resolvedModel` is the POST-alias-resolution model id
 *  (e.g. claude-sonnet-5, never the @anthropic alias) so eval results and
 *  telemetry can attribute regressions to model vs prompt changes. */
export type UsageMeta = {
  route: ModelRoute;
  provider: ProviderId;
  model: string;
  /** Resolved provider model id; defaults to `model` when alias === resolved. */
  resolvedModel?: string;
  /** PROMPT_VERSIONS version of the prompt behind this call. */
  promptVersion?: string;
};

/** The structured `ai.usage` event body. Pure so tests can pin the shape. */
export const buildUsageEvent = (
  meta: UsageMeta,
  usage: TokenUsage | null,
  timing?: CallTiming,
): Record<string, unknown> | null => {
  // EVAL-7: latency is telemetry in its own right — emit the event whenever we
  // have EITHER token usage or a measured duration (previously usage-only).
  if (!usage && !timing) return null;
  return {
    route: meta.route,
    provider: meta.provider,
    model: meta.model,
    // EVAL-8: every event carries the resolved model id (alias-mapped).
    resolvedModel: meta.resolvedModel ?? meta.model,
    // EVAL-6: every event carries the prompt version that produced the call.
    promptVersion: meta.promptVersion ?? "unversioned",
    promptTokens: usage?.promptTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
    ...(timing ? { totalMs: timing.totalMs } : {}),
    ...(timing?.firstChunkMs !== undefined ? { firstChunkMs: timing.firstChunkMs } : {}),
  };
};

/** Emit one `ai.usage` line, enriched with the active request's id + uid. Never throws. */
export const recordUsage = (
  meta: UsageMeta,
  raw: any,
  timing?: CallTiming,
): void => {
  try {
    const usage = normalizeUsage(raw);
    const event = buildUsageEvent(meta, usage, timing);
    if (!event) return;
    const ctx = currentRequestContext();
    logger.info("ai.usage", {
      requestId: ctx?.requestId ?? null,
      userUid: ctx?.uid ?? null,
      ...event,
    });
    // COST-3: aggregate into today's Firestore rollup for the founder dashboard.
    // EVAL-7: the same write now carries per-route latency for the p50/p95 buckets.
    recordUsageRollup(
      meta.provider,
      usage ?? { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
      timing ? { route: meta.route, totalMs: timing.totalMs, firstChunkMs: timing.firstChunkMs } : undefined,
    );
  } catch {
    /* telemetry must never break a request */
  }
};
