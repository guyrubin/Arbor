import { describe, expect, it } from "vitest";
import { scoreFaceMatch, matchToStars, blendshapesToMap, MIMIC_FACES } from "./faceMatch";

describe("scoreFaceMatch", () => {
  it("is 1 when every target channel is fully met or exceeded", () => {
    expect(scoreFaceMatch({ mouthSmileLeft: 0.6, mouthSmileRight: 0.9 }, { mouthSmileLeft: 0.55, mouthSmileRight: 0.55 })).toBe(1);
  });

  it("is 0 when channels are absent", () => {
    expect(scoreFaceMatch({}, { jawOpen: 0.5 })).toBe(0);
    expect(scoreFaceMatch({ mouthSmileLeft: 0.6 }, {})).toBe(0); // empty target
  });

  it("averages partial fills across channels", () => {
    // jawOpen 0.2/0.4 = 0.5; browInnerUp 0.4/0.4 = 1 → mean 0.75
    expect(scoreFaceMatch({ jawOpen: 0.2, browInnerUp: 0.4 }, { jawOpen: 0.4, browInnerUp: 0.4 })).toBeCloseTo(0.75, 5);
  });

  it("maps scores to stars at sensible thresholds", () => {
    expect(matchToStars(0.85)).toBe(3);
    expect(matchToStars(0.6)).toBe(2);
    expect(matchToStars(0.2)).toBe(1);
  });

  it("converts MediaPipe categories to a name→score map", () => {
    const map = blendshapesToMap([{ categoryName: "jawOpen", score: 0.7 }, { categoryName: "mouthPucker", score: 0.1 }]);
    expect(map.jawOpen).toBe(0.7);
    expect(scoreFaceMatch(map, MIMIC_FACES.find((f) => f.id === "open-wide")!.targets)).toBe(1);
  });

  it("clamps each channel to 1 so over-filling one cannot inflate the mean past 1", () => {
    // smileLeft hugely over target, smileRight absent → 1 + 0 averaged → 0.5, not >0.5
    expect(scoreFaceMatch({ mouthSmileLeft: 1 }, { mouthSmileLeft: 0.55, mouthSmileRight: 0.55 })).toBeCloseTo(0.5, 5);
  });

  it("scores a single partial channel as its fill ratio", () => {
    expect(scoreFaceMatch({ cheekPuff: 0.175 }, { cheekPuff: 0.35 })).toBeCloseTo(0.5, 5);
  });

  it("treats negative observed values as zero", () => {
    expect(scoreFaceMatch({ jawOpen: -0.3 }, { jawOpen: 0.5 })).toBe(0);
  });

  it("matchToStars covers the exact threshold boundaries", () => {
    expect(matchToStars(0.8)).toBe(3); // >= 0.8
    expect(matchToStars(0.79)).toBe(2);
    expect(matchToStars(0.5)).toBe(2); // >= 0.5
    expect(matchToStars(0.49)).toBe(1);
    expect(matchToStars(0)).toBe(1);
  });

  it("every MIMIC_FACES entry has a unique id and at least one positive target channel", () => {
    const ids = MIMIC_FACES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of MIMIC_FACES) {
      const vals = Object.values(f.targets);
      expect(vals.length).toBeGreaterThan(0);
      for (const v of vals) expect(v).toBeGreaterThan(0);
      // a face fully meeting all its own targets scores a perfect 1
      const observed: Record<string, number> = {};
      for (const k of Object.keys(f.targets)) observed[k] = f.targets[k];
      expect(scoreFaceMatch(observed, f.targets)).toBe(1);
    }
  });

  it("never targets tongueOut — face_landmarker.task does not estimate it, so it can never be met", () => {
    // Guard against re-adding a face that can never reach SUCCESS_AT and traps the child.
    for (const f of MIMIC_FACES) {
      expect(Object.keys(f.targets)).not.toContain("tongueOut");
    }
  });

  it("ignores observed channels that are not part of the target", () => {
    expect(scoreFaceMatch({ jawOpen: 0.5, browDownLeft: 0.9, mouthFrownRight: 0.8 }, { jawOpen: 0.5 })).toBe(1);
  });
});
