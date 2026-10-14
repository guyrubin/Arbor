import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initNaturalVoice, naturalSynth, prefetchNaturalAudio, primeNaturalAudio, resetNaturalVoice } from "./naturalVoice";
import { setAuthTokenProvider, setAiLanguage } from "./api";
import { setNaturalSynth, setVoiceEngine, speakText, stopVoice, voiceState, voiceSupported } from "./voice";
import { toggleSpeech } from "../hooks/useArborVoice";

class AudioStub {
  src = "";
  onplay: null | (() => void) = null;
  onended: null | (() => void) = null;
  onerror: null | (() => void) = null;
  play() { this.onplay?.(); return Promise.resolve(); }
  pause() {}
}
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const configured = (on = true) => ({ ok: true, json: async () => ({ configured: on }) });
const audioResponse = () => ({ ok: true, json: async () => ({ audio: "YQ==", mimeType: "audio/mpeg" }) });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  resetNaturalVoice();
  setAuthTokenProvider(async () => null);
  setAiLanguage("en");
  fetchMock = vi.fn(async () => audioResponse());
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Audio", AudioStub);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => {
  resetNaturalVoice();
  setAuthTokenProvider(async () => null);
  setAiLanguage("en");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("configuration recovery", () => {
  it.each([401, 403, 429, 500, 503])("does not latch HTTP %s as voice disabled", async (status) => {
    fetchMock.mockResolvedValueOnce({ ok: false, status });
    await initNaturalVoice();
    expect(voiceState().engine).toBe("basic");
    fetchMock.mockResolvedValueOnce(configured());
    await initNaturalVoice();
    expect(voiceState().engine).toBe("natural");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([{}, { configured: "true" }, null])("rejects malformed probe %j and retries", async (body) => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body });
    await initNaturalVoice();
    expect(voiceState().engine).toBe("basic");
    fetchMock.mockResolvedValueOnce(configured());
    await initNaturalVoice();
    expect(voiceState().engine).toBe("natural");
  });
  it("deduplicates parallel configuration probes and caches a real off switch", async () => {
    fetchMock.mockResolvedValue(configured(false));
    await Promise.all([initNaturalVoice(), initNaturalVoice(), initNaturalVoice()]);
    await initNaturalVoice();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(voiceState().engine).toBe("basic");
  });
  it("releases a hung auth probe after 5s and never dispatches it later", async () => {
    let release!: (token: string) => void;
    setAuthTokenProvider(() => new Promise((resolve) => { release = resolve; }));
    const pending = initNaturalVoice();
    await vi.advanceTimersByTimeAsync(5000);
    await pending;
    setAuthTokenProvider(async () => null);
    fetchMock.mockResolvedValue(configured());
    await initNaturalVoice();
    release("old-token");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(voiceState().engine).toBe("natural");
  });
  it("a late old-owner response cannot re-enable voice after reset", async () => {
    let release!: (response: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const pending = initNaturalVoice();
    await flush();
    resetNaturalVoice();
    release(configured());
    await pending;
    expect(voiceState().engine).toBe("basic");
  });
  it("a read-aloud interaction retries a failed bootstrap without moving playback out of the gesture", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    await initNaturalVoice();
    fetchMock.mockResolvedValueOnce(configured());
    const stopped = vi.fn();
    setNaturalSynth(() => ({ stop: stopped }));
    setVoiceEngine("natural");
    expect(toggleSpeech(0, "Hello").speaking).toBe(true);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    stopVoice();
    expect(stopped).toHaveBeenCalled();
  });
});

describe("audio ownership and cost boundaries", () => {
  it("shows support for configured natural audio without browser SpeechSynthesis", () => {
    vi.stubGlobal("window", {});
    expect(voiceSupported()).toBe(false);
    setNaturalSynth(() => ({ stop: vi.fn() }));
    setVoiceEngine("natural");
    expect(voiceSupported()).toBe(true);
    expect(speakText("Natural works")).toBeGreaterThan(0);
  });
  it("does not try missing browser APIs when the natural-only adapter declines", () => {
    vi.stubGlobal("window", {});
    setNaturalSynth(() => null);
    setVoiceEngine("natural");
    const onError = vi.fn();
    expect(speakText("No engine", { onError })).toBe(0);
    expect(onError).toHaveBeenCalledTimes(1);
  });
  it("stopping while auth is pending prevents a paid POST", async () => {
    let release!: (token: string) => void;
    setAuthTokenProvider(() => new Promise((resolve) => { release = resolve; }));
    const handle = naturalSynth("Stop before dispatch", {})!;
    handle.stop();
    release("token");
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("stopping an in-flight synthesis aborts its request without late playback", async () => {
    let release!: (response: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const onStart = vi.fn();
    const handle = naturalSynth("Already dispatched", { onStart })!;
    await flush();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    handle.stop();
    expect(signal.aborted).toBe(true);
    release(audioResponse());
    await flush();
    expect(onStart).not.toHaveBeenCalled();
  });
  it("a pending prefetch keeps the playback watchdog, with no duplicate POST", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    prefetchNaturalAudio("Pending", "he");
    await flush();
    const handle = naturalSynth("Pending", {}, "he")!;
    expect(handle.prefetched).toBe(false);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    handle.stop();
  });
  it("evicts and aborts the oldest speculative request at the existing 16-entry cap", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    for (let i = 0; i < 16; i++) prefetchNaturalAudio(`Sentence ${i}`);
    await flush();
    const oldest = fetchMock.mock.calls[0][1].signal as AbortSignal;
    prefetchNaturalAudio("One more");
    expect(oldest.aborted).toBe(true);
  });
  it("bounds a hung primed question and makes cancellation settle false", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const primed = primeNaturalAudio();
    const pending = primed.speak("Next question", "en");
    await flush();
    primed.cancel();
    await expect(pending).resolves.toBe(false);
    expect((fetchMock.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
  });
  it("never inherits the AI language for an explicitly Hebrew utterance", async () => {
    setAiLanguage("en");
    prefetchNaturalAudio("שלום", "he");
    await flush();
    naturalSynth("שלום", {}, "he");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).language).toBe("he");
  });
  it("times out hung prefetch and leaves no request running after sign-out", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    prefetchNaturalAudio("Hung");
    await flush();
    await vi.advanceTimersByTimeAsync(15000);
    expect((fetchMock.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
    resetNaturalVoice();
    expect(voiceState().engine).toBe("basic");
  });
});
