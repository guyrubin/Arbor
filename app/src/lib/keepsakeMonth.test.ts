import { describe, expect, it } from "vitest";
import { buildMonthPage, monthKeyOf } from "./keepsakeMonth";
import type { KeptThing } from "./kept/keptThings";

const item = (id: string, at: string): KeptThing => ({ id, at, kind: "said", text: `Words ${id}`, attribution: "parent" });
describe("one month of dated kept things", () => {
  it("contains three dated items in chronological order and no number/count field", () => {
    const kept = [item("last", "2026-10-08"), item("first", "2026-10-01"), item("middle", "2026-10-05"), item("outside", "2026-09-30")];
    const page = buildMonthPage({ monthKey: "2026-10", kept })!;
    expect(page.items.map(row => row.id)).toEqual(["first", "middle", "last"]);
    expect(page.items.map(row => row.at)).toEqual(["2026-10-01", "2026-10-05", "2026-10-08"]);
    expect(Object.keys(page).sort()).toEqual(["items", "monthKey"]);
    expect(JSON.stringify(page)).not.toMatch(/"(?:count|score|ratio|delta|total|trend|cards)"/);
    expect(buildMonthPage.length).toBe(1);
    expect(kept[0].id).toBe("last");
  });
  it("rejects empty, malformed, and other months", () => {
    for (const monthKey of ["2026-09", "2026-00", "2026-13", "2026-10-extra", "junk", ""]) expect(buildMonthPage({ monthKey, kept: [item("a", "2026-10-05")] })).toBeNull();
    expect(buildMonthPage({ monthKey: "2026-10", kept: [] })).toBeNull();
  });
  it("uses the UTC month of an instant while retaining the parent's date-only day", () => {
    expect(buildMonthPage({ monthKey: "2026-10", kept: [item("boundary", "2026-10-01T01:00:00+03:00")] })).toBeNull();
    expect(monthKeyOf("2026-10-01T01:00:00+03:00")).toBe("2026-09");
    expect(monthKeyOf("invalid")).toBeNull();
  });
});
