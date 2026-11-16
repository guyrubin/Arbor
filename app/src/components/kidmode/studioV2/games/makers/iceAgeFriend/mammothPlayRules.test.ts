import { describe, expect, it } from 'vitest';
import { seeded } from './iceAgeFriendRules';
import {
  DAYS, DAY_WEATHER, ENTER_SECONDS, FEED, FEED_SECONDS, FINALE, FINALE_ANSWERS, FINALE_CALL, FINALE_SECONDS, GESTURE_SECONDS, GHOST, MEET, SNOW_GONE, TURN_SECONDS,
  arcPoint, brushSnow, comesAnyway, enterAt, feedAt, feedPose, finaleLift, foundNotes, gestureAt, ghostAt, ghostDue, ghostKnockAt, growSnow, leanFor, lidFor, meetStep, moodLift,
  moodStep, nextStep, overshoot, pickDay, regrow, rumbleFor, scaleNote, seedSnow, snowLeft, turnAt, type GestureId,
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
  it('snow settles again only while it is falling', () => {
    expect(growSnow(0.2, 1 / 60, 0)).toBe(0.2);
    expect(growSnow(0.2, 1 / 60, 1)).toBeGreaterThan(0.2);
    let amount = 0;
    for (let i = 0; i < 60 * 120; i++) amount = growSnow(amount, 1 / 60, 1);
    expect(amount).toBe(1);
  });
});

describe('the hint hand', () => {
  it('shows only after a quiet spell, only until the child has done it, and never over a card', () => {
    expect(ghostDue(GHOST.first - 0.1, 0, false, false)).toBe(false);
    expect(ghostDue(GHOST.first + 0.1, 0, false, false)).toBe(true);
    expect(ghostDue(GHOST.again - 0.1, 1, false, false)).toBe(false);
    expect(ghostDue(GHOST.again + 0.1, 1, false, false)).toBe(true);
    expect(GHOST.again).toBeGreaterThanOrEqual(5); expect(GHOST.again).toBeLessThanOrEqual(7);
    expect(ghostDue(99, 3, true, false)).toBe(false); expect(ghostDue(99, 3, false, true)).toBe(false);
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
  it('it comes in anyway for a child who only watches', () => {
    expect(comesAnyway(MEET.patience - 1)).toBe(false); expect(comesAnyway(MEET.patience)).toBe(true);
  });
  it('stepping through: the breath covers the wall at the moment it changes sides, then clears', () => {
    expect(enterAt(0)).toMatchObject({ inside: false, bloom: 0, done: false });
    const end = enterAt(ENTER_SECONDS);
    expect(end.inside).toBe(true); expect(end.done).toBe(true); expect(end.bloom).toBeCloseTo(0); expect(end.settle).toBeCloseTo(0);
    let swap = -1;
    for (let t = 0; t <= ENTER_SECONDS; t += 1 / 120) { const at = enterAt(t); expect(at.bloom).toBeGreaterThanOrEqual(0); expect(at.bloom).toBeLessThanOrEqual(1); if (at.inside && swap < 0) swap = t; }
    expect(enterAt(swap).bloom).toBeGreaterThan(0.97); expect(enterAt(swap - 1 / 120).bloom).toBeGreaterThan(0.97);
    expect(ENTER_SECONDS).toBeLessThanOrEqual(2.5);
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
  it('a thrown bunch starts and lands exactly, arcing up between; a cropped tuft grows back', () => {
    expect(arcPoint([0, 0], [100, 40], 0, 60)).toEqual([0, 0]); expect(arcPoint([0, 0], [100, 40], 1, 60)).toEqual([100, 40]);
    expect(arcPoint([0, 0], [100, 40], 0.5, 60)[1]).toBeCloseTo(20 - 60);
    let grown = 0;
    for (let i = 0; i < 60 * 7.2; i++) grown = regrow(grown, 1 / 60);
    expect(grown).toBe(1); expect(regrow(0.5, 0)).toBe(0.5);
  });
});

describe('gestures, the turn and the finale', () => {
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
  it('each discovery shows what its words are about', () => {
    const peak = (id: GestureId, key: 'ear' | 'nod' | 'rise' | 'swing') => { let m = 0; for (let t = 0; t < GESTURE_SECONDS[id]; t += 1 / 60) m = Math.max(m, Math.abs(gestureAt(id, t)[key])); return m; };
    expect(peak('ears', 'ear')).toBeGreaterThan(0.3);      // the small ear flaps
    expect(peak('tusks', 'nod')).toBeGreaterThan(0.05);    // the head sweeps
    expect(peak('trunk', 'swing')).toBeGreaterThan(0.2);   // the tip reaches
    expect(peak('hump', 'rise')).toBeGreaterThan(5);       // it stands tall
    expect(peak('tickle', 'ear')).toBeGreaterThan(0.3);
  });
  it('overshoot dips first, passes its mark and settles on it', () => {
    expect(overshoot(0)).toBeCloseTo(0); expect(overshoot(1)).toBeCloseTo(1); expect(overshoot(0.09)).toBeLessThan(0);
    expect(Math.max(...Array.from({ length: 100 }, (_, i) => overshoot(i / 100)))).toBeGreaterThan(1.02);
  });
  it('the turn sinks, swings round with the sides swapping at the narrowest moment, lands and settles', () => {
    expect(turnAt(0)).toMatchObject({ face: 1, hop: 0, swapped: false, landed: false });
    expect(turnAt(TURN_SECONDS)).toMatchObject({ face: 1, hop: 0, swapped: true, landed: true });
    expect(turnAt(TURN_SECONDS).squash).toBeCloseTo(0);
    let narrow = 1, swapAt = -1, top = 0;
    for (let t = 0; t <= TURN_SECONDS; t += 1 / 240) { const at = turnAt(t); if (at.face < narrow) narrow = at.face; if (at.swapped && swapAt < 0) swapAt = t; top = Math.max(top, at.hop); expect(at.face).toBeGreaterThan(0); expect(at.face).toBeLessThanOrEqual(1); }
    expect(narrow).toBeLessThan(0.1); expect(turnAt(swapAt).face).toBeLessThan(0.1); expect(top).toBeGreaterThan(0.95);
    expect(TURN_SECONDS).toBeLessThan(1.2);
  });
  it('the finale lifts the trunk, holds while it calls and the herd answers, and lowers it: a couple of seconds, no more', () => {
    expect(finaleLift(-1, false)).toBe(0); expect(finaleLift(FINALE_SECONDS, false)).toBe(0);
    expect(finaleLift(FINALE.rise + 0.1, false)).toBe(1); expect(finaleLift(FINALE.rise + 0.1, true)).toBe(1); expect(finaleLift(0.01, true)).toBe(1);
    expect(FINALE_CALL).toBeLessThan(FINALE.rise);
    for (const answer of FINALE_ANSWERS) { expect(answer).toBeGreaterThan(FINALE_CALL + 0.5); expect(answer).toBeLessThan(FINALE.rise + FINALE.hold); }
    expect(FINALE.rise + FINALE.hold).toBeGreaterThanOrEqual(1.5); expect(FINALE.rise + FINALE.hold).toBeLessThanOrEqual(2.6);
    for (let t = 0; t < FINALE_SECONDS; t += 1 / 60) { expect(finaleLift(t, false)).toBeGreaterThanOrEqual(0); expect(finaleLift(t, false)).toBeLessThan(1.2); }
  });
});

describe('the day', () => {
  it('playing again never brings the same day twice running', () => {
    const random = seeded(11);
    let last = pickDay(random, null);
    const seen = new Set([last]);
    for (let i = 0; i < 60; i++) { const next = pickDay(random, last); expect(next).not.toBe(last); expect(DAYS).toContain(next); seen.add(next); last = next; }
    expect(seen.size).toBe(DAYS.length);
    expect(pickDay(() => 0.9999, 'goldenHour')).not.toBe('goldenHour');
  });
  it('every day keeps the snowfall capped and has snow to brush', () => {
    for (const day of DAYS) { const w = DAY_WEATHER[day]; expect(w.flakes).toBeLessThanOrEqual(60); expect(w.flakes).toBeGreaterThan(0); expect(w.cover).toBeGreaterThan(0.3); expect(Math.abs(w.wind)).toBeLessThan(0.3); }
  });
});
