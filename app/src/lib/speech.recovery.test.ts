import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startDictation } from "./speech";

class Recognition {
  static all: Recognition[] = [];
  static failure: Error | null = null;
  onaudiostart?: () => void;
  onaudioend?: () => void;
  onend?: () => void;
  onerror?: (e: { error: string }) => void;
  onresult?: (e: unknown) => void;
  start() { if (Recognition.failure) throw Recognition.failure; }
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() { Recognition.all.push(this); }
}
beforeEach(() => {
  vi.useFakeTimers();
  Recognition.all = []; Recognition.failure = null;
  vi.stubGlobal("window", { webkitSpeechRecognition: Recognition });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("shared capture startup recovery", () => {
  it("restarts an immediate empty Chrome end without closing capture, then delivers speech once", () => {
    const onEnd = vi.fn(), onError = vi.fn(), onResult = vi.fn();
    startDictation({ onEnd, onError, onResult }, "en-US", { continuous: true });
    const first = Recognition.all[0];
    first.onend?.();
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(Recognition.all).toHaveLength(2);
    const next = Recognition.all[1];
    next.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "pickup was hard" }], { isFinal: true })] });
    next.onend?.(); next.onend?.(); first.onend?.();
    expect(onResult).toHaveBeenCalledExactlyOnceWith("pickup was hard");
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("does not start the short silence window while the parent has not spoken", () => {
    const onEnd = vi.fn();
    const stop = startDictation({ onEnd, onResult: vi.fn() }, "en-US", { continuous: true });
    vi.advanceTimersByTime(4500);
    expect(Recognition.all[0].stop).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
    stop();
  });

  it("ends after bounded startup failures with an actionable reason", () => {
    const onError = vi.fn(), onEnd = vi.fn();
    startDictation({ onError, onEnd, onResult: vi.fn() }, "en-US", { continuous: true });
    for (let i = 0; i < 4; i++) {
      Recognition.all.at(-1)?.onend?.();
      vi.advanceTimersByTime(2000);
    }
    expect(onError).toHaveBeenCalledExactlyOnceWith("no-speech");
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(Recognition.all).toHaveLength(3);
  });

  it("permission failure immediately settles once, even if Chrome omits onend", () => {
    const onError = vi.fn(), onEnd = vi.fn();
    startDictation({ onError, onEnd, onResult: vi.fn() });
    Recognition.all[0].onerror?.({ error: "not-allowed" });
    Recognition.all[0].onend?.();
    vi.advanceTimersByTime(10000);
    expect(onError).toHaveBeenCalledExactlyOnceWith("not-allowed");
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(Recognition.all).toHaveLength(1);
  });

  it("normalizes synchronous microphone permission failure and clears recording", () => {
    Recognition.failure = new DOMException("blocked", "NotAllowedError");
    const onError = vi.fn(), onEnd = vi.fn();
    startDictation({ onError, onEnd, onResult: vi.fn() });
    expect(onError).toHaveBeenCalledWith("not-allowed");
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("Stop during backoff cancels every future restart without reporting failure", () => {
    const onError = vi.fn(), onEnd = vi.fn();
    const stop = startDictation({ onError, onEnd, onResult: vi.fn() });
    Recognition.all[0].onend?.(); stop(); stop();
    vi.advanceTimersByTime(20000);
    expect(Recognition.all).toHaveLength(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

const words = (transcript: string, isFinal = false) =>
  Object.assign([{ transcript }], { isFinal });
const results = (...items: ReturnType<typeof words>[]) => ({ resultIndex: 0, results: items });

describe("dictation completion across browser event orderings", () => {
  it("releases a stalled microphone after Stop even when a late result arrives", () => {
    const onResult = vi.fn(), onEnd = vi.fn();
    const stop = startDictation({ onResult, onInterim: vi.fn(), onEnd }, "en-US", { continuous: true });
    const rec = Recognition.all[0];
    rec.stop.mockImplementation(() => {});
    rec.onresult?.(results(words("a short note")));
    stop();
    rec.onresult?.(results(words("a short note today", true)));
    vi.advanceTimersByTime(1500);
    expect(rec.abort).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledExactlyOnceWith("a short note today");
    expect(onEnd).toHaveBeenCalledOnce();
    rec.onend?.();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("keeps the visible caption once, including a revised interim tail on a natural end", () => {
    const onResult = vi.fn(), onEnd = vi.fn();
    startDictation({ onResult, onInterim: vi.fn(), onEnd }, "he-IL", { continuous: true });
    const rec = Recognition.all[0];
    rec.onresult?.(results(words("שלום", true), words("לכולם")));
    rec.onresult?.(results(words("שלום", true), words("לעולם")));
    rec.onend?.(); rec.onend?.();
    expect(onResult).toHaveBeenCalledExactlyOnceWith("שלום לעולם");
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("ends after a pause even when the service repeats an identical interim result", () => {
    const onResult = vi.fn(), onEnd = vi.fn();
    startDictation({ onResult, onInterim: vi.fn(), onEnd }, "en-US", { continuous: true });
    const rec = Recognition.all[0];
    for (let i = 0; i < 6; i++) {
      rec.onresult?.(results(words("keep these words")));
      vi.advanceTimersByTime(1000);
    }
    expect(rec.stop).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledExactlyOnceWith("keep these words");
    expect(onEnd).toHaveBeenCalledOnce();
  });
});

describe("microphone readiness and conversational turns", () => {
  it("shows recording only after audio starts, then finishes on audio end without a service end", () => {
    const onPhase = vi.fn(), onResult = vi.fn(), onEnd = vi.fn();
    startDictation({ onResult, onPhase, onEnd }, "en-US", { continuous: true });
    const rec = Recognition.all[0];
    expect(onPhase.mock.calls.flat()).toEqual(["starting"]);
    rec.onaudiostart?.();
    rec.onresult?.(results(words("one thought", true)));
    rec.onaudioend?.();
    vi.advanceTimersByTime(800);
    rec.onaudioend?.();
    rec.onaudiostart?.();
    vi.advanceTimersByTime(400);
    expect(onPhase.mock.calls.flat()).toEqual(["starting", "recording", "finishing"]);
    expect(rec.abort).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledExactlyOnceWith("one thought");
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("cancels a pending microphone immediately and ignores a late grant and transcript", () => {
    const onPhase = vi.fn(), onEnd = vi.fn(), onResult = vi.fn();
    const stop = startDictation({ onPhase, onEnd, onResult }, "en-US", { continuous: true });
    const rec = Recognition.all[0];
    stop(); rec.onaudiostart?.(); rec.onresult?.(results(words("too late", true))); rec.onend?.();
    vi.runAllTimers();
    expect(rec.abort).toHaveBeenCalledOnce();
    expect(onPhase.mock.calls.flat()).toEqual(["starting"]);
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onResult).not.toHaveBeenCalled();
    expect(Recognition.all).toHaveLength(1);
  });

  it("ends a stalled startup without claiming the microphone opened", () => {
    const onError = vi.fn(), onPhase = vi.fn(), onEnd = vi.fn();
    startDictation({ onError, onPhase, onEnd, onResult: vi.fn() }, "en-US", { silenceFinalizeMs: 2000 });
    vi.advanceTimersByTime(30_000);
    expect(onPhase.mock.calls.flat()).toEqual(["starting"]);
    expect(onError).toHaveBeenCalledExactlyOnceWith("audio-capture");
    expect(Recognition.all[0].abort).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("returns an unconfirmed conversational turn for editing instead of sending a truncated prefix", () => {
    const onUnconfirmed = vi.fn(), onResult = vi.fn();
    startDictation({ onUnconfirmed, onResult, onInterim: vi.fn() }, "en-US", { silenceFinalizeMs: 2000 });
    Recognition.all[0].onresult?.(results(words("please", true), words("keep the rest")));
    vi.advanceTimersByTime(2000);
    expect(onUnconfirmed).toHaveBeenCalledExactlyOnceWith("please keep the rest");
    expect(onResult).not.toHaveBeenCalled();
  });
});
