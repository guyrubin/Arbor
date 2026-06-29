import { describe, it, expect } from "vitest";
import { scoreBeatTaps, gradeStars, PATTERN_PUZZLES } from "./newGames";

describe("scoreBeatTaps", () => {
  it("scores perfectly-timed taps as 100", () => {
    const expected = [900, 1800, 2700];
    expect(scoreBeatTaps(expected, [900, 1800, 2700])).toBe(100);
  });

  it("returns 0 with no taps", () => {
    expect(scoreBeatTaps([900, 1800], [])).toBe(0);
  });

  it("gives partial credit for near-misses and none for way-off taps", () => {
    const expected = [1000, 2000];
    const near = scoreBeatTaps(expected, [1080, 2080]); // 80ms off, within tol
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(100);
    expect(scoreBeatTaps(expected, [5000, 6000])).toBe(0); // outside tolerance
  });

  it("does not let one tap claim two beats", () => {
    // A single tap can only score one beat, so 1 of 2 beats → at most ~50.
    expect(scoreBeatTaps([1000, 1010], [1005])).toBeLessThanOrEqual(50);
  });
});

describe("gradeStars", () => {
  it("maps scores to a kind 1–3 stars (never zero)", () => {
    expect(gradeStars(0)).toBe(1);
    expect(gradeStars(49)).toBe(1);
    expect(gradeStars(50)).toBe(2);
    expect(gradeStars(79)).toBe(2);
    expect(gradeStars(80)).toBe(3);
    expect(gradeStars(100)).toBe(3);
  });
});

describe("PATTERN_PUZZLES", () => {
  it("every puzzle includes its answer among the options", () => {
    for (const p of PATTERN_PUZZLES) {
      expect(p.options).toContain(p.answer);
    }
  });
});
