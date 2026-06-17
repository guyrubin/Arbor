import { describe, expect, it } from "vitest";
import {
  PHONICS_LETTERS,
  READING_LINES,
  SIGHT_WORDS,
  TRACE_LETTERS,
  dist,
  evaluateTrace,
  isReadingStageAppropriate,
  readingStagesForAge,
  resamplePath,
  strokeToSvgPath,
  traceStars,
  type TracePoint,
} from "./literacy";

describe("readingStagesForAge", () => {
  it("offers only phonics to the youngest", () => {
    expect(readingStagesForAge(2)).toEqual(["phonics"]);
    expect(readingStagesForAge(3)).toEqual(["phonics"]);
  });
  it("adds sight words around 4, reading around 5+", () => {
    expect(readingStagesForAge(4)).toEqual(["phonics", "sight-words"]);
    expect(readingStagesForAge(5)).toEqual(["phonics", "sight-words", "reading"]);
    expect(readingStagesForAge(7)).toContain("reading");
  });
  it("isReadingStageAppropriate gates reading before it's typical", () => {
    expect(isReadingStageAppropriate("reading", 3)).toBe(false);
    expect(isReadingStageAppropriate("reading", 6)).toBe(true);
    expect(isReadingStageAppropriate("phonics", 2)).toBe(true);
  });
});

describe("content banks", () => {
  it("phonics teach the letter SOUND (phoneme), not the spelled-out letter name", () => {
    // The phoneme may equal the letter (e.g. T → /t/), but must never be the
    // spelled-out NAME of the letter ("ess", "tee", "pee", "see", …).
    const LETTER_NAMES: Record<string, string> = {
      s: "ess", a: "ay", t: "tee", p: "pee", i: "eye", n: "en", m: "em", d: "dee", o: "oh", c: "see",
    };
    for (const p of PHONICS_LETTERS) {
      expect(p.sound.toLowerCase()).not.toBe(LETTER_NAMES[p.id]);
      expect(p.keyword.length).toBeGreaterThan(1);
      expect(p.sound.length).toBeGreaterThan(0);
    }
  });
  it("have unique ids across each bank", () => {
    const uniq = (xs: { id: string }[]) => new Set(xs.map((x) => x.id)).size === xs.length;
    expect(uniq(PHONICS_LETTERS)).toBe(true);
    expect(uniq(SIGHT_WORDS)).toBe(true);
    expect(uniq(READING_LINES)).toBe(true);
    expect(uniq(TRACE_LETTERS)).toBe(true);
  });
});

describe("resamplePath", () => {
  it("returns the requested number of points along a straight line", () => {
    const pts = resamplePath([{ x: 0, y: 0 }, { x: 1, y: 0 }], 5);
    expect(pts).toHaveLength(5);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[4]).toEqual({ x: 1, y: 0 });
    // Midpoint should be ~0.5 on a uniform line.
    expect(pts[2].x).toBeCloseTo(0.5, 5);
  });
  it("keeps endpoints when resampling a multi-segment polyline", () => {
    const pts = resamplePath([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], 9);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 1, y: 1 });
  });
  it("degenerates gracefully on a zero-length path", () => {
    const same = [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }];
    expect(resamplePath(same, 6)).toEqual(same);
  });
});

describe("evaluateTrace", () => {
  const line: TracePoint[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }];

  it("passes a faithful trace along the guide", () => {
    const traced: TracePoint[] = Array.from({ length: 30 }, (_, i) => ({ x: i / 29, y: 0 }));
    const r = evaluateTrace(line, traced);
    expect(r.coverage).toBeGreaterThanOrEqual(0.99);
    expect(r.passed).toBe(true);
  });

  it("fails an empty or off-path trace", () => {
    expect(evaluateTrace(line, []).passed).toBe(false);
    const offPath: TracePoint[] = [{ x: 0.5, y: 0.9 }, { x: 0.6, y: 0.95 }];
    const r = evaluateTrace(line, offPath);
    expect(r.coverage).toBeLessThan(0.5);
    expect(r.passed).toBe(false);
  });

  it("requires checkpoints in order — a backwards scribble can't pass", () => {
    // Start at the END of the line then jump around: should not cover the start.
    const backwards: TracePoint[] = [{ x: 1, y: 0 }, { x: 0.9, y: 0 }, { x: 0.95, y: 0 }];
    const r = evaluateTrace(line, backwards);
    expect(r.passed).toBe(false);
  });

  it("reports a partial coverage for a half-done trace", () => {
    const half: TracePoint[] = Array.from({ length: 15 }, (_, i) => ({ x: (i / 14) * 0.5, y: 0 }));
    const r = evaluateTrace(line, half);
    expect(r.coverage).toBeGreaterThan(0.4);
    expect(r.coverage).toBeLessThan(0.75);
  });

  it("respects a custom tolerance", () => {
    const slightlyOff: TracePoint[] = Array.from({ length: 30 }, (_, i) => ({ x: i / 29, y: 0.1 }));
    expect(evaluateTrace(line, slightlyOff, 0.05).passed).toBe(false);
    expect(evaluateTrace(line, slightlyOff, 0.2).passed).toBe(true);
  });
});

describe("traceStars", () => {
  it("maps coverage to a 0–3 star band", () => {
    expect(traceStars(1)).toBe(3);
    expect(traceStars(0.95)).toBe(3);
    expect(traceStars(0.85)).toBe(2);
    expect(traceStars(0.6)).toBe(1);
    expect(traceStars(0.2)).toBe(0);
  });
});

describe("strokeToSvgPath", () => {
  it("builds an M/L path scaled to the box", () => {
    const d = strokeToSvgPath([{ x: 0, y: 0 }, { x: 1, y: 0.5 }], 100);
    expect(d).toBe("M 0.0 0.0 L 100.0 50.0");
  });
  it("returns empty for an empty stroke", () => {
    expect(strokeToSvgPath([], 100)).toBe("");
  });
});

describe("dist", () => {
  it("is the Euclidean distance", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
