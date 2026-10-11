/**
 * v3 EXTRA-FORYOU — "Courses by area" on the For you, the parent hub.
 *
 * Every parent course names one area in the Learn Library's own shelf
 * vocabulary, and the chip counts are plain catalogue integers: how many
 * courses sit in an area. Never progress, never a share of a total, never
 * anything about the child.
 */
import { describe, expect, it } from "vitest";
import { MASTERCLASSES } from "../lib/masterclasses";
import { LEARN_CATEGORIES } from "./learnLibrary";
import { courseArea, courseAreaCounts, MASTERCLASS_AREAS } from "./courseAreas";

const SHELF_IDS = LEARN_CATEGORIES.map((c) => c.id);

describe("every course sits in one Learn shelf", () => {
  it("each Masterclass id is mapped to a real shelf id", () => {
    expect(MASTERCLASSES.length).toBeGreaterThan(0);
    for (const m of MASTERCLASSES) {
      const area = courseArea(m.id);
      expect(area, m.id).not.toBeNull();
      expect(SHELF_IDS, m.id).toContain(area);
    }
  });

  it("the map names no course that does not exist (no stale rows)", () => {
    const ids = new Set(MASTERCLASSES.map((m) => m.id));
    expect(Object.keys(MASTERCLASS_AREAS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it("NEGATIVE CONTROL: an unplaced course has no area and is left out of the counts", () => {
    expect(courseArea("a-course-nobody-placed")).toBeNull();
    expect(courseAreaCounts([{ id: "a-course-nobody-placed" }])).toEqual([]);
  });
});

describe("courseAreaCounts — plain integers in shelf order", () => {
  const counts = courseAreaCounts(MASTERCLASSES);

  it("counts are whole numbers that add up to the catalogue", () => {
    for (const { count } of counts) {
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThan(0);
    }
    expect(counts.reduce((sum, c) => sum + c.count, 0)).toBe(MASTERCLASSES.length);
  });

  it("areas come back in the Learn shelf order, each once", () => {
    const order = counts.map((c) => SHELF_IDS.indexOf(c.area.id));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
  });

  it("only areas that hold one of the given courses appear", () => {
    const one = MASTERCLASSES.slice(0, 1);
    const only = courseAreaCounts(one);
    expect(only).toHaveLength(1);
    expect(only[0].area.id).toBe(courseArea(one[0].id));
    expect(only[0].count).toBe(1);
    expect(courseAreaCounts([])).toEqual([]);
  });

  it("more than one area exists, so the chip row has something to choose", () => {
    expect(counts.length).toBeGreaterThan(1);
  });
});
