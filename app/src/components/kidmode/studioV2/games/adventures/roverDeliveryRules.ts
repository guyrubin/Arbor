import type { Challenge } from './adventureRules';

/** Rover Delivery: a toy rover drives straight across a top-down floor until a
 * guide sign turns it. The child turns the signs, presses start and watches
 * the same rover run. A run that parks somewhere else loses nothing: one thing
 * is changed and the rover goes again.
 *
 * Headings are compass codes on the board, never reading directions: `n` is
 * the top row in every language. A cell is `row * size + column`, row 0 on top. */
export type Heading = 'n' | 'e' | 's' | 'w';
/** Clockwise from the top, a quarter turn apart. */
export const HEADINGS: readonly Heading[] = ['n', 'e', 's', 'w'];
export type RoverEnd = 'goal' | 'edge' | 'planter' | 'bloom' | 'loop';

export interface RoverSign { readonly cell: number; readonly initial: Heading; readonly fix: Heading }
export interface RoverLevel {
  readonly size: number;
  readonly start: number;
  readonly heading: Heading;
  readonly goal: number;
  /** In the order the finished route meets them. */
  readonly signs: readonly RoverSign[];
  readonly planters: readonly number[];
  /** A soft flower on the way: open it stops the rover, folded down it does not. */
  readonly bloom?: number;
}
export interface RoverRun {
  /** Every cell the rover stood on, the start first. */
  path: number[];
  /** The way the rover faced on each of those cells, after any sign there. */
  headings: Heading[];
  end: RoverEnd;
  /** Where the rover stopped. */
  at: number;
}
/** Where the rover stands and how far it has turned, in quarter turns clockwise
 * from the top. The turn only ever moves by the short way round, so the picture
 * never spins the long way. */
export interface RoverPlace { cell: number; turn: number }
/** What to point out after a few runs: a sign by its place in the level, or the flower. */
export type RoverHint = number | 'bloom' | null;

export const ROVER_ROUNDS = 3;
/** One cell of driving. */
export const STEP_MS = 420;
/** The same rover rolling back to its start before it goes again. */
export const RETURN_MS = 300;
/** How long the hero holds the start press. */
export const PRESS_MS = 480;
/** Pep and the rover together, long enough to enjoy, before the next floor. */
export const ARRIVED_MS = 3200;
/** The hero shrugging off a run that parked somewhere else. */
export const OOPS_MS = 700;
/** Parked runs on one floor before one thing to change is pointed out. */
export const HINT_AFTER = 2;

/** Three floors a challenge, each one small step up. Every floor has exactly
 * one setting that reaches the rug, and its first setting never does.
 *
 * Little adventure, 3 by 3: one sign a quarter turn away; one sign two turns
 * away (the first try stops at the edge, a planter blocks a wrong guess); two
 * signs, one of them already right.
 * Bigger adventure, 4 by 4: two signs, one to turn; two signs behind a wall of
 * planters, both to turn; three signs and a flower to fold on the only way. */
const LEVELS: Record<Challenge, readonly RoverLevel[]> = {
  gentle: [
    { size: 3, start: 6, heading: 'n', goal: 2, signs: [{ cell: 0, initial: 'n', fix: 'e' }], planters: [] },
    { size: 3, start: 3, heading: 'e', goal: 7, signs: [{ cell: 4, initial: 'n', fix: 's' }], planters: [5] },
    { size: 3, start: 6, heading: 'n', goal: 8, signs: [{ cell: 0, initial: 'e', fix: 'e' }, { cell: 2, initial: 'e', fix: 's' }], planters: [4] },
  ],
  explore: [
    { size: 4, start: 12, heading: 'e', goal: 7, signs: [{ cell: 13, initial: 'n', fix: 'n' }, { cell: 5, initial: 'n', fix: 'e' }], planters: [] },
    { size: 4, start: 4, heading: 'e', goal: 15, signs: [{ cell: 5, initial: 'e', fix: 's' }, { cell: 13, initial: 'n', fix: 'e' }], planters: [6, 10] },
    { size: 4, start: 12, heading: 'n', goal: 14, signs: [{ cell: 0, initial: 'e', fix: 'e' }, { cell: 3, initial: 'e', fix: 's' }, { cell: 15, initial: 's', fix: 'w' }], planters: [5, 9, 13], bloom: 11 },
  ],
};

/** B-GAME-46: each play again turns every floor a quarter turn clockwise, so
 * a replay is a fresh map. A turn of the whole floor keeps its one answer and
 * how many presses each sign needs; only where things stand changes. */
export const ROVER_SPINS = 4;

function spinCell(cell: number, size: number): number {
  const row = Math.floor(cell / size), column = cell % size;
  return column * size + (size - 1 - row);
}

export function spinLevel(level: RoverLevel, spin: number): RoverLevel {
  const times = ((Math.trunc(spin) % ROVER_SPINS) + ROVER_SPINS) % ROVER_SPINS;
  let next = level;
  for (let at = 0; at < times; at++) {
    const size = next.size, cell = (value: number) => spinCell(value, size);
    next = {
      size,
      start: cell(next.start),
      heading: quarterTurn(next.heading),
      goal: cell(next.goal),
      signs: next.signs.map(sign => ({ cell: cell(sign.cell), initial: quarterTurn(sign.initial), fix: quarterTurn(sign.fix) })),
      planters: next.planters.map(cell),
      ...(next.bloom === undefined ? {} : { bloom: cell(next.bloom) }),
    };
  }
  return next;
}

export function levelFor(challenge: Challenge, round: number, spin = 0): RoverLevel {
  const levels = LEVELS[challenge];
  const level = levels[Number.isInteger(round) ? Math.min(Math.max(round, 0), levels.length - 1) : 0];
  return spin ? spinLevel(level, spin) : level;
}

export function isHeading(value: unknown): value is Heading {
  return value === 'n' || value === 'e' || value === 's' || value === 'w';
}
/** A quarter turn clockwise: what one tap on a sign does. */
export function quarterTurn(heading: Heading): Heading { return HEADINGS[(HEADINGS.indexOf(heading) + 1) % HEADINGS.length]; }
/** Quarter turns clockwise from the top. */
export function turnsOf(heading: Heading): number { return HEADINGS.indexOf(heading); }
/** The heading after any number of quarter turns, forwards or back. */
export function headingOf(turns: number): Heading {
  const whole = Number.isFinite(turns) ? Math.round(turns) : 0;
  return HEADINGS[((whole % HEADINGS.length) + HEADINGS.length) % HEADINGS.length];
}
/** The nearest count of quarter turns that faces `heading`, from where the
 * rover faces now: a quarter back instead of three quarters on. */
export function faceToward(turns: number, heading: Heading): number {
  const whole = Number.isFinite(turns) ? Math.round(turns) : 0;
  const ahead = (((turnsOf(heading) - whole) % HEADINGS.length) + HEADINGS.length) % HEADINGS.length;
  return whole + (ahead === HEADINGS.length - 1 ? -1 : ahead);
}

export function cellColumn(cell: number, size: number): number { return cell % size; }
export function cellRow(cell: number, size: number): number { return Math.floor(cell / size); }

const STEP: Record<Heading, readonly [column: number, row: number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
/** The next cell that way, or -1 when it would leave the floor. */
export function roverStep(cell: number, heading: Heading, size: number): number {
  const column = cellColumn(cell, size) + STEP[heading][0], row = cellRow(cell, size) + STEP[heading][1];
  return column < 0 || column >= size || row < 0 || row >= size ? -1 : row * size + column;
}

/** One whole run, worked out before the rover moves. It drives straight; a
 * sign cell turns it; the rug ends the run. Leaving the floor, a planter or an
 * open flower parks it on the cell before. A cell met twice facing the same
 * way is a circle, and the run stops there, so no setting can run on.
 * A sign with no valid direction given keeps its first one. */
export function runRover(level: RoverLevel, signDirs: readonly Heading[], bloomFolded: boolean): RoverRun {
  const signs = new Map<number, Heading>();
  level.signs.forEach((sign, index) => { const set: unknown = signDirs[index]; signs.set(sign.cell, isHeading(set) ? set : sign.initial); });
  let cell = level.start, heading = signs.get(cell) ?? level.heading;
  const path = [cell], headings = [heading], seen = new Set<string>([`${cell}:${heading}`]);
  for (let move = 0; move < level.size * level.size * HEADINGS.length; move++) {
    const next = roverStep(cell, heading, level.size);
    if (next < 0) return { path, headings, end: 'edge', at: cell };
    if (level.planters.includes(next)) return { path, headings, end: 'planter', at: cell };
    if (next === level.bloom && !bloomFolded) return { path, headings, end: 'bloom', at: cell };
    cell = next; heading = signs.get(cell) ?? heading;
    path.push(cell); headings.push(heading);
    if (cell === level.goal) return { path, headings, end: 'goal', at: cell };
    const state = `${cell}:${heading}`;
    if (seen.has(state)) return { path, headings, end: 'loop', at: cell };
    seen.add(state);
  }
  return { path, headings, end: 'loop', at: cell };
}

export function initialSigns(level: RoverLevel): Heading[] { return level.signs.map(sign => sign.initial); }
export function fixSigns(level: RoverLevel): Heading[] { return level.signs.map(sign => sign.fix); }
export function initialTurns(level: RoverLevel): number[] { return level.signs.map(sign => turnsOf(sign.initial)); }
export function roverAtStart(level: RoverLevel): RoverPlace { return { cell: level.start, turn: turnsOf(level.heading) }; }

/** The first thing along the finished route that is not set yet: a sign that
 * still shows another way, or the flower while it is open. One thing, never
 * the whole answer. */
export function roverHint(level: RoverLevel, signDirs: readonly Heading[], bloomFolded: boolean): RoverHint {
  for (const cell of runRover(level, fixSigns(level), true).path) {
    const index = level.signs.findIndex(sign => sign.cell === cell);
    if (index >= 0 && signDirs[index] !== level.signs[index].fix) return index;
    if (cell === level.bloom && !bloomFolded) return 'bloom';
  }
  const other = level.signs.findIndex((sign, index) => signDirs[index] !== sign.fix);
  return other >= 0 ? other : null;
}

const WAVE = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1] as const;
/** The soft tone for each cell driven: up the six tones and back down. */
export function roverTone(move: number): number {
  const whole = Number.isFinite(move) ? Math.trunc(move) : 0;
  return WAVE[((whole % WAVE.length) + WAVE.length) % WAVE.length];
}
