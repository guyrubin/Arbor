import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTtsUsageEvent, estimateTtsCostUsd, recordTtsUsage } from "./ttsUsage.js";
import { recordUsageRollup } from "../server/usageRollup.js";
import { logger } from "../server/logger.js";
vi.mock("../server/usageRollup.js", () => ({ recordUsageRollup: vi.fn() }));
vi.mock("../server/logger.js", () => ({ logger: { info: vi.fn() } }));
afterEach(() => vi.clearAllMocks());

describe("B-GA-26 TTS cost slice", () => {
  it.each(["en-US", "he-IL"])("prices the pinned %s voice by characters, not tokens", (locale) => {
    expect(estimateTtsCostUsd(`${locale}-Chirp3-HD-Sulafat`, 1000)).toBeCloseTo(0.03, 8);
  });
  it.each(["", "he-IL", "en-US-Standard-A", "new-model", "he-IL-Chirp3-HD-Sulafat-unpriced"])("leaves unknown/default %s unpriced", (voice) => {
    expect(estimateTtsCostUsd(voice, 1000)).toBeUndefined();
    expect(buildTtsUsageEvent(voice, "he", 1000, 50)).not.toHaveProperty("estimatedCostUsd");
  });
  it.each([-1, NaN, Infinity, 1.5])("rejects invalid character count %s", (count) => {
    expect(estimateTtsCostUsd("en-US-Chirp3-HD-Sulafat", count)).toBeUndefined();
  });
  it("records exactly one shared cost rollup and no fabricated text tokens", () => {
    recordTtsUsage("he-IL-Chirp3-HD-Sulafat", "he", 1000, 80);
    expect(recordUsageRollup).toHaveBeenCalledExactlyOnceWith("google_cloud_tts",
      { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
      { route: "speech_synthesis", totalMs: 80 }, 0.03);
    expect(logger.info).toHaveBeenCalledExactlyOnceWith("ai.usage", expect.objectContaining({
      lang: "he", characters: 1000, usageUnit: "characters", estimatedCostUsd: 0.03,
    }));
    const event = buildTtsUsageEvent("he-IL-Chirp3-HD-Sulafat", "he", 4, 10);
    expect(event).not.toHaveProperty("text");
    expect(event).not.toHaveProperty("audio");
  });
  it("does not break playback if telemetry is unavailable", () => {
    vi.mocked(logger.info).mockImplementationOnce(() => { throw new Error("log offline"); });
    expect(() => recordTtsUsage("", "en", 4, 10)).not.toThrow();
  });
});
