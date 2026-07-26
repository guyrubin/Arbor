/**
 * AI-CAP-6 — generous-endpointing dictation (capture-feel wave).
 *
 * `opts.continuous = true` keeps recognition alive across natural mid-story
 * pauses: a 1.5s breath must NOT end the capture. The session finalizes only
 * via (a) the caller's manual stop() or (b) the ~4-5s silence-finalize timer,
 * both of which route through rec.stop() → onend so the FULL accumulated
 * transcript is handed to extraction exactly once. Callers that omit opts keep
 * the single-shot behavior byte-identical (continuous stays false, no timer).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startDictation } from "./speech";

class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = "";
  interimResults = false;
  maxAlternatives = 0;
  continuous = false;
  started = false;
  stopCalls = 0;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  // Browser contract: stop() ends the session, firing onend with what was heard.
  stop() {
    this.stopCalls += 1;
    this.onend?.();
  }
}

const result = (transcript: string, isFinal: boolean) =>
  Object.assign([{ transcript }], { isFinal });
const event = (resultIndex: number, ...results: unknown[]) => ({ resultIndex, results });

beforeEach(() => {
  vi.useFakeTimers();
  FakeRecognition.last = null;
  vi.stubGlobal("window", { SpeechRecognition: FakeRecognition });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AI-CAP-6 — continuous flag", () => {
  it("opts.continuous=true flips rec.continuous on", () => {
    startDictation({ onResult: () => {} }, "en-US", { continuous: true });
    expect(FakeRecognition.last!.continuous).toBe(true);
  });

  it("without opts the single-shot contract is unchanged (continuous=false, no silence timer)", () => {
    startDictation({ onResult: () => {} }, "en-US");
    const rec = FakeRecognition.last!;
    expect(rec.continuous).toBe(false);
    rec.onresult!(event(0, result("hello", true)));
    vi.advanceTimersByTime(60_000);
    // No timer ever calls stop() — only the browser or the caller ends it.
    expect(rec.stopCalls).toBe(0);
  });
});

describe("AI-CAP-6 — pauses do not end capture; silence finalizes", () => {
  it("a 1.5s pause does NOT end the session; each result re-arms the silence timer", () => {
    const finals: string[] = [];
    startDictation({ onResult: (t) => finals.push(t) }, "en-US", { continuous: true, silenceFinalizeMs: 4500 });
    const rec = FakeRecognition.last!;

    rec.onresult!(event(0, result("he was crying ", true)));
    vi.advanceTimersByTime(1500); // natural mid-story pause
    expect(rec.stopCalls).toBe(0);
    expect(finals).toEqual([]);

    // results is the FULL list; resultIndex points at the first changed entry.
    rec.onresult!(event(1, result("he was crying ", true), result("and threw the tablet", true)));
    vi.advanceTimersByTime(4499);
    expect(rec.stopCalls).toBe(0);

    // 4.5s of true silence since the LAST result → finalize with the FULL text.
    vi.advanceTimersByTime(1);
    expect(rec.stopCalls).toBe(1);
    expect(finals).toEqual(["he was crying and threw the tablet"]);
  });

  it("manual stop finalizes and hands the full transcript to onResult exactly once", () => {
    const finals: string[] = [];
    const stop = startDictation({ onResult: (t) => finals.push(t) }, "en-US", { continuous: true });
    const rec = FakeRecognition.last!;
    rec.onresult!(event(0, result("bedtime went sideways", true)));
    stop();
    expect(finals).toEqual(["bedtime went sideways"]);
    // The pending silence timer was cleared — no second finalize later.
    vi.advanceTimersByTime(60_000);
    expect(finals).toEqual(["bedtime went sideways"]);
  });

  it("interim partials also re-arm the silence timer (still speaking = not silent)", () => {
    const interims: string[] = [];
    startDictation(
      { onResult: () => {}, onInterim: (t) => interims.push(t) },
      "he-IL",
      { continuous: true, silenceFinalizeMs: 4500 },
    );
    const rec = FakeRecognition.last!;
    expect(rec.interimResults).toBe(true);
    vi.advanceTimersByTime(4000);
    rec.onresult!(event(0, result("הוא בכה", false)));
    // 4s + 4s spans the original arm window, but the partial re-armed it.
    vi.advanceTimersByTime(4000);
    expect(rec.stopCalls).toBe(0);
    expect(interims).toEqual(["הוא בכה"]);
  });

  it("with nothing said at all, the silence window closes the session cleanly (onEnd, no onResult)", () => {
    const finals: string[] = [];
    let ended = 0;
    startDictation(
      { onResult: (t) => finals.push(t), onEnd: () => { ended += 1; } },
      "en-US",
      { continuous: true, silenceFinalizeMs: 4500 },
    );
    vi.advanceTimersByTime(4500);
    expect(FakeRecognition.last!.stopCalls).toBe(1);
    expect(finals).toEqual([]);
    expect(ended).toBe(1);
  });

  it("a recognition error clears the pending silence timer (no zombie stop later)", () => {
    const errors: string[] = [];
    startDictation(
      { onResult: () => {}, onError: (e) => errors.push(e) },
      "en-US",
      { continuous: true, silenceFinalizeMs: 4500 },
    );
    const rec = FakeRecognition.last!;
    rec.onerror!({ error: "network" });
    expect(errors).toEqual(["network"]);
    vi.advanceTimersByTime(60_000);
    expect(rec.stopCalls).toBe(0);
  });
});
