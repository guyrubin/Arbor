/**
 * AI-V4 + AI-V5 (voice-cadence) — the neural-voice adapter contract:
 *  - AI-V4 gate collapse: the engine flips to "natural" with ONLY the server
 *    probe reporting configured (TTS_PROVIDER server-side) — no client build
 *    flag involved anymore;
 *  - AI-V5 prefetch: sentence N+1's audio is fetched while N plays; the synth
 *    consumes the cached fetch, so once the (mocked 800ms) synthesis has run
 *    during playback, starting the next sentence needs NO further network
 *    time — the inter-sentence gap is far under the 250ms budget;
 *  - AI-V5 tokens: screened-sentence tokens from /voice ride along as
 *    `screenedToken` on /api/tts (single-use), and a prefetched handle is
 *    marked so the controller's TTFB watchdog is not re-armed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initNaturalVoice,
  naturalSynth,
  prefetchNaturalAudio,
  registerTtsToken,
  resetNaturalVoiceForTest,
} from "./naturalVoice";
import { setNaturalSynth, setVoiceEngine, voiceState } from "./voice";

class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  onplay: null | (() => void) = null;
  onended: null | (() => void) = null;
  onerror: null | (() => void) = null;
  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
  play() {
    this.onplay?.();
    return Promise.resolve();
  }
  pause() {}
}

let fetchMock: ReturnType<typeof vi.fn>;
const origCreateObjectURL = URL.createObjectURL;
const origRevokeObjectURL = URL.revokeObjectURL;

const okAudioResponse = () => ({
  ok: true,
  json: async () => ({ audio: "QkFTRTY0QVVESU8=", mimeType: "audio/mpeg" }),
});

beforeEach(() => {
  resetNaturalVoiceForTest();
  FakeAudio.instances = [];
  fetchMock = vi.fn(async () => okAudioResponse());
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Audio", FakeAudio);
  URL.createObjectURL = (() => "blob:fake") as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  URL.createObjectURL = origCreateObjectURL;
  URL.revokeObjectURL = origRevokeObjectURL;
  setNaturalSynth(null);
  setVoiceEngine("basic");
  resetNaturalVoiceForTest();
  vi.useRealTimers();
});

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) await Promise.resolve();
};

describe("initNaturalVoice — AI-V4 gate collapse", () => {
  it("flips the engine to 'natural' from the server probe ALONE (no client build flag)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) });
    await initNaturalVoice();
    expect(voiceState().engine).toBe("natural");
    expect(fetchMock).toHaveBeenCalledWith("/api/tts", expect.anything());
  });

  it("leaves the browser floor when the server reports not configured", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ configured: false }) });
    await initNaturalVoice();
    expect(voiceState().engine).toBe("basic");
  });

  it("leaves the browser floor when the probe fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await initNaturalVoice();
    expect(voiceState().engine).toBe("basic");
  });
});

describe("screened-sentence tokens — AI-V5", () => {
  it("sends the registered token as screenedToken (single-use)", async () => {
    registerTtsToken("Hello there.", "tok-1");
    const onError = vi.fn();
    naturalSynth("Hello there.", { onError });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toBe("Hello there.");
    expect(body.screenedToken).toBe("tok-1");

    // Single-use: a second synthesis of the same text carries no token —
    // the server just runs the full screen (fail closed, only slower).
    naturalSynth("Hello there.", { onError });
    await flush();
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body2.screenedToken).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("sentence prefetch — AI-V5", () => {
  it("the synth consumes the prefetched audio: ONE fetch total, handle marked prefetched", async () => {
    prefetchNaturalAudio("Sentence two.");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const onStart = vi.fn();
    const handle = naturalSynth("Sentence two.", { onStart })!;
    expect(handle.prefetched).toBe(true);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1); // no second network trip
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("with a mocked 800ms synth, a sentence prefetched during playback starts with ZERO additional network wait (inter-sentence gap ≪ 250ms)", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(okAudioResponse()), 800)),
    );
    // Sentence N is playing; the pump prefetches N+1 now.
    prefetchNaturalAudio("Sentence after.");
    // The 800ms synthesis happens WHILE sentence N is still playing.
    await vi.advanceTimersByTimeAsync(800);
    // Sentence N ends → the pump starts N+1: no timers may be needed anymore.
    const onStart = vi.fn();
    const handle = naturalSynth("Sentence after.", { onStart })!;
    expect(handle.prefetched).toBe(true);
    await flush();
    expect(onStart).toHaveBeenCalledTimes(1); // started without any further delay
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a non-prefetched sentence is NOT marked prefetched (the TTFB watchdog stays armed)", async () => {
    const handle = naturalSynth("Cold start.", { onError: vi.fn() })!;
    expect(handle.prefetched).toBe(false);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a failed prefetch degrades to onError (the controller falls back to the floor — never dead air)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    prefetchNaturalAudio("Broken.");
    await flush();
    const onError = vi.fn();
    naturalSynth("Broken.", { onError });
    await flush();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("stop() before the fetch resolves never plays audio", async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise((r) => (resolveFetch = r)));
    const onStart = vi.fn();
    const handle = naturalSynth("Interrupted.", { onStart })!;
    handle.stop();
    resolveFetch(okAudioResponse());
    await flush();
    expect(onStart).not.toHaveBeenCalled();
    expect(FakeAudio.instances).toHaveLength(0);
  });
});
