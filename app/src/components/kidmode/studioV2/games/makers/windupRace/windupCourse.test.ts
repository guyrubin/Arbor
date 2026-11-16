import { describe, expect, it } from 'vitest';
import { TRACKS } from './windupRaceRules';
import { COURSE_WAYPOINTS, beside, courseAt, courseBounds, courseLength } from './windupCourse';

describe('the course on the floor', () => {
  it.each(TRACKS.map(track => [track.id, track] as const))('%s: laid out for the whole track, measured by its own length', (_id, track) => {
    const end = track.points[track.points.length - 1][0];
    expect(courseLength(track)).toBeGreaterThanOrEqual(end);
    // Ten units along the track is ten units on the floor, on a bend or a straight.
    for (let u = 0; u + 10 <= end; u += 37) {
      const a = courseAt(track, u), b = courseAt(track, u + 10);
      expect(Math.hypot(b.x - a.x, b.y - a.y), `${u}`).toBeGreaterThan(9.8);
      expect(Math.hypot(b.x - a.x, b.y - a.y), `${u}`).toBeLessThan(10.05);
    }
  });
  it.each(TRACKS.map(track => [track.id, track] as const))('%s: always heads rightwards, in gentle bends, on the floor', (_id, track) => {
    const end = track.points[track.points.length - 1][0];
    let last = courseAt(track, -50).x;
    for (let u = -40; u <= end + 200; u += 10) {
      const p = courseAt(track, u);
      expect(p.x, `${u}`).toBeGreaterThan(last); last = p.x;
      expect(Math.abs(p.a), `${u}`).toBeLessThan(0.62); // never steeper than about 35 degrees across the floor
      expect(Math.abs(p.y), `${u}`).toBeLessThanOrEqual(110);
    }
    const bounds = courseBounds(track);
    expect(bounds.bottom - bounds.top).toBeGreaterThan(90); // a winding course, not a straight line
  });
  it('the car waits, and comes to the cushion, on a straight', () => {
    for (const track of TRACKS) {
      expect(Math.abs(courseAt(track, track.start).a), track.id).toBeLessThan(0.06);
      expect(Math.abs(courseAt(track, track.cushion + 40).a), track.id).toBeLessThan(0.1);
    }
  });
  it('is deterministic, runs on straight past both ends, and has a way point list per track', () => {
    for (const track of TRACKS) {
      expect(COURSE_WAYPOINTS[track.id].length).toBeGreaterThanOrEqual(5);
      expect(courseAt(track, 400)).toEqual(courseAt(track, 400));
      const before = courseAt(track, -100), start = courseAt(track, 0);
      expect(Math.hypot(before.x - start.x, before.y - start.y)).toBeCloseTo(100, 3);
      const total = courseLength(track), past = courseAt(track, total + 80), end = courseAt(track, total);
      expect(Math.hypot(past.x - end.x, past.y - end.y)).toBeCloseTo(80, 3);
      expect(courseAt(track, Number.NaN)).toEqual(courseAt(track, 0));
    }
  });
  it('beside() steps off the course at right angles', () => {
    const track = TRACKS[0], on = courseAt(track, 300), off = beside(track, 300, 60);
    expect(Math.hypot(off.x - on.x, off.y - on.y)).toBeCloseTo(60, 5);
    expect((off.x - on.x) * Math.cos(on.a) + (off.y - on.y) * Math.sin(on.a)).toBeCloseTo(0, 5);
  });
});
