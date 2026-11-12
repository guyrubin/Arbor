import { describe, expect, it } from "vitest";
import { clockOf, dayPart, hardWindowNow, routineForPart, selectRightNow, type HardWindow } from "./rightNowModel";
import type { RhythmCard, RhythmSlot } from "./togetherRhythm";

/* Local-time constructors, so minutes-of-day read the same in every CI zone. */
const at = (day: number, hour: number, minute: number) => new Date(2026, 10, day, hour, minute);
const hard = (day: number, hour: number, minute: number, intensity = 4) => ({ timestamp: at(day, hour, minute).toISOString(), intensity });

function card(slot: RhythmSlot, over: Partial<RhythmCard> = {}): RhythmCard {
  return { slot, complete: false, nextStep: "Wash face", nextIndex: 0, total: 3, done: [], nextIcon: null, nextUp: true, ...over } as unknown as RhythmCard;
}

describe("dayPart", () => {
  it("cuts the day at 05, 11, 15 and 19", () => {
    expect([4, 5, 10, 11, 14, 15, 18, 19, 23, 0].map(dayPart)).toEqual([
      "evening", "morning", "morning", "midday", "midday", "afternoon", "afternoon", "evening", "evening", "evening",
    ]);
  });
});

describe("routineForPart", () => {
  it("takes the first started routine of this part with a step still open", () => {
    const done = card("morning", { complete: true, nextStep: null });
    const open = card("morning", { nextStep: "Shoes on" });
    expect(routineForPart([done, open], "morning")).toBe(open);
  });

  it("puts the meal and tidy-up before dinner and bedtime in the evening", () => {
    const meal = card("evening");
    const bed = card("night");
    expect(routineForPart([meal], "afternoon")).toBe(meal);
    expect(routineForPart([bed], "evening")).toBe(bed);
    expect(routineForPart([bed], "afternoon")).toBeNull();
  });

  it("never offers an anytime routine or one without a next step", () => {
    expect(routineForPart([card("anytime")], "midday")).toBeNull();
    expect(routineForPart([card("midday", { nextStep: null })], "midday")).toBeNull();
  });
});

describe("hardWindowNow", () => {
  const now = at(12, 16, 30);

  it("names the earliest and latest of the moments near now, widened to five minutes", () => {
    const logs = [hard(11, 16, 47), hard(10, 17, 2), hard(9, 17, 18), hard(8, 9, 0)];
    expect(hardWindowNow(logs, now)).toEqual({ recent: 4, inWindow: 3, fromMinute: 16 * 60 + 45, toMinute: 17 * 60 + 20 });
  });

  it("stays silent below the rhythm evidence floor", () => {
    expect(hardWindowNow([hard(11, 16, 50), hard(10, 16, 55)], now)).toBeNull();
    // Three moments, one day: the floor needs three days.
    expect(hardWindowNow([hard(11, 16, 40), hard(11, 16, 50), hard(11, 17, 0)], now)).toBeNull();
  });

  it("needs a strict majority of the last four near this time", () => {
    const logs = [hard(11, 16, 50), hard(10, 17, 0), hard(9, 8, 0), hard(8, 8, 30)];
    expect(hardWindowNow(logs, now)).toBeNull();
  });

  it("reads only hard moments inside the window, never the future or a broken time", () => {
    const logs = [
      hard(11, 16, 50), hard(10, 17, 0), hard(9, 17, 10),
      hard(11, 16, 40, 3), // not a hard moment
      hard(13, 16, 45), // after now
      { timestamp: "not a date", intensity: 5 },
      { timestamp: at(12, 16, 0).getTime() - 30 * 86_400_000, intensity: 5 }, // outside 21 days
    ];
    expect(hardWindowNow(logs, now)).toEqual({ recent: 3, inWindow: 3, fromMinute: 16 * 60 + 50, toMinute: 17 * 60 + 10 });
  });

  it("gives a five-minute window when the moments share one clock time", () => {
    const logs = [hard(11, 16, 45), hard(10, 16, 45), hard(9, 16, 45)];
    expect(hardWindowNow(logs, now)).toMatchObject({ fromMinute: 16 * 60 + 45, toMinute: 16 * 60 + 50 });
  });
});

describe("clockOf", () => {
  it("writes minutes after midnight as a 24-hour clock", () => {
    expect(clockOf(16 * 60 + 45)).toBe("16:45");
    expect(clockOf(65)).toBe("01:05");
  });
});

describe("selectRightNow", () => {
  const window: HardWindow = { recent: 4, inWindow: 3, fromMinute: 1005, toMinute: 1040 };
  const routine = card("afternoon");
  const base = { hard: window, hardDoor: true, routine, visit: true, tonight: true };

  it("orders each part of the day", () => {
    expect(selectRightNow({ ...base, part: "morning" })?.kind).toBe("routine");
    expect(selectRightNow({ ...base, part: "midday" })?.kind).toBe("visit");
    expect(selectRightNow({ ...base, part: "afternoon" })?.kind).toBe("hard");
    expect(selectRightNow({ ...base, part: "evening" })?.kind).toBe("tonight");
  });

  it("falls through to the next state the record supports", () => {
    expect(selectRightNow({ ...base, part: "morning", routine: null })?.kind).toBe("hard");
    expect(selectRightNow({ ...base, part: "midday", visit: false })?.kind).toBe("hard");
    expect(selectRightNow({ ...base, part: "evening", tonight: false })?.kind).toBe("routine");
  });

  it("names a hard window only when the hard-moment sheet has a card, and never in the evening", () => {
    expect(selectRightNow({ ...base, part: "afternoon", hardDoor: false })?.kind).toBe("routine");
    expect(selectRightNow({ ...base, part: "evening", tonight: false, routine: null })).toBeNull();
  });

  it("draws nothing when the record has nothing for this part of the day", () => {
    expect(selectRightNow({ part: "afternoon", hard: null, hardDoor: true, routine: null, visit: true, tonight: true })).toBeNull();
  });
});
