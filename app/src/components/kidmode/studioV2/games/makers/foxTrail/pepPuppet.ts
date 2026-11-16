/** How Pep moves: the kit's standing side view worked like a cut-out puppet.
 * Legs swing from the shoulder and hip in step with the distance run (so paws
 * never slide), the body bobs and rocks, a jump stretches, a landing squashes,
 * and a roll tucks the legs in and spins the whole dog. Pure: the component
 * feeds it the simulation and writes the result to the parts. */
export const STRIDE = 50;
export interface PuppetInput {
  /** Leg phase in radians (= distance / STRIDE · 2π). */
  phase: number;
  /** |vx| / RUN_MAX. */
  speed: number;
  /** Signed acceleration along the facing direction (units/s²). */
  accel: number;
  air: boolean; vy: number;
  /** 0..1 tucked for a roll, and the roll's turn so far (radians). */
  tuck: number; spin: number;
  /** 1 on landing, easing to 0; 1 on take-off, easing to 0. */
  squash: number; stretch: number;
  /** Settled on his haunches after standing a while (0..1). */
  sit: number;
  /** A happy shake (0..1, runs out): after the pool. */
  shake: number;
  t: number;
  reduced: boolean;
}
export interface PuppetPose {
  /** Leg swings (radians; + = forward). */
  fore: number; foreFar: number; hind: number; hindFar: number;
  /** Body: lift (units, up is +), pitch (radians, + = nose down), scale. */
  lift: number; pitch: number; sx: number; sy: number;
  spin: number;
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (lo: number, hi: number, v: number) => { const t = clamp((v - lo) / (hi - lo), 0, 1); return t * t * (3 - 2 * t); };

export function pepPose(g: PuppetInput): PuppetPose {
  const s = Math.min(1.2, g.speed), p = g.phase;
  const moving = smooth(0.02, 0.14, s);
  const gallop = smooth(0.7, 0.96, s);
  const amp = (0.28 + 0.46 * s) * moving;
  // A trot swings diagonal pairs; at full speed the pairs close up into a bounding gallop.
  let fore = amp * Math.sin(p);
  let foreFar = amp * Math.sin(p + mix(Math.PI, 0.55, gallop));
  let hind = amp * Math.sin(p + mix(Math.PI, Math.PI - 0.5, gallop));
  let hindFar = amp * Math.sin(p + mix(0, Math.PI + 0.25, gallop));
  // Two footfalls a cycle bounce a trotting terrier; a gallop rocks him end to end.
  let lift = moving * (Math.abs(Math.sin(p)) * 3.4 * (1 - gallop) + (0.5 - 0.5 * Math.cos(p + 0.6)) * 6.5 * gallop);
  let pitch = clamp(g.accel * 0.00009, -0.14, 0.16) + moving * (0.03 * s + gallop * 0.085 * Math.sin(p + 2.1));
  let sx = 1, sy = 1;
  if (!g.reduced && moving < 0.5) { const breath = Math.sin(g.t * 2.2) * 0.012 * (1 - moving); sy += breath; sx -= breath * 0.6; }
  if (g.air) {
    // Up: forelegs reach, hind legs trail. Down: forelegs reach for the ground.
    const rising = smooth(-220, 260, g.vy);
    fore = mix(0.55, 0.85, rising); foreFar = mix(0.4, 0.7, rising);
    hind = mix(0.1, -0.75, rising); hindFar = mix(0.25, -0.6, rising);
    pitch = mix(0.2, -0.24, rising); lift = 0;
  }
  if (g.stretch > 0) { sy += 0.1 * g.stretch; sx -= 0.07 * g.stretch; }
  if (g.squash > 0) { sy -= 0.16 * g.squash; sx += 0.12 * g.squash; }
  if (g.shake > 0 && !g.reduced) { pitch += Math.sin(g.t * 46) * 0.07 * g.shake; sx += Math.sin(g.t * 46 + 1.5) * 0.035 * g.shake; }
  if (g.sit > 0) {
    // Settling: the hind legs fold under, the rump comes down, the chest stays up.
    const k = g.sit * g.sit * (3 - 2 * g.sit);
    hind = mix(hind, 0.95, k); hindFar = mix(hindFar, 0.8, k);
    fore = mix(fore, -0.1, k); foreFar = mix(foreFar, -0.04, k);
    pitch = mix(pitch, -0.2, k); lift = mix(lift, -4.5, k);
  }
  if (g.tuck > 0) {
    // Tucked: legs folded up under the belly, the whole dog a little rounder.
    const k = g.tuck;
    fore = mix(fore, -1.5, k); foreFar = mix(foreFar, -1.38, k);
    hind = mix(hind, 1.45, k); hindFar = mix(hindFar, 1.3, k);
    pitch = mix(pitch, 0, k); lift = mix(lift, 4, k);
    sx = mix(sx, 0.84, k); sy = mix(sy, 0.9, k);
  }
  return { fore, foreFar, hind, hindFar, lift, pitch, sx, sy, spin: g.spin };
}

export interface PuppetParts { sq?: HTMLElement | null; spin?: HTMLElement | null; fore?: HTMLElement | null; foreFar?: HTMLElement | null; hind?: HTMLElement | null; hindFar?: HTMLElement | null }
const deg = (r: number) => (r * 180 / Math.PI).toFixed(1);
/** Writes a pose to the parts (transforms only; no React render per frame). */
export function applyPepPose(parts: PuppetParts, pose: PuppetPose) {
  // Squash and stretch push off the paws; the roll and the pitch turn about his middle.
  if (parts.sq) parts.sq.style.transform = `translate3d(0,${(-pose.lift).toFixed(1)}px,0) scale(${pose.sx.toFixed(3)},${pose.sy.toFixed(3)})`;
  if (parts.spin) parts.spin.style.transform = `rotate(${deg(-pose.spin - pose.pitch)}deg)`;
  // The picture faces left, so "forward" is a clockwise turn of a hanging leg.
  if (parts.fore) parts.fore.style.transform = `rotate(${deg(pose.fore)}deg)`;
  if (parts.foreFar) parts.foreFar.style.transform = `translate3d(-3.2px,-1px,0) rotate(${deg(pose.foreFar)}deg)`;
  if (parts.hind) parts.hind.style.transform = `rotate(${deg(pose.hind)}deg)`;
  if (parts.hindFar) parts.hindFar.style.transform = `translate3d(-4.4px,-1px,0) rotate(${deg(pose.hindFar)}deg)`;
}
