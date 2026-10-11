/**
 * v3 EXTRA-FORYOU — "Courses by area" on the For you, the parent hub.
 *
 * Each parent course names the ONE area it mainly serves, in the Learn
 * Library's own shelf vocabulary (LEARN_CATEGORIES: name, glyph and tone), so
 * the two doors to the same reading speak one set of area names. The Library's
 * shelves are used rather than the Development-Map domains on purpose: the
 * domain registry files sleep under "independence and adaptive skills", which
 * would label the bedtime course with a name no parent would look for it under.
 *
 * This is an editorial catalogue fact about each COURSE. The counts are plain
 * integers of courses in an area, never anything about the child, never a
 * share of a total and never progress.
 */
import { LEARN_CATEGORIES, type LearnCategory, type LearnCategoryId } from "./learnLibrary";

export const MASTERCLASS_AREAS: Readonly<Record<string, LearnCategoryId>> = {
  "holding-the-line-without-anger": "behavior",
  "building-responsibility-by-age": "behavior",
  "repair-after-conflict": "parent",
  "raising-courage-without-harshness": "feelings",
  "big-feelings-name-it-to-tame-it": "feelings",
  "co-parenting-united-front": "parent",
  "praise-the-effort-not-the-child": "minds",
  "bedtime-without-a-battle": "sleep",
  "screens-without-the-fight": "screens",
  "the-goodbye-that-builds-trust": "feelings",
};

/** The area a course serves, or null for a course nobody has placed yet. */
export function courseArea(courseId: string): LearnCategoryId | null {
  return MASTERCLASS_AREAS[courseId] ?? null;
}

export interface CourseAreaCount {
  area: LearnCategory;
  /** How many of the given courses sit in this area (a catalogue count). */
  count: number;
}

/** The areas that hold at least one of `courses`, in shelf order, with counts. */
export function courseAreaCounts(courses: ReadonlyArray<{ id: string }>): CourseAreaCount[] {
  const counts = new Map<LearnCategoryId, number>();
  for (const c of courses) {
    const area = courseArea(c.id);
    if (area) counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return LEARN_CATEGORIES.filter((a) => counts.has(a.id)).map((area) => ({ area, count: counts.get(area.id)! }));
}
