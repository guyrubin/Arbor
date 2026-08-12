import { describe, it, expect } from "vitest";
import { recapWeekId, shouldAutoGenerateRecap, isRecapUnopened } from "./useWeeklyRecap";

/**
 * W2 2.1 — the hoisted weekly-recap generation logic (masterplan 2026-08-11
 * §4 item 2.1). Pure pieces only: week identity, the auto-generate decision
 * (new week vs same week vs day-0), and the "new recap waiting" gate that
 * drives the Since-strip entry line.
 */

describe("recapWeekId — stable week identity (WeeklyTab's historical algorithm)", () => {
  it("formats as YYYY-Wnn", () => {
    expect(recapWeekId(new Date(2026, 7, 11))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("two days inside the same week share one id (same report doc → upsert last-write-wins)", () => {
    // Tue 11 Aug 2026 and Wed 12 Aug 2026 sit mid-week, far from a boundary.
    expect(recapWeekId(new Date(2026, 7, 11))).toBe(recapWeekId(new Date(2026, 7, 12)));
  });

  it("seven days later is ALWAYS a new week id (the auto-generate trigger)", () => {
    expect(recapWeekId(new Date(2026, 7, 18))).not.toBe(recapWeekId(new Date(2026, 7, 11)));
  });

  it("year boundary produces distinct, year-prefixed ids", () => {
    const dec = recapWeekId(new Date(2026, 11, 28));
    const jan = recapWeekId(new Date(2027, 0, 5));
    expect(dec.startsWith("2026-W")).toBe(true);
    expect(jan.startsWith("2027-W")).toBe(true);
    expect(dec).not.toBe(jan);
  });
});

describe("shouldAutoGenerateRecap — first open of a new week, with data", () => {
  const base = {
    loaded: true,
    hasCurrentWeek: false,
    weekMomentCount: 3,
    alreadyTried: false,
    generating: false,
  };

  it("NEW WEEK: no report yet + logged moments + first attempt → generate", () => {
    expect(shouldAutoGenerateRecap(base)).toBe(true);
  });

  it("SAME WEEK: the report already exists → never regenerate automatically", () => {
    expect(shouldAutoGenerateRecap({ ...base, hasCurrentWeek: true })).toBe(false);
  });

  it("DAY-0: an empty week has nothing truthful to summarize → no generation", () => {
    expect(shouldAutoGenerateRecap({ ...base, weekMomentCount: 0 })).toBe(false);
  });

  it("waits for the collection to load (a not-yet-loaded list is not an absent report)", () => {
    expect(shouldAutoGenerateRecap({ ...base, loaded: false })).toBe(false);
  });

  it("one auto attempt per session (the module guard feeds alreadyTried)", () => {
    expect(shouldAutoGenerateRecap({ ...base, alreadyTried: true })).toBe(false);
  });

  it("never double-fires while a generation is in flight", () => {
    expect(shouldAutoGenerateRecap({ ...base, generating: true })).toBe(false);
  });
});

describe("isRecapUnopened — the Since-strip entry-line gate", () => {
  it("a fresh, never-opened weekly report reads as unopened", () => {
    expect(isRecapUnopened(true, "2026-W33", null)).toBe(true);
    expect(isRecapUnopened(true, "2026-W33", "2026-W32")).toBe(true);
  });

  it("opening this week's recap clears the line", () => {
    expect(isRecapUnopened(true, "2026-W33", "2026-W33")).toBe(false);
  });

  it("no report yet → nothing to announce", () => {
    expect(isRecapUnopened(false, "2026-W33", null)).toBe(false);
  });
});
