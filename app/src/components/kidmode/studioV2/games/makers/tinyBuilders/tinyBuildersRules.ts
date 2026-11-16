import type { Challenge } from '../../adventures/adventureRules';
import { FIBRE_COUNT, SHEATH_MIN, fibreAngle, normDeg, toRad, VIEW_TILT } from './phageGeometry';

/** Tiny Structures rules: build a T4-like bacteriophage, turn it, open it up,
 * name its parts and watch it land on a bacterium. Pure: no React, no timers,
 * no randomness. Nothing about how the child played is kept or reported.
 *
 * SIMPLIFICATIONS (what the model leaves out, on purpose):
 * - Real T4 is built from many different kinds of protein (dozens in the
 *   head and tail alone, hundreds counting the machinery that builds it) with
 *   exact symmetries we do not draw: the head is drawn as one 20-faced
 *   elongated icosahedron, the sheath as twelve stacked rings (the real one
 *   has 23 rings of subunits wound in a helix), the baseplate as a plain
 *   hexagon, and the short tail fibres under it are left out.
 * - The six long tail fibres are placed as three pairs (opposite legs) to keep
 *   building playable; in the real particle each is its own part.
 * - Landing is told as four plain steps: fibres touch and hold, the
 *   baseplate settles, the sheath squeezes shorter while the stiff tube inside
 *   reaches through the cell's wall, and the DNA slides down the tube. The
 *   squeeze is a simple shortening and widening; the cell wall is drawn as
 *   three soft layers. Nothing after that is shown.
 * - Colours are invented. A phage is far smaller than a wave of light, so it
 *   has no colour of its own.
 * - It is a picture of the structure, not a simulation of real molecules.
 * - Scale: a T4 phage is about 0.2 micrometres from head to baseplate and a
 *   rod-shaped bacterium such as E. coli about 2 micrometres long, so the
 *   scale picture draws the phage about one tenth of the cell's length. */

export type BuildMode = 'assisted' | 'full';
export const BUILD_MODES: readonly BuildMode[] = ['assisted', 'full'];
export function validMode(value: unknown): value is BuildMode {
  return value === 'assisted' || value === 'full';
}
/** The younger age bands start with fewer, bigger pieces and a glowing
 * blueprint; everyone can switch. Read from the existing age-band default. */
export function modeForChallenge(challenge: Challenge): BuildMode {
  return challenge === 'explore' ? 'full' : 'assisted';
}

/** What a tray piece is. A kind fits only sockets of the same kind. */
export type PieceKind = 'head' | 'collar' | 'tail' | 'tailCollar' | 'baseplate' | 'fibres' | 'fibrePair';
export interface Piece { id: string; kind: PieceKind }
export interface Hotspot { x: number; y: number }
export interface Socket { id: string; kind: PieceKind; /** Where the keyboard / screen-reader target sits. */ at: Hotspot; /** Every point a drop or tap can aim at. */ spots: readonly Hotspot[] }

/** The model's resting turn while it is being built: every fibre pair reads apart. */
export const BUILD_ROTATION = 15;

/** Hotspots in drawing units, for the model at BUILD_ROTATION and VIEW_TILT. */
function fibreSpots(index: number): Hotspot[] {
  const a = toRad(fibreAngle(index, BUILD_ROTATION));
  const knee = { x: 200 + 84 * Math.cos(a), y: 266 + 84 * Math.sin(a) * VIEW_TILT };
  const tip = { x: 200 + 112 * Math.cos(a), y: 338 + 112 * Math.sin(a) * VIEW_TILT };
  return [tip, knee];
}
const round = (h: Hotspot): Hotspot => ({ x: Math.round(h.x), y: Math.round(h.y) });
/** Of a pair (index, index + 3), the leg nearer the eye: its tip is the target. */
function frontOf(pair: number): number {
  const a = Math.sin(toRad(fibreAngle(pair, BUILD_ROTATION))), b = Math.sin(toRad(fibreAngle(pair + 3, BUILD_ROTATION)));
  return a >= b ? pair : pair + 3;
}
const HEAD_SOCKET: Socket = { id: 'head', kind: 'head', at: { x: 200, y: 101 }, spots: [{ x: 200, y: 101 }, { x: 200, y: 62 }, { x: 200, y: 140 }] };
const BASE_SOCKET: Socket = { id: 'baseplate', kind: 'baseplate', at: { x: 200, y: 291 }, spots: [{ x: 200, y: 291 }] };

export const SOCKETS: Readonly<Record<BuildMode, readonly Socket[]>> = {
  assisted: [
    HEAD_SOCKET,
    { id: 'tailCollar', kind: 'tailCollar', at: { x: 200, y: 214 }, spots: [{ x: 200, y: 214 }, { x: 200, y: 172 }, { x: 200, y: 256 }] },
    BASE_SOCKET,
    { id: 'fibres', kind: 'fibres', at: { x: 200, y: 352 }, spots: [{ x: 200, y: 352 }, ...Array.from({ length: FIBRE_COUNT }, (_, i) => fibreSpots(i).map(round)).flat()] },
  ],
  full: [
    HEAD_SOCKET,
    { id: 'collar', kind: 'collar', at: { x: 200, y: 168 }, spots: [{ x: 200, y: 168 }] },
    { id: 'tail', kind: 'tail', at: { x: 200, y: 230 }, spots: [{ x: 200, y: 230 }, { x: 200, y: 200 }, { x: 200, y: 262 }] },
    BASE_SOCKET,
    ...[0, 1, 2].map((pair): Socket => {
      const spots = [...fibreSpots(pair), ...fibreSpots(pair + 3)].map(round);
      return { id: `fibres-${pair}`, kind: 'fibrePair', at: round(fibreSpots(frontOf(pair))[0]), spots };
    }),
  ],
};
export const PIECES: Readonly<Record<BuildMode, readonly Piece[]>> = {
  assisted: [{ id: 'head', kind: 'head' }, { id: 'tailCollar', kind: 'tailCollar' }, { id: 'baseplate', kind: 'baseplate' }, { id: 'fibres', kind: 'fibres' }],
  full: [{ id: 'head', kind: 'head' }, { id: 'collar', kind: 'collar' }, { id: 'tail', kind: 'tail' }, { id: 'baseplate', kind: 'baseplate' }, { id: 'pair-0', kind: 'fibrePair' }, { id: 'pair-1', kind: 'fibrePair' }, { id: 'pair-2', kind: 'fibrePair' }],
};
/** How many placements finish the model in each mode. */
export const placementCount = (mode: BuildMode) => SOCKETS[mode].length;

/** Placed: socket id → the piece id that fills it. */
export type Placed = Readonly<Record<string, string>>;

export function socketOf(mode: BuildMode, id: string): Socket | undefined {
  return SOCKETS[mode].find(s => s.id === id);
}
export function pieceOf(mode: BuildMode, id: string): Piece | undefined {
  return PIECES[mode].find(p => p.id === id);
}
/** A piece fits a socket only when they are the same kind of part. (The
 * three fibre pairs are identical, so any pair fits any free fibre place.) */
export function fits(piece: Piece | PieceKind, socket: Socket): boolean {
  return (typeof piece === 'string' ? piece : piece.kind) === socket.kind;
}
export const isPlaced = (placed: Placed, pieceId: string) => Object.values(placed).includes(pieceId);

/** How near a drop or a tap must be to a place it fits. Assisted mode is
 * generous: anywhere on the blueprint goes to the piece's own place. */
export const SNAP_RADIUS: Readonly<Record<BuildMode, number>> = { assisted: 170, full: 62 };

const dist = (a: Hotspot, b: Hotspot) => Math.hypot(a.x - b.x, a.y - b.y);
function nearest(socket: Socket, point: Hotspot): number {
  return Math.min(...socket.spots.map(s => dist(s, point)));
}
/** Where a piece lands when it is let go (or the blueprint is tapped) at
 * `point`: the id of a free socket it fits, or null (it drifts back). In full
 * mode the nearest place of any kind must be one it fits, so a head dropped
 * on the tail does not jump up to its own place. */
export function fitsAt(mode: BuildMode, piece: Piece, point: Hotspot, placed: Placed): string | null {
  if (isPlaced(placed, piece.id)) return null;
  const free = SOCKETS[mode].filter(s => !placed[s.id] && fits(piece, s));
  if (free.length === 0) return null;
  const radius = SNAP_RADIUS[mode];
  if (mode === 'assisted') {
    const best = free.map(s => ({ s, d: nearest(s, point) })).sort((a, b) => a.d - b.d)[0];
    const anyNear = SOCKETS[mode].some(s => nearest(s, point) <= radius);
    return anyNear ? best.s.id : null;
  }
  const ranked = SOCKETS[mode].map(s => ({ s, d: nearest(s, point) })).filter(e => e.d <= radius).sort((a, b) => a.d - b.d);
  const first = ranked[0];
  if (!first || !fits(piece, first.s)) return null;
  if (!placed[first.s.id]) return first.s.id;
  // The nearest fibre place is already full: the next free fibre place takes it.
  const next = ranked.find(e => !placed[e.s.id] && fits(piece, e.s));
  return next ? next.s.id : null;
}
/** Placing on a socket chosen directly (keyboard, screen reader). */
export function placeOn(mode: BuildMode, placed: Placed, pieceId: string, socketId: string): Placed | null {
  const piece = pieceOf(mode, pieceId), socket = socketOf(mode, socketId);
  if (!piece || !socket || placed[socketId] || isPlaced(placed, pieceId) || !fits(piece, socket)) return null;
  return { ...placed, [socketId]: pieceId };
}
/** The socket a selected piece belongs in (its first free one): the glow. */
export function homeFor(mode: BuildMode, pieceId: string, placed: Placed): string | null {
  const piece = pieceOf(mode, pieceId);
  if (!piece || isPlaced(placed, pieceId)) return null;
  return SOCKETS[mode].find(s => !placed[s.id] && fits(piece, s))?.id ?? null;
}
export function complete(mode: BuildMode, placed: Placed): boolean {
  return SOCKETS[mode].every(s => !!placed[s.id]);
}

/** Which drawn parts are on the model. */
export interface Shown { head: boolean; collar: boolean; tail: boolean; baseplate: boolean; fibres: readonly boolean[] }
export function shownParts(mode: BuildMode, placed: Placed): Shown {
  const fibres = Array.from({ length: FIBRE_COUNT }, () => false);
  if (mode === 'assisted') {
    if (placed.fibres) fibres.fill(true);
    return { head: !!placed.head, collar: !!placed.tailCollar, tail: !!placed.tailCollar, baseplate: !!placed.baseplate, fibres };
  }
  for (const pair of [0, 1, 2]) if (placed[`fibres-${pair}`]) { fibres[pair] = true; fibres[pair + 3] = true; }
  return { head: !!placed.head, collar: !!placed.collar, tail: !!placed.tail, baseplate: !!placed.baseplate, fibres };
}
export const ALL_SHOWN: Shown = { head: true, collar: true, tail: true, baseplate: true, fibres: [true, true, true, true, true, true] };

/** Switching modes mid-build keeps what is already true of the model. */
export function convertPlaced(from: BuildMode, to: BuildMode, placed: Placed): Placed {
  if (from === to) return { ...placed };
  const out: Record<string, string> = {};
  if (placed.head) out.head = 'head';
  if (placed.baseplate) out.baseplate = 'baseplate';
  if (to === 'full') {
    if (placed.tailCollar) { out.collar = 'collar'; out.tail = 'tail'; }
    if (placed.fibres) [0, 1, 2].forEach(pair => { out[`fibres-${pair}`] = `pair-${pair}`; });
    return out;
  }
  if (placed.collar && placed.tail) out.tailCollar = 'tailCollar';
  if ([0, 1, 2].every(pair => placed[`fibres-${pair}`])) out.fibres = 'fibres';
  return out;
}

/* ---------- turning ---------- */
/** How a fibre looks at a turn: its angle, sideways reach (cos) and nearness
 * (sin). Front fibres are drawn over the tail, back ones behind it. */
export function fibreView(index: number, rotation: number): { angle: number; reach: number; near: number; front: boolean } {
  const angle = fibreAngle(index, rotation), a = toRad(angle);
  const near = Math.sin(a);
  return { angle, reach: Math.cos(a), near, front: near >= 0 };
}
export const TURN_STEP = 30;
/** Dragging sideways turns the model: the near side follows the finger. */
export const DRAG_DEG_PER_UNIT = 0.9;
export function turnBy(rotation: number, deg: number): number {
  return normDeg(rotation + deg);
}

/* ---------- naming the parts ---------- */
export type LabelId = 'head' | 'dna' | 'collar' | 'tail' | 'baseplate' | 'fibres';
export const LABELS: readonly LabelId[] = ['head', 'dna', 'collar', 'tail', 'baseplate', 'fibres'];
/** DNA can only be named while the model is opened up: it is inside. */
export function canName(label: LabelId, cutaway: boolean): boolean {
  return label !== 'dna' || cutaway;
}
export function visit(visited: readonly LabelId[], label: LabelId, cutaway: boolean): readonly LabelId[] {
  if (!canName(label, cutaway) || visited.includes(label)) return visited;
  return [...visited, label];
}
export function unvisited(visited: readonly LabelId[]): LabelId[] {
  return LABELS.filter(l => !visited.includes(l));
}

/* ---------- landing ---------- */
export const LAND_MS = 9600;
/** Held still after the DNA is inside, before the scale picture. */
export const LAND_REST_MS = 900;
export type LandStage = 'drift' | 'touch' | 'settle' | 'squeeze' | 'inside';
/** Where the stages begin, as a share of the landing. */
export const LAND_STAGES: readonly { stage: LandStage; from: number }[] = [
  { stage: 'drift', from: 0 }, { stage: 'touch', from: 0.29 }, { stage: 'settle', from: 0.37 }, { stage: 'squeeze', from: 0.5 }, { stage: 'inside', from: 0.68 },
];
/** With motion reduced the landing is told in still frames, one per stage. */
export const LAND_KEYFRAMES: readonly number[] = [0, 0.3, 0.47, 0.66, 1];
export const LAND_KEYFRAME_MS = 1700;
export function landKeyframe(elapsedMs: number): number {
  const i = Math.max(0, Math.min(LAND_KEYFRAMES.length - 1, Math.floor(Math.max(0, elapsedMs) / LAND_KEYFRAME_MS)));
  return LAND_KEYFRAMES[i];
}
export const reducedLandMs = () => LAND_KEYFRAMES.length * LAND_KEYFRAME_MS;

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const ease = (u: number) => u * u * (3 - 2 * u);
/** How far the tips fall to meet the surface, and the body then settles. */
export const DESCENT = 54, SETTLE_DROP = 30, CAMERA_PAN = 70;
export interface LandFrame {
  stage: LandStage;
  /** The whole phage moves down this far (drawing units). */
  descent: number;
  /** The body (all but the fibre tips) sinks this much more as the legs bend. */
  settle: number;
  /** Sheath length share: 1 relaxed, SHEATH_MIN squeezed. */
  sheath: number;
  /** DNA moved out of the head, 0 to 1. */
  dna: number;
  /** View tilt, easing to a side view. */
  tilt: number;
  /** The view follows the phage down. */
  camera: number;
  /** The display stand fades out; the cell's surface fades in. */
  stand: number;
  surface: number;
}
/** The landing at time share `t` (0 to 1). Every quantity moves one way only. */
export function landFrame(t: number): LandFrame {
  const u = clamp01(t);
  let stage: LandStage = 'drift';
  for (const s of LAND_STAGES) if (u >= s.from) stage = s.stage;
  return {
    stage,
    descent: DESCENT * ease(span(u, 0, 0.3)),
    settle: SETTLE_DROP * ease(span(u, 0.33, 0.47)),
    // A spring lets go fast and then slows: an ease-out squeeze.
    sheath: 1 - (1 - SHEATH_MIN) * (1 - (1 - span(u, 0.5, 0.64)) ** 2),
    dna: ease(span(u, 0.68, 0.97)),
    tilt: VIEW_TILT * (1 - ease(span(u, 0, 0.26))),
    camera: CAMERA_PAN * ease(span(u, 0.04, 0.7)),
    stand: 1 - span(u, 0, 0.14),
    surface: span(u, 0.04, 0.26),
  };
}

/** Fills the numbered blanks of a line: `{0}` is the first value. */
export function tinyLine(template: string, ...values: (string | number)[]): string {
  return template.replace(/\{(\d)\}/g, (_m, slot: string) => String(values[Number(slot)] ?? ''));
}
