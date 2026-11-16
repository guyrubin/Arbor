import { SEASON_CENTERS, bump, cloudCover, easeInOut, labLevel, shortestTurn, smoothstep, snowDepth, sunHeight, weatherAt, wrapYear, type LeafLab, type Season } from './seasonDialRules';

/** The Game Cut's rules for the Weather Maker: where things stand on the
 * full-bleed terrace, the sun's path, the sky the child can change (clouds
 * gathered by a tap, blown off by a swipe), what Aya's seedling asks for, the
 * year the child conducts and its time-lapse. Pure: no DOM, no clock of its
 * own, no random that is not seeded. */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : Number.isFinite(v) ? v : 0);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ── the stage ──────────────────────────────────────────────────────────── */

/** Where the terrace render keeps its lines, as fractions of its height
 * (the picture is square): the lake's horizon, the top of the near parapet
 * and the line where the parapet meets the floor. */
export const VIEW_LINES = { horizon: 0.532, peak: 0.43, wallTop: 0.612, floorTop: 0.662 } as const;
export interface Spot { readonly x: number; readonly y: number; readonly h: number }
export interface StageLayout {
  readonly w: number; readonly h: number; readonly portrait: boolean;
  /** The square picture: its side and where its top-left corner sits. Wider stages show mirrored copies beside it. */
  readonly view: { readonly size: number; readonly left: number; readonly top: number };
  readonly horizon: number; readonly wallTop: number; readonly floorTop: number;
  /** The tree: its foot on the floor and its height. */
  readonly tree: Spot;
  /** The brass dial in the foreground corner (always the picture's right). */
  readonly dial: { readonly cx: number; readonly cy: number; readonly r: number };
  /** Where friends stand, by role: `a` beside the tree, `b` further along, `c` on the tree's other side. */
  readonly spots: { readonly a: Spot; readonly b: Spot; readonly c: Spot; readonly planter: Spot; readonly snowFriend: Spot };
  readonly puddles: readonly { readonly x: number; readonly y: number; readonly rx: number; readonly ry: number }[];
}
/** A point on the floor: `depth` 0 at the parapet … 1 at the camera. Things
 * grow toward the camera, as the picture's own perspective does. */
export function floorPoint(layout: Pick<StageLayout, 'h' | 'floorTop'>, depth: number): { y: number; scale: number } {
  const d = clamp01(depth);
  return { y: layout.floorTop + d * (layout.h - layout.floorTop), scale: 0.72 + 0.6 * d };
}
/** The whole composition for a stage of `w` by `h` px. Portrait fills the
 * height with the picture's middle; landscape shows the picture a little
 * larger than the stage is tall (cropping empty sky) with its mirrored
 * copies carrying the terrace out to both edges. */
export function stageLayout(w: number, h: number, safeBottom = 14): StageLayout {
  const W = Math.max(240, w || 0), H = Math.max(180, h || 0), portrait = H > W;
  const size = Math.max(portrait ? H : H * 1.16, portrait ? W : 0), top = H - size, left = (W - size) / 2;
  const line = (f: number) => top + f * size;
  const base = { h: H, floorTop: line(VIEW_LINES.floorTop) };
  const at = (xf: number, depth: number, hf: number): Spot => { const p = floorPoint(base, depth); return { x: W * xf, y: p.y, h: hf * p.scale }; };
  // A short landscape stage (a phone on its side) stands the tree nearer the camera, so it stays big.
  const treeFoot = floorPoint(base, portrait ? 0.2 : H < 430 ? 0.5 : 0.24);
  const treeH = Math.min(portrait ? Math.min(H * 0.6, W * 1.16) : H * 0.78, treeFoot.y - Math.min(64, H * 0.1));
  const person = treeH * 0.37;
  const r = Math.max(62, Math.min(132, Math.min(W, H) * (portrait ? 0.225 : 0.2)));
  const dial = { cx: W - r - Math.max(14, W * 0.018), cy: H - r - safeBottom - Math.max(6, H * 0.012), r };
  const treeX = W * (portrait ? 0.44 : 0.37);
  return {
    w: W, h: H, portrait, view: { size, left, top }, horizon: line(VIEW_LINES.horizon), wallTop: line(VIEW_LINES.wallTop), floorTop: base.floorTop,
    tree: { x: treeX, y: treeFoot.y, h: treeH }, dial,
    spots: portrait
      ? { a: at(0.2, 0.66, person * 1.05), b: at(0.76, 0.26, person), c: at(0.86, 0.3, person), planter: at(0.37, 0.6, person * 0.6), snowFriend: at(0.66, 0.12, person * 0.86) }
      : { a: at(0.56, H < 430 ? 0.72 : 0.5, person), b: at(0.7, H < 430 ? 0.5 : 0.34, person), c: at(0.14, H < 430 ? 0.7 : 0.52, person), planter: at(0.6, 0.86, person * 0.6), snowFriend: at(0.19, H < 430 ? 0.46 : 0.3, person * 0.9) },
    puddles: portrait
      ? [{ x: W * 0.22, y: floorPoint(base, 0.52).y, rx: W * 0.16, ry: W * 0.034 }, { x: W * 0.62, y: floorPoint(base, 0.2).y, rx: W * 0.13, ry: W * 0.022 }, { x: W * 0.4, y: floorPoint(base, 0.88).y, rx: W * 0.2, ry: W * 0.04 }]
      : [{ x: W * 0.17, y: floorPoint(base, 0.6).y, rx: W * 0.085, ry: W * 0.016 }, { x: W * 0.64, y: floorPoint(base, 0.2).y, rx: W * 0.07, ry: W * 0.011 }, { x: W * 0.47, y: floorPoint(base, 0.82).y, rx: W * 0.11, ry: W * 0.02 }],
  };
}

/* ── the sun and the light ──────────────────────────────────────────────── */

/** The hour the dial stands at for each point of the year: a spring morning,
 * a summer noon, a long autumn afternoon, a low winter midday. 0 sunrise …
 * 1 sunset, so the sun crosses the whole sky as the year turns. */
export function hourAt(year: number): number {
  return 0.5 - 0.27 * Math.cos(2 * Math.PI * (wrapYear(year) - SEASON_CENTERS[0]));
}
export interface SunArc {
  /** Across the stage, 0 left … 1 right. */
  readonly x: number;
  /** Above the horizon, as a fraction of the sky's height (0 on the horizon). */
  readonly lift: number;
  /** How high the sun stands, 0 on the horizon … 1 overhead. */
  readonly elevation: number;
  /** 0 a cool white noon … 1 the deep gold of a low sun. */
  readonly gold: number;
  /** Daylight left, 0 dark … 1 full day. */
  readonly day: number;
}
/** The sun for a point of the year at an hour of its day (default: the
 * year's own hour). High in summer, low over the mountain in winter. */
export function sunArc(year: number, hour = hourAt(year)): SunArc {
  const t = clamp01(hour), noon = 0.36 + 0.64 * (0.5 + 0.5 * sunHeight(year));
  const elevation = Math.sin(Math.PI * t) * noon;
  return { x: 0.08 + 0.84 * t, lift: elevation * 0.84, elevation, gold: clamp01(1 - elevation * 1.5) * 0.9 + 0.1 * bump(year, 0.575, 0.2), day: smoothstep(0, 0.16, elevation) };
}
/** The shadow a standing thing throws on the floor, as the offset of its
 * top from its foot, in units of its own height. The sun is in the sky ahead
 * of the camera, so shadows fall toward the viewer and away from the sun's side. */
export function shadowOf(sun: SunArc, atX: number): { dx: number; dy: number; strength: number } {
  const length = Math.min(1.5, 0.3 / Math.max(0.2, sun.elevation));
  return { dx: (clamp01(atX) - sun.x) * 1.5 * length, dy: 0.4 * length, strength: sun.day * (0.2 + 0.2 * sun.elevation) };
}

/* ── the sky the child can change ───────────────────────────────────────── */

/** What the child has done to the weather on top of the year's own:
 * `clouds` gathered (+) or blown off (−), how `wet` the bed is, and the
 * the fine drops left hanging in the air after rain, which is what a rainbow is made of. */
export interface SkyState { readonly clouds: number; readonly wet: number; readonly mist: number }
export const SKY_TAP = 0.3, SKY_BLOW = 0.42, RAIN_FROM = 0.58;
const CLOUD_EASE_S = 16, WET_RISE_S = 2.6, MIST_FALL_S = 9;
/** The year's own soil: what the bed settles back to when the sky is left alone. */
export function baseWet(year: number): number {
  const y = wrapYear(year), thaw = smoothstep(0.9, 0.95, y) * (1 - smoothstep(0.985, 1, y)) + (1 - smoothstep(0, 0.05, y));
  return clamp01(0.5 + 0.42 * bump(y, 0.16, 0.09) + 0.3 * Math.min(1, thaw) - 0.3 * bump(y, 0.345, 0.16));
}
export function skyStart(year: number): SkyState { return { clouds: 0, wet: baseWet(year), mist: 0 }; }
/** Cloud cover now: the year's, moved by the child. */
export function coverAt(year: number, sky: SkyState): number { return clamp01(cloudCover(year) + sky.clouds); }
/** How warm the air is (0 deep winter … 1 high summer); clouds cool it a little. */
export function warmthAt(year: number, cover = cloudCover(year)): number {
  return clamp01(0.5 + 0.5 * Math.cos(2 * Math.PI * (wrapYear(year) - 0.345)) - 0.07 * (cover - 0.4));
}
export const FREEZE = 0.27;
/** What falls: rain where it is mild, snow where it is cold. 0..1 each. */
export function fallAt(year: number, sky: SkyState): { rain: number; snow: number } {
  const cover = coverAt(year, sky), heavy = smoothstep(RAIN_FROM, 0.92, cover), cold = warmthAt(year, cover) < FREEZE;
  return { rain: cold ? 0 : heavy, snow: Math.max(weatherAt(year).snow * (0.35 + 0.65 * smoothstep(0.2, 0.6, cover)), cold ? heavy : 0) };
}
export function skyTap(sky: SkyState): SkyState { return { ...sky, clouds: Math.min(1, sky.clouds + SKY_TAP) }; }
export function skyBlow(sky: SkyState, strength = 1): SkyState { return { ...sky, clouds: Math.max(-1, sky.clouds - SKY_BLOW * clamp01(strength)) }; }
/** One step of the sky's own life: gathered clouds thin out, rain soaks the
 * bed, sun dries it, mist hangs for a while after rain. */
export function skyStep(sky: SkyState, year: number, seconds: number): SkyState {
  const dt = Math.max(0, Math.min(1, seconds || 0));
  const fall = fallAt(year, sky), base = baseWet(year);
  const clouds = sky.clouds * Math.exp(-dt / CLOUD_EASE_S);
  // A bed dries quickly in bright sun and slowly under cloud.
  const dry = 4 + 9 * (1 - lightAt(year, coverAt(year, sky)));
  const wet = fall.rain > 0.08
    ? Math.min(1, sky.wet + (dt / WET_RISE_S) * (0.4 + 0.6 * fall.rain))
    : base + (sky.wet - base) * Math.exp(-dt / dry);
  const mist = fall.rain > 0.08 ? Math.min(1, sky.mist + dt / 2.2) : sky.mist * Math.exp(-dt / MIST_FALL_S);
  return { clouds: Math.abs(clouds) < 0.002 ? 0 : clouds, wet: clamp01(wet), mist: mist < 0.002 ? 0 : mist };
}
/** How much light reaches the bed (0..1) under a given cloud cover. */
export function lightAt(year: number, cover: number): number { return clamp01((0.5 + 0.5 * sunHeight(year)) * (1 - 0.62 * clamp01(cover)) * 1.22 + 0.05); }
/** LeafLab, read under the sky as it is now. */
export function labRead(year: number, sky: SkyState): LeafLab {
  const cover = coverAt(year, sky);
  return { moisture: clamp01(sky.wet), light: lightAt(year, cover), warmth: warmthAt(year, cover) };
}
/** A rainbow stands where the sun comes out over wet air. */
export function rainbowAt(year: number, sky: SkyState): number {
  const fall = fallAt(year, sky);
  return smoothstep(0.22, 0.5, sky.mist) * smoothstep(0.34, 0.52, labRead(year, sky).light) * (1 - smoothstep(0.05, 0.4, fall.rain)) * (1 - smoothstep(0, 0.3, fall.snow));
}
/** How full the puddles on the floor are. */
export function puddleFill(year: number, sky: SkyState): number {
  return clamp01(Math.max(smoothstep(0.62, 0.95, sky.wet), 0.8 * smoothstep(0.9, 0.95, wrapYear(year)) * (1 - smoothstep(0.99, 1, wrapYear(year))), 0.8 * (1 - smoothstep(0, 0.06, wrapYear(year)))) * (1 - 0.75 * snowDepth(year)));
}

/* ── chapter two: what the seedling asks for ────────────────────────────── */

export type Level = 0 | 1 | 2;
/** An ask: the level each gauge should stand at (null: any will do). */
export interface Ask { readonly id: string; readonly moisture: Level | null; readonly light: Level | null; readonly warmth: Level | null }
export const ASKS: readonly Ask[] = [
  { id: 'springShower', moisture: 2, light: null, warmth: 1 },
  { id: 'summerSun', moisture: 1, light: 2, warmth: 2 },
  { id: 'mildDay', moisture: 1, light: 1, warmth: 1 },
  { id: 'winterRest', moisture: null, light: 0, warmth: 0 },
  { id: 'warmDrink', moisture: 2, light: null, warmth: 2 },
  { id: 'dryBask', moisture: 0, light: 2, warmth: 2 },
];
/** The asks that need the child to make rain (the chapter's new mechanic). */
export const RAIN_ASKS: readonly string[] = ['springShower', 'summerSun', 'warmDrink'];
export const ASK_HOLD_MS = 1100;
export function askMet(ask: Ask, lab: LeafLab): { moisture: boolean; light: boolean; warmth: boolean; all: boolean } {
  const ok = (want: Level | null, value: number) => want === null || labLevel(value) === want;
  const moisture = ok(ask.moisture, lab.moisture), light = ok(ask.light, lab.light), warmth = ok(ask.warmth, lab.warmth);
  return { moisture, light, warmth, all: moisture && light && warmth };
}
/** A small seeded sequence (mulberry32). */
export function seededPlay(seed: number): () => number {
  let a = (Math.floor(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Three asks for one round, never two alike: each next one wants a
 * different warmth (so the dial turns between them) and at least one wants
 * rain made. The seedling's three steps to its flower. */
export function roundAsks(seed: number): Ask[] {
  const random = seededPlay(seed), rounds: Ask[][] = [];
  for (const a of ASKS) for (const b of ASKS) for (const c of ASKS) {
    if (a === b || b === c || a === c || a.warmth === b.warmth || b.warmth === c.warmth) continue;
    if (![a, b, c].some(ask => RAIN_ASKS.includes(ask.id))) continue;
    rounds.push([a, b, c]);
  }
  return rounds[Math.min(rounds.length - 1, Math.floor(random() * rounds.length))];
}
/** Whether any weather the child can make answers the ask (the tests walk
 * every ask through this; it is also how the coach knows which way to nudge). */
export function askAnswer(ask: Ask): { year: number; sky: SkyState } | null {
  for (let i = 0; i < 48; i++) for (const clouds of [-0.6, -0.3, 0, 0.3, 0.6]) for (const wet of [0.1, 0.5, 0.9]) {
    const year = i / 48, sky = { clouds, wet, mist: 0 };
    if (askMet(ask, labRead(year, sky)).all) return { year, sky };
  }
  return null;
}
/** Which way to nudge: the first gauge that is off, and whether it wants more (+1) or less (−1). */
export function askNudge(ask: Ask, lab: LeafLab): { gauge: 'moisture' | 'light' | 'warmth'; way: 1 | -1 } | null {
  for (const gauge of ['warmth', 'moisture', 'light'] as const) {
    const want = ask[gauge]; if (want === null) continue;
    const have = labLevel(lab[gauge]);
    if (have !== want) return { gauge, way: have < want ? 1 : -1 };
  }
  return null;
}

/* ── chapter three: the year the child conducts ─────────────────────────── */

/** How far round the year the child has carried the dial since the start
 * (forward only: a turn back loses nothing, and counts for nothing). */
export function conductProgress(fromTurns: number, furthestTurns: number): number { return clamp01(furthestTurns - fromTurns); }
/** The four quarters of the conducted year that are done. */
export function conductQuarters(progress: number): number { return Math.min(4, Math.floor(clamp01(progress) * 4 + 1e-6)); }
/** A touch the child made while conducting, kept for the time-lapse:
 * where on the stage, and at which point of the year. */
export interface Mark { readonly year: number; readonly x: number; readonly y: number; readonly kind: 'tapSky' | 'tapTree' | 'tapFloor' | 'blow' }
export const MARKS_MAX = 24;
export function addMark(marks: readonly Mark[], mark: Mark): Mark[] { return marks.length >= MARKS_MAX ? [...marks.slice(1), mark] : [...marks, mark]; }

/* ── the set-piece: the year as a time-lapse ────────────────────────────── */

export const LAPSE_MS = 9200, LAPSE_HOLD_MS = 3400, LAPSE_DAYS = 6;
/** The hour the film ends on: late, low and gold. */
export const GOLDEN_HOUR = 0.86;
export interface LapseFrame { readonly turns: number; readonly hour: number; readonly zoom: number; readonly gold: number; readonly done: boolean }
/** The time-lapse at `t` (0..1): the year runs once round from where the
 * child began and on to the season they chose to rest in; the sun crosses
 * the sky `LAPSE_DAYS` times and comes to rest at golden hour; the camera
 * starts close on the tree and pulls back for the whole valley. */
export function lapseAt(t: number, fromTurns: number, restSeason: Season): LapseFrame {
  const s = clamp01(t), run = easeInOut(clamp01(s / 0.86));
  let onward = shortestTurn(wrapYear(fromTurns), SEASON_CENTERS[restSeason]);
  if (onward < 0) onward += 1;
  const settle = smoothstep(0.8, 1, s);
  const day = (run * LAPSE_DAYS) % 1;
  return { turns: fromTurns + run * (1 + onward), hour: lerp(day, GOLDEN_HOUR, settle), zoom: lerp(1.5, 1, easeInOut(clamp01(s / 0.7))), gold: settle, done: s >= 1 };
}
/** Reduced motion: the film is five still pictures (the four seasons in
 * order from where the child began, then the chosen one at golden hour). */
export function lapseStills(fromTurns: number, restSeason: Season): { year: number; gold: number }[] {
  const first = Math.floor(wrapYear(fromTurns) * 4 + 0.2) % 4;
  return [0, 1, 2, 3].map(i => ({ year: SEASON_CENTERS[(first + i) % 4], gold: 0 })).concat([{ year: SEASON_CENTERS[restSeason], gold: 1 }]);
}

/* ── replay variety ─────────────────────────────────────────────────────── */

export interface RoundPlan { readonly seed: number; readonly asks: readonly Ask[]; /** Which way the clouds drift, and how they are laid out. */ readonly drift: 1 | -1; readonly cloudSeed: number; readonly tune: number }
export function roundPlan(seed: number): RoundPlan {
  const random = seededPlay(seed * 31 + 7);
  return { seed, asks: roundAsks(seed), drift: random() < 0.5 ? 1 : -1, cloudSeed: Math.floor(random() * 1e6), tune: Math.floor(random() * 3) };
}
/** The secret: the mountain answers the third knock. */
export const ECHO_KNOCKS = 3;
