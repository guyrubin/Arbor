import { describe, it, expect } from "vitest";
import { computeStreak } from "./streak";

const DAY = 86_400_000;
// A fixed "now" on a clean UTC day boundary + a few hours, for deterministic days.
const NOW = 1_900_000 * DAY + 9 * 60 * 60 * 1000; // some day at 09:00 UTC
const dayAgo = (n: number) => NOW - n * DAY;

describe("computeStreak (V4)", () => {
  it("counts consecutive days ending today", () => {
    const r = computeStreak([dayAgo(0), dayAgo(1), dayAgo(2)], NOW);
    expect(r.current).toBe(3);
    expect(r.loggedToday).toBe(true);
    expect(r.totalDays).toBe(3);
  });

  it("applies a one-day grace: missing today does NOT reset the run", () => {
    const r = computeStreak([dayAgo(1), dayAgo(2), dayAgo(3)], NOW);
    expect(r.loggedToday).toBe(false);
    expect(r.current).toBe(3); // anchored at yesterday, no guilt
  });

  it("lapses quietly to 0 after a full missed day (no negative, no loss event)", () => {
    const r = computeStreak([dayAgo(2), dayAgo(3)], NOW);
    expect(r.current).toBe(0); // neither today nor yesterday → run is over
  });

  it("a gap breaks the consecutive run but keeps lifetime totalDays", () => {
    const r = computeStreak([dayAgo(0), dayAgo(1), dayAgo(4), dayAgo(5)], NOW);
    expect(r.current).toBe(2); // only today + yesterday are consecutive
    expect(r.totalDays).toBe(4);
  });

  it("dedupes multiple moments on the same day", () => {
    const r = computeStreak([dayAgo(0), dayAgo(0), dayAgo(0)], NOW);
    expect(r.current).toBe(1);
    expect(r.totalDays).toBe(1);
  });

  it("accepts ISO strings and ignores unparseable timestamps", () => {
    const iso = new Date(NOW).toISOString();
    const r = computeStreak([iso, "not-a-date"], NOW);
    expect(r.current).toBe(1);
    expect(r.totalDays).toBe(1);
  });

  it("empty history → zeroed result", () => {
    const r = computeStreak([], NOW);
    expect(r).toEqual({ current: 0, loggedToday: false, totalDays: 0 });
  });
});
