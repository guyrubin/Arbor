import { describe, expect, it } from "vitest";
import { buildYearBook, yearKeysOf } from "./keepsakeYear";
import type { KeptThing } from "./kept/keptThings";

const item = (id: string, at: string, text = `Words ${id}`): KeptThing => ({ id, at, kind: "said", text, attribution: "parent" });

describe("one calendar year of dated kept things", () => {
  it("reads the year forward by month and keeps no number field", () => {
    const kept = [
      item("oct", "2026-10-08"),
      item("mar", "2026-03-02"),
      item("oct-early", "2026-10-01"),
      item("other-year", "2025-12-31"),
    ];
    const book = buildYearBook({ yearKey: "2026", kept })!;
    expect(book.yearKey).toBe("2026");
    expect(book.months.map(month => month.monthKey)).toEqual(["2026-03", "2026-10"]);
    expect(book.months[1].items.map(row => row.id)).toEqual(["oct-early", "oct"]);
    expect(Object.keys(book).sort()).toEqual(["months", "yearKey"]);
    expect(JSON.stringify(book)).not.toMatch(/"(?:count|score|ratio|delta|total|trend|grade|percentile)"/);
    expect(kept[0].id).toBe("oct");
  });

  it("rejects an empty, malformed, or other year", () => {
    const kept = [item("a", "2026-10-05")];
    for (const yearKey of ["2025", "26", "2026-10", "20260", "year", ""]) expect(buildYearBook({ yearKey, kept })).toBeNull();
    expect(buildYearBook({ yearKey: "2026", kept: [] })).toBeNull();
  });

  it("lists years that have kept things, newest first", () => {
    expect(yearKeysOf([item("a", "2024-01-02"), item("b", "2026-06-01"), item("c", "2026-01-01"), item("bad", "not-a-date")])).toEqual(["2026", "2024"]);
  });
});
