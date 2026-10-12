import { describe, expect, it } from "vitest";
import type { DomainId } from "../../lib/domains/registry";
import { DOMAIN_IDS } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";
import {
  MOMENTS_RANGES,
  MOMENTS_VIEWS,
  areaMonthCounts,
  filterByAreaMonth,
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
  it("knows three views, defaulting to Over time", () => {
    expect(MOMENTS_VIEWS).toEqual(["time", "places", "areas"]);
    expect(parseView("places")).toBe("places");
    expect(parseView("areas")).toBe("areas");
    expect(parseView("time")).toBe("time");
    expect(parseView(null)).toBe("time");
    expect(parseView("story")).toBe("time");
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
