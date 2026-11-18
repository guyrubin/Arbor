/** Pep's Trail rules (activity id `fox-trail`): a side-scrolling run. Pep, the
 * valley's Boston terrier scout, runs by himself from the Sky Gardens over the
 * Glass Grove skybridge and across the Reflection Basin to Horizon Dome; the
 * child jumps (a tap, or a held tap for a longer jump) and rolls (a swipe down).
 *
 * Pure: no React, no DOM, no timers, no `Math.random` (a course comes from a
 * seed). The component runs `step` on a fixed timestep and draws what it
 * returns. Units are world units: x runs left to right along the trail in both
 * languages, y is the height of Pep's feet above the path.
 *
 * Nothing here can fail. There is no timer, no score and no way to get hurt:
 * a planter that is not jumped is a soft bounce over it, a line of bunting
 * that is not rolled under is a flop through the cloth, a gap in the float
 * pads is a splash and a paddle. All that changes is which lamps Pep lights on
 * the way (every lamp comes on at the Dome in the end) and how far the run of
 * rising notes gets before it starts again. */

export const STEP_DT = 1 / 120;

/* ── Pep ── */
/** How much of Pep counts against a hurdle, either side of his middle. */
export const PEP_HALF = 18;
/** His height standing, tucked into a roll, and where his middle is. */
export const PEP_TALL = 104;
export const PEP_LOW = 54;
export const PEP_MID = 50;
export const JUMP_V = 600;
/** Rising with the tap still held is floaty; let go and the jump is cut short. */
export const GRAV_HELD = 1050;
export const GRAV_UP = 2100;
export const GRAV_DOWN = 2300;
/** Even the quickest tap counts as held this long, so a tap is a real hop. */
export const MIN_HOLD = 0.1;
export const APEX_BAND = 100;
export const APEX_HANG = 0.6;
/** Forgiveness: a jump still works this long after running off an edge … */
export const COYOTE_T = 0.12;
/** … and a jump or roll asked for this long before it is possible still happens. */
export const JUMP_BUFFER = 0.16;
export const ROLL_BUFFER = 0.18;
export const ROLL_T = 0.7;
/** A swipe down just after take-off turns the hop into a roll. */
export const ROLL_CANCEL_T = 0.2;
export const DIVE_V = -640;
/** The soft bounce that carries Pep over a planter he did not jump. */
export const BOUNCE_V = 520;
export const BUMP_PACE = 0.62;
export const ACCEL = 900;
export const BRAKE = 430;
export const WADE = 0.55;
/** How deep the basin is between the float pads (belly deep). */
export const GAP_DEPTH = 16;
export const CLIMB_V = 400;
/** How high an updraft carries Pep: a tap, and a held tap. */
export const LIFT_CEIL = 215;
export const LIFT_CEIL_HELD = 290;
/** How near a light Pep's middle must pass to wake it. */
export const LIGHT_REACH_X = 46;
export const LIGHT_REACH_Y = 54;
/** The first hurdle of each kind is met in slow motion until the child has made the move once. */
export const LESSON_SLOW = 0.32;

/* ── the course ── */
export type StretchId = 'skyGardens' | 'skyBridge' | 'theBasin';
export const STRETCH_IDS: readonly StretchId[] = ['skyGardens', 'skyBridge', 'theBasin'];
export type HurdleKind = 'planterBox' | 'buntingLine' | 'padGap';
export type LampTier = 'pathLamp' | 'leapLight' | 'skyLight';
export type Move = 'jumpNow' | 'holdNow' | 'rollNow';
/** The air over the valley this sitting (decoration only). */
export type Air = 'stillAir' | 'petalAir' | 'fireflyAir';

export interface Stretch { id: StretchId; from: number; to: number; speed: number; /** Where Pep stops beside the friend who waits at its end. */ station: number }
export interface Hurdle { id: number; kind: HurdleKind; x: number; w: number; h: number; stretch: number; /** A tall planter or a wide gap: a held jump clears it best. */ big: boolean }
export interface Lamp { id: number; tier: LampTier; x: number; y: number; stretch: number; /** The hurdle it stands behind (-1: none). It lights when that hurdle was passed cleanly. */ after: number }
export interface Updraft { id: number; from: number; to: number; stretch: number }
export interface Course {
  seed: number; start: number; length: number;
  stretches: readonly Stretch[]; hurdles: readonly Hurdle[]; lamps: readonly Lamp[]; updrafts: readonly Updraft[];
  /** The secret: a sleepy star high in one updraft, where only a held jump reaches. */
  star: { x: number; y: number };
  air: Air;
  /** The scale step each lamp in a clean chain plays: it climbs, and no two sittings climb alike. */
  tune: readonly number[];
}

export const SPEEDS: Readonly<Record<StretchId, number>> = { skyGardens: 265, skyBridge: 295, theBasin: 320 };
export const START_X = 420;
export const RUN_OUT = 260;
const BEATS_PER_STRETCH = 10;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** mulberry32: the same seed always lays the same course. */
export function seeded(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Draft { hurdles: Hurdle[]; lamps: Lamp[]; updrafts: Updraft[]; stretch: number; lifts: Updraft[] }
const planter = (d: Draft, x: number, big = false) => { d.hurdles.push({ id: d.hurdles.length, kind: 'planterBox', x, w: big ? 60 : 56, h: big ? 62 : 46, stretch: d.stretch, big }); return d.hurdles.length - 1; };
const bunting = (d: Draft, x: number) => { d.hurdles.push({ id: d.hurdles.length, kind: 'buntingLine', x, w: 150, h: 96, stretch: d.stretch, big: false }); return d.hurdles.length - 1; };
const gap = (d: Draft, x: number, big = false) => { d.hurdles.push({ id: d.hurdles.length, kind: 'padGap', x, w: big ? 200 : 100, h: GAP_DEPTH, stretch: d.stretch, big }); return d.hurdles.length - 1; };
const lamp = (d: Draft, x: number, after = -1) => { d.lamps.push({ id: 0, tier: 'pathLamp', x, y: 78, stretch: d.stretch, after }); };
const light = (d: Draft, x: number, y: number, tier: LampTier = 'leapLight') => { d.lamps.push({ id: 0, tier, x, y, stretch: d.stretch, after: -1 }); };
const updraft = (d: Draft, from: number, to: number) => { const u = { id: d.updrafts.length, from, to, stretch: d.stretch }; d.updrafts.push(u); d.lifts.push(u); };

/** A beat: a short authored phrase of the trail. It lays its things from `x` and says how long it is. */
type Beat = (d: Draft, x: number) => number;
const BEATS: Readonly<Record<StretchId, Readonly<Record<string, Beat>>>> = {
  skyGardens: {
    stroll: (d, x) => { lamp(d, x + 190); lamp(d, x + 430); return 580; },
    oneHop: (d, x) => { const h = planter(d, x + 270); light(d, x + 270, 132); lamp(d, x + 420, h); return 620; },
    twoHops: (d, x) => { const a = planter(d, x + 250); lamp(d, x + 390, a); const b = planter(d, x + 590); lamp(d, x + 730, b); return 900; },
    tallHop: (d, x) => { const h = planter(d, x + 290, true); light(d, x + 290, 172); lamp(d, x + 450, h); return 660; },
    hopHigh: (d, x) => { const h = planter(d, x + 260); light(d, x + 240, 120); light(d, x + 330, 150); lamp(d, x + 430, h); return 640; },
  },
  skyBridge: {
    oneSag: (d, x) => { const h = bunting(d, x + 320); lamp(d, x + 520, h); return 720; },
    upLift: (d, x) => { updraft(d, x + 230, x + 560); light(d, x + 370, 290, 'skyLight'); light(d, x + 450, 298, 'skyLight'); light(d, x + 530, 290, 'skyLight'); lamp(d, x + 700); return 860; },
    hopSag: (d, x) => { const a = planter(d, x + 250); lamp(d, x + 390, a); const b = bunting(d, x + 640); lamp(d, x + 840, b); return 1020; },
    sagHop: (d, x) => { const a = bunting(d, x + 300); lamp(d, x + 500, a); const b = planter(d, x + 720); light(d, x + 720, 132); lamp(d, x + 860, b); return 1040; },
    twoSags: (d, x) => { const a = bunting(d, x + 300); lamp(d, x + 480, a); const b = bunting(d, x + 740); lamp(d, x + 930, b); return 1100; },
  },
  theBasin: {
    oneSkip: (d, x) => { const h = gap(d, x + 300); light(d, x + 300, 118); lamp(d, x + 450, h); return 640; },
    threeSkips: (d, x) => { let h = 0; for (let i = 0; i < 3; i++) { h = gap(d, x + 280 + i * 290); light(d, x + 280 + i * 290, 118); } lamp(d, x + 1000, h); return 1180; },
    longSkip: (d, x) => { const h = gap(d, x + 360, true); light(d, x + 300, 150, 'skyLight'); light(d, x + 360, 184, 'skyLight'); light(d, x + 420, 150, 'skyLight'); lamp(d, x + 590, h); return 780; },
    sagPad: (d, x) => { const h = bunting(d, x + 320); lamp(d, x + 520, h); return 720; },
    skipSag: (d, x) => { gap(d, x + 280); light(d, x + 280, 118); const b = bunting(d, x + 640); lamp(d, x + 840, b); return 1020; },
    liftPad: (d, x) => { updraft(d, x + 230, x + 540); const h = gap(d, x + 390, true); light(d, x + 370, 290, 'skyLight'); light(d, x + 450, 298, 'skyLight'); light(d, x + 530, 290, 'skyLight'); lamp(d, x + 700, h); return 860; },
  },
};
/** How each stretch opens (the lesson first), and what it must hold at least once. */
const OPENERS: Readonly<Record<StretchId, readonly string[]>> = { skyGardens: ['stroll', 'oneHop'], skyBridge: ['oneSag', 'upLift'], theBasin: ['oneSkip', 'threeSkips'] };
const MUSTS: Readonly<Record<StretchId, readonly string[]>> = { skyGardens: ['tallHop', 'twoHops'], skyBridge: ['upLift', 'hopSag'], theBasin: ['longSkip', 'sagPad'] };

export function buildCourse(seed: number): Course {
  const random = seeded(seed);
  const d: Draft = { hurdles: [], lamps: [], updrafts: [], stretch: 0, lifts: [] };
  const stretches: Stretch[] = [];
  let x = START_X + 260;
  STRETCH_IDS.forEach((id, index) => {
    d.stretch = index;
    const from = index === 0 ? 0 : x - RUN_OUT * 0.5;
    const names = Object.keys(BEATS[id]);
    const plan = [...OPENERS[id]];
    const musts = [...MUSTS[id]];
    while (plan.length < BEATS_PER_STRETCH) {
      const left = BEATS_PER_STRETCH - plan.length;
      const choices = (musts.length >= left ? musts : names).filter(name => name !== plan[plan.length - 1] && (name !== 'stroll' || plan.length > 3));
      const name = choices[Math.floor(random() * choices.length)] ?? names[0];
      const at = musts.indexOf(name); if (at >= 0) musts.splice(at, 1);
      plan.push(name);
    }
    for (const name of plan) x += BEATS[id][name](d, x) + Math.floor(random() * 5) * 20;
    const station = x + 190;
    stretches.push({ id, from, to: station + RUN_OUT * 0.5, speed: SPEEDS[id], station });
    x = station + RUN_OUT + 180;
  });
  const lamps = d.lamps.slice().sort((a, b) => a.x - b.x).map((l, id) => ({ ...l, id }));
  // The star sleeps over a skybridge updraft, a different one from sitting to sitting.
  const lifts = d.lifts.filter(u => u.stretch === 1);
  const home = lifts[Math.floor(random() * lifts.length)] ?? d.updrafts[0];
  const star = { x: (home.from + home.to) / 2 + 10, y: 404 };
  const air: Air = (['stillAir', 'petalAir', 'fireflyAir'] as const)[Math.floor(random() * 3)];
  // A climbing tune: mostly a step up, now and then a skip or a turn back, never off the scale's top.
  const tune: number[] = []; let note = 5;
  for (let i = 0; i < 16; i++) { tune.push(note); const r = random(); note += r < 0.62 ? 1 : r < 0.84 ? 2 : -1; if (note > 17) note = 9 + Math.floor(random() * 3); if (note < 5) note = 6; }
  const last = stretches[stretches.length - 1];
  return { seed, start: START_X, length: last.station, stretches, hurdles: d.hurdles, lamps, updrafts: d.updrafts, star, air, tune };
}

/* ── the ground ── */
/** The hurdle whose span (with `pad` either side) holds x; -1 when none does. */
export function hurdleAt(course: Course, x: number, kind: HurdleKind, pad = 0): number {
  for (const h of course.hurdles) { if (h.kind === kind && Math.abs(x - h.x) < h.w / 2 + pad) return h.id; if (h.x - h.w > x) break; }
  return -1;
}
/** What Pep's feet find at x: the path, or the basin's water between two float pads. */
export function floorAt(course: Course, x: number): number { return hurdleAt(course, x, 'padGap') >= 0 ? -GAP_DEPTH : 0; }
export function updraftAt(course: Course, x: number): number { return course.updrafts.findIndex(u => x >= u.from && x <= u.to); }
export function stretchAt(course: Course, x: number): number {
  for (let i = course.stretches.length - 1; i >= 0; i--) if (x >= course.stretches[i].from) return i;
  return 0;
}

/* ── the state ── */
export type RunMode = 'atStart' | 'onTheRun' | 'slowingIn' | 'atStation' | 'atHome';
export type RunEventKind = 'setOff' | 'jumpUp' | 'touchDown' | 'rollIn' | 'rollOut' | 'diveIn' | 'softBump' | 'waterSplash' | 'climbOut' | 'cleanPass' | 'lampLit' | 'lampWaits' | 'liftOff' | 'starFound' | 'skidIn' | 'stationIn' | 'homeIn' | 'lessonCue';
export interface RunEvent { kind: RunEventKind; id?: number; n?: number }
export interface RunInput {
  /** The tap (or the Jump key) is down now. */
  hold?: boolean;
  /** Edges: the tap went down; a swipe down; the Go button (or a tap while Pep waits). */
  jump?: boolean; roll?: boolean; go?: boolean;
}
export interface RunState {
  t: number; mode: RunMode; stretch: number;
  x: number; y: number; vx: number; vy: number; onGround: boolean;
  airT: number; held: boolean; coyote: number; jumpBuf: number; rollBuf: number;
  /** Seconds of roll left, and whether a dive is on its way down into one. */
  roll: number; dive: boolean;
  /** 1 at full pace; dips after a bump and comes back. */
  pace: number;
  /** In the basin's water now. */
  wading: boolean;
  /** Carried by an updraft now. */
  lifted: boolean;
  /** 1 normally; under 1 while a first hurdle waits for the child's first move of that kind. */
  slow: number;
  learned: Record<Move, boolean>;
  /** Per hurdle: 0 ahead, 1 passed cleanly, 2 bumped. Per lamp: 0 dark, 1 lit, 2 passed dark. */
  hurdles: number[]; lamps: number[];
  nextHurdle: number; nextLamp: number;
  /** Lamps lit in a row since the last bump, and lamps lit in all. */
  chain: number; lit: number; bumps: number;
  star: boolean;
  /** Distance run on the ground: the legs' phase. */
  dist: number;
  rest: number;
  events: RunEvent[];
}

export function initialRun(course: Course): RunState {
  return {
    t: 0, mode: 'atStart', stretch: 0, x: course.start, y: 0, vx: 0, vy: 0, onGround: true,
    airT: 0, held: false, coyote: 0, jumpBuf: 0, rollBuf: 0, roll: 0, dive: false, pace: 1, wading: false, lifted: false, slow: 1,
    learned: { jumpNow: false, holdNow: false, rollNow: false },
    hurdles: course.hurdles.map(() => 0), lamps: course.lamps.map(() => 0), nextHurdle: 0, nextLamp: 0,
    chain: 0, lit: 0, bumps: 0, star: false, dist: 0, rest: 0, events: [],
  };
}

/** What a clean run would do now: the cue for the small keys, the ghost hand
 * and the first-time slow motion. Empty when nothing is due. */
export function suggest(course: Course, s: RunState): Move | '' {
  if (s.mode !== 'onTheRun' || !s.onGround || s.roll > 0.2) return '';
  const v = Math.max(120, s.vx);
  const lift = course.updrafts.find(u => s.x > u.from - 0.12 * v && s.x < u.from + 60);
  const h = course.hurdles[s.nextHurdle];
  if (h && s.hurdles[h.id] === 0) {
    const edge = h.x - h.w / 2;
    if (h.kind === 'padGap') { const ahead = edge - s.x; if (ahead > -4 && ahead < (h.big ? 0.1 : 0.2) * v) return h.big || lift ? 'holdNow' : 'jumpNow'; }
    else if (h.kind === 'planterBox') { const ahead = edge - PEP_HALF - s.x; if (ahead > 0.05 * v && ahead < 0.22 * v) return h.big ? 'holdNow' : 'jumpNow'; }
    else { const ahead = edge - PEP_HALF - s.x; if (ahead > 0 && ahead < 0.42 * v && s.roll <= 0) return 'rollNow'; }
  }
  return lift ? 'holdNow' : '';
}

const approach = (v: number, target: number, rate: number) => v < target ? Math.min(target, v + rate) : Math.max(target, v - rate);

export function step(course: Course, prev: RunState, input: RunInput = {}, dtReal: number = STEP_DT): RunState {
  const s: RunState = { ...prev, learned: { ...prev.learned }, hurdles: prev.hurdles, lamps: prev.lamps, events: [] };
  const ev = s.events;
  const mark = (list: 'hurdles' | 'lamps', id: number, value: number) => { if (s[list] === prev[list]) s[list] = prev[list].slice(); s[list][id] = value; };

  // Waiting: at the start, and beside a friend at a station. Go (or any tap) sets Pep off.
  if (s.mode === 'atStart' || s.mode === 'atStation') {
    s.t += dtReal; s.rest += dtReal;
    if (input.go || (input.jump && s.rest > 0.5)) {
      if (s.mode === 'atStation') s.stretch = Math.min(course.stretches.length - 1, s.stretch + 1);
      s.mode = 'onTheRun'; s.rest = 0; ev.push({ kind: 'setOff', n: s.stretch });
    }
    return s;
  }
  if (s.mode === 'atHome') { s.t += dtReal; s.rest += dtReal; return s; }

  // The first planter, bunting and gap come in slow motion until the child has made that move once.
  const due = suggest(course, s);
  const lesson = due !== '' && !s.learned[due === 'holdNow' ? 'jumpNow' : due];
  if (lesson && prev.slow === 1) ev.push({ kind: 'lessonCue', n: due === 'rollNow' ? 1 : 0 });
  s.slow = lesson ? LESSON_SLOW : 1;
  const dt = dtReal * s.slow;
  s.t += dtReal;
  const stretch = course.stretches[s.stretch];

  s.jumpBuf = input.jump ? JUMP_BUFFER : Math.max(0, s.jumpBuf - dtReal);
  s.rollBuf = input.roll ? ROLL_BUFFER : Math.max(0, s.rollBuf - dtReal);
  if (!s.onGround) s.coyote = Math.max(0, s.coyote - dt);

  // Pace: the stretch's speed, a dip after a bump, a paddle in the water, a skid in to the station.
  s.pace = Math.min(1, s.pace + (1 - s.pace) * dt * 1.7 + dt * 0.05);
  if (s.mode === 'onTheRun' && s.x >= stretch.station - (s.vx * s.vx) / (2 * BRAKE) - 4) { s.mode = 'slowingIn'; ev.push({ kind: 'skidIn', n: s.stretch }); }
  if (s.mode === 'slowingIn') s.vx = Math.max(0, s.vx - BRAKE * dt);
  else s.vx = approach(s.vx, stretch.speed * s.pace * (s.wading ? WADE : 1), ACCEL * dt);

  // Roll: on the ground a tucked tumble; just after take-off it replaces the hop; higher up it is a dive.
  const sagHere = hurdleAt(course, s.x, 'buntingLine', PEP_HALF);
  if (s.rollBuf > 0 && s.roll <= 0 && !s.dive && s.mode === 'onTheRun') {
    s.rollBuf = 0; s.learned.rollNow = true;
    if (s.onGround) { s.roll = ROLL_T; ev.push({ kind: 'rollIn' }); }
    else if (s.airT < ROLL_CANCEL_T && s.y < 60 && floorAt(course, s.x) === 0) { s.y = 0; s.vy = 0; s.onGround = true; s.roll = ROLL_T; ev.push({ kind: 'rollIn' }); }
    else { s.dive = true; s.lifted = false; s.vy = Math.min(s.vy, DIVE_V); ev.push({ kind: 'diveIn' }); }
  }
  if (s.roll > 0) {
    s.roll = Math.max(0, s.roll - dt);
    if (sagHere >= 0) s.roll = Math.max(s.roll, 0.12);
    if (s.roll <= 0) ev.push({ kind: 'rollOut' });
  }

  // Jump: from the path, a pad or the water; not from under a line of bunting.
  if (s.jumpBuf > 0 && (s.onGround || s.coyote > 0) && sagHere < 0 && s.mode === 'onTheRun') {
    if (s.roll > 0) { s.roll = 0; ev.push({ kind: 'rollOut' }); }
    s.vy = JUMP_V; s.onGround = false; s.coyote = 0; s.jumpBuf = 0; s.airT = 0; s.held = true; s.wading = false;
    s.learned.jumpNow = true; if (due === 'holdNow') s.learned.holdNow = true;
    ev.push({ kind: 'jumpUp' });
  }

  const x0 = s.x;
  s.x = Math.min(course.length, s.x + s.vx * dt);
  if (s.onGround && s.roll <= 0) s.dist += s.x - x0;

  // Up and down.
  const floor = floorAt(course, s.x);
  if (!s.onGround) {
    s.airT += dt;
    if (!input.hold && s.airT >= MIN_HOLD) s.held = false;
    const lift = !s.dive && updraftAt(course, s.x) >= 0;
    if (lift) {
      if (!s.lifted) ev.push({ kind: 'liftOff' });
      // The updraft carries him up to its ceiling and holds him there like a kite.
      const ceil = s.held ? LIFT_CEIL_HELD : LIFT_CEIL;
      s.vy += ((ceil - s.y) * 16 - s.vy * 5.5) * dt;
    } else {
      const g = s.vy > 0 ? (s.held ? GRAV_HELD : GRAV_UP) : GRAV_DOWN * (Math.abs(s.vy) < APEX_BAND && !s.dive ? APEX_HANG : 1);
      s.vy -= g * dt;
    }
    s.lifted = lift;
    s.y += s.vy * dt;
    if (s.y <= floor && s.vy <= 0) {
      s.y = floor; s.vy = 0; s.onGround = true; s.lifted = false; s.airT = 0;
      if (floor < 0) {
        const g = hurdleAt(course, s.x, 'padGap');
        s.wading = true; s.dive = false; s.roll = 0;
        if (g >= 0 && s.hurdles[g] === 0) { mark('hurdles', g, 2); s.chain = 0; s.bumps += 1; s.pace = Math.min(s.pace, 0.8); }
        ev.push({ kind: 'waterSplash', id: g });
      } else {
        if (s.dive) { s.dive = false; s.roll = ROLL_T * 0.8; ev.push({ kind: 'rollIn' }); }
        ev.push({ kind: 'touchDown' });
      }
    }
  } else if (floor < s.y - 4) {
    // Ran off the edge of a float pad: a moment of grace, then the water.
    s.onGround = false; s.vy = 0; s.coyote = COYOTE_T; s.airT = ROLL_CANCEL_T; s.held = false;
  } else if (floor > s.y + 4) {
    // The far side of a gap: Pep scrambles out by himself.
    s.vy = CLIMB_V; s.onGround = false; s.airT = MIN_HOLD; s.held = false; s.wading = false; ev.push({ kind: 'climbOut' });
  } else s.y = floor;

  // Hurdles.
  for (let guard = 0; guard < 4; guard++) {
    const h = course.hurdles[s.nextHurdle];
    if (!h) break;
    const pad = h.kind === 'padGap' ? 0 : PEP_HALF;
    if (s.hurdles[h.id] === 2) { if (s.x > h.x + h.w / 2 + pad) { s.nextHurdle += 1; continue; } break; }
    if (s.x > h.x + h.w / 2 + pad) { mark('hurdles', h.id, 1); s.nextHurdle += 1; ev.push({ kind: 'cleanPass', id: h.id }); continue; }
    if (s.x < h.x - h.w / 2 - pad) break;
    if (h.kind === 'planterBox' && s.y < h.h - 12) {
      // Not jumped: the planter's rim is a springboard. Up and over, with a laugh.
      mark('hurdles', h.id, 2); s.vy = Math.max(s.vy, BOUNCE_V); s.y = Math.max(s.y, 6); s.onGround = false; s.airT = MIN_HOLD; s.held = false; s.roll = 0; s.dive = false;
      s.pace = BUMP_PACE; s.chain = 0; s.bumps += 1; ev.push({ kind: 'softBump', id: h.id });
    } else if (h.kind === 'buntingLine' && s.roll <= 0 && s.y + PEP_TALL > h.h) {
      // Not rolled: the cloth flops over him and he tumbles through underneath.
      mark('hurdles', h.id, 2); s.roll = ROLL_T; s.dive = false; if (!s.onGround) s.vy = Math.min(s.vy, DIVE_V * 0.6);
      s.pace = BUMP_PACE + 0.1; s.chain = 0; s.bumps += 1; ev.push({ kind: 'softBump', id: h.id });
    }
    break;
  }

  // Lamps and lights.
  for (let j = s.nextLamp; j < course.lamps.length; j++) {
    const l = course.lamps[j];
    if (l.x - LIGHT_REACH_X - 20 > s.x) break;
    if (s.lamps[j] !== 0) continue;
    if (l.tier === 'pathLamp') {
      if (s.x < l.x - 12) continue;
      if (l.after < 0 || s.hurdles[l.after] === 1) { mark('lamps', j, 1); s.chain += 1; s.lit += 1; ev.push({ kind: 'lampLit', id: j, n: s.chain }); }
      else { mark('lamps', j, 2); ev.push({ kind: 'lampWaits', id: j }); }
    } else if (Math.abs(s.x - l.x) < LIGHT_REACH_X && Math.abs(s.y + PEP_MID - l.y) < LIGHT_REACH_Y) {
      mark('lamps', j, 1); s.chain += 1; s.lit += 1; ev.push({ kind: 'lampLit', id: j, n: s.chain });
    } else if (s.x > l.x + LIGHT_REACH_X) mark('lamps', j, 2);
  }
  while (s.nextLamp < course.lamps.length && s.lamps[s.nextLamp] !== 0) s.nextLamp += 1;

  // The secret.
  if (!s.star && Math.abs(s.x - course.star.x) < 56 && Math.abs(s.y + PEP_MID - course.star.y) < 72) { s.star = true; ev.push({ kind: 'starFound' }); }

  // Stopped beside a friend.
  if (s.mode === 'slowingIn' && s.vx <= 0 && s.onGround) {
    s.vx = 0; s.roll = 0; s.rest = 0;
    if (s.stretch >= course.stretches.length - 1) { s.mode = 'atHome'; ev.push({ kind: 'homeIn' }); }
    else { s.mode = 'atStation'; ev.push({ kind: 'stationIn', n: s.stretch }); }
  }
  return s;
}

/** Run fixed steps for `seconds` (tests). `pilot` decides the input before each step. */
export function run(course: Course, state: RunState, pilot: (s: RunState, course: Course) => RunInput, seconds: number): RunState {
  let s = state; const events: RunEvent[] = [];
  const n = Math.round(seconds / STEP_DT);
  for (let i = 0; i < n; i++) { s = step(course, s, pilot(s, course), STEP_DT); if (s.events.length) events.push(...s.events); }
  return { ...s, events };
}
/** A pilot that plays the course cleanly by following `suggest` (tests, and the proof that a clean run exists). */
export function cleanPilot(): (s: RunState, course: Course) => RunInput {
  let holding = 0;
  return (s, course) => {
    if (s.mode === 'atStart' || s.mode === 'atStation') return { go: true };
    const due = suggest(course, s);
    if (due === 'rollNow') return { roll: true };
    if (due === 'holdNow') { holding = 1.1; return { jump: true, hold: true }; }
    if (due === 'jumpNow') { holding = 0; return { jump: true, hold: true }; }
    holding = Math.max(0, holding - STEP_DT);
    return { hold: holding > 0 && !s.onGround };
  };
}
/** A pilot that never touches the screen once Pep is off: he still gets home. */
export const idlePilot = (s: RunState): RunInput => (s.mode === 'atStart' || s.mode === 'atStation' ? { go: true } : {});

/* ── light and camera ── */
/** How far the dusk has deepened: 0 at the start of the run, 1 at the Dome. */
export function duskDepth(course: Course, x: number): number { return clamp((x - course.start) / (course.length - course.start), 0, 1); }
/** How much of its light the valley has back so far (0..1): every lamp Pep lit warms the dusk again. */
export function warmth(course: Course, s: Pick<RunState, 'lit'>): number { return course.lamps.length ? clamp(s.lit / course.lamps.length, 0, 1) : 0; }
/** The camera keeps Pep `lead` of the view from its left edge and never shows before the trail's start. */
export function cameraX(pepX: number, viewW: number, lead: number): number { return Math.max(0, pepX - viewW * lead); }
/** The set-piece's sweep: the camera flies from the Dome back to where the run began (p 0..1, eased). */
export function sweepX(course: Course, viewW: number, lead: number, p: number): number {
  const t = clamp(p, 0, 1), e = t * t * (3 - 2 * t);
  const from = cameraX(course.length, viewW, lead), to = cameraX(course.start, viewW, lead);
  return from + (to - from) * e;
}
/** The note a lamp plays: the chain climbs the sitting's tune. */
export function chainNote(course: Course, chain: number): number { return course.tune[Math.max(0, chain - 1) % course.tune.length]; }
