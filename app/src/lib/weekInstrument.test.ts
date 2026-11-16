import { describe, expect, it } from "vitest";
import type { Observation } from "./observations";
import { hasClockTime, weekInstrument } from "./weekInstrument";

/* v10 Weekly report — the week instrument model. Invented records only. */

const DAY = 86_400_000;
const START = new Date(2026, 9, 10).getTime(); // a Saturday midnight, local
const dayStarts = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 10 + i).getTime());
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, 10 + day, hour, minute).toISOString();
const obs = (id: string, iso: string, extra: Partial<Observation> = {}) => ({
  id, childId: "c-invented", at: iso, domains: ["feelings"], kind: "moment",
  value: { type: "moment", behaviorType: "Moment" }, source: "parent_typed", origin: "behaviorLogs",
  ageAtObservationMonths: 40, pretermCorrected: false, ...extra,
}) as unknown as Observation;

describe("weekInstrument", () => {
  const observations = [
    obs("behaviorLogs:a", at(0, 7)),
    obs("behaviorLogs:b", at(0, 8)),
    obs("behaviorLogs:c", at(1, 18)),
    obs("behaviorLogs:d", "2026-10-11"), // date only: no clock time
    obs("behaviorLogs:e", at(1, 9), { source: "unverified" } as Partial<Observation>), // not the parent's: not counted
    obs("milestones:f", at(1, 10), { kind: "milestone" } as Partial<Observation>), // counted in its own chip, never here
  ];
  const actionLoop = [
    { id: "s1", outcome: "helped" as const, outcomeAt: at(0, 20) },
    { id: "s2", outcome: "not_today" as const, outcomeAt: at(1, 21) },
    { id: "s3", outcome: undefined, outcomeAt: undefined },
  ];
  const logs = [{ id: "a", intensity: 4 }, { id: "b" }];
  const now = new Date(2026, 9, 12, 15, 30).getTime(); // Monday 15:30
  const data = weekInstrument({ observations, actionLoop, logs, dayStarts, endMs: now, isCurrent: true,
    dates: [{ id: "v1", startMs: new Date(2026, 9, 14, 10).getTime(), label: "Speech therapist" }, { id: "v2", startMs: null, label: "x" }] });

  it("one token per parent moment, hard when the log carries an intensity; a date-only record sits in the lane", () => {
    expect(data.counts).toMatchObject({ moment: 3, hard: 1 });
    expect(data.timed.map((t) => [t.id, t.kind, t.day])).toEqual([
      ["behaviorLogs:a", "hard", 0], ["behaviorLogs:b", "moment", 0], ["behaviorLogs:c", "moment", 1],
    ]);
    expect(data.lane.filter((l) => l.kind === "moment")).toEqual([{ id: "behaviorLogs:d", kind: "moment", day: 1 }]);
  });

  it("the newest timed moment is the one marked latest", () => {
    expect(data.timed.filter((t) => t.latest).map((t) => t.id)).toEqual(["behaviorLogs:c"]);
  });

  it("steps never take a clock time: helped and not-this-time sit in the lane, by the day they were answered", () => {
    expect(data.counts).toMatchObject({ helped: 1, not: 1 });
    expect(data.lane.filter((l) => l.kind !== "moment")).toEqual([
      { id: "step:s1", kind: "helped", day: 0 }, { id: "step:s2", kind: "not", day: 1 },
    ]);
  });

  it("today, the days ahead, the clock now; dated visits inside the week only", () => {
    expect(data.days.map((d) => (d.isToday ? "T" : d.isAhead ? "A" : "-")).join("")).toBe("--TAAAA");
    expect(data.nowHour).toBeCloseTo(15.5);
    expect(data.dates).toEqual([{ id: "v1", day: 4, ms: new Date(2026, 9, 14, 10).getTime(), label: "Speech therapist" }]);
    expect(data.counts.date).toBe(1);
  });

  it("the hours widen to fit an early or late record, never narrower than 6 to 22", () => {
    expect(data.hours).toEqual({ from: 6, to: 22 });
    const late = weekInstrument({ observations: [obs("behaviorLogs:z", at(2, 23, 15)), obs("behaviorLogs:y", at(2, 4))], actionLoop: [], logs: [], dayStarts, endMs: START + 6 * DAY, isCurrent: false });
    expect(late.hours).toEqual({ from: 4, to: 24 });
  });

  it("a past week has no today, nothing ahead and no clock", () => {
    const past = weekInstrument({ observations, actionLoop, logs, dayStarts, endMs: START + 7 * DAY - 1, isCurrent: false });
    expect(past.days.some((d) => d.isToday || d.isAhead)).toBe(false);
    expect(past.nowHour).toBeNull();
  });

  it("hasClockTime tells a timestamp from a date", () => {
    expect(hasClockTime("2026-10-11")).toBe(false);
    expect(hasClockTime("2026-10-11T07:00:00.000Z")).toBe(true);
  });
});

describe("weekInstrument — the join of a hard moment to the step tried for it", () => {
  const hardLog = [{ id: "h1", intensity: 4 }];
  const hard = obs("behaviorLogs:h1", at(0, 7));
  it("pairs a day holding a timed hard moment and a step taken from the hard-moment sheet", () => {
    const data = weekInstrument({ observations: [hard], logs: hardLog, dayStarts, endMs: START + 7 * DAY - 1, isCurrent: false,
      actionLoop: [{ id: "s1", source: "hard-moment", outcome: "helped", outcomeAt: at(0, 9) }] });
    expect(data.joins).toEqual([{ day: 0, hardId: "behaviorLogs:h1" }]);
  });
  it("negative controls: a step from another source, or on another day, joins nothing", () => {
    const other = weekInstrument({ observations: [hard], logs: hardLog, dayStarts, endMs: START + 7 * DAY - 1, isCurrent: false,
      actionLoop: [{ id: "s1", source: "digest", outcome: "helped", outcomeAt: at(0, 9) }] });
    expect(other.joins).toEqual([]);
    const elsewhere = weekInstrument({ observations: [hard], logs: hardLog, dayStarts, endMs: START + 7 * DAY - 1, isCurrent: false,
      actionLoop: [{ id: "s1", source: "hard-moment", outcome: "helped", outcomeAt: at(2, 9) }] });
    expect(elsewhere.joins).toEqual([]);
  });
});
