/**
 * v3 EXTRA-FORYOU — "Courses by area" and the short-read area chip.
 *
 * Areas are the ONE developmental domain registry (reviewer r1: the brief asks
 * for the development domains with DOMAIN_ICONS, not the Learn shelves). Every
 * parent course and every Learn shelf names one registry domain, and the chip
 * counts are plain catalogue integers: how many courses sit in an area. Never
 * progress, never a share of a total, never anything about the child.
 */
import { describe, expect, it } from "vitest";
import { MASTERCLASSES } from "../lib/masterclasses";
import { DOMAIN_IDS, domainName } from "../lib/domains/registry";
import { DOMAIN_ICONS } from "../lib/domains/icons";
import { translate } from "../lib/i18n";
import { LEARN_CARDS } from "./learnCards";
import { LEARN_CATEGORIES } from "./learnLibrary";
import { READINESS_COURSES } from "../playbank/courses";
import { courseArea, courseAreaCounts, LEARN_SHELF_DOMAINS, MASTERCLASS_DOMAINS, READINESS_DOMAINS, readArea } from "./courseAreas";

describe("every course and every Learn shelf sits in one registry domain", () => {
  it("each Masterclass id is mapped to a real registry domain", () => {
    expect(MASTERCLASSES.length).toBeGreaterThan(0);
    for (const m of MASTERCLASSES) {
      const area = courseArea(m.id);
      expect(area, m.id).not.toBeNull();
      expect(DOMAIN_IDS, m.id).toContain(area);
    }
  });

  it("the course map names no course that does not exist (no stale rows)", () => {
    const ids = new Set(MASTERCLASSES.map((m) => m.id));
    expect(Object.keys(MASTERCLASS_DOMAINS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it("each Learn shelf is placed in a registry domain, and every Learn read gets one", () => {
    expect(Object.keys(LEARN_SHELF_DOMAINS).sort()).toEqual(LEARN_CATEGORIES.map((c) => c.id).sort());
    for (const c of LEARN_CARDS) expect(DOMAIN_IDS, c.id).toContain(readArea(c.category));
  });

  it("placements follow the registry's own sub-areas (sleep and eating in body, screens in family)", () => {
    expect(readArea("sleep")).toBe("body");
    expect(readArea("eating")).toBe("body");
    expect(readArea("screens")).toBe("family");
    expect(readArea("language")).toBe("talking");
    expect(courseArea("bedtime-without-a-battle")).toBe("body");
    expect(courseArea("screens-without-the-fight")).toBe("family");
  });

  it("every area a chip can show has a shipped glyph and a registry name in EN and HE", () => {
    for (const id of DOMAIN_IDS) {
      expect(DOMAIN_ICONS[id], id).toMatch(/^[a-z][a-z0-9_]+$/);
      for (const lang of ["en", "he"] as const) {
        const name = domainName(id, (key) => translate(lang, key));
        expect(name, `${lang}:${id}`).not.toBe(`elev.domains.${id}`);
        if (lang === "he") expect(name, id).not.toMatch(/[A-Za-z]/);
      }
    }
  });

  // v3 F-FORYOU-1 — the Daily Play readiness courses are listed on For you,
  // the parent, inside "Courses by area", so each needs an area too.
  it("each readiness course is mapped to a real registry domain, and the map has no stale rows", () => {
    expect(READINESS_COURSES.length).toBeGreaterThan(0);
    for (const c of READINESS_COURSES) {
      const area = courseArea(c.id);
      expect(area, c.id).not.toBeNull();
      expect(DOMAIN_IDS, c.id).toContain(area);
    }
    const ids = new Set(READINESS_COURSES.map((c) => c.id));
    expect(Object.keys(READINESS_DOMAINS).filter((id) => !ids.has(id))).toEqual([]);
    expect(courseArea("calmer-bedtimes")).toBe("body");
    // Counted beside the parent courses, never as a share of anything.
    const both = courseAreaCounts([...MASTERCLASSES, ...READINESS_COURSES]);
    expect(both.reduce((sum, c) => sum + c.count, 0)).toBe(MASTERCLASSES.length + READINESS_COURSES.length);
  });

  it("NEGATIVE CONTROL: an unplaced course has no area and is left out of the counts", () => {
    expect(courseArea("a-course-nobody-placed")).toBeNull();
    expect(courseAreaCounts([{ id: "a-course-nobody-placed" }])).toEqual([]);
  });
});

describe("courseAreaCounts — plain integers in registry order", () => {
  const counts = courseAreaCounts(MASTERCLASSES);

  it("counts are whole numbers that add up to the catalogue", () => {
    for (const { count } of counts) {
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThan(0);
    }
    expect(counts.reduce((sum, c) => sum + c.count, 0)).toBe(MASTERCLASSES.length);
  });

  it("areas come back in the registry order, each once", () => {
    const order = counts.map((c) => DOMAIN_IDS.indexOf(c.area));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
  });

  it("only areas that hold one of the given courses appear", () => {
    const one = MASTERCLASSES.slice(0, 1);
    const only = courseAreaCounts(one);
    expect(only).toHaveLength(1);
    expect(only[0].area).toBe(courseArea(one[0].id));
    expect(only[0].count).toBe(1);
    expect(courseAreaCounts([])).toEqual([]);
  });

  it("more than one area exists, so the chip row has something to choose", () => {
    expect(counts.length).toBeGreaterThan(1);
  });
});
