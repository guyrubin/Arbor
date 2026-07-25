import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isActive,
  resetVoicePickCacheForTest,
  setNaturalSynth,
  setVoiceEngine,
  speakText,
  stopVoice,
  subscribeVoice,
  voiceState,
  voiceSupported,
  type NaturalSynth,
  type SpeakHandlers,
} from "./voice";
import { setAiLanguage } from "./api";

/** Minimal SpeechSynthesis fake (the test env is `node`, no DOM). */
type FakeUtterance = {
  text: string;
  rate: number;
  pitch: number;
  onstart: null | (() => void);
  onend: null | (() => void);
  onerror: null | (() => void);
};

let spoken: FakeUtterance[];
let cancelCount: number;

beforeEach(() => {
  spoken = [];
  cancelCount = 0;
  (globalThis as any).SpeechSynthesisUtterance = class {
    text: string;
    rate = 1;
    pitch = 1;
    onstart: null | (() => void) = null;
    onend: null | (() => void) = null;
    onerror: null | (() => void) = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  (globalThis as any).window = {
    speechSynthesis: {
      speak: (u: FakeUtterance) => spoken.push(u),
      cancel: () => {
        cancelCount += 1;
      },
    },
  };
  setVoiceEngine("basic");
});

afterEach(() => {
  stopVoice();
  setNaturalSynth(null);
  setVoiceEngine("basic");
  vi.useRealTimers();
  delete (globalThis as any).window;
  delete (globalThis as any).SpeechSynthesisUtterance;
});

describe("voice controller — natural engine + browser-floor fallback", () => {
  type Call = { text: string; handlers: SpeakHandlers; stop: ReturnType<typeof vi.fn> };
  const makeNatural = () => {
    const calls: Call[] = [];
    const synth: NaturalSynth = (text, handlers) => {
      const stop = vi.fn();
      calls.push({ text, handlers, stop });
      return { stop };
    };
    return { synth, calls };
  };

  it("plays via the natural engine: onStart marks speaking, onEnd completes", () => {
    const { synth, calls } = makeNatural();
    setNaturalSynth(synth);
    setVoiceEngine("natural");
    const onEnd = vi.fn();
    const id = speakText("hello", { onEnd });
    expect(id).toBeGreaterThan(0);
    expect(calls).toHaveLength(1);
    expect(spoken).toHaveLength(0); // no browser utterance while neural owns it
    calls[0].handlers.onStart?.();
    expect(voiceState().speaking).toBe(true);
    calls[0].handlers.onEnd?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(voiceState().speaking).toBe(false);
    expect(isActive(id)).toBe(false);
  });

  it("falls back to the browser floor when the natural engine errors before starting", () => {
    const { synth, calls } = makeNatural();
    setNaturalSynth(synth);
    setVoiceEngine("natural");
    const onEnd = vi.fn();
    speakText("hi", { onEnd });
    expect(spoken).toHaveLength(0);
    calls[0].handlers.onError?.(); // never started → fallback to floor
    expect(voiceState().engine).toBe("basic"); // session degraded to the floor
    expect(spoken).toHaveLength(1); // browser floor spoke the SAME text
    expect(spoken[0].text).toBe("hi");
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("TTFB watchdog falls back to the floor when no audio starts in time", () => {
    vi.useFakeTimers();
    const { synth, calls } = makeNatural();
    setNaturalSynth(synth);
    setVoiceEngine("natural");
    speakText("slow one");
    expect(spoken).toHaveLength(0);
    vi.advanceTimersByTime(1600);
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe("slow one");
    expect(voiceState().engine).toBe("basic");
    // A late natural error must NOT double-speak (one-shot fallback guard).
    calls[0].handlers.onError?.();
    expect(spoken).toHaveLength(1);
  });

  it("stopVoice stops active natural playback", () => {
    const { synth, calls } = makeNatural();
    setNaturalSynth(synth);
    setVoiceEngine("natural");
    speakText("playing");
    calls[0].handlers.onStart?.();
    expect(voiceState().speaking).toBe(true);
    stopVoice();
    expect(calls[0].stop).toHaveBeenCalled();
    expect(voiceState().speaking).toBe(false);
  });
});

describe("voice controller", () => {
  it("reports support when SpeechSynthesis is present", () => {
    expect(voiceSupported()).toBe(true);
  });

  it("speaks text, marks speaking, and owns the utterance", () => {
    const id = speakText("hello");
    expect(id).toBeGreaterThan(0);
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe("hello");
    expect(voiceState().speaking).toBe(true);
    expect(isActive(id)).toBe(true);
  });

  it("blank text does not speak and signals error", () => {
    const onError = vi.fn();
    const id = speakText("   ", { onError });
    expect(id).toBe(0);
    expect(spoken).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("fires onEnd on natural completion and clears state", () => {
    const onEnd = vi.fn();
    const id = speakText("hi", { onEnd });
    spoken[0].onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(voiceState().speaking).toBe(false);
    expect(isActive(id)).toBe(false);
  });

  it("a new utterance interrupts the prior, whose late onEnd does NOT fire", () => {
    const onEnd = vi.fn();
    const id1 = speakText("one", { onEnd });
    const id2 = speakText("two");
    expect(isActive(id1)).toBe(false);
    expect(isActive(id2)).toBe(true);
    // The interrupted utterance's onend arrives late; it must be ignored.
    spoken[0].onend?.();
    expect(onEnd).not.toHaveBeenCalled();
    expect(voiceState().speaking).toBe(true);
  });

  it("stopVoice cancels playback and clears speaking", () => {
    speakText("hi");
    const before = cancelCount;
    stopVoice();
    expect(cancelCount).toBe(before + 1);
    expect(voiceState().speaking).toBe(false);
  });

  it("notifies subscribers immediately and on change", () => {
    const fn = vi.fn();
    const unsub = subscribeVoice(fn);
    expect(fn).toHaveBeenCalledTimes(1); // immediate snapshot
    fn.mockClear();
    speakText("hi");
    expect(fn).toHaveBeenCalled();
    unsub();
    fn.mockClear();
    speakText("again");
    expect(fn).not.toHaveBeenCalled(); // unsubscribed
  });

  it("setVoiceEngine updates the reported engine and emits", () => {
    const fn = vi.fn();
    const unsub = subscribeVoice(fn);
    fn.mockClear();
    setVoiceEngine("natural");
    expect(voiceState().engine).toBe("natural");
    expect(fn).toHaveBeenCalledWith({ speaking: false, engine: "natural" });
    unsub();
  });
});

// ── AI-V4: language + voice selection · AI-V5: prefetched watchdog skip ─────
describe("voice controller — AI-V4 lang/voice + AI-V5 watchdog", () => {
  type FakeVoice = { name: string; lang: string; localService: boolean };
  const withVoices = (voices: FakeVoice[]) => {
    (globalThis as any).window.speechSynthesis.getVoices = () => voices;
  };

  beforeEach(() => {
    resetVoicePickCacheForTest();
    setAiLanguage("en");
  });

  afterEach(() => {
    setAiLanguage("en");
  });

  it("an HE utterance carries lang='he-IL', a Hebrew voice when available, at rate 1.0", () => {
    const carmit = { name: "Carmit", lang: "he-IL", localService: true };
    withVoices([{ name: "Google US English", lang: "en-US", localService: false }, carmit]);
    speakText("שלום, בוקר טוב", {}, "he");
    expect(spoken).toHaveLength(1);
    const u = spoken[0] as any;
    expect(u.lang).toBe("he-IL");
    expect(u.voice).toBe(carmit);
    expect(u.rate).toBe(1.0);
  });

  it("an EN utterance prefers a local natural/neural-named voice over a plain remote one", () => {
    const plain = { name: "Basic English", lang: "en-US", localService: false };
    const natural = { name: "Emma (Natural)", lang: "en-US", localService: true };
    withVoices([plain, natural]);
    speakText("hello there", {}, "en");
    expect((spoken[0] as any).voice).toBe(natural);
    expect((spoken[0] as any).lang).toBe("en-US");
  });

  it("defaults the utterance language to the session AI language (getAiLanguage)", () => {
    withVoices([]);
    setAiLanguage("he");
    speakText("שלום");
    expect((spoken[0] as any).lang).toBe("he-IL");
  });

  it("an empty voice list is never cached — the pick recovers once voices load (voiceschanged)", () => {
    withVoices([]);
    speakText("one", {}, "en");
    expect((spoken[0] as any).voice).toBeUndefined();
    const samantha = { name: "Samantha", lang: "en-US", localService: true };
    withVoices([samantha]);
    speakText("two", {}, "en");
    expect((spoken[1] as any).voice).toBe(samantha);
  });

  it("AI-V5: a prefetched natural handle does NOT arm the TTFB watchdog — no mid-answer downgrade", () => {
    vi.useFakeTimers();
    setNaturalSynth(() => ({ stop: vi.fn(), prefetched: true }));
    setVoiceEngine("natural");
    speakText("a prefetched sentence");
    vi.advanceTimersByTime(5_000);
    expect(voiceState().engine).toBe("natural"); // never degraded
    expect(spoken).toHaveLength(0); // the browser floor was never invoked
  });

  it("a NON-prefetched natural utterance keeps the watchdog (falls back after 1500ms of silence)", () => {
    vi.useFakeTimers();
    setNaturalSynth(() => ({ stop: vi.fn() }));
    setVoiceEngine("natural");
    speakText("a cold-start sentence");
    vi.advanceTimersByTime(1_600);
    expect(voiceState().engine).toBe("basic");
    expect(spoken).toHaveLength(1);
  });
});
