/** B-GA-26 (TTS slice), B-PROV-04: list-price estimates, not billing receipts.
 * Source verified 2026-10-14: https://cloud.google.com/text-to-speech/pricing
 * Only the approved pinned voice class is priced. Default/unknown voices stay
 * unpriced; free allowances, discounts, tax and FX are deliberately not assumed.
 */
import { logger } from "../server/logger.js";
import { currentRequestContext } from "../server/requestContext.js";
import { recordUsageRollup } from "../server/usageRollup.js";

export const TTS_PRICE_AS_OF = "2026-10-14";
export function estimateTtsCostUsd(voice: string, characters: number): number | undefined {
  if (!Number.isSafeInteger(characters) || characters < 0) return undefined;
  if (!/^(en-US|he-IL)-Chirp3-HD-Sulafat$/.test(voice)) return undefined;
  return characters * 30 / 1_000_000;
}

export function buildTtsUsageEvent(voice: string, lang: "en" | "he", characters: number, totalMs: number) {
  const cost = estimateTtsCostUsd(voice, characters);
  return {
    route: "speech_synthesis", provider: "google_cloud_tts", model: "cloud-tts-v1",
    resolvedModel: voice || "unconfigured-voice", lang, characters, totalMs,
    usageUnit: "characters", priceTableAsOf: TTS_PRICE_AS_OF,
    ...(cost === undefined ? {} : { estimatedCostUsd: cost }),
  };
}

/** Successful provider responses only. No text, audio, names or tokens logged. */
export function recordTtsUsage(voice: string, lang: "en" | "he", characters: number, totalMs: number): void {
  try {
    const event = buildTtsUsageEvent(voice, lang, characters, totalMs);
    const ctx = currentRequestContext();
    logger.info("ai.usage", { requestId: ctx?.requestId ?? null, userUid: ctx?.uid ?? null, ...event });
    recordUsageRollup("google_cloud_tts", { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
      { route: "speech_synthesis", totalMs }, estimateTtsCostUsd(voice, characters));
  } catch { /* accounting must not break playback */ }
}
