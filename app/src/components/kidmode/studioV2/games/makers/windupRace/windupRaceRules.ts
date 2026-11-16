/** Wind-up Racer rules. Pure: no React, no timers, no randomness. A tin car
 * on a tabletop track: each click of the key stores the same bit of energy in
 * the spring; let go and the spring drives the wheels (its push follows how
 * much spring is left), then the car coasts and rolling friction slows it.
 * Slopes add or take away speed, a pencil bump costs a fixed bit of energy,
 * soft things (dominoes, a wool ball, a paper tunnel) each cost a little
 * speed and never stop the run. One fixed-step 1-D integration along the
 * track's arc length, so the same clicks always end in the same place.
 *
 * Units: the track is drawn in "table units" (the car is 96 long); y is up
 * from the table top; time is in seconds. Nothing here knows about screens.
 * Nothing is scored: a run simply ends where it ends. */

export const MAX_CLICKS = 12;
/** The car, centre to nose (and centre to tail). */
export const CAR_HALF = 48;
/** Half the distance between the axles: the body leans to the line through both wheels. */
export const AXLE_HALF = 30;
export const WHEEL_R = 13;

/** Energy one click of the key stores (per unit of mass). */
export const CLICK_ENERGY = 30000;
/** How quickly the spring hands its energy to the wheels, per unit travelled:
 * the push is DRIVE_RATE × the energy still in the spring. */
export const DRIVE_RATE = 1 / 70;
export const GRAVITY = 760;
/** Rolling friction (a steady slowing while the car moves). */
export const ROLLING = 165;
/** A resting car stays put until the push on it is more than this. */
export const STATIC = 190;
export const TUNNEL_DRAG = 1.4;
/** The cushion at the end: a soft spring with a lot of give. */
export const CUSHION_K = 700;
export const CUSHION_DAMP = 24;
export const STEP = 1 / 240;
/** Samples are kept at this rate for playback (every SAMPLE_EVERY steps). */
export const SAMPLE_RATE = 60;
const SAMPLE_EVERY = Math.round(1 / (STEP * SAMPLE_RATE));
export const MAX_RUN_SECONDS = 18;

export type TrackId = 'shelf' | 'ramp' | 'table' | 'blockBridge' | 'bookSlide' | 'grandTour';
export interface Track {
  id: TrackId;
  /** The rolling surface, left to right: [x, y] with y up from the table. */
  points: readonly (readonly [number, number])[];
  /** Arc length of the car's centre at the start line. */
  start: number;
  /** Arc length of the flag pole: the run reaches it when the nose passes it. */
  flag: number;
  /** Arc length of the cushion's face. */
  cushion: number;
  /** A fixed energy cost taken when the car's centre crosses `at`. */
  bumps: readonly { at: number; cost: number }[];
  /** Standing dominoes (arc lengths). The first touch tips the whole row. */
  dominoes: readonly number[];
  /** The car keeps this share of its speed when it tips the row. */
  dominoKeep: number;
  /** A ball of wool resting at this arc length, or null. */
  ball: number | null;
  /** A paper tunnel between these arc lengths, or null. */
  tunnel: readonly [number, number] | null;
}

const flat = (from: number, to: number, y = 0): [number, number][] => [[from, y], [to, y]];
/** A pencil lying across the table: a low six-sided hump. */
const pencil = (x: number): [number, number][] => [[x - 16, 0], [x - 8, 7], [x + 8, 7], [x + 16, 0]];

/** Every track. The first three are the first play, in order; the next three
 * are the second set. Each is authored and tuned on its own (see the tests:
 * more wind always goes further, and each asks for its own amount of wind). */
export const TRACKS: readonly Track[] = [
  {
    // Bookshelf run: flat and short, along a shelf of cloth-bound books.
    id: 'shelf', points: [...flat(0, 1120)], start: 70, flag: 820, cushion: 1030,
    bumps: [], dominoes: [], dominoKeep: 1, ball: null, tunnel: null,
  },
  {
    // Ramp and ruler: up a leaning book, across a short stack, down a ruler.
    id: 'ramp', points: [[0, 0], [250, 0], [520, 90], [680, 90], [1000, 0], [1500, 0]], start: 70, flag: 1250, cushion: 1410,
    bumps: [], dominoes: [], dominoKeep: 1, ball: 1110, tunnel: null,
  },
  {
    // The long table: a pencil bump, a row of dominoes, a paper tunnel, a rise to the flag.
    id: 'table', points: [...flat(0, 360), ...pencil(380), ...flat(396, 1180), [1380, 30], [1760, 30]], start: 70, flag: 1400, cushion: 1600,
    bumps: [{ at: 382, cost: 6000 }], dominoes: [560, 588, 616, 644, 672, 700], dominoKeep: .93, ball: null, tunnel: [820, 1040],
  },
  {
    // Block bridge: up a wooden wedge, over a plank with dominoes standing on it, down the far wedge.
    id: 'blockBridge', points: [[0, 0], [300, 0], [430, 26], [760, 26], [890, 0], [1400, 0]], start: 70, flag: 940, cushion: 1130,
    bumps: [], dominoes: [500, 528, 556, 584, 612], dominoKeep: .93, ball: null, tunnel: null,
  },
  {
    // Book slide: it starts high on a pile of books, runs down a ruler (the slope
    // adds speed), nudges the wool ball, then climbs a leaning book to the flag.
    id: 'bookSlide', points: [[0, 80], [230, 80], [490, 0], [900, 0], [1090, 60], [1600, 60]], start: 70, flag: 1180, cushion: 1360,
    bumps: [], dominoes: [], dominoKeep: 1, ball: 640, tunnel: null,
  },
  {
    // The grand table: pencil, dominoes, the paper tunnel, the wool ball, then the rise.
    id: 'grandTour', points: [...flat(0, 344), ...pencil(360), ...flat(376, 1100), [1280, 30], [1800, 30]], start: 70, flag: 1310, cushion: 1500,
    bumps: [{ at: 362, cost: 6000 }], dominoes: [470, 498, 526, 554, 582, 610], dominoKeep: .93, ball: 1000, tunnel: [680, 880],
  },
];
/** One play is three tracks. */
export const PLAY_LENGTH = 3;
/** The sets, by play: the first play is always the first set; Play again moves
 * on to the next, so a second go is new tracks, and later goes mix the two. */
export const TRACK_SETS: readonly (readonly TrackId[])[] = [
  ['shelf', 'ramp', 'table'],
  ['blockBridge', 'bookSlide', 'grandTour'],
  ['shelf', 'bookSlide', 'table'],
  ['blockBridge', 'ramp', 'grandTour'],
];
/** The three tracks of play number `round` (0 = the first play). */
export function trackSet(round: number): readonly Track[] {
  const r = Number.isFinite(round) ? Math.max(0, Math.trunc(round)) : 0;
  return TRACK_SETS[r % TRACK_SETS.length].map(id => TRACKS.find(track => track.id === id)!);
}
/** The room's light changes from play to play (scenery only; the physics never does). */
export const ROOM_LIGHTS = ['afternoon', 'morning', 'sundown'] as const;
export type RoomLight = typeof ROOM_LIGHTS[number];
export function roomLight(round: number): RoomLight {
  const r = Number.isFinite(round) ? Math.max(0, Math.trunc(round)) : 0;
  return ROOM_LIGHTS[r % ROOM_LIGHTS.length];
}

/* ---------- track geometry ---------- */

export interface TrackShape { lengths: number[]; total: number }
const shapes = new WeakMap<Track, TrackShape>();
export function shapeOf(track: Track): TrackShape {
  const known = shapes.get(track); if (known) return known;
  const lengths = [0];
  for (let i = 1; i < track.points.length; i++) {
    const [ax, ay] = track.points[i - 1], [bx, by] = track.points[i];
    lengths.push(lengths[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  const shape = { lengths, total: lengths[lengths.length - 1] };
  shapes.set(track, shape);
  return shape;
}
function segmentAt(track: Track, s: number): number {
  const { lengths } = shapeOf(track);
  for (let i = 1; i < lengths.length; i++) if (s <= lengths[i]) return i;
  return lengths.length - 1;
}
/** The point on the track at arc length `s` (clamped; beyond the ends it runs on straight). */
export function pointAt(track: Track, s: number): { x: number; y: number } {
  const i = segmentAt(track, s), { lengths } = shapeOf(track);
  const [ax, ay] = track.points[i - 1], [bx, by] = track.points[i];
  const span = lengths[i] - lengths[i - 1] || 1;
  const f = (s - lengths[i - 1]) / span;
  return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f };
}
/** Sine of the slope under arc length `s` (positive = uphill to the right). */
export function slopeAt(track: Track, s: number): number {
  const i = segmentAt(track, s), { lengths } = shapeOf(track);
  const [, ay] = track.points[i - 1], [, by] = track.points[i];
  return (by - ay) / (lengths[i] - lengths[i - 1] || 1);
}
/** The body's lean (radians, positive = nose up): the line through both wheels. */
export function leanAt(track: Track, s: number): number {
  const rear = pointAt(track, s - AXLE_HALF), front = pointAt(track, s + AXLE_HALF);
  return Math.atan2(front.y - rear.y, front.x - rear.x);
}

/* ---------- the spring ---------- */

/** One more click on the key; the key stops turning at MAX_CLICKS. */
export function wind(clicks: number): number {
  const now = Number.isFinite(clicks) ? Math.max(0, Math.min(MAX_CLICKS, Math.trunc(clicks))) : 0;
  return Math.min(MAX_CLICKS, now + 1);
}
/** Energy stored by `clicks` clicks: E = k · clicks. */
export function springEnergy(clicks: number): number {
  return CLICK_ENERGY * Math.max(0, Math.min(MAX_CLICKS, Math.trunc(Number.isFinite(clicks) ? clicks : 0)));
}
/** How far the key turns for a turn of the finger: the tighter the spring,
 * the more it resists, so a full click takes a longer swirl. */
export function keyGain(clicks: number): number {
  const c = Math.max(0, Math.min(MAX_CLICKS, Number.isFinite(clicks) ? clicks : 0));
  return 1 / (1 + c * 0.07);
}
/** A drag on the key. `turn` is the key's progress into the next click (0..1),
 * `delta` the finger's turn in whole turns (clockwise positive). Backwards
 * turns are held by the ratchet. Returns the new clicks and progress, and how
 * many clicks this drag made (for the ticks). */
export function dragKey(clicks: number, turn: number, delta: number): { clicks: number; turn: number; made: number } {
  let c = Math.max(0, Math.min(MAX_CLICKS, Math.trunc(clicks) || 0));
  let t = Math.max(0, Math.min(1, Number.isFinite(turn) ? turn : 0));
  let left = Number.isFinite(delta) ? Math.max(0, delta) : 0, made = 0;
  while (left > 0 && c < MAX_CLICKS) {
    const gain = keyGain(c), need = (1 - t) / gain;
    if (left < need) { t += left * gain; left = 0; break; }
    left -= need; t = 0; c += 1; made += 1;
  }
  if (c >= MAX_CLICKS) t = 0;
  return { clicks: c, turn: t, made };
}

/* ---------- the run ---------- */

export type RunEventKind = 'bump' | 'dominoes' | 'ball' | 'tunnel' | 'flag' | 'cushion' | 'turnback' | 'stop';
export interface RunEvent { t: number; kind: RunEventKind }
export interface RunSample {
  t: number;
  /** Arc length of the car's centre. */
  s: number;
  v: number;
  /** Key turns still in the spring (clicks × energy left / energy wound). */
  turns: number;
  /** The wool ball's arc length (null on tracks without one). */
  ball: number | null;
}
export interface RunResult {
  samples: RunSample[];
  events: RunEvent[];
  /** Where the car's centre came to rest. */
  stop: number;
  /** The furthest the nose reached (arc length). */
  reach: number;
  finished: boolean;
  /** When the row of dominoes was tipped (seconds), or null. */
  dominoesAt: number | null;
  duration: number;
}

const BALL_R = 20;
const BALL_ROLLING = 300;

/** Release the spring with `clicks` clicks and roll the car to rest. */
export function simulate(track: Track, clicks: number): RunResult {
  const wound = Math.max(0, Math.min(MAX_CLICKS, Math.trunc(Number.isFinite(clicks) ? clicks : 0)));
  const e0 = springEnergy(wound);
  const wall = CAR_HALF;
  let s = track.start, v = 0, e = e0, t = 0, reach = s + CAR_HALF, still = 0, step = 0;
  let ball = track.ball, ballV = 0, ballHit = false;
  let toppled = false, dominoesAt: number | null = null, flagged = false, tunnelIn = false, cushioned = false, turned = false;
  const bumpsDone = new Set<number>();
  const samples: RunSample[] = [], events: RunEvent[] = [];
  const turnsLeft = () => (e0 > 0 ? wound * e / e0 : 0);
  const sample = () => samples.push({ t: round(t), s: round(s), v: round(v), turns: round(turnsLeft()), ball: ball === null ? null : round(ball) });
  sample();
  while (t < MAX_RUN_SECONDS) {
    const front = s + CAR_HALF;
    const inTunnel = !!track.tunnel && s >= track.tunnel[0] && s <= track.tunnel[1];
    const engaged = v >= 0;
    const drive = engaged ? DRIVE_RATE * e : 0;
    const gravity = -GRAVITY * slopeAt(track, s);
    const depth = front - track.cushion;
    // It only pushes while it is being squashed: it takes the car's speed and keeps it.
    const cushion = depth > 0 && v > 0 ? -CUSHION_K * depth - CUSHION_DAMP * v : 0;
    const push = drive + gravity + cushion;
    const rolling = ROLLING * (inTunnel ? TUNNEL_DRAG : 1);
    let a: number;
    if (Math.abs(v) < 1e-9) a = Math.abs(push) <= STATIC ? 0 : push - Math.sign(push) * rolling;
    else a = push - Math.sign(v) * rolling;
    let next = v + a * STEP;
    // Friction slows a car to a stop; it never turns it round.
    if (v !== 0 && Math.sign(next) !== Math.sign(v) && Math.abs(gravity + cushion + drive) <= STATIC) next = 0;
    // The cushion soaks up speed; it never throws the car back.
    if (depth > 0 && v > 0 && next < 0) next = 0;
    const ds = next * STEP;
    // The spring gives up what it pushed through; with the wheels still or
    // rolling back (clutch slipping) the rest of it lets go freely.
    if (ds > 0) e = Math.max(0, e - drive * ds);
    if ((next <= 0 && t > 0.25) || depth > 0) e *= Math.exp(-4 * STEP);
    if (e < 1) e = 0;
    s += ds; v = next; t += STEP; step++;
    // The start block: rolling back, the tail taps it and the car stops there.
    if (s < wall && v < 0) { s = wall; v = 0; }

    // A bump costs a fixed bit of energy once the centre is over it.
    for (const [index, bump] of track.bumps.entries()) {
      if (bumpsDone.has(index) || s < bump.at) continue;
      bumpsDone.add(index); v = Math.sqrt(Math.max(0, v * v - 2 * bump.cost)); events.push({ t: round(t), kind: 'bump' });
    }
    if (!toppled && track.dominoes.length && s + CAR_HALF >= track.dominoes[0] && v > 0) {
      toppled = true; dominoesAt = round(t); v *= track.dominoKeep; events.push({ t: round(t), kind: 'dominoes' });
    }
    if (ball !== null) {
      // One nudge: the ball rolls on ahead and off toward the back of the
      // table, out of the car's lane; the car keeps a little less speed.
      if (!ballHit && s + CAR_HALF >= ball - BALL_R && v > 0) {
        ballHit = true; ballV = v * 1.2; v *= 0.86; events.push({ t: round(t), kind: 'ball' });
      }
      if (ballV > 0) { ballV = Math.max(0, ballV - BALL_ROLLING * STEP); ball += ballV * STEP; }
    }
    if (track.tunnel && !tunnelIn && s >= track.tunnel[0]) { tunnelIn = true; v *= 0.95; events.push({ t: round(t), kind: 'tunnel' }); }
    if (!flagged && s + CAR_HALF >= track.flag) { flagged = true; events.push({ t: round(t), kind: 'flag' }); }
    if (!cushioned && s + CAR_HALF > track.cushion) { cushioned = true; events.push({ t: round(t), kind: 'cushion' }); }
    if (!turned && v < -1 && reach > track.start + CAR_HALF + 20) { turned = true; events.push({ t: round(t), kind: 'turnback' }); }
    reach = Math.max(reach, s + CAR_HALF);
    if (step % SAMPLE_EVERY === 0) sample();

    const resting = Math.abs(v) < 2 && Math.abs(gravity + cushion + (v >= 0 ? DRIVE_RATE * e : 0)) <= STATIC;
    still = resting && t > 0.2 && (e === 0 || drive < ROLLING) ? still + STEP : 0;
    if (still >= 0.15 || (wound === 0 && t > 0.2)) break;
  }
  if (samples[samples.length - 1].t !== round(t)) sample();
  // At rest the spring lets go of anything left (the key spins back loose).
  samples[samples.length - 1] = { ...samples[samples.length - 1], v: 0, turns: 0 };
  events.push({ t: round(t), kind: 'stop' });
  return { samples, events, stop: round(s), reach: round(reach), finished: flagged, dominoesAt, duration: round(t) };
}

/** The fewest clicks that reach the flag (tests only: the game never shows it). */
export function minimumClicks(track: Track): number | null {
  for (let clicks = 0; clicks <= MAX_CLICKS; clicks++) if (simulate(track, clicks).finished) return clicks;
  return null;
}

/** The sample at time `t` of a run (playback reads the precomputed run). */
export function sampleAt(run: RunResult, t: number): RunSample {
  const { samples } = run;
  if (!samples.length) return { t: 0, s: 0, v: 0, turns: 0, ball: null };
  if (!(t > 0)) return samples[0];
  const index = Math.min(samples.length - 1, Math.floor(t * SAMPLE_RATE));
  const a = samples[index], b = samples[Math.min(samples.length - 1, index + 1)];
  if (a === b || b.t <= a.t) return a;
  const f = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
  const mix = (x: number, y: number) => x + (y - x) * f;
  return { t, s: mix(a.s, b.s), v: mix(a.v, b.v), turns: mix(a.turns, b.turns), ball: a.ball === null || b.ball === null ? a.ball : mix(a.ball, b.ball) };
}

/** Wheel turn (radians) for a distance rolled. */
export function wheelAngle(s: number): number { return s / WHEEL_R; }

/** The next place in the play after a finish (0, 1, 2), or null after the last one. */
export function nextTrack(index: number): number | null {
  const i = Number.isFinite(index) ? Math.trunc(index) : 0;
  return i + 1 < PLAY_LENGTH ? Math.max(0, i + 1) : null;
}

/** A run that ends within this much table of the flag pole, either side, is a
 * close one: the playback slows to watch it (nothing is judged or said). */
export const CLOSE_CALL = 70;
/** The playback slows from the moment the nose is this far short of the flag. */
export const CLOSE_LEAD = 110;
/** When to begin slowing a close run (seconds into the run), or null when the
 * run is not a close one. Pure: read from the precomputed samples. */
export function closeCallAt(track: Track, run: RunResult): number | null {
  const nose = run.finished ? run.stop + CAR_HALF : run.reach;
  if (Math.abs(nose - track.flag) > CLOSE_CALL) return null;
  // A car that rolled a long way back did not end near the flag.
  if (!run.finished && run.reach - (run.stop + CAR_HALF) > CLOSE_CALL) return null;
  const from = track.flag - CLOSE_LEAD;
  for (const sample of run.samples) if (sample.s + CAR_HALF >= from) return sample.t;
  return null;
}

/** Up to three chalk marks per track (furthest reach of the last runs), newest last. */
export const CHALK_KEEP = 3;
export function addChalk(marks: readonly number[], reach: number): number[] {
  if (!Number.isFinite(reach)) return [...marks];
  return [...marks, reach].slice(-CHALK_KEEP);
}

/** Words for how tight the spring is (for the key's spoken name; no numerals on screen). */
export type Tension = 'loose' | 'little' | 'half' | 'tight' | 'full';
export function tension(clicks: number): Tension {
  const c = Math.max(0, Math.min(MAX_CLICKS, Number.isFinite(clicks) ? clicks : 0));
  return c === 0 ? 'loose' : c >= MAX_CLICKS ? 'full' : c <= 3 ? 'little' : c <= 7 ? 'half' : 'tight';
}

function round(value: number): number { return Math.round(value * 1000) / 1000; }
