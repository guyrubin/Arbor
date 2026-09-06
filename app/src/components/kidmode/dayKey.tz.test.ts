/**
 * dayKey.tz.test.ts — OBJ-KID-01 + OBJ-TODAY-03 guard.
 *
 * The ledgers store ISO-UTC timestamps; a child experiences a game on their
 * LOCAL calendar day. Two seams derived a day key from the UTC string while the
 * surfaces around them read the local clock:
 *
 *   kidGreeting.ts   `ts.slice(0,10) === yesterday`   → nine minutes after
 *     playing Pattern Power (22:26 Z / 00:35 local) the kid home read
 *     "You played Pattern Power yesterday".
 *   actionLoop/model.ts `toISOString().slice(0,10)`   → an accepted step
 *     belonged to "yesterday" until 02:00/03:00 local, so the carry-over strip
 *     never rendered.
 *
 * Both now derive the key with `dayKey` (practice/signals.ts:63) — the same
 * local helper `usePracticeData` uses for `today`. This file pins the two
 * offsets Arbor actually ships to (Europe/Brussels = CEST +2, Asia/Jerusalem =
 * IDT +3) and carries the pre-fix predicate as an executable negative control.
 *
 * Node re-reads `process.env.TZ` on every date operation, so the cases below
 * really run under the named zone (asserted first, so a runtime that ignores
 * the variable fails loudly instead of passing vacuously).
 */
import { describe, expect, it, afterAll } from "vitest";
import { dayKey } from "../../practice/signals";
import { lastPlayedWorldYesterday, dayBefore, type GreetingLedgers } from "./kidGreeting";
import { todayActionId } from "../../actionLoop/model";

const ORIGINAL_TZ = process.env.TZ;
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

const withTZ = <T>(tz: string, fn: () => T): T => {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    process.env.TZ = prev;
  }
};

/** Empty ledgers plus the practice events the case needs. */
const ledgers = (events: GreetingLedgers["events"]): GreetingLedgers => ({
  speech: [],
  mimic: [],
  adventures: [],
  events,
});

/** Tonight's play: 22:30 Z on 6 Sep = 00:30 (CEST) / 01:30 (IDT) on 7 Sep. */
const TONIGHT = "2026-09-06T22:30:00Z";
/** Genuinely yesterday: 22:30 Z on 5 Sep = after midnight on 6 Sep, both zones. */
const LAST_NIGHT = "2026-09-05T22:30:00Z";
const PATTERN = ledgers([{ timestamp: TONIGHT, kind: "pattern" }]);

const ZONES = ["Europe/Brussels", "Asia/Jerusalem"] as const;

describe("the test harness really switches zone", () => {
  it.each(ZONES)("%s puts a 22:30 Z timestamp on the NEXT local day", (tz) => {
    expect(withTZ(tz, () => dayKey(new Date(TONIGHT)))).toBe("2026-09-07");
  });
});

describe("OBJ-KID-01 — the kid greeting reads local days", () => {
  it.each(ZONES)("%s: a game played tonight is not 'yesterday'", (tz) => {
    // Local 7 Sep 00:35 — the moment the bug was observed.
    expect(withTZ(tz, () => lastPlayedWorldYesterday(PATTERN, "2026-09-07"))).toBeNull();
  });

  it.each(ZONES)("%s: a game played last night IS yesterday (the feature still works)", (tz) => {
    const l = ledgers([{ timestamp: LAST_NIGHT, kind: "pattern" }]);
    expect(withTZ(tz, () => lastPlayedWorldYesterday(l, "2026-09-07"))).toBe("pattern-power");
  });

  it("negative control — the pre-fix UTC slice calls tonight's play 'yesterday'", () => {
    withTZ("Europe/Brussels", () => {
      const yesterday = dayBefore("2026-09-07");
      const preFixOnDay = (ts: string) => ts.slice(0, 10) === yesterday;
      // The old predicate matched (that is the bug); the shipped one does not.
      expect(preFixOnDay(TONIGHT)).toBe(true);
      expect(dayKey(new Date(TONIGHT)) === yesterday).toBe(false);
    });
  });
});

describe("OBJ-TODAY-03 — todayActionId is a local day key", () => {
  it.each(ZONES)("%s: 00:35 local on 7 Sep belongs to 2026-09-07", (tz) => {
    expect(withTZ(tz, () => todayActionId("dylan-demo", new Date(TONIGHT)))).toBe(
      "today.dylan-demo.2026-09-07",
    );
  });

  it("negative control — the pre-fix UTC slice files it under 6 Sep", () => {
    expect(new Date(TONIGHT).toISOString().slice(0, 10)).toBe("2026-09-06");
  });

  it("mid-day ids are unchanged (no drift for the ordinary case)", () => {
    expect(withTZ("Europe/Brussels", () => todayActionId("child-1", new Date("2026-07-22T18:00:00Z")))).toBe(
      "today.child-1.2026-07-22",
    );
  });
});
