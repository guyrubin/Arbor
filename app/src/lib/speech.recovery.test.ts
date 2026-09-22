import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startDictation } from "./speech";

class Recognition {
  static all: Recognition[] = [];
  static failure: Error | null = null;
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
