import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DIAL_OFFSET_DEG, LEAF_RAMP, PARTICLE_CAP, PHASE_STARTS, REST_MS, SEASONS, SEASON_CENTERS, YEAR_STEP, angleDelta, angleToYear, appleState, blossomState, budState,
  cloudCover, cloudPaint, cyclicPaint, detent, detentAt, easeInOut, fallenLeaves, fullYear, gains, groundAt, isLit, leafFallAt, leafState, lifeAt, lightAt,
  meadowFlowers, nextSeasonCenter, particleCounts, phaseAt, pointerAngle, puddles, restRemaining, restStart, restStep, seasonAt, seasonLine, shortestTurn,
  skyAt, snowCap, snowDepth, stepYear, sunAt, turnAt, turnsToAngle, weatherAt, window4, wrapYear, yearToAngle, type LeafSeed, type Paint,
} from './seasonDialRules';
import { SEASON_DIAL_COPY } from './seasonDialCopy';
import { TREE, seeded } from './seasonDialTree';
import { leafPaint, paint, shaded } from './seasonDialPaint';

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
function sceneNumbers(year: number): number[] {
  const sun = sunAt(year), light = lightAt(year), w = weatherAt(year), life = lifeAt(year), g = gains(year);
  const out = [snowDepth(year), snowCap(year), puddles(year), fallenLeaves(year), meadowFlowers(year), cloudCover(year), sun.x / 100, sun.y / 100, sun.r / 20, sun.glowR / 100, sun.glowAlpha,
    light.warm, light.cool, light.shadow, light.shadowLength, w.rain, w.petals, w.leaves, w.snow, w.butterflies, w.cloudShadows, life.birds, life.squirrel, life.snowman,
    g.birds, g.insects, g.wind, g.rain, g.chimes, groundAt(year).grass];
  for (const seed of SEEDS) { const s = leafState(seed, year); out.push(s.size * s.on, (s.tint / 5) * s.on, s.on, s.drop * s.on); }
  for (const seed of [0.1, 0.5, 0.9]) { const b = blossomState(seed, year), a = appleState(seed, year); out.push(b.open * b.on, b.on, budState(seed, year), a.size, a.red * a.size); }
  return out;
}
function scenePaints(year: number): Paint[] {
  const sky = skyAt(year), sun = sunAt(year), ground = groundAt(year);
  return [sky.top, sky.mid, sky.low, sun.core, sun.glow, ground.near, ground.nearShade, ground.far, ground.treeline, cloudPaint(year)];
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
    expect(TREE.buds.some(b => budState(b.seed, 0.97) > 0.5)).toBe(true);
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
  it('grows one fixed tree: ~140+ leaves inside the scene, the same every time', () => {
    expect(TREE.leaves.length).toBeGreaterThanOrEqual(140);
    for (const l of TREE.leaves) { expect(l.x).toBeGreaterThan(20); expect(l.x).toBeLessThan(380); expect(l.y).toBeGreaterThan(20); expect(l.y).toBeLessThan(260); }
    const a = seeded(5), b = seeded(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
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
    expect(lifeAt(0.58).squirrel).toBe(1); expect(lifeAt(0.2).squirrel).toBe(0);
    expect(lifeAt(0.84).snowman).toBe(1); expect(lifeAt(0.33).snowman).toBe(0);
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
    for (const [k, v] of Object.entries(he)) for (const line of [v].flat()) { expect(line, k).toMatch(/[א-ת]/); expect(line, k).not.toMatch(/[A-Za-z]/); }
    expect(seasonLine(en.goTo, en.seasons[2])).toBe('Turn to Autumn');
    expect(seasonLine(he.lit, he.seasons[3])).toBe('חורף מאיר על החוגה.');
  });
});
