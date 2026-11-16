import { TRACKS, type Track, type TrackId } from './windupRaceRules';

/** The course on the floor, seen from above. The rules run the car in one
 * dimension (how far along, how high); this module lays that line out as a
 * winding path across the pavilion floor. Pure: no React, no randomness.
 *
 * A course is a smooth curve through authored waypoints, re-measured by its
 * own length, so `courseAt(track, u)` is the floor point `u` table units along
 * it: a car that the rules move ten units moves ten units on the floor, bend
 * or straight. Floor space: x to the right, y DOWN the screen, y = 0 the
 * middle of the floor. The course always heads rightwards (it never doubles
 * back), in both languages. */

type Point = readonly [number, number];
/** Waypoints per track: gentle bends, level ends. */
export const COURSE_WAYPOINTS: Readonly<Record<TrackId, readonly Point[]>> = {
  shelf: [[0, 10], [260, 10], [520, -70], [800, 64], [1040, 0], [1300, 0]],
  ramp: [[0, 46], [300, 46], [640, -58], [1000, -44], [1260, 66], [1640, 66]],
  table: [[0, -34], [360, -34], [640, 72], [930, 88], [1190, -44], [1500, -72], [1920, -72]],
  blockBridge: [[0, -8], [280, -8], [600, 84], [900, 24], [1150, -62], [1540, -62]],
  bookSlide: [[0, -62], [240, -62], [520, 30], [860, 82], [1150, -24], [1740, -24]],
  grandTour: [[0, 52], [340, 52], [620, -70], [900, -90], [1150, 30], [1400, 72], [1960, 72]],
};

export interface CoursePoint { x: number; y: number; /** Heading, radians: 0 = rightwards, positive = turning down the screen. */ a: number }
interface Course { xs: number[]; ys: number[]; ls: number[]; total: number }
const STEP = 4;
const built = new Map<TrackId, Course>();

/** Catmull-Rom through the waypoints, sampled finely and measured. */
function build(points: readonly Point[]): Course {
  const xs: number[] = [], ys: number[] = [], ls: number[] = [];
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const steps = Math.max(8, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / STEP));
    for (let k = i === 0 ? 0 : 1; k <= steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const spline = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      const x = spline(p0[0], p1[0], p2[0], p3[0]), y = spline(p0[1], p1[1], p2[1], p3[1]);
      const n = xs.length;
      ls.push(n ? ls[n - 1] + Math.hypot(x - xs[n - 1], y - ys[n - 1]) : 0);
      xs.push(x); ys.push(y);
    }
  }
  return { xs, ys, ls, total: ls[ls.length - 1] };
}
function courseOf(track: Track): Course {
  let course = built.get(track.id);
  if (!course) { course = build(COURSE_WAYPOINTS[track.id]); built.set(track.id, course); }
  return course;
}
/** How long the laid-out course is (it is never shorter than the track it carries). */
export function courseLength(track: Track): number { return courseOf(track).total; }

/** The floor point `u` units along the track's course, and the heading there.
 * Before the start and past the end the course runs on straight. */
export function courseAt(track: Track, u: number): CoursePoint {
  const { xs, ys, ls, total } = courseOf(track), last = xs.length - 1;
  const d = Number.isFinite(u) ? u : 0;
  if (d <= 0) { const a = Math.atan2(ys[1] - ys[0], xs[1] - xs[0]); return { x: xs[0] + Math.cos(a) * d, y: ys[0] + Math.sin(a) * d, a }; }
  if (d >= total) { const a = Math.atan2(ys[last] - ys[last - 1], xs[last] - xs[last - 1]); return { x: xs[last] + Math.cos(a) * (d - total), y: ys[last] + Math.sin(a) * (d - total), a }; }
  let lo = 0, hi = last;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ls[mid] <= d) lo = mid; else hi = mid; }
  const f = (d - ls[lo]) / (ls[hi] - ls[lo] || 1);
  return { x: xs[lo] + (xs[hi] - xs[lo]) * f, y: ys[lo] + (ys[hi] - ys[lo]) * f, a: Math.atan2(ys[hi] - ys[lo], xs[hi] - xs[lo]) };
}
/** A point beside the course: `side` units to the right of the heading (down the screen on a rightward run). */
export function beside(track: Track, u: number, side: number): CoursePoint {
  const p = courseAt(track, u);
  return { x: p.x - Math.sin(p.a) * side, y: p.y + Math.cos(p.a) * side, a: p.a };
}
/** The floor the course covers: its extent across the screen, with a margin. */
export function courseBounds(track: Track): { top: number; bottom: number } {
  const { ys } = courseOf(track);
  return { top: Math.min(...ys), bottom: Math.max(...ys) };
}
export const ALL_COURSES = TRACKS;
