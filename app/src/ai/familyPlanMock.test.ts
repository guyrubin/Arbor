import { describe, expect, it } from "vitest";
import { mockDayOf, mockFamilyPlanItems, mockTimeOf } from "./familyPlanMock";
import { buildFamilyPlanExtractPrompt } from "./prompts";

const MON = new Date(2026, 10, 16); // Monday 16 Nov 2026

describe("the mock reader for family_plan_extract (sandbox only)", () => {
  it("reads weekdays, dates and times in EN and HE", () => {
    expect(mockDayOf("on Thursday at 10:00", MON)).toBe("2026-11-19");
    expect(mockDayOf("on 24 November", MON)).toBe("2026-11-24");
    expect(mockDayOf("עד 25/11", MON)).toBe("2026-11-25");
    expect(mockDayOf("ביום רביעי", MON)).toBe("2026-11-18");
    expect(mockDayOf("tomorrow", MON)).toBe("2026-11-17");
    expect(mockDayOf("bring a hat", MON)).toBe("");
    expect(mockTimeOf("at 9:15")).toBe("09:15");
  });

  it("answers the route's schema from the prompt's own numbered lines", () => {
    const prompt = buildFamilyPlanExtractPrompt({ today: "2026-11-16 (Monday)", lines: ["Hello", "Sports day is on Wednesday at 08:30.", "Children should bring a hat."], language: "en" });
    expect(mockFamilyPlanItems(prompt).items).toEqual([
      { line: 2, quote: "Sports day is on Wednesday at 08:30.", kind: "event", title: "Sports day", date: "2026-11-18", time: "08:30" },
      { line: 3, quote: "Children should bring a hat.", kind: "note", title: "Children should bring a hat", date: "", time: "" },
    ]);
  });
});
