/**
 * retention.test.ts — ENG-22 exit criterion clause 1: D1/D7/D30 is computable.
 *
 * These are BEHAVIOUR tests over the pure module, not source scans. Before
 * lib/retention.ts existed there was no code anywhere in the repo that turned
 * events into a day-grain rollup or a cohort answer, so every case below fails
 * by module-not-found without the change.
 *
 * The honesty cases matter as much as the arithmetic:
 *  - a user too young to answer D7 is NOT a D7 miss (null, not false);
 *  - an empty denominator yields rate === null, never 0;
 *  - a late-syncing device may only move `firstSeen` EARLIER.
 */
import { describe, it, expect } from "vitest";
import {
  RETENTION_ACTIVITY_EVENTS,
  RETENTION_DAYS,
  activeDayOffsets,
  buildRollup,
  cohortRetention,
  dayIndex,
  dayKeyOf,
  eligibleForDay,
  mergeRollup,
  retentionFlags,
  returnedOnDay,
  type ActivityEvent,
  type RetentionRollup,
} from "./retention";

const at = (iso: string) => new Date(iso).toISOString();

describe("day keys", () => {
  it("bins an instant into a YYYY-MM-DD key in UTC by default", () => {
    expect(dayKeyOf("2026-09-04T09:15:00Z")).toBe("2026-09-04");
  });

  it("respects the family's own day boundary: 23:30 local is TODAY, not tomorrow", () => {
    // 20:30Z with a +180 offset is 23:30 local on the 4th.
    expect(dayKeyOf("2026-09-04T20:30:00Z", 180)).toBe("2026-09-04");
    // The same instant read as UTC is still the 4th; one hour later it rolls.
    expect(dayKeyOf("2026-09-04T21:30:00Z", 180)).toBe("2026-09-05");
  });

  it("returns null for an unparseable timestamp instead of a bogus day", () => {
    expect(dayKeyOf("not-a-date")).toBeNull();
    expect(dayIndex("2026-09-01", "nonsense")).toBeNull();
  });

  it("counts whole days between two keys, month boundary included", () => {
    expect(dayIndex("2026-08-30", "2026-09-06")).toBe(7);
    expect(dayIndex("2026-09-04", "2026-09-04")).toBe(0);
  });
});

describe("rollup construction", () => {
  const events: ActivityEvent[] = [
    { event: "session_open", at: at("2026-09-01T08:00:00Z") },
    { event: "view_tab", at: at("2026-09-02T08:00:00Z") }, // not an activity event
    { event: "capture_saved", at: at("2026-09-01T19:00:00Z") }, // same day, deduped
    { event: "session_open", at: at("2026-09-08T08:00:00Z") },
    { event: "bell_open", at: "not-a-date" }, // dropped, never crashes
  ];

  it("folds events into distinct sorted day keys with the earliest as firstSeen", () => {
    const rollup = buildRollup(events);
    expect(rollup).toEqual({ firstSeen: "2026-09-01", activeDays: ["2026-09-01", "2026-09-08"] });
  });

  it("returns null (not a zeroed record) when no event qualifies", () => {
    expect(buildRollup([{ event: "view_tab", at: at("2026-09-01T08:00:00Z") }])).toBeNull();
    expect(buildRollup([])).toBeNull();
  });

  it("only counts the allow-listed activity events", () => {
    for (const name of RETENTION_ACTIVITY_EVENTS) {
      expect(buildRollup([{ event: name, at: at("2026-09-01T08:00:00Z") }])).not.toBeNull();
    }
    // Negative control: a plausible-looking neighbour must NOT count.
    expect(buildRollup([{ event: "session_opened", at: at("2026-09-01T08:00:00Z") }])).toBeNull();
  });
});

describe("merge (upsert semantics)", () => {
  const stored: RetentionRollup = { firstSeen: "2026-09-01", activeDays: ["2026-09-01", "2026-09-02"] };

  it("unions active days and never mutates its inputs", () => {
    const incoming: RetentionRollup = { firstSeen: "2026-09-02", activeDays: ["2026-09-02", "2026-09-08"] };
    const merged = mergeRollup(stored, incoming);
    expect(merged).toEqual({
      firstSeen: "2026-09-01",
      activeDays: ["2026-09-01", "2026-09-02", "2026-09-08"],
    });
    expect(stored.activeDays).toEqual(["2026-09-01", "2026-09-02"]);
  });

  it("moves firstSeen EARLIER but never later — a late sync cannot reset a cohort", () => {
    const older: RetentionRollup = { firstSeen: "2026-08-20", activeDays: ["2026-08-20"] };
    expect(mergeRollup(stored, older)?.firstSeen).toBe("2026-08-20");
    const newer: RetentionRollup = { firstSeen: "2026-09-30", activeDays: ["2026-09-30"] };
    expect(mergeRollup(stored, newer)?.firstSeen).toBe("2026-09-01");
  });

  it("handles either side being absent", () => {
    expect(mergeRollup(null, stored)).toEqual(stored);
    expect(mergeRollup(stored, null)).toEqual(stored);
    expect(mergeRollup(null, null)).toBeNull();
  });
});

describe("per-user D1/D7/D30", () => {
  // Active on day 0, day 1 and day 7 — the classic returning first-week parent.
  const rollup: RetentionRollup = {
    firstSeen: "2026-09-01",
    activeDays: ["2026-09-01", "2026-09-02", "2026-09-08"],
  };

  it("reads day offsets from firstSeen", () => {
    expect(activeDayOffsets(rollup)).toEqual([0, 1, 7]);
  });

  it("answers returnedOnDay for exact offsets", () => {
    expect(returnedOnDay(rollup, 1)).toBe(true);
    expect(returnedOnDay(rollup, 7)).toBe(true);
    expect(returnedOnDay(rollup, 30)).toBe(false);
  });

  it("D30 is NOT a miss for a user who is only 8 days old — it is unanswerable", () => {
    const flags = retentionFlags(rollup, "2026-09-09");
    expect(flags.d1).toBe(true);
    expect(flags.d7).toBe(true);
    expect(flags.d30).toBeNull(); // null, never false
    expect(eligibleForDay(rollup, 30, "2026-09-09")).toBe(false);
  });

  it("D30 becomes a real (false) answer once the cohort is old enough", () => {
    const flags = retentionFlags(rollup, "2026-10-05");
    expect(flags.d30).toBe(false);
  });

  it("reports exactly the three product offsets", () => {
    expect([...RETENTION_DAYS]).toEqual([1, 7, 30]);
    expect(Object.keys(retentionFlags(rollup, "2026-10-05")).sort()).toEqual(["d1", "d30", "d7"]);
  });
});

describe("cohort report", () => {
  const returner: RetentionRollup = { firstSeen: "2026-09-01", activeDays: ["2026-09-01", "2026-09-02"] };
  const lapsed: RetentionRollup = { firstSeen: "2026-09-01", activeDays: ["2026-09-01"] };
  const newborn: RetentionRollup = { firstSeen: "2026-09-09", activeDays: ["2026-09-09"] };

  it("uses eligibility as the denominator, so a fresh signup is not a miss", () => {
    // As of the newborn's own first day: they are 0 days old, so they are in
    // nobody's denominator — the two week-old families answer alone.
    const report = cohortRetention([returner, lapsed, newborn], "2026-09-09");
    expect(report.d1).toEqual({ eligible: 2, returned: 1, rate: 0.5 });
    expect(report.d7.eligible).toBe(2);
    expect(report.d7.returned).toBe(0);
    // One day later the newborn becomes answerable for D1 and only for D1.
    const later = cohortRetention([returner, lapsed, newborn], "2026-09-10");
    expect(later.d1.eligible).toBe(3);
    expect(later.d7.eligible).toBe(2);
  });

  it("an empty denominator yields rate null, never 0 — no fake failing score", () => {
    const report = cohortRetention([newborn], "2026-09-09");
    expect(report.d7).toEqual({ eligible: 0, returned: 0, rate: null });
    expect(report.d30.rate).toBeNull();
    expect(report.d30.rate).not.toBe(0);
  });

  it("an empty cohort is null across the board", () => {
    const report = cohortRetention([], "2026-09-10");
    for (const day of RETENTION_DAYS) {
      expect(report[`d${day}`]).toEqual({ eligible: 0, returned: 0, rate: null });
    }
  });
});

describe("clinical firewall: this module produces numbers, never copy", () => {
  it("nothing it returns is a string a parent could be shown", () => {
    const rollup = buildRollup([{ event: "session_open", at: at("2026-09-01T08:00:00Z") }])!;
    const report = cohortRetention([rollup], "2026-10-02");
    // Buckets are counts + a nullable ratio. No labels, no verdicts, no copy.
    for (const day of RETENTION_DAYS) {
      const bucket = report[`d${day}`];
      expect(Object.keys(bucket).sort()).toEqual(["eligible", "rate", "returned"]);
      expect(typeof bucket.eligible).toBe("number");
      expect(typeof bucket.returned).toBe("number");
    }
  });
});
