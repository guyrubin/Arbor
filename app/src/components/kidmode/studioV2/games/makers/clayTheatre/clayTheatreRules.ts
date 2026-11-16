/** Clay Theatre rules. Pure: no React, no timers, no randomness (every
 * "random" spread is seeded by an index), no history. Every film is a
 * closed-form function of its time `t` (seconds), so a frame reached by
 * playing, by scrubbing or by running backwards is the same frame. */
import {
  BODY_KEYFRAMES, PART_KEYS, beatBody, bendBody, clamp01, easeIn, easeInOut, easeOut, lerp, lerpParts, lerpShape, placePoint, seeded, span,
  type PartKey, type Pt,
} from './clayShapes';

/** Stop-motion: time is cut into 12 frames a second. */
export const FPS = 12;
export type ReelId = 'rocket' | 'jump' | 'frog';
export const REELS: readonly ReelId[] = ['rocket', 'jump', 'frog'];
export const REEL_SECONDS: Readonly<Record<ReelId, number>> = { rocket: 8, jump: 9, frog: 11 };
export const lastFrame = (reel: ReelId) => Math.round(REEL_SECONDS[reel] * FPS);
/** The frame shown at time `t`: floor(t·12), held inside the reel. */
export function frameAt(t: number, reel?: ReelId): number {
  const frame = Math.floor(t * FPS + 1e-6);
  return Math.max(0, reel ? Math.min(lastFrame(reel), frame) : frame);
}
export const timeOf = (frame: number) => frame / FPS;

/** The reels a child is offered: the halving puzzle is for school-age children. */
export function reelsFor(stage: 'baby' | 'toddler' | 'preschool' | 'school'): readonly ReelId[] {
  return stage === 'school' ? REELS : REELS.filter(reel => reel !== 'frog');
}

/* ── sound cues ─────────────────────────────────────────────────────────── */

export type CueKind = 'bloop' | 'puff' | 'whoosh' | 'splash' | 'plop' | 'boing' | 'stretch' | 'chime';
export interface Cue { at: number; kind: CueKind }
export const FROG_HOPS = 7;
/** Frame-aligned (multiples of 1/12 s), so a hop step lands exactly on a frame. */
const HOP_START = 0.75, HOP_LEN = 1, TAKEOFF = 0.25, AIR = 0.5;
export const hopStart = (hop: number) => HOP_START + (hop - 1) * HOP_LEN;
export const hopTakeoff = (hop: number) => hopStart(hop) + TAKEOFF;
export const hopLanding = (hop: number) => hopTakeoff(hop) + AIR;
export const REACH_START = HOP_START + FROG_HOPS * HOP_LEN + 0.75, REACH_TOUCH = REACH_START + 1.25;
export const CUES: Readonly<Record<ReelId, readonly Cue[]>> = {
  rocket: [{ at: 2.45, kind: 'bloop' }, { at: 5, kind: 'puff' }, { at: 5.4, kind: 'puff' }, { at: 5.8, kind: 'puff' }, { at: 6.2, kind: 'whoosh' }],
  jump: [{ at: 3.2, kind: 'plop' }, { at: 4.6, kind: 'splash' }, { at: 7.95, kind: 'plop' }],
  frog: [...Array.from({ length: FROG_HOPS }, (_, i) => ({ at: hopTakeoff(i + 1), kind: 'boing' as const })), { at: REACH_START, kind: 'stretch' }, { at: REACH_TOUCH, kind: 'chime' }],
};
/** The cues passed while the film PLAYS from `prev` to `next`, in playback
 * order. Edge-triggered: a cue sounds once when its time is crossed, forward
 * or backward. Scrubbing (not playing) and big jumps are silent, so a cue can
 * never machine-gun. */
export function cuesCrossed(cues: readonly Cue[], prev: number, next: number, playing: boolean): CueKind[] {
  if (!playing || prev === next || Math.abs(next - prev) > 0.5) return [];
  if (next > prev) return cues.filter(c => c.at > prev && c.at <= next).sort((a, b) => a.at - b.at).map(c => c.kind);
  return cues.filter(c => c.at >= next && c.at < prev).sort((a, b) => b.at - a.at).map(c => c.kind);
}

/* ── the projector ─────────────────────────────────────────────────────── */

export interface Transport { reel: ReelId; t: number; playing: boolean; backwards: boolean; watched: readonly ReelId[] }
export const startTransport = (reel: ReelId, watched: readonly ReelId[] = []): Transport => ({ reel, t: 0, playing: false, backwards: false, watched });
/** A reel counts as watched once its last frame has been on screen, however it got there. */
function seen(s: Transport, t: number): readonly ReelId[] {
  return frameAt(t, s.reel) === lastFrame(s.reel) && !s.watched.includes(s.reel) ? [...s.watched, s.reel] : s.watched;
}
const clampT = (reel: ReelId, t: number) => Math.min(REEL_SECONDS[reel], Math.max(0, t));
/** One step of playback. The film stops by itself at either end. */
export function tick(s: Transport, dt: number): Transport {
  if (!s.playing || dt <= 0) return s;
  const raw = s.t + (s.backwards ? -dt : dt), t = clampT(s.reel, raw);
  const ended = s.backwards ? t <= 0 : t >= REEL_SECONDS[s.reel];
  return { ...s, t, playing: !ended, watched: seen(s, t) };
}
/** Play from where the film is; from an end it starts over in its direction. */
export function play(s: Transport): Transport {
  const end = REEL_SECONDS[s.reel];
  const t = !s.backwards && s.t >= end ? 0 : s.backwards && s.t <= 0 ? end : s.t;
  return { ...s, t, playing: true, watched: seen(s, t) };
}
/** Pause freezes the frame on screen (time snaps to it). */
export const pause = (s: Transport): Transport => s.playing ? { ...s, playing: false, t: timeOf(frameAt(s.t, s.reel)) } : s;
export function seek(s: Transport, t: number): Transport {
  const at = timeOf(frameAt(clampT(s.reel, t), s.reel));
  return { ...s, t: at, playing: false, watched: seen(s, at) };
}
export const seekFrame = (s: Transport, frame: number) => seek(s, timeOf(Math.max(0, Math.min(lastFrame(s.reel), frame))));
export const stepFrame = (s: Transport, by: number) => seekFrame(s, frameAt(s.t, s.reel) + by);
export const toStart = (s: Transport) => seek(s, 0);
export const setDirection = (s: Transport, backwards: boolean): Transport => ({ ...s, backwards });
export const chooseReel = (s: Transport, reel: ReelId): Transport => startTransport(reel, s.watched);
export const allWatched = (s: Transport, offered: readonly ReelId[]) => offered.every(reel => s.watched.includes(reel));

/** The frog film steps one hop at a time: the moments after each landing. */
export const HOP_STOPS: readonly number[] = [0, ...Array.from({ length: FROG_HOPS }, (_, i) => hopStart(i + 1) + HOP_LEN), REACH_TOUCH, REEL_SECONDS.frog];
export function stepHop(s: Transport, by: 1 | -1): Transport {
  const now = s.t, eps = 1 / (FPS * 2);
  const target = by > 0 ? HOP_STOPS.find(stop => stop > now + eps) ?? REEL_SECONDS.frog : [...HOP_STOPS].reverse().find(stop => stop < now - eps) ?? 0;
  return seek(s, target);
}

/** Words for the strip slider: "moment 3 of 8" (one moment a second), or the hop for the frog. */
export type Moment = { kind: 'moment'; index: number; total: number } | { kind: 'hop'; index: number; total: number } | { kind: 'start' } | { kind: 'reach' };
export function momentOf(reel: ReelId, t: number): Moment {
  if (reel === 'frog') {
    if (t >= REACH_START) return { kind: 'reach' };
    const hops = hopsLanded(t);
    return hops === 0 ? { kind: 'start' } : { kind: 'hop', index: hops, total: FROG_HOPS };
  }
  const total = REEL_SECONDS[reel];
  return { kind: 'moment', index: Math.min(total, Math.floor(t) + 1), total };
}

/** What the caption under the stage says at `t`. */
export type Caption = 'swim' | 'squash' | 'stretch' | 'count' | 'lift' | 'deep' | 'rise' | 'fly' | 'splash' | 'wave' | 'want' | 'half' | 'closer' | 'reach';
export function captionAt(reel: ReelId, t: number): Caption {
  if (reel === 'rocket') return t < 2 ? 'swim' : t < 3.4 ? 'squash' : t < 5 ? 'stretch' : t < 6.2 ? 'count' : 'lift';
  if (reel === 'jump') return t < 2.2 ? 'deep' : t < 3.2 ? 'rise' : t < 4.6 ? 'fly' : t < 7.3 ? 'splash' : 'wave';
  return t < hopStart(2) ? 'want' : t < hopStart(5) ? 'half' : t < REACH_START ? 'closer' : 'reach';
}

/* ── film 1: Whale into Rocket ─────────────────────────────────────────── */

export const ROCKET_SCALE = 0.8;
export interface Puff { id: number; x: number; y: number; r: number; o: number }
export interface RocketFrame {
  /** The body outline in local space (morphed, tail beat applied); `place` it with the transform. */
  body: Pt[]; parts: PartKey;
  cx: number; cy: number; rot: number; sx: number; sy: number;
  /** 0 (whale) → 1 (lump) → 2 (rocket): which shape the clay is nearest. */
  morph: number;
  flame: number; tailLift: number; puffs: Puff[]; stars: number[]; shadow: number;
}
/** Where the whale's head sits in the sea, the lump settles, and the rocket stands. */
const SEA_WHALE_Y = 190, SEA_LUMP_Y = 196, SEA_ROCKET_Y = 150;
function rocketCore(t: number) {
  const s1 = span(t, 2, 3), s2 = span(t, 3.4, 5);
  const swim = 1 - span(t, 1.9, 2.7);
  const tailLift = 9 * swim * Math.sin(2 * Math.PI * 1.1 * t);
  const rot = -90 * span(t, 3.5, 4.9) + (t > 6.2 ? 2.2 * Math.sin(2 * Math.PI * 2.6 * t) * (1 - span(t, 6.4, 7.6)) : 0);
  let cy = lerp(lerp(SEA_WHALE_Y, SEA_LUMP_Y, s1), SEA_ROCKET_Y, s2) + 2.5 * Math.sin(2 * Math.PI * 0.55 * t) * swim;
  if (t > 6.2) cy -= 150 * Math.pow(t - 6.2, 2);
  return { s1, s2, swim, tailLift, rot, cy };
}
export function rocketFilm(t: number): RocketFrame {
  const frame = frameAt(t);
  const { s1, s2, tailLift, rot, cy } = rocketCore(t);
  const shape = s2 > 0 ? lerpShape(BODY_KEYFRAMES.lump, BODY_KEYFRAMES.rocket, s2) : lerpShape(BODY_KEYFRAMES.whale, BODY_KEYFRAMES.lump, s1);
  const parts = s2 > 0 ? lerpParts(PART_KEYS.lump, PART_KEYS.rocket, s2) : lerpParts(PART_KEYS.whale, PART_KEYS.lump, s1);
  // The squash: the clay flattens and spreads as it is pressed, then settles with a small wobble.
  const q = Math.sin(Math.PI * s1);
  const settle = t > 3 && t < 3.5 ? 0.05 * Math.sin((t - 3) * Math.PI * 6) * (1 - (t - 3) / 0.5) : 0;
  const sx = ROCKET_SCALE * (1 + 0.15 * q - settle), sy = ROCKET_SCALE * (1 - 0.17 * q + settle);
  const shudder = t >= 5 && t < 6.2 ? (seeded(frame, 91) - 0.5) * 2.6 * span(t, 5, 6.2, v => v) : 0;
  const flicker = 0.85 + 0.3 * seeded(frame, 17);
  const flame = t < 5 ? 0 : t < 6.2 ? 0.32 * flicker : Math.min(1.25, (0.85 + 0.4 * span(t, 6.2, 6.6)) * flicker);
  return {
    body: beatBody(shape, tailLift), parts, cx: 200 + shudder, cy, rot, sx, sy,
    morph: s2 > 0 ? 1 + s2 : s1, flame, tailLift, puffs: rocketPuffs(t), stars: starSwing(t),
    shadow: t < 6.2 ? 1 : 1 - span(t, 6.2, 6.9),
  };
}
/** The countdown puffs, then the trail. A puff exists only for its own lifetime. */
const PUFF_LIFE = 1.3;
const PUFF_BIRTHS: readonly number[] = [5, 5.4, 5.8, ...Array.from({ length: 10 }, (_, i) => 6.25 + i * 0.12)];
export function rocketPuffs(t: number): Puff[] {
  const out: Puff[] = [];
  PUFF_BIRTHS.forEach((born, id) => {
    const age = t - born;
    if (age < 0 || age >= PUFF_LIFE) return;
    const e = age / PUFF_LIFE, side = seeded(id, 3) < 0.5 ? -1 : 1;
    const core = rocketCore(born);
    const base = placePoint([-78, 0], 200, core.cy, core.rot, ROCKET_SCALE);
    out.push({ id, x: base[0] + side * (12 + 24 * easeOut(e)) + (seeded(id, 5) - 0.5) * 10, y: Math.min(base[1], 226) + 4 - 10 * easeOut(e), r: 9 + 17 * easeOut(e) + seeded(id, 7) * 4, o: Math.pow(1 - e, 1.4) });
  });
  return out;
}
/** Five clay stars on wires; they sway, and shake at lift-off. Degrees. */
export const STARS: readonly { x: number; len: number; r: number }[] = [
  { x: 58, len: 46, r: 11 }, { x: 118, len: 80, r: 8 }, { x: 262, len: 64, r: 10 }, { x: 318, len: 36, r: 8 }, { x: 352, len: 92, r: 12 },
];
export function starSwing(t: number): number[] {
  const shake = span(t, 6.2, 6.6) * (1 - span(t, 7, 8));
  return STARS.map((_, i) => 5 * Math.sin(2 * Math.PI * 0.42 * t + i * 1.7) + 9 * shake * Math.sin(2 * Math.PI * 3.1 * t + i * 2.3));
}

/* ── film 2: The Whale's Jump ──────────────────────────────────────────── */

/** The water's surface is world y = 0; down is positive. */
export const JUMP_SCALE = 0.58;
export const SPLASH_T = 4.6, SPLASH_X = 284, TAIL_X = 270;
const G = 600, ARC_G = 449, ARC_V = 314, ARC_VX = 76, BREACH_T = 3.2, BREACH_X = 178;
export interface WhalePose { x: number; y: number; rot: number; bend: number; lift: number }
/** The whale's position, rotation, body bend and tail beat at `t`. */
export function whalePose(t: number): WhalePose {
  if (t < 2.2) {
    const k = clamp01(t / 2.2);
    return { x: lerp(100, 152, k), y: lerp(150, 72, easeInOut(k)), rot: lerp(-8, -32, easeInOut(k)), bend: 0, lift: 10 * Math.sin(2 * Math.PI * 1.5 * t) };
  }
  if (t < BREACH_T) {
    const u = (t - 2.2) / 1;
    return { x: lerp(152, BREACH_X, u), y: lerp(72, 0, easeIn(u)), rot: lerp(-32, -75, easeIn(u)), bend: -0.2 * u, lift: 10 * (1 - u) * Math.sin(2 * Math.PI * 2 * t) };
  }
  if (t < SPLASH_T) {
    const tau = t - BREACH_T, vy = -ARC_V + ARC_G * tau;
    return { x: BREACH_X + ARC_VX * tau, y: -ARC_V * tau + 0.5 * ARC_G * tau * tau, rot: (Math.atan2(vy, ARC_VX) * 180) / Math.PI, bend: 0.55 * Math.sin((Math.PI * tau) / (SPLASH_T - BREACH_T)), lift: 0 };
  }
  const tau = t - SPLASH_T, end = (Math.atan2(-ARC_V + ARC_G * (SPLASH_T - BREACH_T), ARC_VX) * 180) / Math.PI;
  return { x: SPLASH_X + 50 * tau, y: 150 * tau - 22 * tau * tau, rot: lerp(end, 30, span(tau, 0, 1.6)), bend: 0, lift: 8 * span(tau, 0.3, 1) * Math.sin(2 * Math.PI * 1.4 * t) };
}
export function whaleBody(pose: WhalePose): Pt[] {
  return bendBody(beatBody(BODY_KEYFRAMES.whale, pose.lift), pose.bend);
}
/** The camera starts under the water and rises with the whale. World y at the stage's top. */
export const cameraTop = (t: number) => lerp(-64, -206, span(t, 1.7, 3.3));

export interface Droplet { id: number; x: number; y: number; r: number }
interface Ballistic { id: number; born: number; x0: number; y0: number; vx: number; vy: number; r: number }
/** Water sheeting off the whale while it flies, born along its body. */
const SHEET: readonly Ballistic[] = Array.from({ length: 18 }, (_, i) => {
  const born = 3.24 + i * 0.044, pose = whalePose(born), next = whalePose(born + 0.01);
  const along = lerp(46, -92, seeded(i, 1)), across = lerp(-26, 30, seeded(i, 2));
  const [x0, y0] = placePoint([along, across], pose.x, pose.y, pose.rot, JUMP_SCALE);
  const wvx = (next.x - pose.x) / 0.01, wvy = (next.y - pose.y) / 0.01;
  return { id: i, born, x0, y0, vx: wvx * 0.32 + (seeded(i, 3) - 0.5) * 60, vy: wvy * 0.22 + 30 + seeded(i, 4) * 40, r: 2 + 2.6 * seeded(i, 5) };
}).filter(d => d.y0 < -3);
/** The splash: a crown of droplets thrown out where the whale comes down. */
const SPLASH: readonly Ballistic[] = Array.from({ length: 26 }, (_, i) => ({
  id: 100 + i, born: SPLASH_T + 0.006 * i, x0: SPLASH_X + (seeded(i, 11) - 0.5) * 52, y0: -2,
  vx: (seeded(i, 12) - 0.5) * 300, vy: -(170 + 220 * seeded(i, 13)), r: 3 + 3.6 * seeded(i, 14),
}));
export const DROPLETS: readonly Ballistic[] = [...SHEET, ...SPLASH];
/** Seconds from birth until a droplet falls back to the surface (y = 0). */
export function landsAfter(d: Pick<Ballistic, 'y0' | 'vy'>): number {
  return (-d.vy + Math.sqrt(d.vy * d.vy - 2 * G * d.y0)) / G;
}
/** Every droplet in the air at `t`: each one exists only between its birth and
 * its landing, on its own arc, so the same `t` always gives the same droplets. */
export function droplets(t: number): Droplet[] {
  const out: Droplet[] = [];
  for (const d of DROPLETS) {
    const tau = t - d.born;
    if (tau < 0 || tau >= landsAfter(d)) continue;
    out.push({ id: d.id, x: d.x0 + d.vx * tau, y: d.y0 + d.vy * tau + 0.5 * G * tau * tau, r: d.r });
  }
  return out;
}
export interface Ring { id: number; x: number; rx: number; ry: number; o: number }
const RINGS: readonly { born: number; x: number; life: number; size: number }[] = [
  { born: 4.62, x: SPLASH_X, life: 2.8, size: 96 }, { born: 4.9, x: SPLASH_X, life: 2.6, size: 80 }, { born: 5.25, x: SPLASH_X, life: 2.4, size: 66 },
  { born: 3.22, x: BREACH_X, life: 1.6, size: 44 }, { born: 7.95, x: TAIL_X, life: 1.05, size: 40 },
];
/** Foam rings spread across the surface and fade. */
export function foamRings(t: number): Ring[] {
  return RINGS.flatMap((ring, id) => {
    const tau = t - ring.born;
    if (tau < 0 || tau >= ring.life) return [];
    const rx = 12 + ring.size * (1 - Math.exp(-1.6 * tau));
    return [{ id, x: ring.x, rx, ry: rx * 0.2, o: Math.pow(1 - tau / ring.life, 1.3) }];
  });
}
/** The crown of clay water thrown up by the splash: 0 → 1 → 0. */
export const splashCrown = (t: number) => t < SPLASH_T ? 0 : t < SPLASH_T + 0.22 ? easeOut((t - SPLASH_T) / 0.22) : 1 - easeIn((t - SPLASH_T - 0.22) / 0.55);
export interface Bubble { id: number; x: number; y: number; r: number }
interface Riser { id: number; born: number; x0: number; y0: number; speed: number; r: number }
const RISERS: readonly Riser[] = [
  ...Array.from({ length: 10 }, (_, i) => { const born = 0.15 + 0.21 * i, pose = whalePose(born), [x0, y0] = placePoint([34, -44], pose.x, pose.y, pose.rot, JUMP_SCALE); return { id: i, born, x0, y0, speed: 36 + 22 * seeded(i, 21), r: 2.4 + 3 * seeded(i, 22) }; }),
  ...Array.from({ length: 12 }, (_, i) => { const born = 4.76 + 0.15 * i, pose = whalePose(born); return { id: 20 + i, born, x0: pose.x + (seeded(i, 23) - 0.5) * 30, y0: pose.y + (seeded(i, 24) - 0.5) * 20, speed: 46 + 26 * seeded(i, 25), r: 2 + 3.4 * seeded(i, 26) }; }),
].filter(b => b.y0 > 8);
/** Bubbles rise from the whale and pop at the surface. */
export function bubbles(t: number): Bubble[] {
  return RISERS.flatMap(b => {
    const tau = t - b.born, y = b.y0 - b.speed * tau;
    if (tau < 0 || y <= 4) return [];
    return [{ id: b.id, x: b.x0 + 4 * Math.sin(4 * tau + b.id), y, r: b.r }];
  });
}
/** The tail wave at the end: up out of the water, a wave, back down. */
export function tailWave(t: number): { rise: number; rot: number } {
  return { rise: span(t, 7.3, 7.9) - span(t, 8.55, 9), rot: 22 * Math.sin(2 * Math.PI * 1.5 * (t - 7.9)) * (t > 7.9 && t < 8.7 ? 1 : 0) };
}
/** The surface wave height at x (world), with the splash's ripple travelling out. */
export function surfaceAt(x: number, t: number): number {
  let y = 2.2 * Math.sin(x / 26 + 2.1 * t) + 1.3 * Math.sin(x / 11 - 3.3 * t);
  if (t > SPLASH_T) { const tau = t - SPLASH_T, d = Math.abs(x - SPLASH_X); y += 6 * Math.exp(-1.2 * tau) * Math.exp(-d / 120) * Math.sin(d / 10 - 9 * tau); }
  return y;
}

/* ── film 3: Halfway Frog ──────────────────────────────────────────────── */

/** After `hop` hops the frog has covered 1 − (½)^hop of the way: each hop is half of what was left. */
export const frogPosition = (hop: number) => 1 - Math.pow(0.5, hop);
/** The measuring ribbon: hop k's stretch is exactly (½)^k of the way; what is left after them all is (½)^7. */
export function ribbonSegments(hops = FROG_HOPS): { hop: number; from: number; to: number; length: number }[] {
  return Array.from({ length: hops }, (_, i) => ({ hop: i + 1, from: frogPosition(i), to: frogPosition(i + 1), length: Math.pow(0.5, i + 1) }));
}
export const hopsLanded = (t: number) => Array.from({ length: FROG_HOPS }, (_, i) => i + 1).filter(hop => t >= hopLanding(hop)).length;
/** Nose start, flower stem and the stretch between them (stage units). */
export const FROG_X0 = 104, FROG_XF = 332, FROG_D = FROG_XF - FROG_X0;
export interface FrogFrame { progress: number; nose: number; lift: number; sx: number; sy: number; hop: number; arm: number; touched: boolean; bob: number; look: number; loupe: number; gap: number }
export function frogFilm(t: number): FrogFrame {
  let progress = frogPosition(hopsLanded(t)), lift = 0, sx = 1, sy = 1, hop = 0;
  for (let k = 1; k <= FROG_HOPS; k++) {
    const start = hopStart(k), off = hopTakeoff(k), land = hopLanding(k);
    if (t < start || t >= start + HOP_LEN) continue;
    hop = k;
    const len = Math.pow(0.5, k), height = Math.min(62, Math.max(5, len * FROG_D * 0.5));
    if (t < off) { const c = Math.sin((Math.PI * (t - start)) / TAKEOFF / 2); sy = 1 - 0.14 * c; sx = 1 + 0.08 * c; }
    else if (t < land) { const u = (t - off) / AIR; progress = lerp(frogPosition(k - 1), frogPosition(k), u); lift = height * 4 * u * (1 - u); sy = 1.08; sx = 0.94; }
    else { const u = (t - land) / (HOP_LEN - TAKEOFF - AIR), c = Math.sin(Math.PI * Math.min(1, u * 1.6)); sy = 1 - 0.12 * c; sx = 1 + 0.07 * c; }
  }
  const arm = span(t, REACH_START, REACH_TOUCH), touched = t >= REACH_TOUCH;
  const bob = touched ? 5 * Math.exp(-2.2 * (t - REACH_TOUCH)) * Math.sin(12 * (t - REACH_TOUCH)) : 0;
  const gap = FROG_D * (1 - progress);
  return {
    progress, nose: FROG_X0 + FROG_D * progress, lift, sx, sy, hop, arm, touched, bob,
    look: span(t, REACH_START - 0.8, REACH_START - 0.3), loupe: hopsLanded(t) >= 5 ? 1 - span(t, REACH_START, REACH_START + 0.4) : 0, gap,
  };
}

/** Fills the numbered blanks of a line: `{0}` is the first value, `{1}` the next. */
export function clayLine(template: string, ...values: (string | number)[]): string {
  return template.replace(/\{(\d)\}/g, (_match, slot: string) => String(values[Number(slot)] ?? ''));
}
