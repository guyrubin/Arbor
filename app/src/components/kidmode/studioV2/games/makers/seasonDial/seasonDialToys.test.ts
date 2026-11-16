/** The toys in the Weather Maker's scene. The rule they keep: what a touch
 * shows is a function of the touch, the CURRENT year and the touch's age —
 * so nothing a touch made can be left behind when the dial moves on. */
import { describe, expect, it } from 'vitest';
import { PARTICLE_CAP, SEASON_CENTERS, appleState, particleCounts, sunAt, weatherAt } from './seasonDialRules';
import {
  APPLE_SPOTS, CLOUDS, FLOOR_TOP, FRIEND_AT, KNOT_AT, LEAF_SPOTS, LOOK, MEADOW, PERCH_AT, PUDDLES, SCENE_H, SCENE_W, SNOWMAN_AT, TOYS, TOY_PARTICLE_MAX, TREE_AT,
  allToyParticles, cloudShown, fallAt, groundY, leavesOn, livePokes, meadowAnswer, onPuddle, pokeAge, shakeYield, shakenApples, skyIsWindow, toyAt, toyMs, toyParticles, wallTop,
  type Poke, type Toy,
} from './seasonDialToys';

const [SPRING, SUMMER, AUTUMN, WINTER] = SEASON_CENTERS;
const poke = (toy: Toy, x = 200, y = 150, at = 1000, seed = 0.37, id = 1): Poke => ({ toy, x, y, at, seed, id });
const count = (ps: readonly { look: number }[], look: number) => ps.filter(p => p.look === look).length;

describe('Weather Maker toys: what is under a finger', () => {
  it('finds the tree, the knot-hole, the sun, the floor and the open sky all year', () => {
    for (const year of SEASON_CENTERS) {
      expect(toyAt(KNOT_AT.x, KNOT_AT.y, year)).toBe('knotHole');
      expect(toyAt(TREE_AT.x - 4, TREE_AT.y - 20, year)).toBe('appleTree'); // the trunk
      expect(toyAt(LEAF_SPOTS[10].x, LEAF_SPOTS[10].y, year)).toBe('appleTree');
      const sun = sunAt(year); expect(toyAt(sun.x, sun.y, year)).toBe('sunDisc');
      expect(toyAt(40, 300, year)).toBe('terraceFloor'); expect(toyAt(60, FLOOR_TOP - 12, year)).toBe('terraceFloor'); // the planting band too
      expect(toyAt(190, 12, year)).not.toBe('terraceFloor');
    }
    expect(wallTop(0)).toBeLessThan(wallTop(300)); // the parapet is higher on the left
  });
  it('the small life answers only while it is there', () => {
    expect(toyAt(PERCH_AT.x, PERCH_AT.y - 8, SUMMER)).toBe('perchBirds'); expect(toyAt(PERCH_AT.x, PERCH_AT.y - 8, WINTER)).not.toBe('perchBirds');
    expect(toyAt(SNOWMAN_AT.x, SNOWMAN_AT.y - 30, WINTER)).toBe('snowFriend'); expect(toyAt(SNOWMAN_AT.x, SNOWMAN_AT.y - 30, SUMMER)).toBe('terraceFloor');
    const at = (f: keyof typeof FRIEND_AT) => [FRIEND_AT[f].x, FRIEND_AT[f].y - FRIEND_AT[f].h * 0.44] as const;
    expect(toyAt(...at('ayaSpring'), SPRING)).toBe('valleyFriend'); expect(toyAt(...at('chockSummer'), SUMMER)).toBe('valleyFriend');
    expect(toyAt(...at('pepAutumn'), AUTUMN)).toBe('valleyFriend'); expect(toyAt(...at('ayaWinter'), WINTER)).toBe('valleyFriend');
    expect(toyAt(...at('pepAutumn'), SPRING + 0.1)).toBe('terraceFloor');
    expect(toyAt(...at('gobgobRain'), 0.16)).toBe('valleyFriend'); expect(toyAt(...at('bebeSnow'), WINTER)).toBe('valleyFriend'); expect(toyAt(...at('bebeSnow'), SUMMER)).toBe('terraceFloor');
    // A cloud can be touched only once it has gathered.
    const c = CLOUDS[3];
    expect(cloudShown(3, 0.15)).toBeGreaterThan(0.3); expect(toyAt(c.x, c.y, 0.15)).toBe('cloudPuff');
    expect(cloudShown(3, SUMMER)).toBe(0); expect(toyAt(c.x, c.y, SUMMER)).toBe('openSky');
  });
  it('every toy has a life, and a poke is over when it ends', () => {
    for (const toy of TOYS) { expect(toyMs(toy)).toBeGreaterThanOrEqual(900); expect(toyMs(toy)).toBeLessThanOrEqual(3200); }
    const p = poke('appleTree');
    expect(pokeAge(p, 999)).toBeNull(); expect(pokeAge(p, 1000)).toBe(0); expect(pokeAge(p, 1000 + toyMs('appleTree') / 2)).toBeCloseTo(0.5); expect(pokeAge(p, 1000 + toyMs('appleTree'))).toBeNull();
    // Only the newest poke of a toy lives; an older one of another toy lives beside it.
    const live = livePokes([poke('appleTree', 1, 1, 1000, 0.1, 1), poke('sunDisc', 1, 1, 1100, 0.1, 2), poke('appleTree', 1, 1, 1500, 0.2, 3)], 1600);
    expect(live.map(q => q.id)).toEqual([2, 3]);
    expect(livePokes([p], 1000 + toyMs('appleTree') + 1)).toEqual([]);
  });
});

describe('Weather Maker toys: a shaken tree gives what the year has', () => {
  it('petals in blossom, apples and green leaves in summer, a rush of turned leaves in autumn, snow in winter, drops in the thaw', () => {
    const spring = shakeYield(SPRING), summer = shakeYield(0.38), autumn = shakeYield(0.53), winter = shakeYield(WINTER), thaw = shakeYield(0.94);
    expect(spring.petals).toBeGreaterThan(8); expect(spring.apples + spring.snow).toBe(0);
    expect(summer.apples).toBe(3); expect(summer.petals + summer.snow).toBe(0); expect(summer.leaves).toBeGreaterThan(0);
    expect(autumn.leaves).toBeGreaterThan(summer.leaves); expect(autumn.snow + autumn.petals).toBe(0);
    expect(winter.snow).toBeGreaterThan(10); expect(winter.leaves + winter.petals + winter.apples).toBe(0);
    expect(thaw.drops).toBeGreaterThan(0);
    expect(leavesOn(SUMMER)).toBe(1); expect(leavesOn(WINTER)).toBe(0);
    // Always something, never more than the canvas may hold.
    for (let y = 0; y < 1; y += 0.01) { const g = shakeYield(y), n = g.petals + g.apples + g.leaves + g.snow + g.drops; expect(n).toBeGreaterThanOrEqual(3); expect(n).toBeLessThanOrEqual(TOY_PARTICLE_MAX); }
  });
  it('brings down only apples that are grown at this year, the same ones for the same shake', () => {
    expect(shakenApples(0.37, WINTER)).toEqual([]);
    const down = shakenApples(0.37, 0.38);
    expect(down).toHaveLength(3); expect(shakenApples(0.37, 0.38)).toEqual(down); expect(shakenApples(0.91, 0.38)).not.toEqual(down);
    for (const i of down) expect(appleState(APPLE_SPOTS[i].seed, 0.38).size).toBeGreaterThan(0.55);
  });
  it('NOTHING STALE: the same shake shows this year’s things when the dial moves on mid-fall', () => {
    const p = poke('appleTree', 200, 150, 1000, 0.37);
    const inSummer = toyParticles(p, 0.38, 0.3), movedToWinter = toyParticles(p, WINTER, 0.3), movedToSpring = toyParticles(p, SPRING, 0.3);
    expect(count(inSummer, LOOK.apple)).toBe(3);
    // The dial went to winter while the apples were in the air: they are not winter's, so they are not there.
    expect(count(movedToWinter, LOOK.apple)).toBe(0); expect(count(movedToWinter, LOOK.leafLet)).toBe(0); expect(count(movedToWinter, LOOK.flake)).toBeGreaterThan(10);
    expect(count(movedToSpring, LOOK.petal)).toBeGreaterThan(8); expect(count(movedToSpring, LOOK.flake) + count(movedToSpring, LOOK.apple)).toBe(0);
    // And it is a pure function: the same poke, year and age give the same picture, whatever was asked in between.
    expect(JSON.stringify(toyParticles(p, 0.38, 0.3))).toBe(JSON.stringify(inSummer));
    // After its life, a poke shows nothing at all, at any year.
    for (const year of SEASON_CENTERS) expect(allToyParticles([p], year, 1000 + toyMs('appleTree') + 1)).toEqual([]);
  });
  it('apples fall, bounce lower each time and come to rest on the terrace', () => {
    const drop = fallAt(100, 280, 620, 0.2); expect(drop.y).toBeGreaterThan(100); expect(drop.landed).toBe(false);
    const rest = fallAt(100, 280, 620, 5, 0.42); expect(rest).toMatchObject({ y: 280, landed: true });
    let highest = 280, hops = 0;
    for (let t = 0; t < 3; t += 0.004) { const f = fallAt(100, 280, 620, t, 0.42); expect(f.y).toBeLessThanOrEqual(280 + 1e-6); hops = Math.max(hops, f.hops); if (f.hops === 1) highest = Math.min(highest, f.y); }
    expect(hops).toBeGreaterThanOrEqual(2); expect(280 - highest).toBeLessThan(180 * 0.42 ** 2 + 2); // the first bounce is far lower than the fall
    const apples = toyParticles(poke('appleTree', 0, 0, 0, 0.37), 0.38, 0.95).filter(q => q.look === LOOK.apple);
    for (const a of apples) { expect(a.y).toBeGreaterThanOrEqual(groundY(a.x)); expect(a.y).toBeLessThan(SCENE_H); expect(a.alpha).toBeLessThan(0.5); }
  });
});

describe('Weather Maker toys: the terrace, the sky and the rest', () => {
  it('the floor answers by the year: a felt flower, a splash, a kick of leaves, a puff of snow', () => {
    expect(meadowAnswer(200, 290, SUMMER)).toBe(MEADOW.flower); expect(meadowAnswer(200, 290, 0.16)).toBe(MEADOW.splash);
    expect(meadowAnswer(200, 290, 0.62)).toBe(MEADOW.leafKick); expect(meadowAnswer(200, 290, WINTER)).toBe(MEADOW.snowPuff);
    const pool = PUDDLES[0];
    expect(onPuddle(pool.x, pool.y)).toBe(true); expect(onPuddle(pool.x + pool.rx + 40, pool.y)).toBe(false);
    expect(meadowAnswer(pool.x, pool.y, 0.975)).toBe(MEADOW.splash);
    const p = poke('terraceFloor', 200, 290);
    expect(count(toyParticles(p, SUMMER, 0.3), LOOK.bloom)).toBe(1); expect(count(toyParticles(p, 0.16, 0.2), LOOK.drop)).toBeGreaterThan(4);
    expect(count(toyParticles(p, 0.16, 0.2), LOOK.ring)).toBeGreaterThan(0); expect(count(toyParticles(p, WINTER, 0.2), LOOK.flake)).toBeGreaterThan(4);
    // The flower stands up, then goes back down by itself.
    const grow = (age: number) => toyParticles(p, SUMMER, age)[0].grow ?? 0;
    expect(grow(0)).toBe(0); expect(grow(0.4)).toBeGreaterThan(0.95); expect(grow(0.999)).toBeLessThan(0.05);
  });
  it('the open sky is a cold window in winter (breath) and a puff of wind the rest of the year', () => {
    expect(skyIsWindow(WINTER)).toBe(true); expect(skyIsWindow(SUMMER)).toBe(false);
    const p = poke('openSky', 120, 60);
    const breath = toyParticles(p, WINTER, 0.2);
    expect(breath[0].look).toBe(LOOK.fog); expect(breath[0].alpha).toBeGreaterThan(0.4); expect(toyParticles(p, WINTER, 0.99)[0].alpha).toBeLessThan(0.05);
    expect(toyParticles(p, SUMMER, 0.3).every(q => q.look === LOOK.seedTuft)).toBe(true);
    expect(toyParticles(p, 0.6, 0.3).every(q => q.look === LOOK.leafLet)).toBe(true);
    expect(toyParticles(p, SPRING, 0.3).every(q => q.look === LOOK.petal)).toBe(true);
    // A cloud rains, or snows when it is cold.
    const c = poke('cloudPuff', 200, 50);
    expect(toyParticles(c, 0.16, 0.3).every(q => q.look === LOOK.drop)).toBe(true); expect(toyParticles(c, WINTER, 0.3).every(q => q.look === LOOK.flake)).toBe(true);
  });
  it('a whole year throws all four seasons up at once', () => {
    const burst = toyParticles(poke('wholeYear'), SUMMER, 0.3);
    expect(burst).toHaveLength(TOY_PARTICLE_MAX);
    for (const look of [LOOK.petal, LOOK.sunMote, LOOK.leafLet, LOOK.flake]) expect(count(burst, look)).toBe(TOY_PARTICLE_MAX / 4);
    expect(toyParticles(poke('wholeYear'), SUMMER, 0.999).every(q => q.alpha < 0.02)).toBe(true);
  });
  it('holds every picture inside the cap: toys and weather together never pass PARTICLE_CAP', () => {
    const many = TOYS.map((toy, i) => poke(toy, 150 + i * 10, 250, 1000, 0.1 + i * 0.07, i + 1));
    for (let y = 0; y < 1; y += 0.02) for (const now of [1100, 1500, 1900]) {
      const toys = allToyParticles(many, y, now), n = particleCounts(weatherAt(y));
      expect(toys.length).toBeLessThanOrEqual(TOY_PARTICLE_MAX);
      expect(toys.length + n.rain + n.petals + n.leaves + n.snow).toBeLessThanOrEqual(PARTICLE_CAP);
      for (const p of toys) { expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.r)).toBe(true); expect(p.alpha).toBeGreaterThan(0); expect(p.alpha).toBeLessThanOrEqual(1); }
    }
  });
  it('reduced motion and Hold still get one settled picture of the same answer', () => {
    const p = poke('appleTree', 200, 150, 1000, 0.37);
    const still = allToyParticles([p], 0.38, 1200, true), later = allToyParticles([p], 0.38, 2400, true);
    expect(JSON.stringify(still)).toBe(JSON.stringify(later)); // it does not move while it shows
    expect(count(still, LOOK.apple)).toBe(3);
    for (const a of still.filter(q => q.look === LOOK.apple)) expect(a.y).toBeGreaterThanOrEqual(groundY(a.x)); // already on the ground
    expect(allToyParticles([p], 0.38, 1000 + toyMs('appleTree') + 1, true)).toEqual([]);
    expect(SCENE_W / SCENE_H).toBe(1.25);
  });
});
