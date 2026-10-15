import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { synthesizeSpeech } from "./tts.js";
import { recordTtsUsage } from "../ai/ttsUsage.js";
import type { ArborConfig } from "../config/env.js";
vi.mock("../ai/ttsUsage.js", () => ({ recordTtsUsage: vi.fn() }));
vi.mock("google-auth-library", () => ({ GoogleAuth: class {
  async getClient() { return { getAccessToken: async () => ({ token: "fake" }) }; }
} }));

describe("B-PROV-05 production configuration guard", () => {
  it("pins EN and HE without changing the approved provider or text/image routing", () => {
    const yaml = readFileSync(new URL("../../../cloudbuild.prod.yaml", import.meta.url), "utf8");
    // Match the deployed --set-env-vars entries, not incidental mentions in
    // comments (the image model is also documented above the deploy command).
    const env = yaml.split("\n").find((line) => line.trimStart().startsWith("- ^|^ARBOR_ENV="))!
      .trim().slice("- ^|^".length).split("|");
    for (const value of ["TTS_PROVIDER=google", "TTS_VOICE_EN=en-US-Chirp3-HD-Sulafat", "TTS_VOICE_HE=he-IL-Chirp3-HD-Sulafat",
      "VERTEX_MODEL_CHAT=gemini-3.5-flash", "VERTEX_MODEL_IMAGE=gemini-2.5-flash-image", "CHILD_ASR_PROVIDER=none"]) {
      expect(env.filter((entry) => entry.startsWith(`${value.split("=")[0]}=`))).toEqual([value]);
    }
  });
  it("does not display the stale provider-generic euro estimate or hide unpriced calls", () => {
    const ui = readFileSync(new URL("../components/layout/AdminDashboard.tsx", import.meta.url), "utf8");
    expect(ui).not.toContain("approxCostEur");
    expect(ui).toContain("cost30d.pricedCalls");
    expect(ui).toContain("Not measured");
    expect(ui).toContain("unknown models are not free");
  });
  it.each(["en", "he"] as const)("meters one successful %s synthesis by Unicode characters", async (lang) => {
    vi.mocked(recordTtsUsage).mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ audioContent: "YQ==" }) })));
    try {
      const voice = `${lang === "he" ? "he-IL" : "en-US"}-Chirp3-HD-Sulafat`;
      const config = { ttsProvider: "google", ttsDisabled: false, ttsVoiceEn: voice, ttsVoiceHe: voice } as ArborConfig;
      await synthesizeSpeech(config, { text: "א a🙂", lang });
      expect(recordTtsUsage).toHaveBeenCalledExactlyOnceWith(voice, lang, 4, expect.any(Number));
    } finally { vi.unstubAllGlobals(); }
  });
  it("does not record a failed synthesis as successful priced usage", async () => {
    vi.mocked(recordTtsUsage).mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, text: async () => "unavailable" })));
    try {
      await expect(synthesizeSpeech({ ttsProvider: "google", ttsDisabled: false } as ArborConfig, { text: "Hi", lang: "en" })).rejects.toThrow();
      expect(recordTtsUsage).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});
