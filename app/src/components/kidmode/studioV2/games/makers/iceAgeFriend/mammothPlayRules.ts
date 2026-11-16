/** How the mammoth answers the child. Pure: no DOM, no timers, no randomness
 * inside (a random source is passed in). The animal's mood, the snow that
 * gathers on its back, the offered grass, the authored hint hand, the little
 * gestures of its toys, the lift of the trunk for the call and the one musical scale
 * every sound is drawn from all live here, so the engine only steps them. */
import type { Vec } from './iceAgeFriendRules';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/** Anticipation, action, follow-through: dips a little, overshoots, settles at 1. */
export function overshoot(t: number): number {
  const x = clamp01(t);
  if (x < 0.18) return -0.12 * Math.sin((x / 0.18) * Math.PI);
  const k = (x - 0.18) / 0.82;
  return 1 + 0.45 * Math.sin(k * Math.PI) * (1 - k) - Math.pow(1 - k, 3);
}

/* ── one scale for every sound ────────────────────────────────────────── */

/** D major pentatonic (D E F♯ A B): any two notes together are consonant. */
export const SCALE_ROOT_HZ = 146.83;
const PENTATONIC = [0, 2, 4, 7, 9] as const;
/** The pitch of scale step n; step 0 is D3, step 5 the D above, and so on. */
export function scaleNote(step: number): number {
  const n = Math.round(Number.isFinite(step) ? step : 0);
  const octave = Math.floor(n / PENTATONIC.length), degree = ((n % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length;
  return SCALE_ROOT_HZ * Math.pow(2, octave + PENTATONIC[degree] / 12);
}
/** A step between low and high (inclusive) that is never the one before, so repeats never sound identical. */
export function nextStep(previous: number, low: number, high: number, random: () => number): number {
  const span = Math.max(1, high - low);
  let step = low + Math.floor(clamp01(random()) * (span + 1));
  if (step > high) step = high;
  if (step === previous) step = step + 1 > high ? low : step + 1;
  return step;
}
/** The two rising notes that mark the n-th discovery (0..4): each a step higher than the last. */
export function foundNotes(index: number): [number, number] {
  const n = Math.max(0, Math.min(4, Math.round(index)));
  return [5 + n, 8 + n];
}

/* ── mood: stroked, the mammoth settles ───────────────────────────────── */

export const MOOD_RISE = 0.42;
export const MOOD_FALL = 0.055;
/** Contentment 0..1. It rises while the coat is stroked (touch 0..1) and ebbs slowly after. */
export function moodStep(mood: number, touch: number, dt: number): number {
  const t = clamp01(touch), step = Math.max(0, Math.min(0.1, dt));
  return clamp01(mood + (t > 0 ? MOOD_RISE * t : -MOOD_FALL) * step);
}
/** A kindness (a pat, a tuft of grass, a tickle) lifts the mood at once. */
export function moodLift(mood: number, by: number): number {
  return clamp01(mood + Math.max(0, by));
}
/** How far the eyelid is down (0 wide open .. 1 shut): a heavy, gentle lid at
 * rest, closing as the mammoth settles; a blink or a squeeze shuts it at once. */
export function lidFor(mood: number, blink: number, squeeze: number): number {
  return Math.max(clamp01(blink), clamp01(squeeze), 0.2 + 0.8 * smooth(0.3, 0.82, mood));
}
/** The lean into a stroke: toward the hand, at most `reach` world units, and only as far as the mood allows. */
export function leanFor(mood: number, dx: number, dy: number, reach = 8): Vec {
  const m = Math.hypot(dx, dy);
  if (!(m > 0)) return [0, 0];
  const k = reach * (0.35 + 0.65 * clamp01(mood)) * clamp01(m / 60);
  return [(dx / m) * k, (dy / m) * k * 0.5];
}
/** How loud the rumble is for a mood (0..1): silent until the mammoth begins to settle. */
export function rumbleFor(mood: number, touching: boolean): number {
  return smooth(0.12, 0.7, mood) * (touching ? 1 : 0.45);
}

/* ── snow on its back ─────────────────────────────────────────────────── */

export interface SnowClump { spot: number; size: number; amount: number; tilt: number }
export const SNOW_GONE = 0.06;
/** One clump for each authored spot. `cover` (0..1) is how snowy the day begins. */
export function seedSnow(spots: number, cover: number, random: () => number): SnowClump[] {
  const c = clamp01(cover);
  return Array.from({ length: Math.max(0, Math.floor(spots)) }, (_, spot) => ({
    spot, size: 0.75 + random() * 0.5, tilt: (random() - 0.5) * 0.5,
    // A few spots start bare, so the back never looks iced like a cake.
    amount: random() < 0.18 * (1.2 - c) ? 0 : clamp01(c * (0.55 + random() * 0.45)),
  }));
}
/** A stroke of weight 0..1 over a clump: what is left, and how much came off. */
export function brushSnow(amount: number, weight: number): { amount: number; shed: number } {
  const a = clamp01(amount), left = a * (1 - 0.85 * clamp01(weight));
  const next = left < SNOW_GONE ? 0 : left;
  return { amount: next, shed: a - next };
}
export function snowLeft(clumps: readonly SnowClump[]): number {
  return clumps.reduce((sum, c) => sum + c.amount, 0);
}

/* ── the hint hand ────────────────────────────────────────────────────── */

export const GHOST = { first: 1.6, again: 6, seconds: 2.6 } as const;
/** The authored demonstration, t 0..1: the hand fades in above the hump,
 * presses, strokes along the back (u 0..1), lifts and fades. */
export function ghostAt(t: number): { u: number; press: number; alpha: number } {
  const x = clamp01(t);
  const alpha = Math.min(smooth(0, 0.12, x), 1 - smooth(0.86, 1, x));
  const press = Math.min(smooth(0.1, 0.2, x), 1 - smooth(0.78, 0.88, x));
  return { u: smooth(0.16, 0.8, x), press, alpha };
}
/** The first lesson, t 0..1: the hand comes to the glass and taps it twice. `tap` is true on the frames a tap lands. */
export function ghostKnockAt(t: number): { press: number; alpha: number; tap: 0 | 1 | 2 } {
  const x = clamp01(t);
  const alpha = Math.min(smooth(0, 0.12, x), 1 - smooth(0.84, 1, x));
  const pulse = (at: number) => Math.max(0, 1 - Math.abs(x - at) / 0.09);
  return { press: Math.max(pulse(0.3), pulse(0.58)), alpha, tap: x >= 0.58 ? 2 : x >= 0.3 ? 1 : 0 };
}
/* ── meeting at the glass ─────────────────────────────────────────────── */

/** What a hand on the glass is worth: two touches, or a second of stroking the glass, and the trunk comes to meet it. */
export const MEET = { tap: 0.5, perSecond: 1.1 } as const;
export function meetStep(trust: number, tap: boolean, strokeSeconds: number): number {
  return clamp01(trust + (tap ? MEET.tap : 0) + MEET.perSecond * Math.max(0, Math.min(0.1, strokeSeconds)));
}
/* ── a tuft of grass ──────────────────────────────────────────────────── */

export const FEED = { fly: 0.55, curl: 0.8, chew: 1.7, rest: 0.6 } as const;
export const FEED_SECONDS = FEED.fly + FEED.curl + FEED.chew + FEED.rest;
export type FeedPhase = 'fly' | 'curl' | 'chew' | 'rest';
/** Where an offered tuft is in its little story at t seconds: it flies to the
 * trunk tip, the trunk curls it to the mouth, the mammoth chews, the trunk rests. */
export function feedAt(t: number): { phase: FeedPhase; k: number } | null {
  if (!(t >= 0) || t >= FEED_SECONDS) return null;
  if (t < FEED.fly) return { phase: 'fly', k: t / FEED.fly };
  if (t < FEED.fly + FEED.curl) return { phase: 'curl', k: (t - FEED.fly) / FEED.curl };
  if (t < FEED.fly + FEED.curl + FEED.chew) return { phase: 'chew', k: (t - FEED.fly - FEED.curl) / FEED.chew };
  return { phase: 'rest', k: (t - FEED.fly - FEED.curl - FEED.chew) / FEED.rest };
}
/** How far the trunk is curled to the mouth (0..1) and the jaw open (0..1) at t seconds of a feed. */
export function feedPose(t: number): { curl: number; jaw: number; reach: number } {
  const at = feedAt(t);
  if (!at) return { curl: 0, jaw: 0, reach: 0 };
  if (at.phase === 'fly') return { curl: 0, jaw: 0, reach: smooth(0, 1, at.k) };
  if (at.phase === 'curl') return { curl: smooth(0, 0.85, at.k), jaw: smooth(0.5, 1, at.k) * 0.8, reach: 1 - smooth(0, 0.4, at.k) };
  if (at.phase === 'chew') return { curl: 1 - smooth(0.05, 0.5, at.k), jaw: 0.5 * Math.abs(Math.sin(at.k * Math.PI * 5)) * (1 - smooth(0.8, 1, at.k)), reach: 0 };
  return { curl: 0, jaw: 0, reach: 0 };
}
/** A thrown thing's path: from a to b in a soft arc `height` high. */
export function arcPoint(a: Vec, b: Vec, t: number, height: number): Vec {
  const k = clamp01(t);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k - height * 4 * k * (1 - k)];
}
/* ── gestures ─────────────────────────────────────────────────────────── */

export interface PoseDelta { nod: number; ear: number; rise: number; swing: number; curl: number; tail: number; brow: number; squeeze: number; step: number }
const NO_DELTA: PoseDelta = { nod: 0, ear: 0, rise: 0, swing: 0, curl: 0, tail: 0, brow: 0, squeeze: 0, step: 0 };
export type GestureId = 'ears' | 'tusks' | 'hump' | 'tickle' | 'trunkBoop' | 'tuskKnock' | 'tailSwish';
export const GESTURE_SECONDS: Readonly<Record<GestureId, number>> = {
  ears: 1.2, tusks: 1.5, hump: 1.4, tickle: 1.1, trunkBoop: 0.7, tuskKnock: 0.45, tailSwish: 0.9,
};
/** The small authored movement that goes with a discovery or a toy, at t
 * seconds: each shows the thing the words are about. All zero when it is over. */
export function gestureAt(id: GestureId, t: number): PoseDelta {
  const total = GESTURE_SECONDS[id];
  if (!(t >= 0) || t >= total) return NO_DELTA;
  const k = t / total, bell = Math.sin(Math.PI * k), wave = (n: number) => Math.sin(Math.PI * 2 * n * k) * (1 - k);
  switch (id) {
    // The small ear flaps twice.
    case 'ears': return { ...NO_DELTA, ear: -0.42 * Math.abs(Math.sin(Math.PI * 2 * k)) * (1 - 0.3 * k), brow: 0.4 * bell };
    // The head dips and sweeps, the way tusks cleared snow off the grass.
    case 'tusks': return { ...NO_DELTA, nod: -0.075 * Math.sin(Math.PI * 2 * 1.5 * k) * bell - 0.03 * bell, swing: 0.1 * bell };
    // It stands tall, so the hump shows.
    case 'hump': return { ...NO_DELTA, rise: 7 * overshoot(Math.min(1, k * 2.2)) * (1 - smooth(0.6, 1, k)), nod: 0.03 * bell };
    // Tickled behind the ear: the ear flutters, the eye squeezes shut, the head wags.
    case 'tickle': return { ...NO_DELTA, ear: -0.5 * Math.abs(Math.sin(Math.PI * 5 * k)) * (1 - k), squeeze: bell > 0.25 ? 1 : 0, brow: 1 - k, nod: 0.03 * wave(3), tail: 0.2 * wave(2) };
    case 'trunkBoop': return { ...NO_DELTA, curl: 0.22 * bell, swing: -0.25 * wave(1.5), brow: 0.8 * (1 - k) };
    case 'tuskKnock': return { ...NO_DELTA, nod: 0.034 * wave(2) };
    case 'tailSwish': return { ...NO_DELTA, tail: 0.5 * wave(2.5) };
  }
}

/* ── the finale ───────────────────────────────────────────────────────── */

export const FINALE = { rise: 0.9, hold: 1.7, fall: 1.2 } as const;
export const FINALE_SECONDS = FINALE.rise + FINALE.hold + FINALE.fall;
/** How high the trunk is lifted (0..1) at t seconds of the finale. Reduced motion: a cut up, a cut down. */
export function finaleLift(t: number, reduced: boolean): number {
  if (!(t >= 0) || t >= FINALE_SECONDS) return 0;
  if (reduced) return t < FINALE.rise + FINALE.hold ? 1 : 0;
  if (t < FINALE.rise) return Math.max(0, overshoot(t / FINALE.rise));
  if (t < FINALE.rise + FINALE.hold) return 1;
  return 1 - smooth(0, 1, (t - FINALE.rise - FINALE.hold) / FINALE.fall);
}
