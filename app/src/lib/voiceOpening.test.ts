/**
 * B-VOICE-02 — the opening controller: the card's words first, the
 * microphone and the session only after them; a stop starts nothing.
 */
import { describe, expect, it, vi } from "vitest";
import { runOpening, type OpeningSpeaker } from "./voiceOpening";

const harness = () => {
  const order: string[] = [];
  let handlers: { onEnd: () => void; onError: () => void } | null = null;
  const speak: OpeningSpeaker = vi.fn((text, h) => { order.push(`speak:${text}`); handlers = h; });
  const stopSpeaking = vi.fn(() => { order.push("stop"); });
  const onDone = vi.fn(() => { order.push("start"); });
  return { order, speak, stopSpeaking, onDone, end: () => handlers!.onEnd(), error: () => handlers!.onError() };
};

describe("B-VOICE-02 · the card's words before the microphone", () => {
  it("speaks first and starts the talk only when the words have finished", () => {
    const h = harness();
    const run = runOpening("I'm here.", h);
    expect(h.order).toEqual(["speak:I'm here."]);
    expect(h.onDone).not.toHaveBeenCalled(); // nothing listens while the words play
    expect(run.state()).toBe("speaking");
    h.end();
    expect(h.order).toEqual(["speak:I'm here.", "start"]);
    expect(run.state()).toBe("done");
    h.end(); // a late duplicate end starts nothing twice
    expect(h.onDone).toHaveBeenCalledOnce();
  });

  it("a tap skips the words: speech stops first, then the talk starts, once", () => {
    const h = harness();
    const run = runOpening("Say this.", h);
    expect(run.skip()).toBe(true);
    expect(h.order).toEqual(["speak:Say this.", "stop", "start"]);
    expect(run.skip()).toBe(false);
    h.end(); // the cut utterance never re-fires the start
    expect(h.onDone).toHaveBeenCalledOnce();
  });

  it("a stop (X, the panel hiding, a new thread) cancels: the talk never starts", () => {
    const h = harness();
    const run = runOpening("Words.", h);
    run.cancel();
    h.end();
    h.error();
    expect(run.skip()).toBe(false);
    expect(h.onDone).not.toHaveBeenCalled();
    expect(run.state()).toBe("cancelled");
  });

  it("words that cannot play do not hold the talk back (and still never overlap it)", () => {
    const h = harness();
    runOpening("Words.", h);
    h.error();
    expect(h.order).toEqual(["speak:Words.", "start"]);
  });

  it("a speaker that fails synchronously still starts after, never before, the attempt", () => {
    const order: string[] = [];
    runOpening("Words.", { speak: (_t, hs) => { order.push("speak"); hs.onError(); }, stopSpeaking: () => order.push("stop"), onDone: () => order.push("start") });
    expect(order).toEqual(["speak", "start"]);
  });
});
