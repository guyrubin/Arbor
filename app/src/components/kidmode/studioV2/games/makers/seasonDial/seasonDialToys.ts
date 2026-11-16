import {
  CREW, FRIENDS, appleState, blossomState, cloudCover, crewAt, fallenLeaves, friendsAt, leafState, lifeAt, puddles, smoothstep, snowCap, snowDepth, sunAt, weatherAt, wrapYear,
  type Crew, type Friend,
} from './seasonDialRules';
import { TREE } from './seasonDialTree';

/** The toys in the scene. Pure: no React, no clock of its own, no randomness.
 *
 * A touch on the scene is a `Poke`: what was touched, where, when, and a seed.
 * What a poke shows is a function of the poke, the CURRENT `year` and the
 * poke's age, and of nothing else, so a shaken tree drops what the tree has at
 * the year the dial stands on now. Turn the dial while apples are falling and
 * they are simply this year's again: nothing a touch made can be left behind.
 * Every poke ends by itself after `toyMs`. Scene units: 400 by 320. */
export const SCENE_W = 400, SCENE_H = 320;

/* The terrace, in scene units. The backdrop is the kit's terrace picture, cut
 * to the scene's 5:4 (see seasonDial.css `.sd-view`): the parapet's top runs
 * along WALL_TOP, the planting band and its kerb lie under it, and the floor
 * begins at FLOOR_TOP. */
export const FLOOR_TOP = 204;
export function wallTop(x: number): number {
  return 166 - 27 * (1 - smoothstep(30, 118, x));
}
/** Where the tree stands on the terrace and how big it is drawn: the tree is
 * grown in its own units (seasonDialTree) and set down here. */
export const TREE_AT = { x: 296, y: 262, scale: 0.78 } as const;
const place = (x: number, y: number) => ({ x: TREE_AT.x + (x - TREE.base.x) * TREE_AT.scale, y: TREE_AT.y + (y - TREE.base.y) * TREE_AT.scale });
/** The tree's leaves, apples and twig ends where they are in the scene. */
export const LEAF_SPOTS = TREE.leaves.map(l => place(l.x, l.y));
export const APPLE_SPOTS = TREE.apples.map(a => ({ ...place(a.x, a.y), r: a.r * TREE_AT.scale, seed: a.seed }));
const CLUMP_SPOTS = TREE.clumps.map(c => ({ ...place(c.x, c.y), r: c.r * TREE_AT.scale }));
const LIMBS = TREE.segments.filter(s => s.w1 >= 5).map(s => ({ a: place(s.x1, s.y1), b: place(s.x2, s.y2), w: s.w1 * TREE_AT.scale }));
export const PERCH_AT = place(TREE.perch.x, TREE.perch.y);
export const CROWN_AT = { ...place(TREE.crown.cx, TREE.crown.cy), rx: TREE.crown.rx * TREE_AT.scale, ry: TREE.crown.ry * TREE_AT.scale };
/** The knot-hole in the trunk: somebody lives in it. */
export const KNOT_AT = place(TREE.base.x - 12, TREE.base.y - 38);

/** Where things that fall come to rest: the terrace floor around the tree's
 * bed (a little nearer or further, so they do not line up). */
export function groundY(x: number): number {
  return 281 + 1.5 * Math.sin(x / 31);
}

export const CLOUDS = [{ x: 208, y: 52, s: 1.1 }, { x: 96, y: 30, s: 0.8 }, { x: 330, y: 34, s: 0.7 }, { x: 30, y: 78, s: 0.85 }] as const;
/** How much of cloud `i` shows at this point of the year (they gather one by one). */
export function cloudShown(i: number, year: number): number {
  return Math.min(1, Math.max(0, cloudCover(year) * 3.4 - i * 0.75));
}
/** Melt-water and rain pools on the terrace floor. */
export const PUDDLES = [{ x: 96, y: 298, rx: 44, ry: 7 }, { x: 214, y: 246, rx: 30, ry: 4.4 }, { x: 348, y: 304, rx: 34, ry: 5.6 }] as const;
export const SNOWMAN_AT = { x: 88, y: 270 } as const;
/** Where each friend stands (feet) and how tall it is drawn, in scene units. */
export const FRIEND_AT: Readonly<Record<Friend | Crew, { x: number; y: number; h: number }>> = {
  ayaWinter: { x: 142, y: 288, h: 74 }, ayaSpring: { x: 168, y: 292, h: 62 },
  chockSummer: { x: 140, y: 296, h: 92 }, pepAutumn: { x: 134, y: 298, h: 88 },
  gobgobRain: { x: 82, y: 302, h: 66 }, bebeSnow: { x: 40, y: 294, h: 84 },
};

export const TOYS = ['appleTree', 'terraceFloor', 'openSky', 'sunDisc', 'cloudPuff', 'perchBirds', 'valleyFriend', 'snowFriend', 'knotHole', 'wholeYear'] as const;
export type Toy = typeof TOYS[number];
export interface Poke { readonly toy: Toy; readonly x: number; readonly y: number; readonly at: number; readonly seed: number; readonly id: number }

const LIFE: Readonly<Record<Toy, number>> = {
  appleTree: 2600, terraceFloor: 2600, openSky: 3000, sunDisc: 1100, cloudPuff: 1900, perchBirds: 1300, valleyFriend: 1300, snowFriend: 1100, knotHole: 2100, wholeYear: 2200,
};
export function toyMs(toy: Toy): number { return LIFE[toy]; }
/** How far through its life a poke is at `now`, 0..1; null once it is over. */
export function pokeAge(poke: Poke, now: number): number | null {
  const t = (now - poke.at) / LIFE[poke.toy];
  return t >= 0 && t < 1 ? t : null;
}
/** Only the newest poke of each toy lives, and none past its time. */
export function livePokes(pokes: readonly Poke[], now: number): Poke[] {
  const newest = new Map<Toy, Poke>();
  for (const p of pokes) if (pokeAge(p, now) !== null) { const had = newest.get(p.toy); if (!had || had.at <= p.at) newest.set(p.toy, p); }
  return [...newest.values()].sort((a, b) => a.at - b.at);
}

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
/** Distance from a point to the nearest thick limb of the tree. */
function limbDistance(x: number, y: number): number {
  let best = Infinity;
  for (const s of LIMBS) {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, len2 = dx * dx + dy * dy || 1;
    const t = Math.min(1, Math.max(0, ((x - s.a.x) * dx + (y - s.a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(x - (s.a.x + dx * t), y - (s.a.y + dy * t)) - s.w / 2);
  }
  return best;
}
/** Distance to the nearest twig end, where the leaves are. */
function leafDistance(x: number, y: number): number {
  let best = Infinity;
  for (const c of CLUMP_SPOTS) best = Math.min(best, Math.hypot(x - c.x, y - c.y) - c.r);
  return best;
}

/** What is under a finger at (x, y) at this point of the year. The small
 * life can only be touched while it is there; everything else always answers. */
export function toyAt(x: number, y: number, year: number): Toy {
  const life = lifeAt(year), sun = sunAt(year), friends = friendsAt(year);
  if (Math.hypot(x - KNOT_AT.x, y - KNOT_AT.y) <= 8) return 'knotHole';
  if (life.birds > 0.4 && inEllipse(x, y, PERCH_AT.x, PERCH_AT.y - 9, 22, 17)) return 'perchBirds';
  const crew = crewAt(year);
  for (const f of [...FRIENDS, ...CREW]) {
    const at = FRIEND_AT[f], there = f === 'gobgobRain' || f === 'bebeSnow' ? crew[f] : friends[f];
    if (there > 0.4 && inEllipse(x, y, at.x, at.y - at.h * 0.44, at.h * 0.26, at.h * 0.46)) return 'valleyFriend';
  }
  if (life.snowman > 0.4 && inEllipse(x, y, SNOWMAN_AT.x, SNOWMAN_AT.y - 30, 26, 36)) return 'snowFriend';
  if (limbDistance(x, y) <= 7 || leafDistance(x, y) <= 8) return 'appleTree';
  if (Math.hypot(x - sun.x, y - sun.y) <= sun.r + 12) return 'sunDisc';
  for (let i = 0; i < CLOUDS.length; i++) {
    const c = CLOUDS[i];
    if (cloudShown(i, year) > 0.3 && inEllipse(x, y, c.x, c.y - 4 * c.s, 48 * c.s + 14, 22 * c.s + 8)) return 'cloudPuff';
  }
  if (y >= wallTop(x) + 4) return 'terraceFloor';
  return 'openSky';
}

/** A fixed hash of (index, salt) into [0, 1). */
export function hash(i: number, salt: number): number {
  let h = Math.imul(Math.floor(i) + 1, 0x9e3779b1) ^ Math.imul(Math.floor(salt) + 7, 0x85ebca6b);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/* ── what a shaken tree lets go of, by the year ─────────────────────────── */

/** At most this many toy particles are drawn at once, whatever was touched.
 * With the weather's own, the canvas stays inside PARTICLE_CAP. */
export const TOY_PARTICLE_MAX = 28;
export interface Yield { readonly petals: number; readonly apples: number; readonly leaves: number; readonly snow: number; readonly drops: number }
/** How turned the crown is on the whole: the leaf ramp of a middling leaf. */
const MID_LEAF = { grow: 0.5, turn: 0.5, fall: 0.5, hue: 0.7 } as const;
/** The share of the crown's leaves still on the twig. */
export function leavesOn(year: number): number {
  let on = 0;
  for (let i = 0; i < TREE.leaves.length; i += 6) on += leafState(TREE.leaves[i].seed, year).on > 0.5 ? 1 : 0;
  return on / Math.ceil(TREE.leaves.length / 6);
}
/** What comes down when the tree is shaken, as counts. Always something: a
 * bare, snowless tree in the thaw still shakes off a few drops. */
export function shakeYield(year: number): Yield {
  const y = wrapYear(year);
  const bloom = blossomState(0.5, y), mid = leafState(MID_LEAF, y), on = leavesOn(y);
  const petals = Math.round(12 * bloom.on * bloom.open);
  const apples = APPLE_SPOTS.filter(a => appleState(a.seed, y).size > 0.55).length;
  const turned = smoothstep(2, 3.2, mid.tint);
  const leaves = Math.round(on * (3 + 9 * turned) * (petals > 6 ? 0.3 : 1));
  const snow = Math.round(14 * snowCap(y));
  const want = { petals, apples: Math.min(3, apples), leaves, snow, drops: 0 };
  const total = want.petals + want.apples + want.leaves + want.snow;
  return total >= 3 ? want : { ...want, drops: 5 };
}
/** Which apples a shake brings down (indices into TREE.apples): up to three
 * of the ones that are grown at this year, chosen by the poke's seed. */
export function shakenApples(seed: number, year: number): number[] {
  const grown = APPLE_SPOTS.map((a, i) => ({ i, size: appleState(a.seed, year).size })).filter(a => a.size > 0.55);
  return grown.map(a => ({ i: a.i, k: hash(a.i, Math.floor(seed * 9973)) })).sort((a, b) => a.k - b.k).slice(0, 3).map(a => a.i).sort((a, b) => a - b);
}

/** What the terrace answers with where it is touched: a splash in a puddle or
 * in the rain, a puff of snow, a kick of fallen leaves, or one of the valley's
 * felt flowers standing up for a moment. */
export const MEADOW = { splash: 0, snowPuff: 1, leafKick: 2, flower: 3 } as const;
export type MeadowAnswer = typeof MEADOW[keyof typeof MEADOW];
export function onPuddle(x: number, y: number): boolean {
  return PUDDLES.some(p => inEllipse(x, y, p.x, p.y, p.rx + 6, p.ry + 8));
}
export function meadowAnswer(x: number, y: number, year: number): MeadowAnswer {
  if (snowDepth(year) > 0.4) return MEADOW.snowPuff;
  if ((puddles(year) > 0.3 && onPuddle(x, y)) || weatherAt(year).rain > 0.3) return MEADOW.splash;
  if (fallenLeaves(year) > 0.3 || weatherAt(year).leaves > 0.4) return MEADOW.leafKick;
  return MEADOW.flower;
}
/** The open sky answers with breath on the cold window in winter, and with a
 * gust (seeds, petals or leaves) the rest of the year. */
export function skyIsWindow(year: number): boolean {
  return snowDepth(year) > 0.4 || weatherAt(year).snow > 0.5;
}

/* ── the particles of a poke ────────────────────────────────────────────── */

export const LOOK = { petal: 0, apple: 1, leafLet: 2, flake: 3, drop: 4, seedTuft: 5, ring: 6, bloom: 7, fog: 8, sunMote: 9 } as const;
export type Look = typeof LOOK[keyof typeof LOOK];
export interface ToyParticle {
  readonly look: Look; readonly x: number; readonly y: number;
  /** Size in scene units (a radius, or a leaf's half length). */
  readonly r: number; readonly turn: number; readonly alpha: number;
  /** 0..1: which of the look's colours. */
  readonly tone: number;
  /** A ring's flattening or a flower's growth, where the look uses one. */
  readonly grow?: number;
  /** Which apple of the tree this is (apples only). */
  readonly of?: number;
}

const fadeOut = (t: number, from = 0.78) => 1 - smoothstep(from, 1, t);
/** A thing let go at height y0 that falls to the floor line under gravity g (units/s²),
 * then bounces, each bounce lower. Returns its height and whether it
 * has landed for good. Closed form: a function of the time alone. */
export function fallAt(y0: number, floor: number, g: number, seconds: number, bounce = 0): { y: number; landed: boolean; hops: number } {
  const drop = Math.max(0, floor - y0), tFall = Math.sqrt((2 * drop) / g);
  if (seconds <= tFall) return { y: y0 + 0.5 * g * seconds * seconds, landed: false, hops: 0 };
  let t = seconds - tFall, v = Math.sqrt(2 * g * drop) * bounce, hops = 0;
  while (v > 6 && hops < 3) {
    const air = (2 * v) / g;
    if (t < air) return { y: floor - (v * t - 0.5 * g * t * t), landed: false, hops: hops + 1 };
    t -= air; v *= bounce; hops++;
  }
  return { y: floor, landed: true, hops };
}

function treeParticles(poke: Poke, year: number, age: number, still: boolean): ToyParticle[] {
  const give = shakeYield(year), out: ToyParticle[] = [];
  const seconds = (age * LIFE.appleTree) / 1000, salt = Math.floor(poke.seed * 9973);
  const fade = fadeOut(age);
  const spots = LEAF_SPOTS, mid = leafState(MID_LEAF, year);
  let n = 0;
  const from = (i: number) => spots[Math.floor(hash(i, salt + 1) * spots.length) % spots.length];
  // Apples: heavy. They drop, bounce twice, roll a little down the knoll and rest.
  for (const i of shakenApples(poke.seed, year).slice(0, give.apples)) {
    const a = APPLE_SPOTS[i], st = appleState(a.seed, year), delay = 0.05 + 0.16 * hash(i, salt + 2);
    const t = Math.max(0, seconds - delay), floor = groundY(a.x) + 2 + 12 * hash(i, salt + 3);
    const fall = still ? { y: floor, landed: true, hops: 2 } : fallAt(a.y, floor, 620, t, 0.42);
    const roll = (a.x < TREE_AT.x ? -1 : 1) * (4 + 10 * hash(i, salt + 4)) * smoothstep(0, 1.1, Math.max(0, t - Math.sqrt((2 * (floor - a.y)) / 620)));
    out.push({ look: LOOK.apple, x: a.x + (still ? (a.x < TREE_AT.x ? -8 : 8) : roll), y: fall.y, r: a.r * (0.35 + 0.65 * st.size), turn: still ? 0.6 : roll * 0.12, alpha: fade, tone: st.red, of: i });
    n++;
  }
  const light = (count: number, look: Look, speed: number, sway: number, size: number) => {
    for (let k = 0; k < count; k++) {
      const s = from(n * 7 + k), i = n * 31 + k, delay = 0.28 * hash(i, salt + 5);
      const t = still ? 0.9 + 0.8 * hash(i, salt + 9) : Math.max(0, seconds - delay);
      const floor = groundY(s.x) + 14 * hash(i, salt + 6);
      const y = Math.min(floor, s.y + (speed * (0.7 + 0.6 * hash(i, salt + 7))) * t + 26 * t * t);
      const air = y < floor ? 1 : 0;
      const x = s.x + air * sway * Math.sin(t * 3.1 + i) + (hash(i, salt + 8) - 0.5) * 16 * Math.min(1, t);
      out.push({ look, x, y, r: size * (0.75 + 0.5 * hash(i, salt + 10)), turn: air * t * (2 + 3 * hash(i, salt + 11)) + i, alpha: fade * (t > 0 ? 1 : 0), tone: look === LOOK.leafLet ? Math.min(1, mid.tint / 5 + 0.25 * (hash(i, salt + 12) - 0.5)) : hash(i, salt + 12) });
    }
    n += count;
  };
  light(give.petals, LOOK.petal, 34, 7, 2.5);
  light(give.leaves, LOOK.leafLet, 46, 9, 5);
  // Snow comes off in soft lumps that fall straight and burst into a puff.
  for (let k = 0; k < give.snow; k++) {
    const s = from(n * 7 + k), i = n * 31 + k, delay = 0.2 * hash(i, salt + 5);
    const t = still ? 1 : Math.max(0, seconds - delay), floor = groundY(s.x) + 2;
    const fall = fallAt(s.y, floor, 380, t, 0);
    const puff = fall.landed ? smoothstep(0, 0.5, t - Math.sqrt((2 * Math.max(0, floor - s.y)) / 380)) : 0;
    out.push({ look: LOOK.flake, x: s.x + (hash(i, salt + 8) - 0.5) * 8, y: fall.y - 3 * puff, r: (2.4 + 2 * hash(i, salt + 10)) * (1 + 1.4 * puff), turn: 0, alpha: fade * (1 - 0.75 * puff) * (t > 0 ? 1 : 0), tone: hash(i, salt + 12) });
  }
  n += give.snow;
  for (let k = 0; k < give.drops; k++) {
    const s = from(k * 13), i = 900 + k, t = still ? 0.5 : Math.max(0, seconds - 0.12 * k);
    const fall = fallAt(s.y, groundY(s.x) + 4, 520, t, 0);
    out.push({ look: LOOK.drop, x: s.x, y: fall.y, r: 1.6, turn: 0, alpha: fall.landed ? 0 : fade * (t > 0 ? 1 : 0), tone: 0.5 });
  }
  return out;
}

function floorParticles(poke: Poke, year: number, age: number, still: boolean): ToyParticle[] {
  const out: ToyParticle[] = [], answer = meadowAnswer(poke.x, poke.y, year);
  const seconds = (age * LIFE.terraceFloor) / 1000, salt = Math.floor(poke.seed * 9973);
  const y0 = poke.y;
  if (answer === MEADOW.flower) {
    // A flower comes up where the meadow was touched, stands a moment, and goes back down.
    const up = still ? 1 : smoothstep(0, 0.16, age) * (1 + 0.14 * Math.sin(Math.min(1, age / 0.3) * Math.PI)) * fadeOut(age, 0.8);
    out.push({ look: LOOK.bloom, x: poke.x, y: y0, r: 4.4 + 2 * hash(1, salt), turn: still ? 0 : 0.14 * Math.sin(seconds * 3.2), alpha: 1, tone: hash(2, salt), grow: up });
    return out;
  }
  if (answer === MEADOW.splash) {
    for (let k = 0; k < 2; k++) {
      const t = still ? 0.45 + 0.3 * k : Math.max(0, seconds * 1.5 - 0.22 * k);
      if (t <= 0 || t >= 1) continue;
      out.push({ look: LOOK.ring, x: poke.x, y: y0, r: 4 + 22 * t, turn: 0, alpha: 0.8 * (1 - t), tone: 0.5, grow: 0.3 });
    }
  }
  const count = answer === MEADOW.splash ? 7 : 8;
  for (let k = 0; k < count; k++) {
    const angle = -Math.PI * (0.18 + 0.64 * ((k + hash(k, salt)) / count));
    const speed = (answer === MEADOW.leafKick ? 52 : 70) * (0.6 + 0.6 * hash(k, salt + 1));
    const g = answer === MEADOW.leafKick ? 120 : answer === MEADOW.snowPuff ? 200 : 330;
    const t = still ? speed * Math.abs(Math.sin(angle)) / g : seconds;
    const x = poke.x + Math.cos(angle) * speed * t, y = y0 + Math.sin(angle) * speed * t + 0.5 * g * t * t;
    const down = y > y0 + 6;
    if (answer === MEADOW.splash) out.push({ look: LOOK.drop, x, y, r: 1.3 + hash(k, salt + 2), turn: 0, alpha: down ? 0 : 0.9, tone: 0.5 });
    else if (answer === MEADOW.snowPuff) out.push({ look: LOOK.flake, x, y: Math.min(y, y0 + 4), r: 1.4 + 2 * hash(k, salt + 2), turn: 0, alpha: fadeOut(age, 0.35), tone: hash(k, salt + 3) });
    else out.push({ look: LOOK.leafLet, x: x + (down ? 0 : 5 * Math.sin(t * 6 + k)), y: Math.min(y, y0 + 6 + 6 * hash(k, salt + 4)), r: 4.2 + 1.6 * hash(k, salt + 2), turn: down ? k : t * 7 + k, alpha: fadeOut(age, 0.7), tone: 0.6 + 0.4 * hash(k, salt + 3) });
  }
  return out;
}

function skyParticles(poke: Poke, year: number, age: number, still: boolean): ToyParticle[] {
  const salt = Math.floor(poke.seed * 9973), seconds = (age * LIFE.openSky) / 1000;
  if (skyIsWindow(year)) {
    // Breath on the cold glass: it blooms, holds, and clears from the edge.
    const bloom = still ? 1 : smoothstep(0, 0.1, age);
    const out: ToyParticle[] = [{ look: LOOK.fog, x: poke.x, y: poke.y, r: 22 + 18 * bloom, turn: 0, alpha: 0.8 * bloom * fadeOut(age, 0.5), tone: 0.5 }];
    // Frost crystals grow in the breath, one after another, and go with it.
    for (let k = 0; k < 5; k++) {
      const a = hash(k, salt) * Math.PI * 2, d = 5 + 17 * hash(k, salt + 1);
      const grown = still ? 1 : smoothstep(0.06 + 0.05 * k, 0.2 + 0.05 * k, age);
      out.push({ look: LOOK.sunMote, x: poke.x + Math.cos(a) * d, y: poke.y + Math.sin(a) * d * 0.8, r: (2.4 + 2.2 * hash(k, salt + 2)) * grown, turn: 0.4 * hash(k, salt + 3), alpha: (grown > 0.02 ? 0.95 : 0) * fadeOut(age, 0.55), tone: 1 });
    }
    return out;
  }
  // A puff of wind: seeds in the green months, petals in blossom, leaves in autumn.
  const w = weatherAt(year), bloom = blossomState(0.5, year);
  const look: Look = w.leaves > 0.25 ? LOOK.leafLet : bloom.on * bloom.open > 0.5 ? LOOK.petal : LOOK.seedTuft;
  const out: ToyParticle[] = [];
  for (let k = 0; k < 7; k++) {
    const t = still ? 0.5 + 0.5 * hash(k, salt + 5) : Math.max(0, seconds - 0.05 * k);
    const curl = (hash(k, salt) - 0.5) * 1.6, reach = 30 + 46 * hash(k, salt + 1);
    const along = reach * (1 - Math.exp(-1.4 * t));
    const x = poke.x + along * Math.cos(curl * t) + 4 * Math.sin(t * 3 + k), y = poke.y + along * Math.sin(curl * t) * 0.6 + (look === LOOK.seedTuft ? -5 : 9) * t * t;
    out.push({ look, x, y, r: look === LOOK.leafLet ? 4.4 : look === LOOK.petal ? 2.4 : 3, turn: look === LOOK.seedTuft ? 0.3 * Math.sin(t * 2 + k) : t * 4 + k, alpha: fadeOut(age, 0.55) * (t > 0 ? 1 : 0), tone: 0.55 + 0.45 * hash(k, salt + 2) });
  }
  return out;
}

function cloudParticles(poke: Poke, year: number, age: number, still: boolean): ToyParticle[] {
  const salt = Math.floor(poke.seed * 9973), seconds = (age * LIFE.cloudPuff) / 1000, cold = skyIsWindow(year);
  const out: ToyParticle[] = [];
  for (let k = 0; k < 9; k++) {
    const x0 = poke.x + (k - 4) * 7 + 5 * (hash(k, salt) - 0.5), delay = 0.07 * ((k * 5) % 9);
    const t = still ? 0.25 + 0.3 * hash(k, salt + 1) : Math.max(0, seconds - delay), floor = groundY(x0) + 6;
    const y = cold ? poke.y + 10 + 46 * t : fallAt(poke.y + 10, floor, 460, t, 0).y;
    out.push({ look: cold ? LOOK.flake : LOOK.drop, x: x0 + (cold ? 5 * Math.sin(t * 3 + k) : -t * 8), y, r: cold ? 1.6 + hash(k, salt + 2) : 1.5, turn: 0, alpha: (t > 0 && y < floor ? 1 : 0) * fadeOut(age, 0.7), tone: hash(k, salt + 3) });
  }
  return out;
}

/** The finale of a whole year: all four seasons at once, thrown up from
 * behind the tree and drifting down. */
function wholeYearParticles(poke: Poke, age: number, still: boolean): ToyParticle[] {
  const salt = Math.floor(poke.seed * 9973), seconds = (age * LIFE.wholeYear) / 1000, out: ToyParticle[] = [];
  const looks: Look[] = [LOOK.petal, LOOK.sunMote, LOOK.leafLet, LOOK.flake];
  for (let k = 0; k < TOY_PARTICLE_MAX; k++) {
    const look = looks[k % 4], angle = -Math.PI * (0.08 + 0.84 * ((k + 0.5) / TOY_PARTICLE_MAX)) + 0.2 * (hash(k, salt) - 0.5);
    const speed = 130 + 80 * hash(k, salt + 1), t = still ? 0.55 + 0.4 * hash(k, salt + 4) : seconds;
    // Thrown up fast, slowed by the air, then a slow fall: light things.
    const out1 = (1 - Math.exp(-2.6 * t)) / 2.6;
    const x = CROWN_AT.x + Math.cos(angle) * speed * out1 + 6 * Math.sin(t * 2.4 + k);
    const y = CROWN_AT.y + 24 + Math.sin(angle) * speed * out1 + 20 * t * t;
    out.push({ look, x, y, r: look === LOOK.leafLet ? 5 : look === LOOK.flake ? 2.6 : look === LOOK.petal ? 2.8 : 2.2, turn: t * (2 + 2 * hash(k, salt + 2)) + k, alpha: smoothstep(0, 0.06, age) * fadeOut(age, 0.62), tone: 0.5 + 0.5 * hash(k, salt + 3) });
  }
  return out;
}

/** Everything a poke shows on the canvas at this `year` and this `age` (0..1
 * of its life). `still`: reduced motion or Hold still — one settled picture
 * of the same answer instead of its flight. */
export function toyParticles(poke: Poke, year: number, age: number, still = false): ToyParticle[] {
  const y = wrapYear(year), t = Math.min(0.9999, Math.max(0, age));
  if (poke.toy === 'appleTree') return treeParticles(poke, y, t, still);
  if (poke.toy === 'terraceFloor') return floorParticles(poke, y, t, still);
  if (poke.toy === 'openSky') return skyParticles(poke, y, t, still);
  if (poke.toy === 'cloudPuff') return cloudParticles(poke, y, t, still);
  if (poke.toy === 'wholeYear') return wholeYearParticles(poke, t, still);
  return [];
}
/** All live pokes' particles, newest kept, never more than TOY_PARTICLE_MAX. */
export function allToyParticles(pokes: readonly Poke[], year: number, now: number, still = false): ToyParticle[] {
  const out: ToyParticle[] = [];
  const live = livePokes(pokes, now);
  for (let i = live.length - 1; i >= 0 && out.length < TOY_PARTICLE_MAX; i--) {
    const age = pokeAge(live[i], now); if (age === null) continue;
    const mine = toyParticles(live[i], year, still ? 0.5 : age, still).filter(p => p.alpha > 0.01);
    out.push(...mine.slice(0, TOY_PARTICLE_MAX - out.length));
  }
  return out;
}
