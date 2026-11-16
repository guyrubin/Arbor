/** The Woolly Mammoth's story, as rules. Pure: no React, no DOM, no timers,
 * no randomness inside (a seed is passed in). Three chapters of three steps
 * each, the frost on the glass, the tusk the RouteScope traces, the patience
 * of an offered tuft, the ScoutCam's search, the walk to the herd, the low
 * view, the constellation the five pictures make, and what one visit looks
 * like (so the next one looks different). Nothing here measures the child:
 * a step is a thing done, never a count of tries. */
import { seeded, type Bounds, type Camera, type DiscoveryId, type Vec } from './iceAgeFriendRules';

const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ── chapters and steps ───────────────────────────────────────────────── */

export const CHAPTERS = ['meet', 'care', 'walk'] as const;
export type ChapterId = typeof CHAPTERS[number];
export const STEPS = ['frost', 'hello', 'trace', 'brush', 'feed', 'part', 'scout', 'walk', 'low'] as const;
export type StepId = typeof STEPS[number];
export const CHAPTER_STEPS: Readonly<Record<ChapterId, readonly StepId[]>> = {
  meet: ['frost', 'hello', 'trace'],
  care: ['brush', 'feed', 'part'],
  walk: ['scout', 'walk', 'low'],
};
/** The picture a step ends in, where it has one: the fact is found by doing the step. */
export const STEP_FACT: Readonly<Partial<Record<StepId, DiscoveryId>>> = { trace: 'tusks', feed: 'trunk', part: 'coats', scout: 'herd', low: 'hump' };
/** The crew's tool each fact is found with, used for what it really does. */
export const FACT_TOOL: Readonly<Record<DiscoveryId, 'routeScope' | 'waitRing' | 'proofLens' | 'scoutCam' | 'viewCheck'>> = {
  tusks: 'routeScope', trunk: 'waitRing', coats: 'proofLens', herd: 'scoutCam', hump: 'viewCheck',
};
export function chapterOf(step: StepId): ChapterId {
  return CHAPTERS.find(chapter => CHAPTER_STEPS[chapter].includes(step)) ?? 'meet';
}
/** The step after this one, or null after the last (the set-piece follows). */
export function nextStep(step: StepId): StepId | null {
  const index = STEPS.indexOf(step);
  return index >= 0 && index < STEPS.length - 1 ? STEPS[index + 1] : null;
}
/** True when finishing this step finishes its chapter. */
export function endsChapter(step: StepId): boolean {
  const steps = CHAPTER_STEPS[chapterOf(step)];
  return steps[steps.length - 1] === step;
}
/** The quest strip for the chapter in play: its three steps, which are done and which is now. */
export function questFor(step: StepId | null, done: readonly StepId[]): { chapter: ChapterId; steps: { id: StepId; done: boolean }[]; current: number } {
  const chapter = step ? chapterOf(step) : 'walk', steps = CHAPTER_STEPS[chapter].map(id => ({ id, done: done.includes(id) }));
  return { chapter, steps, current: step ? steps.findIndex(s => s.id === step) : steps.length };
}
/** Marks a step done once, keeping the story's order. */
export function finishStep(done: readonly StepId[], step: StepId): StepId[] {
  return STEPS.filter(id => id === step || done.includes(id));
}

/* ── the hint hand ────────────────────────────────────────────────────── */

export const HINT = { first: 1.6, again: 6 } as const;
/** What the hint hand does after `idle` quiet seconds on a step: wait, show
 * the gesture on the real thing, or (for a child who is only watching) do one
 * helping of the step itself, so the story never waits on anyone. `shown` is
 * how many times it has shown this step; `learned` is true once the child has
 * done the gesture. A child who knows the gesture is left alone much longer. */
export function hintPlan(idle: number, shown: number, learned: boolean): 'wait' | 'show' | 'help' {
  if (!(idle >= (shown === 0 && !learned ? HINT.first : HINT.again))) return 'wait';
  if (learned) return idle < HINT.again * 1.6 ? 'wait' : shown >= 1 ? 'help' : 'show';
  return shown >= 2 ? 'help' : 'show';
}

/* ── frost on the glass ───────────────────────────────────────────────── */

/** The frost as a coarse grid over the wall of glass (1 frosted .. 0 clear).
 * The picture of the frost is painted finer than this; the grid is what the
 * game knows: how much is left, and whether the eye can be seen. */
export interface FrostGrid { cols: number; rows: number; cells: Float32Array }
export const FROST = { cols: 28, rows: 18, /** The rest melts by itself once this little is left. */ meltAt: 0.42, /** The eye shows once its patch is this clear. */ eyeAt: 0.4 } as const;
export function makeFrost(cols: number = FROST.cols, rows: number = FROST.rows): FrostGrid {
  return { cols, rows, cells: new Float32Array(cols * rows).fill(1) };
}
/** Wipes a round patch at (u, v), each 0..1 across the glass, of radius `r`
 * (a fraction of the glass's width; `aspect` is its width over its height).
 * Returns how much frost came off (0 when the glass was already clear there). */
export function wipeFrost(grid: FrostGrid, u: number, v: number, r: number, aspect = 1): number {
  let shed = 0;
  const { cols, rows, cells } = grid, rv = r * aspect;
  const c0 = Math.max(0, Math.floor((u - r) * cols)), c1 = Math.min(cols - 1, Math.floor((u + r) * cols));
  const r0 = Math.max(0, Math.floor((v - rv) * rows)), r1 = Math.min(rows - 1, Math.floor((v + rv) * rows));
  for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
    const du = ((col + 0.5) / cols - u) / r, dv = ((row + 0.5) / rows - v) / rv, d = Math.hypot(du, dv);
    if (d >= 1) continue;
    const i = row * cols + col, keep = Math.min(cells[i], smooth(0.45, 1, d));
    shed += cells[i] - keep; cells[i] = keep;
  }
  return shed;
}
/** How much frost is left (0..1): over the whole glass, or within `r` of a point. */
export function frostLeft(grid: FrostGrid, at?: { u: number; v: number; r: number; aspect?: number }): number {
  const { cols, rows, cells } = grid;
  let sum = 0, n = 0;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    if (at) { const du = ((col + 0.5) / cols - at.u) / at.r, dv = ((row + 0.5) / rows - at.v) / (at.r * (at.aspect ?? 1)); if (du * du + dv * dv > 1) continue; }
    sum += cells[row * cols + col]; n++;
  }
  return n ? sum / n : 0;
}
/** The frost melts away evenly (the last of it, once the child has cleared enough). */
export function meltFrost(grid: FrostGrid, dt: number, seconds = 1.1): number {
  const k = Math.max(0, Math.min(1, dt / seconds));
  for (let i = 0; i < grid.cells.length; i++) grid.cells[i] = Math.max(0, grid.cells[i] - k);
  return frostLeft(grid);
}

/* ── the RouteScope traces the tusk ───────────────────────────────────── */

export const TRACE = { reach: 46, lead: 0.2 } as const;
/** How far along the tusk (0 root .. 1 tip) the measure has come. The finger
 * moves it forward only while it is on the tusk (how far it is from
 * the nearest point of the tusk, and how far along that point is) and close to where the line has got to:
 * a tusk is measured along its curve, not by jumping to its tip. Lifting the
 * finger keeps what is measured. */
export function traceStep(progress: number, along: number, distance: number, reach: number = TRACE.reach): number {
  const p = clamp01(progress);
  if (!(distance <= reach) || along <= p || along > p + TRACE.lead) return p;
  return clamp01(along);
}

/* ── an offered tuft: patience ────────────────────────────────────────── */

export const PATIENCE_SECONDS = 2.1;
/** The WaitRing (0..1): it fills while the offered grass is held still within
 * the trunk's reach, and eases back a little while it is waved about. It never
 * empties as a penalty and nothing is lost: the mammoth simply takes its time. */
export function patienceStep(ring: number, still: boolean, dt: number, seconds: number = PATIENCE_SECONDS): number {
  const step = Math.max(0, Math.min(0.1, dt));
  return clamp01(ring + (still ? step / seconds : -step * 0.25));
}

/* ── the ScoutCam finds the herd ──────────────────────────────────────── */

export const SCOUT = { tolerance: 0.085, lockSeconds: 0.7 } as const;
/** The lock (0..1): it closes while the finder (u across the horizon, 0..1)
 * is on the herd, and opens again when it drifts off. */
export function scoutStep(lock: number, finderU: number, herdU: number, dt: number): number {
  const on = Math.abs(finderU - herdU) <= SCOUT.tolerance, step = Math.max(0, Math.min(0.1, dt));
  return clamp01(lock + (on ? step / SCOUT.lockSeconds : -step * 2));
}
/** How near the finder is to the herd (0 far .. 1 on it), for the ping that quickens. */
export function scoutNear(finderU: number, herdU: number): number {
  return 1 - clamp01(Math.abs(finderU - herdU) / 0.5);
}

/* ── the walk to the herd ─────────────────────────────────────────────── */

export const WALK_SECONDS = 6.5;
/** The walk (0..1): it goes on while the child holds the way ahead; a tap is a few steps. */
export function walkStep(progress: number, holding: boolean, dt: number, seconds: number = WALK_SECONDS): number {
  return clamp01(progress + (holding ? Math.max(0, Math.min(0.1, dt)) / seconds : 0));
}
/** Where the herd stands as the walk goes on: far off and to one side at
 * first, close and a little ahead at the end. `depth` is how many
 * mammoth-lengths away it is; `offset` is world units to the side of the mammoth. */
export function herdPlace(progress: number, startOffset: number, endOffset: number): { depth: number; offset: number } {
  const k = smooth(0, 1, clamp01(progress));
  return { depth: HERD_FAR + (HERD_NEAR - HERD_FAR) * k, offset: startOffset + (endOffset - startOffset) * k };
}
export const HERD_FAR = 6.2;
export const HERD_NEAR = 1.7;
/** The sky's hour (0 gold afternoon, 1 sunset, 2 dusk, 3 night) for a step and how far through it the child is. */
export function hourFor(step: StepId | 'setPiece' | 'end', progress = 0): number {
  const p = clamp01(progress);
  switch (step) {
    case 'frost': case 'hello': case 'trace': return 0.25;
    case 'brush': return 0.3;
    case 'feed': return 0.42;
    case 'part': return 0.55;
    case 'scout': return 0.85;
    case 'walk': return 0.9 + 0.75 * p;
    case 'low': return 1.75;
    default: return 3;
  }
}

/* ── the ViewCheck: the view from a calf's height ─────────────────────── */

/** The eye's height above the snow in world units (the mammoth is about 450
 * tall): a child's eye at `low` 0, a calf's at 1. The horizon lies at the
 * eye's height, so lowering it makes the giant stand up into the sky. */
export function eyeHeight(low: number): number {
  return 172 - 118 * smooth(0, 1, clamp01(low));
}

/* ── the camera's shots ───────────────────────────────────────────────── */

export interface Safe { top: number; bottom: number; side: number }
/** The camera that shows a box of the world (world units) on a stage (CSS
 * px), whole and centred in the room the HUD leaves free. `zoom` is in
 * px per world unit. */
export function fitShot(box: Bounds, stage: { w: number; h: number }, safe: Safe, maxZoom = 6): Camera {
  const roomW = Math.max(40, stage.w - safe.side * 2), roomH = Math.max(40, stage.h - safe.top - safe.bottom);
  const zoom = Math.min(maxZoom, roomW / Math.max(1, box.maxX - box.minX), roomH / Math.max(1, box.maxY - box.minY));
  // The box's middle sits in the middle of the free room, which is not the stage's middle when the HUD is uneven.
  const shiftY = (safe.top - safe.bottom) / 2 / zoom;
  return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 - shiftY, zoom };
}

/* ── five pictures in the sky ─────────────────────────────────────────── */

export const CONSTELLATIONS = ['tuskArc', 'greatBack', 'trunkCurl'] as const;
export type ConstellationId = typeof CONSTELLATIONS[number];
const STAR_SHAPES: Readonly<Record<ConstellationId, readonly Vec[]>> = {
  // A tusk's sweep: down, forward and up again.
  tuskArc: [[0.16, 0.2], [0.24, 0.62], [0.48, 0.84], [0.74, 0.66], [0.86, 0.26]],
  // The line of a mammoth's back: crown, dip, hump, slope, hip.
  greatBack: [[0.1, 0.5], [0.28, 0.28], [0.46, 0.14], [0.68, 0.36], [0.9, 0.62]],
  // A lifted trunk.
  trunkCurl: [[0.2, 0.86], [0.36, 0.52], [0.56, 0.3], [0.76, 0.2], [0.84, 0.44]],
};
/** Where the five pictures hang, each 0..1 across a box of sky, in the order they join up. */
export function constellation(id: ConstellationId): readonly Vec[] {
  return STAR_SHAPES[id] ?? STAR_SHAPES.tuskArc;
}
/** The secret's small sixth star: just off the end of the line. */
export function secretStar(id: ConstellationId): Vec {
  const pts = constellation(id), [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1];
  return [Math.max(0.04, Math.min(0.96, bx + (bx - ax) * 0.45)), Math.max(0.04, Math.min(0.96, by + (by - ay) * 0.45))];
}
export const SET_PIECE = { call: 1.2, answers: [2.6, 3.3, 3.9] as readonly number[], aurora: 2.2, stars: 4.6, starGap: 0.62, hold: 9.4 } as const;
/** How many pictures have risen into the sky at t seconds of the set-piece (a fraction while one is rising). */
export function starsRisen(t: number, count = 5): number {
  return Math.max(0, Math.min(count, (t - SET_PIECE.stars) / SET_PIECE.starGap));
}
/** How far the aurora has unrolled (0..1) at t seconds. */
export function auroraAt(t: number): number {
  return smooth(SET_PIECE.aurora, SET_PIECE.aurora + 3.2, t);
}

/* ── one visit ────────────────────────────────────────────────────────── */

export const SKIES = ['clearGold', 'snowFlurry', 'roseMist'] as const;
export type SkyId = typeof SKIES[number];
export const AURORAS = ['greenTeal', 'greenViolet', 'tealRose'] as const;
export type AuroraId = typeof AURORAS[number];
/** What one visit looks like. Everything the child can tell apart from the
 * last visit is drawn from the seed: the weather, the mountains, the frost,
 * where the herd is and how many it is, the aurora's colours and the shape
 * the five pictures make. */
export interface Round {
  seed: number; sky: SkyId; aurora: AuroraId; starShape: ConstellationId;
  /** How far along the horizon the herd is first seen, from the middle (0.5) to the edge the mammoth faces (1), and how many are in it. */
  herdU: number; herdSize: number;
  /** Seeds for the ridges, the frost's ferns and the grass. */
  ridge: number; frost: number; grass: number;
  /** How snowy its back is to begin with (0..1), how hard it blows, how many flakes fall. */
  cover: number; wind: number; flakes: number;
}
const WEATHER: Readonly<Record<SkyId, { cover: number; wind: number; flakes: number }>> = {
  clearGold: { cover: 0.72, wind: 0, flakes: 26 },
  snowFlurry: { cover: 1, wind: 0.22, flakes: 60 },
  roseMist: { cover: 0.6, wind: -0.1, flakes: 14 },
};
export function planRound(seed: number, previous?: Pick<Round, 'sky' | 'starShape'> | null): Round {
  const random = seeded(seed), pickFrom = <T,>(list: readonly T[], not?: T): T => {
    const options = list.filter(item => item !== not);
    return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
  };
  const sky = pickFrom(SKIES, previous?.sky), starShape = pickFrom(CONSTELLATIONS, previous?.starShape), aurora = pickFrom(AURORAS);
  // The herd is never where the finder starts (the middle): the child has to look for it. It is always
  // somewhere ahead of the mammoth, so `herdU` is how far from the middle (0.5) toward the way it faces.
  const herdU = 0.5 + 0.17 + random() * 0.22;
  return {
    seed, sky, aurora, starShape, herdU, herdSize: 4 + Math.floor(random() * 4),
    ridge: Math.floor(random() * 1e9), frost: Math.floor(random() * 1e9), grass: Math.floor(random() * 1e9),
    ...WEATHER[sky],
  };
}
