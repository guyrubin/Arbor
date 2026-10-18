import { describe, expect, it, vi } from "vitest";
import type { DomainId } from "../../lib/domains/registry";
import { DOMAIN_IDS } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";
import {
  BAR_BASE_PX,
  BAR_MAX_PX,
  BAR_UNIT_PX,
  MOMENTS_KINDS,
  MOMENTS_RANGES,
  MOMENTS_VIEWS,
  areaMonthCounts,
  barHeightPx,
  filterByAreaMonth,
  isKind,
  isMomentRecord,
  kindCounts,
  parseKind,
  monthBuckets,
  monthIdOf,
  parseMonth,
  parseView,
  placeCards,
  placeOf,
} from "./momentsModel";

/**
 * F-CHILD-2 — the Moments read model. Invented records only (the repo is
 * public). Every number it produces is a plain count of kept moments: no
 * share, no rate, no denominator, nothing the parent could read as a grade.
 */

const CHILD = "child-invented";
let n = 0;
function moment(at: string, domains: DomainId[] = [], context?: string, childId = CHILD): Observation {
  n += 1;
  return {
    id: `behaviorLogs:m${n}`,
    childId,
    at,
    domains,
    kind: "moment",
    value: { type: "moment", behaviorType: "Moment", ...(context ? { context } : {}) },
    source: "parent_typed",
    origin: "behaviorLogs",
    ageAtObservationMonths: null,
    pretermCorrected: false,
  };
}

// Local-time instants, so month ids never depend on the CI timezone.
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const NOW = new Date(2026, 9, 12, 15); // 12 Oct 2026, local

describe("views and query parsing", () => {
  // v4 re-pin: Across areas leads and is the default; a link that names an
  // area, a month or one observation (focused) still opens Over time.
  it("knows three views, Across areas first and by default; a focused link opens Over time", () => {
    expect(MOMENTS_VIEWS).toEqual(["areas", "time", "places"]);
    expect(parseView("places")).toBe("places");
    expect(parseView("areas")).toBe("areas");
    expect(parseView("time")).toBe("time");
    expect(parseView(null)).toBe("areas");
    expect(parseView("story")).toBe("areas");
    expect(parseView(null, true)).toBe("time");
    expect(parseView("places", true)).toBe("places");
    expect(parseView("areas", true)).toBe("areas");
  });

  it("v4: which moments are in view — All · Kept · Hard moments · Things said, from real record types", () => {
    expect(MOMENTS_KINDS).toEqual(["all", "kept", "hard", "said"]);
    expect(parseKind("kept")).toBe("kept");
    expect(parseKind("hard")).toBe("hard");
    expect(parseKind("said")).toBe("said");
    expect(parseKind(null)).toBe("all");
    expect(parseKind("behaviors")).toBe("all");
    const base = { childId: "c", at: at(2026, 10, 1), domains: [], source: "parent_typed" as const, ageAtObservationMonths: null, pretermCorrected: false };
    const keepsake = { ...base, id: "keepsakes:m1", kind: "milestone" as const, origin: "keepsakes" as const, value: { type: "keepsake" as const, milestoneId: "m1", note: "First wave" } };
    const word = { ...base, id: "langObs:w1", kind: "word" as const, origin: "langObs" as const, value: { type: "word" as const, language: "en", phrase: "moon" } };
    const incident = { ...base, id: "behaviorLogs:b1", kind: "moment" as const, origin: "behaviorLogs" as const, value: { type: "moment" as const, behaviorType: "Transition Refusal" } };
    const neutral = { ...base, id: "behaviorLogs:b2", kind: "moment" as const, origin: "behaviorLogs" as const, value: { type: "moment" as const, behaviorType: "Moment" } };
    const record = [keepsake, word, incident, neutral] as unknown as Parameters<typeof kindCounts>[0];
    expect(kindCounts(record)).toEqual({ all: 4, kept: 1, hard: 1, said: 1 });
    // NEGATIVE CONTROL: a neutral moment ("she said butterfly") is never a hard moment.
    expect(isKind(record[3], "hard")).toBe(false);
    expect(isKind(record[2], "hard")).toBe(true);
  });

  it("v4: a month bar is a fixed scale — one count is one height everywhere, capped, nothing normalised", () => {
    expect(barHeightPx(0)).toBe(0);
    expect(barHeightPx(1)).toBe(BAR_BASE_PX + BAR_UNIT_PX);
    expect(barHeightPx(3)).toBe(BAR_BASE_PX + 3 * BAR_UNIT_PX);
    expect(barHeightPx(500)).toBe(BAR_MAX_PX);
    expect(barHeightPx(2)).toBeLessThan(barHeightPx(3));
  });
  it("reads ?month= as YYYY-MM only", () => {
    expect(parseMonth("2026-08")).toBe("2026-08");
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("2026-8")).toBeNull();
    expect(parseMonth(undefined)).toBeNull();
  });
  it("offers 3 months, 12 months and the full record", () => {
    expect(MOMENTS_RANGES).toEqual([3, 12, 0]);
  });
});

describe("monthBuckets", () => {
  const record = [
    moment(at(2026, 10, 3), ["talking"]),
    moment(at(2026, 8, 30), ["moving"]),
    moment(at(2026, 8, 2), ["talking", "feelings"]),
    moment(at(2026, 3, 9), ["hands"]),
    moment(at(2026, 10, 1), [], undefined, "another-child"),
    moment(at(2026, 11, 20), ["talking"]), // after now: never shown
    { ...moment(at(2026, 9, 1)), at: "not a date" },
  ];

  it("3 months: newest month first, an empty month stays an honest empty column", () => {
    const buckets = monthBuckets(record, CHILD, NOW, 3);
    expect(buckets.map(b => b.id)).toEqual(["2026-10", "2026-09", "2026-08"]);
    expect(buckets.map(b => b.observations.length)).toEqual([1, 0, 2]);
    // newest first inside a month
    expect(buckets[2].observations[0].at).toBe(at(2026, 8, 30));
  });

  it("only this child's dated, past records are counted", () => {
    const all = monthBuckets(record, CHILD, NOW, 12).flatMap(b => b.observations);
    expect(all).toHaveLength(4);
    expect(all.every(o => o.childId === CHILD)).toBe(true);
  });

  it("12 months spans a year; the full record starts at the oldest kept month", () => {
    expect(monthBuckets(record, CHILD, NOW, 12)).toHaveLength(12);
    const full = monthBuckets(record, CHILD, NOW, 0);
    expect(full[0].id).toBe("2026-10");
    expect(full[full.length - 1].id).toBe("2026-03");
    expect(full).toHaveLength(8);
  });

  it("an empty record still yields the current month (never a crash, never a zero-state grade)", () => {
    const empty = monthBuckets([], CHILD, NOW, 0);
    expect(empty.map(b => b.id)).toEqual(["2026-10"]);
    expect(empty[0].observations).toEqual([]);
  });

  it("monthIdOf is local and rejects junk", () => {
    expect(monthIdOf(new Date(2026, 0, 31, 23))).toBe("2026-01");
    expect(monthIdOf("nope")).toBeNull();
  });

  it("keeps a chosen first-of-month day in that month west of UTC", () => {
    vi.stubEnv("TZ", "America/Los_Angeles");
    try {
      const firstMorning = new Date(2026, 9, 1, 9);
      expect(firstMorning.getTimezoneOffset()).toBeGreaterThan(0);
      const saved: Observation = {
        ...moment("2026-10-01", ["talking"]),
        id: "keepsakes:october-first", origin: "keepsakes",
        value: { type: "keepsake", milestoneId: "october-first", note: "Our words on October 1" },
      };
      expect(monthIdOf(saved.at)).toBe("2026-10");
      // A full timestamp still follows its actual local month.
      expect(monthIdOf("2026-10-01T00:00:00Z")).toBe("2026-09");
      const full = monthBuckets([saved], CHILD, firstMorning, 0);
      expect(full.map(bucket => bucket.id)).toEqual(["2026-10"]);
      expect(full[0].observations).toEqual([saved]);
      expect(filterByAreaMonth([saved], "talking", "2026-10")).toEqual([saved]);
      expect(filterByAreaMonth([saved], "talking", "2026-09")).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("areaMonthCounts — bare counts per area and month", () => {
  it("one row per registry area, a plain integer per column", () => {
    const buckets = monthBuckets([
      moment(at(2026, 10, 2), ["talking"]),
      moment(at(2026, 10, 5), ["talking", "feelings"]),
      moment(at(2026, 8, 5), ["moving"]),
    ], CHILD, NOW, 3);
    const rows = areaMonthCounts(buckets);
    expect(rows.map(r => r.domain)).toEqual([...DOMAIN_IDS]);
    const row = (d: DomainId) => rows.find(r => r.domain === d)!.counts;
    expect(row("talking")).toEqual([2, 0, 0]);
    expect(row("feelings")).toEqual([1, 0, 0]);
    expect(row("moving")).toEqual([0, 0, 1]);
    for (const r of rows) for (const c of r.counts) expect(Number.isInteger(c) && c >= 0).toBe(true);
  });
});

describe("places — only what the parent recorded", () => {
  const record = [
    moment(at(2026, 10, 1), [], "School"),
    moment(at(2026, 10, 4), [], "Home"),
    moment(at(2026, 9, 4), [], "Home"),
    moment(at(2026, 9, 6)), // no place: never inferred
    moment(at(2026, 9, 7), [], "Moon"), // unknown place: ignored
  ];

  it("cards follow the fixed place order and hold newest first", () => {
    const cards = placeCards(record);
    expect(cards.map(c => c.context)).toEqual(["Home", "School"]);
    expect(cards[0].observations.map(o => o.at)).toEqual([at(2026, 10, 4), at(2026, 9, 4)]);
  });

  it("a moment without a recorded place has none", () => {
    expect(placeOf(record[3])).toBeNull();
    expect(placeOf(record[4])).toBeNull();
    expect(placeOf(record[1])).toBe("Home");
  });

  it("a non-moment record never has a place", () => {
    const milestone: Observation = { ...moment(at(2026, 9, 9)), kind: "milestone", value: { type: "milestone", milestoneId: "m-x", title: "Invented" } };
    expect(placeOf(milestone)).toBeNull();
  });
});

describe("filterByAreaMonth", () => {
  const record = [
    moment(at(2026, 10, 2), ["talking"]),
    moment(at(2026, 9, 2), ["talking"]),
    moment(at(2026, 9, 3), ["moving"]),
  ];
  it("narrows by area, by month, by both, or not at all", () => {
    expect(filterByAreaMonth(record, "talking")).toHaveLength(2);
    expect(filterByAreaMonth(record, null, "2026-09")).toHaveLength(2);
    expect(filterByAreaMonth(record, "talking", "2026-09")).toHaveLength(1);
    expect(filterByAreaMonth(record)).toHaveLength(3);
  });
});

describe("isMomentRecord", () => {
  it("keeps what the parent kept; a child's own practice, a screening and a measurement never count", () => {
    const base = moment(at(2026, 9, 9), ["talking"]);
    expect(isMomentRecord(base)).toBe(true);
    expect(isMomentRecord({ ...base, kind: "milestone", value: { type: "milestone", milestoneId: "m-x", title: "Invented" } })).toBe(true);
    expect(isMomentRecord({ ...base, kind: "practice", value: { type: "practice", activity: "mission:x" }, origin: "missionRecords" })).toBe(true);
    expect(isMomentRecord({ ...base, source: "professional_entered" })).toBe(true);
    expect(isMomentRecord({ ...base, kind: "practice", value: { type: "practice", activity: "memory" }, source: "kid_practice", origin: "practiceEvents" })).toBe(false);
    expect(isMomentRecord({ ...base, kind: "concern", value: { type: "check", bandId: "band-x" }, origin: "screenings" })).toBe(false);
    expect(isMomentRecord({ ...base, kind: "measurement", value: { type: "measurement", heightCm: 100 }, origin: "growthEntries" })).toBe(false);
  });
});
