import { MAKER_DESK_COPY } from './makerDeskCopy';

/** Maker Desk rules. Pure: no React, no timers, no DOM, no storage and no
 * randomness inside (a random source is passed in where one is needed).
 *
 *  1. Levels: room → computer desktop → one program, and back one step at a
 *     time. Every level has a path back to the room.
 *  2. The pretend terminal: a closed toy. Input is matched against a fixed
 *     command table and answered from a fixed virtual file map defined here.
 *     Nothing is evaluated, resolved, fetched or stored, and the child's own
 *     words are never put into an answer.
 *  3. Bounce: a fixed-timestep ball, a paddle whose hit point sets the angle,
 *     and fifteen lanterns that light (never break). The ball cannot be lost.
 *  4. Desk stickers: three discoveries, then the activity may finish. */

export type Lang = 'en' | 'he';

/* ───────────────────────── 1. Levels ───────────────────────── */

export type Program = 'bounce' | 'things' | 'ask';
export const PROGRAMS: readonly Program[] = ['bounce', 'things', 'ask'];
export type Level = { at: 'study' } | { at: 'desktop' } | { at: 'program'; program: Program };
export const ROOM: Level = { at: 'study' };

export function isProgram(value: unknown): value is Program {
  return typeof value === 'string' && (PROGRAMS as readonly string[]).includes(value);
}
/** Tapping the computer in the room switches it on. Anywhere else: no change. */
export function switchOn(level: Level): Level {
  return level.at === 'study' ? { at: 'desktop' } : level;
}
/** A program opens only from the desktop. */
export function openProgram(level: Level, program: unknown): Level {
  return level.at === 'desktop' && isProgram(program) ? { at: 'program', program } : level;
}
/** The one step back: program → desktop → room. The room stays the room
 * (leaving the activity is the Studio's own back, not this one). */
export function stepBack(level: Level): Level {
  if (level.at === 'program') return { at: 'desktop' };
  return ROOM;
}
/** Where the step-back tab leads, for its label; null in the room. */
export function backTarget(level: Level): 'study' | 'desktop' | null {
  return level.at === 'program' ? 'desktop' : level.at === 'desktop' ? 'study' : null;
}
/** How many step-backs reach the room from here (never more than two). */
export function stepsToRoom(level: Level): number {
  let at = level, steps = 0;
  while (at.at !== 'study' && steps < 5) { at = stepBack(at); steps++; }
  return steps;
}

/* ─────────────────── 2. Saved things and the clock ─────────────────── */

export type ThingKind = 'corner' | 'melody' | 'dance' | 'bowl' | 'textile' | 'bottle';
export const THING_KINDS: readonly ThingKind[] = ['bowl', 'textile', 'bottle', 'corner', 'melody', 'dance'];
/** Each kind's file name inside the pretend `things/` folder. */
export const THING_FILES: Readonly<Record<ThingKind, string>> = { bowl: 'bowl', textile: 'cloth', bottle: 'bottle', corner: 'world', melody: 'tune', dance: 'dance' };
export function isThingKind(value: unknown): value is ThingKind {
  return typeof value === 'string' && (THING_KINDS as readonly string[]).includes(value);
}
/** The kinds the child has, each once, in shelf order. Unknown kinds drop out. */
export function thingKinds(kinds: readonly unknown[]): ThingKind[] {
  const have = new Set(kinds.filter(isThingKind));
  return THING_KINDS.filter(kind => have.has(kind));
}
/** The shelf has six places; the child's things fill them in shelf order. */
export const SHELF_PLACES = 6;
export function shelfPlaces(kinds: readonly unknown[]): (ThingKind | null)[] {
  const have = thingKinds(kinds);
  return Array.from({ length: SHELF_PLACES }, (_, index) => have[index] ?? null);
}
/** The desktop clock is a picture, not numerals: sun from six to six. */
export function skyPicture(hour: number): 'day' | 'night' {
  const h = Number.isFinite(hour) ? ((Math.trunc(hour) % 24) + 24) % 24 : 12;
  return h >= 6 && h < 18 ? 'day' : 'night';
}

/* ───────────────────────── 3. The terminal ───────────────────────── */

/** One line on the pretend screen. `cmd` is a line the child entered (shown
 * left to right, as terminals are); `out` is the computer's answer in the UI
 * language; `code` is a fixed command word shown left to right inside an
 * answer; a `listing` shows fixed file names; `name` marks where the child's
 * first name goes (the greeting convention). */
export type TermLine =
  | { kind: 'cmd'; text: string }
  | { kind: 'out'; text: string; code?: string; codeLast?: boolean; tone?: 'title' | 'soft' | 'joke' }
  | { kind: 'listing'; names: readonly string[] }
  | { kind: 'hello'; before: string; name: string | null; after: string };

export interface TerminalContext {
  lang: Lang;
  /** The saved creation kinds of the current child (from the scoped hook). */
  things: readonly ThingKind[];
  /** The greeting: the Studio's `hello` + first name, or `helloNoName`. */
  hello: { word: string; noName: string; name: string | null };
  /** Which riddle `cat secret.txt` shows this time. */
  riddle: number;
}
export type Sound = 'beep' | 'answer' | 'unknown' | null;
export interface RunResult {
  /** The lines to add (after the echoed command line). */
  lines: TermLine[];
  /** True for `clear`: the screen is wiped before `lines` are shown. */
  clear: boolean;
  /** The canonical command run (for the sticker), or null when unknown. */
  command: string | null;
  sound: Sound;
  /** What was read when the keyboard typed Hebrew letters (else null). */
  readAs: string | null;
}

/** Longest input the toy reads; anything longer is not a word it knows. */
export const INPUT_MAX = 40;
/** Lines kept on the pretend screen (older ones scroll away). */
export const SCREEN_MAX = 60;

/** The big buttons under the screen: the whole vocabulary a young child needs. */
export const QUICK_COMMANDS: readonly string[] = ['help', 'ls', 'cat about.txt', 'hello', 'clear'];

/** The fixed command words, before any file names. */
const BASE_VOCABULARY: readonly string[] = ['help', 'ls', 'ls things', 'cat about.txt', 'cat secret.txt', 'hello', 'beep', 'clear'];

/** Every whole command the toy understands for this child (for autocomplete). */
export function vocabulary(things: readonly ThingKind[]): string[] {
  return [...BASE_VOCABULARY, ...thingKinds(things).map(kind => `cat things/${THING_FILES[kind]}`)];
}

/** The standard Israeli keyboard: which Latin key types each Hebrew letter.
 * A child whose keyboard is set to Hebrew types "ךד" when they mean "ls". */
const HEBREW_KEYS: Readonly<Record<string, string>> = {
  'ק': 'e', 'ר': 'r', 'א': 't', 'ט': 'y', 'ו': 'u', 'ן': 'i', 'ם': 'o', 'פ': 'p',
  'ש': 'a', 'ד': 's', 'ג': 'd', 'כ': 'f', 'ע': 'g', 'י': 'h', 'ח': 'j', 'ל': 'k', 'ך': 'l', 'ף': ';',
  'ז': 'z', 'ס': 'x', 'ב': 'c', 'ה': 'v', 'נ': 'b', 'מ': 'n', 'צ': 'm', 'ת': ',', 'ץ': '.',
  '.': '/', '/': 'q', "'": 'w',
};
const HEBREW = /[֐-׿]/;
/** The Latin keys a Hebrew-layout keyboard pressed, character for character. */
export function fromHebrewKeys(text: string): string {
  return [...text].map(char => HEBREW_KEYS[char] ?? char).join('');
}

/** Tidies what was typed into the one form the table is keyed by: no control
 * or direction marks, lower case, single spaces, trimmed. Returns '' for
 * anything that is not a string or is too long to be a known word. */
export function normalizeInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const plain = input.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, '');
  const tidy = plain.toLowerCase().replace(/\s+/g, ' ').trim();
  return tidy.length > INPUT_MAX ? '' : tidy;
}

/** The answers. Every one is fixed text from the copy (plus the greeting's
 * first name); none is built from what the child typed. */
function answer(command: string, ctx: TerminalContext): Omit<RunResult, 'readAs'> | null {
  const w = MAKER_DESK_COPY[ctx.lang];
  const things = thingKinds(ctx.things);
  const done = (lines: TermLine[], sound: Sound = 'answer', clear = false, counts = true): Omit<RunResult, 'readAs'> => ({ lines, clear, command: counts ? command : null, sound });
  switch (command) {
    case 'help': return done([
      { kind: 'out', text: w.helpTitle, tone: 'title' },
      { kind: 'out', code: 'help', text: w.help.help }, { kind: 'out', code: 'ls', text: w.help.ls },
      { kind: 'out', code: 'cat about.txt', text: w.help.about }, { kind: 'out', code: 'cat secret.txt', text: w.help.secret },
      { kind: 'out', code: 'ls things', text: w.help.things }, { kind: 'out', code: 'hello', text: w.help.hello },
      { kind: 'out', code: 'beep', text: w.help.beep }, { kind: 'out', code: 'clear', text: w.help.clear },
    ]);
    case 'ls': return done([{ kind: 'listing', names: ['about.txt', 'secret.txt', 'things/'] }]);
    case 'ls things': return done(things.length ? [{ kind: 'listing', names: things.map(kind => THING_FILES[kind]) }] : [{ kind: 'out', text: w.thingsEmptyTerm, tone: 'soft' }]);
    case 'cat about.txt': return done(w.about.map(text => ({ kind: 'out', text })));
    case 'cat secret.txt': {
      const turn = Number.isFinite(ctx.riddle) ? Math.abs(Math.trunc(ctx.riddle)) % w.riddles.length : 0;
      const [ask, reply] = w.riddles[turn];
      return done([{ kind: 'out', text: ask }, { kind: 'out', text: reply, tone: 'joke' }]);
    }
    case 'hello': return done([ctx.hello.name
      ? { kind: 'hello', before: ctx.hello.word, name: ctx.hello.name, after: `! ${w.helloMore}` }
      : { kind: 'hello', before: ctx.hello.noName, name: null, after: ` ${w.helloMore}` }]);
    case 'beep': return done([{ kind: 'out', text: w.beep }], 'beep');
    case 'clear': return done([], null, true);
    // Nearly right: a fixed nudge toward the right word, which does not count as a command.
    case 'cat': return done([{ kind: 'out', text: w.catNeeds, tone: 'soft' }], 'unknown', false, false);
    case 'cat things': case 'cat things/': return done([{ kind: 'out', text: w.isFolder, tone: 'soft' }], 'unknown', false, false);
  }
  const thing = things.find(kind => command === `cat things/${THING_FILES[kind]}`);
  if (thing) return done([{ kind: 'out', text: w.things_[thing] }]);
  return null;
}

/** Fixed spellings that mean the same command. */
const ALIASES: Readonly<Record<string, string>> = { hi: 'hello', 'ls things/': 'ls things', 'ls ./things': 'ls things', 'help me': 'help', '?': 'help', cls: 'clear' };

/** Runs one line of input against the fixed table. Unknown input of any
 * shape (a path, a script, a URL, a very long string) gets one fixed reply.
 * A file-ish command naming a file that is not in the map gets another fixed
 * reply. Nothing else can come out. */
export function run(input: unknown, ctx: TerminalContext): RunResult {
  const w = MAKER_DESK_COPY[ctx.lang];
  const typed = normalizeInput(input);
  const tryOne = (text: string) => answer(ALIASES[text] ?? text, ctx);
  let result = typed ? tryOne(typed) : null;
  let readAs: string | null = null;
  if (!result && HEBREW.test(typed)) {
    const latin = normalizeInput(fromHebrewKeys(typed));
    const swapped = latin ? tryOne(latin) : null;
    if (swapped) { result = swapped; readAs = ALIASES[latin] ?? latin; }
  }
  if (result) {
    const lines = readAs ? [{ kind: 'out', text: w.keyboard, code: readAs, codeLast: true, tone: 'soft' } as TermLine, ...result.lines] : result.lines;
    return { ...result, lines, readAs };
  }
  if (/^(cat|ls|cd|open|read|more|less|type) /.test(typed)) return { lines: [{ kind: 'out', text: w.noFile, tone: 'soft' }], clear: false, command: null, sound: 'unknown', readAs: null };
  return { lines: typed ? [{ kind: 'out', text: w.unknown, tone: 'soft' }] : [], clear: false, command: null, sound: typed ? 'unknown' : null, readAs: null };
}

/** Commands from the table that start with what is typed so far (at most four). */
export function suggest(partial: unknown, things: readonly ThingKind[], limit = 4): string[] {
  const typed = normalizeInput(partial);
  if (!typed) return [];
  return vocabulary(things).filter(word => word.startsWith(typed) && word !== typed).slice(0, Math.max(0, limit));
}
/** Tab: one match fills in whole; several fill in what they share. */
export function complete(partial: unknown, things: readonly ThingKind[]): string {
  const typed = normalizeInput(partial);
  const matches = typed ? vocabulary(things).filter(word => word.startsWith(typed)) : [];
  if (matches.length === 0) return typeof partial === 'string' ? partial.slice(0, INPUT_MAX) : '';
  if (matches.length === 1) return matches[0];
  let shared = matches[0];
  for (const word of matches) while (!word.startsWith(shared)) shared = shared.slice(0, -1);
  return shared.length > typed.length ? shared : typed;
}
/** Adds lines to the screen, keeping only the newest `SCREEN_MAX`. */
export function appendScreen(screen: readonly TermLine[], lines: readonly TermLine[], clear = false): TermLine[] {
  return [...(clear ? [] : screen), ...lines].slice(-SCREEN_MAX);
}

/* ───────────────────────── 4. Bounce ───────────────────────── */

/** The field is drawn on a small grid and scaled up with crisp squares. */
export const FIELD_W = 160;
export const FIELD_H = 120;
export const BALL = 4;
export const BALL_SPEED = 60;
export const PADDLE_W = 30;
export const PADDLE_H = 4;
export const PADDLE_Y = 104;
export const PADDLE_SPEED = 110;
/** Dragging moves the paddle faster than the arrows, so it follows a finger. */
export const DRAG_SPEED = 320;
export const STEP_S = 1 / 120;
/** Most fixed steps run for one frame; a stalled tab never fast-forwards. */
export const MAX_STEPS = 10;
/** A missed ball rests on the cloud, then floats back up for this long. */
export const FLOAT_S = 1.1;
export const LANTERN_COLS = 5;
export const LANTERN_ROWS = 3;
export const LANTERN_COUNT = LANTERN_COLS * LANTERN_ROWS;
/** The steepest a paddle bounce can lean (degrees from straight up). */
export const MAX_ANGLE = 60;

export interface Lantern { x: number; y: number; w: number; h: number; hue: number }
export interface Ball { x: number; y: number; vx: number; vy: number }
export interface BounceState {
  lanterns: readonly Lantern[];
  lit: readonly boolean[];
  ball: Ball;
  paddle: number;
  /** Seconds left of the cloud float (0 = in play). */
  floating: number;
  /** Counts relaunches, so each one leans the other way. */
  launches: number;
  done: boolean;
}
export type BounceEvent = { type: 'wall' } | { type: 'paddle' } | { type: 'lantern'; index: number } | { type: 'cloud' } | { type: 'lift' } | { type: 'allLit' };
export interface PaddleInput { dir: -1 | 0 | 1; target: number | null }

export const LAYOUTS = ['grid', 'stagger', 'arch', 'vee'] as const;
export type LanternLayout = typeof LAYOUTS[number];

const roll = (random: () => number) => { const value = random(); return Number.isFinite(value) ? Math.min(0.999999, Math.max(0, value)) : 0; };

/** Fifteen lanterns in one of four arrangements, their colours shuffled. They
 * never overlap and always sit above the paddle with room for the ball. */
export function layoutLanterns(random: () => number, layout?: LanternLayout): Lantern[] {
  const shape = layout ?? LAYOUTS[Math.floor(roll(random) * LAYOUTS.length)];
  // The gaps are narrower than the ball, so it can never slip up a channel between lanterns.
  const w = 24, h = 9, gap = 3, top = 14, rowGap = 13;
  const span = LANTERN_COLS * w + (LANTERN_COLS - 1) * gap;
  const left = (FIELD_W - span) / 2;
  const hues = [0, 1, 2, 3, 4];
  for (let i = hues.length - 1; i > 0; i--) { const j = Math.floor(roll(random) * (i + 1)); [hues[i], hues[j]] = [hues[j], hues[i]]; }
  const out: Lantern[] = [];
  for (let row = 0; row < LANTERN_ROWS; row++) {
    for (let col = 0; col < LANTERN_COLS; col++) {
      const centre = Math.abs(col - (LANTERN_COLS - 1) / 2);
      const shift = shape === 'stagger' ? (row % 2 === 0 ? -7 : 7) : 0;
      const lift = shape === 'arch' ? -centre * 5 + 10 : shape === 'vee' ? centre * 5 : 0;
      out.push({ x: Math.round(left + col * (w + gap) + shift), y: Math.round(top + row * rowGap + lift), w, h, hue: hues[(col + row) % hues.length] });
    }
  }
  return out;
}

/** A new round: lanterns placed, none lit, the ball resting on its cloud. */
export function newBounce(random: () => number, layout?: LanternLayout): BounceState {
  return { lanterns: layoutLanterns(random, layout), lit: Array.from({ length: LANTERN_COUNT }, () => false), ball: { x: FIELD_W / 2, y: FIELD_H - BALL, vx: 0, vy: 0 }, paddle: FIELD_W / 2, floating: FLOAT_S, launches: 0, done: false };
}

/** Speed stays the same and the ball never travels too flat, so it always
 * comes back to the paddle in a few seconds. */
export function steady(vx: number, vy: number, speed = BALL_SPEED): { vx: number; vy: number } {
  let x = Number.isFinite(vx) ? vx : 0, y = Number.isFinite(vy) ? vy : -1;
  const length = Math.hypot(x, y) || 1;
  x /= length; y /= length;
  const minY = Math.cos((MAX_ANGLE + 10) * Math.PI / 180);
  if (Math.abs(y) < minY) { y = (y < 0 ? -1 : 1) * minY; x = (x < 0 ? -1 : 1) * Math.sqrt(1 - minY * minY); }
  return { vx: x * speed, vy: y * speed };
}
/** Where the ball meets the paddle sets its new direction: the middle sends
 * it straight up, the ends send it off at an angle. Skill matters. */
export function paddleBounce(ballX: number, paddleX: number, speed = BALL_SPEED): { vx: number; vy: number } {
  const reach = PADDLE_W / 2 + BALL / 2;
  const offset = Math.max(-1, Math.min(1, (ballX - paddleX) / reach));
  const angle = offset * MAX_ANGLE * Math.PI / 180;
  return { vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed };
}
const clampPaddle = (x: number) => Math.max(PADDLE_W / 2, Math.min(FIELD_W - PADDLE_W / 2, Number.isFinite(x) ? x : FIELD_W / 2));

/** The paddle for one fixed step: the arrows push it; a finger pulls it. */
export function movePaddle(x: number, input: PaddleInput, dt = STEP_S): number {
  if (input.dir) return clampPaddle(x + input.dir * PADDLE_SPEED * dt);
  if (input.target === null || !Number.isFinite(input.target)) return clampPaddle(x);
  const goal = clampPaddle(input.target), most = DRAG_SPEED * dt;
  return clampPaddle(Math.abs(goal - x) <= most ? goal : x + Math.sign(goal - x) * most);
}

/** One fixed step of play. Pure: returns the next state and what happened. */
export function bounceStep(state: BounceState, input: PaddleInput, dt = STEP_S): { state: BounceState; events: BounceEvent[] } {
  if (state.done) return { state, events: [] };
  const events: BounceEvent[] = [];
  const paddle = movePaddle(state.paddle, input, dt);
  const r = BALL / 2;
  if (state.floating > 0) {
    // On the cloud: the ball rises gently from the bottom to just above the paddle.
    const floating = Math.max(0, state.floating - dt);
    const from = FIELD_H - BALL, to = PADDLE_Y - 12;
    const ball = { ...state.ball, y: from + (to - from) * (1 - floating / FLOAT_S), vx: 0, vy: 0 };
    if (floating > 0) return { state: { ...state, paddle, floating, ball }, events };
    const lean = state.launches % 2 === 0 ? 1 : -1;
    const launched = steady(lean * Math.sin(25 * Math.PI / 180), -Math.cos(25 * Math.PI / 180));
    events.push({ type: 'lift' });
    return { state: { ...state, paddle, floating: 0, launches: state.launches + 1, ball: { ...ball, ...launched } }, events };
  }
  let { x, y, vx, vy } = state.ball;
  const px = x, py = y;
  x += vx * dt; y += vy * dt;
  if (x - r < 0) { x = r; vx = Math.abs(vx); events.push({ type: 'wall' }); }
  if (x + r > FIELD_W) { x = FIELD_W - r; vx = -Math.abs(vx); events.push({ type: 'wall' }); }
  if (y - r < 0) { y = r; vy = Math.abs(vy); events.push({ type: 'wall' }); }
  // The paddle: only a ball coming down onto its top bounces.
  if (vy > 0 && py + r <= PADDLE_Y + 1 && y + r >= PADDLE_Y && Math.abs(x - paddle) <= PADDLE_W / 2 + r) {
    y = PADDLE_Y - r; ({ vx, vy } = paddleBounce(x, paddle)); events.push({ type: 'paddle' });
  }
  // Lanterns: a dark lantern turns the ball and lights up. A glowing one is
  // light, and the ball sails through it, so every lantern can always be
  // reached (lanterns are never destroyed, and no row walls another in).
  let lit = state.lit;
  for (let index = 0; index < state.lanterns.length; index++) {
    if (lit[index]) continue;
    const l = state.lanterns[index];
    const ox = Math.min(x + r - l.x, l.x + l.w - (x - r)), oy = Math.min(y + r - l.y, l.y + l.h - (y - r));
    if (ox <= 0 || oy <= 0) continue;
    const fromSide = (px + r <= l.x || px - r >= l.x + l.w) && !(py + r <= l.y || py - r >= l.y + l.h);
    if (fromSide || ox < oy) { vx = x < l.x + l.w / 2 ? -Math.abs(vx) : Math.abs(vx); x += x < l.x + l.w / 2 ? -ox : ox; }
    else { vy = y < l.y + l.h / 2 ? -Math.abs(vy) : Math.abs(vy); y += y < l.y + l.h / 2 ? -oy : oy; }
    lit = lit.map((on, i) => on || i === index);
    events.push({ type: 'lantern', index });
    break;
  }
  ({ vx, vy } = steady(vx, vy));
  // Missed: the ball sinks into the cloud at the bottom and comes back. No lives, no ending.
  if (y - r > FIELD_H) {
    events.push({ type: 'cloud' });
    return { state: { ...state, paddle, lit, floating: FLOAT_S, ball: { x: Math.max(8, Math.min(FIELD_W - 8, x)), y: FIELD_H - BALL, vx: 0, vy: 0 } }, events };
  }
  const done = lit.every(Boolean);
  if (done && !state.done) events.push({ type: 'allLit' });
  return { state: { ...state, paddle, lit, done, ball: { x, y, vx, vy } }, events };
}

/** Runs as many fixed steps as the frame's time allows (capped), carrying the
 * remainder to the next frame. */
export function advance(state: BounceState, input: PaddleInput, carry: number, frameS: number): { state: BounceState; events: BounceEvent[]; carry: number } {
  let left = Math.min(carry + (Number.isFinite(frameS) && frameS > 0 ? frameS : 0), STEP_S * MAX_STEPS);
  let next = state; const events: BounceEvent[] = [];
  while (left >= STEP_S) { const out = bounceStep(next, input, STEP_S); next = out.state; events.push(...out.events); left -= STEP_S; if (next.done) { left = 0; break; } }
  return { state: next, events, carry: left };
}
export const litCount = (lit: readonly boolean[]) => lit.filter(Boolean).length;
/** The chime for the n-th lantern lit: each one a little higher. */
export function chimeStep(litSoFar: number): number {
  return Math.max(0, Math.min(LANTERN_COUNT - 1, Math.trunc(Number.isFinite(litSoFar) ? litSoFar : 0) - 1));
}

/* ───────────────────────── 5. Desk stickers ───────────────────────── */

export type Sticker = 'lanterns' | 'things' | 'commands';
export const STICKERS: readonly Sticker[] = ['lanterns', 'things', 'commands'];
/** What the child has found this sitting. Only fixed command words are kept,
 * never free text, and nothing here is saved or reported. */
export interface Discovery { lanterns: boolean; things: boolean; commands: readonly string[] }
export const NO_DISCOVERY: Discovery = { lanterns: false, things: false, commands: [] };
export const COMMANDS_FOR_STICKER = 2;
export function noteLanterns(d: Discovery): Discovery { return d.lanterns ? d : { ...d, lanterns: true }; }
export function noteThings(d: Discovery): Discovery { return d.things ? d : { ...d, things: true }; }
/** A known command counts once; unknown input (null) never counts. */
export function noteCommand(d: Discovery, command: string | null): Discovery {
  if (!command || d.commands.includes(command) || d.commands.length >= COMMANDS_FOR_STICKER) return d;
  return { ...d, commands: [...d.commands, command] };
}
export function stickerLit(d: Discovery, sticker: Sticker): boolean {
  return sticker === 'lanterns' ? d.lanterns : sticker === 'things' ? d.things : d.commands.length >= COMMANDS_FOR_STICKER;
}
export function allStickers(d: Discovery): boolean {
  return STICKERS.every(sticker => stickerLit(d, sticker));
}
