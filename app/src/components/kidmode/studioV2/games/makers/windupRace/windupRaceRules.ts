/** Wind-up Racer rules. Pure: no React, no clocks, no `Math.random`.
 *
 * Rover is a toy car with a spring. Each click of the key stores the same bit
 * of energy; let go and the spring drives the wheels (its push follows how
 * much spring is left), then Rover coasts and rolling friction slows it. The
 * air decides the rest: a gust in Rover's face slows it unless it leans in, a
 * gust at its back carries it unless it is leaning, a ramp turns speed into a
 * flight, a knit rug drags, a wool ball costs a little speed. A run is
 * stepped live at a fixed step, so the same wind and the same touches always
 * end in the same place.
 *
 * Units: one unit is Rover's length; x runs along the course; y is height
 * above the floor; time is in seconds. Nothing here knows about screens.
 * Nothing is scored. A run ends where it ends, at a place with a name, and
 * the next wind starts from there: nobody is sent back. */

export const MAX_CLICKS = 10;
/** One full turn of the finger on a loose spring makes this many clicks. */
export const CLICKS_PER_TURN = 2;
/** Energy one click stores (per unit of mass). On a flat floor Rover rolls
 * about CLICK_ENERGY / ROLLING units for every click. */
export const CLICK_ENERGY = 11;
/** The spring's push is DRIVE_RATE × the energy still in it. */
export const DRIVE_RATE = 0.25;
export const ROLLING = 2;
/** A resting Rover stays put until the push on it is more than this. */
export const STATIC = 2.4;
export const GRAVITY = 14;
/** In the air the toy floats a little longer than a stone would. */
export const AIR_GRAVITY = 9;
/** A knit rug drags this much harder than the floor. */
export const RUG_DRAG = 2.6;
/** Leaning in lets this share of a headwind through; a leaning Rover catches this share of a tailwind. */
export const LEAN_HEAD = 0.2;
export const LEAN_TAIL = 0.3;
/** The air has more say over a flying Rover. */
export const AIR_WIND = 1.5;
export const CUSHION_K = 30;
export const CUSHION_DAMP = 7;
export const STEP = 1 / 120;
export const MAX_RUN_SECONDS = 40;
/** Rover's middle to its nose. */
export const ROVER_HALF = 0.5;
export const WHEEL_R = 0.17;

/* ---------- the spring ---------- */

const whole = (clicks: number) => Math.max(0, Math.min(MAX_CLICKS, Math.trunc(Number.isFinite(clicks) ? clicks : 0)));
/** One more click on the key; the key stops turning at MAX_CLICKS. */
export function wind(clicks: number): number { return Math.min(MAX_CLICKS, whole(clicks) + 1); }
/** Energy stored by `clicks` clicks: E = k · clicks. */
export function springEnergy(clicks: number): number { return CLICK_ENERGY * whole(clicks); }
/** How far the key turns for a turn of the finger: the tighter the spring,
 * the more it resists, so a click takes a longer swirl. */
export function keyGain(clicks: number): number {
  const c = Math.max(0, Math.min(MAX_CLICKS, Number.isFinite(clicks) ? clicks : 0));
  return 1 / (1 + c * 0.09);
}
/** A drag on the key. `turn` is the key's progress into the next click (0..1),
 * `delta` the finger's turn in whole turns (clockwise positive). The ratchet
 * holds a backward turn. Returns the new clicks and progress, and how many
 * clicks this drag made (for the ticks). */
export function dragKey(clicks: number, turn: number, delta: number): { clicks: number; turn: number; made: number } {
  let c = whole(clicks);
  let t = Math.max(0, Math.min(1, Number.isFinite(turn) ? turn : 0));
  let left = Number.isFinite(delta) ? Math.max(0, delta) : 0, made = 0;
  while (left > 0 && c < MAX_CLICKS) {
    const gain = keyGain(c) * CLICKS_PER_TURN, need = (1 - t) / gain;
    if (left < need) { t += left * gain; left = 0; break; }
    left -= need; t = 0; c += 1; made += 1;
  }
  if (c >= MAX_CLICKS) t = 0;
  return { clicks: c, turn: t, made };
}
/** Words for how tight the spring is (the key's spoken name; no numerals on screen). */
export type Tension = 'loose' | 'little' | 'half' | 'tight' | 'full';
export function tension(clicks: number): Tension {
  const c = Math.max(0, Math.min(MAX_CLICKS, Number.isFinite(clicks) ? clicks : 0));
  return c === 0 ? 'loose' : c >= MAX_CLICKS ? 'full' : c <= 3 ? 'little' : c <= 6 ? 'half' : 'tight';
}

/* ---------- the courses ---------- */

export type ChapterId = 'straight' | 'gustAlley' | 'longCourse' | 'sunArches';
/** Three chapters that grow, then the set-piece. */
export const CHAPTERS: readonly ChapterId[] = ['straight', 'gustAlley', 'longCourse', 'sunArches'];
/** Past the fork Rover takes the plank (high) or the knit rug road (low). */
export type Line = 'high' | 'low';
export type ZoneKind = 'arcade' | 'terrace';
export type PlaceId = 'startLine' | 'firstArch' | 'lightPool' | 'fernRow' | 'flagRow' | 'ramp' | 'signpost' | 'plank' | 'knitRug' | 'woolBall' | 'lastArch' | 'flower';

/** A ramp: the floor rises over `up`, runs level for `flat`, and ends in a lip.
 * Rover leaves the lip climbing at `kick` (rise per unit forward). */
export interface Hill { from: number; up: number; flat: number; height: number; kick: number; line?: Line }
/** A stretch of moving air. `push` < 0 blows in Rover's face, > 0 at its back. */
export interface Gust { from: number; to: number; push: number }
export interface Rug { from: number; to: number; line?: Line }
export interface Ball { at: number; line?: Line }
export interface Course {
  id: ChapterId; seed: number;
  /** Where Rover's middle waits at the start, where the big flower stands, where the cushion's face is. */
  start: number; goal: number; cushion: number;
  /** The far end of the floor that is laid out. */
  length: number;
  zones: readonly { from: number; to: number; kind: ZoneKind }[];
  hills: readonly Hill[];
  gusts: readonly Gust[];
  rugs: readonly Rug[];
  balls: readonly Ball[];
  /** Folded knit flowers beside the track: each opens as Rover passes. */
  blooms: readonly number[];
  /** Where the lines part and where they meet again, or null. */
  fork: { at: number; rejoin: number } | null;
  /** Named places along the way, in order: a run ends "at" the last one passed. */
  places: readonly { at: number; id: PlaceId }[];
}

/** A small seeded generator (mulberry32), so a seed always lays a course out the same way. */
function seeded(seed: number): () => number {
  let state = (Math.floor(Number.isFinite(seed) ? seed : 1) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const HEAD = -5.5, TAIL = 4.5;
const half = (value: number) => Math.round(value * 2) / 2;
const spread = (from: number, to: number, gap: number, random: () => number, skip: readonly (readonly [number, number])[] = []) => {
  const out: number[] = [];
  for (let x = from; x <= to; x += gap) {
    const at = half(x + (random() - 0.5) * gap * 0.3);
    if (!skip.some(([a, b]) => at > a && at < b)) out.push(at);
  }
  return out;
};

/** The course of a chapter. The shape of each chapter is authored; the seed
 * moves its gusts, ramps, ball and flowers about, so no two plays are alike. */
export function buildCourse(id: ChapterId, seed: number): Course {
  const random = seeded((Math.floor(Number.isFinite(seed) ? seed : 1) >>> 0) + CHAPTERS.indexOf(id) * 7919 + 1);
  const shift = (range: number) => half((random() - 0.5) * 2 * range);
  if (id === 'straight') {
    const ballAt = 19 + shift(4);
    return {
      id, seed, start: 2, goal: 33, cushion: 37, length: 46, zones: [{ from: -40, to: 46, kind: 'arcade' }],
      hills: [], gusts: [], rugs: [], balls: random() < 0.5 ? [{ at: ballAt }] : [], blooms: spread(6, 29, 4, random), fork: null,
      places: [{ at: 0, id: 'startLine' }, { at: 9, id: 'firstArch' }, { at: 17, id: 'lightPool' }, { at: 25, id: 'lastArch' }, { at: 33, id: 'flower' }],
    };
  }
  if (id === 'gustAlley') {
    // Three gusts, never three of a kind, with the ramp in the gap after the second.
    const patterns = [[HEAD, TAIL, HEAD], [TAIL, HEAD, HEAD], [HEAD, HEAD, TAIL], [TAIL, HEAD, TAIL]] as const;
    const pushes = patterns[Math.floor(random() * patterns.length)];
    const a = 9 + shift(1.5), b = 22 + shift(1.5), ramp = half(b + 9.5 + shift(1)), c = ramp + 9 + shift(1.5);
    const gusts: Gust[] = [{ from: a, to: a + 8, push: pushes[0] }, { from: b, to: b + 7.5, push: pushes[1] }, { from: c, to: c + 8, push: pushes[2] }];
    const hill: Hill = { from: ramp, up: 2.2, flat: 0, height: 0.6, kick: 0.27 };
    return {
      id, seed, start: 2, goal: 58, cushion: 62, length: 72, zones: [{ from: -40, to: 6, kind: 'arcade' }, { from: 6, to: 72, kind: 'terrace' }],
      hills: [hill], gusts, rugs: [], balls: [], blooms: spread(5, 54, 5, random, [[ramp - 1.5, ramp + 8]]), fork: null,
      places: [{ at: 0, id: 'startLine' }, { at: a, id: 'flagRow' }, { at: b, id: 'fernRow' }, { at: ramp, id: 'ramp' }, { at: c, id: 'flagRow' }, { at: 58, id: 'flower' }],
    };
  }
  if (id === 'longCourse') {
    const fork = 13, plank: Hill = { from: 15, up: 3, flat: 7, height: 0.9, kick: 0.2, line: 'high' };
    const firstHead = random() < 0.5;
    const g1 = 37 + shift(1), g2 = 49 + shift(1), ramp = half(60.5 + shift(1.5)), g3 = ramp + 8.5 + shift(1);
    const gusts: Gust[] = [{ from: g1, to: g1 + 8, push: firstHead ? HEAD : TAIL }, { from: g2, to: g2 + 8, push: firstHead ? TAIL : HEAD }, { from: g3, to: g3 + 7, push: HEAD }];
    const hill: Hill = { from: ramp, up: 2.4, flat: 0, height: 0.7, kick: 0.29 };
    return {
      id, seed, start: 2, goal: 86, cushion: 90, length: 100, zones: [{ from: -40, to: 44, kind: 'terrace' }, { from: 44, to: 100, kind: 'arcade' }],
      hills: [plank, hill], gusts, rugs: [{ from: 17, to: 24.5, line: 'low' }], balls: [{ at: 27.5 + shift(1), line: 'low' }],
      blooms: spread(5, 82, 5.5, random, [[12, 35], [ramp - 1.5, ramp + 8]]), fork: { at: fork, rejoin: 35 },
      places: [{ at: 0, id: 'startLine' }, { at: fork, id: 'signpost' }, { at: 15, id: 'plank' }, { at: 35, id: 'fernRow' }, { at: g1, id: 'flagRow' }, { at: ramp, id: 'ramp' }, { at: g3, id: 'lastArch' }, { at: 86, id: 'flower' }],
    };
  }
  // The Sun Arches: one long gallery, a tailwind, and the big ramp into the light.
  const ramp = 24 + shift(1);
  return {
    id, seed, start: 2, goal: 52, cushion: 57, length: 66, zones: [{ from: -40, to: 66, kind: 'arcade' }],
    hills: [{ from: ramp, up: 4.4, flat: 0, height: 1.25, kick: 0.3 }], gusts: [{ from: 10, to: 21, push: TAIL }], rugs: [], balls: [],
    blooms: spread(5, 22, 2.5, random).concat(spread(40, 50, 2.5, random)), fork: null,
    places: [{ at: 0, id: 'startLine' }, { at: 10, id: 'firstArch' }, { at: ramp, id: 'ramp' }, { at: ramp + 12, id: 'lightPool' }, { at: 45, id: 'lastArch' }, { at: 52, id: 'flower' }],
  };
}
/** The four courses of one play. */
export function buildPlay(seed: number): Course[] { return CHAPTERS.map(id => buildCourse(id, seed)); }

/** The daylight of a play (scenery only; the physics never changes with it). */
export const DAYLIGHTS = ['morning', 'noon', 'goldenHour'] as const;
export type Daylight = typeof DAYLIGHTS[number];
export function daylight(seed: number): Daylight {
  const s = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0;
  return DAYLIGHTS[s % DAYLIGHTS.length];
}

/** The floor under `x` on a line: its height, its slope, and which ramp it is (-1 for the flat). */
export function groundAt(course: Course, x: number, line: Line): { h: number; slope: number; hill: number } {
  for (let i = 0; i < course.hills.length; i++) {
    const hill = course.hills[i];
    if (hill.line && hill.line !== line) continue;
    if (x < hill.from || x > hill.from + hill.up + hill.flat) continue;
    if (x < hill.from + hill.up) return { h: (x - hill.from) / hill.up * hill.height, slope: hill.height / hill.up, hill: i };
    return { h: hill.height, slope: 0, hill: i };
  }
  return { h: 0, slope: 0, hill: -1 };
}
/** The gust blowing at `x`: its push (0 in still air) and its index (-1). */
export function gustAt(course: Course, x: number): { push: number; index: number } {
  for (let i = 0; i < course.gusts.length; i++) { const g = course.gusts[i]; if (x >= g.from && x <= g.to) return { push: g.push, index: i }; }
  return { push: 0, index: -1 };
}
/** The named place a Rover stopped at `x` has reached: the last one its nose passed. */
export function placeReached(course: Course, x: number): PlaceId {
  let id = course.places[0].id;
  for (const place of course.places) if (place.at <= x + ROVER_HALF + 0.5) id = place.id;
  return id;
}
/** Which zone of the building `x` is in. */
export function zoneAt(course: Course, x: number): ZoneKind {
  for (const zone of course.zones) if (x >= zone.from && x < zone.to) return zone.kind;
  return course.zones[course.zones.length - 1].kind;
}

/* ---------- the run ---------- */

export type RunEventKind = 'fork' | 'ramp' | 'air' | 'apex' | 'land' | 'rollback' | 'gust' | 'calm' | 'rug' | 'ball' | 'bloom' | 'goal' | 'cushion' | 'stop';
export interface RunEvent { kind: RunEventKind; t: number; x: number; /** bloom: its index; gust: its push; land: how hard; air: the speed. */ value: number }
export interface RunInput { lean: boolean; line: Line }
export interface RunState {
  t: number;
  /** Rover's middle along the course, its speed, its height above the floor and its climb rate. */
  x: number; v: number; y: number; vy: number;
  air: boolean;
  /** Energy still in the spring, and what it was wound to. */
  energy: number; wound: number;
  line: Line; lineLocked: boolean;
  lean: boolean;
  /** The push of the gust Rover is in (0 in still air) and its index. */
  gust: number; gustIndex: number;
  onRug: boolean;
  /** The ramp under the wheels (-1 on the flat), and the body's tilt, nose up positive (radians). */
  hill: number; pitch: number;
  balls: { x: number; v: number; hit: boolean; line?: Line }[];
  nextBloom: number;
  /** The furthest the nose has been. */
  reach: number;
  goal: boolean; cushioned: boolean; rolledBack: boolean; apexed: boolean;
  still: number;
  done: boolean;
}

/** Rover at rest at `x`, the spring wound `clicks` clicks, about to be let go.
 * `balls` carries on from the last run of the chapter (a nudged ball stays where it rolled). */
export function startRun(course: Course, x: number, clicks: number, line: Line = 'low', balls?: RunState['balls']): RunState {
  const at = Math.max(ROVER_HALF, Number.isFinite(x) ? x : course.start);
  const locked = !!course.fork && at > course.fork.at && at < course.fork.rejoin;
  const ground = groundAt(course, at, line);
  let nextBloom = 0;
  while (nextBloom < course.blooms.length && course.blooms[nextBloom] <= at + ROVER_HALF) nextBloom++;
  return {
    t: 0, x: at, v: 0, y: ground.h, vy: 0, air: false, energy: springEnergy(clicks), wound: springEnergy(clicks), line, lineLocked: locked, lean: false,
    gust: 0, gustIndex: -1, onRug: false, hill: ground.hill, pitch: Math.atan(ground.slope),
    balls: balls ? balls.map(ball => ({ ...ball, v: 0 })) : course.balls.map(ball => ({ x: ball.at, v: 0, hit: false, line: ball.line })),
    nextBloom, reach: at + ROVER_HALF, goal: at + ROVER_HALF >= course.goal, cushioned: false, rolledBack: false, apexed: false, still: 0, done: false,
  };
}

const BALL_ROLLING = 3;
/** The spring's turns still to give, 0..MAX_CLICKS (the key spins back as it unwinds). */
export function turnsLeft(run: RunState): number { return run.energy / CLICK_ENERGY; }

/** One fixed step (STEP seconds) of a run. Mutates `run`; pushes what happened onto `events`. */
export function stepRun(course: Course, run: RunState, input: RunInput, events: RunEvent[] = []): RunState {
  if (run.done) return run;
  const say = (kind: RunEventKind, value = 0) => { events.push({ kind, t: run.t, x: run.x, value }); };
  run.lean = !!input.lean;
  // The signpost can be turned until Rover's nose reaches it.
  if (!run.lineLocked) run.line = input.line === 'high' ? 'high' : 'low';
  const wasX = run.x;

  const gust = gustAt(course, run.x);
  if (gust.index !== run.gustIndex) { if (gust.index >= 0) say('gust', gust.push); else say('calm'); run.gustIndex = gust.index; }
  run.gust = gust.push;
  const blow = (speed: number) => {
    if (gust.push < 0) return gust.push * (run.lean ? LEAN_HEAD : 1) * Math.min(1, Math.max(0, speed) / 3);
    if (gust.push > 0) return speed > 0.3 ? gust.push * (run.lean ? LEAN_TAIL : 1) : 0;
    return 0;
  };

  if (run.air) {
    run.v = Math.max(0.3, run.v + blow(run.v) * AIR_WIND * STEP);
    const climbing = run.vy > 0;
    run.vy -= AIR_GRAVITY * STEP;
    if (climbing && run.vy <= 0 && !run.apexed) { run.apexed = true; say('apex', run.y); }
    run.y += run.vy * STEP; run.x += run.v * STEP;
    run.pitch = Math.atan2(run.vy, Math.max(1, run.v)) * 0.6;
    const ground = groundAt(course, run.x, run.line);
    if (run.y <= ground.h) {
      const impact = -run.vy;
      run.y = ground.h; run.vy = 0; run.air = false; run.v *= 0.96; run.hill = ground.hill;
      say('land', impact);
    }
  } else {
    const ground = groundAt(course, run.x, run.line);
    let onRug = false;
    for (const rug of course.rugs) if ((!rug.line || rug.line === run.line) && run.x >= rug.from && run.x <= rug.to) onRug = true;
    if (onRug && !run.onRug) say('rug');
    run.onRug = onRug;
    const drive = run.v >= 0 ? DRIVE_RATE * run.energy : 0;
    const gravity = -GRAVITY * ground.slope;
    const depth = run.x + ROVER_HALF - course.cushion;
    // The cushion only pushes while it is being squashed: it takes Rover's speed and keeps it.
    const cushion = depth > 0 && run.v > 0 ? -CUSHION_K * depth - CUSHION_DAMP * run.v : 0;
    const air = blow(run.v);
    const push = drive + gravity + cushion + air;
    const rolling = ROLLING * (onRug ? RUG_DRAG : 1);
    let a: number;
    if (Math.abs(run.v) < 1e-9) a = Math.abs(push) <= STATIC ? 0 : push - Math.sign(push) * rolling;
    else a = push - Math.sign(run.v) * rolling;
    let next = run.v + a * STEP;
    // Friction slows Rover to a stop; it never turns it round.
    if (run.v !== 0 && Math.sign(next) !== Math.sign(run.v) && Math.abs(drive + gravity + cushion) <= STATIC) next = 0;
    // Neither a headwind nor the cushion ever throws Rover back.
    if (run.v > 0 && next < 0 && gravity === 0) next = 0;
    const dx = next * STEP;
    // The spring gives up what it pushed through; with the wheels still or
    // rolling back (the clutch slipping) the rest of it lets go freely.
    if (dx > 0) run.energy = Math.max(0, run.energy - drive * dx);
    if ((next <= 0 && run.t > 0.25) || depth > 0) run.energy *= Math.exp(-4 * STEP);
    if (run.energy < 0.01) run.energy = 0;
    run.x += dx; run.v = next;
    // The start block: rolling back, the tail taps it and Rover stops there.
    if (run.x < ROVER_HALF && run.v < 0) { run.x = ROVER_HALF; run.v = 0; }
    if (run.v < -0.2 && !run.rolledBack) { run.rolledBack = true; say('rollback'); }

    const now = groundAt(course, run.x, run.line);
    if (ground.hill >= 0 && now.hill !== ground.hill && run.v > 0 && run.x > wasX) {
      // Off the lip: Rover keeps its speed and climbs at the ramp's kick.
      const hill = course.hills[ground.hill];
      run.air = true; run.apexed = false; run.y = hill.height; run.vy = run.v * hill.kick; run.hill = -1;
      say('air', run.v);
    } else {
      if (now.hill >= 0 && run.hill !== now.hill && run.v > 0) say('ramp');
      run.hill = now.hill; run.y = now.h; run.pitch = Math.atan(now.slope);
    }
  }

  const nose = run.x + ROVER_HALF;
  if (course.fork) {
    if (!run.lineLocked && wasX + ROVER_HALF < course.fork.at && nose >= course.fork.at) { run.lineLocked = true; say('fork', run.line === 'high' ? 1 : 0); }
    else if (run.lineLocked && (run.x >= course.fork.rejoin || nose < course.fork.at) && !run.air) run.lineLocked = false;
  }
  for (const ball of run.balls) {
    // One nudge: the ball rolls on ahead and off toward the side, out of Rover's way.
    if (!ball.hit && !run.air && run.v > 0 && (!ball.line || ball.line === run.line) && nose >= ball.x - 0.25 && run.x < ball.x) {
      ball.hit = true; ball.v = run.v * 1.25; run.v *= 0.9; say('ball');
    }
    if (ball.v > 0) { ball.v = Math.max(0, ball.v - BALL_ROLLING * STEP); ball.x += ball.v * STEP; }
  }
  while (run.nextBloom < course.blooms.length && course.blooms[run.nextBloom] <= nose) { say('bloom', run.nextBloom); run.nextBloom++; }
  if (!run.goal && nose >= course.goal) { run.goal = true; say('goal'); }
  if (!run.cushioned && nose > course.cushion) { run.cushioned = true; say('cushion'); }
  run.reach = Math.max(run.reach, nose);
  run.t += STEP;

  if (!run.air) {
    const ground = groundAt(course, run.x, run.line);
    const depth = nose - course.cushion;
    const held = Math.abs(-GRAVITY * ground.slope + (run.v >= 0 ? DRIVE_RATE * run.energy : 0) + (depth > 0 && run.v > 0 ? -CUSHION_K * depth : 0)) <= STATIC;
    const resting = Math.abs(run.v) < 0.03 && (held || depth > 0);
    run.still = resting && (run.t > 0.2 || run.wound === 0) ? run.still + STEP : 0;
  } else run.still = 0;
  if (run.still >= 0.15 || run.t >= MAX_RUN_SECONDS) {
    run.v = 0; run.energy = 0; run.done = true; say('stop');
  }
  return run;
}

/** A whole run, start to rest, with a pilot deciding the touches (tests and tuning only). */
export function rollOut(course: Course, x: number, clicks: number, pilot: (run: RunState) => Partial<RunInput> = () => ({}), line: Line = 'low'): { run: RunState; events: RunEvent[] } {
  const run = startRun(course, x, clicks, line), events: RunEvent[] = [];
  let guard = Math.ceil(MAX_RUN_SECONDS / STEP) + 10;
  while (!run.done && guard-- > 0) { const touch = pilot(run); stepRun(course, run, { lean: !!touch.lean, line: touch.line ?? line }, events); }
  return { run, events };
}
/** A pilot who leans into every headwind and sits up for every tailwind. */
export const steadyPilot = (run: RunState): Partial<RunInput> => ({ lean: run.gust < 0 });

/** The fewest clicks that carry Rover from the start to the flower in one run
 * (tests only: the game never shows it), or null when one run cannot. */
export function minimumClicks(course: Course, pilot = steadyPilot, line: Line = 'low'): number | null {
  for (let clicks = 0; clicks <= MAX_CLICKS; clicks++) if (rollOut(course, course.start, clicks, pilot, line).run.goal) return clicks;
  return null;
}

/** Wheel turn (radians) for a distance rolled. */
export function wheelAngle(x: number): number { return x / WHEEL_R; }
/** The chapter after this one (0..3), or null after the set-piece. */
export function nextChapter(index: number): number | null {
  const i = Number.isFinite(index) ? Math.trunc(index) : 0;
  return i + 1 < CHAPTERS.length ? Math.max(0, i + 1) : null;
}
