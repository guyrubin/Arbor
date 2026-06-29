import { describe, it, expect } from "vitest";
import { predictRhythm, hourLabel, type RhythmEvent } from "./predict";

const NOW = new Date("2026-06-15T12:00:00").getTime();
const DAY = 86_400_000;

/** Build an event at `daysAgo` days before NOW, at a given local hour. */
function ev(daysAgo: number, hour: number, intensity: number): RhythmEvent {
  const d = new Date(NOW - daysAgo * DAY);
  d.setHours(hour, 0, 0, 0);
  return { timestamp: d.toISOString(), intensity };
}

describe("predictRhythm", () => {
  it("returns a 'none' read with no events and asks for the full min-days", () => {
    const r = predictRhythm([], NOW, { minDays: 7 });
    expect(r.confidence).toBe("none");
    expect(r.daysObserved).toBe(0);
    expect(r.daysNeeded).toBe(7);
    expect(r.frictionPeak).toBeNull();
    expect(r.windDownHour).toBeNull();
  });

  it("stays low-confidence and asserts no peak until min-days of coverage", () => {
    // Hard moments across 3 distinct (fully past) days.
    const events = [ev(1, 17, 5), ev(2, 17, 5), ev(3, 17, 4)];
    const r = predictRhythm(events, NOW, { minDays: 7 });
    expect(r.confidence).toBe("low");
    expect(r.daysObserved).toBe(3);
    expect(r.daysNeeded).toBe(4);
    expect(r.frictionPeak).toBeNull(); // honest: not enough coverage to claim a peak
    expect(r.windDownHour).not.toBeNull(); // but the age prior is allowed
  });

  it("identifies the recurring 5pm friction peak once coverage is sufficient", () => {
    const events: RhythmEvent[] = [];
    for (let d = 0; d < 10; d++) events.push(ev(d, 17, 5)); // every day at 5pm, intense
    for (let d = 0; d < 10; d += 2) events.push(ev(d, 10, 4)); // some milder mid-morning
    const r = predictRhythm(events, NOW, { minDays: 7, windowDays: 21 });
    expect(["medium", "high"]).toContain(r.confidence);
    expect(r.frictionPeak?.hour).toBe(17);
    const band5pm = r.bands.find((b) => b.hour === 17);
    expect(band5pm?.tone).toBe("friction");
  });

  it("derives the wind-down hour just before an evening friction cluster", () => {
    const events: RhythmEvent[] = [];
    for (let d = 0; d < 12; d++) events.push(ev(d, 19, 5)); // 7pm meltdowns
    const r = predictRhythm(events, NOW, { minDays: 7 });
    expect(r.windDownHour).toBe(18); // one hour before the 7pm cluster
  });

  it("only learns from events inside the trailing window", () => {
    const stale = ev(40, 17, 5); // outside a 21-day window
    const r = predictRhythm([stale], NOW, { windowDays: 21 });
    expect(r.daysObserved).toBe(0);
    expect(r.confidence).toBe("none");
  });

  it("ignores low-intensity moments when scoring friction", () => {
    const events: RhythmEvent[] = [];
    for (let d = 0; d < 10; d++) events.push(ev(d, 15, 2)); // calm 3pm logs
    const r = predictRhythm(events, NOW, { minDays: 7 });
    expect(r.frictionPeak).toBeNull();
    expect(r.bands.every((b) => b.tone === "calm")).toBe(true);
  });

  it("accepts epoch-ms timestamps as well as ISO strings", () => {
    const events: RhythmEvent[] = [];
    for (let d = 0; d < 8; d++) {
      const dt = new Date(NOW - d * DAY); dt.setHours(17, 0, 0, 0);
      events.push({ timestamp: dt.getTime(), intensity: 5 });
    }
    const r = predictRhythm(events, NOW, { minDays: 7 });
    expect(r.frictionPeak?.hour).toBe(17);
  });
});

describe("hourLabel", () => {
  it("formats 12h am/pm labels", () => {
    expect(hourLabel(0)).toBe("12am");
    expect(hourLabel(9)).toBe("9am");
    expect(hourLabel(12)).toBe("12pm");
    expect(hourLabel(17)).toBe("5pm");
    expect(hourLabel(23)).toBe("11pm");
  });
});
