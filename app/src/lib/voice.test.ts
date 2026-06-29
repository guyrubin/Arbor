import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isActive,
  setVoiceEngine,
  speakText,
  stopVoice,
  subscribeVoice,
  voiceState,
  voiceSupported,
} from "./voice";

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
  delete (globalThis as any).window;
  delete (globalThis as any).SpeechSynthesisUtterance;
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
