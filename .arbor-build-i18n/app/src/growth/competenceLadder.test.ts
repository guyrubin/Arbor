import { describe, expect, it } from "vitest";
import {
  allowFadeAgain,
  bringGuidanceBack,
  type CompetenceLadderState,
  FADE_CAPABILITY_SIGNALS,
  INERT_ENGAGEMENT_SIGNALS,
  initialLadder,
  ladderView,
  type LadderSignal,
  recordSignal,
  STEP_DOWN_THRESHOLD,
  steppedBack,
} from "./competenceLadder";

/* CI-07 — the Competence Ladder must retire guidance on capability, reversibly
 * and never silently. These tests encode the advisor's guardrails: a silent,
 * irreversible, or engagement-triggered fade would invert the mechanic. */

function feed(state: CompetenceLadderState, signal: LadderSignal, n: number) {
  let s = state;
  for (let i = 0; i < n; i++) s = recordSignal(s, signal);
  return s;
}

describe("Competence Ladder", () => {
  it("starts at full guidance", () => {
    expect(initialLadder().level).toBe("full");
    expect(steppedBack(initialLadder())).toBe(false);
  });

  it("fades ONLY after enough real capability signals", () => {
    let s = feed(initialLadder(), "resolved-before-prompt", STEP_DOWN_THRESHOLD - 1);
    expect(s.level).toBe("full"); // not yet
    s = recordSignal(s, "resolved-before-prompt");
    expect(s.level).toBe("stepped-back"); // crossed the threshold
  });

  it("NEVER fades on any engagement signal (the load-bearing guardrail)", () => {
    for (const eng of INERT_ENGAGEMENT_SIGNALS) {
      const s = feed(initialLadder(), eng as LadderSignal, STEP_DOWN_THRESHOLD * 5);
      expect(s.level, eng).toBe("full");
      expect(s.consecutiveCapability, eng).toBe(0);
    }
  });

  it("steps guidance back UP the moment it's needed again (competence not assumed permanent)", () => {
    let s = feed(initialLadder(), "resolved-before-prompt", STEP_DOWN_THRESHOLD);
    expect(s.level).toBe("stepped-back");
    s = recordSignal(s, "needed-guidance");
    expect(s.level).toBe("full");
    expect(s.consecutiveCapability).toBe(0);
  });

  it("is REVERSIBLE + parent-visible: bringGuidanceBack restores full and pins", () => {
    let s = feed(initialLadder(), "resolved-before-prompt", STEP_DOWN_THRESHOLD * 2);
    expect(s.level).toBe("minimal");
    expect(ladderView(s).showBringBack).toBe(true); // never silent
    expect(ladderView(s).notice).toMatch(/bring guidance back/i);

    s = bringGuidanceBack(s);
    expect(s.level).toBe("full");
    expect(s.pinnedFull).toBe(true);
  });

  it("a pin prevents any silent re-fade until the parent clears it", () => {
    let s = bringGuidanceBack(initialLadder());
    s = feed(s, "resolved-before-prompt", STEP_DOWN_THRESHOLD * 3);
    expect(s.level).toBe("full"); // pinned → never auto-faded
    s = allowFadeAgain(s);
    s = feed(s, "resolved-before-prompt", STEP_DOWN_THRESHOLD);
    expect(s.level).toBe("stepped-back"); // fade resumes only after the parent allows it
  });

  it("never fades below minimal", () => {
    const s = feed(initialLadder(), "resolved-before-prompt", STEP_DOWN_THRESHOLD * 10);
    expect(s.level).toBe("minimal");
  });

  it("self-report-competent also fades; self-report-struggling restores — both override-able", () => {
    let s = feed(initialLadder(), "self-report-competent", STEP_DOWN_THRESHOLD);
    expect(s.level).toBe("stepped-back");
    s = recordSignal(s, "self-report-struggling");
    expect(s.level).toBe("full");
  });

  it("fade and engagement signal sets do not overlap", () => {
    const fade = new Set<string>(FADE_CAPABILITY_SIGNALS);
    for (const e of INERT_ENGAGEMENT_SIGNALS) {
      expect(fade.has(e), `${e} must never be a fade signal`).toBe(false);
    }
  });
});
