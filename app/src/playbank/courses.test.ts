import { describe, it, expect } from "vitest";
import {
  COURSES, COURSES_HE, recommendCourse, courseProgress, courseActivities, localizeCourse,
} from "./courses";
import { PLAY_ACTIVITIES } from "./content";

describe("Daily Play Courses", () => {
  it("every course references real, in-bank activities", () => {
    const ids = new Set(PLAY_ACTIVITIES.map((a) => a.id));
    for (const c of COURSES) {
      expect(c.activityIds.length).toBeGreaterThan(0);
      for (const id of c.activityIds) expect(ids.has(id), `${c.id} → ${id}`).toBe(true);
      expect(courseActivities(c).length).toBe(c.activityIds.length);
    }
  });

  it("every course has a Hebrew translation", () => {
    for (const c of COURSES) {
      expect(COURSES_HE[c.id], `missing he for ${c.id}`).toBeDefined();
      expect(COURSES_HE[c.id].title.trim().length).toBeGreaterThan(0);
    }
  });

  it("recommends a course matching the top concern domain", () => {
    expect(recommendCourse(["social"]).domain).toBe("social");
    expect(recommendCourse(["language", "regulation"]).domain).toBe("language");
  });

  it("falls back to the regulation course with no concern signal", () => {
    expect(recommendCourse([]).id).toBe("big-feelings");
    expect(recommendCourse(["motor"]).id).toBe("big-feelings"); // no motor course → fallback
  });

  it("tracks progress and the next activity in order", () => {
    const c = COURSES.find((x) => x.id === "big-feelings")!;
    const fresh = courseProgress(c, []);
    expect(fresh.done).toBe(0);
    expect(fresh.percent).toBe(0);
    expect(fresh.nextActivityId).toBe(c.activityIds[0]);
    expect(fresh.complete).toBe(false);

    const mid = courseProgress(c, [c.activityIds[0]]);
    expect(mid.done).toBe(1);
    expect(mid.nextActivityId).toBe(c.activityIds[1]);

    const all = courseProgress(c, [...c.activityIds]);
    expect(all.complete).toBe(true);
    expect(all.percent).toBe(100);
    expect(all.nextActivityId).toBeNull();
  });

  it("localizeCourse swaps copy for he and passes through for en", () => {
    const c = COURSES[0];
    expect(localizeCourse(c, "he").title).toBe(COURSES_HE[c.id].title);
    expect(localizeCourse(c, "en")).toBe(c);
  });
});
