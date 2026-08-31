/**
 * AI-V2(a) — the chip/orb tap contract. The audit acceptance, as a table:
 *  - speaking → tap = INTERRUPT (fallback loop), voice stays on;
 *  - a second tap during listening = STOP (double-tap parity with today);
 *  - Live sessions: tap is always the hard off switch (barge-in there is
 *    voice-driven via Gemini's server VAD, AI-V2(b));
 *  - off → tap = START (the chip remains the sole entry point).
 */
import { describe, it, expect } from "vitest";
import { voiceChipAction } from "./voiceChipAction";

describe("voiceChipAction", () => {
  it("off → start (both engines)", () => {
    expect(voiceChipAction("off", false)).toBe("start");
    expect(voiceChipAction("off", true)).toBe("start");
  });

  it("speaking on the browser fallback loop → INTERRUPT, not off", () => {
    expect(voiceChipAction("speaking", false)).toBe("interrupt");
  });

  it("speaking on a Gemini Live session → stop (Live barge-in is voice-driven)", () => {
    expect(voiceChipAction("speaking", true)).toBe("stop");
  });

  it("double-tap parity: a tap during listening fully stops", () => {
    expect(voiceChipAction("listening", false)).toBe("stop");
    expect(voiceChipAction("listening", true)).toBe("stop");
  });

  it("thinking → stop (interrupting a not-yet-spoken answer is just a stop)", () => {
    expect(voiceChipAction("thinking", false)).toBe("stop");
    expect(voiceChipAction("thinking", true)).toBe("stop");
  });

  it("S5: connecting → stop (a tap during the visible connect window cancels it)", () => {
    expect(voiceChipAction("connecting", false)).toBe("stop");
    expect(voiceChipAction("connecting", true)).toBe("stop");
  });
});
