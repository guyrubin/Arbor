import { describe, expect, it } from 'vitest';
import { seeded } from './iceAgeFriendRules';
import {
  FEED, FEED_SECONDS, FINALE, FINALE_SECONDS, GESTURE_SECONDS, GHOST, MEET, SNOW_GONE,
  arcPoint, brushSnow, feedAt, feedPose, finaleLift, foundNotes, gestureAt, ghostAt, ghostKnockAt, leanFor, lidFor, meetStep, moodLift,
  moodStep, nextStep, overshoot, rumbleFor, scaleNote, seedSnow, snowLeft, type GestureId,
} from './mammothPlayRules';

describe('one scale for every sound', () => {
  it('is D major pentatonic: every step is D, E, F sharp, A or B in some octave', () => {
    const names = [0, 2, 4, 7, 9];
    for (let step = -6; step <= 18; step++) {
      const semitones = 12 * Math.log2(scaleNote(step) / 146.83);
      expect(Math.abs(semitones - Math.round(semitones))).toBeLessThan(1e-6);
      expect(names).toContain(((Math.round(semitones) % 12) + 12) % 12);
    }
    expect(scaleNote(5)).toBeCloseTo(scaleNote(0) * 2); expect(scaleNote(3)).toBeCloseTo(220, 0);
    expect(scaleNote(Number.NaN)).toBeCloseTo(146.83);
  });
  it('a repeated toy never plays the same note twice running, and stays in its range', () => {
    const random = seeded(5);
    let last = -1;
    for (let i = 0; i < 200; i++) { const next = nextStep(last, 10, 16, random); expect(next).not.toBe(last); expect(next).toBeGreaterThanOrEqual(10); expect(next).toBeLessThanOrEqual(16); last = next; }
    expect(nextStep(16, 10, 16, () => 0.9999)).toBe(10);
  });
  it('each discovery rings a step higher than the one before', () => {
    for (let i = 0; i < 5; i++) { const [a, b] = foundNotes(i); expect(scaleNote(b)).toBeGreaterThan(scaleNote(a)); if (i) expect(foundNotes(i)[0]).toBe(foundNotes(i - 1)[0] + 1); }
    expect(foundNotes(99)).toEqual(foundNotes(4));
  });
});

describe('mood', () => {
  it('rises while the coat is stroked and ebbs slowly after, always within 0..1', () => {
    let mood = 0;
    for (let i = 0; i < 60 * 3; i++) mood = moodStep(mood, 1, 1 / 60);
    expect(mood).toBeGreaterThan(0.9);
    const settled = mood;
    for (let i = 0; i < 60 * 3; i++) mood = moodStep(mood, 0, 1 / 60);
    expect(mood).toBeLessThan(settled); expect(mood).toBeGreaterThan(settled - 0.3);
    for (let i = 0; i < 60 * 60; i++) mood = moodStep(mood, 0, 1 / 60);
    expect(mood).toBe(0);
    expect(moodStep(0.5, 1, 99)).toBeLessThanOrEqual(1); expect(moodLift(0.95, 0.5)).toBe(1); expect(moodLift(0.3, -4)).toBe(0.3);
  });
  it('the eye is gently lidded at rest, closes as the mammoth settles, and a blink or a squeeze shuts it at once', () => {
    expect(lidFor(0, 0, 0)).toBeCloseTo(0.2);
    expect(lidFor(0.9, 0, 0)).toBeCloseTo(1);
    expect(lidFor(0.5, 0, 0)).toBeGreaterThan(lidFor(0.3, 0, 0));
    expect(lidFor(0, 1, 0)).toBe(1); expect(lidFor(0, 0, 1)).toBe(1);
  });
  it('it leans toward the hand, never further than its reach, further when content', () => {
    const [x, y] = leanFor(1, 200, 0);
    expect(x).toBeGreaterThan(0); expect(y).toBeCloseTo(0); expect(Math.hypot(x, y)).toBeLessThanOrEqual(8 + 1e-9);
    expect(leanFor(1, -200, 0)[0]).toBeLessThan(0);
    expect(Math.abs(leanFor(0, 200, 0)[0])).toBeLessThan(Math.abs(x));
    expect(leanFor(1, 0, 0)).toEqual([0, 0]);
  });
  it('the rumble is silent until it begins to settle and is fullest under the hand', () => {
    expect(rumbleFor(0, true)).toBe(0); expect(rumbleFor(1, true)).toBe(1);
    expect(rumbleFor(1, false)).toBeLessThan(rumbleFor(1, true)); expect(rumbleFor(0.5, true)).toBeGreaterThan(rumbleFor(0.3, true));
  });
});

describe('snow on its back', () => {
  it('seeds one clump for each spot, the same for the same seed, snowier on a snowy day', () => {
    const a = seedSnow(13, 1, seeded(3)), b = seedSnow(13, 1, seeded(3)), light = seedSnow(13, 0.4, seeded(3));
    expect(a).toEqual(b); expect(a.map(c => c.spot)).toEqual(Array.from({ length: 13 }, (_, i) => i));
    expect(a.every(c => c.amount >= 0 && c.amount <= 1 && c.size > 0.7 && c.size < 1.3)).toBe(true);
    expect(snowLeft(a)).toBeGreaterThan(snowLeft(light)); expect(snowLeft(a)).toBeGreaterThan(5);
  });
  it('a firm stroke takes nearly all of it, a glancing one a little; the last dusting goes at once', () => {
    const firm = brushSnow(1, 1), glancing = brushSnow(1, 0.2);
    expect(firm.amount).toBeLessThan(0.2); expect(firm.shed).toBeCloseTo(1 - firm.amount);
    expect(glancing.amount).toBeGreaterThan(0.8);
    expect(brushSnow(SNOW_GONE * 1.2, 0.5).amount).toBe(0);
    expect(brushSnow(0, 1)).toEqual({ amount: 0, shed: 0 });
  });
});

describe('the hint hand', () => {
  it('a lesson is short', () => {
    expect(GHOST.seconds).toBeGreaterThan(1.5); expect(GHOST.seconds).toBeLessThan(3.5);
  });
  it('the stroke fades in, presses, travels the whole back, lifts and fades', () => {
    expect(ghostAt(0).alpha).toBe(0); expect(ghostAt(1).alpha).toBe(0); expect(ghostAt(0.5).alpha).toBe(1);
    expect(ghostAt(0.1).u).toBe(0); expect(ghostAt(0.85).u).toBe(1); expect(ghostAt(0.5).press).toBe(1); expect(ghostAt(0.95).press).toBe(0);
    for (let t = 0.05; t <= 1; t += 0.05) expect(ghostAt(t).u).toBeGreaterThanOrEqual(ghostAt(t - 0.05).u);
  });
  it('the knock taps the glass twice', () => {
    const taps = Array.from({ length: 101 }, (_, i) => ghostKnockAt(i / 100).tap);
    expect(taps[0]).toBe(0); expect(taps[100]).toBe(2); expect(new Set(taps)).toEqual(new Set([0, 1, 2]));
    expect(ghostKnockAt(0.3).press).toBeCloseTo(1); expect(ghostKnockAt(0.58).press).toBeCloseTo(1); expect(ghostKnockAt(0.44).press).toBe(0);
    expect(ghostKnockAt(0).alpha).toBe(0); expect(ghostKnockAt(1).alpha).toBe(0);
  });
});

describe('meeting at the glass', () => {
  it('two touches make a friend, and so does a moment of stroking the glass', () => {
    let trust = meetStep(0, true, 0);
    expect(trust).toBeLessThan(1);
    trust = meetStep(trust, true, 0);
    expect(trust).toBe(1);
    let stroked = 0, seconds = 0;
    while (stroked < 1 && seconds < 5) { stroked = meetStep(stroked, false, 1 / 60); seconds += 1 / 60; }
    expect(seconds).toBeGreaterThan(0.5); expect(seconds).toBeLessThan(1.5);
    expect(MEET.tap * 2).toBeGreaterThanOrEqual(1);
  });
});

describe('a bunch of grass', () => {
  it('flies to the trunk, is curled to the mouth, is chewed, and then it is over', () => {
    expect(feedAt(-1)).toBeNull(); expect(feedAt(FEED_SECONDS)).toBeNull();
    expect(feedAt(FEED.fly / 2)).toEqual({ phase: 'fly', k: 0.5 });
    expect(feedAt(FEED.fly + FEED.curl / 2)?.phase).toBe('curl');
    expect(feedAt(FEED.fly + FEED.curl + 0.1)?.phase).toBe('chew');
    expect(feedAt(FEED_SECONDS - 0.01)?.phase).toBe('rest');
  });
  it('the trunk curls only once it holds the grass, the jaw works while it chews, and everything returns to rest', () => {
    expect(feedPose(FEED.fly * 0.5).curl).toBe(0);
    expect(feedPose(FEED.fly + FEED.curl * 0.99).curl).toBeGreaterThan(0.95);
    const jaws = Array.from({ length: 40 }, (_, i) => feedPose(FEED.fly + FEED.curl + (FEED.chew * i) / 40).jaw);
    expect(Math.max(...jaws)).toBeGreaterThan(0.3); expect(jaws.filter((j, i) => i > 0 && j > jaws[i - 1]).length).toBeGreaterThan(5);
    expect(feedPose(FEED_SECONDS - 0.01)).toEqual({ curl: 0, jaw: 0, reach: 0 }); expect(feedPose(99)).toEqual({ curl: 0, jaw: 0, reach: 0 });
  });
  it('a thrown bunch starts and lands exactly, arcing up between', () => {
    expect(arcPoint([0, 0], [100, 40], 0, 60)).toEqual([0, 0]); expect(arcPoint([0, 0], [100, 40], 1, 60)).toEqual([100, 40]);
    expect(arcPoint([0, 0], [100, 40], 0.5, 60)[1]).toBeCloseTo(20 - 60);
  });
});

describe('gestures and the call', () => {
  it('every gesture begins and ends at rest and moves in between', () => {
    for (const id of Object.keys(GESTURE_SECONDS) as GestureId[]) {
      const rest = gestureAt(id, GESTURE_SECONDS[id]);
      expect(Object.values(rest).every(v => v === 0), id).toBe(true);
      expect(Object.values(gestureAt(id, -1)).every(v => v === 0)).toBe(true);
      let moved = 0;
      for (let t = 0; t < GESTURE_SECONDS[id]; t += 1 / 60) { const d = gestureAt(id, t); expect(Object.values(d).every(Number.isFinite), id).toBe(true); moved = Math.max(moved, ...Object.values(d).map(Math.abs)); }
      expect(moved, id).toBeGreaterThan(0.02);
      expect(GESTURE_SECONDS[id]).toBeLessThanOrEqual(2.6);
    }
  });
  it('each gesture shows the thing it is about', () => {
    const peak = (id: GestureId, key: 'ear' | 'nod' | 'rise' | 'swing' | 'tail') => { let m = 0; for (let t = 0; t < GESTURE_SECONDS[id]; t += 1 / 60) m = Math.max(m, Math.abs(gestureAt(id, t)[key])); return m; };
    expect(peak('ears', 'ear')).toBeGreaterThan(0.3);      // the small ear flaps: the secret
    expect(peak('tusks', 'nod')).toBeGreaterThan(0.05);    // the head sweeps, as tusks swept snow
    expect(peak('hump', 'rise')).toBeGreaterThan(5);       // it stands tall
    expect(peak('tickle', 'ear')).toBeGreaterThan(0.3);
    expect(peak('tailSwish', 'tail')).toBeGreaterThan(0.2);
  });
  it('overshoot dips first, passes its mark and settles on it', () => {
    expect(overshoot(0)).toBeCloseTo(0); expect(overshoot(1)).toBeCloseTo(1); expect(overshoot(0.09)).toBeLessThan(0);
    expect(Math.max(...Array.from({ length: 100 }, (_, i) => overshoot(i / 100)))).toBeGreaterThan(1.02);
  });
  it('the call lifts the trunk, holds it high, and lowers it: a few seconds, no more', () => {
    expect(finaleLift(-1, false)).toBe(0); expect(finaleLift(FINALE_SECONDS, false)).toBe(0);
    expect(finaleLift(FINALE.rise + 0.1, false)).toBe(1); expect(finaleLift(FINALE.rise + 0.1, true)).toBe(1); expect(finaleLift(0.01, true)).toBe(1);
    expect(FINALE.rise + FINALE.hold).toBeGreaterThanOrEqual(1.5); expect(FINALE.rise + FINALE.hold).toBeLessThanOrEqual(2.6);
    for (let t = 0; t < FINALE_SECONDS; t += 1 / 60) { expect(finaleLift(t, false)).toBeGreaterThanOrEqual(0); expect(finaleLift(t, false)).toBeLessThan(1.2); }
  });
});
