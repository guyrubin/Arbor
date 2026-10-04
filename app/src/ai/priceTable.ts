/**
 * B-PROV-04 — the dated price table behind `estimatedCostUsd` (the
 * NormalizedAiUsage field in ai/capabilities/contracts.ts that nothing filled).
 *
 * One row per resolved model family: USD per 1M tokens, input / output (and
 * audio input where the vendor prices it separately). Rows are LIST prices on
 * the date below, standard (non-batch) tier, prompts ≤200k tokens; sources:
 *   Gemini on Vertex — https://cloud.google.com/vertex-ai/generative-ai/pricing
 *   Claude on Vertex — https://cloud.google.com/vertex-ai/generative-ai/pricing#claude-models
 *                      (= https://www.anthropic.com/pricing list prices)
 * A model with no row yields NO estimate (`undefined`, never 0): an unpriced
 * call must read "unknown", not "free". Re-date the table when a price moves.
 */
export const PRICE_TABLE_AS_OF = "2026-10-04";

export type ModelPrice = {
  /** USD per 1M input (prompt) tokens. */
  inputPerM: number;
  /** USD per 1M output tokens (incl. thinking tokens, billed as output). */
  outputPerM: number;
  /** USD per 1M audio input tokens, where priced separately. */
  audioInputPerM?: number;
};

/** Longest matching prefix wins (so "gemini-2.5-flash-lite" beats "gemini-2.5-flash"). */
export const PRICE_TABLE: Readonly<Record<string, ModelPrice>> = Object.freeze({
  "gemini-2.5-pro": { inputPerM: 1.25, outputPerM: 10 },
  "gemini-2.5-flash": { inputPerM: 0.3, outputPerM: 2.5, audioInputPerM: 1 },
  "gemini-2.5-flash-lite": { inputPerM: 0.1, outputPerM: 0.4, audioInputPerM: 0.3 },
  // Image output is priced per output token at the image rate.
  "gemini-2.5-flash-image": { inputPerM: 0.3, outputPerM: 30 },
  // Sonnet-class list price (the Claude on Vertex rate card for the Sonnet line).
  "claude-sonnet-4": { inputPerM: 3, outputPerM: 15 },
  "claude-sonnet-5": { inputPerM: 3, outputPerM: 15 },
  "claude-3-5-sonnet": { inputPerM: 3, outputPerM: 15 },
});

/** The table key for a resolved model id ("claude-sonnet-5@20260101", "models/gemini-2.5-flash-001"), or null. */
export function priceKeyFor(model: string | undefined | null): string | null {
  if (!model) return null;
  const id = model.toLowerCase().replace(/^models\//, "").replace(/^publishers\/[^/]+\/models\//, "").split("@")[0];
  let best: string | null = null;
  for (const key of Object.keys(PRICE_TABLE)) {
    if ((id === key || id.startsWith(`${key}-`) || id.startsWith(key)) && (!best || key.length > best.length)) best = key;
  }
  return best;
}

/**
 * Estimated USD for one call, or `undefined` when the model is unpriced or no
 * token usage was reported. Rounded to 6 decimals (a micro-dollar).
 */
export function estimateCostUsd(
  model: string | undefined | null,
  usage: { promptTokens: number; outputTokens: number; audioInputTokens?: number } | null | undefined,
): number | undefined {
  const key = priceKeyFor(model);
  if (!key || !usage) return undefined;
  const price = PRICE_TABLE[key];
  const audio = usage.audioInputTokens ?? 0;
  const textIn = Math.max(0, usage.promptTokens - audio);
  const usd =
    (textIn / 1_000_000) * price.inputPerM +
    (audio / 1_000_000) * (price.audioInputPerM ?? price.inputPerM) +
    (Math.max(0, usage.outputTokens) / 1_000_000) * price.outputPerM;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
