/** How Things Move rules. Pure: no React, no timers, no randomness, no DOM.
 *
 * One idea, shown twice: a slider-crank. A crank of radius `r` turns about a
 * fixed shaft; a rigid rod of length `l` joins the crank pin to a wrist pin
 * that can only slide along one straight vertical line. One angle, `theta`,
 * places every part, so nothing can ever come apart or stretch.
 *
 * Coordinates are the drawing's own: x to the right, y DOWN (SVG), measured
 * from the shaft. `theta` is 0 with the crank pin straight up (top dead
 * centre) and grows clockwise on screen.
 *   crank pin   (r·sinθ, −r·cosθ)
 *   wrist pin   (0, −lift)  with  lift = r·cosθ + √(l² − r²·sin²θ)
 * so |pin − wrist|² = r²sin²θ + (lift − r·cosθ)² = l² for every θ.
 *
 * Deliberate simplifications (true to the moving parts, not to a real engine):
 * - No combustion, valves, steam or fuel: this is a moving-parts model, not a
 *   working engine. The wheel is turned by a hand or by an unseen motor.
 * - No friction in the linkage and ideal rigid parts (the rod never bends or
 *   stretches; pins have no play).
 * - The engine is drawn single-cylinder and upright, with the cylinder axis
 *   passing through the shaft (an in-line slider-crank).
 * - A wheel let go of by the hand coasts to a gentle stop: an easing for the
 *   child's hand, not a model of bearing friction.
 * - The toy's bird rides straight up and down on its stick (the slider); it
 *   meets the bell exactly at the top of the stroke.
 */

export const TAU = Math.PI * 2;

export interface Linkage { readonly r: number; readonly l: number }
/** The drawing's linkage, in drawing units: the rod is three cranks long. */
export const LINKAGE: Linkage = { r: 34, l: 102 };
/** Top and bottom dead centre: the crank pin straight up, then straight down. */
export const TOP_DEAD_CENTRE = 0;
export const BOTTOM_DEAD_CENTRE = Math.PI;

export interface Point { readonly x: number; readonly y: number }

/** The crank pin, relative to the shaft (y down). */
export function crankPin(theta: number, { r }: Linkage = LINKAGE): Point {
  return { x: r * Math.sin(theta), y: -r * Math.cos(theta) };
}
/** How far above the shaft the wrist pin (the piston, the bird's stick) is. */
export function pistonLift(theta: number, { r, l }: Linkage = LINKAGE): number {
  const s = r * Math.sin(theta);
  return r * Math.cos(theta) + Math.sqrt(l * l - s * s);
}
/** The wrist pin, relative to the shaft (y down): always on the vertical axis. */
export function wristPin(theta: number, link: Linkage = LINKAGE): Point {
  return { x: 0, y: -pistonLift(theta, link) };
}
/** Distance from crank pin to wrist pin: the rod. Equals `l` at every angle. */
export function rodLength(theta: number, link: Linkage = LINKAGE): number {
  const pin = crankPin(theta, link), wrist = wristPin(theta, link);
  return Math.hypot(wrist.x - pin.x, wrist.y - pin.y);
}
/** The rod's lean from upright, in degrees, clockwise on screen. A rod drawn
 * upward from the crank pin and turned by this angle ends on the wrist pin. */
export function rodLean(theta: number, link: Linkage = LINKAGE): number {
  const pin = crankPin(theta, link), wrist = wristPin(theta, link);
  return Math.atan2(wrist.x - pin.x, -(wrist.y - pin.y)) * 180 / Math.PI;
}
/** The full travel of the piston: twice the crank. */
export const strokeOf = ({ r }: Linkage = LINKAGE) => 2 * r;
/** Where the piston is in its stroke: 0 at the bottom, 1 at the top. */
export function strokeFraction(theta: number, link: Linkage = LINKAGE): number {
  return (pistonLift(theta, link) - (link.l - link.r)) / strokeOf(link);
}
export type StrokePlace = 'top' | 'down' | 'bottom' | 'up';
/** Words for where the piston is, for the screen reader. */
export function strokePlace(theta: number): StrokePlace {
  const a = wrapAngle(theta);
  if (a < TAU / 24 || a > TAU - TAU / 24) return 'top';
  if (Math.abs(a - Math.PI) < TAU / 24) return 'bottom';
  return a < Math.PI ? 'down' : 'up';
}

/** Any angle into [0, 2π). */
export function wrapAngle(a: number): number {
  const w = a % TAU;
  return w < 0 ? w + TAU : w;
}
/** The shortest signed turn from `from` to `to`, in (−π, π]. */
export function angleDelta(from: number, to: number): number {
  let d = wrapAngle(to - from);
  if (d > Math.PI) d -= TAU;
  return d;
}
/** The angle of a finger about the shaft, from its offset (y down): 0 straight
 * up, growing clockwise, the same measure as `theta`. */
export function pointerAngle(dx: number, dy: number): number {
  return wrapAngle(Math.atan2(dx, -dy));
}
/** How many times the crank passed top dead centre going from one unwrapped
 * angle to another, either way round. Each pass is one tick (and one peck). */
export function topCentresCrossed(from: number, to: number): number {
  return Math.abs(Math.floor(to / TAU) - Math.floor(from / TAU));
}

/* ---------------------------------------------------------------- motion */
export type Speed = 'slow' | 'steady' | 'quick';
export const SPEEDS: readonly Speed[] = ['slow', 'steady', 'quick'];
/** Motor speeds in radians per second (0.3, 0.6 and 1.1 turns a second). */
export const SPEED_OMEGA: Readonly<Record<Speed, number>> = { slow: TAU * 0.3, steady: TAU * 0.6, quick: TAU * 1.1 };
/** The fastest a hand may fling the wheel, and the push the Turn button gives. */
export const MAX_HAND_OMEGA = TAU * 1.6;
export const PUSH_OMEGA = TAU * 0.55;
/** With motion reduced, a push is a quarter turn at the slow speed, no fling. */
export const CALM_PUSH = TAU / 4;
/** One arrow key press: a twenty-fourth of a turn. */
export const KEY_STEP = TAU / 24;
/** Coasting: the spin halves about every 0.7 s and stops below this. */
export const COAST_TAU = 1;
export const COAST_STOP = 0.12;
/** The motor eases to a new speed over about a fifth of a second. */
export const MOTOR_EASE = 0.18;

/** Advance an angle at a speed. Changing speed never moves the angle. */
export function advance(theta: number, omega: number, dt: number): number {
  return theta + omega * dt;
}
/** Ease the motor's present speed toward the lever's speed (θ untouched). */
export function easeMotor(current: number, target: number, dt: number): number {
  if (dt <= 0) return current;
  const next = current + (target - current) * (1 - Math.exp(-dt / MOTOR_EASE));
  return Math.abs(next - target) < 1e-3 ? target : next;
}
/** A let-go wheel slows smoothly and stops. */
export function coast(omega: number, dt: number): number {
  const next = omega * Math.exp(-Math.max(0, dt) / COAST_TAU);
  return Math.abs(next) < COAST_STOP ? 0 : next;
}
export const clampOmega = (omega: number) => Math.max(-MAX_HAND_OMEGA, Math.min(MAX_HAND_OMEGA, omega));
/** The Turn button: a push clockwise, added to any spin already going that way. */
export function push(omega: number): number {
  return clampOmega(Math.max(0, omega) + PUSH_OMEGA);
}
export interface TurnSample { readonly t: number; readonly theta: number }
/** The spin a finger leaves the wheel with: its average speed over the last
 * tenth of a second (milliseconds in, radians per second out), capped. A
 * finger that stopped before letting go leaves the wheel still. */
export function releaseSpeed(samples: readonly TurnSample[], now: number, windowMs = 100): number {
  const recent = samples.filter(s => now - s.t <= windowMs);
  if (recent.length < 2) return 0;
  const first = recent[0], last = recent[recent.length - 1];
  const span = (last.t - first.t) / 1000;
  if (span <= 0.012 || now - last.t > 60) return 0;
  return clampOmega((last.theta - first.theta) / span);
}

/* ----------------------------------------------------------------- parts */
export type MachineId = 'engine' | 'toy';
export const MACHINES: readonly MachineId[] = ['engine', 'toy'];
export type PartId = 'wheel' | 'crank' | 'rod' | 'piston' | 'cylinder' | 'handle' | 'bird';
export const MACHINE_PARTS: Readonly<Record<MachineId, readonly PartId[]>> = {
  engine: ['wheel', 'crank', 'rod', 'piston', 'cylinder'],
  toy: ['handle', 'crank', 'rod', 'bird'],
};
/** Parts the front casing hides while it is closed. The wheel (or handle) and
 * the piston's top rod (or the bird) stay in sight. */
const BEHIND_CASE: Readonly<Record<MachineId, readonly PartId[]>> = {
  engine: ['crank', 'rod', 'piston', 'cylinder'],
  toy: ['crank', 'rod'],
};
export function hiddenByCase(machine: MachineId, part: PartId): boolean {
  return BEHIND_CASE[machine].includes(part);
}
/** A part can be met (tapped, named) only with the case open. */
export function canSelect(machine: MachineId, part: PartId | null | undefined, open: boolean): part is PartId {
  return open && !!part && MACHINE_PARTS[machine].includes(part);
}
/** Switching machine keeps a selected part that the other machine also has
 * (the crank, the rod): they are the same idea. */
export function carrySelection(part: PartId | null, machine: MachineId): PartId | null {
  return part && MACHINE_PARTS[machine].includes(part) ? part : null;
}

/* -------------------------------------------------------------- the arc */
/** Hand turning that counts as "turned it by hand": one whole turn. */
export const HAND_TURN_GOAL = TAU;
export interface Explore {
  readonly hand: number;
  readonly inside: boolean;
  readonly met: readonly PartId[];
  readonly seen: readonly MachineId[];
}
export const START: Explore = { hand: 0, inside: false, met: [], seen: ['engine'] };
export const turnedByHand = (e: Explore, amount: number): Explore => amount === 0 ? e : { ...e, hand: e.hand + Math.abs(amount) };
export const lookedInside = (e: Explore): Explore => e.inside ? e : { ...e, inside: true };
export const metPart = (e: Explore, part: PartId): Explore => e.met.includes(part) ? e : { ...e, met: [...e.met, part] };
export const sawMachine = (e: Explore, machine: MachineId): Explore => e.seen.includes(machine) ? e : { ...e, seen: [...e.seen, machine] };
/** "Met the parts": every part of one machine. The crank and rod met in one
 * machine count in the other, because they are the same parts. */
export function partsMet(met: readonly PartId[]): boolean {
  return MACHINES.some(m => MACHINE_PARTS[m].every(p => met.includes(p)));
}
export interface Badges { readonly turned: boolean; readonly inside: boolean; readonly parts: boolean }
export function badgesOf(e: Explore): Badges {
  // A whole turn made of small steps may fall a rounding error short of 2π.
  return { turned: e.hand >= HAND_TURN_GOAL - 1e-6, inside: e.inside, parts: partsMet(e.met) };
}
/** Done appears once all three badges are lit and both machines were seen. */
export function canFinish(e: Explore): boolean {
  const b = badgesOf(e);
  return b.turned && b.inside && b.parts && MACHINES.every(m => e.seen.includes(m));
}
export type Cue = 'turn' | 'look' | 'meet' | 'more' | 'other' | 'ready';
/** The next small step, never a judgement. */
export function cueFor(e: Explore, open: boolean, machine: MachineId): Cue {
  if (canFinish(e)) return 'ready';
  const b = badgesOf(e);
  if (!b.turned && !b.inside) return 'turn';
  if (!open && !b.parts) return 'look';
  if (!b.parts) return e.met.length ? 'more' : 'meet';
  if (!b.turned) return 'turn';
  if (!e.seen.includes(machine === 'engine' ? 'toy' : 'engine')) return 'other';
  return 'ready';
}

/* ------------------------------------------------------------- traces */
export const TRACE_BINS = 72;
/** The slice of the crank circle a crank angle lies in. */
export const traceBin = (theta: number) => Math.floor(wrapAngle(theta) / TAU * TRACE_BINS) % TRACE_BINS;
/** Mark every slice swept between two unwrapped angles (at most one turn). */
export function sweepBins(bins: readonly boolean[], from: number, to: number): boolean[] {
  const next = bins.length === TRACE_BINS ? [...bins] : Array<boolean>(TRACE_BINS).fill(false);
  const span = Math.min(Math.abs(to - from), TAU);
  // Half-slice steps, so a sample never lands only on slice edges.
  const steps = Math.max(1, Math.ceil(span / (TAU / TRACE_BINS) * 2));
  const dir = to >= from ? 1 : -1;
  for (let i = 0; i <= steps; i++) next[traceBin(from + dir * span * i / steps)] = true;
  return next;
}
