/** The child's hands in the clay. Pure: no React, no timers, no randomness.
 *
 * The films run on the film's clock. The hands run on a second clock, also
 * cut into twelve frames a second: a press, a flick or a tap is a `Touch`
 * with the hand-frame it began on, and everything it does afterwards (the
 * dent springing back, the star swinging down to rest) is a closed-form
 * function of its age. So the picture on stage is always a pure function of
 * (reel, film frame, the child's lasting choices, the live touches and their
 * ages): the same inputs draw the same frame, and once a touch has run out
 * the frame is exactly the film's own again. */
import { clamp01, easeInOut, easeOut, lerp, seeded, unplacePoint } from './clayShapes';
import {
  AYA_GROUND, BLOOMED_T, FRESH_HANDS, FIRST_SHOW, FROG_XF, JUMP_SCALE, PLANTER_X, REACH_START, REACH_TOUCH, REEL_SECONDS, ROCKET_SCALE, SOIL_Y, SPLASH_T, SPROUT_T,
  ayaFilm, cameraTop, frogFilm, hopStart, portholeSlotAt, pressPrint, rocketFilm, setPorthole, starsOf, whalePose,
  type Hands, type ReelId, type ShowLook,
} from './clayTheatreRules';

/* ── where things stand on the 400 × 300 stage ─────────────────────────── */

export const MOON = { x: 318, y: 78, r: 21 } as const;
export const JUMP_SUN = { x: 330, y: -134, r: 19 } as const;
/** Three skies for the jump: where the clouds hang (world x, y, scale). */
export const JUMP_CLOUD_SETS: readonly (readonly (readonly [number, number, number])[])[] = [
  [[220, -150, 1], [96, -110, 0.85], [356, -80, 0.8]],
  [[120, -160, 0.9], [250, -118, 1.05], [60, -84, 0.7]],
  [[180, -136, 0.8], [300, -170, 0.95], [100, -66, 0.75]],
];
export const cloudsOf = (sky: number) => JUMP_CLOUD_SETS[((sky % JUMP_CLOUD_SETS.length) + JUMP_CLOUD_SETS.length) % JUMP_CLOUD_SETS.length];
export const POND_SUN = { x: 92, y: 86, r: 17 } as const;
export const PAD_Y = 208, BLOOM_Y = 100;
export interface Pad { x: number; y: number; rx: number; n: number }
export const PADS: readonly Pad[] = Array.from({ length: 9 }, (_, i) => ({ x: 46 + i * 36 + (seeded(i, 5) - 0.5) * 6, y: PAD_Y + (seeded(i, 6) - 0.5) * 4, rx: 25 + seeded(i, 7) * 5, n: 0.5 + seeded(i, 8) * 2 }));
export const GARDEN_SUN = { x: 78, y: 70, r: 18 } as const;
/** The part of the frame the felt curtain leaves open. */
export const WINDOW = { x0: 15, y0: 20, x1: 385, y1: 300 } as const;
/** The audience in front of the stage, in the order they stand. */
export const FRIENDS = ['bebe', 'gobgob', 'chock', 'aya', 'pep'] as const;
export type FriendId = typeof FRIENDS[number];

/* ── the things a hand can touch ───────────────────────────────────────── */

export type ToyKind =
  | 'clayHero' | 'wireStar' | 'nightMoon' | 'daySun' | 'seaSkin' | 'padLeaf' | 'puffCloud' | 'lotusBloom' | 'gardenBloom'
  | 'openAir' | 'deepWater' | 'feltDrape' | 'cometWish' | 'kitFriend' | 'proofLens' | 'wallPoster' | 'reelDone';
export interface ToySpot { toy: ToyKind; index: number; x: number; y: number; rx: number; ry: number }
/** Where the clay itself is on stage at `t`, and how it is turned and sized. */
export interface HeroPlace { cx: number; cy: number; rot: number; sx: number; sy: number; reach: number; base: number }
export function heroPlace(reel: ReelId, t: number, hands: Hands = FRESH_HANDS): HeroPlace {
  if (reel === 'rocket') {
    const f = rocketFilm(t, hands);
    return { cx: f.cx, cy: f.cy, rot: f.rot, sx: f.sx, sy: f.sy, reach: 58, base: f.morph > 1 ? f.cy + lerp(34, 62, f.morph - 1) : f.cy + 34 };
  }
  if (reel === 'jump') {
    const pose = whalePose(t), cy = pose.y - cameraTop(t);
    return { cx: pose.x, cy, rot: pose.rot, sx: JUMP_SCALE, sy: JUMP_SCALE, reach: 50, base: cy + 22 };
  }
  if (reel === 'ayaSeed') {
    const f = ayaFilm(t);
    return { cx: f.x, cy: AYA_GROUND - 42 - f.lift, rot: 0, sx: f.sx, sy: f.sy, reach: 48, base: AYA_GROUND - f.lift };
  }
  const f = frogFilm(t);
  return { cx: f.nose - 36, cy: PAD_Y - 20 - f.lift, rot: 0, sx: 1.25 * f.sx, sy: 1.25 * f.sy, reach: 38, base: PAD_Y + 1 - f.lift };
}
/** Every touchable thing on stage at `t`, most particular first (the first spot holding a point wins). */
export function toySpots(reel: ReelId, t: number, hands: Hands = FRESH_HANDS, show: ShowLook = FIRST_SHOW): ToySpot[] {
  const out: ToySpot[] = [];
  const hero = heroPlace(reel, t, hands);
  if (hero.cy > WINDOW.y0 - hero.reach * 0.5 && hero.cy < WINDOW.y1 + hero.reach * 0.5) out.push({ toy: 'clayHero', index: 0, x: hero.cx, y: hero.cy, rx: hero.reach, ry: hero.reach });
  if (reel === 'rocket') {
    starsOf(show.stars).forEach((s, index) => out.push({ toy: 'wireStar', index, x: s.x, y: 26 + s.len, rx: 26, ry: 26 }));
    out.push({ toy: 'nightMoon', index: 0, x: MOON.x, y: MOON.y, rx: 30, ry: 30 });
  } else if (reel === 'jump') {
    const cam = cameraTop(t);
    const seen = (y: number, r: number) => y + r > WINDOW.y0 + 8 && y - r < WINDOW.y1;
    if (seen(JUMP_SUN.y - cam, 26)) out.push({ toy: 'daySun', index: 0, x: JUMP_SUN.x, y: JUMP_SUN.y - cam, rx: 30, ry: 30 });
    cloudsOf(show.sky).forEach(([x, y, s], index) => { if (seen(y - cam, 16)) out.push({ toy: 'puffCloud', index, x, y: y - cam - 4, rx: 40 * s, ry: 24 * s }); });
  } else if (reel === 'ayaSeed') {
    out.push({ toy: 'gardenBloom', index: 0, x: PLANTER_X, y: SOIL_Y - 30, rx: 36, ry: 62 });
    out.push({ toy: 'daySun', index: 0, x: GARDEN_SUN.x, y: GARDEN_SUN.y, rx: 30, ry: 30 });
  } else {
    out.push({ toy: 'lotusBloom', index: 0, x: FROG_XF + 4, y: BLOOM_Y + 2, rx: 32, ry: 30 });
    out.push({ toy: 'daySun', index: 0, x: POND_SUN.x, y: POND_SUN.y, rx: 28, ry: 28 });
    PADS.forEach((p, index) => out.push({ toy: 'padLeaf', index, x: p.x, y: p.y, rx: p.rx * 0.72, ry: 13 }));
  }
  return out;
}
const inside = (s: ToySpot, x: number, y: number) => Math.pow((x - s.x) / s.rx, 2) + Math.pow((y - s.y) / s.ry, 2) <= 1;
/** What is under a point of the backdrop when no toy is: card, air, sea or water. */
export function backdropAt(reel: ReelId, t: number, x: number, y: number): ToyKind {
  if (x < WINDOW.x0 || x > WINDOW.x1 || y < WINDOW.y0) return 'feltDrape';
  if (reel === 'rocket') return y >= 204 ? 'seaSkin' : 'openAir';
  if (reel === 'jump') return y > -cameraTop(t) + 6 ? 'deepWater' : 'openAir';
  if (reel === 'ayaSeed') return 'openAir';
  return y >= 194 ? 'deepWater' : 'openAir';
}
/** The thing a hand lands on at (x, y): never nothing. */
export function toyAt(reel: ReelId, t: number, x: number, y: number, hands: Hands = FRESH_HANDS, show: ShowLook = FIRST_SHOW): ToySpot {
  const hit = toySpots(reel, t, hands, show).find(s => inside(s, x, y));
  return hit ?? { toy: backdropAt(reel, t, x, y), index: 0, x, y, rx: 0, ry: 0 };
}

/* ── touches and the hands' clock ──────────────────────────────────────── */

/** One touch: where, on what, and the hand-frames it began and was let go on. */
export interface Touch { key: number; toy: ToyKind; index: number; x: number; y: number; dir: 1 | -1; born: number; lifted: number | null }
/** A touch as the scene reads it: how long it was held, how long since it was let go (−1 while held). */
export interface LiveTouch { key: number; toy: ToyKind; index: number; x: number; y: number; dir: 1 | -1; held: number; since: number }
/** Hand-frames a touch goes on answering after it is let go. */
export const TOY_TAIL: Readonly<Record<ToyKind, number>> = {
  clayHero: 12, wireStar: 44, nightMoon: 14, daySun: 12, seaSkin: 12, padLeaf: 10, puffCloud: 9, lotusBloom: 12, gardenBloom: 12,
  openAir: 9, deepWater: 11, feltDrape: 10, cometWish: 20, kitFriend: 15, proofLens: 12, wallPoster: 22, reelDone: 16,
};
/** A press cannot be held for ever: it lets go by itself. */
export const HOLD_MAX = 30, MAX_TOUCHES = 8;
const liftOf = (t: Touch, hand: number) => t.lifted ?? (hand - t.born >= HOLD_MAX ? t.born + HOLD_MAX : null);
export function liveTouches(touches: readonly Touch[], hand: number): LiveTouch[] {
  return touches.flatMap(t => {
    const lifted = liftOf(t, hand), held = Math.max(1, (lifted ?? hand) - t.born), since = lifted === null ? -1 : hand - lifted;
    return since >= TOY_TAIL[t.toy] ? [] : [{ key: t.key, toy: t.toy, index: t.index, x: t.x, y: t.y, dir: t.dir, held, since }];
  });
}
/** Drops the touches that have run out. Returns the same list when nothing changed. */
export function pruneTouches(touches: readonly Touch[], hand: number): readonly Touch[] {
  const kept = touches.filter(t => { const lifted = liftOf(t, hand); return lifted === null || hand - lifted < TOY_TAIL[t.toy]; });
  return kept.length === touches.length ? touches : kept;
}
export const addTouch = (touches: readonly Touch[], touch: Touch): readonly Touch[] => [...touches, touch].slice(-MAX_TOUCHES);
export const liftTouch = (touches: readonly Touch[], key: number, hand: number): readonly Touch[] =>
  touches.map(t => t.key === key && t.lifted === null ? { ...t, lifted: Math.max(t.born + 1, hand) } : t);
/** The secret: every star on a wire swinging at once calls a clay comet across the night. */
export const WISH_STARS = 5;
export function allStarsSwinging(touches: readonly Touch[], hand: number): boolean {
  const live = liveTouches(touches, hand);
  if (live.some(t => t.toy === 'cometWish')) return false;
  const swinging = new Set(live.filter(t => t.toy === 'wireStar').map(t => t.index));
  return swinging.size >= WISH_STARS;
}
/** What a press on the clay leaves behind in the child's lasting choices:
 * a thumbprint where it landed, and on the rocket the porthole moves there. */
export function pressInto(hands: Hands, reel: ReelId, t: number, x: number, y: number): Hands {
  if (reel === 'frog' || reel === 'ayaSeed') return hands;
  const hero = heroPlace(reel, t, hands), local = unplacePoint([x, y], hero.cx, hero.cy, hero.rot, hero.sx, hero.sy);
  const next = pressPrint(hands, local);
  return reel === 'rocket' && rocketFilm(t, hands).morph >= PORTHOLE_FROM ? setPorthole(next, portholeSlotAt(local[0])) : next;
}
/** The clay is rocket enough to take a porthole from here on. */
export const PORTHOLE_FROM = 1.6;

/* ── what a touch does, as a function of its age ───────────────────────── */

/** How deep a held press has gone: quick at first, full after half a second. */
export const pressDepth = (held: number) => 0.3 * easeOut(Math.min(1, held / 6));
/** The clay's squash under a press, and its spring back: down while held,
 * then a damped wobble that overshoots into a stretch and settles. */
export function pressSquash(held: number, since: number): number {
  const d = pressDepth(held);
  return since < 0 ? d : d * Math.exp(-0.36 * since) * Math.cos(1.2 * since);
}
/** The thumb dent: pressed in at once, filling back in half a second. */
export const pressDent = (held: number, since: number) => since < 0 ? Math.min(1, held / 2) : Math.max(0, 1 - since / 6);
/** All the live presses on the clay, as one squash (bounded) and the dents. */
export function heroPress(live: readonly LiveTouch[]): { squash: number; squeeze: number; dents: { x: number; y: number; depth: number }[] } {
  const on = live.filter(t => t.toy === 'clayHero');
  const squash = Math.max(-0.16, Math.min(0.34, on.reduce((sum, t) => sum + pressSquash(t.held, t.since), 0)));
  const dents = on.map(t => ({ x: t.x, y: t.y, depth: pressDent(t.held, t.since) })).filter(d => d.depth > 0.02);
  return { squash, squeeze: on.some(t => t.since < 2) ? 1 : 0, dents };
}
/** A flicked star swings out and rocks back to rest, like a pendulum on a wire. Degrees. */
export const flickSwing = (since: number, dir: number) => since < 0 ? 0 : 26 * dir * Math.exp(-since / 15) * Math.sin(0.44 * since);
export const starFlick = (live: readonly LiveTouch[], index: number) => live.reduce((sum, t) => t.toy === 'wireStar' && t.index === index ? sum + flickSwing(t.since, t.dir) : sum, 0);
/** The comet's way across the night sky: 0 → 1 along its arc while it lasts. */
export function cometAt(since: number): { x: number; y: number; tail: number } | null {
  if (since < 0 || since >= TOY_TAIL.cometWish) return null;
  const u = since / (TOY_TAIL.cometWish - 1);
  return { x: lerp(30, 372, u), y: 116 - 62 * Math.sin(Math.PI * u) + 18 * u, tail: Math.min(1, since / 3) * (1 - Math.max(0, (u - 0.8) / 0.2)) };
}
/** A pop: nothing → a little too big → itself. For things that appear. */
export const popIn = (since: number) => since < 0 ? 0 : since < 2 ? 0.6 + 0.3 * since : since < 4 ? 1.2 - 0.1 * (since - 2) : 1;
/** 0 → 1 → 0 over `life` hand-frames. */
export const arcOf = (since: number, life: number) => since < 0 || since >= life ? 0 : Math.sin((Math.PI * since) / life);
/** A soft wobble that dies away: +1 at the touch, then rocking. */
export const wobble = (since: number, rate = 1.2, fade = 4) => since < 0 ? 1 : Math.exp(-since / fade) * Math.cos(rate * since);
/** The cardboard moon spins once on its pin. Degrees. */
export const moonSpin = (since: number) => since < 0 ? 0 : 360 * easeOut(since / TOY_TAIL.nightMoon);
/** A clay fish hops out of the sea where it was tapped and dives back. */
export function fishHop(since: number, x: number, dir: number): { x: number; y: number; rot: number; ring: number } | null {
  if (since < 0 || since >= TOY_TAIL.seaSkin) return null;
  const u = since / (TOY_TAIL.seaSkin - 1), h = 4 * u * (1 - u);
  return { x: x + dir * (-16 + 32 * u), y: -38 * h, rot: dir * (-58 + 116 * u), ring: clamp01(u) };
}

/* ── the audience ──────────────────────────────────────────────────────── */

/** How a friend on a cushion is taking the film: watching, glad (a hop),
 * leaning in, or ears straight up. */
export type FriendMood = 'watching' | 'glad' | 'leaning' | 'earsUp';
const between = (t: number, a: number, b: number) => t >= a && t < b;
/** The audience follows the film itself, so it is the same whichever way the
 * film got to `t`: Pep's ears go up at the splash, Aya leans in for the frog. */
export function audienceAt(reel: ReelId, t: number): Record<FriendId, FriendMood> {
  const all: Record<FriendId, FriendMood> = { gobgob: 'watching', bebe: 'watching', aya: 'watching', chock: 'watching', pep: 'watching' };
  const everyone = (mood: FriendMood) => { for (const id of FRIENDS) all[id] = mood; };
  const end = REEL_SECONDS[reel];
  if (reel === 'rocket') {
    if (between(t, 2.45, 3.3)) all.aya = 'earsUp';
    if (between(t, 3.4, 5)) all.bebe = 'leaning';
    if (between(t, 5, 6.2)) { all.pep = 'earsUp'; all.chock = 'leaning'; all.gobgob = 'leaning'; }
    if (between(t, 6.2, 7.5)) everyone('glad');
  } else if (reel === 'jump') {
    if (between(t, 2.2, 3.2)) all.chock = 'leaning';
    if (between(t, 3.2, SPLASH_T)) all.aya = 'earsUp';
    if (between(t, SPLASH_T, SPLASH_T + 1.3)) { all.pep = 'earsUp'; all.aya = 'glad'; all.gobgob = 'glad'; all.bebe = 'earsUp'; }
    if (between(t, 7.9, end)) { all.chock = 'glad'; all.gobgob = 'glad'; }
  } else if (reel === 'ayaSeed') {
    if (between(t, 2.9, SPROUT_T)) { all.chock = 'leaning'; all.pep = 'leaning'; }
    if (between(t, SPROUT_T, BLOOMED_T)) { all.aya = 'leaning'; all.gobgob = 'leaning'; }
    if (between(t, BLOOMED_T, BLOOMED_T + 1.3)) everyone('glad');
  } else {
    if (between(t, hopStart(5), REACH_START)) { all.aya = 'leaning'; all.pep = 'leaning'; all.bebe = 'leaning'; }
    if (between(t, REACH_START, REACH_TOUCH)) { everyone('leaning'); all.pep = 'earsUp'; }
    if (between(t, REACH_TOUCH, REACH_TOUCH + 1.2)) everyone('glad');
  }
  return all;
}
/** The film's mood for a friend, unless a hand just patted them or a reel just ended (then they are glad). */
export function friendMoods(reel: ReelId, t: number, live: readonly LiveTouch[]): Record<FriendId, FriendMood> {
  const out = audienceAt(reel, t), done = live.some(l => l.toy === 'reelDone');
  FRIENDS.forEach((id, i) => { if (done || live.some(l => l.toy === 'kitFriend' && l.index === i)) out[id] = 'glad'; });
  return out;
}

/* ── the film strip in the hand: inertia ───────────────────────────────── */

/** The strip coasts after a fling: `pos` in frames, `vel` in frames a second. */
export interface Coast { pos: number; vel: number }
export const COAST_FRICTION = 3.4, COAST_STOP = 5, FLING_MAX = 96;
/** One step of coasting: exponential friction, a hard stop at either end of the reel. */
export function coastStep(c: Coast, dt: number, end: number): Coast {
  if (dt <= 0) return c;
  const k = Math.exp(-COAST_FRICTION * dt), pos = c.pos + (c.vel * (1 - k)) / COAST_FRICTION;
  if (pos <= 0) return { pos: 0, vel: 0 };
  if (pos >= end) return { pos: end, vel: 0 };
  return { pos, vel: c.vel * k };
}
export const coastDone = (c: Coast) => Math.abs(c.vel) < COAST_STOP;
/** Where a fling would come to rest if nothing stopped it. */
export const coastRest = (c: Coast, end: number) => Math.max(0, Math.min(end, c.pos + c.vel / COAST_FRICTION));
/** The speed of the hand when it let go, from its last tenth of a second. */
export function flingVelocity(samples: readonly { at: number; pos: number }[], now: number): number {
  const recent = samples.filter(s => now - s.at <= 0.12);
  if (recent.length < 2) return 0;
  const first = recent[0], last = recent[recent.length - 1], dt = last.at - first.at;
  if (dt < 0.02) return 0;
  return Math.max(-FLING_MAX, Math.min(FLING_MAX, (last.pos - first.pos) / dt));
}

/* ── the curtain call ──────────────────────────────────────────────────── */

/** The finish: the curtain closes, opens on the whole clay cast, they bow,
 * roses land at their feet. A pure function of its own time `c` (seconds). */
export const CALL_SECONDS = 2.5;
export interface Rose { id: number; x: number; y: number; rot: number; landed: boolean }
export interface CallFrame { drapes: number; bows: number[]; roses: Rose[]; cast: number }
const CLOSE_BY = 0.42, OPEN_FROM = 0.67, OPEN_BY = 1.08;
export function curtainCall(c: number): CallFrame {
  const drapes = c < CLOSE_BY ? easeInOut(c / CLOSE_BY) : c < OPEN_FROM ? 1 : 1 - easeInOut((c - OPEN_FROM) / (OPEN_BY - OPEN_FROM));
  const bows = [0, 1, 2, 3].map(i => Math.max(arcOf(c - (1.12 + 0.14 * i), 0.5), arcOf(c - 1.98, 0.42)));
  const roses: Rose[] = [];
  for (let id = 0; id < 7; id++) {
    const born = 1.2 + 0.085 * id, u = (c - born) / 0.62;
    if (u < 0) continue;
    const x0 = 40 + 320 * seeded(id, 61), x1 = 74 + 252 * seeded(id, 62), y1 = 244 + 14 * seeded(id, 63), v = Math.min(1, u);
    roses.push({ id, x: lerp(x0, x1, v), y: lerp(300, y1, v) - (70 + 40 * seeded(id, 64)) * 4 * v * (1 - v), rot: (seeded(id, 65) < 0.5 ? -1 : 1) * 300 * (1 - v), landed: u >= 1 });
  }
  return { drapes, bows, roses, cast: c >= CLOSE_BY ? 1 : 0 };
}
/** The rocket in the cast stands on its fins. */
export const CAST_SCALE = ROCKET_SCALE * 0.7;
