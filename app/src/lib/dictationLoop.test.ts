/**
 * AI-V3 (voice-cadence) — the truthful continuous-mic contract:
 *  - recoverable recognition errors ('no-speech', 'network', …) restart
 *    dictation with backoff (a NEW startDictation call actually happens, so
 *    "Listening" is never a dead label);
 *  - silent session ends (no transcript, no error) auto-cycle the mic;
 *  - 'not-allowed' is fatal: no restart, the caller gets a permission reason;
 *  - a max-retry circuit breaker prevents infinite restart loops;
 *  - a delivered transcript settles the session and resets the breaker.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDictationLoop, type StartDictationFn } from "./dictationLoop";

type Session = {
  handlers: { onResult: (t: string) => void; onError?: (e: string) => void; onEnd?: () => void };
  stop: ReturnType<typeof vi.fn>;
};

let sessions: Session[];
let active: boolean;
let transcripts: string[];
let fatals: string[];

const startSpy: StartDictationFn = vi.fn((handlers) => {
  const stop = vi.fn();
  sessions.push({ handlers: handlers as Session["handlers"], stop });
  return stop;
});

const makeLoop = (over: Partial<Parameters<typeof createDictationLoop>[0]> = {}) =>
  createDictationLoop({
    start: startSpy,
    lang: "en-US",
    isActive: () => active,
    onTranscript: (t) => transcripts.push(t),
    onFatal: (r) => fatals.push(r),
    ...over,
  });

beforeEach(() => {
  vi.useFakeTimers();
  sessions = [];
  active = true;
  transcripts = [];
  fatals = [];
  (startSpy as ReturnType<typeof vi.fn>).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createDictationLoop", () => {
  it("restarts recognition after a recoverable 'no-speech' error (a REAL new startDictation call)", () => {
    const loop = makeLoop();
    loop.start();
    expect(sessions).toHaveLength(1);
    sessions[0].handlers.onError?.("no-speech");
    // Not yet — backoff first.
    expect(sessions).toHaveLength(1);
    vi.advanceTimersByTime(250);
    expect(sessions).toHaveLength(2); // the mic is genuinely listening again
    loop.stop();
  });

  it("auto-cycles when a session ends silently with no transcript (onEnd wiring)", () => {
    const loop = makeLoop();
    loop.start();
    sessions[0].handlers.onEnd?.();
    vi.advanceTimersByTime(250);
    expect(sessions).toHaveLength(2);
    loop.stop();
  });

  it("does NOT restart after onEnd when a transcript was already delivered", () => {
    const loop = makeLoop();
    loop.start();
    sessions[0].handlers.onResult("bedtime was rough");
    sessions[0].handlers.onEnd?.(); // browser fires onend after the result
    vi.advanceTimersByTime(5000);
    expect(transcripts).toEqual(["bedtime was rough"]);
    expect(sessions).toHaveLength(1); // the caller resumes; the loop does not
    loop.stop();
  });

  it("'not-allowed' is fatal: voice stops with a permission reason and never restarts", () => {
    const loop = makeLoop();
    loop.start();
    sessions[0].handlers.onError?.("not-allowed");
    vi.advanceTimersByTime(10_000);
    expect(fatals).toEqual(["permission"]);
    expect(sessions).toHaveLength(1);
  });

  it("'service-not-allowed' is also a permission stop", () => {
    const loop = makeLoop();
    loop.start();
    sessions[0].handlers.onError?.("service-not-allowed");
    vi.advanceTimersByTime(10_000);
    expect(fatals).toEqual(["permission"]);
  });

  it("the circuit breaker stops an infinite restart loop", () => {
    const loop = makeLoop({ maxRestarts: 3 });
    loop.start();
    for (let i = 0; i < 3; i++) {
      sessions[sessions.length - 1].handlers.onError?.("network");
      vi.advanceTimersByTime(2000); // ≥ max backoff
    }
    expect(sessions).toHaveLength(4); // initial + 3 restarts
    // The 4th consecutive failure trips the breaker instead of restarting.
    sessions[3].handlers.onError?.("network");
    vi.advanceTimersByTime(10_000);
    expect(sessions).toHaveLength(4);
    expect(fatals).toEqual(["retry-exhausted"]);
  });

  it("a delivered transcript RESETS the breaker", () => {
    const loop = makeLoop({ maxRestarts: 2 });
    loop.start();
    sessions[0].handlers.onError?.("no-speech");
    vi.advanceTimersByTime(250);
    sessions[1].handlers.onError?.("no-speech");
    vi.advanceTimersByTime(500);
    expect(sessions).toHaveLength(3);
    sessions[2].handlers.onResult("we made it");
    // A fresh loop cycle after the transcript gets the full budget again.
    expect(transcripts).toEqual(["we made it"]);
    loop.stop();
  });

  it("backoff grows per consecutive restart", () => {
    const loop = makeLoop();
    loop.start();
    sessions[0].handlers.onError?.("no-speech");
    vi.advanceTimersByTime(249);
    expect(sessions).toHaveLength(1); // first backoff = 250ms
    vi.advanceTimersByTime(1);
    expect(sessions).toHaveLength(2);
    sessions[1].handlers.onError?.("no-speech");
    vi.advanceTimersByTime(499);
    expect(sessions).toHaveLength(2); // second backoff = 500ms
    vi.advanceTimersByTime(1);
    expect(sessions).toHaveLength(3);
    loop.stop();
  });

  it("stop() cancels a pending restart and stops the live recognizer", () => {
    const loop = makeLoop();
    loop.start();
    sessions[0].handlers.onError?.("no-speech");
    loop.stop();
    vi.advanceTimersByTime(10_000);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].stop).toHaveBeenCalled();
  });

  it("does not restart when the caller turned voice off (isActive false)", () => {
    const loop = makeLoop();
    loop.start();
    active = false;
    sessions[0].handlers.onError?.("no-speech");
    vi.advanceTimersByTime(10_000);
    expect(sessions).toHaveLength(1);
    expect(fatals).toEqual([]);
  });
});

describe("AI-V7 — onInterim passthrough", () => {
  type InterimHandlers = Session["handlers"] & { onInterim?: (t: string) => void };

  it("forwards interim partials to the caller while the session is live", () => {
    const interims: string[] = [];
    const loop = makeLoop({ onInterim: (t) => interims.push(t) });
    loop.start();
    const h = sessions[0].handlers as InterimHandlers;
    expect(h.onInterim).toBeTypeOf("function");
    h.onInterim?.("hel");
    h.onInterim?.("hello th");
    expect(interims).toEqual(["hel", "hello th"]);
    loop.stop();
  });

  it("suppresses interim partials after the session settled or the loop stopped", () => {
    const interims: string[] = [];
    const loop = makeLoop({ onInterim: (t) => interims.push(t) });
    loop.start();
    const h = sessions[0].handlers as InterimHandlers;
    sessions[0].handlers.onResult("final transcript");
    h.onInterim?.("late partial");
    expect(interims).toEqual([]); // settled → no stray caption updates
    loop.stop();
    h.onInterim?.("post-stop partial");
    expect(interims).toEqual([]);
  });

  it("callers without onInterim keep final-only recognition (no handler passed down)", () => {
    const loop = makeLoop();
    loop.start();
    const h = sessions[0].handlers as InterimHandlers;
    expect(h.onInterim).toBeUndefined();
    loop.stop();
  });
});
