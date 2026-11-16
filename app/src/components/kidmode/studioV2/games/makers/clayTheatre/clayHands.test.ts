import { describe, expect, it } from 'vitest';
import {
  CALL_SECONDS, COAST_STOP, FLING_MAX, FRIENDS, HOLD_MAX, MAX_TOUCHES, PORTHOLE_FROM, TOY_TAIL, WINDOW, addTouch, allStarsSwinging, audienceAt, backdropAt, coastDone, coastRest, coastStep, cometAt,
  curtainCall, fishHop, flickSwing, flingVelocity, friendMoods, heroPlace, heroPress, liftTouch, liveTouches, moonSpin, popIn, pressDent, pressDepth, pressInto, pressSquash, pruneTouches,
  starFlick, toyAt, toySpots, type Touch,
} from './clayHands';
import { FRESH_HANDS, REELS, REEL_SECONDS, REACH_TOUCH, SPLASH_T, lastFrame, rocketFilm, timeOf } from './clayTheatreRules';
import { CLAY_PEAK, CLAY_PURR, CLAY_SCALE } from './clayAudio';

const touch = (over: Partial<Touch>): Touch => ({ key: 1, toy: 'clayHero', index: 0, x: 200, y: 180, dir: 1, born: 0, lifted: null, ...over });

describe('a hand always lands on something', () => {
  it('every point of the stage, on every frame of every film, is a toy or a named backdrop', () => {
    for (const reel of REELS) for (let f = 0; f <= lastFrame(reel); f += 7) for (let x = 5; x < 400; x += 43) for (let y = 5; y < 300; y += 37) {
      const spot = toyAt(reel, timeOf(f), x, y);
      expect(TOY_TAIL[spot.toy]).toBeGreaterThan(0);
    }
  });
  it('the clay is under a finger wherever the film has put it, and gone once it has left the stage', () => {
    for (const reel of REELS) {
      const h = heroPlace(reel, 1);
      expect(toyAt(reel, 1, h.cx, h.cy).toy).toBe('clayHero');
    }
    expect(toySpots('rocket', 8).some(s => s.toy === 'clayHero')).toBe(false); // the rocket has flown
    expect(toySpots('rocket', 1).filter(s => s.toy === 'wireStar')).toHaveLength(5);
    expect(toyAt('rocket', 1, 8, 150).toy).toBe('feltDrape'); expect(toyAt('rocket', 1, 200, WINDOW.y0 - 6).toy).toBe('feltDrape');
    expect(backdropAt('rocket', 1, 120, 150)).toBe('openAir'); expect(backdropAt('rocket', 1, 120, 250)).toBe('seaSkin');
    expect(backdropAt('jump', 0.5, 300, 250)).toBe('deepWater'); expect(backdropAt('jump', 4, 60, 40)).toBe('openAir');
  });
  it('the same film time gives the same toys whatever came before', () => {
    const direct = toySpots('jump', 4.9);
    for (let f = 0; f <= lastFrame('jump'); f++) toySpots('jump', timeOf(f));
    expect(toySpots('jump', 4.9)).toEqual(direct);
  });
});

describe('a touch is a pure function of its age', () => {
  it('a press squashes while held, then springs back past rest and settles to nothing', () => {
    expect(pressDepth(0)).toBe(0); expect(pressDepth(6)).toBeCloseTo(0.3); expect(pressDepth(60)).toBeCloseTo(0.3);
    expect(pressSquash(3, -1)).toBeGreaterThan(0.2); expect(pressSquash(6, 0)).toBeCloseTo(0.3);
    expect(pressSquash(6, 3)).toBeLessThan(0); // the overshoot: taller than at rest
    expect(Math.abs(pressSquash(6, TOY_TAIL.clayHero))).toBeLessThan(0.005);
    expect(pressDent(2, -1)).toBe(1); expect(pressDent(2, 3)).toBe(0.5); expect(pressDent(2, 6)).toBe(0);
  });
  it('live touches are read from the hand-frame alone, and run out', () => {
    const held = [touch({})];
    expect(liveTouches(held, 4)).toEqual([{ key: 1, toy: 'clayHero', index: 0, x: 200, y: 180, dir: 1, held: 4, since: -1 }]);
    const let5 = liftTouch(held, 1, 5);
    expect(liveTouches(let5, 8)[0]).toMatchObject({ held: 5, since: 3 });
    expect(liveTouches(let5, 5 + TOY_TAIL.clayHero)).toEqual([]); expect(pruneTouches(let5, 5 + TOY_TAIL.clayHero)).toEqual([]);
    expect(pruneTouches(let5, 6)).toBe(let5); // nothing ran out: the same list
    // A press cannot be held for ever.
    expect(liveTouches(held, HOLD_MAX + 2)[0]).toMatchObject({ held: HOLD_MAX, since: 2 }); expect(liveTouches(held, HOLD_MAX + TOY_TAIL.clayHero)).toEqual([]);
    expect(liftTouch(held, 1, 0)[0].lifted).toBe(1); // a tap is at least one frame long
    let many: readonly Touch[] = [];
    for (let i = 0; i < 20; i++) many = addTouch(many, touch({ key: i }));
    expect(many).toHaveLength(MAX_TOUCHES);
  });
  it('once every touch has run out the press is exactly nothing', () => {
    const gone = liveTouches([touch({ lifted: 2 })], 40);
    expect(heroPress(gone)).toEqual({ squash: 0, squeeze: 0, dents: [] });
    const now = heroPress(liveTouches([touch({}), touch({ key: 2, x: 190 })], 5));
    expect(now.squash).toBeLessThanOrEqual(0.34); expect(now.dents).toHaveLength(2); expect(now.squeeze).toBe(1);
  });
  it('a flicked star swings away from the finger and rocks back to rest', () => {
    expect(flickSwing(0, 1)).toBe(0); expect(flickSwing(3, 1)).toBeGreaterThan(15); expect(flickSwing(3, -1)).toBe(-flickSwing(3, 1));
    expect(flickSwing(9, 1)).toBeLessThan(0); expect(Math.abs(flickSwing(TOY_TAIL.wireStar, 1))).toBeLessThan(1.5);
    const live = liveTouches([touch({ toy: 'wireStar', index: 2, lifted: 0 })], 3);
    expect(starFlick(live, 2)).toBe(flickSwing(3, 1)); expect(starFlick(live, 1)).toBe(0);
  });
  it('the small toys begin and end where they should', () => {
    expect(moonSpin(0)).toBe(0); expect(moonSpin(TOY_TAIL.nightMoon)).toBe(360);
    expect(popIn(-1)).toBe(0); expect(popIn(3)).toBeGreaterThan(1); expect(popIn(8)).toBe(1);
    expect(fishHop(0, 100, 1)?.y).toBeCloseTo(0); expect(fishHop(5, 100, 1)!.y).toBeLessThan(-30); expect(fishHop(TOY_TAIL.seaSkin, 100, 1)).toBeNull();
    expect(cometAt(0)!.x).toBeLessThan(60); expect(cometAt(TOY_TAIL.cometWish - 1)!.x).toBeGreaterThan(340); expect(cometAt(TOY_TAIL.cometWish)).toBeNull();
  });
  it('the secret: all five stars swinging at once calls one comet', () => {
    const four = [0, 1, 2, 3].map(i => touch({ key: i, toy: 'wireStar', index: i, lifted: 0 }));
    expect(allStarsSwinging(four, 4)).toBe(false);
    const five = [...four, touch({ key: 9, toy: 'wireStar', index: 4, lifted: 3 })];
    expect(allStarsSwinging(five, 4)).toBe(true);
    expect(allStarsSwinging(five, 60)).toBe(false); // they have come to rest
    expect(allStarsSwinging([...five, touch({ key: 10, toy: 'cometWish', lifted: 4 })], 5)).toBe(false); // one comet at a time
  });
});

describe('pressing the clay leaves the child a lasting choice', () => {
  it('a press on the whale leaves a thumbprint; on the finished rocket it also moves the porthole there', () => {
    const whale = heroPlace('rocket', 1);
    const printed = pressInto(FRESH_HANDS, 'rocket', 1, whale.cx + 10, whale.cy);
    expect(printed.prints).toHaveLength(1); expect(printed.porthole).toBe(0);
    expect(rocketFilm(5.5).morph).toBeGreaterThanOrEqual(PORTHOLE_FROM);
    const rocket = heroPlace('rocket', 5.5);
    const low = pressInto(FRESH_HANDS, 'rocket', 5.5, rocket.cx, rocket.cy + 30), high = pressInto(low, 'rocket', 5.5, rocket.cx, rocket.cy - 34);
    expect(low.porthole).toBe(2); expect(high.porthole).toBe(0);
    expect(pressInto(FRESH_HANDS, 'frog', 1, 100, 190)).toBe(FRESH_HANDS); expect(pressInto(FRESH_HANDS, 'ayaSeed', 1, 100, 190)).toBe(FRESH_HANDS);
  });
});

describe('the film strip coasts like film', () => {
  it('a fling slows by friction, comes to rest near where physics says, and never leaves the reel', () => {
    let c = { pos: 20, vel: 60 }, steps = 0;
    const rest = coastRest(c, 96);
    while (!coastDone(c) && steps++ < 1000) { const next = coastStep(c, 1 / 60, 96); expect(next.pos).toBeGreaterThanOrEqual(c.pos); expect(Math.abs(next.vel)).toBeLessThanOrEqual(Math.abs(c.vel)); c = next; }
    expect(steps).toBeLessThan(200); expect(Math.abs(c.pos - rest)).toBeLessThan(COAST_STOP / 3);
    expect(coastStep({ pos: 95, vel: 90 }, 0.5, 96)).toEqual({ pos: 96, vel: 0 }); expect(coastStep({ pos: 1, vel: -90 }, 0.5, 96)).toEqual({ pos: 0, vel: 0 });
    expect(coastStep(c, 0, 96)).toBe(c);
  });
  it('the same fling from the same place always ends on the same frame, at any frame rate', () => {
    const run = (dt: number) => { let c = { pos: 30, vel: -48 }; while (!coastDone(c)) c = coastStep(c, dt, 108); return Math.round(c.pos); };
    expect(run(1 / 120)).toBe(run(1 / 30));
  });
  it('the speed of a fling comes from the last tenth of a second and is capped', () => {
    expect(flingVelocity([{ at: 0, pos: 0 }, { at: 0.05, pos: 2 }, { at: 0.1, pos: 4 }], 0.1)).toBeCloseTo(40);
    expect(flingVelocity([{ at: 0, pos: 0 }, { at: 0.05, pos: 50 }], 0.05)).toBe(FLING_MAX);
    expect(flingVelocity([{ at: 0, pos: 0 }, { at: 0.05, pos: 5 }], 0.6)).toBe(0); // the hand stopped before it let go
    expect(flingVelocity([{ at: 0, pos: 3 }], 0)).toBe(0);
  });
});

describe('the audience follows the film itself', () => {
  it("Pep's ears go up at the splash and Aya leans in for the frog, whichever way the film got there", () => {
    expect(audienceAt('jump', SPLASH_T + 0.2).pep).toBe('earsUp'); expect(audienceAt('jump', SPLASH_T - 0.2).pep).toBe('watching');
    expect(audienceAt('frog', REACH_TOUCH - 1).aya).toBe('leaning'); expect(audienceAt('frog', REACH_TOUCH + 0.2).aya).toBe('glad');
    for (const reel of REELS) { expect(Object.keys(audienceAt(reel, 0)).sort()).toEqual([...FRIENDS].sort()); expect(Object.values(audienceAt(reel, 0)).every(m => m === 'watching')).toBe(true); expect(audienceAt(reel, REEL_SECONDS[reel] / 2)).toEqual(audienceAt(reel, REEL_SECONDS[reel] / 2)); }
  });
  it('a pat, or a reel just finished, makes them glad for a moment', () => {
    const patted = friendMoods('rocket', 0, liveTouches([touch({ toy: 'kitFriend', index: 2, lifted: 0 })], 3));
    expect(patted[FRIENDS[2]]).toBe('glad'); expect(patted[FRIENDS[0]]).toBe('watching');
    expect(Object.values(friendMoods('rocket', 0, liveTouches([touch({ toy: 'reelDone', lifted: 0 })], 3))).every(m => m === 'glad')).toBe(true);
    expect(friendMoods('rocket', 0, liveTouches([touch({ toy: 'kitFriend', index: 2, lifted: 0 })], 99))).toEqual(audienceAt('rocket', 0));
  });
});

describe('the curtain call is a film of its own', () => {
  it('the curtain closes, opens on the cast, they bow in turn, roses land, in about two seconds', () => {
    expect(CALL_SECONDS).toBeGreaterThanOrEqual(1.5); expect(CALL_SECONDS).toBeLessThanOrEqual(2.5);
    expect(curtainCall(0)).toMatchObject({ drapes: 0, cast: 0 }); expect(curtainCall(0.5)).toMatchObject({ drapes: 1, cast: 1 }); expect(curtainCall(1.1).drapes).toBe(0);
    expect(curtainCall(1.3).bows[0]).toBeGreaterThan(curtainCall(1.3).bows[3]); expect(curtainCall(2.2).bows.every(b => b > 0.5)).toBe(true); expect(curtainCall(CALL_SECONDS).bows.every(b => b < 0.01)).toBe(true);
    expect(curtainCall(1).roses).toHaveLength(0); expect(curtainCall(CALL_SECONDS).roses).toHaveLength(7); expect(curtainCall(CALL_SECONDS).roses.every(r => r.landed && r.y > 230 && r.y < 262 && r.rot === 0)).toBe(true);
    expect(curtainCall(1.7)).toEqual(curtainCall(1.7));
  });
});

describe('sound, by the numbers', () => {
  it('one scale (C major pentatonic), every voice quiet, the loop a whisper', () => {
    const ratios = CLAY_SCALE.map(f => Math.round(1200 * Math.log2(f / 130.81)) % 1200);
    for (const cents of ratios) expect([0, 200, 400, 700, 900]).toContain(cents);
    expect(CLAY_SCALE.includes(659.25)).toBe(true); // the shell's own tap note is in the scale
    expect(CLAY_PEAK).toBeLessThanOrEqual(0.12); expect(CLAY_PURR).toBeLessThanOrEqual(0.03);
  });
});
