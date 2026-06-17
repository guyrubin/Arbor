/* Daily Play Courses — short, challenge-targeted tracks (the Lovevery Course-Pack
 * analog). A course sequences existing activities toward one developmental focus
 * over a few days. The recommendation is matched to the child's logged concern
 * domain (the memory moat), so the course a family sees is theirs, not generic.
 * Pure + deterministic — no I/O, unit-testable. Progress lives in the caller.
 */

import { PLAY_ACTIVITIES, type PlayBand, type PlayDomain } from "./content";

export interface PlayCourse {
  id: string;
  title: string;
  /** Developmental focus — also the concern domain it answers. */
  domain: PlayDomain;
  bands: PlayBand[];
  whatItBuilds: string;
  /** Ordered activity ids (each is a "day"), all present in PLAY_ACTIVITIES. */
  activityIds: string[];
}

export const COURSES: PlayCourse[] = [
  {
    id: "big-feelings",
    title: "Riding out big feelings",
    domain: "regulation",
    bands: ["preschool", "early-school"],
    whatItBuilds: "A few days of practice naming and settling strong emotions, together.",
    activityIds: ["feelings-weather", "calm-down-jar", "transition-countdown"],
  },
  {
    id: "more-words",
    title: "More words, more turns",
    domain: "language",
    bands: ["infant", "toddler", "preschool"],
    whatItBuilds: "Builds back-and-forth talk and vocabulary across ordinary moments.",
    activityIds: ["narrate-the-day", "story-swap", "mirror-faces"],
  },
  {
    id: "sharing-turns",
    title: "Sharing and taking turns",
    domain: "social",
    bands: ["toddler", "preschool"],
    whatItBuilds: "Practices waiting, turn-taking, and handling the wobble when it's hard.",
    activityIds: ["turn-taking-tower", "mirror-faces", "helper-of-the-day"],
  },
  {
    id: "focus-followthrough",
    title: "Focus and follow-through",
    domain: "cognitive",
    bands: ["preschool", "early-school"],
    whatItBuilds: "Builds attention and seeing a small plan through to the end.",
    activityIds: ["treasure-hunt", "sort-the-laundry", "narrate-the-day"],
  },
];

/** Hebrew copy for course titles/whatItBuilds (first draft, native review pending). */
export const COURSES_HE: Record<string, { title: string; whatItBuilds: string }> = {
  "big-feelings": {
    title: "לעבור דרך רגשות גדולים",
    whatItBuilds: "כמה ימים של תרגול בקריאת שם להרגשות חזקות ובהרגעתן, יחד.",
  },
  "more-words": {
    title: "יותר מילים, יותר תורות",
    whatItBuilds: "בונה שיחה הלוך ושוב ואוצר מילים דרך רגעים יומיומיים.",
  },
  "sharing-turns": {
    title: "שיתוף ולקיחת תורות",
    whatItBuilds: "מתרגל המתנה, תורות, והתמודדות עם הרעידה כשזה קשה.",
  },
  "focus-followthrough": {
    title: "ריכוז והתמדה",
    whatItBuilds: "בונה קשב והשלמה של תוכנית קטנה עד הסוף.",
  },
};

export function localizeCourse(course: PlayCourse, lang: "en" | "he"): PlayCourse {
  if (lang !== "he") return course;
  const he = COURSES_HE[course.id];
  return he ? { ...course, title: he.title, whatItBuilds: he.whatItBuilds } : course;
}

/** Guard: every course references real, in-bank activities. */
export function courseActivities(course: PlayCourse) {
  return course.activityIds
    .map((id) => PLAY_ACTIVITIES.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
}

/**
 * Recommend a course matched to the child's top logged concern domain; falls
 * back to the regulation course (most universal) when there is no signal.
 */
export function recommendCourse(concernDomains: PlayDomain[] = []): PlayCourse {
  for (const domain of concernDomains) {
    const hit = COURSES.find((c) => c.domain === domain);
    if (hit) return hit;
  }
  return COURSES.find((c) => c.id === "big-feelings") ?? COURSES[0];
}

export interface CourseProgress {
  total: number;
  done: number;
  percent: number;
  /** Next not-yet-done activity id, or null when the course is complete. */
  nextActivityId: string | null;
  complete: boolean;
}

/** Progress for a course given the ids completed within it (order-preserving). */
export function courseProgress(course: PlayCourse, completedIds: string[] = []): CourseProgress {
  const completed = new Set(completedIds);
  const total = course.activityIds.length;
  const done = course.activityIds.filter((id) => completed.has(id)).length;
  const nextActivityId = course.activityIds.find((id) => !completed.has(id)) ?? null;
  return {
    total,
    done,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
    nextActivityId,
    complete: done >= total,
  };
}
