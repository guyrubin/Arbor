import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CATCH_WIDTH, COAST_MAX, COAST_STOP, COAST_TAU_MS, CREW, DIAL_OFFSET_DEG, FRIENDS, HINT_REACH, LAP_STEPS, LAP_WIND, LEAF_RAMP, PARTICLE_CAP, PHASE_STARTS, REST_MS, SEASONS, SEASON_CENTERS, YEAR_KINDS, YEAR_STEP,
  angleDelta, angleToYear, appleState, blossomState, budState, cloudCover, cloudPaint, coastReach, coastStep, crewAt, cyclicPaint, detent, detentAt, easeInOut, fallenLeaves, friendAt, friendsAt, frost,
  fullYear, gains, hintAt, isLit, lapStep, lapTurns, leafFallAt, leafLab, leafState, lifeAt, lightAt, marksCrossed, nextSeasonCenter, particleCounts, phaseAt, pointerAngle, puddles, rainbow,
  restRemaining, restStart, restStep, restingYear, seasonAt, seasonLine, shortestTurn, skyAt, snowCap, snowDepth, springTo, startYear, stepYear, sunAt, tickIndex, turnAt, turnsToAngle, viewMix,
  weatherAt, window4, wrapYear, yearKind, yearToAngle, type LeafSeed, type Paint,
} from './seasonDialRules';
import { SEASON_DIAL_COPY } from './seasonDialCopy';
import { BOUGH_ORDERS, growTree } from './seasonWorldArt';
import { seededPlay as seeded } from './seasonDialPlay';
import { YEAR_LOOKS, applePaint, leafPaint, paint, paintResolved, shaded, yearLook } from './seasonDialPaint';
import { SEASON_DIAL_ART, SEASON_DIAL_CHILD_FILES, SEASON_VIEWS } from './seasonDialKit';

/** The tree the game draws: grown once, the same every time. */
const TREE = growTree();

/* The palette, read from the one token file, so paints can be checked as real colours. */
const here = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(here, '..', 'makerPalette.css'), 'utf8');
const PALETTE = new Map([...css.matchAll(/--mk-([a-z-]+):\s*#([0-9a-f]{6})/g)].map(m => [m[1], [0, 2, 4].map(i => parseInt(m[2].slice(i, i + 2), 16))]));
function rgb(p: Paint): number[] {
  if (typeof p === 'string') { const c = PALETTE.get(p); if (!c) throw new Error(`unknown token ${p}`); return c; }
  const a = rgb(p.a), b = rgb(p.b);
  return a.map((v, i) => v + (b[i] - v) * p.t);
}
const colourGap = (a: Paint, b: Paint) => Math.max(...rgb(a).map((v, i) => Math.abs(v - rgb(b)[i])));
const SEEDS: LeafSeed[] = Array.from({ length: 40 }, (_, i) => { const r = seeded(100 + i); return { grow: r(), turn: r(), fall: r(), hue: r() }; });
const SAMPLES = 4000;
const years = Array.from({ length: SAMPLES }, (_, i) => i / SAMPLES);

/** Every number the scene is drawn from, at one point of the year. A leaf's
 * or flower's own values only show while it is there, so they count times `on`. */
const VIEW_STOPS = SEASON_VIEWS.map(v => v.at);
function sceneNumbers(year: number): number[] {
  const sun = sunAt(year), light = lightAt(year), w = weatherAt(year), life = lifeAt(year), g = gains(year), friends = friendsAt(year), lab = leafLab(year);
  const out = [snowDepth(year), snowCap(year), puddles(year), fallenLeaves(year), rainbow(year), frost(year), cloudCover(year), sun.x / 100, sun.y / 100, sun.r / 20, sun.glowR / 100, sun.glowAlpha,
    light.warm, light.cool, light.shadow, light.shadowLength, w.rain, w.petals, w.leaves, w.snow, w.butterflies, w.cloudShadows, life.birds, life.snowman,
    g.birds, g.insects, g.wind, g.rain, g.chimes, lab.moisture, lab.light, lab.warmth, ...FRIENDS.map(f => friends[f]), ...CREW.map(c => crewAt(year)[c])];
  // The rendered views: how much of each of them shows.
  const mix = viewMix(VIEW_STOPS, year);
  VIEW_STOPS.forEach((_, i) => out.push(i === mix.to ? mix.t : i === mix.from ? 1 - mix.t : 0));
  for (const seed of SEEDS) { const s = leafState(seed, year); out.push(s.size * s.on, (s.tint / 5) * s.on, s.on, s.drop * s.on); }
  for (const seed of [0.1, 0.5, 0.9]) { const b = blossomState(seed, year), a = appleState(seed, year); out.push(b.open * b.on, b.on, budState(seed, year), a.size, a.red * a.size); }
  return out;
}
function scenePaints(year: number): Paint[] {
  const sky = skyAt(year), sun = sunAt(year);
  return [sky.top, sky.mid, sky.low, sun.core, sun.glow, cloudPaint(year)];
}

describe('Weather Maker: the year wraps and the dial maps onto it', () => {
  it('wraps any number onto [0, 1)', () => {
    expect(wrapYear(1)).toBe(0); expect(wrapYear(-0.25)).toBeCloseTo(0.75); expect(wrapYear(3.4)).toBeCloseTo(0.4);
    expect(wrapYear(Number.NaN)).toBe(0); expect(wrapYear(-1e-18)).toBeLessThan(1);
  });
  it('names the season of every point, each heart in its own season, in order round the year', () => {
    SEASONS.forEach(s => expect(seasonAt(SEASON_CENTERS[s])).toBe(s));
    expect(seasonAt(0)).toBe(0); expect(seasonAt(0.96)).toBe(0); expect(seasonAt(0.94)).toBe(3);
    expect(seasonAt(0.2)).toBe(1); expect(seasonAt(0.45)).toBe(2); expect(seasonAt(0.7)).toBe(3);
    // Each season is a quarter of the year.
    const counts = [0, 0, 0, 0]; for (const y of years) counts[seasonAt(y)]++;
    counts.forEach(c => expect(c).toBe(SAMPLES / 4));
  });
  it('turns the short way round, across the wrap too', () => {
    expect(shortestTurn(0.9, 0.1)).toBeCloseTo(0.2); expect(shortestTurn(0.1, 0.9)).toBeCloseTo(-0.2);
    expect(shortestTurn(0.3, 0.3)).toBe(0); expect(shortestTurn(0, 0.5)).toBeCloseTo(0.5);
    for (const a of [0, 0.2, 0.7]) for (const b of [0.05, 0.6, 0.99]) { const d = shortestTurn(a, b); expect(d).toBeGreaterThan(-0.5); expect(d).toBeLessThanOrEqual(0.5); expect(wrapYear(a + d)).toBeCloseTo(b); }
  });
  it('puts each season heart on a diagonal of the dial, and the angle round-trips', () => {
    expect(SEASON_CENTERS.map(yearToAngle).map(a => Math.round(a))).toEqual([45, 135, 225, 315]);
    expect(DIAL_OFFSET_DEG).toBeCloseTo(18);
    for (const y of [0, 0.123, 0.5, 0.999]) expect(angleToYear(yearToAngle(y))).toBeCloseTo(y);
    // Unwrapped turns keep the laps, so the rim visibly keeps turning.
    expect(turnsToAngle(1.25) - turnsToAngle(0.25)).toBe(360);
  });
  it('reads a finger angle clockwise from twelve o’clock and turns across 0°', () => {
    expect(pointerAngle(0, -10)).toBe(0); expect(pointerAngle(10, 0)).toBe(90); expect(pointerAngle(0, 10)).toBe(180); expect(pointerAngle(-10, 0)).toBe(270);
    expect(angleDelta(350, 10)).toBeCloseTo(20 / 360); expect(angleDelta(10, 350)).toBeCloseTo(-20 / 360);
  });
  it('detents pull gently onto each heart, with no jump anywhere', () => {
    for (const c of SEASON_CENTERS) {
      expect(detent(c)).toBeCloseTo(c); expect(Math.abs(shortestTurn(c, detent(c + 0.008)))).toBeLessThan(0.008);
      expect(detent(c + 0.05)).toBeCloseTo(c + 0.05);
    }
    let worst = 0;
    for (let i = 0; i < SAMPLES; i++) worst = Math.max(worst, Math.abs(shortestTurn(detent(years[i]), detent(years[(i + 1) % SAMPLES]))));
    expect(worst).toBeLessThan(3 / SAMPLES);
    expect(detentAt(SEASON_CENTERS[2])).toBe(2); expect(detentAt(SEASON_CENTERS[2] + 0.02)).toBeNull();
  });
  it('steps half a month, wrapping, and finds the next or previous season heart', () => {
    expect(stepYear(0.99, 1)).toBeCloseTo(0.99 + YEAR_STEP - 1); expect(stepYear(0.01, -1)).toBeCloseTo(1 + 0.01 - YEAR_STEP);
    expect(nextSeasonCenter(SEASON_CENTERS[0], 1)).toBe(SEASON_CENTERS[1]); expect(nextSeasonCenter(SEASON_CENTERS[0], -1)).toBe(SEASON_CENTERS[3]);
    expect(nextSeasonCenter(0.25, 1)).toBe(SEASON_CENTERS[1]); expect(nextSeasonCenter(0.4, 1)).toBe(SEASON_CENTERS[2]);
    expect(nextSeasonCenter(0.98, 1)).toBe(SEASON_CENTERS[0]); expect(nextSeasonCenter(0.02, -1)).toBe(SEASON_CENTERS[3]);
  });
  it('a season button turns the short way and lands exactly on the heart', () => {
    expect(turnAt(2.9, 0.075, 0)).toBeCloseTo(2.9); expect(wrapYear(turnAt(2.9, 0.075, 1))).toBeCloseTo(0.075);
    expect(turnAt(2.9, 0.075, 1)).toBeCloseTo(3.075); // forward over the wrap, not back round
    expect(turnAt(0.1, 0.825, 1)).toBeCloseTo(-0.175); // back over the wrap
    expect(easeInOut(0)).toBe(0); expect(easeInOut(1)).toBe(1); expect(easeInOut(0.5)).toBeCloseTo(0.5);
  });
});

describe('Weather Maker: the dial has weight', () => {
  it('swings onto a mark, passes it by a hair and settles exactly on it', () => {
    expect(springTo(0)).toBe(0); expect(springTo(1)).toBe(1);
    let peak = 0, low = 0;
    for (let i = 0; i <= 400; i++) { const v = springTo(i / 400); peak = Math.max(peak, v); low = Math.min(low, v); }
    expect(low).toBe(0);                 // no wind-back
    expect(peak).toBeGreaterThan(1.005); // a real overshoot …
    expect(peak).toBeLessThan(1.04);     // … but a tiny one
    for (let i = 360; i <= 400; i++) expect(Math.abs(springTo(i / 400) - 1)).toBeLessThan(0.004);
    // The let-go settle is livelier (a lower damping), still bounded.
    let settle = 0; for (let i = 0; i <= 400; i++) settle = Math.max(settle, springTo(i / 400, 0.5));
    expect(settle).toBeGreaterThan(peak); expect(settle).toBeLessThan(1.2);
    // A half-year turn overshoots by under seven degrees of the dial.
    let far = 0; for (let i = 0; i <= 400; i++) far = Math.max(far, turnAt(0.075, 0.575, i / 400));
    expect((far - 0.575) * 360).toBeLessThan(7);
  });
  it('coasts when let go, its speed dying away, however the frames fall', () => {
    const whole = coastStep(1.2, 2000), a = coastStep(1.2, 16);
    expect(a.speed).toBeLessThan(1.2); expect(a.advance).toBeGreaterThan(0);
    // Many small frames travel as far as one long one: frame rate cannot change where it lands.
    let v = 1.2, far = 0; for (let t = 0; t < 2000; t += 8) { const out = coastStep(v, 8); v = out.speed; far += out.advance; }
    expect(far).toBeCloseTo(whole.advance, 5);
    expect(whole.advance).toBeCloseTo((1.2 * COAST_TAU_MS) / 1000, 2);
    expect(coastStep(99, 0).speed).toBe(COAST_MAX); expect(coastStep(-99, 0).speed).toBe(-COAST_MAX);
    expect(coastReach(COAST_STOP / 2)).toBe(0); expect(coastReach(-1)).toBeLessThan(0); expect(coastReach(1)).toBeCloseTo(-coastReach(-1));
    expect(coastStep(Number.NaN, 16)).toEqual({ speed: 0, advance: 0 });
  });
  it('drops into a season heart when it comes to rest near one, and nowhere else', () => {
    for (const c of SEASON_CENTERS) { expect(restingYear(c + CATCH_WIDTH * 0.9)).toBe(c); expect(restingYear(c - CATCH_WIDTH * 0.9)).toBe(c); }
    expect(restingYear(0.2)).toBeCloseTo(0.2); expect(restingYear(1.2)).toBeCloseTo(0.2);
  });
  it('counts the engraved marks the pointer passes, and names the season hearts among them', () => {
    expect(marksCrossed(0.1, 0.1)).toEqual({ ticks: 0, seasons: [] });
    // One mark every 15 degrees; spring's heart is the mark at 45.
    expect(tickIndex(SEASON_CENTERS[0])).toBe(3);
    expect(marksCrossed(SEASON_CENTERS[0] - 0.01, SEASON_CENTERS[0] + 0.01)).toEqual({ ticks: 0, seasons: [0] });
    expect(marksCrossed(SEASON_CENTERS[0] + 0.01, SEASON_CENTERS[0] - 0.01)).toEqual({ ticks: 0, seasons: [0] });
    // A whole lap forward passes all 24 marks: 20 plain ticks and the four hearts in order; backward, in reverse.
    const from = SEASON_CENTERS[0] + 0.01;
    expect(marksCrossed(from, from + 1)).toEqual({ ticks: 20, seasons: [1, 2, 3, 0] });
    expect(marksCrossed(from + 1, from)).toEqual({ ticks: 20, seasons: [0, 3, 2, 1] });
    expect(marksCrossed(-0.3, -0.29).ticks + marksCrossed(-0.3, -0.29).seasons.length).toBeLessThanOrEqual(1);
    expect(marksCrossed(0, Number.NaN)).toEqual({ ticks: 0, seasons: [] });
  });
});

describe('Weather Maker: the lap, the hint and a different year each time', () => {
  it('the lap winds back a little, goes once round and lands exactly where it began', () => {
    expect(lapTurns(2.3, 0)).toBe(2.3); expect(lapTurns(2.3, 1)).toBeCloseTo(3.3, 10);
    let low = 2.3, last = 2.3, turnedBack = 0;
    for (let i = 0; i <= 1000; i++) { const v = lapTurns(2.3, i / 1000); low = Math.min(low, v); if (i > 80 && v < last - 1e-9) turnedBack++; expect(Math.abs(v - last)).toBeLessThan(0.004); last = v; }
    expect(2.3 - low).toBeCloseTo(LAP_WIND, 3); expect(turnedBack).toBe(0);
    // The music box: sixteen steps, each reached once, in order; none during the wind-up.
    const steps = Array.from({ length: 1001 }, (_, i) => lapStep(2.3, lapTurns(2.3, i / 1000)));
    expect(steps[20]).toBe(-1); expect(new Set(steps.filter(s => s >= 0)).size).toBe(LAP_STEPS);
    expect(Math.max(...steps)).toBe(LAP_STEPS - 1);
    // Past its wind-up, the lap passes every heart exactly once.
    const hearts: number[] = []; for (let i = 0; i < 1000; i++) hearts.push(...marksCrossed(lapTurns(SEASON_CENTERS[1] + 0.03, i / 1000), lapTurns(SEASON_CENTERS[1] + 0.03, (i + 1) / 1000)).seasons);
    expect(hearts).toEqual([2, 3, 0, 1]);
  });
  it('the showing hand turns the dial a little way on and brings it back to where it was', () => {
    expect(hintAt(0)).toEqual({ offset: 0, show: 0, press: 0 }); expect(hintAt(1).offset).toBeCloseTo(0); expect(hintAt(1).show).toBe(0);
    let peak = 0; for (let i = 0; i <= 200; i++) { const h = hintAt(i / 200); peak = Math.max(peak, h.offset); expect(h.offset).toBeGreaterThanOrEqual(0); if (h.offset > 0.001) expect(h.show).toBeGreaterThan(0.5); }
    expect(peak).toBeCloseTo(HINT_REACH, 3); expect(hintAt(0.64).press).toBe(1);
  });
  it('opens each round one season on, in one of three years', () => {
    expect([0, 1, 2, 3, 4].map(startYear)).toEqual([SEASON_CENTERS[0], SEASON_CENTERS[1], SEASON_CENTERS[2], SEASON_CENTERS[3], SEASON_CENTERS[0]]);
    expect(new Set([0, 1, 2].map(r => yearKind(100, r))).size).toBe(YEAR_KINDS);
    expect(yearKind(100, 1)).not.toBe(yearKind(100, 0)); expect(yearKind(-5, 0)).toBeGreaterThanOrEqual(0); expect(yearKind(Number.NaN, 2)).toBe(2);
    expect(YEAR_LOOKS).toHaveLength(YEAR_KINDS); expect(yearLook(4)).toBe(YEAR_LOOKS[1]); expect(yearLook(-1)).toBe(YEAR_LOOKS[2]);
  });
});

describe('Weather Maker: badges light for seasons the dial rests in', () => {
  it('lights only after REST_MS in one season; a move to another season restarts the clock', () => {
    let s = restStart(0.075, 0);
    s = restStep(s, 0.08, REST_MS - 1); expect(isLit(s.lit, 0)).toBe(false); expect(restRemaining(s, REST_MS - 1)).toBe(1);
    s = restStep(s, 0.33, REST_MS + 10); expect(s.season).toBe(1); expect(s.lit).toBe(0);
    s = restStep(s, 0.34, REST_MS + 10 + REST_MS); expect(isLit(s.lit, 1)).toBe(true); expect(restRemaining(s, 0)).toBeNull();
    // Passing quickly through a season lights nothing.
    s = restStep(s, 0.6, 5000); s = restStep(s, 0.85, 5100); s = restStep(s, 0.1, 5200);
    expect(s.lit).toBe(2);
  });
  it('a full year is all four, in any order', () => {
    let s = restStart(0.8, 0), t = 0;
    for (const y of [0.8, 0.55, 0.1, 0.3]) { s = restStep(s, y, t += 10); s = restStep(s, y, t += REST_MS); }
    expect(fullYear(s.lit)).toBe(true); expect(fullYear(7)).toBe(false);
  });
});

describe('Weather Maker: the scene is one continuous function of the year', () => {
  it('is deterministic and keeps no memory of the path taken', () => {
    const at = (y: number) => JSON.stringify([sceneNumbers(y), scenePaints(y)]);
    const before = at(0.83);
    // Spin fast back and forth through everything.
    for (let i = 0; i < 500; i++) { sceneNumbers((i * 0.37) % 1); scenePaints((i * 0.61) % 1); }
    expect(at(0.83)).toBe(before);
  });
  it('never jumps between neighbouring moments, including across the wrap (0.999 → 0)', () => {
    let worstNumber = 0, worstColour = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const a = years[i], b = years[(i + 1) % SAMPLES];
      const na = sceneNumbers(a), nb = sceneNumbers(b);
      for (let k = 0; k < na.length; k++) worstNumber = Math.max(worstNumber, Math.abs(na[k] - nb[k]));
      const pa = scenePaints(a), pb = scenePaints(b);
      for (let k = 0; k < pa.length; k++) worstColour = Math.max(worstColour, colourGap(pa[k], pb[k]));
    }
    expect(worstNumber).toBeLessThan(0.05);
    expect(worstColour).toBeLessThan(3);
    const wrapA = sceneNumbers(0.99999), wrapB = sceneNumbers(0);
    wrapA.forEach((v, k) => expect(Math.abs(v - wrapB[k])).toBeLessThan(0.01));
  });
  it('turns the tree through the year: buds, blossom, green, turned, bare, snow', () => {
    const on = (y: number) => TREE.leaves.filter(l => leafState(l.seed, y).on > 0.5);
    expect(TREE.blossoms.some(b => budState(b.seed, 0.97) > 0.5)).toBe(true);
    expect(TREE.blossoms.filter(b => blossomState(b.seed, SEASON_CENTERS[0]).open > 0.6).length).toBeGreaterThan(TREE.blossoms.length * 0.8);
    expect(TREE.blossoms.every(b => blossomState(b.seed, 0.2).on === 0)).toBe(true);
    const summer = on(SEASON_CENTERS[1]);
    expect(summer.length).toBe(TREE.leaves.length);
    expect(summer.every(l => { const s = leafState(l.seed, SEASON_CENTERS[1]); return s.size > 0.95 && s.tint > 1.2 && s.tint < 2; })).toBe(true);
    const autumn = on(0.52);
    expect(autumn.filter(l => leafState(l.seed, 0.52).tint > 3).length).toBeGreaterThan(autumn.length * 0.6);
    expect(on(SEASON_CENTERS[3])).toHaveLength(0);
    expect(snowDepth(SEASON_CENTERS[3])).toBe(1); expect(snowCap(SEASON_CENTERS[3])).toBe(1);
    expect(snowDepth(SEASON_CENTERS[1])).toBe(0); expect(snowCap(SEASON_CENTERS[0])).toBe(0);
    expect(TREE.apples.some(a => appleState(a.seed, 0.4).size > 0.9)).toBe(true);
  });
  it('lets the leaves go one by one, sweeping through the crown, never all at once', () => {
    const counts = [0.5, 0.54, 0.58, 0.62, 0.66, 0.69].map(y => TREE.leaves.filter(l => leafState(l.seed, y).on > 0.5).length);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThan(counts[i - 1]);
    let worst = 0;
    for (let y = 0.5; y < 0.7; y += 0.0005) { const n = TREE.leaves.filter(l => leafState(l.seed, y).on > 0.5).length, m = TREE.leaves.filter(l => leafState(l.seed, y + 0.0005).on > 0.5).length; worst = Math.max(worst, n - m); }
    expect(worst).toBeLessThan(TREE.leaves.length * 0.05);
    // The windward (left) half of the crown lets go first, on the whole.
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const left = TREE.leaves.filter(l => l.x < TREE.crown.cx).map(l => leafFallAt(l.seed)), right = TREE.leaves.filter(l => l.x >= TREE.crown.cx).map(l => leafFallAt(l.seed));
    expect(mean(left)).toBeLessThan(mean(right));
  });
  it('grows one fixed tree, a full crown on a short trunk, the same every time', () => {
    expect(TREE.leaves.length).toBeGreaterThanOrEqual(900); expect(TREE.blossoms.length).toBeGreaterThanOrEqual(100); expect(TREE.apples).toHaveLength(12);
    for (const l of TREE.leaves) { expect(Math.abs(l.x)).toBeLessThanOrEqual(TREE.reach); expect(l.y).toBeLessThan(-0.12); expect(l.y - l.len).toBeGreaterThanOrEqual(-1.0001); }
    expect(Math.min(...TREE.leaves.map(l => l.y - l.len))).toBeCloseTo(-1, 6); // the tree's own height is 1
    expect(TREE.reach).toBeGreaterThan(0.4); expect(TREE.reach).toBeLessThan(0.75); // a wide apple crown, but it fits a phone
    expect(TREE.segs.filter(s => s.depth === 0).every(s => s.y1 > -0.36 && s.w1 > 0.06)).toBe(true); // a stout trunk
    const again = growTree();
    expect(again.leaves.slice(0, 40)).toEqual(TREE.leaves.slice(0, 40)); expect(again.segs.length).toBe(TREE.segs.length);
    expect(growTree(7).leaves[0]).not.toEqual(TREE.leaves[0]);
  });
  it('changes bough by bough: each bough takes its turn to leaf, to colour and to let go', () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    for (const key of ['grow', 'turn', 'fall'] as const) {
      const byBough = Array.from({ length: TREE.boughs }, (_, b) => mean(TREE.leaves.filter(l => l.bough === b).map(l => l.seed[key])));
      const order = byBough.map((_, b) => b).sort((p, q) => byBough[p] - byBough[q]);
      expect(order, key).toEqual([...BOUGH_ORDERS[key]]);
    }
    // In mid-fall the first bough is nearly bare while the last still holds most of its leaves.
    const held = (bough: number, y: number) => { const own = TREE.leaves.filter(l => l.bough === bough); return own.filter(l => leafState(l.seed, y).on > 0.5).length / own.length; };
    expect(held(BOUGH_ORDERS.fall[0], 0.585)).toBeLessThan(0.35); expect(held(BOUGH_ORDERS.fall[4], 0.585)).toBeGreaterThan(0.75);
    // And in early spring the first bough is in leaf before the last has begun.
    const grownOn = (bough: number, y: number) => mean(TREE.leaves.filter(l => l.bough === bough).map(l => leafState(l.seed, y).size));
    expect(grownOn(BOUGH_ORDERS.grow[0], 0.1)).toBeGreaterThan(grownOn(BOUGH_ORDERS.grow[4], 0.1) + 0.15);
  });
});

describe('Weather Maker: weather, life and sound follow the year', () => {
  it('draws at most PARTICLE_CAP particles, and only the season’s own', () => {
    for (const y of years.filter((_, i) => i % 8 === 0)) {
      const n = particleCounts(weatherAt(y));
      expect(n.rain + n.petals + n.leaves + n.snow).toBeLessThanOrEqual(PARTICLE_CAP);
    }
    const summer = particleCounts(weatherAt(0.33)), winter = particleCounts(weatherAt(0.82)), spring = particleCounts(weatherAt(0.15)), autumn = particleCounts(weatherAt(0.6));
    expect(summer).toEqual({ rain: 0, petals: 0, leaves: 0, snow: 0 }); expect(weatherAt(0.33).butterflies).toBeGreaterThan(0.9);
    expect(winter.snow).toBeGreaterThan(60); expect(winter.rain + winter.leaves).toBe(0);
    expect(spring.rain).toBeGreaterThan(50); expect(spring.snow).toBe(0);
    expect(autumn.leaves).toBeGreaterThan(20); expect(autumn.snow + autumn.rain).toBe(0);
    expect(particleCounts({ rain: 1, petals: 1, leaves: 1, snow: 1, butterflies: 0, cloudShadows: 0 })).toSatisfy((n: Record<string, number>) => Object.values(n).reduce((a, b) => a + b, 0) <= PARTICLE_CAP);
  });
  it('fades the small life in and out with the year', () => {
    expect(lifeAt(0.2).birds).toBe(1); expect(lifeAt(0.8).birds).toBe(0);
    expect(lifeAt(0.84).snowman).toBe(1); expect(lifeAt(0.33).snowman).toBe(0);
    expect(rainbow(0.222)).toBe(1); expect(rainbow(0.33)).toBe(0); expect(frost(0.84)).toBe(1); expect(frost(0.5)).toBe(0);
  });
  it('keeps one friend on the terrace all year: Aya through snow and blossom, Chock in summer, Pep in autumn', () => {
    expect(SEASON_CENTERS.map(friendAt)).toEqual(['ayaSpring', 'chockSummer', 'pepAutumn', 'ayaWinter']);
    for (const y of years.filter((_, i) => i % 10 === 0)) {
      const all = friendsAt(y), there = FRIENDS.map(f => all[f]);
      expect(Math.max(...there)).toBeGreaterThan(0.49);                // never an empty terrace
      expect(there.filter(v => v > 0.5).length).toBeLessThanOrEqual(2); // a hand-over, never a crowd
    }
  });
  it('the children of the valley come out for their weather: GobGob for the rain, Bebe for the snow', () => {
    expect(crewAt(0.16)).toEqual({ gobgobRain: 1, bebeSnow: 0 }); expect(crewAt(0.84)).toEqual({ gobgobRain: 0, bebeSnow: 1 });
    expect(crewAt(SEASON_CENTERS[1])).toEqual({ gobgobRain: 0, bebeSnow: 0 }); expect(crewAt(SEASON_CENTERS[2])).toEqual({ gobgobRain: 0, bebeSnow: 0 });
    // GobGob is only out while it rains; Bebe only while the snow friend stands.
    for (const y of years.filter((_, i) => i % 10 === 0)) { const c = crewAt(y); if (c.gobgobRain > 0.5) expect(weatherAt(y).rain).toBeGreaterThan(0.2); if (c.bebeSnow > 0.5) expect(lifeAt(y).snowman).toBeGreaterThan(0.5); }
    expect(CREW).toHaveLength(2);
  });
  it('cross-fades the rendered views round the year: one whole, the next over it, never a gap', () => {
    expect(VIEW_STOPS).toEqual([...VIEW_STOPS].sort((a, b) => a - b));
    SEASON_VIEWS.forEach((v, i) => expect(viewMix(VIEW_STOPS, v.at)).toEqual({ from: i, to: (i + 1) % VIEW_STOPS.length, t: 0 }));
    for (const y of years.filter((_, i) => i % 7 === 0)) { const m = viewMix(VIEW_STOPS, y); expect(m.t).toBeGreaterThanOrEqual(0); expect(m.t).toBeLessThan(1); expect(m.to).toBe((m.from + 1) % VIEW_STOPS.length); }
    // The four hearts each have their own picture, and the wrap (thaw → spring) is one of the fades.
    expect(SEASON_CENTERS.map(c => SEASON_VIEWS[viewMix(VIEW_STOPS, c).from].id)).toEqual(['view-spring', 'view-summer', 'view-autumn', 'view-winter']);
    expect(viewMix(VIEW_STOPS, 0.01).from).toBe(VIEW_STOPS.length - 1); expect(viewMix(VIEW_STOPS, 0.01).to).toBe(0);
    expect(viewMix([0.5], 0.2)).toEqual({ from: 0, to: 0, t: 0 });
  });
  it('LeafLab reads what the garden feels from the year alone: wet in the rain, bright and warm in summer, cold in winter', () => {
    for (const y of years.filter((_, i) => i % 16 === 0)) for (const v of Object.values(leafLab(y))) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    const rain = leafLab(0.16), summer = leafLab(0.34), winter = leafLab(0.84);
    expect(rain.moisture).toBeGreaterThan(0.85); expect(summer.moisture).toBeLessThan(0.25);
    expect(summer.light).toBeGreaterThan(0.85); expect(winter.light).toBeLessThan(0.3); expect(rain.light).toBeLessThan(summer.light);
    expect(summer.warmth).toBeGreaterThan(0.9); expect(winter.warmth).toBeLessThan(0.1);
  });
  it('names every kit picture it shows, with its size and the kit file it came from', () => {
    for (const art of SEASON_DIAL_ART) {
      expect(art.src).toMatch(/^\/visuals\/studio-v2\/(bop|makers)\/[a-z0-9-]+\.webp$/); expect(art.width).toBeGreaterThan(0); expect(art.height).toBeGreaterThan(0);
      expect(art.source).toMatch(/^(studio-v2\/bop\/|kit\/v30\/)/); expect(art.edit.length).toBeGreaterThan(3);
      // A picture that shows a child of the kit is the shared library's own file and says so in its name;
      // nothing this activity cut itself (season-dial-*) shows one.
      const child = /bebe|gobgob|crew/.test(art.src);
      expect(SEASON_DIAL_CHILD_FILES.includes(art.src)).toBe(child);
      if (child) expect(art.src).toMatch(/\/makers\/kit-(bebe|gobgob)-/);
      if (art.src.includes('season-dial-')) expect(child).toBe(false);
    }
    expect(SEASON_DIAL_CHILD_FILES).toHaveLength(2);
    for (const v of SEASON_VIEWS) if (v.picture.src.includes('/makers/')) expect(existsSync(path.join(here, '..', '..', '..', '..', '..', '..', '..', 'public', v.picture.src)), v.picture.src).toBe(true);
  });
  it('sets every sound layer from the year alone, between 0 and 1', () => {
    for (const y of years.filter((_, i) => i % 16 === 0)) for (const v of Object.values(gains(y))) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    const summer = gains(0.36), winter = gains(0.82), autumn = gains(0.6), spring = gains(0.15);
    expect(summer.insects).toBe(1); expect(summer.wind + summer.chimes + summer.rain).toBe(0);
    expect(winter.chimes).toBe(1); expect(winter.birds + winter.insects).toBe(0);
    expect(autumn.wind).toBe(1); expect(spring.birds).toBe(1); expect(spring.rain).toBeGreaterThan(0.5);
  });
  it('windows and keyframes wrap cleanly', () => {
    expect(window4(0.0, 0.9, 0.95, 0.05, 0.1)).toBe(1); expect(window4(0.5, 0.9, 0.95, 0.05, 0.1)).toBe(0);
    expect(rgb(cyclicPaint([[0.2, 'red'], [0.7, 'snow']], 0.2))).toEqual(rgb('red'));
    expect(colourGap(cyclicPaint([[0.2, 'red'], [0.7, 'snow']], 0.1999), cyclicPaint([[0.2, 'red'], [0.7, 'snow']], 0.2001))).toBeLessThan(1);
  });
});

describe('Weather Maker: paint, words and the eight described moments', () => {
  it('writes colour only through palette tokens and color-mix', () => {
    expect(paint('leaf')).toBe('var(--mk-leaf)');
    expect(paint({ a: 'leaf', b: 'red', t: 0.25 })).toBe('color-mix(in srgb, var(--mk-leaf), var(--mk-red) 25%)');
    for (let t = 0; t <= 5; t += 0.25) expect(paint(shaded(leafPaint(t), 0.7))).not.toMatch(/#|\brgba?\(|hsla?\(/);
    expect(LEAF_RAMP.every(name => PALETTE.has(name))).toBe(true);
    for (const y of years.filter((_, i) => i % 100 === 0)) for (const p of scenePaints(y)) expect(() => rgb(p)).not.toThrow();
    // The canvas twin of a paint is the same mix, of the palette's resolved values.
    expect(paintResolved({ a: 'leaf', b: 'red', t: 0.25 }, { leaf: 'lime', red: 'crimson' })).toBe('color-mix(in srgb, lime, crimson 25%)');
    expect(paintResolved('amber', {})).toBe('currentColor');
    // An apple ripens without a jump, in each of the three years' colours.
    for (const kind of [0, 1, 2]) for (let r = 0; r < 1; r += 0.004) expect(colourGap(applePaint(r, kind), applePaint(r + 0.004, kind))).toBeLessThan(3);
  });
  it('names one of eight moments for every point of the year, in order', () => {
    expect(PHASE_STARTS).toHaveLength(SEASON_DIAL_COPY.en.phases.length);
    expect(phaseAt(0.95)).toBe(0); expect(phaseAt(0.075)).toBe(1); expect(phaseAt(0.33)).toBe(3); expect(phaseAt(0.55)).toBe(5); expect(phaseAt(0.82)).toBe(7);
    PHASE_STARTS.forEach((start, i) => expect(phaseAt(start + 0.001)).toBe(i));
  });
  it('has every line in English and Hebrew, with the same shape', () => {
    const { en, he } = SEASON_DIAL_COPY;
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
    expect(he.seasons).toHaveLength(4); expect(he.phases).toHaveLength(8);
    const lines = (v: unknown): string[] => (typeof v === 'string' ? [v] : Object.values(v as object).flatMap(lines));
    for (const [k, v] of Object.entries(he)) for (const line of lines(v)) { expect(line, k).toMatch(/[א-ת]/); expect(line, k).not.toMatch(/[A-Za-z]/); }
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(lines(he[k]).length, k).toBe(lines(en[k]).length);
    for (const k of ['asks', 'nudges', 'friends'] as const) expect(Object.keys(he[k]).sort()).toEqual(Object.keys(en[k]).sort());
    expect(seasonLine(en.filmEnd, en.seasons[2])).toBe('Autumn at golden hour');
    expect(seasonLine(he.lit, he.seasons[3])).toBe('חורף על החוגה.');
  });
});
