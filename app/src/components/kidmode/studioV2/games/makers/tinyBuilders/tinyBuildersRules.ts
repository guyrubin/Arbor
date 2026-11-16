import type { Challenge } from '../../adventures/adventureRules';
import { FIBRE_COUNT, PHAGE, SHEATH_MIN, type V3 } from './tinyMesh';

/** Tiny Structures rules: on the TrailBench the child snaps together a
 * magnetic model of a T4-like bacteriophage; then the ProofLens falls through
 * a drop of pond water, power of ten by power of ten, to a real one; then the
 * child helps that one land on a bacterium, legs first. Pure: no React, no
 * timers, no clock, and randomness only from a seed handed in. Nothing about
 * how the child played is kept or reported.
 *
 * SIMPLIFICATIONS (what the model leaves out, on purpose):
 * - Real T4 is built from many different kinds of protein (dozens in the
 *   head and tail alone, hundreds counting the machinery that builds it) with
 *   exact symmetries we do not draw: the head is one 20-faced drawn-out
 *   icosahedron, the sheath twelve stacked ribs (the real one has 23 rings of
 *   subunits wound in a helix), the baseplate a plain six-sided plate, and the
 *   short tail fibres under it are left out.
 * - The six long tail fibres go on as one set (or three pairs of opposite
 *   legs) to keep building playable; in the real particle each is its own
 *   part, and the model's clip ring is not a part of a phage.
 * - A real phage meets a bacterium by chance, tumbling in the water, and
 *   holds on when a fibre tip finds the right spot on the cell. In the game
 *   the child turns it and lowers it; the true part is what happens at the
 *   touch: only the fibre tips can hold, so head first or sideways it drifts
 *   off again.
 * - Landing is told as four plain steps: fibres touch and hold, the
 *   baseplate settles, the sheath squeezes shorter while the stiff tube inside
 *   reaches through the cell's wall, and the DNA slides down the tube. The
 *   squeeze is a simple shortening and widening; the wall is drawn as soft
 *   layers. Nothing after that is shown.
 * - Colours are invented. A phage is far smaller than a wave of light, so it
 *   has no colour of its own. The bench model is resin, metal and wire in
 *   made-up colours (a new colour each round); the real phage in the lens
 *   view is drawn pale, with only its DNA thread tinted so the eye can follow.
 * - It is a picture of the structure, not a simulation of real molecules.
 * - Scale (round, typical figures; see tinyDive.ts): a drop about 5 mm
 *   across; a water flea about 1 mm; a paramecium about 0.2 mm; a rod-shaped
 *   bacterium about 2 micrometres; a T4 phage about 0.2 micrometres. Things
 *   in the lens view are drawn at those sizes on one map. No glass lens shows
 *   a bacterium this clearly or a phage at all: the last two pictures are
 *   drawn from what electron microscopes show, and the words say so. */

export type BuildMode = 'assisted' | 'full';
export const BUILD_MODES: readonly BuildMode[] = ['assisted', 'full'];
export function validMode(value: unknown): value is BuildMode { return value === 'assisted' || value === 'full'; }
/** The younger age bands build with fewer, bigger parts and a stronger
 * magnet; older children get every part. Read from the existing age default. */
export function modeForChallenge(challenge: Challenge): BuildMode { return challenge === 'explore' ? 'full' : 'assisted'; }

export type PieceKind = 'head' | 'collar' | 'tail' | 'tailCollar' | 'baseplate' | 'fibres' | 'fibrePair';
export interface Piece { id: string; kind: PieceKind }
export const PIECES: Readonly<Record<BuildMode, readonly Piece[]>> = {
  assisted: [{ id: 'head', kind: 'head' }, { id: 'tailCollar', kind: 'tailCollar' }, { id: 'baseplate', kind: 'baseplate' }, { id: 'fibres', kind: 'fibres' }],
  full: [{ id: 'head', kind: 'head' }, { id: 'collar', kind: 'collar' }, { id: 'tail', kind: 'tail' }, { id: 'baseplate', kind: 'baseplate' }, { id: 'pair-0', kind: 'fibrePair' }, { id: 'pair-1', kind: 'fibrePair' }, { id: 'pair-2', kind: 'fibrePair' }],
};
export const placementCount = (mode: BuildMode): number => PIECES[mode].length;
export const pieceOf = (mode: BuildMode, id: string): Piece | undefined => PIECES[mode].find(p => p.id === id);

/** The parts on the model, in the order they went on. */
export type Placed = readonly string[];
export const isPlaced = (placed: Placed, id: string): boolean => placed.includes(id);
/** A part goes on once; each part has one place (the three pairs are alike:
 * each takes the next free pair of legs). Null when it cannot go on. */
export function placeOn(mode: BuildMode, placed: Placed, id: string): Placed | null {
  if (!pieceOf(mode, id) || isPlaced(placed, id)) return null;
  return [...placed, id];
}
export const complete = (mode: BuildMode, placed: Placed): boolean => PIECES[mode].every(p => placed.includes(p.id));
/** Which pair of opposite legs (0, 1 or 2) a pair piece holds or would take next. */
export function pairSlot(mode: BuildMode, placed: Placed, id: string): number {
  const pairs = placed.filter(p => pieceOf(mode, p)?.kind === 'fibrePair'), at = pairs.indexOf(id);
  return at >= 0 ? at : Math.min(2, pairs.length);
}
export interface Shown { head: boolean; collar: boolean; tail: boolean; baseplate: boolean; fibres: readonly boolean[] }
export const NONE_SHOWN: Shown = { head: false, collar: false, tail: false, baseplate: false, fibres: [false, false, false, false, false, false] };
export const ALL_SHOWN: Shown = { head: true, collar: true, tail: true, baseplate: true, fibres: [true, true, true, true, true, true] };
/** What one piece is, as drawn parts (pair `slot` holds legs slot and slot + 3). */
export function partsOf(kind: PieceKind, slot = 0): Shown {
  const fibres = Array.from({ length: FIBRE_COUNT }, (_, i) => kind === 'fibres' || (kind === 'fibrePair' && i % 3 === slot % 3));
  return { head: kind === 'head', collar: kind === 'collar' || kind === 'tailCollar', tail: kind === 'tail' || kind === 'tailCollar', baseplate: kind === 'baseplate', fibres };
}
export function shownParts(mode: BuildMode, placed: Placed): Shown {
  const out = { head: false, collar: false, tail: false, baseplate: false, fibres: [false, false, false, false, false, false] };
  for (const id of placed) {
    const piece = pieceOf(mode, id); if (!piece) continue;
    const part = partsOf(piece.kind, pairSlot(mode, placed, id));
    out.head ||= part.head; out.collar ||= part.collar; out.tail ||= part.tail; out.baseplate ||= part.baseplate;
    part.fibres.forEach((on, i) => { if (on) out.fibres[i] = true; });
  }
  return out;
}

/* ---------- where a part sits, and the magnet ---------- */
/** A part's own middle (a model point): what follows the finger and what the magnet measures from. */
export function partCentre(kind: PieceKind): V3 {
  const P = PHAGE;
  if (kind === 'head') return [0, (P.head.y0 + P.head.y1) / 2, 0];
  if (kind === 'collar') return [0, P.collar.plateY, 0];
  if (kind === 'tail') return [0, (P.sheath.y0 + P.sheath.y1) / 2, 0];
  if (kind === 'tailCollar') return [0, (P.sheath.y0 + P.collar.y1) / 2, 0];
  if (kind === 'baseplate') return [0, (P.base.y0 + P.base.y1) / 2, 0];
  return [0, 1.6, 0];
}
/** Where the click runs when a part goes on: the height of its seam and the ring's radius. */
export function seamOf(kind: PieceKind): { y: number; r: number } {
  const P = PHAGE;
  if (kind === 'head') return { y: P.head.y0, r: 1.25 };
  if (kind === 'collar') return { y: P.collar.y0, r: 1.1 };
  if (kind === 'tail' || kind === 'tailCollar') return { y: P.sheath.y0, r: 1.05 };
  if (kind === 'baseplate') return { y: 0.05, r: 2.2 };
  return { y: P.hip.y, r: P.hip.r + 0.25 };
}
/** A carried part feels its place from the pull radius and is taken from the
 * finger inside the lock radius (model units, in the picture). The younger
 * mode's magnet reaches further. */
export const PULL_RADIUS: Readonly<Record<BuildMode, number>> = { assisted: 9, full: 5.6 };
export const LOCK_RADIUS: Readonly<Record<BuildMode, number>> = { assisted: 2.3, full: 1.4 };
export interface Magnet { /** 0 no pull … 1 held fast. */ pull: number; lock: boolean }
export function magnetAt(mode: BuildMode, distance: number): Magnet {
  const d = Number.isFinite(distance) ? Math.max(0, distance) : Infinity;
  const u = Math.max(0, Math.min(1, (PULL_RADIUS[mode] - d) / (PULL_RADIUS[mode] - LOCK_RADIUS[mode])));
  return { pull: u * u * (3 - 2 * u), lock: d <= LOCK_RADIUS[mode] };
}
/** Let go: the part goes on if the magnet has any hold of it; otherwise it drifts back to the bench. */
export const dropLands = (mode: BuildMode, distance: number): boolean => magnetAt(mode, distance).pull > 0;

/* ---------- the parts on the bench ---------- */
export type Orient = 'portrait' | 'landscape';
export interface Spot { x: number; z: number; yaw: number }
/** How each kind of part rests on the bench: tipped on its side, laid flat, or standing; and how high its middle is. */
export const REST: Readonly<Record<PieceKind, { tipZ: number; tipX: number; height: number }>> = {
  head: { tipZ: 90, tipX: 0, height: 1.82 }, tail: { tipZ: 90, tipX: 0, height: 0.64 }, tailCollar: { tipZ: 90, tipX: 0, height: 0.95 },
  collar: { tipZ: 0, tipX: 0, height: 0.32 }, baseplate: { tipZ: 0, tipX: 0, height: 0.36 }, fibres: { tipZ: 0, tipX: 0, height: 1.6 }, fibrePair: { tipZ: 0, tipX: 90, height: 0.3 },
};
const SPOTS: Readonly<Record<Orient, Readonly<Record<BuildMode, readonly (readonly [number, number])[]>>>> = {
  portrait: {
    assisted: [[-5.3, 12.2], [4.9, 11], [5.4, 17.6], [-2.6, 20.6]],
    full: [[-5.3, 12.2], [7, 15.4], [4.9, 10.8], [2.8, 15.8], [-1.2, 18.8], [1.4, 20.9], [-0.4, 23]],
  },
  landscape: {
    assisted: [[-14.5, 2.5], [-10.5, 9.6], [10.6, -1.4], [15.4, 6.6]],
    full: [[-14.5, 1.5], [-9.4, 8.6], [12.6, -2], [10, 6.4], [16, 3], [-15.6, 8.4], [15.4, 9.4]],
  },
};
function mulberry(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Where the loose parts lie for one round: the same parts, laid out afresh
 * (mirrored, nudged and turned by the seed), always clear of the turntable. */
export function benchLayout(mode: BuildMode, orient: Orient, seed: number): Readonly<Record<string, Spot>> {
  const random = mulberry(seed), mirror = random() < 0.5 ? -1 : 1, out: Record<string, Spot> = {};
  PIECES[mode].forEach((piece, i) => {
    const [x, z] = SPOTS[orient][mode][i], lying = REST[piece.kind].tipZ !== 0, flat = REST[piece.kind].tipX !== 0;
    const yaw = lying ? (mirror < 0 ? 180 : 0) + (random() * 2 - 1) * 24 : flat ? (random() * 2 - 1) * 9 : random() * 360;
    out[piece.id] = { x: x * mirror + (random() * 2 - 1) * 0.5, z: z + (random() * 2 - 1) * 0.5, yaw };
  });
  return out;
}
/** The turntable's radius: nothing rests inside it. */
export const PAD_RADIUS = 7.4;

/* ---------- turning ---------- */
export const BUILD_YAW = 16;
export const normDeg = (deg: number): number => ((deg % 360) + 360) % 360;
/** The turntable has weight: let go, it coasts and slows. `friction` is the
 * share of speed lost per second (as a rate); a coast started at v degrees a
 * second runs v / friction degrees in all. */
export const SPIN_FRICTION = 2.6, SPIN_REST = 5, SPIN_MAX = 1400;
export function coast(velocity: number, dtSeconds: number): { velocity: number; turn: number } {
  if (!Number.isFinite(velocity) || !Number.isFinite(dtSeconds) || dtSeconds <= 0) return { velocity: 0, turn: 0 };
  const v = Math.max(-SPIN_MAX, Math.min(SPIN_MAX, velocity)), decay = Math.exp(-SPIN_FRICTION * dtSeconds);
  const next = v * decay;
  return { velocity: Math.abs(next) < SPIN_REST ? 0 : next, turn: v * (1 - decay) / SPIN_FRICTION };
}
/** The push that coasts about `deg` degrees before the table rests. */
export const pushFor = (deg: number): number => deg * SPIN_FRICTION;
/** Dragging sideways turns the model: degrees per pixel of drag, for a model `ppu` pixels per unit. */
export const dragDegrees = (pixels: number, ppu: number): number => (pixels / Math.max(1, ppu)) * 9;
/** The chapter asks for one good turn (in all, either way). */
export const SPIN_GOAL = 150;
/** A fast whole turn is the bench's secret: the legs dance. */
export const DANCE_SPEED = 620;

/* ---------- paint ---------- */
/** A phage has no colour, so the model may wear any: a new one each round. */
export const PAINTS = ['lagoon', 'bluebell', 'iris', 'coral', 'honey'] as const;
export type ModelPaint = typeof PAINTS[number];
export function paintForRound(round: number): ModelPaint {
  const n = Number.isFinite(round) ? Math.abs(Math.trunc(round)) : 0;
  return PAINTS[n % PAINTS.length];
}

/* ---------- the three chapters ---------- */
export type Chapter = 'build' | 'dive' | 'land';
export const CHAPTERS: readonly Chapter[] = ['build', 'dive', 'land'];
export const DIVE_QUEST = ['flea', 'cell', 'bacterium', 'phage'] as const;
export const LAND_QUEST = ['legs', 'pad', 'squeeze', 'thread'] as const;
export type LandStep = typeof LAND_QUEST[number];
/** What a chapter asks, as the keys of its quest pips (things to do, never a measure). */
export function questKeys(chapter: Chapter, mode: BuildMode): readonly string[] {
  if (chapter === 'build') return [...PIECES[mode].map(p => p.id), 'spin'];
  return chapter === 'dive' ? DIVE_QUEST : LAND_QUEST;
}

/* ---------- the landing ---------- */
/** How the phage meets the cell. Roll is its lean in the picture: 0 is
 * upright (legs toward the cell), 180 head down. */
export type Attitude = 'legs' | 'side' | 'head';
export const LEGS_CONE = 34, HEAD_CONE = 126;
export const normRoll = (deg: number): number => { const d = ((deg % 360) + 540) % 360 - 180; return d === -180 ? 180 : d; };
export function attitude(roll: number): Attitude {
  const a = Math.abs(normRoll(roll));
  return a <= LEGS_CONE ? 'legs' : a >= HEAD_CONE ? 'head' : 'side';
}
/** The phage is held by its middle (this high above its feet). */
export const GRIP_Y = 7.5;
const OUTLINE: readonly (readonly [number, number])[] = [
  [PHAGE.footR, 0], [-PHAGE.footR, 0], [PHAGE.knee.r, PHAGE.knee.y], [-PHAGE.knee.r, PHAGE.knee.y],
  [0, PHAGE.head.y1], [PHAGE.head.r, PHAGE.head.y1 - PHAGE.head.cap], [-PHAGE.head.r, PHAGE.head.y1 - PHAGE.head.cap], [PHAGE.head.r, PHAGE.head.y0 + PHAGE.head.cap], [-PHAGE.head.r, PHAGE.head.y0 + PHAGE.head.cap],
];
/** How high the middle must be for the lowest point of the phage to touch the cell (model units), and which point that is. */
export function touchHeight(roll: number): { height: number; x: number; foot: boolean } {
  const a = normRoll(roll) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  let best = { height: -Infinity, x: 0, foot: false };
  OUTLINE.forEach(([x, y], i) => {
    const dy = y - GRIP_Y, down = -(x * s + dy * c);
    if (down > best.height) best = { height: down, x: x * c - dy * s, foot: i < 2 };
  });
  return best;
}
/** The order the six feet take hold, for a lean: the low side first. */
export function catchOrder(roll: number): number[] {
  const lean = Math.sin(normRoll(roll) * Math.PI / 180);
  const reach = (i: number) => Math.cos((30 + 60 * i) * Math.PI / 180);
  return [0, 1, 2, 3, 4, 5].sort((a, b) => (lean >= 0 ? reach(a) - reach(b) : reach(b) - reach(a)) || a - b);
}
export const CATCH_GAP_MS = 150;
/** Near the cell the legs feel for it and the phage rights itself: a little
 * for older children, a lot for the youngest. Degrees a second at the touch. */
export const RIGHTING: Readonly<Record<BuildMode, number>> = { assisted: 150, full: 26 };
export const FEEL_RANGE = 9;
export function selfRight(roll: number, gap: number, mode: BuildMode, dtSeconds: number): number {
  const r = normRoll(roll);
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0 || !Number.isFinite(gap)) return r;
  const near = Math.max(0, Math.min(1, 1 - gap / FEEL_RANGE)), step = RIGHTING[mode] * near * near * dtSeconds;
  return Math.abs(r) <= step ? 0 : r - Math.sign(r) * step;
}
/** Where a round's phage starts: off to one side, leaning, well above the cell. */
export function landStart(seed: number, mode: BuildMode): { x: number; height: number; roll: number } {
  const random = mulberry(seed ^ 0x51ed), side = random() < 0.5 ? -1 : 1;
  const lean = mode === 'assisted' ? 50 + random() * 40 : 95 + random() * 70;
  return { x: side * (2.5 + random() * 3), height: 17 + random() * 2.5, roll: -side * lean };
}
/** The body sinks this far onto its planted feet when the baseplate settles. */
export const SETTLE = 1.25;
export const SETTLE_MS = 900;
/** The squeeze: the child presses, the sleeve shortens. 0 relaxed, 1 squeezed home. */
export function squeezeBy(squeeze: number, delta: number): number {
  const s = Number.isFinite(squeeze) ? squeeze : 0, d = Number.isFinite(delta) ? delta : 0;
  return Math.max(0, Math.min(1, s + d));
}
/** The sleeve's length for a squeeze (a share of its relaxed length): a spring gives fast, then slow. */
export function sheathFor(squeeze: number): number {
  const s = Math.max(0, Math.min(1, Number.isFinite(squeeze) ? squeeze : 0));
  return 1 - (1 - SHEATH_MIN) * (1 - (1 - s) ** 2);
}
/** Let go before it is home and the spring pushes back. */
export const SQUEEZE_SPRING = 1.6, SQUEEZE_STEP = 0.34;
export const THREAD_MS = 2800;
/** The landing as one line of steps: each begins only when the last is done. */
export function nextLandStep(done: readonly LandStep[]): LandStep | null {
  return LAND_QUEST.find(step => !done.includes(step)) ?? null;
}

/** Fills the numbered blanks of a line: `{0}` is the first value. */
export function tinyLine(template: string, ...values: (string | number)[]): string {
  return template.replace(/\{(\d)\}/g, (_m, slot: string) => String(values[Number(slot)] ?? ''));
}
