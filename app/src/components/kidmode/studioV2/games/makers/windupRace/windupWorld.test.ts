import { describe, expect, it } from 'vitest';
import { buildPlay, type Course } from './windupRaceRules';
import { ARCH_HALF, ARCH_SPRING, BAY, FLOWER_HUES, FX_CAP, Fx, TRACK_HALF, WALL_Z, buildScenery, ink, lightOn, litAt, mixTone, sunFor } from './windupWorld';

const SEEDS = [1, 7, 42, 2026, 77777];
const arcadeAt = (course: Course, x: number) => course.zones.some(zone => zone.kind === 'arcade' && x >= zone.from && x <= zone.to);

describe('the scenery follows the course', () => {
  it('arches stand only along arcade walls, a bay apart, each with a fern planter at its pier', () => {
    for (const seed of SEEDS) for (const course of buildPlay(seed)) {
      const scenery = buildScenery(course);
      for (const arch of scenery.arches) { expect(arcadeAt(course, arch - ARCH_HALF)).toBe(true); expect(arcadeAt(course, arch + ARCH_HALF)).toBe(true); }
      const sorted = [...scenery.arches].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(BAY);
      if (course.zones.some(zone => zone.kind === 'arcade')) { expect(scenery.arches.length).toBeGreaterThan(1); expect(scenery.piers.length).toBeGreaterThan(scenery.arches.length - 1); }
    }
  });
  it('every gust is shown by pennants and pots of grass, standing inside it and clear of the track', () => {
    for (const seed of SEEDS) for (const course of buildPlay(seed)) {
      const scenery = buildScenery(course);
      course.gusts.forEach((gust, index) => {
        const flags = scenery.flags.filter(flag => flag.gust === index), reeds = scenery.reeds.filter(reed => reed.gust === index);
        expect(flags.length).toBeGreaterThanOrEqual(3); expect(reeds.length).toBeGreaterThanOrEqual(2);
        for (const thing of [...flags, ...reeds]) { expect(thing.x).toBeGreaterThanOrEqual(gust.from); expect(thing.x).toBeLessThanOrEqual(gust.to); expect(thing.z).toBeGreaterThan(TRACK_HALF + 0.5); }
      });
      if (!course.gusts.length) { expect(scenery.flags).toHaveLength(0); expect(scenery.reeds).toHaveLength(0); }
      // Planters keep out of the gusts and the ramps, and out of the track.
      for (const pot of scenery.pots) {
        expect(course.gusts.some(gust => pot.x > gust.from && pot.x < gust.to)).toBe(false);
        expect(course.hills.some(hill => pot.x > hill.from && pot.x < hill.from + hill.up + hill.flat)).toBe(false);
        expect(pot.z).toBeGreaterThan(TRACK_HALF + 1.5); expect([0, 1, 2]).toContain(pot.kind);
      }
    }
  });
  it('the same course always gets the same scenery', () => {
    const [a] = buildPlay(31); expect(buildScenery(a)).toEqual(buildScenery(a));
  });
});

describe('one sun', () => {
  const [straight, gustAlley] = buildPlay(7), scenery = buildScenery(straight);
  it.each(['morning', 'noon', 'goldenHour'] as const)('%s: sunlight falls through each arch as a pool on the floor, and the piers between cast shade', light => {
    const sun = sunFor(light), arch = scenery.arches.find(a => a > 10)!;
    // Follow one sunbeam from the middle of the arch, half-way up, down to the floor.
    const h = ARCH_SPRING * 0.5, poolX = arch + sun.kx * h, poolZ = WALL_Z - sun.kz * h;
    expect(litAt(straight, scenery, sun, poolX, poolZ)).toBe(1);
    // The same distance from the wall, but under a pier: shade.
    expect(litAt(straight, scenery, sun, poolX + BAY / 2, poolZ)).toBe(0);
    // A beam that would have had to pass above the arch's crown is stopped by the wall.
    const high = ARCH_SPRING + ARCH_HALF + 2;
    expect(litAt(straight, scenery, sun, arch + sun.kx * high, WALL_Z - sun.kz * high)).toBe(0);
    // The pool crosses the track: Rover drives through light and shade.
    const row = Array.from({ length: 80 }, (_, i) => litAt(straight, scenery, sun, i * 0.5, 0));
    expect(row).toContain(0); expect(row).toContain(1);
  });
  it('the open terrace is in the sun, and so is anything beyond the wall', () => {
    const sun = sunFor('noon'), open = buildScenery(gustAlley);
    for (const x of [20, 35, 50]) expect(litAt(gustAlley, open, sun, x, 0)).toBe(1);
    expect(litAt(straight, scenery, sun, 12, WALL_Z + 4)).toBe(1);
  });
  it('a thing in the air is lit by the beam that reaches its height, and the edge of a pool is soft', () => {
    const sun = sunFor('noon'), arch = scenery.arches.find(a => a > 10)!;
    const h = ARCH_SPRING * 0.5 + 1.2, x = arch + sun.kx * (h - 1.2), z = WALL_Z - sun.kz * (h - 1.2);
    expect(litAt(straight, scenery, sun, x, z, 1.2)).toBe(1);
    const soft = Array.from({ length: 120 }, (_, i) => lightOn(straight, scenery, sun, i * 0.25, 0));
    expect(soft.some(v => v > 0 && v < 1)).toBe(true); for (const v of soft) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
});

describe('colour and small things', () => {
  it('colours are mixed in code and written without a literal', () => {
    expect(mixTone([0, 0, 0], [1, 0.5, 0], 0.5)).toEqual([0.5, 0.25, 0]);
    expect(ink([1, 0.5, 0], 0.25)).toBe('color(srgb 1.000 0.500 0.000 / 0.250)');
    expect(FLOWER_HUES[0]).toBe(0); expect(new Set(FLOWER_HUES).size).toBeGreaterThanOrEqual(4);
  });
  it('the air never holds more than its cap, and everything in it dies', () => {
    const fx = new Fx();
    for (let i = 0; i < 40; i++) { fx.dust(i, 0, 6, 2); fx.petals(i, 1, 2, 3); fx.glints(i, 1, 0, 2); fx.streak(i, 1, 0, -12); }
    expect(fx.list.length).toBe(FX_CAP);
    for (let i = 0; i < 200; i++) fx.step(1 / 30);
    expect(fx.list).toHaveLength(0);
    // A petal settles on the floor; it does not fall through it.
    fx.petals(0, 0.2, 0, 4); for (let i = 0; i < 20; i++) fx.step(1 / 30);
    for (const mote of fx.list) expect(mote.y).toBeGreaterThanOrEqual(0.029);
    fx.clear(); expect(fx.list).toHaveLength(0);
  });
});
