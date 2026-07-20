import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArborConfig } from "../config/env.js";
import { NotConfiguredError, synthesizeSpeech, ttsConfigured } from "./tts.js";

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
});
