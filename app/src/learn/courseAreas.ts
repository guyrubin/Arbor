/**
 * v3 EXTRA-FORYOU — "Courses by area" and the short-read area chip on the
 * For you, the parent hub.
 *
 * Areas are the ONE developmental domain registry (lib/domains/registry.ts):
 * names through `domainName`, glyphs through `DOMAIN_ICONS`, order through
 * `DOMAIN_IDS`. No private vocabulary here — this file maps content ids to
 * registry ids, nothing else. Each placement follows the registry's own
 * sub-areas: sleep and eating sit in "body", screen time, routines and
 * parental stress in "family", self-care skills in "hands", attention and
 * learning in "thinking", regulation, attachment and behaviour in "feelings".
 *
 * Editorial catalogue facts about each COURSE and each Learn shelf. The counts
 * are plain integers of courses in an area, never anything about the child,
 * never a share of a total and never progress.
 */
import { DOMAIN_IDS, type DomainId } from "../lib/domains/registry";
import type { LearnCategoryId } from "./learnLibrary";

/** The ONE area each parent course mainly serves. */
export const MASTERCLASS_DOMAINS: Readonly<Record<string, DomainId>> = {
  "holding-the-line-without-anger": "feelings",
  "building-responsibility-by-age": "hands",
  "repair-after-conflict": "family",
  "raising-courage-without-harshness": "feelings",
  "big-feelings-name-it-to-tame-it": "feelings",
  "co-parenting-united-front": "family",
  "praise-the-effort-not-the-child": "thinking",
  "bedtime-without-a-battle": "body",
  "screens-without-the-fight": "family",
  "the-goodbye-that-builds-trust": "feelings",
};

/** v3 F-FORYOU-1 — the Daily Play readiness courses, listed on For you, the
 *  parent beside the parent courses. Each follows the registry's sub-areas:
 *  starting school is the family's school_context, a new sibling a family
 *  life_event, bedtimes are body/sleep. */
export const READINESS_DOMAINS: Readonly<Record<string, DomainId>> = {
  "ready-for-school": "family",
  "new-sibling": "family",
  "calmer-bedtimes": "body",
};

/** Each Learn Library shelf, placed in the registry area it belongs to. */
export const LEARN_SHELF_DOMAINS: Readonly<Record<LearnCategoryId, DomainId>> = {
  minds: "thinking",
  language: "talking",
  feelings: "feelings",
  behavior: "feelings",
  sleep: "body",
  play: "playing",
  screens: "family",
  eating: "body",
  motion: "moving",
  parent: "family",
};

/** The area a course serves, or null for a course nobody has placed yet. */
export function courseArea(courseId: string): DomainId | null {
  return MASTERCLASS_DOMAINS[courseId] ?? READINESS_DOMAINS[courseId] ?? null;
}

/** The area a Learn read sits in, from its shelf. */
export function readArea(category: LearnCategoryId): DomainId {
  return LEARN_SHELF_DOMAINS[category];
}

export interface CourseAreaCount {
  area: DomainId;
  /** How many of the given courses sit in this area (a catalogue count). */
  count: number;
}

/** The areas that hold at least one of `courses`, in registry order, with counts. */
export function courseAreaCounts(courses: ReadonlyArray<{ id: string }>): CourseAreaCount[] {
  const counts = new Map<DomainId, number>();
  for (const c of courses) {
    const area = courseArea(c.id);
    if (area) counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return DOMAIN_IDS.filter((id) => counts.has(id)).map((area) => ({ area, count: counts.get(area)! }));
}
