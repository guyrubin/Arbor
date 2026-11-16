/** How Things Move rules. Pure: no React, no timers, no randomness, no DOM.
 *
 * One idea, built up three times on one bench: a slider-crank. A crank of radius `r` turns about a
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
 * - The slide carries a load (the piston) that weighs on the crank exactly as
 *   a weight on that slide would: its turning effect is the slope of the lift,
 *   d(lift)/dθ. A wheel let go of by the hand is slowed by a simple drag and
 *   rocks to rest with the load at the bottom. The drag is an easing for the
 *   child's hand, not a model of bearing friction; the motor ignores the load
 *   and holds its speed.
 * - The flower's cam is a round disc set off-centre on its shaft (an
 *   eccentric) under a flat-faced follower, so the stem's height is exactly
 *   R + e·cos of the cam's angle. The flower opens with the height.
 * - The bead rods are six small slider-cranks. Belts of equal pulleys turn
 *   every shaft once for each turn of the big wheel; the cam and each small
 *   crank are fixed on their shafts a set part of a turn later than the one
 *   before, which is all that makes the flower follow the piston and the
 *   beads ripple. Belts never slip or stretch.
 */

export const TAU = Math.PI * 2;

export interface Linkage { readonly r: number; readonly l: number }
/** The drawing's linkage, in drawing units: the rod is three cranks long. */
export const LINKAGE: Linkage = { r: 30, l: 90 };
/** Top and bottom dead centre: the crank pin straight up, then straight down. */
export const TOP_DEAD_CENTRE = 0;
export const BOTTOM_DEAD_CENTRE = Math.PI;

export interface Point { readonly x: number; readonly y: number }

/** The crank pin, relative to the shaft (y down). */
export function crankPin(theta: number, { r }: Linkage = LINKAGE): Point {
  return { x: r * Math.sin(theta), y: -r * Math.cos(theta) };
}
/** How far above the shaft the wrist pin (the piston, the flower's stem, the pen's mast) is. */
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
/** How fast the lift changes as the crank turns: d(lift)/dθ, exact. It is zero
 * at both dead centres, where a push on the slide cannot turn the crank. */
export function liftSlope(theta: number, { r, l }: Linkage = LINKAGE): number {
  const s = r * Math.sin(theta);
  return -s * (1 + r * Math.cos(theta) / Math.sqrt(l * l - s * s));
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
/** The fastest a hand may fling the wheel, and the push the Turn button gives:
 * enough to carry the load once over the top from rest at the bottom. */
export const MAX_HAND_OMEGA = TAU * 1.8;
export const PUSH_OMEGA = TAU * 1.3;
/** With motion reduced, a push is a quarter turn at the slow speed, no fling. */
export const CALM_PUSH = TAU / 4;
/** One arrow key press: a twenty-fourth of a turn. */
export const KEY_STEP = TAU / 24;
/** The load's weight on the crank, in rad/s² for each drawing unit of slope. */
export const LOAD = 0.3;
/** A free wheel's drag (1/s), stronger near rest so the rocking soon settles. */
export const DRAG = 0.5;
export const DRAG_SLOW = 2.6;
/** A wheel this slow, with this little turning effect on it, is at rest. */
export const REST_SPEED = 0.05;
export const REST_TURN = 0.3;
/** The hand holds the wheel through a firm spring: the wheel has weight. */
export const HAND_STIFF = 170;
export const HAND_DAMP = 25;
/** The wheel clicks past this many soft stops in a turn. */
export const DETENTS = 12;
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
export const clampOmega = (omega: number) => Math.max(-MAX_HAND_OMEGA, Math.min(MAX_HAND_OMEGA, omega));
export interface Spin { readonly theta: number; readonly omega: number }
/** The turning effect of the load on the crank (rad/s²): it pulls the crank
 * toward bottom dead centre and vanishes at both dead centres. */
export function loadTurn(theta: number): number {
  return -LOAD * liftSlope(theta);
}
/** What a free wheel holds: its spin, and the height of its load. */
export function spinEnergy({ theta, omega }: Spin): number {
  return omega * omega / 2 + LOAD * pistonLift(theta);
}
const SUBSTEP = 1 / 240;
/** A let-go wheel: the load swings it, a drag slows it, and it comes to rest
 * with the load at the bottom (or balanced, dead still, exactly on a dead
 * centre). It never gains energy. */
export function swing({ theta, omega }: Spin, dt: number): Spin {
  if (!(dt > 0) || (omega === 0 && Math.abs(loadTurn(theta)) < REST_TURN)) return { theta, omega };
  const n = Math.max(1, Math.ceil(dt / SUBSTEP)), h = dt / n;
  let t = theta, w = omega;
  for (let i = 0; i < n; i++) {
    w += loadTurn(t) * h;
    w *= Math.exp(-(DRAG + DRAG_SLOW / (1 + (w / 1.6) ** 2)) * h);
    t += w * h;
  }
  if (Math.abs(w) < REST_SPEED && Math.abs(loadTurn(t)) < REST_TURN) w = 0;
  return { theta: t, omega: clampOmega(w) };
}
/** A held wheel: it follows the finger's angle through a spring, so it lags a
 * little, sags under the load on the way up and runs ahead on the way down. */
export function follow({ theta, omega }: Spin, target: number, dt: number): Spin {
  if (!(dt > 0)) return { theta, omega };
  const n = Math.max(1, Math.ceil(dt / SUBSTEP)), h = dt / n;
  let t = theta, w = omega;
  for (let i = 0; i < n; i++) {
    w += (HAND_STIFF * (target - t) - HAND_DAMP * w + loadTurn(t)) * h;
    t += w * h;
  }
  return { theta: t, omega: w };
}
/** How many soft stops the wheel clicked past between two unwrapped angles. */
export function detentsCrossed(from: number, to: number): number {
  const step = TAU / DETENTS;
  return Math.abs(Math.floor(to / step) - Math.floor(from / step));
}
/** The stops passed between two angles, as steps of the stroke (0 at the
 * bottom to `steps - 1` at the top): the notes a turning wheel plays, rising
 * as the load rises and falling as it falls. At most `limit`, the latest. */
export function detentSteps(from: number, to: number, steps = 5, limit = 3): number[] {
  const step = TAU / DETENTS, a = Math.floor(from / step), b = Math.floor(to / step), out: number[] = [];
  if (a === b) return out;
  const dir = b > a ? 1 : -1;
  // Going up the angle passes the stop at k·step on reaching it; going back passes the one just left.
  for (let k = a; k !== b; k += dir) out.push(Math.round(strokeFraction((dir > 0 ? k + 1 : k) * step) * (steps - 1)));
  return out.slice(-limit);
}
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


/* ------------------------------------------------------------ the cam */
/** A round disc of radius `R`, fixed `e` off-centre on its shaft. */
export interface Cam { readonly R: number; readonly e: number }
export const CAM: Cam = { R: 22, e: 12 };
/** The centre of the cam disc, relative to its shaft (y down): it goes round
 * the shaft exactly as a crank pin of radius `e` would. */
export function camCentre(angle: number, { e }: Cam = CAM): Point {
  return { x: e * Math.sin(angle), y: -e * Math.cos(angle) };
}
/** How far above the shaft the flat follower rides: the top of the disc. */
export function camLift(angle: number, { R, e }: Cam = CAM): number {
  return R + e * Math.cos(angle);
}
/** Where the disc touches the follower's flat face: straight above its centre. */
export function camContact(angle: number, cam: Cam = CAM): Point {
  return { x: cam.e * Math.sin(angle), y: -camLift(angle, cam) };
}
/** How open the flower is: shut (0) at the bottom of the lift, open (1) at the top. */
export function bloomOpen(angle: number, cam: Cam = CAM): number {
  return (camLift(angle, cam) - (cam.R - cam.e)) / (2 * cam.e);
}

/* ----------------------------------------------------- one shaft, in turn */
/** The cam is fixed on its shaft this far behind the big crank. */
export const CAM_LAG = TAU * 0.2;
/** Six bead rods, each a small slider-crank. */
export const WAVE_RODS = 6;
export const WAVE_LINK: Linkage = { r: 13, l: 36 };
/** The first small crank is this far behind the big crank; each neighbour a tenth of a turn more. */
export const WAVE_LAG = TAU * 0.35;
export const WAVE_STEP = TAU / 10;
/** The cam's own angle when the big crank is at `theta`. */
export const camAngle = (theta: number) => theta - CAM_LAG;
/** Rod `i`'s own crank angle when the big crank is at `theta`. */
export const waveAngle = (i: number, theta: number) => theta - WAVE_LAG - i * WAVE_STEP;
/** How far above its shaft bead rod `i`'s wrist pin is. */
export const waveLift = (i: number, theta: number) => pistonLift(waveAngle(i, theta), WAVE_LINK);
/** Where rod `i` is in its stroke: 0 at the bottom, 1 at the top. */
export const waveFraction = (i: number, theta: number) => strokeFraction(waveAngle(i, theta), WAVE_LINK);

/** Something reaching the top of its travel: one beat of the machine's tune. */
export type BeatKind = 'pistonTop' | 'bloomTop' | 'beadTop' | 'bellRing';
export interface Beat { readonly kind: BeatKind; readonly index: number; readonly at: number }
/** The angle (in one turn) at which each thing tops out. The last bead rings the bell. */
export const BEAT_ANGLES: readonly Beat[] = [
  { kind: 'pistonTop', index: 0, at: 0 },
  { kind: 'bloomTop', index: 0, at: CAM_LAG },
  ...Array.from({ length: WAVE_RODS }, (_, i): Beat => ({ kind: 'beadTop', index: i, at: WAVE_LAG + i * WAVE_STEP })),
  { kind: 'bellRing', index: 0, at: WAVE_LAG + (WAVE_RODS - 1) * WAVE_STEP },
];
/** The beats passed between two unwrapped angles, either way round, in the
 * order they were passed (at most one turn's worth). */
export function beatsCrossed(from: number, to: number): Beat[] {
  if (from === to) return [];
  const lo = Math.min(from, to), hi = Math.min(Math.max(from, to), lo + TAU), out: { beat: Beat; angle: number }[] = [];
  for (const beat of BEAT_ANGLES) {
    const first = Math.floor((lo - beat.at) / TAU) + 1;
    for (let k = first; beat.at + k * TAU <= hi; k++) out.push({ beat, angle: beat.at + k * TAU });
  }
  out.sort((a, b) => a.angle - b.angle);
  if (to < from) out.reverse();
  return out.map(o => o.beat);
}

/* -------------------------------------------------------------- the arc */
/** Three chapters that grow, then the whole machine at once. */
export type Chapter = 'pistonCh' | 'flowerCh' | 'waveCh' | 'finaleCh';
export const CHAPTERS: readonly Chapter[] = ['pistonCh', 'flowerCh', 'waveCh', 'finaleCh'];
/** What a chapter asks, one small thing at a time. */
export type Step = 'turnIt' | 'lookIn' | 'testJoint' | 'pickUp' | 'bigShow';
export const CHAPTER_STEPS: Readonly<Record<Chapter, readonly Step[]>> = {
  pistonCh: ['turnIt', 'lookIn', 'testJoint'],
  flowerCh: ['pickUp', 'turnIt', 'lookIn'],
  waveCh: ['pickUp', 'turnIt', 'lookIn'],
  finaleCh: ['pickUp', 'turnIt', 'bigShow'],
};
/** The hidden parts the ProofLens can name, by chapter. */
export type PartId = 'crankArm' | 'rodBar' | 'pistonHead' | 'camDisc' | 'follower' | 'smallCranks';
export const LENS_PARTS: Readonly<Record<Chapter, readonly PartId[]>> = {
  pistonCh: ['crankArm', 'rodBar', 'pistonHead'],
  flowerCh: ['camDisc', 'follower'],
  waveCh: ['smallCranks'],
  finaleCh: [],
};
export const ALL_PARTS: readonly PartId[] = CHAPTERS.flatMap(c => LENS_PARTS[c]);
/** Hand turning that completes a "turn it" step: one whole turn. The last
 * chapter only needs a good start: the machine takes it from there. */
export const HAND_TURN_GOAL = TAU;
export const SHOW_START_GOAL = TAU / 3;
export interface Flow {
  readonly chapter: Chapter;
  /** Index into the chapter's steps. */
  readonly step: number;
  /** Hand turning counted toward the step in play (radians). */
  readonly hand: number;
  /** Every part the lens has named so far, in order. */
  readonly met: readonly PartId[];
  /** The whole arc is done: time for the finish. */
  readonly over: boolean;
}
export const FLOW_START: Flow = { chapter: 'pistonCh', step: 0, hand: 0, met: [], over: false };
export const stepOf = (flow: Flow): Step => CHAPTER_STEPS[flow.chapter][flow.step];
export type FlowEvent =
  | { readonly type: 'turned'; readonly amount: number }
  | { readonly type: 'met'; readonly part: PartId }
  | { readonly type: 'tested' }
  | { readonly type: 'placed' }
  | { readonly type: 'shown' };
function nextStep(flow: Flow): Flow {
  const steps = CHAPTER_STEPS[flow.chapter];
  if (flow.step + 1 < steps.length) return { ...flow, step: flow.step + 1, hand: 0 };
  const at = CHAPTERS.indexOf(flow.chapter);
  if (at + 1 < CHAPTERS.length) return { ...flow, chapter: CHAPTERS[at + 1], step: 0, hand: 0 };
  return { ...flow, hand: 0, over: true };
}
/** The parts of the chapter in play that the lens has still to name. */
export function partsLeft(flow: Flow): PartId[] {
  return LENS_PARTS[flow.chapter].filter(p => !flow.met.includes(p));
}
/** One thing happened. Only what the step in play asks for moves the arc on;
 * anything else leaves it exactly as it was (never a miss, never a penalty). */
export function flowReduce(flow: Flow, event: FlowEvent): Flow {
  if (flow.over) return flow;
  const step = stepOf(flow);
  if (event.type === 'turned') {
    if (step !== 'turnIt' || !(Math.abs(event.amount) > 0)) return flow;
    const hand = flow.hand + Math.abs(event.amount);
    // A whole turn made of small steps may fall a rounding error short of 2π.
    const goal = (flow.chapter === 'finaleCh' ? SHOW_START_GOAL : HAND_TURN_GOAL) - 1e-6;
    return hand >= goal ? nextStep(flow) : { ...flow, hand };
  }
  if (event.type === 'met') {
    if (flow.met.includes(event.part) || !ALL_PARTS.includes(event.part)) return flow;
    // A part of an earlier machine may be named at any time; only this chapter's parts finish a look.
    const met = [...flow.met, event.part], next = { ...flow, met };
    return step === 'lookIn' && partsLeft(next).length === 0 ? nextStep(next) : next;
  }
  if (event.type === 'tested') return step === 'testJoint' ? nextStep(flow) : flow;
  if (event.type === 'placed') return step === 'pickUp' ? nextStep(flow) : flow;
  return step === 'bigShow' ? nextStep(flow) : flow;
}
/** Which stations are joined to the big wheel: each is built by its own pick-up. */
export interface Built { readonly flower: boolean; readonly beads: boolean; readonly bell: boolean }
export function builtOf(flow: Flow): Built {
  const at = CHAPTERS.indexOf(flow.chapter), placed = (chapter: Chapter) => at > CHAPTERS.indexOf(chapter) || (flow.chapter === chapter && flow.step > 0);
  return { flower: placed('flowerCh'), beads: placed('waveCh'), bell: placed('finaleCh') || flow.over };
}
/** Chapters wholly done: the quest strip's pips. Things done, never a measure. */
export function chaptersDone(flow: Flow): Readonly<Record<Chapter, boolean>> {
  const at = flow.over ? CHAPTERS.length : CHAPTERS.indexOf(flow.chapter);
  return { pistonCh: at > 0, flowerCh: at > 1, waveCh: at > 2, finaleCh: at > 3 };
}

/* ------------------------------------------------------------- the lens */
/** How long the lens rests over a part before it names it (seconds). */
export const LENS_DWELL = 0.32;
export interface Anchor { readonly part: PartId; readonly x: number; readonly y: number }
/** The part whose anchor lies nearest the middle of the lens, within reach. */
export function nearestPart(lens: Point, anchors: readonly Anchor[], reach: number): PartId | null {
  let best: PartId | null = null, bestD = reach;
  for (const a of anchors) {
    const d = Math.hypot(a.x - lens.x, a.y - lens.y);
    if (d <= bestD) { bestD = d; best = a.part; }
  }
  return best;
}

/* -------------------------------------------------------------- variety */
/** What changes from one visit to the next: the enamel, the flower, the
 * order of the bead colours, the tune the beads play and where the wheel rests. */
export interface Plan {
  readonly enamel: number;
  readonly bloom: number;
  readonly beads: readonly number[];
  readonly tune: readonly number[];
  readonly rest: number;
}
export const ENAMELS = 3, BLOOMS = 4;
/** Tunes for the six beads, as steps of the scale: all end on the way up to the bell. */
export const TUNES: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5],
  [0, 2, 1, 3, 2, 4],
  [2, 0, 2, 3, 5, 4],
  [0, 2, 4, 2, 4, 5],
];
/** The same seed always gives the same visit (so a test can pin one). */
export function planOf(seed: number): Plan {
  let state = (Math.floor(Math.abs(seed)) >>> 0) || 1;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let i = 0; i < 4; i++) random();
  const enamel = Math.floor(random() * ENAMELS), bloom = Math.floor(random() * BLOOMS);
  const beads = Array.from({ length: WAVE_RODS }, (_, i) => i);
  for (let i = beads.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [beads[i], beads[j]] = [beads[j], beads[i]]; }
  const tune = TUNES[Math.floor(random() * TUNES.length)];
  // The wheel rests near the bottom of the stroke, a little to one side or the other.
  const rest = Math.PI + (random() - 0.5) * 1.6;
  return { enamel, bloom, beads, tune, rest };
}
