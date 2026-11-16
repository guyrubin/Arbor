/** Bottle Lab's toys, as pure numbers: the water (its level, the way it tilts
 * and sloshes), the notes the glass sings, Aya's places and her pour, the
 * keeping turn. No React, no timers, no randomness inside. */
import { AXIS_X, BASE_Y, PROFILES, WALL, radiusAt, type ShapeId } from './bottleGeometry';
import { LAMP_START, slotView, type BottleStickerPlacement } from './bottleLabRules';

// ── Water level ────────────────────────────────────────────────────────────

/** Aya's can fills the bottle a step at a time. Level 2 is the still bottle's
 * own level (the one a kept bottle shows); 5 is brim-full for play. */
export const WATER_LEVELS = 6;
export const WATER_HOME = 2;
const RISE: Readonly<Record<ShapeId, number>> = { round: 8, tall: 9, flask: 7 };
export const clampLevel = (level: number) => Number.isFinite(level) ? Math.max(0, Math.min(WATER_LEVELS - 1, Math.round(level))) : WATER_HOME;
/** The height of the water line in the picture for a level (smaller is higher). */
export const waterY = (shape: ShapeId, level: number) => PROFILES[shape].water - (clampLevel(level) - WATER_HOME) * RISE[shape];
/** The inside half-width of the glass at a height. */
export const waterRadius = (shape: ShapeId, y: number) => radiusAt(shape, y) * (1 - WALL);
/** One more pour; a full bottle is tipped back to nearly empty. */
export const nextLevel = (level: number) => { const l = clampLevel(level); return l >= WATER_LEVELS - 1 ? 0 : l + 1; };

// ── Notes ──────────────────────────────────────────────────────────────────

/** One scale for every sound in the activity: D major pentatonic, D4 to A6. */
export const GLASS_SCALE: readonly number[] = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51, 1479.98, 1760];
const RING_TOP: Readonly<Record<ShapeId, number>> = { round: 10, tall: 11, flask: 9 };
const note = (index: number) => GLASS_SCALE[Math.max(0, Math.min(GLASS_SCALE.length - 1, Math.round(index)))];
export const scaleNote = note;
/** A tapped glass rings lower the fuller it is. */
export const ringNote = (shape: ShapeId, level: number) => note(RING_TOP[shape] - clampLevel(level));
/** Blown across its open top, a bottle hoots higher the fuller it is (less air inside). */
const HOOT_LOW: Readonly<Record<ShapeId, number>> = { round: 1, tall: 2, flask: 0 };
export const hootNote = (shape: ShapeId, level: number) => note(HOOT_LOW[shape] + clampLevel(level));
/** The three arched windows each ping their own note. */
export const windowNote = (x: number) => note(x < 118 ? 5 : x > 242 ? 8 : 7);

// ── Tilt and slosh ─────────────────────────────────────────────────────────

/** `tilt` is how far the bottle leans (degrees, positive to the right);
 * `slosh` is how far the water's surface is off level in the room. */
export interface Sway { tilt: number; tiltV: number; slosh: number; sloshV: number }
export const TILT_MAX = 14;
export const SLOSH_MAX = 20;
export const stillSway = (): Sway => ({ tilt: 0, tiltV: 0, slosh: 0, sloshV: 0 });
export const clampTilt = (tilt: number) => Number.isFinite(tilt) ? Math.max(-TILT_MAX, Math.min(TILT_MAX, tilt)) : 0;
/** The lean a finger asks for when it drags the neck `dx` scene units sideways at `grip` units above the base. */
export const tiltFor = (dx: number, grip: number) => clampTilt(Math.atan2(Number.isFinite(dx) ? dx : 0, Math.max(40, grip)) * 180 / Math.PI);

/** One step of the two springs. Held (`hold` is the lean the finger asks for)
 * the bottle follows the finger; let go it rocks back upright. The water lags
 * behind every change of lean and then swings home. */
export function stepSway(s: Sway, hold: number | null, dt: number): Sway {
  let { tilt, tiltV, slosh, sloshV } = s;
  let left = Number.isFinite(dt) ? Math.min(0.1, Math.max(0, dt)) : 0;
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 120); left -= h;
    const target = hold === null ? 0 : clampTilt(hold);
    const k = hold === null ? 70 : 260, c = hold === null ? 5.2 : 30;
    const a = k * (target - tilt) - c * tiltV;
    tiltV += a * h; tilt += tiltV * h;
    // The water is pushed the other way by the bottle's own acceleration.
    const w = -84 * slosh - 2.6 * sloshV - 0.5 * a;
    sloshV += w * h; slosh += sloshV * h;
    if (Math.abs(tilt) > TILT_MAX) { tilt = clampTilt(tilt); tiltV = 0; }
    if (Math.abs(slosh) > SLOSH_MAX) { slosh = Math.sign(slosh) * SLOSH_MAX; sloshV *= -0.3; }
  }
  if (hold === null && Math.abs(tilt) < 0.02 && Math.abs(tiltV) < 0.2 && Math.abs(slosh) < 0.03 && Math.abs(sloshV) < 0.3) return stillSway();
  return { tilt, tiltV, slosh, sloshV };
}
/** A tap gives the bottle a small knock away from the finger. */
export const knock = (s: Sway, side: number, strength = 1): Sway => ({ ...s, tiltV: s.tiltV + side * 34 * strength, sloshV: s.sloshV - side * 46 * strength });
export const swayStill = (s: Sway) => s.tilt === 0 && s.tiltV === 0 && s.slosh === 0 && s.sloshV === 0;
/** The water line's angle as drawn on the leaning bottle: level in the room, plus the slosh. */
export const waterLine = (s: Sway) => Math.max(-30, Math.min(30, s.slosh - s.tilt));

// ── Aya ────────────────────────────────────────────────────────────────────

/** Aya stands on the side the lamp is not on, and can hop behind the bottle,
 * where the water shows her huge and the wrong way round. */
export type AyaSpot = 'left' | 'right' | 'behind';
export const AYA = { reach: 134, feet: 386, far: 368, height: 90, speed: 190 } as const;
export const ayaX = (spot: AyaSpot) => spot === 'behind' ? AXIS_X : AXIS_X + (spot === 'left' ? -AYA.reach : AYA.reach);
/** The side Aya goes home to for a lamp angle. */
export const ayaSide = (angle: number): 'left' | 'right' => angle > 0 ? 'left' : 'right';
/** When the lamp comes over to her side she crosses to the other one. */
export function ayaAfterLamp(home: 'left' | 'right', angle: number): 'left' | 'right' {
  if (home === 'right' && angle > 14) return 'left';
  if (home === 'left' && angle < -14) return 'right';
  return home;
}
/** One step of her hopping walk toward `target`. `lift` is how high this hop is right now. */
export function stepAya(x: number, target: number, dt: number) {
  const step = AYA.speed * (Number.isFinite(dt) ? Math.min(0.1, Math.max(0, dt)) : 0), gap = target - x;
  const next = Math.abs(gap) <= step ? target : x + Math.sign(gap) * step;
  const near = 1 - Math.min(1, Math.abs(next - AXIS_X) / 96);
  return { x: next, y: AYA.feet - (AYA.feet - AYA.far) * near, lift: next === target ? 0 : Math.abs(Math.sin(next / 15 * Math.PI)) * 9, moving: next !== target };
}

/** The pour, from its start (0) to its end (1): the can lifts to the mouth,
 * tips, pours and goes home. `reach` is how far along the way to the mouth
 * it is, `tip` how far tipped, `flow` whether water is falling. */
export const POUR_MS = 1500;
export function pourPose(t: number) {
  const p = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 1;
  const ease = (v: number) => { const c = Math.max(0, Math.min(1, v)); return c * c * (3 - 2 * c); };
  const reach = p < 0.5 ? ease(p / 0.28) : ease((1 - p) / 0.24);
  const tip = p < 0.5 ? ease((p - 0.2) / 0.16) : ease((0.82 - p) / 0.12);
  return { reach, tip, flow: p > 0.34 && p < 0.74, shown: p < 1 };
}

// ── Hints and the keeping turn ─────────────────────────────────────────────

/** The one gesture the ghost hand shows next: first a tap on the glass; once
 * a sticker is on, a turn. Each goes for good when the child has done it. */
export type HintId = 'ring' | 'turn';
export function nextHint(done: Readonly<Record<HintId, boolean>>, stickers: number): HintId | null {
  if (!done.ring) return 'ring';
  return stickers > 0 && !done.turn ? 'turn' : null;
}

export const KEEP_MS = 2500;
export const KEEP_REDUCED_MS = 900;
/** When the five glints of the keeping turn sparkle, as shares of its length. */
export const KEEP_GLINTS: readonly number[] = [0.16, 0.3, 0.44, 0.58, 0.8];
/** The keeping turn at time t (0 to 1): a small dip, one sweep of at least
 * two thirds of a turn that ends on `to` (the view a kept bottle is shown
 * at), the lamp crossing to the far side and coming home to LAMP_START. */
export function keepPose(t: number, from: number, to: number, lampFrom: number) {
  const p = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 1;
  const gap = (((to - from) % 360) + 360) % 360, travel = gap < 240 ? gap + 360 : gap;
  const u = Math.max(0, Math.min(1, (p - 0.1) / 0.78)), ease = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
  const dip = p < 0.1 ? Math.sin(p / 0.1 * Math.PI) : 0;
  const far = lampFrom <= 0 ? 52 : -52, v = Math.min(1, p / 0.5), back = Math.max(0, (p - 0.5) / 0.5);
  const smooth = (x: number) => x * x * (3 - 2 * x);
  const lamp = p <= 0.5 ? lampFrom + (far - lampFrom) * smooth(v) : far + (LAMP_START - far) * smooth(back);
  return { rotation: from + travel * ease, lamp, dip };
}

/** Where a sticker's shadow falls inside the bottle's own shadow: `u` across
 * (-1 to 1) and `t` up the bottle (0 the base, 1 the top), as the lamp sees it. */
export function stickerShade(shape: ShapeId, placement: BottleStickerPlacement, rotation: number, lamp: number) {
  const v = slotView(placement.slot, rotation - lamp * 0.6), y = PROFILES[shape].rows[v.row], top = PROFILES[shape].knots[0][0];
  return { u: v.x, wide: Math.max(0.25, v.scaleX), t: (BASE_Y - y) / (BASE_Y - top), radius: radiusAt(shape, y) };
}
