import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArborConfig } from "../config/env.js";
import type { ModelProvider } from "../ai/modelRouter.js";
import { AiProviderError } from "../ai/capabilities/contracts.js";
import { NotConfiguredError, screenAndSynthesizeSpeech, synthesizeSpeech, ttsConfigured, UnsafeTtsOutputError } from "./tts.js";

// Stub ADC so no real credentials/network are needed.
vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getClient() {
      return { getAccessToken: async () => ({ token: "fake-adc-token" }) };
    }
  },
}));

const cfg = (over: Partial<ArborConfig> = {}): ArborConfig =>
  ({ ttsProvider: "google", ttsDisabled: false, ttsVoiceEn: "", ttsVoiceHe: "", ...over } as ArborConfig);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ audioContent: "QkFTRTY0QVVESU8=" }),
    text: async () => "",
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ttsConfigured", () => {
  it("is false when provider is none, true for google, and false when hard-killed", () => {
    expect(ttsConfigured(cfg({ ttsProvider: "none" }))).toBe(false);
    expect(ttsConfigured(cfg({ ttsProvider: "google" }))).toBe(true);
    expect(ttsConfigured(cfg({ ttsProvider: "google", ttsDisabled: true }))).toBe(false);
  });
});

describe("synthesizeSpeech", () => {
  it("throws NotConfiguredError when TTS is off (default ships the browser floor)", async () => {
    await expect(synthesizeSpeech(cfg({ ttsProvider: "none" }), { text: "hi", lang: "en" })).rejects.toBeInstanceOf(
      NotConfiguredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws NotConfiguredError when hard-killed even if a provider is set", async () => {
    await expect(
      synthesizeSpeech(cfg({ ttsProvider: "google", ttsDisabled: true }), { text: "hi", lang: "en" }),
    ).rejects.toBeInstanceOf(NotConfiguredError);
  });

  it("returns base64 MP3 audio and the right locale/voice for English", async () => {
    const r = await synthesizeSpeech(cfg({ ttsVoiceEn: "en-US-Studio-O" }), { text: "Once upon a time.", lang: "en" });
    expect(r).toEqual({ audio: "QkFTRTY0QVVESU8=", mimeType: "audio/mpeg" });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.voice.languageCode).toBe("en-US");
    expect(body.voice.name).toBe("en-US-Studio-O");
    expect(body.audioConfig.audioEncoding).toBe("MP3");
    expect(body.input.text).toBe("Once upon a time.");
  });

  it("pins he-IL for the Hebrew path", async () => {
    await synthesizeSpeech(cfg({ ttsVoiceHe: "he-IL-Wavenet-A" }), { text: "שלום", lang: "he" });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.voice.languageCode).toBe("he-IL");
    expect(body.voice.name).toBe("he-IL-Wavenet-A");
  });

  it("omits the voice name when none is configured (API default voice)", async () => {
    await synthesizeSpeech(cfg(), { text: "hi", lang: "en" });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.voice.name).toBeUndefined();
    expect(body.voice.languageCode).toBe("en-US");
  });

  it("throws (so the caller falls back to the floor) when Cloud TTS errors", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => "PERMISSION_DENIED" } as any);
    await expect(synthesizeSpeech(cfg(), { text: "hi", lang: "en" })).rejects.toThrow(/Cloud TTS synthesize failed \(403\)/);
  });

  it("throws when the response carries no audioContent", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}), text: async () => "" } as any);
    await expect(synthesizeSpeech(cfg(), { text: "hi", lang: "en" })).rejects.toThrow(/no audioContent/);
  });

  // COACH-3: TTS provider selection runs through selectProvider — a
  // misconfigured (non-EU, non-global) region fails closed before any
  // synthesis call reaches the provider.
  it("fails closed with policy_denied when the configured region violates the route policy", async () => {
    const denied = synthesizeSpeech(cfg({ vertexLocation: "us-central1" }), { text: "hi", lang: "en" });
    await expect(denied).rejects.toBeInstanceOf(AiProviderError);
    await synthesizeSpeech(cfg({ vertexLocation: "us-central1" }), { text: "hi", lang: "en" }).catch((error) => {
      expect((error as AiProviderError).code).toBe("policy_denied");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("denies TTS in prod when no EU region is declared (fail closed, EU-only policy)", async () => {
    await expect(
      synthesizeSpeech(cfg({ arborEnv: "prod" }), { text: "hi", lang: "en" }),
    ).rejects.toBeInstanceOf(AiProviderError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays eligible for the EU-resident production config (behavior unchanged)", async () => {
    const r = await synthesizeSpeech(cfg({ arborEnv: "prod", vertexLocation: "europe-west4" }), { text: "hi", lang: "en" });
    expect(r.mimeType).toBe("audio/mpeg");
  });

  it("blocks unsafe caller-provided text before any audio provider call", async () => {
    await expect(screenAndSynthesizeSpeech(
      cfg(),
      {} as ModelProvider,
      { text: "Your child has autism and needs treatment.", lang: "en" },
    )).rejects.toBeInstanceOf(UnsafeTtsOutputError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("synthesizes safe text after the output screen passes", async () => {
    const result = await screenAndSynthesizeSpeech(
      cfg(),
      {} as ModelProvider,
      { text: "Try naming the feeling together.", lang: "en" },
    );
    expect(result.mimeType).toBe("audio/mpeg");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
