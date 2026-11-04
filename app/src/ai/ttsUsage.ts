/** B-GA-26 (TTS slice), B-PROV-04: list-price estimates, not billing receipts.
 * Source verified 2026-10-14: https://cloud.google.com/text-to-speech/pricing
 * Only the approved pinned voice class is priced. Default/unknown voices stay
 * unpriced; free allowances, discounts, tax and FX are deliberately not assumed.
 */
import { logger } from "../server/logger.js";
import { costId, currentRequestContext } from "../server/requestContext.js";
import { recordUsageRollup } from "../server/usageRollup.js";
import { rememberFamilyCost } from "../server/familyCostWriter.js";
import { currentStudioScope, recordStudioUsage, studioAssetKey } from "../server/studioCostLedger.js";

export const TTS_PRICE_AS_OF = "2026-10-14";
export function estimateTtsCostUsd(voice: string, characters: number): number | undefined {
  if (!Number.isSafeInteger(characters) || characters < 0) return undefined;
  if (!/^(en-US|he-IL)-Chirp3-HD-Sulafat$/.test(voice)) return undefined;
  return characters * 30 / 1_000_000;
}

function costFlags(familyId: string | null) {
  return { familyId, retries: 0, fallback: false, chargedFailure: false };
}

export function buildTtsUsageEvent(voice: string, lang: "en" | "he", characters: number, totalMs: number) {
  const cost = estimateTtsCostUsd(voice, characters);
  const familyId = costId(currentRequestContext()?.familyId);
  return {
    route: "speech_synthesis", provider: "google_cloud_tts", model: "cloud-tts-v1",
    resolvedModel: voice || "unconfigured-voice", lang, characters, totalMs,
    usageUnit: "characters", priceTableAsOf: TTS_PRICE_AS_OF,
    ...costFlags(familyId),
    ...(cost === undefined ? {} : { estimatedCostUsd: cost }),
  };
}

/** Gemini book/plan TTS. Not on the Chirp price row, so the cost is a gap, never 0. No text. */
export function buildBookNarrationUsageEvent(model: string, characters: number, totalMs: number) {
  const safeModel = /^[A-Za-z0-9._:-]{1,80}$/.test(model) ? model : "unconfigured-model";
  return {
    route: "book_narration", provider: "google_cloud_tts", model: safeModel, resolvedModel: safeModel,
    characters, totalMs, usageUnit: "characters", priceTableAsOf: TTS_PRICE_AS_OF,
    ...costFlags(costId(currentRequestContext()?.familyId)),
  };
}

/** Successful provider responses only. No text, audio, names or tokens logged. */
export function recordTtsUsage(voice: string, lang: "en" | "he", characters: number, totalMs: number): void {
  try {
    const event = buildTtsUsageEvent(voice, lang, characters, totalMs);
    const ctx = currentRequestContext();
    const studio = currentStudioScope();
    logger.info("ai.usage", { requestId: ctx?.requestId ?? null, userUid: ctx?.uid ?? null, ...(studio ? { studioAsset: studioAssetKey(studio.asset) } : {}), ...event });
    // B-KID-150: a shared narration render is studio spend, never the family meter's.
    if (studio) {
      const cost = estimateTtsCostUsd(voice, characters);
      recordStudioUsage(studio.asset, { modality: "tts", ...(cost === undefined ? {} : { estimatedCostUsd: cost }) });
      return;
    }
    const cost = estimateTtsCostUsd(voice, characters);
    rememberFamilyCost({
      familyId: costId(event.familyId), uid: costId(ctx?.uid), route: "speech_synthesis",
      retries: 0, fallback: false, chargedFailure: false,
      promptTokens: 0, outputTokens: 0, cacheReadTokens: 0, audioSeconds: 0, imageCount: 0,
      characters, observedMs: 0, priceTableAsOf: TTS_PRICE_AS_OF, ...(cost === undefined ? {} : { estimatedCostUsd: cost }),
    });
    recordUsageRollup("google_cloud_tts", { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
      { route: "speech_synthesis", totalMs }, cost);
  } catch { /* accounting must not break playback */ }
}

/** A billed book or plan name-page synthesis. The text stays out of the record. */
export function recordBookNarrationUsage(model: string, characters: number, totalMs: number): void {
  try {
    const event = buildBookNarrationUsageEvent(model, characters, totalMs);
    const ctx = currentRequestContext();
    logger.info("ai.usage", { requestId: ctx?.requestId ?? null, userUid: ctx?.uid ?? null, ...event });
    rememberFamilyCost({
      familyId: costId(event.familyId), uid: costId(ctx?.uid), route: "book_narration",
      retries: 0, fallback: false, chargedFailure: false,
      promptTokens: 0, outputTokens: 0, cacheReadTokens: 0, audioSeconds: 0, imageCount: 0,
      characters, observedMs: 0, priceTableAsOf: TTS_PRICE_AS_OF,
    });
    recordUsageRollup("google_cloud_tts", { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
      { route: "book_narration", totalMs });
  } catch { /* accounting must not break playback */ }
}
