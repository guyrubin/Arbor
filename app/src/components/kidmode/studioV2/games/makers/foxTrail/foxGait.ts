import { FOX_REST, type FoxPose, type LegPose } from './foxArt';

/** How the fox moves its body: a trot that opens into a bounding gallop at
 * full speed, legs phased by distance travelled (so feet never slide), a
 * tucked forward roll, hop poses, a sit, idle breathing and ear flicks.
 * Pure: the component feeds it the simulation and its own little springs. */
export const STRIDE = 74;
export interface GaitInput {
  /** Leg phase in radians (= distance / STRIDE · 2π). */
  phase: number;
  /** |vx| / RUN_MAX. */
  speed: number;
  /** Signed acceleration along the facing direction (units/s²). */
  accel: number;
  air: boolean; vy: number;
  tuck: number; spin: number;
  sit: number;
  t: number;
  earFlick: number; earSide: 0 | 1;
  blink: number;
  squash: number;
  tailBase: number; tailTip: number;
  reduced: boolean;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixLeg = (a: LegPose, b: LegPose, t: number): LegPose => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const smooth = (lo: number, hi: number, v: number) => { const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo))); return t * t * (3 - 2 * t); };

function frontLeg(p: number, amp: number, flex: number): LegPose {
  // cos(p) swings the leg; while it swings forward (sin > 0) the wrist folds the paw up.
  return [-amp * Math.cos(p), flex * Math.max(0, Math.sin(p)) ** 1.4];
}
function rearLeg(p: number, amp: number, flex: number): LegPose {
  const up = Math.max(0, Math.sin(p));
  return [-0.18 - amp * 0.95 * Math.cos(p) - 0.25 * up * flex, 0.34 + 0.55 * up * flex - 0.25 * Math.max(0, -Math.cos(p)) * amp];
}

export function foxGait(g: GaitInput): FoxPose {
  const s = Math.min(1.2, g.speed);
  const moving = smooth(0.02, 0.16, s);
  const gallop = smooth(0.72, 0.98, s);
  const amp = 0.22 + 0.42 * s + 0.2 * gallop;
  const flex = 0.4 + 1.1 * s;
  // Trot: diagonal pairs. Gallop: hind pair then fore pair, a little staggered.
  const off = {
    fn: mix(0, Math.PI, gallop), ff: mix(Math.PI, Math.PI * 1.22, gallop),
    rn: mix(Math.PI, 0, gallop), rf: mix(0, Math.PI * 0.2, gallop),
  };
  const p = g.phase;
  let frontNear = mixLeg(FOX_REST.frontNear, frontLeg(p + off.fn, amp, flex), moving);
  let frontFar = mixLeg(FOX_REST.frontFar, frontLeg(p + off.ff, amp, flex), moving);
  let rearNear = mixLeg(FOX_REST.rearNear, rearLeg(p + off.rn, amp, flex), moving);
  let rearFar = mixLeg(FOX_REST.rearFar, rearLeg(p + off.rf, amp, flex), moving);
  // Two footfalls a cycle lift the body; a gallop rocks the spine instead.
  let bob = -Math.abs(Math.sin(p)) * 3.2 * moving * (1 - gallop) - (Math.sin(p * 1) * 0.5 + 0.5) * 4 * gallop;
  let lean = Math.max(-0.16, Math.min(0.2, g.accel * 0.00011)) + 0.05 * s + gallop * 0.09 * Math.sin(p + 0.6);
  let head = -0.04 * s + 0.03 * Math.sin(g.t * 1.1) * (1 - moving);

  // In the air: forelegs reach, hind legs stretch back; coming down, the forelegs reach for the ground.
  if (g.air) {
    const rising = smooth(-200, 260, g.vy);
    frontNear = mixLeg([-0.35, 0.15], [-0.95, 0.55], rising);
    frontFar = mixLeg([-0.2, 0.1], [-0.8, 0.7], rising);
    rearNear = mixLeg([0.15, 0.3], [0.85, -0.1], rising);
    rearFar = mixLeg([0.25, 0.2], [0.95, -0.15], rising);
    lean = mix(0.16, -0.18, rising);
    bob = 0;
  }
  // Sit: hind legs fold under, forelegs stay straight, the head comes up.
  if (g.sit > 0) {
    const k = g.sit;
    rearNear = mixLeg(rearNear, [-1.45, 2.35], k);
    rearFar = mixLeg(rearFar, [-1.35, 2.25], k);
    frontNear = mixLeg(frontNear, [0.04, 0], k);
    frontFar = mixLeg(frontFar, [-0.06, 0.02], k);
    lean = mix(lean, 0, k);
    head = mix(head, 0.05 + 0.04 * Math.sin(g.t * 0.7), k);
  }
  // Roll: everything folds in towards the middle.
  if (g.tuck > 0) {
    const k = g.tuck;
    rearNear = mixLeg(rearNear, [-1.15, 1.9], k);
    rearFar = mixLeg(rearFar, [-1.05, 1.8], k);
    frontNear = mixLeg(frontNear, [1.05, 1.6], k);
    frontFar = mixLeg(frontFar, [0.95, 1.5], k);
    head = mix(head, 0.75, k);
    lean = mix(lean, 0, k);
    bob = mix(bob, 0, k);
  }
  // Ears: back when running fast, a flick now and then when idle.
  const flick = g.earFlick * (1 - moving);
  const earBack = -0.32 * s - 0.25 * g.tuck;
  return {
    bob, lean, sit: g.sit,
    rearNear, rearFar, frontNear, frontFar,
    head,
    earNear: earBack + (g.earSide === 0 ? -0.5 * flick : 0.06 * Math.sin(g.t * 2)),
    earFar: earBack + (g.earSide === 1 ? -0.55 * flick : 0.05 * Math.sin(g.t * 1.7 + 1)),
    tailBase: g.tailBase, tailTip: g.tailTip,
    spin: g.spin, tuck: g.tuck,
    squash: g.squash,
    breathe: g.reduced ? 0 : Math.sin(g.t * 2.3) * (1 - moving),
    blink: g.blink,
  };
}

/** Where the tail wants to be; the component springs it there (the lag is the point). */
export function tailTarget(g: { speed: number; air: boolean; vy: number; sit: number; tuck: number; t: number; reduced: boolean }): [number, number] {
  const s = Math.min(1, g.speed);
  let base = mix(-0.5, 0.02, s) + (g.reduced ? 0 : 0.06 * Math.sin(g.t * 1.6) * (1 - s));
  let tip = mix(-0.25, 0.12, s) + (g.reduced ? 0 : 0.12 * Math.sin(g.t * 1.6 - 0.8) * (1 - s));
  if (g.air) { base += Math.max(-0.3, Math.min(0.35, g.vy * 0.0007)); tip += 0.2; }
  if (g.sit > 0) { base = mix(base, -1.25, g.sit); tip = mix(tip, -1.1, g.sit); }
  if (g.tuck > 0) { base = mix(base, -2.0, g.tuck); tip = mix(tip, -1.5, g.tuck); }
  return [base, tip];
}
