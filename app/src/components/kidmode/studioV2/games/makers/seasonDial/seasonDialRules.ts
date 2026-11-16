/** Weather Maker rules. Pure: no React, no timers, no randomness inside.
 *
 * The whole toy has ONE state: `year`, a number in [0, 1) that wraps
 * (0 early spring, .25 summer, .5 autumn, .75 winter). Every colour, size,
 * opacity, particle density and sound level is a function of `year` (plus a
 * slow ambient clock for sway), so however the dial was turned to get there,
 * the scene is the one that `year` names: no stale snow, leaves or sound.
 *
 * Colours are never literals here: a `Paint` names makerPalette tokens
 * (`--mk-<name>`) and how much of each to mix, and the component turns it
 * into a CSS `color-mix()` (or, for the canvas, into resolved values). */

/** A palette token name (without `--mk-`), or a mix of two paints: `t` is
 * the share of `b` (0 = all `a`, 1 = all `b`). */
export type Paint = string | { readonly a: Paint; readonly b: Paint; readonly t: number };
export type Season = 0 | 1 | 2 | 3;
export const SEASONS: readonly Season[] = [0, 1, 2, 3];
export const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'] as const;

/** The heart of each season on the year: the dial's detents, the season
 * buttons' targets and the middle of each quarter of the dial face. They sit
 * a little after the spec's .0/.25/.5/.75 anchors so that the heart of spring
 * is full blossom, of autumn is the turned crown, of winter is snow. */
export const SEASON_CENTERS: readonly number[] = [0.075, 0.325, 0.575, 0.825];
/** One step of the step buttons and arrow keys: half a month. */
export const YEAR_STEP = 1 / 24;
/** A season counts as visited once the dial has rested in it this long. */
export const REST_MS = 1500;
/** A season button turns the year the short way round in this long. */
export const TURN_MS = 1200;
/** The "full year" lap the pointer takes by itself. */
export const LAP_MS = 9000;
/** With reduced motion the lap is four cuts, one per season, this long each. */
export const LAP_CUT_MS = 1100;
/** Half the width of a detent's pull, in years. */
export const DETENT_WIDTH = 0.02;
/** Degrees the pointer stands at for year 0: puts each season's heart on a
 * diagonal of the dial, so the four quarters meet on the plain axes. */
export const DIAL_OFFSET_DEG = 45 - SEASON_CENTERS[0] * 360;
/** At most this many weather particles are drawn at once. */
export const PARTICLE_CAP = 120;

const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);
/** Any number onto the year: [0, 1). */
export function wrapYear(value: number): number {
  const v = finite(value);
  const w = v - Math.floor(v);
  return w >= 1 ? 0 : w;
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, finite(v)));
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
/** The short way from `from` to `to` around the year: (-.5, .5]. */
export function shortestTurn(from: number, to: number): number {
  let d = wrapYear(to) - wrapYear(from);
  if (d > 0.5) d -= 1;
  if (d <= -0.5) d += 1;
  return d;
}
/** Distance between two points of the year, the short way: [0, .5]. */
export function yearDistance(a: number, b: number): number {
  return Math.abs(shortestTurn(a, b));
}

/** Which season a point of the year belongs to (quarters around the hearts). */
export function seasonAt(year: number): Season {
  const shifted = wrapYear(year - SEASON_CENTERS[0] + 0.125);
  return Math.min(3, Math.floor(shifted * 4)) as Season;
}

/** The pointer's angle in degrees, clockwise from twelve o'clock. Unwrapped
 * `turns` (whole laps kept) so the knurled rim visibly keeps turning. */
export function turnsToAngle(turns: number): number {
  return finite(turns) * 360 + DIAL_OFFSET_DEG;
}
export function yearToAngle(year: number): number {
  return wrapYear(year) * 360 + DIAL_OFFSET_DEG;
}
/** The year a finger at `deg` (clockwise from twelve) points to. */
export function angleToYear(deg: number): number {
  return wrapYear((finite(deg) - DIAL_OFFSET_DEG) / 360);
}
/** The finger's angle around the dial centre, clockwise from twelve: [0, 360). */
export function pointerAngle(dx: number, dy: number): number {
  const deg = (Math.atan2(finite(dx), -finite(dy)) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}
/** How far the finger turned between two angles, the short way, in turns. */
export function angleDelta(fromDeg: number, toDeg: number): number {
  return shortestTurn(finite(fromDeg) / 360, finite(toDeg) / 360);
}

/** The light detents: near a season's heart the dial is pulled onto it (the
 * pull is continuous, so the pointer never jumps). Returns the year shown. */
export function detent(year: number, width = DETENT_WIDTH): number {
  const y = wrapYear(year);
  for (const c of SEASON_CENTERS) {
    const d = shortestTurn(c, y);
    if (Math.abs(d) < width) return wrapYear(c + (d * Math.abs(d)) / width);
  }
  return y;
}
/** The season whose heart `year` sits on (within `within`), or null. */
export function detentAt(year: number, within = 0.004): Season | null {
  for (const s of SEASONS) if (yearDistance(year, SEASON_CENTERS[s]) <= within) return s;
  return null;
}

/** Step buttons and arrow keys: half a month on or back. */
export function stepYear(year: number, steps: number): number {
  return wrapYear(year + finite(steps) * YEAR_STEP);
}
/** The heart of the next (dir 1) or previous (dir -1) season from `year`. */
export function nextSeasonCenter(year: number, dir: 1 | -1): number {
  const y = wrapYear(year), s = seasonAt(y), d = shortestTurn(y, SEASON_CENTERS[s]);
  if (dir === 1) return d > 0.004 ? SEASON_CENTERS[s] : SEASON_CENTERS[(s + 1) % 4];
  return d < -0.004 ? SEASON_CENTERS[s] : SEASON_CENTERS[(s + 3) % 4];
}
/** Ease in and out, for the season buttons' turns and the lap. */
export function easeInOut(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
/** A season button's turn: where the year is `t` of the way along the short
 * way from `from` to `to`. Unwrapped, so the rim turns the short way too. */
export function turnAt(fromTurns: number, toYear: number, t: number): number {
  return finite(fromTurns) + shortestTurn(wrapYear(fromTurns), toYear) * easeInOut(t);
}

/* ── visiting: a season the dial has rested in lights its badge ─────────── */

export interface RestState { readonly season: Season; readonly since: number; readonly lit: number }
export function restStart(year: number, now: number): RestState {
  return { season: seasonAt(year), since: finite(now), lit: 0 };
}
/** Fold one moment into the rest state: a new season restarts the clock;
 * staying `REST_MS` lights the season's badge (a bit in `lit`). */
export function restStep(state: RestState, year: number, now: number, restMs = REST_MS): RestState {
  const season = seasonAt(year), at = finite(now, state.since);
  if (season !== state.season) return { season, since: at, lit: state.lit };
  if (at - state.since >= restMs && !(state.lit & (1 << season))) return { ...state, lit: state.lit | (1 << season) };
  return state;
}
export const isLit = (lit: number, season: Season) => (lit & (1 << season)) !== 0;
export const fullYear = (lit: number) => (lit & 15) === 15;
/** How long until the current rest would light a badge (null: lit already). */
export function restRemaining(state: RestState, now: number, restMs = REST_MS): number | null {
  if (isLit(state.lit, state.season)) return null;
  return Math.max(0, restMs - (finite(now) - state.since));
}

/* ── shaping the year ───────────────────────────────────────────────────── */

/** A soft bump around `center` (cyclic), 1 at the centre, 0 at ±halfWidth. */
export function bump(year: number, center: number, halfWidth: number): number {
  const d = yearDistance(year, center);
  return d >= halfWidth ? 0 : 0.5 * (1 + Math.cos((Math.PI * d) / halfWidth));
}
/** 0 → 1 over [a, b] then 1 → 0 over [c, d], on the year; handles a window that wraps. */
export function window4(year: number, a: number, b: number, c: number, d: number): number {
  const y = wrapYear(year - a), B = wrapYear(b - a), C = wrapYear(c - a), D = wrapYear(d - a) || 1;
  if (y >= D) return 0;
  if (y < B) return smoothstep(0, B, y);
  if (y < C) return 1;
  return 1 - smoothstep(C, D, y);
}

/** Interpolates cyclic keyframes of paints. `keys` sorted by position in [0, 1). */
export function cyclicPaint(keys: readonly (readonly [number, Paint])[], year: number): Paint {
  const n = keys.length;
  let y = wrapYear(year);
  if (y < keys[0][0]) y += 1;
  for (let i = 0; i < n; i++) {
    const p0 = keys[i][0], p1 = i + 1 < n ? keys[i + 1][0] : keys[0][0] + 1;
    if (y >= p0 && y < p1) return mixPaint(keys[i][1], keys[(i + 1) % n][1], smoothstep(p0, p1, y));
  }
  return keys[0][1];
}
export function mixPaint(a: Paint, b: Paint, t: number): Paint {
  const s = clamp01(t);
  if (s <= 0.0005) return a;
  if (s >= 0.9995) return b;
  return { a, b, t: Math.round(s * 1000) / 1000 };
}

/* ── the sky, the sun, the light ────────────────────────────────────────── */

const mix = (a: Paint, b: Paint, t: number): Paint => ({ a, b, t });
export interface Sky { readonly top: Paint; readonly mid: Paint; readonly low: Paint }
const SKY_TOP: readonly (readonly [number, Paint])[] = [
  [0.02, mix('sky', 'bluebell', 0.28)], [0.15, mix('storm-grey', 'sky', 0.45)], [0.32, mix('water', 'sky', 0.35)],
  [0.57, mix('sky', 'bluebell', 0.55)], [0.82, mix('steel', 'lilac', 0.35)],
];
const SKY_MID: readonly (readonly [number, Paint])[] = [
  [0.02, mix('sky', 'sky-pale', 0.35)], [0.15, mix('steel-light', 'sky', 0.4)], [0.32, 'sky'],
  [0.57, mix('sky-pale', 'butter', 0.45)], [0.82, mix('snow-shade', 'chalk', 0.4)],
];
const SKY_LOW: readonly (readonly [number, Paint])[] = [
  [0.02, mix('sky-pale', 'blossom', 0.3)], [0.15, mix('sky-pale', 'chalk', 0.5)], [0.32, mix('sky-pale', 'butter', 0.2)],
  [0.57, mix('amber', 'butter', 0.4)], [0.82, mix('blossom', 'chalk', 0.35)],
];
export function skyAt(year: number): Sky {
  return { top: cyclicPaint(SKY_TOP, year), mid: cyclicPaint(SKY_MID, year), low: cyclicPaint(SKY_LOW, year) };
}

export interface Sun { readonly x: number; readonly y: number; readonly r: number; readonly core: Paint; readonly glow: Paint; readonly glowR: number; readonly glowAlpha: number }
/** 1 at the height of summer, -1 in deep winter. */
export function sunHeight(year: number): number {
  return Math.cos(2 * Math.PI * (wrapYear(year) - 0.32));
}
const SUN_CORE: readonly (readonly [number, Paint])[] = [[0.02, mix('butter', 'white', 0.3)], [0.32, 'sun'], [0.57, mix('amber', 'sun', 0.25)], [0.82, mix('butter', 'blossom', 0.35)]];
const SUN_GLOW: readonly (readonly [number, Paint])[] = [[0.02, 'butter'], [0.32, 'sun'], [0.57, 'orange'], [0.82, 'blossom']];
/** The sun stands high in summer and low over the hills in winter (light is
 * always from the top left). Viewbox units: the scene is 400 by 320. */
export function sunAt(year: number): Sun {
  const e = sunHeight(year), warm = bump(year, 0.57, 0.2);
  return {
    x: 92 - 18 * e, y: 98 - 50 * e, r: 17 + 3 * (1 - e) * 0.5,
    core: cyclicPaint(SUN_CORE, year), glow: cyclicPaint(SUN_GLOW, year),
    glowR: 48 + 26 * warm + 10 * (1 - e) * 0.5, glowAlpha: 0.45 + 0.25 * warm - 0.12 * bump(year, 0.15, 0.08),
  };
}
export interface Light { readonly warm: number; readonly cool: number; readonly shadow: number; readonly shadowLength: number }
/** The scene's light: warm long light in autumn, cool blue-lilac in winter,
 * and how strong and long the tree's shadow is. */
export function lightAt(year: number): Light {
  const e = sunHeight(year);
  return {
    warm: bump(year, 0.57, 0.17) * 0.9 + bump(year, 0.32, 0.12) * 0.15, cool: bump(year, 0.82, 0.16),
    shadow: 0.16 + 0.12 * Math.max(0, e) - 0.08 * bump(year, 0.15, 0.08), shadowLength: 1 + 0.9 * (1 - e) * 0.5,
  };
}
/** How cloudy: 0 clear, 1 heavy. Spring showers and winter are cloudiest. */
export function cloudCover(year: number): number {
  return clamp01(0.25 + 0.6 * bump(year, 0.15, 0.1) - 0.15 * bump(year, 0.34, 0.12) + 0.25 * bump(year, 0.62, 0.12) + 0.5 * bump(year, 0.82, 0.14));
}
const CLOUD: readonly (readonly [number, Paint])[] = [[0.02, 'white'], [0.15, mix('steel-light', 'storm-grey', 0.35)], [0.32, 'white'], [0.57, mix('white', 'butter', 0.4)], [0.82, mix('chalk', 'snow-shade', 0.45)]];
export function cloudPaint(year: number): Paint { return cyclicPaint(CLOUD, year); }

/* ── the ground ─────────────────────────────────────────────────────────── */

export interface Ground { readonly near: Paint; readonly nearShade: Paint; readonly far: Paint; readonly treeline: Paint; readonly grass: number }
const NEAR: readonly (readonly [number, Paint])[] = [
  [0.02, mix('spring', 'sage', 0.35)], [0.14, 'spring'], [0.32, mix('leaf', 'spring', 0.25)], [0.5, mix('moss', 'sand', 0.35)],
  [0.62, mix('sand', 'wood', 0.35)], [0.78, mix('sage', 'steel', 0.45)], [0.92, mix('moss', 'umber', 0.25)],
];
const NEAR_SHADE: readonly (readonly [number, Paint])[] = [
  [0.02, mix('leaf', 'sage', 0.4)], [0.14, mix('leaf', 'spring', 0.3)], [0.32, 'leaf-deep'], [0.5, mix('moss', 'umber', 0.25)],
  [0.62, mix('wood', 'umber', 0.4)], [0.78, mix('slate', 'sage', 0.4)], [0.92, mix('moss', 'umber', 0.45)],
];
const FAR: readonly (readonly [number, Paint])[] = [
  [0.02, mix('sage', 'sky', 0.25)], [0.14, mix('spring', 'sky', 0.3)], [0.32, mix('leaf', 'sky', 0.35)], [0.57, mix('amber', 'sky-pale', 0.35)],
  [0.82, mix('snow-shade', 'lilac', 0.3)],
];
const TREELINE: readonly (readonly [number, Paint])[] = [
  [0.02, mix('celadon-deep', 'sky', 0.3)], [0.14, mix('leaf', 'sky', 0.35)], [0.32, mix('leaf-deep', 'sky', 0.3)], [0.57, mix('rust', 'lilac', 0.35)],
  [0.82, mix('slate', 'lilac', 0.45)],
];
export function groundAt(year: number): Ground {
  return {
    near: cyclicPaint(NEAR, year), nearShade: cyclicPaint(NEAR_SHADE, year), far: cyclicPaint(FAR, year), treeline: cyclicPaint(TREELINE, year),
    grass: window4(year, 0.98, 0.12, 0.42, 0.56),
  };
}
/** Snow on the ground: none until early winter, thickens, holds, then melts
 * into spring puddles. 0 none, 1 full cover. */
export function snowDepth(year: number): number {
  return window4(year, 0.71, 0.8, 0.88, 0.96);
}
/** Snow lying on the bare branches (thinner and later than on the ground). */
export function snowCap(year: number): number {
  return window4(year, 0.72, 0.78, 0.86, 0.915);
}
/** Melt-water puddles on the meadow at the end of winter. */
export function puddles(year: number): number {
  return window4(year, 0.9, 0.95, 0.99, 0.06);
}
/** The carpet of fallen leaves under the tree: grows as the crown empties,
 * then the snow covers it and it is gone by spring. */
export function fallenLeaves(year: number): number {
  return window4(year, 0.5, 0.68, 0.72, 0.8);
}

/** Wild flowers in the meadow: spring into early summer. */
export function meadowFlowers(year: number): number {
  return window4(year, 0.02, 0.12, 0.3, 0.42);
}

/* ── the tree ───────────────────────────────────────────────────────────── */

/** Each leaf's own thresholds, all in [0, 1). The tree generator correlates
 * them with where the leaf hangs, so the change sweeps through the crown. */
export interface LeafSeed { readonly grow: number; readonly turn: number; readonly fall: number; readonly hue: number }
export interface LeafState {
  /** 0 bare twig → 1 full-grown leaf. */
  readonly size: number;
  /** Along LEAF_RAMP: 0 fresh spring green … 1.6 summer green … 5 red. */
  readonly tint: number;
  /** 1 on the twig, 0 gone. */
  readonly on: number;
  /** 0 hanging, 1 dropped away (the short fall as it lets go). */
  readonly drop: number;
}
export const LEAF_RAMP = ['spring', 'leaf', 'leaf-deep', 'amber', 'orange', 'red'] as const;
const clampSeed = (v: number) => Math.min(0.999, Math.max(0, finite(v)));
/** When this leaf lets go: across .5–.68, by its own seed. */
export function leafFallAt(seed: LeafSeed): number { return 0.5 + clampSeed(seed.fall) * 0.18; }
export function leafState(seed: LeafSeed, year: number): LeafState {
  const y = wrapYear(year);
  const growAt = 0.045 + clampSeed(seed.grow) * 0.05;
  const fallAt = leafFallAt(seed);
  // After the leaf has gone (and through winter, until it buds again) it is not there.
  if (y >= fallAt + 0.014 || y < growAt) return { size: 0, tint: 0, on: 0, drop: 0 };
  const size = smoothstep(growAt, growAt + 0.15, y);
  const green = 1.6 * smoothstep(0.08, 0.3, y);
  const turnAt = 0.38 + clampSeed(seed.turn) * 0.12;
  const reach = 0.62 + clampSeed(seed.hue) * 0.38;
  const tint = green + 3 * reach * smoothstep(turnAt, turnAt + 0.1, y);
  const on = smoothstep(growAt, growAt + 0.02, y) * (1 - smoothstep(fallAt, fallAt + 0.014, y));
  const drop = smoothstep(fallAt - 0.004, fallAt + 0.014, y);
  return { size, tint, on, drop };
}
/** Blossom on the bare-ish twigs at the start of spring: opens over 0–.04,
 * full to ~.08, then sheds its petals by ~.13 (by its own seed). */
export function blossomState(seed: number, year: number): { open: number; on: number } {
  const s = clampSeed(seed);
  const openAt = wrapYear(-0.005 + s * 0.03), shedAt = 0.085 + s * 0.035;
  // `on` is the flower being there at all; `open` how far its petals have opened.
  return { open: window4(year, openAt, openAt + 0.045, shedAt + 0.02, shedAt + 0.03), on: window4(year, wrapYear(openAt - 0.01), openAt, shedAt, shedAt + 0.02) };
}
/** Buds swell on the bare twigs at the very end of winter (.92) and give way
 * to blossom and leaf by .06. */
export function budState(seed: number, year: number): number {
  const s = clampSeed(seed);
  return window4(year, 0.9 + s * 0.03, 0.97, 0.02 + s * 0.015, 0.065);
}
/** Little apples: they set in early summer, swell and redden, and are gone
 * (picked, fallen) before the leaves fall. `red` 0 green → 1 red. */
export function appleState(seed: number, year: number): { size: number; red: number } {
  const s = clampSeed(seed), y = wrapYear(year);
  const size = window4(y, 0.2 + s * 0.04, 0.34, 0.47 + s * 0.03, 0.52 + s * 0.03);
  return { size, red: smoothstep(0.26, 0.4, y) };
}

/* ── weather, life and sound ────────────────────────────────────────────── */

export interface Weather { readonly rain: number; readonly petals: number; readonly leaves: number; readonly snow: number; readonly butterflies: number; readonly cloudShadows: number }
/** Particle densities, 0..1 each. Individual particles are ambient; how many show is the year's. */
export function weatherAt(year: number): Weather {
  return {
    rain: bump(year, 0.16, 0.075), petals: bump(year, 0.105, 0.04), leaves: bump(year, 0.6, 0.1),
    snow: Math.max(bump(year, 0.81, 0.1), 0.5 * snowCap(year)),
    butterflies: bump(year, 0.34, 0.11), cloudShadows: bump(year, 0.33, 0.13),
  };
}
/** How many of each particle to draw (within PARTICLE_CAP in all). */
export const PARTICLE_MAX = { rain: 70, petals: 26, leaves: 26, snow: 90 } as const;
export function particleCounts(w: Weather): { rain: number; petals: number; leaves: number; snow: number } {
  const want = {
    rain: Math.round(PARTICLE_MAX.rain * clamp01(w.rain)), petals: Math.round(PARTICLE_MAX.petals * clamp01(w.petals)),
    leaves: Math.round(PARTICLE_MAX.leaves * clamp01(w.leaves)), snow: Math.round(PARTICLE_MAX.snow * clamp01(w.snow)),
  };
  const total = want.rain + want.petals + want.leaves + want.snow;
  if (total <= PARTICLE_CAP) return want;
  const k = PARTICLE_CAP / total;
  return { rain: Math.floor(want.rain * k), petals: Math.floor(want.petals * k), leaves: Math.floor(want.leaves * k), snow: Math.floor(want.snow * k) };
}
/** The small life of the scene, each fading in and out with the year. */
export function lifeAt(year: number): { birds: number; squirrel: number; snowman: number } {
  return { birds: window4(year, 0.0, 0.05, 0.36, 0.44), squirrel: window4(year, 0.47, 0.52, 0.64, 0.69), snowman: window4(year, 0.76, 0.8, 0.88, 0.93) };
}
export interface Gains { readonly birds: number; readonly insects: number; readonly wind: number; readonly rain: number; readonly chimes: number }
/** Sound levels, 0..1: one audio graph whose layers are set from `year`, so
 * turning back and forth can never stack sounds. */
export function gains(year: number): Gains {
  return {
    birds: window4(year, 0.96, 0.03, 0.3, 0.44), insects: bump(year, 0.36, 0.12), wind: Math.max(bump(year, 0.6, 0.12), 0.35 * bump(year, 0.8, 0.1)),
    rain: bump(year, 0.16, 0.075), chimes: bump(year, 0.82, 0.11),
  };
}

/** Which of the eight described moments of the year (the copy's `phases`):
 * late-winter buds, blossom, spring rain, summer, late summer, autumn
 * colour, falling leaves, winter snow. */
export const PHASE_STARTS: readonly number[] = [0.92, 0.03, 0.12, 0.22, 0.38, 0.5, 0.6, 0.72];
export function phaseAt(year: number): number {
  const y = wrapYear(year);
  if (y >= PHASE_STARTS[0] || y < PHASE_STARTS[1]) return 0;
  for (let i = PHASE_STARTS.length - 1; i >= 1; i--) if (y >= PHASE_STARTS[i]) return i;
  return 0;
}
/** Fills the numbered blanks of a line: `{0}` is the first value. */
export function seasonLine(template: string, ...values: (string | number)[]): string {
  return template.replace(/\{(\d)\}/g, (_match, slot: string) => String(values[Number(slot)] ?? ''));
}
