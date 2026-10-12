/**
 * v3 F-FORYOU-1 (reviewer r1 minor) — the pick's lesson rows carry minutes.
 *
 * Pins the share-out the hub renders: whole minutes, at least one per lesson,
 * adding up to the course's own duration for every course in the catalogue; a
 * longer lesson never gets fewer minutes than a shorter one; deterministic.
 * Invented lessons plus the real catalogue — no child data.
 */
import { describe, expect, it } from "vitest";
import { MASTERCLASSES } from "../lib/masterclasses";
import { lessonMinutes } from "./lessonMinutes";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("lessonMinutes — the course's own minutes, shared out by lesson length", () => {
  it("every catalogue course: one figure per lesson, each at least one, adding up to durationMin", () => {
    expect(MASTERCLASSES.length).toBeGreaterThan(0);
    for (const m of MASTERCLASSES) {
      const mins = lessonMinutes(m.durationMin, m.sections.map((s) => s.body));
      expect(mins, m.id).toHaveLength(m.sections.length);
      for (const x of mins) {
        expect(Number.isInteger(x), m.id).toBe(true);
        expect(x, m.id).toBeGreaterThanOrEqual(1);
      }
      expect(mins.reduce((a, x) => a + x, 0), m.id).toBe(m.durationMin);
    }
  });

  it("a longer lesson never gets fewer minutes than a shorter one", () => {
    const bodies = [words(40), words(200), words(120), words(40)];
    const mins = lessonMinutes(12, bodies);
    expect(mins.reduce((a, x) => a + x, 0)).toBe(12);
    expect(mins[1]).toBeGreaterThanOrEqual(mins[2]);
    expect(mins[2]).toBeGreaterThanOrEqual(mins[0]);
    expect(mins[0]).toBe(mins[3]);
  });

  it("equal lessons share evenly; a remainder goes to the earlier lesson", () => {
    expect(lessonMinutes(8, [words(50), words(50), words(50), words(50)])).toEqual([2, 2, 2, 2]);
    expect(lessonMinutes(10, [words(50), words(50), words(50), words(50)])).toEqual([3, 3, 2, 2]);
  });

  it("edge cases: no lessons, fewer minutes than lessons, an empty body", () => {
    expect(lessonMinutes(10, [])).toEqual([]);
    expect(lessonMinutes(2, [words(10), words(10), words(10)])).toEqual([1, 1, 1]);
    const mins = lessonMinutes(5, ["", words(30)]);
    expect(mins).toHaveLength(2);
    expect(mins.reduce((a, x) => a + x, 0)).toBe(5);
    expect(Math.min(...mins)).toBeGreaterThanOrEqual(1);
  });

  it("deterministic: the same course gives the same figures", () => {
    const m = MASTERCLASSES[0];
    const bodies = m.sections.map((s) => s.body);
    expect(lessonMinutes(m.durationMin, bodies)).toEqual(lessonMinutes(m.durationMin, bodies));
  });
});
