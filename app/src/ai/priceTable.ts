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
export const PRICE_TABLE_AS_OF = "2026-10-15";

export type ModelPrice = {
  /** USD per 1M input (prompt) tokens. */
  inputPerM: number;
  /** USD per 1M output tokens (incl. thinking tokens, billed as output). */
  outputPerM: number;
  /** USD per 1M audio input tokens, where priced separately. */
  audioInputPerM?: number;
  cacheReadPerM?: number;
  cacheWrite5mPerM?: number;
  cacheWrite1hPerM?: number;
  longContextThreshold?: number;
  longContextMultiplier?: number;
};

/** Exact families and numbered snapshots only; an unlisted modality stays unpriced. */
export const PRICE_TABLE: Readonly<Record<string, ModelPrice>> = Object.freeze({
  "gemini-2.5-pro": { inputPerM: 1.25, outputPerM: 10 },
  "gemini-2.5-flash": { inputPerM: 0.3, outputPerM: 2.5, audioInputPerM: 1 },
  "gemini-2.5-flash-lite": { inputPerM: 0.1, outputPerM: 0.4, audioInputPerM: 0.3 },
  // Image output is priced per output token at the image rate.
  "gemini-2.5-flash-image": { inputPerM: 0.3, outputPerM: 30 },
  // B-GA-27: the Gemini 3.x Flash rows are the NON-GLOBAL rate (the `eu`
  // endpoint is non-global; global is ~10 % lower). 3.8 Flash is on its
  // introductory price to 31 Dec 2026, then $1.65 / $8.25 non-global.
  "gemini-3.5-flash": { inputPerM: 1.65, outputPerM: 9.9, audioInputPerM: 1.65, cacheReadPerM: 0.165 },
  "gemini-3.8-flash": { inputPerM: 0.825, outputPerM: 4.125, audioInputPerM: 0.825, cacheReadPerM: 0.0825 },
  // Verified 15 Oct 2026: standard non-global/EU rates at the source above.
  "gemini-3.5-flash-lite": { inputPerM: 0.33, outputPerM: 2.75, audioInputPerM: 0.33, cacheReadPerM: 0.033 },
  "claude-haiku-5-5": { inputPerM: 0.11, outputPerM: 0.55, cacheReadPerM: 0.011,
    cacheWrite5mPerM: 0.1375, cacheWrite1hPerM: 0.22, longContextThreshold: 100_000, longContextMultiplier: 5 },
  "claude-sonnet-5-5": { inputPerM: 2.2, outputPerM: 11, cacheReadPerM: 0.11,
    cacheWrite5mPerM: 2.75, cacheWrite1hPerM: 4.4 },
  // Sonnet-class list price (the Claude on Vertex rate card for the Sonnet line).
  "claude-sonnet-4": { inputPerM: 3, outputPerM: 15 },
  "claude-sonnet-5": { inputPerM: 2.2, outputPerM: 11 },
  "claude-3-5-sonnet": { inputPerM: 3, outputPerM: 15 },
});

/** The table key for a resolved model id ("claude-sonnet-5@20260101", "models/gemini-2.5-flash-001"), or null. */
export function priceKeyFor(model: string | undefined | null): string | null {
  if (!model) return null;
  const id = model.toLowerCase().replace(/^models\//, "").replace(/^publishers\/[^/]+\/models\//, "").split("@")[0];
  let best: string | null = null;
  for (const key of Object.keys(PRICE_TABLE)) {
    if ((id === key || (id.startsWith(`${key}-`) && /^\d{3}$/.test(id.slice(key.length + 1)))) && (!best || key.length > best.length)) best = key;
  }
  return best;
}

export type PricedTokenUsage = {
  /** Total input, including cache reads/writes. */
  promptTokens: number; outputTokens: number; thoughtsTokens?: number; audioInputTokens?: number;
  cacheReadTokens?: number; cacheWrite5mTokens?: number; cacheWrite1hTokens?: number;
};

/**
 * Estimated USD for one call, or `undefined` when the model is unpriced or no
 * token usage was reported. Rounded to 6 decimals (a micro-dollar).
 */
export function estimateCostUsd(
  model: string | undefined | null,
  usage: PricedTokenUsage | null | undefined,
  now = Date.now(),
): number | undefined {
  const key = priceKeyFor(model);
  if (!key || !usage) return undefined;
  const price = PRICE_TABLE[key];
  if (Object.values(usage).some((v) => typeof v === "number" && (!Number.isFinite(v) || v < 0))) return undefined;
  const audio = usage.audioInputTokens ?? 0;
  const cached = usage.cacheReadTokens ?? 0;
  const write5m = usage.cacheWrite5mTokens ?? 0;
  const write1h = usage.cacheWrite1hTokens ?? 0;
  const special = audio + cached + write5m + write1h;
  // Unknown cache rates/modality overlap must not silently become a full-price estimate.
  if (special > usage.promptTokens || (audio && cached) ||
    (cached && price.cacheReadPerM === undefined) ||
    (write5m && price.cacheWrite5mPerM === undefined) ||
    (write1h && price.cacheWrite1hPerM === undefined)) return undefined;
  // Introductory Gemini 3.8 rates end at midnight UTC on 1 Jan 2027.
  const dateMultiplier = key === "gemini-3.8-flash" && now >= Date.parse("2027-01-01T00:00:00Z") ? 2 : 1;
  const tierMultiplier = price.longContextThreshold && usage.promptTokens > price.longContextThreshold
    ? price.longContextMultiplier ?? 1 : 1;
  const usd = (dateMultiplier * tierMultiplier / 1_000_000) * (
    (usage.promptTokens - special) * price.inputPerM +
    audio * (price.audioInputPerM ?? price.inputPerM) +
    cached * (price.cacheReadPerM ?? 0) +
    write5m * (price.cacheWrite5mPerM ?? 0) + write1h * (price.cacheWrite1hPerM ?? 0) +
    (usage.outputTokens + (usage.thoughtsTokens ?? 0)) * price.outputPerM);
  return Math.round((usd + Number.EPSILON) * 1_000_000) / 1_000_000;
}
