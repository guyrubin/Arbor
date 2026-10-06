import { describe, expect, it } from "vitest";
import type { SleepLogEntry } from "../types";
import {
  clockMinutes, diaryBaseline, longestStretchLine, longestStretchMinutes, nightHours, nightsInWeek, programWeekRange,
  recordRoutineTap, recordSleepDiaryNight, routineDoneInOrderCount, weekLongestStretch,
} from "./sleepDiary";

/**
 * B-PROG-06 — the sleep diary seam (pure). The counting rules of
 * PROGRAM-STEADY-NIGHTS-v0.1.md §"The three measures", pinned.
 */
const NOW = "2026-10-06T07:00:00.000Z";
const night = (date: string, bedtime: string, wake: string, wakings?: string[]): SleepLogEntry =>
  recordSleepDiaryNight(undefined, { date, bedtime, wake, wakings, now: NOW })!;

describe("B-PROG-06 — one night", () => {
  it("the longest stretch is the longest gap between consecutive diary times, across midnight", () => {
    expect(clockMinutes("19:30")).toBe(1170);
    expect(clockMinutes("7:30")).toBeNull();
    expect(longestStretchMinutes({ bedtime: "19:30", wake: "06:30" })).toBe(11 * 60);
    // 19:30 → 23:10 (3 h 40) → 02:00 (2 h 50) → 06:15 (4 h 15): the last gap is the longest
    expect(longestStretchMinutes({ bedtime: "19:30", wakings: ["23:10", "02:00"], wake: "06:15" })).toBe(255);
    expect(longestStretchMinutes({ bedtime: "19:30", wake: "19:30" })).toBeNull();
    expect(longestStretchMinutes({ bedtime: "19:30" })).toBeNull();
    expect(longestStretchMinutes({ bedtime: "19:30", wake: "25:00" })).toBeNull();
  });

  it("hours are rounded to the nearest half hour", () => {
    expect(nightHours(255)).toBe(4.5);
    expect(nightHours(460)).toBe(7.5);
    expect(nightHours(660)).toBe(11);
  });

  it("recordSleepDiaryNight computes longestStretchMinutes (never typed by the parent) and keeps the bedtime tap", () => {
    const tapped = recordRoutineTap(undefined, { date: "2026-10-06", answer: "done_in_order", now: "2026-10-06T18:40:00.000Z" });
    const entry = recordSleepDiaryNight(tapped, { date: "2026-10-06", bedtime: "19:30", wakings: ["02:00", " "], wake: "06:30", now: NOW })!;
    expect(entry).toEqual({
      date: "2026-10-06", routine: "done_in_order", routineAt: "2026-10-06T18:40:00.000Z",
      bedtime: "19:30", wake: "06:30", wakings: ["02:00"], longestStretchMinutes: 390, updatedAt: NOW,
    });
    expect(recordSleepDiaryNight(undefined, { date: "6 Oct", bedtime: "19:30", wake: "06:30", now: NOW })).toBeNull();
    expect(recordSleepDiaryNight(undefined, { date: "2026-10-06", bedtime: "x", wake: "06:30", now: NOW })).toBeNull();
  });

  it("recordRoutineTap: the last tap that night wins; the morning's times are kept", () => {
    const morning = night("2026-10-06", "20:00", "06:00");
    const first = recordRoutineTap(morning, { date: "2026-10-06", answer: "not_tonight", now: "a" });
    const last = recordRoutineTap(first, { date: "2026-10-06", answer: "done_in_order", now: "b", programId: "steady-nights" });
    expect(last.routine).toBe("done_in_order");
    expect(last.bedtime).toBe("20:00");
    expect(last.programId).toBe("steady-nights");
    expect(() => recordRoutineTap(undefined, { date: "tonight", answer: "done_in_order", now: "c" })).toThrow();
  });
});

describe("B-PROG-06 — one program week", () => {
  const range = programWeekRange("2026-10-05", 1);
  it("program week n = startedAt + 7(n−1) … startedAt + 7n − 1 (local dates)", () => {
    expect(range).toEqual({ from: "2026-10-05", to: "2026-10-11" });
    expect(programWeekRange("2026-10-05", 4)).toEqual({ from: "2026-10-26", to: "2026-11-01" });
  });

  it("parent proxy: nights tapped 'Done in order' (0–7); 'Not tonight' and no tap are not counted", () => {
    const entries: SleepLogEntry[] = [
      recordRoutineTap(undefined, { date: "2026-10-05", answer: "done_in_order", now: NOW }),
      recordRoutineTap(undefined, { date: "2026-10-06", answer: "not_tonight", now: NOW }),
      recordRoutineTap(undefined, { date: "2026-10-07", answer: "done_in_order", now: NOW }),
      night("2026-10-08", "20:00", "06:00"),
      recordRoutineTap(undefined, { date: "2026-10-12", answer: "done_in_order", now: NOW }), // week 2
    ];
    expect(routineDoneInOrderCount(entries, range)).toBe(2);
    expect(nightsInWeek(entries, range)).toHaveLength(4);
  });

  it("child proxy: the middle night (lower middle on an even count), with the number of nights it came from", () => {
    expect(weekLongestStretch([night("2026-10-05", "20:00", "06:00"), night("2026-10-06", "20:00", "03:00"), night("2026-10-07", "20:00", "05:00")]))
      .toEqual({ hours: 9, nights: 3 });
    expect(weekLongestStretch([night("2026-10-05", "20:00", "06:00"), night("2026-10-06", "20:00", "03:00")]))
      .toEqual({ hours: 7, nights: 2 });
    expect(weekLongestStretch([recordRoutineTap(undefined, { date: "2026-10-05", answer: "done_in_order", now: NOW })])).toBeNull();
  });

  it("baseline: the first week with at least three diary nights; null until then (no message)", () => {
    const w1 = [night("2026-10-05", "20:00", "05:00"), night("2026-10-06", "20:00", "04:30")];
    const w2 = [night("2026-10-12", "20:00", "05:00", ["01:00"]), night("2026-10-13", "20:00", "04:00"), night("2026-10-14", "20:00", "05:30")];
    expect(diaryBaseline([w1])).toBeNull();
    expect(diaryBaseline([w1, w2])).toEqual({ week: 2, hours: 8, nights: 3 });
  });

  it("the line: hours as a number, the nights it came from, the first diary week beside it — never a recommended number", () => {
    expect(longestStretchLine({ hours: 7.5, nights: 4 }, { hours: 6 }, "en")).toBe("7.5 hours · from 4 nights in your diary · 6 in your first diary week");
    expect(longestStretchLine({ hours: 7.5, nights: 1 }, null, "en")).toBe("7.5 hours · from 1 night in your diary");
    expect(longestStretchLine({ hours: 8, nights: 3 }, { hours: 6.5 }, "he")).toBe("8 שעות · מתוך 3 לילות ביומן שלכם · 6.5 בשבוע היומן הראשון שלכם");
    for (const lang of ["en", "he"] as const) {
      const line = longestStretchLine({ hours: 7.5, nights: 4 }, { hours: 6 }, lang);
      expect(line).not.toMatch(/recommend|should|goal|target|better|worse|more than|less than|↑|↓|%|ממליצים|צריך|יעד|מטרה|יותר טוב|פחות טוב/);
    }
  });
});
