import { describe, expect, it } from "vitest";
import { weekRowEndText } from "./rowEnd";

/* N-Week-D's pill-row sentence, from the shown week (Sat 14 to Fri 20 Nov 2026). */
const days = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 14 + i).getTime());

describe("weekRowEndText", () => {
  it("EN: today by name and number, then the days still ahead as a range", () => {
    expect(weekRowEndText(days, 2, "en")).toBe("Today is Monday 16. Tuesday to Friday are still ahead.");
    expect(weekRowEndText(days, 5, "en")).toBe("Today is Thursday 19. Friday is still ahead.");
    expect(weekRowEndText(days, 6, "en")).toBe("Today is Friday 20. It’s the last day of the week.");
  });
  it("HE: the same sentence in Hebrew", () => {
    expect(weekRowEndText(days, 2, "he")).toBe("היום יום שני, 16. יום שלישי עד יום שישי עוד לפנינו.");
    expect(weekRowEndText(days, 6, "he")).toMatch(/האחרון של השבוע/);
  });
  it("negative control: a week without today (a past week) gives no text, so the shell keeps its day and time", () => {
    expect(weekRowEndText(days, 7, "en")).toBe("");
    expect(weekRowEndText(days, -1, "he")).toBe("");
  });
});
