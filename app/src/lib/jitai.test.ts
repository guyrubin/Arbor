import { describe, it, expect } from "vitest";
import { nextNudge, NUDGE_KIND_PREF } from "./jitai";
import { ROUTE_IDS } from "./routes";
import { DEFAULT_PREFS, type JitaiPrefs } from "../growth/jitaiPrefs";
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

const prefs = (over: Partial<JitaiPrefs> = {}): JitaiPrefs => ({
  ...DEFAULT_PREFS,
  types: { ...DEFAULT_PREFS.types, ...(over.types ?? {}) },
  ...over,
});

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

  it("fires a CALM nudge at the wind-down hour → the parent-run Routines library (ENG-01)", () => {
    const n = nextNudge({ nowMs: at(19), rhythm: baseRhythm({ windDownHour: 19 }), loggedToday: 2, recent7d: 5, childName: "Dylan" });
    expect(n?.kind).toBe("calm");
    expect(n?.action).toBe("routines");
  });

  it("fires a LOG nudge in the afternoon when nothing is captured today → Today + text capture (ENG-01)", () => {
    const n = nextNudge({ nowMs: at(16), rhythm: baseRhythm({ confidence: "low" }), loggedToday: 0, recent7d: 4, childName: "Dylan" });
    expect(n?.kind).toBe("log");
    // Was the phantom "log" route (Shell error boundary). Now a real route
    // plus the capture request the landing surface consumes.
    expect(n?.action).toBe("overview");
    expect(n?.capture).toBe("text");
  });

  it("fires a PRACTICE nudge during the day when weekly engagement is thin → Daily Play, not the kid Practice hub (ENG-01)", () => {
    const n = nextNudge({ nowMs: at(10), rhythm: baseRhythm({ confidence: "none" }), loggedToday: 1, recent7d: 1, childName: "Dylan" });
    expect(n?.kind).toBe("practice");
    expect(n?.action).toBe("daily-play");
  });

  it("stays QUIET when the day is captured and engagement is healthy", () => {
    const n = nextNudge({ nowMs: at(11), rhythm: baseRhythm({ confidence: "low" }), loggedToday: 2, recent7d: 6, childName: "Dylan" });
    expect(n).toBeNull();
  });
});

/* ── ENG-01 guard — every action over a 24h sweep is a registered route ───── */
describe("ENG-01 — Nudge.action is always a registered route id", () => {
  const scenarios: Array<Omit<Parameters<typeof nextNudge>[0], "nowMs">> = [
    { rhythm: baseRhythm({ frictionPeak: { hour: 17 }, windDownHour: 19 }), loggedToday: 0, recent7d: 1, childName: "Dylan" },
    { rhythm: baseRhythm({ confidence: "low" }), loggedToday: 0, recent7d: 4, childName: "Dylan" },
    { rhythm: baseRhythm({ confidence: "none" }), loggedToday: 1, recent7d: 1, childName: "Dylan" },
    { rhythm: baseRhythm({ windDownHour: 20 }), loggedToday: 3, recent7d: 9, childName: "Dylan" },
  ];

  it("NEGATIVE CONTROL — the old pseudo-actions are NOT routes", () => {
    const routes = new Set<string>(ROUTE_IDS);
    expect(routes.has("log")).toBe(false);
  });

  it("24h sweep × scenarios: action ∈ ROUTE_IDS, capture only on the LOG cue", () => {
    const routes = new Set<string>(ROUTE_IDS);
    let produced = 0;
    for (const s of scenarios) {
      for (let h = 0; h < 24; h++) {
        const n = nextNudge({ ...s, nowMs: at(h) });
        if (!n) continue;
        produced++;
        expect(routes.has(n.action), `${n.kind} at ${h}:00 → ${n.action}`).toBe(true);
        if (n.capture) expect(n.kind).toBe("log");
        // Kid-register drill surfaces never receive a parent cue.
        expect(["practice", "feelings", "speech", "mimic"]).not.toContain(n.action);
      }
    }
    expect(produced).toBeGreaterThan(20);
  });
});

/* ── TJB-03 / ENG-02 — the parent's Smart Reminders prefs are enforced ────── */
describe("TJB-03 — nextNudge honours the parent's preferences", () => {
  const logConditions = { rhythm: baseRhythm({ confidence: "low" }), loggedToday: 0, recent7d: 4, childName: "Dylan" };

  it("NEGATIVE CONTROL — without prefs the same inputs DO fire (the gate is the prefs, not the inputs)", () => {
    expect(nextNudge({ ...logConditions, nowMs: at(22) })).not.toBeNull();
  });

  it("quiet hours (21–08) → null at 22:00, 00:00 and 07:00; fires again at 16:00", () => {
    const p = prefs({ quietStart: 21, quietEnd: 8 });
    expect(nextNudge({ ...logConditions, nowMs: at(22) }, p)).toBeNull();
    expect(nextNudge({ ...logConditions, nowMs: at(0) }, p)).toBeNull();
    expect(nextNudge({ ...logConditions, nowMs: at(7) }, p)).toBeNull();
    expect(nextNudge({ ...logConditions, nowMs: at(16) }, p)?.kind).toBe("log");
  });

  it("a disabled kind is skipped and the NEXT kind is considered (guidance off → prep skipped → log)", () => {
    const inp = { nowMs: at(16), rhythm: baseRhythm({ frictionPeak: { hour: 17 } }), loggedToday: 0, recent7d: 5, childName: "Dylan" };
    expect(nextNudge(inp, prefs())?.kind).toBe("prep");
    expect(nextNudge(inp, prefs({ types: { guidance: false, milestone: true, weekly: true } }))?.kind).toBe("log");
    expect(NUDGE_KIND_PREF.prep).toBe("guidance");
    expect(NUDGE_KIND_PREF.calm).toBe("guidance");
  });

  it("max-2 contract: the THIRD distinct nudge of the day is null; an already-shown kind keeps its slot", () => {
    const inp = { ...logConditions, nowMs: at(16) };
    expect(nextNudge({ ...inp, shownToday: [] }, prefs())?.kind).toBe("log");
    expect(nextNudge({ ...inp, shownToday: ["prep"] }, prefs())?.kind).toBe("log");
    expect(nextNudge({ ...inp, shownToday: ["prep", "calm"] }, prefs())).toBeNull();
    // The kind already counted today is not a third nudge.
    expect(nextNudge({ ...inp, shownToday: ["prep", "log"] }, prefs())?.kind).toBe("log");
    // The ceiling holds even without prefs — it is the engine's contract.
    expect(nextNudge({ ...inp, shownToday: ["prep", "calm"] })).toBeNull();
  });

  it("calmWindowOnly routes cues into the identified calm window", () => {
    const rhythm = baseRhythm({ confidence: "low", calmWindow: { startHour: 9, endHour: 11 } });
    const p = prefs({ calmWindowOnly: true });
    // 16:00 is outside 9–11 → silent; inside the window the PRACTICE cue may fire.
    expect(nextNudge({ nowMs: at(16), rhythm, loggedToday: 0, recent7d: 4, childName: "Dylan" }, p)).toBeNull();
    expect(nextNudge({ nowMs: at(10), rhythm, loggedToday: 1, recent7d: 1, childName: "Dylan" }, p)?.kind).toBe("practice");
    // No calm window identified yet → nothing to route by, the cue is not blocked.
    expect(nextNudge({ nowMs: at(16), rhythm: baseRhythm({ confidence: "low" }), loggedToday: 0, recent7d: 4, childName: "Dylan" }, p)?.kind).toBe("log");
  });
});
