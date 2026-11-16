import { describe, expect, it } from "vitest";
import { dayField, dayPartOf } from "./dayField";

/* v10 Your day at a glance — the day field. Invented logs only. */

describe("dayField", () => {
  const now = new Date(2026, 10, 16, 18, 0).getTime();
  const log = (d: number, h: number, intensity?: number) => ({ timestamp: new Date(2026, 10, d, h).toISOString(), ...(intensity ? { intensity } : {}) });

  it("parts of the day: morning 6–12, afternoon 12–17, evening 17–21, night 21–6", () => {
    expect([5, 6, 11, 12, 16, 17, 20, 21, 23].map(dayPartOf)).toEqual(["night", "morning", "morning", "afternoon", "afternoon", "evening", "evening", "night", "night"]);
  });

  it("counts by weekday and part; a hard moment is the log with an intensity; outside the window is left out", () => {
    const f = dayField([log(15, 18), log(15, 19, 4), log(14, 8), { timestamp: new Date(2026, 9, 20, 9).toISOString() } /* > 21 days back */, log(16, 23) /* future */], now);
    expect(f.total).toBe(3);
    expect(f.cells.evening[0]).toEqual({ moment: 1, hard: 1 }); // Sunday 15 Nov
    expect(f.cells.morning[6]).toEqual({ moment: 1, hard: 0 }); // Saturday 14 Nov
    expect(f.totals).toEqual({ morning: 1, afternoon: 0, evening: 2, night: 0 });
    expect(f.busiest).toBe("evening");
    expect(f.sinceMs).toBe(new Date(2026, 10, 14, 8).getTime());
  });

  it("nothing logged: no busiest part, no since date", () => {
    const f = dayField([], now);
    expect(f).toMatchObject({ total: 0, busiest: null, sinceMs: null });
  });
});
