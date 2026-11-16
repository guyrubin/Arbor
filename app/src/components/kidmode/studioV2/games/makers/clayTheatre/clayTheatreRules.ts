/** Clay Theatre rules. Pure: no React, no timers, no canvas; every "random"
 * choice comes from the round's seed, so a round can be pinned in a test.
 *
 * The child is the animator. A film can chooses the story; then three
 * chapters make the film (shape and colour the hero, shoot six poses with the
 * ProofLens, direct the scene with a friend, a light and a tune) and the
 * premiere projects it. Nothing here measures the child: no score, no timer,
 * no wrong. A shot the camera cannot use (nothing moved) is simply not taken. */
import { clamp01, lerp, seeded, type Pt } from './clayShapes';
import { BUDDY_ACTS, FULL_PULLS, HEROES, NO_PULLS, PULL_IDS, heroDrop, type BuddyAct, type BuddyId, type HeroId, type Pose, type PullId, type Pulls } from './clayBody';

/* ── stop-motion time ───────────────────────────────────────────────────── */

/** The projector runs at 12 frames a second and every drawing is held for two of them ("on twos"). */
export const FPS = 12, TWOS = 2;
/** Six poses make a film. */
export const SHOTS = 6;
/** The drawings the projector lays between two of the child's poses (the pose itself, then three in-betweens). */
export const STEPS = 4;
export const filmDrawings = (keys: number) => (keys < 2 ? Math.max(0, keys) : (keys - 1) * STEPS + 1);
export const filmFrames = (keys: number) => filmDrawings(keys) * TWOS;
export const drawingAt = (frame: number, keys: number) => Math.max(0, Math.min(filmDrawings(keys) - 1, Math.floor(frame / TWOS)));
/** The frame on which the child's own pose `key` is on screen. */
export const frameOfKey = (key: number) => key * STEPS * TWOS;
/** The pose nearest a frame (the strip lights that cell). */
export const keyNear = (frame: number, keys: number) => Math.max(0, Math.min(keys - 1, Math.round(frame / (STEPS * TWOS))));

/* ── the set ────────────────────────────────────────────────────────────── */

/** The set is measured in clay units: 400 across its middle, the stage floor at y = 250. */
export const SET_W = 400, GROUND = 250;
export type ClayId = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
export const CLAY_IDS: readonly ClayId[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
export type GelId = 'clearGel' | 'roseGel' | 'blueGel' | 'goldGel';
export const GEL_IDS: readonly GelId[] = ['roseGel', 'blueGel', 'goldGel'];
export type TuneId = 'tuneA' | 'tuneB' | 'tuneC';
export const TUNE_IDS: readonly TuneId[] = ['tuneA', 'tuneB', 'tuneC'];
/** Each tune is eight steps of the activity's pentatonic scale; the premiere plays it under the film. */
export const TUNES: Readonly<Record<TuneId, readonly number[]>> = {
  tuneA: [5, 7, 9, 10, 9, 7, 8, 10],
  tuneB: [10, 9, 7, 5, 7, 9, 12, 10],
  tuneC: [5, 5, 8, 7, 10, 9, 12, 13],
};

export type StoryId = 'whaleJump' | 'moonRocket' | 'frogPond' | 'snailGarden';
export const STORY_IDS: readonly StoryId[] = ['whaleJump', 'moonRocket', 'frogPond', 'snailGarden'];
export type SkyId = 'seaDay' | 'deepNight' | 'pondDawn' | 'gardenNoon';
export interface Story {
  id: StoryId; hero: HeroId; buddy: BuddyId; sky: SkyId;
  /** The clay a first-time animator finds already in mind: body, trim. */
  clay: readonly [ClayId, ClayId];
  /** Where the friend waits if the child drops it nowhere in particular. */
  buddyHome: Pt;
}
export const STORIES: Readonly<Record<StoryId, Story>> = {
  whaleJump: { id: 'whaleJump', hero: 'whale', buddy: 'seaBird', sky: 'seaDay', clay: ['blue', 'yellow'], buddyHome: [316, 96] },
  moonRocket: { id: 'moonRocket', hero: 'rocket', buddy: 'starlet', sky: 'deepNight', clay: ['red', 'yellow'], buddyHome: [92, 92] },
  frogPond: { id: 'frogPond', hero: 'frog', buddy: 'dragonfly', sky: 'pondDawn', clay: ['green', 'yellow'], buddyHome: [306, 120] },
  snailGarden: { id: 'snailGarden', hero: 'snail', buddy: 'ladybird', sky: 'gardenNoon', clay: ['orange', 'purple'], buddyHome: [310, 214] },
};
/** The films a child is offered. All four; the order is the round's. */
export function storiesFor(seed: number): StoryId[] {
  const start = Math.floor(seeded(seed, 11) * STORY_IDS.length);
  return STORY_IDS.map((_, i) => STORY_IDS[(i + start) % STORY_IDS.length]);
}

/** Tonight's dressing: every replay hangs the set a little differently. */
export interface ShowLook {
  /** Which way the hero starts: at the left facing right, or the other way. */
  side: 1 | -1;
  /** A seed for clouds, stars, flowers and pads. */
  dressing: number;
  /** The order the six lumps lie on the rug. */
  lumps: readonly ClayId[];
  /** 0…2: the hour on the cloth (a different sky each time). */
  hour: number;
}
export function showLook(seed: number): ShowLook {
  const order = CLAY_IDS.map((id, i) => ({ id, k: seeded(seed, i, 3) })).sort((a, b) => a.k - b.k).map(o => o.id);
  return { side: seeded(seed, 5) < 0.5 ? 1 : -1, dressing: Math.floor(seeded(seed, 7) * 9973) + 1, lumps: order, hour: Math.floor(seeded(seed, 9) * 3) % 3 };
}

/* ── the show: one sitting from film can to premiere ────────────────────── */

export type Chapter = 'cans' | 'shape' | 'animate' | 'direct' | 'premiere';
export const CHAPTERS: readonly Chapter[] = ['shape', 'animate', 'direct'];
export interface Print { x: number; y: number; rot: number }
export const MAX_PRINTS = 4;
export interface Buddy { at: Pt; act: BuddyAct }
export interface Show {
  seed: number; chapter: Chapter; story: StoryId | null;
  body: ClayId | null; trim: ClayId | null; kneads: number; pulls: Pulls; prints: readonly Print[];
  keys: readonly Pose[];
  buddy: Buddy | null; gel: GelId; tune: TuneId | null;
}
export const newShow = (seed: number): Show => ({ seed, chapter: 'cans', story: null, body: null, trim: null, kneads: 0, pulls: NO_PULLS, prints: [], keys: [], buddy: null, gel: 'clearGel', tune: null });
export const storyOf = (show: Show): Story | null => (show.story ? STORIES[show.story] : null);
export const heroOf = (show: Show): HeroId => (show.story ? STORIES[show.story].hero : 'whale');
export function chooseStory(show: Show, story: StoryId): Show {
  return show.chapter === 'cans' ? { ...show, story, chapter: 'shape' } : show;
}

/* chapter 1: shape and colour */

/** A lump kneaded in. The first is the body, the second the trim; after that
 * each new lump changes them in turn. The same clay twice is not kneaded
 * (there would be nothing to see): the show comes back unchanged. */
export function knead(show: Show, clay: ClayId): Show {
  if (show.chapter !== 'shape') return show;
  if (!show.body) return { ...show, body: clay, kneads: show.kneads + 1 };
  if (!show.trim) return clay === show.body ? show : { ...show, trim: clay, kneads: show.kneads + 1 };
  const part = show.kneads % 2 === 0 ? 'body' : 'trim', other = part === 'body' ? show.trim : show.body;
  if (clay === other || clay === show[part]) return show;
  return { ...show, [part]: clay, kneads: show.kneads + 1 };
}
/** Which part the next lump will colour. */
export const nextKnead = (show: Show): 'body' | 'trim' => (!show.body ? 'body' : !show.trim ? 'trim' : show.kneads % 2 === 0 ? 'body' : 'trim');
export const coloured = (show: Show) => !!show.body && !!show.trim;
/** A pull finished: that share of the lump is out. */
export function pull(show: Show, id: PullId): Show {
  if (show.chapter !== 'shape' || show.pulls[id] >= 1) return show;
  return { ...show, pulls: { ...show.pulls, [id]: 1 } };
}
/** How far a drag has pulled a handle out: 0…1.15 (the clay stretches a little past, then settles). */
export const PULL_REACH = 70, PULL_ENOUGH = 0.55;
export function pullAmount(dir: Pt, drag: Pt): number {
  const len = Math.hypot(dir[0], dir[1]) || 1;
  return Math.max(0, Math.min(1.15, (drag[0] * dir[0] + drag[1] * dir[1]) / len / PULL_REACH));
}
export const pullsDone = (show: Show) => PULL_IDS.filter(id => show.pulls[id] >= 1).length;
export const nextPull = (show: Show): PullId | null => PULL_IDS.find(id => show.pulls[id] < 1) ?? null;
export const shapeDone = (show: Show) => coloured(show) && pullsDone(show) === PULL_IDS.length;
/** A thumb pressed into the hero, kept in the clay's own coordinates so it travels with it. */
export function pressPrint(show: Show, local: Pt): Show {
  const x = Math.round(Math.max(-70, Math.min(70, local[0]))), y = Math.round(Math.max(-34, Math.min(34, local[1])));
  const print: Print = { x, y, rot: Math.round(seeded(x, y, 5) * 140 - 70) };
  return { ...show, prints: [...show.prints.filter(p => Math.hypot(p.x - x, p.y - y) > 12), print].slice(-MAX_PRINTS) };
}

/* chapter 2: animate */

/** Where the finished hero stands when the camera first looks at it. */
export function startPose(show: Show): Pose {
  const hero = heroOf(show), look = showLook(show.seed), flips = HEROES[hero].flips;
  const x = hero === 'rocket' ? SET_W / 2 - look.side * 70 : SET_W / 2 - look.side * 96;
  const rest: Pose = { x, y: 0, rot: 0, sx: 1, sy: 1, flip: flips ? look.side : 1 };
  return { ...rest, y: GROUND - heroDrop(hero, FULL_PULLS, rest) };
}
/** Where the lump sits while it is being shaped. */
export function lumpPose(show: Show): Pose {
  const hero = heroOf(show), rest: Pose = { x: SET_W / 2, y: 0, rot: 0, sx: 1, sy: 1, flip: 1 };
  return { ...rest, y: GROUND - heroDrop(hero, show.pulls, rest) };
}
export function toAnimate(show: Show): Show { return show.chapter === 'shape' && shapeDone(show) ? { ...show, chapter: 'animate', keys: [] } : show; }
export interface Field { x0: number; x1: number; y0: number; y1: number }
/** The pose a hero takes when the child carries it to (x, y): it turns to the
 * way it travels, leans into a climb, and stretches with a long step. The
 * child chooses where; the clay answers how. */
export function carriedPose(hero: HeroId, from: Pose | null, x: number, y: number, field: Field, pressed = false): Pose {
  const spec = HEROES[hero];
  const base: Pose = from ?? { x, y, rot: 0, sx: 1, sy: 1, flip: 1 };
  const px = Math.max(field.x0, Math.min(field.x1, x)), floor = GROUND - heroDrop(hero, FULL_PULLS, { ...base, rot: 0, sx: 1, sy: 1 }), py = Math.max(field.y0, Math.min(floor, y));
  if (!from) return { x: px, y: py, rot: 0, sx: 1, sy: 1, flip: 1 };
  const dx = px - from.x, dy = py - from.y, dist = Math.hypot(dx, dy);
  const flip = spec.flips && Math.abs(dx) > 6 ? (dx > 0 ? 1 : -1) : from.flip;
  let rot = 0;
  if (dist > 5) {
    if (hero === 'rocket') rot = ((((Math.atan2(dy, dx) * 180) / Math.PI + 90) % 360) + 540) % 360 - 180;
    else if (hero === 'frog') rot = Math.max(-16, Math.min(16, dx * 0.15));
    else rot = Math.max(-70, Math.min(70, ((Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI) * spec.follow));
  }
  const air = clamp01((floor - py) / 50), stretch = Math.min(0.16, dist / 700);
  let sx = 1 + stretch, sy = 1 - stretch * 0.6;
  if (hero === 'frog') { sx = lerp(1.06, 0.92, air); sy = lerp(0.94, 1.14, air); }
  if (pressed) { sx *= 1.14; sy *= 0.8; }
  return { x: px, y: py, rot, sx, sy, flip };
}
/** The camera needs something to have changed since the last frame. */
export const MOVE_ENOUGH = 9;
export function movedEnough(a: Pose, b: Pose): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) >= MOVE_ENOUGH || Math.abs(a.rot - b.rot) >= 14 || Math.abs(a.sy - b.sy) >= 0.1;
}
/** The shutter. The first frame is always taken; after that, only a changed pose is. */
export function shoot(show: Show, pose: Pose): Show {
  if (show.chapter !== 'animate' || show.keys.length >= SHOTS) return show;
  const last = show.keys[show.keys.length - 1];
  if (last && !movedEnough(last, pose)) return show;
  return { ...show, keys: [...show.keys, pose] };
}
/** The last frame taken back off the strip. */
export function unshoot(show: Show): Show {
  return show.chapter === 'animate' && show.keys.length > 0 ? { ...show, keys: show.keys.slice(0, -1) } : show;
}
export const filmDone = (show: Show) => show.keys.length >= SHOTS;
export function toDirect(show: Show): Show { return show.chapter === 'animate' && filmDone(show) ? { ...show, chapter: 'direct' } : show; }

const turn = (a: number, b: number, k: number) => { const d = ((((b - a) % 360) + 540) % 360) - 180; return a + d * k; };
/** The pose on drawing `d` of the film: the child's own poses on every fourth
 * drawing, and between them a smooth path through them (Catmull-Rom), with a
 * little stretch in the middle of a long step. */
export function drawingPose(keys: readonly Pose[], d: number): Pose | null {
  if (keys.length === 0) return null;
  if (keys.length === 1) return keys[0];
  const last = filmDrawings(keys.length) - 1, at = Math.max(0, Math.min(last, d));
  if (at % STEPS === 0) return keys[at / STEPS];
  const seg = Math.min(keys.length - 2, Math.floor(at / STEPS)), raw = (at - seg * STEPS) / STEPS;
  const k = lerp(raw, raw * raw * (3 - 2 * raw), 0.5);
  const p0 = keys[Math.max(0, seg - 1)], p1 = keys[seg], p2 = keys[seg + 1], p3 = keys[Math.min(keys.length - 1, seg + 2)];
  const cr = (a: number, b: number, c: number, e: number) => 0.5 * (2 * b + (c - a) * k + (2 * a - 5 * b + 4 * c - e) * k * k + (3 * b - a - 3 * c + e) * k * k * k);
  const step = Math.hypot(p2.x - p1.x, p2.y - p1.y), mid = Math.sin(Math.PI * k) * Math.min(0.12, step / 900);
  return {
    x: cr(p0.x, p1.x, p2.x, p3.x), y: Math.min(Math.max(p1.y, p2.y), cr(p0.y, p1.y, p2.y, p3.y)), rot: turn(p1.rot, p2.rot, k),
    sx: lerp(p1.sx, p2.sx, k) + mid, sy: lerp(p1.sy, p2.sy, k) - mid * 0.6, flip: k < 0.5 ? p1.flip : p2.flip,
  };
}
/** The moments an audience answers: the drawing where the hero is highest, and the one after its longest step. */
export function filmBeats(keys: readonly Pose[]): { apex: number; leap: number } {
  let apex = 0, top = Infinity, leap = 0, far = -1;
  keys.forEach((key, i) => {
    if (key.y < top) { top = key.y; apex = i; }
    if (i > 0) { const d = Math.hypot(key.x - keys[i - 1].x, key.y - keys[i - 1].y); if (d > far) { far = d; leap = i; } }
  });
  return { apex: apex * STEPS, leap: Math.max(0, leap * STEPS - 2) };
}

/* chapter 3: direct */

export function placeBuddy(show: Show, at: Pt, field: Field): Show {
  if (show.chapter !== 'direct') return show;
  const spot: Pt = [Math.round(Math.max(field.x0 + 20, Math.min(field.x1 - 20, at[0]))), Math.round(Math.max(field.y0 + 20, Math.min(GROUND - 18, at[1])))];
  return { ...show, buddy: { at: spot, act: show.buddy?.act ?? 'hopAct' } };
}
/** A tap on the friend gives it its next act. */
export function nextAct(show: Show): Show {
  if (show.chapter !== 'direct' || !show.buddy) return show;
  return { ...show, buddy: { ...show.buddy, act: BUDDY_ACTS[(BUDDY_ACTS.indexOf(show.buddy.act) + 1) % BUDDY_ACTS.length] } };
}
/** A gel in front of the lamp; the same gel again takes it out. */
export function setGel(show: Show, gel: GelId): Show {
  return show.chapter === 'direct' ? { ...show, gel: show.gel === gel ? 'clearGel' : gel } : show;
}
export function setTune(show: Show, tune: TuneId): Show { return show.chapter === 'direct' ? { ...show, tune } : show; }
/** The director's three jobs, as things done (never a measure). */
export const directJobs = (show: Show) => ({ friend: !!show.buddy, light: show.gel !== 'clearGel', tune: !!show.tune });
export const directDone = (show: Show) => !!show.buddy;
export function toPremiere(show: Show): Show { return show.chapter === 'direct' && directDone(show) ? { ...show, chapter: 'premiere' } : show; }
/** Chapters finished so far (the quest strip's pips). */
export function chaptersDone(show: Show): Readonly<Record<'shape' | 'animate' | 'direct', boolean>> {
  const at = ['cans', 'shape', 'animate', 'direct', 'premiere'].indexOf(show.chapter);
  return { shape: at > 1, animate: at > 2, direct: at > 3 };
}

/* ── the premiere ───────────────────────────────────────────────────────── */

export const PREMIERE = { dim: 1.6, hold: 0.7, lights: 0.7, applause: 3 } as const;
export type PremierePhase = 'dim' | 'roll' | 'hold' | 'encore' | 'lights' | 'applause' | 'over';
export interface PremiereMoment { phase: PremierePhase; frame: number; dark: number; push: number; beam: number }
export function premiereSeconds(keys: number): number { return PREMIERE.dim + (filmFrames(keys) / FPS) * 2 + PREMIERE.hold + PREMIERE.lights + PREMIERE.applause; }
/** What the rotunda is doing `t` seconds into the premiere. */
export function premiereAt(t: number, keys: number): PremiereMoment {
  const frames = filmFrames(keys), len = frames / FPS, last = Math.max(0, frames - 1);
  const a = PREMIERE.dim, b = a + len, c = b + PREMIERE.hold, e = c + len, f = e + PREMIERE.lights, g = f + PREMIERE.applause;
  if (t < a) return { phase: 'dim', frame: 0, dark: clamp01(t / (a * 0.6)), push: 0, beam: clamp01((t - a * 0.5) / (a * 0.4)) };
  if (t < b) return { phase: 'roll', frame: Math.min(last, Math.floor((t - a) * FPS)), dark: 1, push: 0, beam: 1 };
  if (t < c) return { phase: 'hold', frame: last, dark: 1, push: clamp01((t - b) / PREMIERE.hold), beam: 1 };
  if (t < e) return { phase: 'encore', frame: Math.min(last, Math.floor((t - c) * FPS)), dark: 1, push: 1, beam: 1 };
  if (t < f) return { phase: 'lights', frame: last, dark: 1 - clamp01((t - e) / PREMIERE.lights), push: 1 - clamp01((t - e) / PREMIERE.lights), beam: 1 - clamp01((t - e) / (PREMIERE.lights * 0.6)) };
  if (t < g) return { phase: 'applause', frame: last, dark: 0, push: 0, beam: 0 };
  return { phase: 'over', frame: last, dark: 0, push: 0, beam: 0 };
}
export type CrewId = 'bebe' | 'gobgob' | 'chock' | 'aya' | 'pep';
export const CREW: readonly CrewId[] = ['bebe', 'gobgob', 'chock', 'aya', 'pep'];
export type CrewMood = 'watching' | 'leaning' | 'gasping' | 'turning' | 'cheering';
/** What one of the crew is doing at a premiere moment: they watch, lean in on
 * the longest step, start at the highest point, turn to each other between
 * the two showings, and cheer when the lights come up. */
export function crewMood(index: number, moment: PremiereMoment, keys: readonly Pose[]): CrewMood {
  if (moment.phase === 'applause' || moment.phase === 'over') return 'cheering';
  if (moment.phase === 'hold') return 'turning';
  if (moment.phase === 'lights') return index % 2 === 0 ? 'turning' : 'cheering';
  if (moment.phase !== 'roll' && moment.phase !== 'encore') return 'watching';
  const beats = filmBeats(keys), d = Math.floor(moment.frame / TWOS), late = index % 3;
  if (d >= beats.apex + late && d <= beats.apex + late + 3) return 'gasping';
  if (d >= beats.leap + late && d <= beats.leap + late + 2) return 'leaning';
  return 'watching';
}

/* ── the stage: where everything sits for a room of a given size ─────────── */

/** The tall rotunda picture, and where its round stage is in it (fractions of the picture). */
export const ROOM = { w: 1024, h: 983, daisX: 0.502, daisY: 0.563, daisW: 0.52, daisFront: 0.625, daisBack: 0.503 } as const;
export interface Box { x: number; y: number; w: number; h: number }
export interface StageLayout {
  portrait: boolean; w: number; h: number;
  /** Where the room picture is laid (it covers the stage). */
  room: Box;
  /** Pixels per clay unit, and the pixel that is the set's (0, 0). */
  unit: number; ox: number; oy: number;
  /** The clay units the hero may be carried through. */
  field: Field;
  /** The felt cloth behind the hero, in clay units. */
  cloth: Box;
  /** Bench things, in pixels: the rug of lumps, the camera, the film strip, the cans' row, the lamp and gels, the tune tiles. */
  rug: Box; lens: Box; strip: Box; cans: Box; lamp: Box; gels: Box; tiles: Box; friend: Box;
  /** The premiere's screen, and the lens the beam leaves from, in pixels. */
  screen: Box; beamFrom: Pt;
  /** The row the crew stand in for the premiere: baseline y and the height of the tallest. */
  crewY: number; crewH: number;
}
const HUD_TOP = 84, DOCK = 82;
export function stageLayout(w: number, h: number): StageLayout {
  const W = Math.max(240, w), H = Math.max(220, h), portrait = H >= W;
  const daisY = Math.round(H * (portrait ? 0.6 : H < 420 ? 0.7 : 0.72));
  const scale = Math.max(daisY / (ROOM.daisY * ROOM.h), (H - daisY) / ((1 - ROOM.daisY) * ROOM.h), W / (2 * Math.min(ROOM.daisX, 1 - ROOM.daisX) * ROOM.w)) * 1.002;
  const room: Box = { x: W / 2 - ROOM.daisX * ROOM.w * scale, y: daisY - ROOM.daisY * ROOM.h * scale, w: ROOM.w * scale, h: ROOM.h * scale };
  const daisW = ROOM.daisW * ROOM.w * scale, top = Math.min(HUD_TOP, H * 0.2);
  const unit = Math.max(0.36, Math.min((daisW * 0.9) / SET_W, (daisY - top) / 214, (W * (portrait ? 1 : 0.62)) / SET_W));
  const ox = W / 2 - (SET_W / 2) * unit, oy = daisY - GROUND * unit;
  const side = portrait ? 6 : Math.max(120, W * 0.17);
  const field: Field = { x0: Math.max(-170, (side - ox) / unit + (portrait ? 34 : 50)), x1: Math.min(SET_W + 170, (W - side - ox) / unit - (portrait ? 34 : 50)), y0: (top + 6 - oy) / unit + 30, y1: GROUND };
  const clothTop = Math.max(-120, (top + 2 - oy) / unit), clothHalf = Math.min(portrait ? W / unit / 2 - 6 : 300, (W * 0.5 - side * 0.72) / unit);
  const cloth: Box = { x: SET_W / 2 - clothHalf, y: clothTop, w: clothHalf * 2, h: GROUND - 16 - clothTop };
  const front = daisY + (ROOM.daisFront - ROOM.daisY) * ROOM.h * scale, bottom = H - Math.min(DOCK, H * 0.2);
  let rug: Box, lens: Box, strip: Box, cans: Box, lamp: Box, gels: Box, tiles: Box, friend: Box;
  if (portrait) {
    const zone = Math.max(96, bottom - front - 8), stripH = Math.min(58, zone * 0.34), row = zone - stripH - 8;
    strip = { x: 10, y: front + 6, w: W - 20, h: stripH };
    const rowY = strip.y + stripH + 6;
    rug = { x: W * 0.04, y: rowY, w: W * 0.92, h: row };
    lens = { x: W / 2 - row * 0.4, y: rowY - row * 0.06, w: row * 0.8, h: row * 1.04 };
    cans = { x: W * 0.03, y: front + 4, w: W * 0.94, h: Math.min(zone, W * 0.3) };
    const lampH = Math.min(130, H * 0.17);
    lamp = { x: W - lampH * 0.72 - 2, y: daisY + 16 * unit - lampH, w: lampH * 0.74, h: lampH };
    gels = { x: W * 0.52, y: rowY + row * 0.08, w: Math.min(W * 0.44, row * 1.8), h: row * 0.86 };
    tiles = { x: W * 0.22, y: rowY + row * 0.42, w: W * 0.3, h: row * 0.5 };
    friend = { x: W * 0.04, y: rowY + row * 0.2, w: row * 0.62, h: row * 0.56 };
  } else {
    // On a wide stage the bench is the floor either side of the dais: clay and camera on the left, the lamp on the right, the dock at the end.
    const col = Math.max(110, side * 1.28), rowH = Math.min(H * 0.34, 230), base = H - Math.min(16, H * 0.04), stripH = Math.min(58, H * 0.15), stripW = Math.min(W * 0.46, 480);
    strip = { x: W / 2 - stripW / 2, y: H - stripH - Math.min(12, H * 0.03), w: stripW, h: stripH };
    rug = { x: 10, y: base - rowH, w: col, h: rowH };
    lens = { x: 14, y: base - rowH * 0.94, w: col * 0.6, h: rowH * 0.94 };
    cans = { x: W / 2 - Math.min(W * 0.34, 400), y: front - Math.min(H * 0.26, 170), w: Math.min(W * 0.68, 800), h: Math.min(H * 0.26, 170) };
    const lampH = Math.min(150, H * 0.24), clothRight = ox + (cloth.x + cloth.w) * unit;
    lamp = { x: Math.min(W - lampH * 0.78, clothRight + 6), y: daisY + 10 * unit - lampH, w: lampH * 0.74, h: lampH };
    gels = { x: 10, y: base - rowH * 0.5, w: Math.min(col * 0.86, strip.x - 16), h: rowH * 0.5 };
    tiles = { x: 12, y: base - rowH * 0.9, w: Math.min(col * 0.86, strip.x - 18), h: rowH * 0.34 };
    const lumpSize = Math.max(48, Math.min(84, 56 * unit));
    friend = { x: Math.max(col * 0.9, ox + cloth.x * unit - lumpSize * 0.9), y: daisY + 14 * unit - lumpSize * 0.5, w: lumpSize, h: lumpSize * 0.86 };
  }
  const screenW = portrait ? W * 0.94 : Math.min(W * 0.56, (H * 0.62) * 1.5), screenH = Math.min(screenW / 1.42, H * (portrait ? 0.44 : 0.62));
  const screen: Box = { x: W / 2 - screenW / 2, y: Math.max(top * 0.5, daisY - screenH - H * 0.03), w: screenW, h: screenH };
  const crewH = portrait ? H * 0.3 : H * 0.42;
  return { portrait, w: W, h: H, room, unit, ox, oy, field, cloth, rug, lens, strip, cans, lamp, gels, tiles, friend, screen, beamFrom: [W / 2, H * (portrait ? 0.86 : 0.9)], crewY: H + crewH * 0.34, crewH };
}
/** Clay units ↔ stage pixels. */
export const toPx = (layout: Pick<StageLayout, 'unit' | 'ox' | 'oy'>, p: Pt): Pt => [layout.ox + p[0] * layout.unit, layout.oy + p[1] * layout.unit];
export const toSet = (layout: Pick<StageLayout, 'unit' | 'ox' | 'oy'>, p: Pt): Pt => [(p[0] - layout.ox) / layout.unit, (p[1] - layout.oy) / layout.unit];

/** Fills the numbered blanks of a line: `{0}` is the first value, `{1}` the next. */
export function clayLine(template: string, ...values: (string | number)[]): string {
  return template.replace(/\{(\d)\}/g, (_match, slot: string) => String(values[Number(slot)] ?? ''));
}
