import { describe, it, expect } from "vitest";
import { BEAT_ROUNDS, BEAT_SETS, PATTERN_PUZZLES, PATTERN_ROUNDS_PER_DAY, POSE_CARDS, POSE_ROUNDS_PER_SESSION, gradeStars, scoreBeatTaps, selectPatternSession, selectPoseSession } from "./newGames";

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

describe("expanded deterministic game banks", () => {
  it("keeps every original pattern ID while making eighteen unique, answerable puzzles reachable", () => {
    expect(PATTERN_PUZZLES).toHaveLength(18);
    expect(new Set(PATTERN_PUZZLES.map((p) => p.id)).size).toBe(PATTERN_PUZZLES.length);
    for (const id of ["p1", "p2", "p3", "p4", "p5", "p6"]) expect(PATTERN_PUZZLES.some((p) => p.id === id)).toBe(true);
    for (const puzzle of PATTERN_PUZZLES) expect(puzzle.options).toContain(puzzle.answer);
  });

  it("selects a stable, bounded and varied six-puzzle session", () => {
    const first = selectPatternSession("2026-09-22");
    expect(first).toHaveLength(PATTERN_ROUNDS_PER_DAY);
    expect(selectPatternSession("2026-09-22").map((p) => p.id)).toEqual(first.map((p) => p.id));
    expect(new Set(first.map((p) => p.id)).size).toBe(PATTERN_ROUNDS_PER_DAY);
    const sampled = new Set(["2026-09-22", "2026-09-23", "2026-09-24"].flatMap((seed) => selectPatternSession(seed).map((p) => p.id)));
    expect(sampled.size).toBeGreaterThan(PATTERN_ROUNDS_PER_DAY);
  });

  it("selects six stable pose cards from a twelve-card, adaptable bank", () => {
    expect(POSE_CARDS).toHaveLength(12);
    expect(new Set(POSE_CARDS.map((p) => p.id)).size).toBe(POSE_CARDS.length);
    expect(POSE_CARDS.every((p) => p.adaptedCue.length > 0 && p.adaptedCueHe.length > 0)).toBe(true);
    const session = selectPoseSession("2026-09-22");
    expect(session).toHaveLength(POSE_ROUNDS_PER_SESSION);
    expect(selectPoseSession("2026-09-22").map((p) => p.id)).toEqual(session.map((p) => p.id));
    expect(new Set(session.map((p) => p.id)).size).toBe(POSE_ROUNDS_PER_SESSION);
  });

  it("keeps the gentle legacy default while each named beat set has a distinct pace", () => {
    expect(BEAT_SETS.map((set) => set.id)).toEqual(["gentle-rain", "walking-parade", "star-signals"]);
    expect(BEAT_SETS[0].rounds).toBe(BEAT_ROUNDS);
    expect(BEAT_ROUNDS).toEqual([
      { beats: 6, intervalMs: 900 }, { beats: 8, intervalMs: 760 }, { beats: 8, intervalMs: 640 },
    ]);
    expect(BEAT_SETS[1].rounds).toEqual([
      { beats: 6, intervalMs: 800 }, { beats: 8, intervalMs: 800 }, { beats: 8, intervalMs: 800 },
    ]);
    expect(BEAT_SETS[2].rounds).toEqual([
      { beats: 4, intervalMs: 1200 }, { beats: 5, intervalMs: 1100 }, { beats: 6, intervalMs: 1000 },
    ]);
    const signatures = new Set(BEAT_SETS.map((set) => set.rounds.map((round) => `${round.beats}@${round.intervalMs}`).join("|")));
    expect(signatures.size).toBe(BEAT_SETS.length);
    for (const set of BEAT_SETS) {
      expect(set.rounds).toHaveLength(3);
      expect(set.label.en).not.toHaveLength(0);
      expect(set.label.he).not.toHaveLength(0);
    }
  });
});
