import { describe, expect, it } from "vitest";
import { fmtDayFirst } from "./formatDate";

const strip = (s: string) => s.replace(/[⁦-⁩]/g, "");
const NOW = new Date(2026, 10, 16, 12);

describe("fmtDayFirst (V77 day-first short date)", () => {
  it("prints the weekday, day and month this year", () => {
    expect(strip(fmtDayFirst(new Date(2026, 10, 14, 7), "en", NOW))).toBe("Sat 14 Nov");
  });
  it("prints day, month and year in another year, three-letter month", () => {
    expect(strip(fmtDayFirst(new Date(2023, 8, 16), "en", NOW))).toBe("16 Sep 2023");
  });
  it("Hebrew is day-first with the Hebrew month", () => {
    const s = strip(fmtDayFirst(new Date(2026, 10, 14, 7), "he", NOW));
    expect(s).toMatch(/14/);
    expect(s).toMatch(/נוב/);
    expect(s).not.toMatch(/Nov/);
  });
  it("negative control: never month-first", () => {
    expect(strip(fmtDayFirst(new Date(2026, 10, 14), "en", NOW))).not.toMatch(/^Nov/);
  });
  it("empty for missing input", () => {
    expect(fmtDayFirst(undefined as unknown as string, "en", NOW)).toBe("");
  });
});
