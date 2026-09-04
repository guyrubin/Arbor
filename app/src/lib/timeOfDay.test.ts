import { describe, it, expect } from "vitest";
import { bedtimeDoorOpen, dayPartFor } from "./timeOfDay";

describe("dayPartFor", () => {
  it("buckets early hours as morning", () => {
    expect(dayPartFor(0)).toBe("morning");
    expect(dayPartFor(11)).toBe("morning");
  });

  it("flips to afternoon at noon", () => {
    expect(dayPartFor(12)).toBe("afternoon");
    expect(dayPartFor(17)).toBe("afternoon");
  });

  it("flips to evening at 18:00", () => {
    expect(dayPartFor(18)).toBe("evening");
    expect(dayPartFor(23)).toBe("evening");
  });
});

/* ── ENG-10 — the evening door ───────────────────────────────────────────────
 * Before this, `dayPartFor` had ZERO production consumers (the app could name
 * an evening and never used the answer) and Bedtime Stories had no entry point
 * at the hour a parent wants it. `bedtimeDoorOpen` is that door, and it is why
 * `dayPartFor` is now load-bearing. */
describe("ENG-10 — bedtimeDoorOpen", () => {
  it("is OPEN across the whole evening day part, with or without a rhythm read", () => {
    for (let h = 18; h <= 23; h++) {
      expect(bedtimeDoorOpen(h), `${h}:00 with no wind-down`).toBe(true);
      expect(bedtimeDoorOpen(h, null), `${h}:00 with a null wind-down`).toBe(true);
      expect(bedtimeDoorOpen(h, 19), `${h}:00 with a wind-down`).toBe(true);
    }
  });

  it("is CLOSED all morning — including the 00:00–11:59 wrap, so last night's door cannot re-open", () => {
    for (let h = 0; h < 12; h++) {
      expect(bedtimeDoorOpen(h), `${h}:00`).toBe(false);
      // Not even a (nonsensical) early wind-down may prise it open before noon.
      expect(bedtimeDoorOpen(h, 6), `${h}:00 with windDown 6`).toBe(false);
    }
  });

  it("in the afternoon it opens ONLY from the family's own wind-down hour", () => {
    // No wind-down known → we never invent an early evening.
    for (let h = 12; h < 18; h++) expect(bedtimeDoorOpen(h, null), `${h}:00`).toBe(false);
    // Known wind-down at 17:00 → shut at 16, open from 17.
    expect(bedtimeDoorOpen(16, 17)).toBe(false);
    expect(bedtimeDoorOpen(17, 17)).toBe(true);
  });

  it("NEGATIVE CONTROL — a door keyed on the raw hour alone would answer differently", () => {
    // The pre-change shape people reach for first is `hour >= 18`. It agrees
    // in the evening and DISAGREES on both edges this predicate exists for:
    const naive = (h: number) => h >= 18;
    expect(naive(17)).toBe(false);
    expect(bedtimeDoorOpen(17, 17)).toBe(true);   // family wind-down honoured
    expect(naive(23)).toBe(true);
    expect(bedtimeDoorOpen(23, 17)).toBe(true);
    // and the two agree nowhere in the morning, which is the point of dayPartFor
    expect(dayPartFor(23)).toBe("evening");
    expect(dayPartFor(0)).toBe("morning");
  });
});
