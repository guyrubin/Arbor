/** Stitch Garden: how the needle moves. Pure: a plan and a time in, a pose
 * and a stitch count out, so the one frame loop in the game only reads the
 * clock. The needle is held like a hand holds it (one steady angle, a small
 * rock of the wrist); every few stitches it dips through the cloth, then
 * draws back and pulls the thread taut. When a flower is done it ties off
 * with one long pull, lets go of the thread and glides back to where it
 * rests. Coordinates are the hoop drawing's own (ART_W × ART_H). */
import { STITCH_MS, UNPICK_MS, type Stitch } from './stitchGardenStitches';

export interface NeedlePose {
  /** Where the point meets the cloth (or aims at it, when lifted). */
  x: number; y: number;
  /** The way the point faces, in degrees. */
  angle: number;
  /** −1 pushed through the cloth, 0 lying on it, 1 drawn back and up. */
  z: number;
  /** The stitch its working thread comes out of; null when it carries a loose end. */
  anchor: { x: number; y: number } | null;
  /** 0 the thread is taut, 1 it hangs loose. */
  slack: number;
}
export type NeedleMode = 'stitch' | 'unpick' | 'flick';
export type NeedlePhase = 'arrive' | 'atWork' | 'tie' | 'home' | 'done';
export interface NeedlePlan {
  mode: NeedleMode;
  stitches: readonly Stitch[];
  /** Where the needle is when the plan starts. */
  from: NeedlePose;
  /** Stitches already on the cloth when it starts (an unpick counts down from here). */
  startCount: number;
}
export interface NeedleFrame { pose: NeedlePose; count: number; beat: number; phase: NeedlePhase }

/** Stuck in the pincushion at the table's near corner, its loose thread hanging from the eye. */
export const PARKED_NEEDLE: NeedlePose = { x: 397, y: 407, angle: 128, z: -0.6, anchor: null, slack: 1 };
/** The angle a hand holds it at: the point down and to the left. */
export const HAND_ANGLE = 122;
/** One dip of the needle for every so many stitches laid. */
export const BEAT_STITCHES = 6;
export const ARRIVE_MS = 240, TIE_MS = 380, HOME_MS = 460, FLICK_MS = 620;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (u: number) => { const t = clamp01(u); return t * t * (3 - 2 * t); };
const easeOut = (u: number) => 1 - Math.pow(1 - clamp01(u), 3);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** The short way round from one angle to another. */
const turn = (a: number, b: number, u: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * u;
const endOf = (s: Stitch) => (s.knot ? { x: s.x1, y: s.y1 } : { x: s.x2, y: s.y2 });

export function workMs(plan: NeedlePlan): number {
  if (plan.mode === 'flick' || plan.stitches.length === 0) return 0;
  return plan.mode === 'stitch' ? STITCH_MS : UNPICK_MS * clamp01(plan.startCount / plan.stitches.length);
}
/** How long the whole plan takes, from leaving its rest to lying there again. */
export function planMs(plan: NeedlePlan): number {
  if (plan.mode === 'flick') return FLICK_MS;
  return ARRIVE_MS + workMs(plan) + (plan.mode === 'stitch' ? TIE_MS : 0) + HOME_MS;
}
/** When the flower is whole (or wholly out): the needle still has its tie-off and its way home to go. */
export function landsAt(plan: NeedlePlan): number {
  return plan.mode === 'flick' ? 0 : ARRIVE_MS + workMs(plan);
}

function between(a: NeedlePose, b: NeedlePose, u: number, hop: number): NeedlePose {
  const e = smooth(u);
  return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), angle: turn(a.angle, b.angle, e), z: lerp(a.z, b.z, e) + Math.sin(Math.PI * clamp01(u)) * hop, anchor: null, slack: lerp(a.slack, b.slack, e) };
}

/** The needle at `t` ms into the plan. */
export function needleAt(plan: NeedlePlan, t: number): NeedleFrame {
  const time = Math.max(0, Number.isFinite(t) ? t : 0);
  const total = plan.stitches.length;
  if (plan.mode === 'flick') {
    // A tapped needle hops out of its cushion, turns once in the air and lands where it was.
    if (time >= FLICK_MS) return { pose: PARKED_NEEDLE, count: plan.startCount, beat: 0, phase: 'done' };
    const u = time / FLICK_MS;
    return { pose: { ...PARKED_NEEDLE, y: PARKED_NEEDLE.y - Math.sin(Math.PI * u) * 26, angle: PARKED_NEEDLE.angle + 360 * smooth(u), z: PARKED_NEEDLE.z + Math.sin(Math.PI * u) * 1.5, slack: 1 - Math.sin(Math.PI * u) * 0.5 }, count: plan.startCount, beat: 0, phase: 'home' };
  }
  if (total === 0) return { pose: PARKED_NEEDLE, count: 0, beat: 0, phase: 'done' };
  const work = workMs(plan), stitching = plan.mode === 'stitch';
  const per = stitching ? STITCH_MS / total : UNPICK_MS / total;
  const startCount = stitching ? 0 : Math.max(0, Math.min(total, plan.startCount));
  const first = stitching ? { x: plan.stitches[0].x1, y: plan.stitches[0].y1 } : endOf(plan.stitches[Math.max(0, startCount - 1)]);
  const hover: NeedlePose = { x: first.x, y: first.y, angle: stitching ? HAND_ANGLE : HAND_ANGLE - 22, z: 1, anchor: null, slack: 0.6 };

  if (time < ARRIVE_MS) return { pose: between(plan.from, hover, time / ARRIVE_MS, 0.5), count: startCount, beat: -1, phase: 'arrive' };

  const tw = time - ARRIVE_MS;
  const last = endOf(plan.stitches[total - 1]);
  if (tw < work) {
    const done = Math.min(stitching ? total : startCount, Math.floor(tw / per) + 1);
    if (stitching) {
      const index = done - 1, frac = (tw / per) % 1;
      const prev = index === 0 ? first : endOf(plan.stitches[index - 1]), here = endOf(plan.stitches[index]);
      const e = smooth(frac), turns = tw / per / BEAT_STITCHES, phase = turns % 1;
      const z = Math.cos(2 * Math.PI * phase);
      const lean = Math.max(-9, Math.min(9, (here.x - prev.x) * 0.9));
      return {
        pose: { x: lerp(prev.x, here.x, e), y: lerp(prev.y, here.y, e), angle: HAND_ANGLE + 8 * Math.sin(2 * Math.PI * phase) + lean, z: z > 0 ? z * 0.85 : z, anchor: prev, slack: 1 - clamp01(z) },
        count: done, beat: Math.floor(turns + 0.5), phase: 'atWork',
      };
    }
    // Unpicking: the needle is held high and tugs; the stitches come out last first.
    const count = startCount - done, held = endOf(plan.stitches[Math.max(0, count)]);
    const tug = Math.sin(tw / 46);
    return { pose: { x: held.x + 5, y: held.y - 6, angle: HAND_ANGLE - 22 + tug * 5, z: 0.75 + tug * 0.2, anchor: held, slack: 0.12 + (tug + 1) * 0.06 }, count, beat: Math.floor(tw / 120), phase: 'atWork' };
  }

  const tied: NeedlePose = { x: last.x + 9, y: last.y - 13, angle: HAND_ANGLE - 14, z: 1.25, anchor: null, slack: 0.5 };
  const lifted: NeedlePose = stitching ? tied : { x: first.x + 5, y: first.y - 6, angle: HAND_ANGLE - 22, z: 0.8, anchor: null, slack: 0.6 };
  const endCount = stitching ? total : 0;
  if (stitching && tw < work + TIE_MS) {
    // One long pull: the thread goes taut from the last stitch, then is let go.
    const u = (tw - work) / TIE_MS, e = easeOut(u / 0.7);
    const cut = u > 0.72;
    return { pose: { x: lerp(last.x, tied.x, e), y: lerp(last.y, tied.y, e), angle: turn(HAND_ANGLE, tied.angle, e), z: lerp(0.2, tied.z, e), anchor: cut ? null : last, slack: cut ? 0.5 : 0.25 * (1 - e) }, count: endCount, beat: -1, phase: 'tie' };
  }
  const th = tw - work - (stitching ? TIE_MS : 0);
  if (th < HOME_MS) return { pose: between(lifted, PARKED_NEEDLE, th / HOME_MS, 0.35), count: endCount, beat: -1, phase: 'home' };
  return { pose: PARKED_NEEDLE, count: endCount, beat: -1, phase: 'done' };
}

/** A point on the hoop's wooden ring, by angle (0° at three o'clock, clockwise as drawn). */
export const ringAngle = (dx: number, dy: number) => Math.atan2(dy, dx) * 180 / Math.PI;
/** The nearest way round the ring from one angle to another, as the new (unwrapped) angle. */
export const walkTo = (from: number, to: number) => from + ((((to - from) % 360) + 540) % 360 - 180);
