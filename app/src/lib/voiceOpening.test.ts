/**
 * B-VOICE-02 — the opening controller: the card's words first, the
 * microphone and the session only after them; a stop starts nothing.
 */
import { describe, expect, it, vi } from "vitest";
import { runOpening, startDoor, type OpeningSpeaker } from "./voiceOpening";

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

/** The door as CoachTab wires it, with the toggle's own outcomes faked:
 *  "begins" starts a voice attempt; "held" is B-PROV-12's provider notice on
 *  the ai-ops branch (it returns before begin()); "review" is an open review. */
function door(toggleOutcome: "begins" | "held", opts: { busy?: boolean; canSpeak?: boolean } = {}) {
  const log: string[] = [];
  let attempt: object | null = null;
  const deps = {
    busy: () => opts.busy === true,
    canSpeak: () => opts.canSpeak !== false,
    playWords: (line: string) => { log.push(`words:${line}`); },
    toggle: () => { log.push("toggle"); if (toggleOutcome === "begins") attempt = {}; },
    attempt: () => attempt,
  };
  return { log, deps };
}

describe("B-VOICE-02 / B-PROV-12 · the door (lib/voiceOpening startDoor, as CoachTab runs it)", () => {
  it("card words: the words start and the toggle is not called in the tap (the opening's end calls it)", () => {
    const { log, deps } = door("begins");
    expect(startDoor("  Same bedtime\n as every night. ", deps)).toBe(true);
    expect(log).toEqual(["words:Same bedtime as every night."]);
  });

  it("B-PROV-12: a toggle that a provider notice holds back cannot drop the card's words", () => {
    const { log, deps } = door("held");
    expect(startDoor("Let's breathe together.", deps)).toBe(true);
    expect(log).toEqual(["words:Let's breathe together."]);
    // …and when the words end, the toggle runs and the notice is what the parent sees.
    deps.toggle();
    expect(log).toEqual(["words:Let's breathe together.", "toggle"]);
  });

  it("no words: the ONE toggle in the same call; true only when it began an attempt", () => {
    const begins = door("begins");
    expect(startDoor(undefined, begins.deps)).toBe(true);
    expect(begins.log).toEqual(["toggle"]);
    const held = door("held");
    expect(startDoor(undefined, held.deps)).toBe(false);
    expect(held.log).toEqual(["toggle"]);
  });

  it("no voice to say the words: straight to the toggle; busy: nothing at all", () => {
    const mute = door("begins", { canSpeak: false });
    expect(startDoor("Words", mute.deps)).toBe(true);
    expect(mute.log).toEqual(["toggle"]);
    const busy = door("begins", { busy: true });
    expect(startDoor("Words", busy.deps)).toBe(false);
    expect(busy.log).toEqual([]);
  });
});

