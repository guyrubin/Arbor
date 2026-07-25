/**
 * AI-V7 — interim dictation partials in lib/speech.
 *
 * Providing `onInterim` flips `interimResults` on and streams the FULL text so
 * far (finalized + interim) so the overlay caption renders the parent's own
 * words while they are still speaking. Callers without onInterim keep the
 * exact pre-existing final-only behavior (interimResults stays false).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { startDictation, speechSupported } from "./speech";

class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = "";
  interimResults = false;
  maxAlternatives = 0;
  continuous = false;
  started = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
}

vi.stubGlobal("window", { SpeechRecognition: FakeRecognition });

afterAll(() => {
  vi.unstubAllGlobals();
});

/** One SpeechRecognitionResult: array-like with [0].transcript + isFinal. */
const result = (transcript: string, isFinal: boolean) =>
  Object.assign([{ transcript }], { isFinal });

const event = (resultIndex: number, ...results: unknown[]) => ({ resultIndex, results });

beforeEach(() => {
  FakeRecognition.last = null;
});

describe("AI-V7 — onInterim partials", () => {
  it("speechSupported sees the stubbed recognizer", () => {
    expect(speechSupported()).toBe(true);
  });

  it("flips interimResults on ONLY when onInterim is provided", () => {
    startDictation({ onResult: () => {} });
    expect(FakeRecognition.last!.interimResults).toBe(false);
    startDictation({ onResult: () => {}, onInterim: () => {} });
    expect(FakeRecognition.last!.interimResults).toBe(true);
  });

  it("streams the full text so far (finalized + interim), then delivers the final transcript", () => {
    const interims: string[] = [];
    const finals: string[] = [];
    startDictation({ onResult: (t) => finals.push(t), onInterim: (t) => interims.push(t) }, "he-IL");
    const rec = FakeRecognition.last!;
    expect(rec.lang).toBe("he-IL");
    expect(rec.started).toBe(true);

    rec.onresult!(event(0, result("hel", false)));
    rec.onresult!(event(0, result("hello ", true), result("there", false)));
    // resultIndex=1: only the tail updated — the finalized head is not re-read.
    rec.onresult!(event(1, result("hello ", true), result("there friend", false)));
    expect(interims).toEqual(["hel", "hello there", "hello there friend"]);

    rec.onresult!(event(1, result("hello ", true), result("there, friend.", true)));
    rec.onend!();
    expect(finals).toEqual(["hello there, friend."]);
  });

  it("without onInterim, onresult accumulates finals silently (no interim callback path)", () => {
    const finals: string[] = [];
    startDictation({ onResult: (t) => finals.push(t) });
    const rec = FakeRecognition.last!;
    rec.onresult!(event(0, result("only finals count", true)));
    rec.onend!();
    expect(finals).toEqual(["only finals count"]);
  });
});
