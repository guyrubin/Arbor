import { describe, expect, it } from 'vitest';
import { BODY_KEYFRAMES, BODY_VERTICES, LEAF_VERTICES, PART_KEYS, boil, leafPoints, lerpShape, seeded } from './clayShapes';
import {
  CUES, FPS, FROG_D, FROG_HOPS, HOP_STOPS, REELS, REEL_SECONDS, REACH_START, REACH_TOUCH, SPLASH_T, allWatched, bubbles, captionAt, chooseReel, cuesCrossed,
  droplets, foamRings, frameAt, frogFilm, frogPosition, hopLanding, hopsLanded, lastFrame, momentOf, pause, play, reelsFor, ribbonSegments, rocketFilm,
  seek, seekFrame, setDirection, splashCrown, startTransport, stepFrame, stepHop, tick, timeOf, toStart, whalePose, type Transport,
  AYA_X1, BLOOMED_T, FRESH_HANDS, MAX_PRINTS, PORTHOLE_SLOTS, SEED_T, SPROUT_T, STAR_SETS, ayaFilm, cuesPassed, portholeSlotAt, pressPrint, rocketKey, setPorthole, showFor, starSwing,
} from './clayTheatreRules';

/** Plays a reel the way the rAF loop does, with uneven frame times. */
function run(s: Transport, seconds: number, dt = 1 / 60): Transport {
  let next = s, left = seconds;
  while (left > 1e-9 && next.playing) { const d = Math.min(dt, left); next = tick(next, d); left -= d; }
  return next;
}

describe('time is cut into stop-motion frames', () => {
  it('frame = floor(t·12), held inside the reel', () => {
    expect(FPS).toBe(12);
    expect(frameAt(0)).toBe(0); expect(frameAt(1 / 12 - 1e-4)).toBe(0); expect(frameAt(1 / 12)).toBe(1); expect(frameAt(0.25)).toBe(3);
    expect(frameAt(timeOf(57))).toBe(57);
    expect(frameAt(100, 'rocket')).toBe(lastFrame('rocket')); expect(frameAt(-3, 'jump')).toBe(0);
    expect(lastFrame('rocket')).toBe(96); expect(lastFrame('jump')).toBe(108); expect(lastFrame('ayaSeed')).toBe(108); expect(lastFrame('frog')).toBe(132);
  });
  it('every frame number round-trips through its time', () => {
    for (const reel of REELS) for (let f = 0; f <= lastFrame(reel); f++) expect(frameAt(timeOf(f), reel)).toBe(f);
  });
});

describe('Whale into Rocket is one body with real in-betweens', () => {
  it('all body keyframes have the same vertex count, in the same order', () => {
    const counts = Object.values(BODY_KEYFRAMES).map(k => k.length);
    expect(counts).toEqual([BODY_VERTICES, BODY_VERTICES, BODY_VERTICES]);
    for (const leaf of [...PART_KEYS.whale.flukes, ...PART_KEYS.rocket.flukes]) expect(leafPoints(leaf)).toHaveLength(LEAF_VERTICES);
    expect(() => lerpShape(BODY_KEYFRAMES.whale, BODY_KEYFRAMES.whale.slice(1), 0.5)).toThrow();
  });
  it('an in-between is a true vertex-by-vertex blend, not either end', () => {
    const half = lerpShape(BODY_KEYFRAMES.lump, BODY_KEYFRAMES.rocket, 0.5);
    half.forEach((p, i) => {
      expect(p[0]).toBeCloseTo((BODY_KEYFRAMES.lump[i][0] + BODY_KEYFRAMES.rocket[i][0]) / 2, 9);
      expect(p[1]).toBeCloseTo((BODY_KEYFRAMES.lump[i][1] + BODY_KEYFRAMES.rocket[i][1]) / 2, 9);
    });
  });
  it('the clay moves through whale → lump → rocket and the parts travel with it', () => {
    const whale = rocketFilm(1), lump = rocketFilm(3.2), mid = rocketFilm(4.2), rocket = rocketFilm(5.5), gone = rocketFilm(8);
    expect(whale.morph).toBe(0); expect(lump.morph).toBe(1); expect(rocket.morph).toBe(2);
    expect(mid.morph).toBeGreaterThan(1); expect(mid.morph).toBeLessThan(2);
    expect(whale.parts.eye.pupil).toBeGreaterThan(4); expect(rocket.parts.eye.ring).toBeCloseTo(15); expect(rocket.parts.eye.pupil).toBe(0);
    expect(lump.parts.dent).toBe(1); expect(whale.parts.spout.s).toBe(1); expect(rocket.parts.spout.s).toBe(0);
    expect(mid.parts.flukes[0].w).toBeGreaterThan(PART_KEYS.lump.flukes[0].w);
    expect(whale.rot).toBe(0); expect(rocket.rot).toBe(-90);
    expect(rocket.flame).toBeGreaterThan(0); expect(whale.flame).toBe(0);
    expect(gone.cy).toBeLessThan(-150); // out of the top of the stage
  });
  it('the boil is ±0.6 units and seeded by the frame: the same frame looks the same', () => {
    const a = boil(BODY_KEYFRAMES.whale, 17, 1), b = boil(BODY_KEYFRAMES.whale, 17, 1), c = boil(BODY_KEYFRAMES.whale, 18, 1);
    expect(a).toEqual(b); expect(a).not.toEqual(c);
    a.forEach((p, i) => { expect(Math.abs(p[0] - BODY_KEYFRAMES.whale[i][0])).toBeLessThanOrEqual(0.6); expect(Math.abs(p[1] - BODY_KEYFRAMES.whale[i][1])).toBeLessThanOrEqual(0.6); });
    expect(seeded(3, 4)).toBe(seeded(3, 4)); expect(seeded(3, 4)).not.toBe(seeded(4, 3));
  });
  it('countdown puffs appear at the countdown and are gone before it', () => {
    expect(rocketFilm(4.9).puffs).toHaveLength(0);
    expect(rocketFilm(5.1).puffs).toHaveLength(1);
    expect(rocketFilm(5.9).puffs.length).toBe(3);
  });
});

describe("The Whale's Jump is closed-form in t", () => {
  it('whalePose is continuous through breach and splash', () => {
    for (const at of [2.2, 3.2, SPLASH_T]) {
      const a = whalePose(at - 1e-4), b = whalePose(at + 1e-4);
      expect(Math.abs(a.x - b.x)).toBeLessThan(0.5); expect(Math.abs(a.y - b.y)).toBeLessThan(0.5); expect(Math.abs(a.rot - b.rot)).toBeLessThan(1.5);
    }
    expect(whalePose(3.9).y).toBeLessThan(-100); // the top of the arc, high above the water
    expect(whalePose(1).y).toBeGreaterThan(0);   // underwater at first
  });
  it('droplets: none before the whale leaves the water; the same t gives the same droplets whatever came before', () => {
    expect(droplets(0)).toEqual([]); expect(droplets(3.2)).toEqual([]);
    expect(droplets(3.5).length).toBeGreaterThan(0);
    const direct = droplets(4.9);
    // A history: forward through the whole film, then backwards, then back to 4.9.
    for (let f = 0; f <= lastFrame('jump'); f++) droplets(timeOf(f));
    for (let f = lastFrame('jump'); f >= 0; f--) droplets(timeOf(f));
    expect(droplets(4.9)).toEqual(direct);
    expect(direct.length).toBeGreaterThan(10);
  });
  it('every droplet exists only between its birth and its landing, and lands on the water', () => {
    for (let f = 0; f <= lastFrame('jump'); f++) for (const d of droplets(timeOf(f))) expect(d.y).toBeLessThanOrEqual(0.001);
    expect(droplets(8)).toEqual([]);
  });
  it('splash, foam rings and bubbles all un-happen backwards', () => {
    expect(splashCrown(SPLASH_T - 0.01)).toBe(0); expect(splashCrown(SPLASH_T + 0.22)).toBeCloseTo(1); expect(splashCrown(6)).toBe(0);
    expect(foamRings(4.5)).toHaveLength(1); expect(foamRings(3)).toEqual([]); expect(foamRings(5.4).length).toBeGreaterThanOrEqual(3);
    expect(bubbles(1)).toEqual(bubbles(1)); expect(bubbles(1).length).toBeGreaterThan(0);
    for (const b of bubbles(5.5)) expect(b.y).toBeGreaterThan(4);
  });
});

describe('Halfway Frog: each hop is half of what is left', () => {
  it('frogPosition(hop) = 1 − (½)^hop, exactly', () => {
    expect([0, 1, 2, 3, 7].map(frogPosition)).toEqual([0, 0.5, 0.75, 0.875, 1 - 1 / 128]);
    expect(frogPosition(FROG_HOPS)).toBeLessThan(1);
  });
  it('the ribbon segments are exactly ½, ¼, ⅛ … and add up to what was covered', () => {
    const segs = ribbonSegments();
    expect(segs.map(s => s.length)).toEqual([1 / 2, 1 / 4, 1 / 8, 1 / 16, 1 / 32, 1 / 64, 1 / 128]);
    segs.forEach((s, i) => { expect(s.to - s.from).toBe(s.length); if (i) expect(s.from).toBe(segs[i - 1].to); });
    expect(segs.reduce((sum, s) => sum + s.length, 0)).toBe(frogPosition(FROG_HOPS));
  });
  it('after seven hops the frog is very close and still not there; then it reaches out', () => {
    const rest = frogFilm(hopLanding(FROG_HOPS) + 0.1);
    expect(hopsLanded(hopLanding(FROG_HOPS) + 0.1)).toBe(7);
    expect(rest.gap).toBeCloseTo(FROG_D / 128, 9); expect(rest.gap).toBeGreaterThan(0);
    expect(rest.arm).toBe(0); expect(frogFilm(REACH_TOUCH).touched).toBe(true); expect(frogFilm(REACH_TOUCH).arm).toBe(1);
    expect(captionAt('frog', REACH_START - 0.1)).toBe('closer'); expect(captionAt('frog', REACH_START)).toBe('reach');
  });
  it('mid-hop the frog is in the air between two exact positions', () => {
    const f = frogFilm(hopLanding(1) - 0.2);
    expect(f.lift).toBeGreaterThan(0); expect(f.progress).toBeGreaterThan(0); expect(f.progress).toBeLessThan(0.5);
  });
});

describe('cues are edge-triggered while playing, silent while scrubbing', () => {
  it('a cue sounds once when crossed forward, once when crossed backward', () => {
    expect(cuesCrossed(CUES.rocket, 2.4, 2.5, true)).toEqual(['bloop']);
    expect(cuesCrossed(CUES.rocket, 2.5, 2.6, true)).toEqual([]);
    expect(cuesCrossed(CUES.rocket, 2.5, 2.4, true)).toEqual(['bloop']);
    expect(cuesCrossed(CUES.rocket, 6.3, 6.1, true)).toEqual(['whoosh']);
  });
  it('scrubbing, a held frame and a big jump are silent', () => {
    expect(cuesCrossed(CUES.rocket, 2.4, 2.5, false)).toEqual([]);
    expect(cuesCrossed(CUES.rocket, 2.45, 2.45, true)).toEqual([]);
    expect(cuesCrossed(CUES.rocket, 0, 8, true)).toEqual([]);
  });
  it('a whole play-through sounds each cue exactly once, in order, forwards and backwards', () => {
    for (const reel of REELS) {
      let s = play(startTransport(reel)); const heard: string[] = [];
      while (s.playing) { const next = tick(s, 1 / 60); heard.push(...cuesCrossed(CUES[reel], s.t, next.t, s.playing)); s = next; }
      expect(heard).toEqual(CUES[reel].map(c => c.kind));
      s = play(setDirection(s, true)); const back: string[] = [];
      while (s.playing) { const next = tick(s, 1 / 45); back.push(...cuesCrossed(CUES[reel], s.t, next.t, s.playing)); s = next; }
      expect(back).toEqual([...CUES[reel]].reverse().map(c => c.kind));
    }
  });
});

describe('the projector', () => {
  it('plays to the end, stops, and marks the reel watched', () => {
    let s = play(startTransport('rocket'));
    s = run(s, 4); expect(s.playing).toBe(true); expect(s.watched).toEqual([]);
    s = run(s, 5); expect(s.playing).toBe(false); expect(s.t).toBe(REEL_SECONDS.rocket); expect(s.watched).toEqual(['rocket']);
    expect(play(s).t).toBe(0); // from the end, Play starts over
  });
  it('pause freezes the frame on screen', () => {
    const s = pause(run(play(startTransport('jump')), 2.33));
    expect(s.playing).toBe(false); expect(s.t).toBe(timeOf(frameAt(2.33)));
    expect(tick(s, 1)).toBe(s);
  });
  it('backwards plays down to the start; scrubbing to the last frame also counts as watched', () => {
    let s = play(setDirection(seek(startTransport('jump'), 6), true));
    s = run(s, 10); expect(s.t).toBe(0); expect(s.playing).toBe(false); expect(s.watched).toEqual([]);
    s = seekFrame(s, lastFrame('jump')); expect(s.watched).toEqual(['jump']);
    expect(stepFrame(toStart(s), -1).t).toBe(0); expect(stepFrame(s, 1).t).toBe(REEL_SECONDS.jump);
  });
  it('watched reels stay watched across reels; the curtain needs every offered reel', () => {
    let s = seekFrame(startTransport('rocket'), 999);
    s = chooseReel(s, 'jump'); expect(s.t).toBe(0); expect(s.watched).toEqual(['rocket']);
    expect(allWatched(s, reelsFor('preschool'))).toBe(false);
    s = seekFrame(s, 999); expect(allWatched(s, reelsFor('preschool'))).toBe(false);
    s = seekFrame(chooseReel(s, 'ayaSeed'), 999); expect(allWatched(s, reelsFor('preschool'))).toBe(true); expect(allWatched(s, reelsFor('school'))).toBe(false);
  });
  it('the frog steps one hop at a time, both ways', () => {
    let s = startTransport('frog');
    for (let hop = 1; hop <= FROG_HOPS; hop++) { s = stepHop(s, 1); expect(hopsLanded(s.t)).toBe(hop); expect(momentOf('frog', s.t)).toEqual({ kind: 'hop', index: hop, total: FROG_HOPS }); }
    s = stepHop(s, 1); expect(frogFilm(s.t).touched).toBe(true);
    s = stepHop(s, 1); expect(s.watched).toEqual(['frog']);
    s = stepHop(stepHop(s, -1), -1); expect(hopsLanded(s.t)).toBe(7);
    expect(HOP_STOPS[0]).toBe(0); expect(stepHop(startTransport('frog'), -1).t).toBe(0);
  });
  it('the strip names its moment', () => {
    expect(momentOf('rocket', 0)).toEqual({ kind: 'moment', index: 1, total: 8 });
    expect(momentOf('rocket', 8)).toEqual({ kind: 'moment', index: 8, total: 8 });
    expect(momentOf('frog', 0)).toEqual({ kind: 'start' }); expect(momentOf('frog', REACH_START)).toEqual({ kind: 'reach' });
  });
  it('the halving puzzle is offered to school-age children', () => {
    expect(reelsFor('school')).toEqual(['rocket', 'jump', 'ayaSeed', 'frog']); expect(reelsFor('preschool')).toEqual(['rocket', 'jump', 'ayaSeed']);
  });
});

describe("Aya's Flower is closed-form in t", () => {
  it('Aya hops in, plants one seed, waits, and the flower opens petal by petal', () => {
    expect(ayaFilm(0).x).toBeLessThan(60); expect(ayaFilm(2).x).toBe(AYA_X1); expect(ayaFilm(2).lift).toBe(0);
    expect(ayaFilm(0.6).lift).toBeGreaterThan(10);
    expect(ayaFilm(SEED_T - 0.2).seed.o).toBe(1); expect(ayaFilm(SEED_T + 0.3).seed.o).toBe(0);
    const waiting = ayaFilm(4), grown = ayaFilm(BLOOMED_T + 0.2);
    expect(waiting.droop).toBe(1); expect(waiting.stem).toBe(0); expect(waiting.drops.length).toBeGreaterThan(0);
    expect(ayaFilm(SPROUT_T + 0.5).stem).toBeGreaterThan(0); expect(ayaFilm(SPROUT_T + 0.5).petals.every(p => p === 0)).toBe(true);
    expect(grown.petals).toEqual([1, 1, 1, 1, 1]); expect(grown.glad).toBe(true); expect(grown.droop).toBeLessThan(0.05);
    expect(ayaFilm(9).drops).toEqual([]); expect(ayaFilm(9).cloud.o).toBe(0);
  });
  it('the same t gives the same frame whatever came before, and rain exists only while it falls', () => {
    const direct = ayaFilm(3.9);
    for (let f = 0; f <= lastFrame('ayaSeed'); f++) ayaFilm(timeOf(f));
    for (let f = lastFrame('ayaSeed'); f >= 0; f--) ayaFilm(timeOf(f));
    expect(ayaFilm(3.9)).toEqual(direct);
    for (let f = 0; f <= lastFrame('ayaSeed'); f++) for (const d of ayaFilm(timeOf(f)).drops) { expect(d.y).toBeGreaterThan(90); expect(d.y).toBeLessThan(216); }
  });
  it('its cues sound once each, forwards and backwards, and carry their step', () => {
    const steps = CUES.ayaSeed.filter(c => c.kind === 'boing').map(c => c.step);
    expect(steps).toEqual([0, 1, 2, 4, 5]);
    expect(cuesPassed(CUES.frog, 0.9, 1.1, true)[0]).toMatchObject({ kind: 'boing', step: 0 });
    expect(CUES.frog.filter(c => c.kind === 'boing').map(c => c.step)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("the child's lasting choices and tonight's show are bounded and pure", () => {
  it('the porthole goes to the nearest of three places and the film moves it there', () => {
    expect(PORTHOLE_SLOTS).toHaveLength(3);
    expect(PORTHOLE_SLOTS.map(portholeSlotAt)).toEqual([0, 1, 2]); expect(portholeSlotAt(200)).toBe(0); expect(portholeSlotAt(-200)).toBe(2);
    expect(setPorthole(FRESH_HANDS, 99).porthole).toBe(2); expect(setPorthole(FRESH_HANDS, -3).porthole).toBe(0); expect(setPorthole(FRESH_HANDS, 0)).toBe(FRESH_HANDS);
    const low = setPorthole(FRESH_HANDS, 2);
    expect(rocketKey(low).eye.x).toBe(PORTHOLE_SLOTS[2]); expect(rocketFilm(5.5, low).parts.eye.x).toBe(PORTHOLE_SLOTS[2]);
    // The whale and the lump are untouched by where the porthole will go; the in-between travels toward it.
    expect(rocketFilm(1, low)).toEqual(rocketFilm(1)); expect(rocketFilm(3.2, low)).toEqual(rocketFilm(3.2));
    expect(rocketFilm(4.2, low).parts.eye.x).toBeLessThan(rocketFilm(4.2).parts.eye.x);
    expect(rocketFilm(4.2, low)).toEqual(rocketFilm(4.2, setPorthole(setPorthole(FRESH_HANDS, 1), 2)));
  });
  it('thumbprints are held inside the body and only the three newest are kept', () => {
    let h = FRESH_HANDS;
    for (const p of [[500, 500], [-30, 4], [20, -10], [44, 12]] as const) h = pressPrint(h, p);
    expect(h.prints).toHaveLength(MAX_PRINTS);
    for (const p of h.prints) { expect(Math.abs(p.x)).toBeLessThanOrEqual(62); expect(Math.abs(p.y)).toBeLessThanOrEqual(26); }
    expect(pressPrint(h, [44, 12]).prints).toHaveLength(MAX_PRINTS); // the same spot again replaces its print
    expect(pressPrint(FRESH_HANDS, [10, 3])).toEqual(pressPrint(FRESH_HANDS, [10, 3]));
    expect(FRESH_HANDS.prints).toHaveLength(0);
  });
  it('each replay is a different show; the first is always the same', () => {
    expect(showFor(0)).toEqual({ stars: 0, moon: 0, bloom: 0, sky: 0 });
    expect(showFor(1)).not.toEqual(showFor(0)); expect(showFor(2)).not.toEqual(showFor(1)); expect(showFor(3)).toEqual(showFor(0)); expect(showFor(-4)).toEqual(showFor(0));
    for (const set of STAR_SETS) { expect(set).toHaveLength(5); for (const s of set) { expect(s.x).toBeGreaterThan(30); expect(s.x).toBeLessThan(370); } }
    expect(starSwing(2, 1)).toHaveLength(5); expect(starSwing(2, 1)).toEqual(starSwing(2, 1));
  });
});
