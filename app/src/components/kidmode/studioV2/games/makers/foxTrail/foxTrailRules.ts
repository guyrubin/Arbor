/** Fox Trail rules. Pure: no React, no DOM, no timers, no randomness. The
 * component runs `step` on a fixed timestep and draws whatever it returns.
 *
 * Units are world units. x runs left → right along the trail (in both
 * languages); `y` is the fox's feet ELEVATION (up is positive) above the
 * bottom of the scene, which is WORLD_H tall. Nothing here can fail: there is
 * no timer, no score and no way to get hurt; the fox simply cannot leave the
 * trail, and the only gate (the hollow oak) opens to a roll. */

export const WORLD_W = 6000;
export const WORLD_H = 540;
export const STEP_DT = 1 / 120;

export const RUN_MAX = 330;
export const TROT_MAX = 235;
/** The push off the mark is strong and eases as the fox nears full speed. */
export const ACCEL = 1500;
export const DECEL = 1700;
/** Turning round at a run: a short skid, then away. */
export const TURN = 2900;
export const WATER_SLOW = 0.55;
export const ROLL_T = 0.6;
export const ROLL_SPEED = 540;
export const ROLL_COOLDOWN = 0.18;
export const GRAVITY = 1900;
/** Coming down is quicker than going up, and the top of an arc hangs a moment. */
export const FALL_GRAVITY = 2500;
export const APEX_BAND = 110;
export const APEX_HANG = 0.55;
export const JUMP_V = 640;
export const HOP_V = 500;
/** Forgiveness: a jump still works this long after running off an edge … */
export const COYOTE_T = 0.12;
/** … and a jump or roll pressed this long before it is possible still happens. */
export const JUMP_BUFFER = 0.14;
export const ROLL_BUFFER = 0.16;
/** Highest rise the fox walks up without hopping. */
export const STEP_UP = 9;
/** Highest wall an automatic hop is tried on (taller is a wall: the hollow oak). */
export const HOP_MAX = 80;
export const SIT_AFTER = 3;
export const MIN_X = 70;
export const MAX_X = WORLD_W - 170;
export const START_X = 200;
export const ROLL_RADIUS = 30;
export const PICK_R = 52;
export const OFFER_RANGE = 150;
export const WAKE_T = 4.4;
/** The first beat of the waking: the three lights fly from the tail into the mirror, one by one. */
export const OFFER_T = 1.1;
export const MIRROR_H = 150;

export type WorldPhase = 'dusk' | 'waking' | 'night';
export type SeedId = 'tallGrass' | 'stone' | 'hollow';
export type SeedStatus = 'hidden' | 'popping' | 'resting' | 'carried';
export const SEED_IDS: readonly SeedId[] = ['tallGrass', 'stone', 'hollow'];
export type FoxEvent = 'hop' | 'jump' | 'land' | 'splash' | 'roll' | 'rollEnd' | 'skid' | 'bounce' | 'dry' | 'seed' | 'shake' | 'hum' | 'wake' | 'night' | 'blocked' | 'moth';

/* ── the trail ───────────────────────────────────────────────────────────── */

/** Ground elevation control points (x, elevation), cosine-interpolated. */
const GROUND: readonly (readonly [number, number])[] = [
  [0, 108], [420, 118], [820, 104], [1200, 112], [1600, 130], [2000, 116], [2330, 108], [2920, 108],
  [3300, 124], [3620, 112], [4040, 112], [4420, 130], [4820, 120], [5200, 128], [5560, 140], [5760, 140], [6000, 134],
];
export const ZONES = [
  { id: 'meadow', from: 0, to: 1100 },
  { id: 'birches', from: 1100, to: 2300 },
  { id: 'brook', from: 2300, to: 2980 },
  { id: 'oaks', from: 2980, to: 4600 },
  { id: 'clearing', from: 4600, to: WORLD_W },
] as const;
export const LOGS: readonly { x: number; r: number }[] = [{ x: 1240, r: 22 }, { x: 1960, r: 26 }];
export const STREAM = { from: 2400, to: 2860, bed: 18, water: 9 } as const;
export const STONES: readonly { x: number; w: number; top: number }[] = [
  { x: 2500, w: 62, top: 6 }, { x: 2630, w: 70, top: 10 }, { x: 2760, w: 60, top: 5 },
];
export const TALL_GRASS = { from: 600, to: 960 } as const;
export const TUNNEL = { from: 3700, to: 3960 } as const;
export const STONE_X = 5650;
/** Each seed teaches one move without a word: the grass one comes out for a
 * roll, the one over the stream hangs just out of reach until a jump, and the
 * one in the hollow oak is behind a gap too low for anything but a tumble. */
export const SEEDS: Readonly<Record<SeedId, { x: number; rest: number; lift: number }>> = {
  tallGrass: { x: 790, rest: 790, lift: 0 },
  stone: { x: 2630, rest: 2630, lift: 96 },
  hollow: { x: 3830, rest: 3830, lift: 0 },
};
/** How far above its stone the fox's feet must rise to nose the hanging pod: more than a hop, less than a jump. */
export const POD_REACH = 38;
/** Springy toadstools: landing on a cap sends the fox up again, higher each time. */
export const BOUNCERS: readonly { x: number; w: number; top: number }[] = [
  { x: 2150, w: 58, top: 30 }, { x: 3585, w: 62, top: 34 }, { x: 4330, w: 54, top: 28 },
];
/** Run into a cap and it springs the fox up and over; land on one from above and the bounce grows. */
export const BOUNCE_FIRST = 520;
export const BOUNCE_MIN = 420;
export const BOUNCE_MAX = 920;
/** The hollow oak's mossy top: out of a jump's reach, in a good bounce's. */
export const ROOF = { from: TUNNEL.from - 30, to: TUNNEL.to + 30, h: 126 } as const;
/** The hidden nook up there, where a moon-moth sleeps. */
export const NOOK_X = 3880;
export const NOOK_R = 46;

const smooth = (t: number) => t * t * (3 - 2 * t);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The ground itself (no logs or stones), stream bed included. */
export function groundAt(x: number): number {
  const p = clamp(x, 0, WORLD_W);
  let i = 0;
  while (i < GROUND.length - 2 && GROUND[i + 1][0] < p) i++;
  const [x0, h0] = GROUND[i], [x1, h1] = GROUND[i + 1];
  const t = x1 === x0 ? 0 : (p - x0) / (x1 - x0);
  const base = h0 + (h1 - h0) * (1 - Math.cos(Math.PI * clamp(t, 0, 1))) / 2;
  return base - streamDip(p);
}
/** How far the stream bed sits below the bank (smooth banks, 40 units wide). */
export function streamDip(x: number): number {
  const edge = 40;
  if (x <= STREAM.from || x >= STREAM.to) return 0;
  const inFrom = x - STREAM.from, inTo = STREAM.to - x;
  return STREAM.bed * smooth(clamp(Math.min(inFrom, inTo) / edge, 0, 1));
}
const bank = () => groundAt(STREAM.from);
export const waterLevel = () => bank() - STREAM.bed + STREAM.water;

/** What the fox can stand on at x: the ground, a log's round top, a stone. */
export function surfaceAt(x: number): number {
  let h = groundAt(x);
  for (const log of LOGS) {
    const d = x - log.x;
    if (Math.abs(d) < log.r) h = Math.max(h, groundAt(log.x) + log.r + Math.sqrt(log.r * log.r - d * d));
  }
  for (const stone of STONES) {
    const d = Math.abs(x - stone.x), half = stone.w / 2;
    if (d < half) h = Math.max(h, bank() + stone.top - 7 * smooth(clamp((d - half + 14) / 14, 0, 1)));
  }
  for (const cap of BOUNCERS) {
    const d = Math.abs(x - cap.x), half = cap.w / 2;
    if (d < half) h = Math.max(h, groundAt(cap.x) + cap.top - 6 * smooth(clamp((d - half + 12) / 12, 0, 1)));
  }
  return h;
}
/** Which toadstool cap is under x (-1: none). */
export function bouncerAt(x: number): number { return BOUNCERS.findIndex(cap => Math.abs(x - cap.x) < cap.w / 2); }
export const roofTop = () => groundAt(TUNNEL.from) + ROOF.h;
export const overRoof = (x: number) => x > ROOF.from && x < ROOF.to;
/** True when the fox is up at the oak's top rather than down on the trail. */
export const upOnRoof = (x: number, y: number) => overRoof(x) && y >= roofTop() - 10;
/** The floor under the fox: the trail, or the hollow oak's top when it is up there. */
export function floorUnder(x: number, y: number): number { return upOnRoof(x, y) ? roofTop() : surfaceAt(x); }
export const inTunnel = (x: number) => x > TUNNEL.from && x < TUNNEL.to;
export const inWater = (x: number, y: number) => x > STREAM.from + 10 && x < STREAM.to - 10 && y < waterLevel();
export const inTallGrass = (x: number) => x > TALL_GRASS.from && x < TALL_GRASS.to;
export function zoneAt(x: number): (typeof ZONES)[number]['id'] {
  return (ZONES.find(zone => x >= zone.from && x < zone.to) ?? ZONES[ZONES.length - 1]).id;
}
/** Where a seed rests (its elevation: on the ground, hanging over its stone, inside the oak). */
export function seedElevation(x: number, lift = 0): number { return surfaceAt(x) + lift; }

/* ── the state ───────────────────────────────────────────────────────────── */

export interface FoxInput {
  /** -1 left, 0 none, 1 right (held pads or arrow keys). */
  dir: -1 | 0 | 1;
  /** Edge-triggered presses. */
  jump?: boolean;
  roll?: boolean;
  offer?: boolean;
  /** A tap on the trail: the fox trots to this x. `null` clears it. */
  target?: number | null;
}
export interface FoxState {
  x: number; y: number; vx: number; vy: number;
  onGround: boolean;
  /** Seconds a jump is still allowed after running off an edge; presses waiting to happen. */
  coyote: number; jumpBuf: number; rollBuf: number;
  facing: 1 | -1;
  /** Seconds of roll left (0 = not rolling) and the roll's direction. */
  roll: number; rollDir: 1 | -1; rollCool: number;
  /** Distance travelled on the ground: the legs' phase. */
  dist: number;
  /** Seconds standing still: the fox sits after SIT_AFTER. */
  still: number;
  target: number | null;
  seeds: Record<SeedId, SeedStatus>;
  seedX: Record<SeedId, number>;
  pop: number;
  /** Which stepping stone the hanging pod is over this time (play again moves it). */
  variant: number;
  /** The last toadstool bounced on (-1: none yet) and how many bounces in a row. */
  bouncer: number; bounces: number;
  /** 1 while paddling; a 'dry' shake follows on the bank. */
  wet: number;
  /** The secret: the moon-moth in the nook on the hollow oak. */
  moth: 'asleep' | 'awake';
  inRange: boolean;
  blocked: boolean;
  phase: WorldPhase;
  /** Seconds since the mirror woke. */
  wake: number;
  t: number;
  /** What happened during the last step (sounds, hints). */
  events: FoxEvent[];
}

/** `variant` (0, 1, 2 …) moves the hanging pod to another stepping stone, so a second visit is not the first again. */
export function initialFoxState(variant = 0): FoxState {
  const v = ((Math.floor(variant) % STONES.length) + STONES.length) % STONES.length;
  const podStone = STONES[(v + 1) % STONES.length];
  return {
    x: START_X, y: surfaceAt(START_X), vx: 0, vy: 0, onGround: true, coyote: 0, jumpBuf: 0, rollBuf: 0, facing: 1,
    roll: 0, rollDir: 1, rollCool: 0, dist: 0, still: 0, target: null,
    seeds: { tallGrass: 'hidden', stone: 'resting', hollow: 'resting' },
    seedX: { tallGrass: SEEDS.tallGrass.x, stone: podStone.x, hollow: SEEDS.hollow.x },
    pop: 0, variant: v, bouncer: -1, bounces: 0, wet: 0, moth: 'asleep',
    inRange: false, blocked: false, phase: 'dusk', wake: 0, t: 0, events: [],
  };
}
/** Play again: the wood is back at dusk and every seed is back where it slept. */
export function resetFoxState(_previous?: FoxState, variant = 0): FoxState { return initialFoxState(variant); }

export const carriedCount = (s: FoxState) => SEED_IDS.filter(id => s.seeds[id] === 'carried').length;
export const allCarried = (s: FoxState) => carriedCount(s) === SEED_IDS.length;
export const nearStone = (s: Pick<FoxState, 'x'>) => Math.abs(s.x - STONE_X) < OFFER_RANGE;
/** The "Offer the light" button: all three seeds, in range, standing on the trail, still dusk. */
export const canOffer = (s: FoxState) => s.phase === 'dusk' && allCarried(s) && nearStone(s) && s.onGround && s.roll <= 0;
export const rolling = (s: Pick<FoxState, 'roll'>) => s.roll > 0;

/* ── one fixed step ──────────────────────────────────────────────────────── */

const approach = (v: number, target: number, rate: number) => v < target ? Math.min(target, v + rate) : Math.max(target, v - rate);

export function step(prev: FoxState, input: FoxInput, dt: number = STEP_DT): FoxState {
  const s: FoxState = { ...prev, seeds: { ...prev.seeds }, seedX: { ...prev.seedX }, events: [] };
  const ev = s.events;
  s.t += dt;
  if (input.target !== undefined) s.target = input.target === null ? null : clamp(input.target, MIN_X, MAX_X);
  const busy = s.phase === 'waking';

  // Which way the child asks to go: held direction first, else a tapped target.
  let want: number = busy ? 0 : input.dir;
  let cap = RUN_MAX;
  if (want !== 0) s.target = null;
  else if (s.target !== null && !busy) {
    const d = s.target - s.x;
    if (Math.abs(d) < 10) s.target = null;
    else { want = Math.sign(d); cap = Math.min(TROT_MAX, 70 + Math.abs(d) * 2.4); }
  }
  const wet = inWater(s.x, s.y) && s.onGround;
  if (wet) cap *= WATER_SLOW;

  // A press a moment too early still counts (and so does a jump a moment too late: coyote time).
  s.jumpBuf = input.jump && !busy ? JUMP_BUFFER : Math.max(0, s.jumpBuf - dt);
  s.rollBuf = input.roll && !busy ? ROLL_BUFFER : Math.max(0, s.rollBuf - dt);
  if (!s.onGround) s.coyote = Math.max(0, s.coyote - dt);

  // Roll: a tucked tumble that goes farther and faster (a somersault in the air). Inside the hollow oak it keeps going until out.
  s.rollCool = Math.max(0, s.rollCool - dt);
  if (s.rollBuf > 0 && !busy && s.roll <= 0 && s.rollCool <= 0) {
    s.roll = ROLL_T; s.rollBuf = 0; s.rollDir = want !== 0 ? (want > 0 ? 1 : -1) : s.facing; s.facing = s.rollDir; s.target = null; ev.push('roll');
  }
  const wasRolling = s.roll > 0;
  if (wasRolling) {
    s.roll = Math.max(0, s.roll - dt);
    if (inTunnel(s.x) && !upOnRoof(s.x, s.y)) s.roll = Math.max(s.roll, 0.12);
    if (s.roll <= 0) { s.rollCool = ROLL_COOLDOWN; ev.push('rollEnd'); }
  }

  if (s.roll > 0) {
    const r = 1 - s.roll / ROLL_T;
    const ease = inTunnel(s.x) ? 1 : r < 0.7 ? 1 : 1 - (r - 0.7) / 0.3 * 0.45;
    s.vx = s.rollDir * ROLL_SPEED * (wet ? 0.7 : 1) * ease;
  } else if (want !== 0) {
    const turning = s.vx !== 0 && Math.sign(s.vx) !== want;
    if (turning && s.onGround && Math.abs(s.vx) > 190 && prev.facing !== want) ev.push('skid');
    // A strong push off the mark that eases into full speed; a quick skid to turn round.
    const rate = turning ? TURN : ACCEL * (1 - 0.55 * clamp(Math.abs(s.vx) / cap, 0, 1));
    s.vx = approach(s.vx, want * cap, rate * dt * (s.onGround ? 1 : 0.65));
    s.facing = want > 0 ? 1 : -1;
  } else {
    s.vx = approach(s.vx, 0, DECEL * dt * (s.onGround ? 1 : 0.35));
  }

  // Jump (a button): not inside the hollow oak.
  const inside = inTunnel(s.x) && !upOnRoof(s.x, s.y);
  if (s.jumpBuf > 0 && !busy && s.roll <= 0 && (s.onGround || s.coyote > 0) && !inside) {
    s.vy = JUMP_V; s.onGround = false; s.coyote = 0; s.jumpBuf = 0; s.bounces = 0; ev.push('jump');
  }

  // Horizontal move against the trail.
  let nx = clamp(s.x + s.vx * dt, MIN_X, MAX_X);
  if (nx === MIN_X || nx === MAX_X) s.vx = 0;
  // The hollow oak is too low to walk into: only a roll goes through (high above, its mossy top is a place to land).
  if (s.roll <= 0 && s.y < roofTop() - 10 && !inTunnel(s.x) && inTunnel(nx)) {
    nx = s.x < TUNNEL.from ? TUNNEL.from - 0.5 : TUNNEL.to + 0.5;
    s.vx = 0; s.target = null;
  }
  const rise = floorUnder(nx, s.y) - s.y;
  if (rise > STEP_UP) {
    const pushing = Math.abs(s.vx) > 30 || want !== 0;
    const capI = s.onGround && pushing ? bouncerAt(nx) : -1;
    if (capI >= 0) {
      // A toadstool: it springs the fox up and over. No aim needed.
      s.vy = BOUNCE_FIRST; s.onGround = false; s.coyote = 0; s.bouncer = capI; s.bounces = 1; ev.push('bounce');
      nx = s.x;
    } else if (s.onGround && rise <= HOP_MAX && pushing) {
      // A low log or a stone ahead: hop it, no precision needed.
      s.vy = Math.max(HOP_V, Math.sqrt(2 * GRAVITY * (rise + 22))); s.onGround = false; s.coyote = 0; ev.push('hop');
      if (Math.abs(s.vx) < 110) s.vx = (want || Math.sign(s.vx) || s.facing) * 110;
      nx = s.x;
    } else if (!s.onGround && rise <= STEP_UP * 2.5) {
      s.y = floorUnder(nx, s.y);
    } else {
      // A wall: on the ground the fox stops; in the air it keeps its run and rises until it clears.
      nx = s.x; if (s.onGround) s.vx = 0;
    }
  }
  const moved = nx - s.x;
  s.x = nx;
  // Pressing against a mouth of the hollow oak (the hint and the Roll button's ring).
  const pressing = s.roll <= 0 && !busy && s.y < roofTop() - 10 && ((want > 0 && s.x >= TUNNEL.from - 3 && s.x <= TUNNEL.from) || (want < 0 && s.x <= TUNNEL.to + 3 && s.x >= TUNNEL.to));
  if (pressing && !prev.blocked) ev.push('blocked');
  s.blocked = pressing;

  // Vertical: a floaty top to every arc, a quicker way down.
  const floor = floorUnder(s.x, s.y);
  if (!s.onGround) {
    const g = (s.vy > 0 ? GRAVITY : FALL_GRAVITY) * (Math.abs(s.vy) < APEX_BAND ? APEX_HANG : 1);
    s.vy -= g * dt; s.y += s.vy * dt;
    if (s.y <= floor) {
      const speedIn = -s.vy, capI = floor === surfaceAt(s.x) ? bouncerAt(s.x) : -1;
      s.y = floor;
      if (capI >= 0 && speedIn > 60) {
        // Down onto a cap: up again, a little higher every time.
        s.vy = clamp(speedIn * 0.9 + 140, BOUNCE_MIN, BOUNCE_MAX); s.bouncer = capI; s.bounces += 1; ev.push('bounce');
      } else {
        s.vy = 0; s.onGround = true; s.bounces = 0;
        ev.push(inWater(s.x, s.y) ? 'splash' : 'land');
      }
    }
  } else if (floor < s.y - 7) {
    s.onGround = false; s.vy = 0; s.coyote = COYOTE_T;
  } else {
    s.y = floor;
    s.dist += Math.abs(moved);
    if (wet && Math.abs(moved) > 0 && Math.floor(s.dist / 60) !== Math.floor((s.dist - Math.abs(moved)) / 60)) ev.push('splash');
  }

  // Out of the stream and onto the bank: a happy shake.
  if (wet) s.wet = 1;
  else if (s.wet > 0 && s.onGround && (s.x < STREAM.from - 24 || s.x > STREAM.to + 24)) { s.wet = 0; ev.push('dry'); }

  // Standing still long enough: the fox sits.
  s.still = s.onGround && Math.abs(s.vx) < 4 && s.roll <= 0 ? s.still + dt : 0;

  // Lantern-seeds.
  if (s.seeds.tallGrass === 'hidden' && s.roll > 0 && Math.abs(s.x - SEEDS.tallGrass.x) < 120 && s.y - groundAt(s.x) < 40) {
    // A roll shakes the tall grass: the pod pops out and lands where the fox is heading.
    // It lands just ahead of where the tumble will end, so the fox runs straight into it.
    s.seeds.tallGrass = 'popping'; s.pop = 0; s.seedX.tallGrass = clamp(s.x + s.rollDir * (s.roll * ROLL_SPEED * 0.8 + 60), TALL_GRASS.from - 150, TALL_GRASS.to + 200); ev.push('shake');
  }
  if (s.seeds.tallGrass === 'popping') { s.pop += dt; if (s.pop >= 0.7) s.seeds.tallGrass = 'resting'; }
  for (const id of SEED_IDS) {
    if (s.seeds[id] !== 'resting') continue;
    const sx = s.seedX[id], lift = SEEDS[id].lift, up = s.y - surfaceAt(sx);
    // A pod on the ground is run into; the hanging one is nosed at the top of a jump.
    const reached = lift > 0 ? up >= POD_REACH && up < lift + 60 : Math.abs(up) < 64;
    if (Math.abs(s.x - sx) < PICK_R && reached) { s.seeds[id] = 'carried'; ev.push('seed'); }
  }

  // The secret: up on the hollow oak a moon-moth sleeps until the fox finds it.
  if (s.moth === 'asleep' && s.onGround && upOnRoof(s.x, s.y) && Math.abs(s.x - NOOK_X) < NOOK_R) { s.moth = 'awake'; ev.push('moth'); }

  // The mirror stone.
  const near = nearStone(s);
  if (near && !s.inRange && s.phase === 'dusk' && !allCarried(s)) ev.push('hum');
  s.inRange = near;
  if (input.offer && canOffer(s)) { s.phase = 'waking'; s.wake = 0; s.target = null; ev.push('wake'); }
  else if (s.phase !== 'dusk') {
    s.wake += dt;
    if (s.phase === 'waking' && s.wake >= WAKE_T) { s.phase = 'night'; ev.push('night'); }
  }
  return s;
}

/** Run several fixed steps (tests, catch-up after a slow frame). Edge inputs apply to the first step only. */
export function run(state: FoxState, input: FoxInput, seconds: number): FoxState {
  let s = state, events: FoxEvent[] = [];
  const n = Math.round(seconds / STEP_DT);
  for (let i = 0; i < n; i++) {
    s = step(s, i === 0 ? input : { dir: input.dir }, STEP_DT);
    events = events.concat(s.events);
  }
  return { ...s, events };
}

/* ── the world change ────────────────────────────────────────────────────── */

/** How far (world units) the mirror's ring of light has swept back across the wood. */
export function wakeRadius(phase: WorldPhase, wake: number): number {
  if (phase === 'dusk') return 0;
  const p = clamp((wake - OFFER_T) / (WAKE_T - OFFER_T), 0, 1);
  return Math.pow(p, 1.5) * (STONE_X + 1400);
}
/** 0 at dusk, 1 once the ring has passed. */
export function nightness(phase: WorldPhase, wake: number, distance: number): number {
  if (phase === 'dusk') return 0;
  if (phase === 'night') return 1;
  return clamp((wakeRadius(phase, wake) - distance) / 90, 0, 1);
}

/* ── grass ───────────────────────────────────────────────────────────────── */

/** How far a blade at `bx` leans (radians, + = to the right) to make way for
 * the fox: more when the fox is close and fast, a little even when it stands
 * in the grass, nothing once it has leapt clear above. */
export function bladeBend(bx: number, fox: { x: number; vx: number; lift: number; rolling: boolean }): number {
  const d = bx - fox.x;
  const reach = fox.rolling ? 78 : 58;
  const ad = Math.abs(d);
  if (ad > reach * 1.7) return 0;
  const prox = 1 - smooth(clamp(ad / (reach * 1.7), 0, 1));
  const speed = clamp(Math.abs(fox.vx) / RUN_MAX, 0, 1.4);
  const clear = 1 - clamp(fox.lift / 70, 0, 1);
  // Ahead of a running fox the blades are pushed forward, behind it they are dragged after it.
  const side = ad < 4 ? Math.sign(fox.vx) || 1 : Math.sign(d);
  const push = (fox.rolling ? 1.25 : 0.32 + 0.68 * speed) * prox * clear;
  return clamp(side * push * 1.05, -1.3, 1.3);
}
/** A roll presses the blades it passes flat; they rise again slowly. */
export function bladeFlatten(bx: number, fox: { x: number; lift: number; rolling: boolean }): number {
  if (!fox.rolling || fox.lift > 20) return 0;
  return 1 - smooth(clamp(Math.abs(bx - fox.x) / 46, 0, 1));
}
export const FLAT_RECOVER = 0.32;
/** One blade's spring toward its bend (semi-implicit Euler). Reduced motion is
 * critically damped: the blade bends and settles without overshoot. */
export function springBlade(angle: number, velocity: number, target: number, dt: number, reduced: boolean): [number, number] {
  const k = 70, c = reduced ? 2 * Math.sqrt(k) : 5.2;
  const v = velocity + (-k * (angle - target) - c * velocity) * dt;
  return [angle + v * dt, v];
}

/* ── camera ──────────────────────────────────────────────────────────────── */

/** The camera keeps the fox a little behind centre with room to see ahead,
 * eases after it, and never shows past either end of the trail. */
export function cameraFollow(cam: number, foxX: number, facing: 1 | -1, viewW: number, dt: number, snap = false): number {
  const max = Math.max(0, WORLD_W - viewW);
  // A narrow window keeps the fox farther back, so there is still trail to see ahead.
  const lead = viewW < 620 ? 0.3 : 0.38;
  const goal = clamp(foxX - viewW * (facing > 0 ? lead : 1 - lead), 0, max);
  if (snap) return goal;
  const k = 1 - Math.exp(-dt * 4.2);
  return clamp(cam + (goal - cam) * k, 0, max);
}
