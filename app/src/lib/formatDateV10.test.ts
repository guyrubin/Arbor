/**
 * v10 / canvas V77 date helpers: the boards' day-first form with a 24-hour clock.
 * Synthetic dates only.
 */
import { describe, expect, it } from "vitest";
import { fmtDay, fmtDayTimeV10, fmtDayV10, fmtTimeV10 } from "./formatDate";

const strip = (s: string) => s.replace(/[⁨⁩]/g, "");
const NOW = new Date("2026-11-16T17:40:00");

describe("v10 date helpers (the boards' form)", () => {
  it("en: weekday, day, short month, no year in the current year", () => {
    expect(fmtDayV10(new Date("2026-11-14T07:00:00"), "en", NOW)).toBe("Sat 14 Nov");
    expect(fmtDayTimeV10(new Date("2026-11-25T10:00:00"), "en", NOW)).toBe("Wed 25 Nov, 10:00");
    expect(fmtTimeV10(new Date("2026-11-16T17:40:00"), "en")).toBe("17:40");
  });

  it("he: Hebrew weekday and month, isolated, 24-hour clock", () => {
    const day = fmtDayV10(new Date("2026-11-14T07:00:00"), "he", NOW);
    expect(day.startsWith("⁨") && day.endsWith("⁩")).toBe(true);
    expect(strip(day)).toBe("שבת, 14 בנוב׳");
    expect(strip(fmtDayTimeV10(new Date("2026-11-25T10:00:00"), "he", NOW))).toBe("יום ד׳, 25 בנוב׳, 10:00");
  });

  it("adds the year only outside the current year", () => {
    expect(fmtDayV10(new Date("2025-11-14T07:00:00"), "en", NOW)).toBe("Fri 14 Nov 2025");
  });

  it("empty for missing or invalid input", () => {
    expect(fmtDayV10(null, "en", NOW)).toBe("");
    expect(fmtDayTimeV10("not a date", "en", NOW)).toBe("");
    expect(fmtTimeV10(undefined, "he")).toBe("");
  });

  it("NEGATIVE CONTROL: the legacy seam still renders the US form the boards replace", () => {
    expect(fmtDay(new Date("2026-11-25T10:00:00"), "en")).toBe("Nov 25, 2026");
    expect(fmtDayV10(new Date("2026-11-25T10:00:00"), "en", NOW)).not.toBe(fmtDay(new Date("2026-11-25T10:00:00"), "en"));
  });
});
