import { describe, it, expect } from "vitest";
import { nextNudge } from "./jitai";
import type { RhythmPrediction } from "../rhythm/predict";

const baseRhythm = (over: Partial<RhythmPrediction> = {}): RhythmPrediction => ({
  confidence: "high",
  daysObserved: 14,
  daysNeeded: 0,
  bands: [],
  frictionPeak: null,
  calmWindow: null,
  windDownHour: null,
  ...over,
});

// Build an epoch ms whose LOCAL hour is `h` (deterministic in the test TZ).
const at = (h: number) => new Date(2026, 5, 17, h, 0, 0).getTime();

describe("nextNudge (JITAI)", () => {
  it("fires a PREP nudge in the 2h window before a predicted friction peak", () => {
    const n = nextNudge({ nowMs: at(16), rhythm: baseRhythm({ frictionPeak: { hour: 17 } }), loggedToday: 1, recent7d: 5, childName: "Dylan" });
    expect(n?.kind).toBe("prep");
    expect(n?.action).toBe("coach");
  });

  it("does NOT fire PREP when the rhythm read is not yet dependable", () => {
    const n = nextNudge({ nowMs: at(16), rhythm: baseRhythm({ confidence: "low", frictionPeak: { hour: 17 } }), loggedToday: 2, recent7d: 5, childName: "Dylan" });
    expect(n?.kind).not.toBe("prep");
  });

  it("fires a CALM nudge at the wind-down hour", () => {
    const n = nextNudge({ nowMs: at(19), rhythm: baseRhythm({ windDownHour: 19 }), loggedToday: 2, recent7d: 5, childName: "Dylan" });
    expect(n?.kind).toBe("calm");
  });

  it("fires a LOG nudge in the afternoon when nothing is captured today", () => {
    const n = nextNudge({ nowMs: at(16), rhythm: baseRhythm({ confidence: "low" }), loggedToday: 0, recent7d: 4, childName: "Dylan" });
    expect(n?.kind).toBe("log");
    expect(n?.action).toBe("log");
  });

  it("fires a PRACTICE nudge during the day when weekly engagement is thin", () => {
    const n = nextNudge({ nowMs: at(10), rhythm: baseRhythm({ confidence: "none" }), loggedToday: 1, recent7d: 1, childName: "Dylan" });
    expect(n?.kind).toBe("practice");
  });

  it("stays QUIET when the day is captured and engagement is healthy", () => {
    const n = nextNudge({ nowMs: at(11), rhythm: baseRhythm({ confidence: "low" }), loggedToday: 2, recent7d: 6, childName: "Dylan" });
    expect(n).toBeNull();
  });
});
