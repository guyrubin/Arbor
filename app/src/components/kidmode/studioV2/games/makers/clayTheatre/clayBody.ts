/** Clay Theatre bodies. Pure geometry: numbers in, numbers out, no React, no
 * canvas. Every clay hero is ONE closed outline of `BODY_VERTICES` points
 * that starts as the same hand-rolled lump; three pulls (front, back, top)
 * each drag their own share of the outline out to the finished animal, so a
 * half-pulled lump is a real in-between shape. Small separate pieces (fins,
 * legs, a shell, eyes) grow out with the pull they belong to. Local space:
 * origin at the body's middle, nose toward +x, y down, about 200 units long. */
import { BODY_VERTICES, LUMP_BODY, ROCKET_BODY, WHALE_BODY, clamp01, leafPoints, lerp, seeded, type Leaf, type Pt } from './clayShapes';

export type HeroId = 'whale' | 'rocket' | 'frog' | 'snail';
export const HERO_IDS: readonly HeroId[] = ['whale', 'rocket', 'frog', 'snail'];
export type PullId = 'front' | 'back' | 'top';
export const PULL_IDS: readonly PullId[] = ['front', 'back', 'top'];
export type Pulls = Readonly<Record<PullId, number>>;
export const NO_PULLS: Pulls = { front: 0, back: 0, top: 0 };
export const FULL_PULLS: Pulls = { front: 1, back: 1, top: 1 };
/** Which clay a piece is made of. */
export type ToneId = 'body' | 'trim' | 'pale' | 'dark' | 'glass' | 'warm';

const TAU = Math.PI * 2;
const ANGLES: readonly number[] = Array.from({ length: BODY_VERTICES }, (_, i) => (i / BODY_VERTICES) * TAU);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const bump = (a: number, at: number, width: number) => Math.exp(-Math.pow(wrap(a - at) / width, 2));

/** A frog seen from the front: a wide soft pear with two eye bumps on top. */
function frogPoint(a: number): Pt {
  const c = Math.cos(a), s = Math.sin(a);
  const wide = s > 0 ? 1 + 0.16 * s : 1;
  const eyes = 0.3 * (bump(a, -Math.PI / 2 - 0.6, 0.3) + bump(a, -Math.PI / 2 + 0.6, 0.3));
  let y = 50 * s * (1 + eyes);
  if (y > 40) y = 40 + (y - 40) * 0.4;
  return [68 * c * wide * (1 + eyes * 0.25), y];
}
/** A snail's foot seen from the side: long and low, tail tapering, head lifted at the front. */
function snailPoint(a: number): Pt {
  const c = Math.cos(a), s = Math.sin(a);
  const x = 98 * Math.sign(c) * Math.pow(Math.abs(c), 0.8);
  let y = s < 0 ? -22 * Math.pow(-s, 0.7) : 15 * Math.pow(s, 0.5);
  if (x < -40) y *= 1 - 0.7 * Math.pow((-x - 40) / 58, 1.2);
  const lift = x > 30 ? Math.pow((x - 30) / 68, 1.4) : 0;
  y -= (s < 0 ? 46 : 34) * lift;
  return [x - 14 * lift, y];
}
export const FROG_BODY: readonly Pt[] = ANGLES.map(frogPoint);
export const SNAIL_BODY: readonly Pt[] = ANGLES.map(snailPoint);

/** A separate piece of clay stuck on the body. Everything is in the body's local space. */
export type Piece =
  | { kind: 'leaf'; pull: PullId; tone: ToneId; under?: boolean; leaf: Leaf }
  | { kind: 'ball'; pull: PullId; tone: ToneId; under?: boolean; inside?: boolean; cx: number; cy: number; rx: number; ry: number; spiral?: boolean }
  | { kind: 'eye'; pull: PullId; x: number; y: number; r: number; pupil: number }
  | { kind: 'porthole'; pull: PullId; x: number; y: number; r: number }
  | { kind: 'smile'; pull: PullId; x: number; y: number; w: number; dip: number }
  | { kind: 'blush'; pull: PullId; x: number; y: number; r: number };

export interface HeroSpec {
  id: HeroId;
  body: readonly Pt[];
  pieces: readonly Piece[];
  /** Each pull owns the vertices that face these directions. */
  axes: Readonly<Record<PullId, readonly Pt[]>>;
  /** Where each pull's handle sits on the lump, and which way it is dragged. */
  handles: Readonly<Record<PullId, { at: Pt; dir: Pt }>>;
  /** The rotation (degrees) the hero rests at: the rocket stands on its tail. */
  stand: number;
  /** How far the hero turns to follow the way it travels (0 none, 1 fully). */
  follow: number;
  /** Side-view heroes turn round to face the way they travel. */
  flips: boolean;
  /** The stage scale of the finished hero. */
  size: number;
}
const side: Readonly<Record<PullId, readonly Pt[]>> = { front: [[1, 0]], back: [[-1, 0]], top: [[0, -1]] };
const sideHandles: Readonly<Record<PullId, { at: Pt; dir: Pt }>> = { front: { at: [54, 2], dir: [1, 0] }, back: { at: [-54, 2], dir: [-1, 0] }, top: { at: [2, -46], dir: [0, -1] } };

export const HEROES: Readonly<Record<HeroId, HeroSpec>> = {
  whale: {
    id: 'whale', body: WHALE_BODY, axes: side, handles: sideHandles, stand: 0, follow: 0.85, flips: true, size: 0.86,
    pieces: [
      { kind: 'leaf', pull: 'back', tone: 'body', under: true, leaf: { ax: -92, ay: -26, tx: -116, ty: -60, w: 11 } },
      { kind: 'leaf', pull: 'back', tone: 'body', under: true, leaf: { ax: -92, ay: -22, tx: -134, ty: -22, w: 11 } },
      { kind: 'ball', pull: 'top', tone: 'trim', inside: true, cx: 8, cy: 40, rx: 78, ry: 23 },
      { kind: 'leaf', pull: 'top', tone: 'body', leaf: { ax: -4, ay: 18, tx: -34, ty: 44, w: 11 } },
      { kind: 'eye', pull: 'front', x: 48, y: -14, r: 9, pupil: 4.6 },
      { kind: 'blush', pull: 'front', x: 62, y: 3, r: 7 },
      { kind: 'smile', pull: 'front', x: 64, y: 12, w: 14, dip: 6 },
    ],
  },
  rocket: {
    id: 'rocket', body: ROCKET_BODY, axes: side, handles: sideHandles, stand: -90, follow: 1, flips: false, size: 0.8,
    pieces: [
      { kind: 'leaf', pull: 'back', tone: 'trim', under: true, leaf: { ax: -46, ay: -28, tx: -90, ty: -56, w: 14 } },
      { kind: 'leaf', pull: 'back', tone: 'trim', under: true, leaf: { ax: -46, ay: 28, tx: -90, ty: 56, w: 14 } },
      { kind: 'ball', pull: 'back', tone: 'trim', inside: true, cx: -66, cy: 0, rx: 9, ry: 60 },
      { kind: 'ball', pull: 'front', tone: 'trim', inside: true, cx: 122, cy: 0, rx: 48, ry: 48 },
      { kind: 'porthole', pull: 'top', x: 28, y: 0, r: 16 },
    ],
  },
  frog: {
    id: 'frog', body: FROG_BODY, stand: 0, follow: 0.18, flips: false, size: 0.84,
    axes: { front: [[0, 1]], back: [[1, 0.2], [-1, 0.2]], top: [[0, -1]] },
    handles: { front: { at: [0, 40], dir: [0, 1] }, back: { at: [-56, 6], dir: [-1, 0.2] }, top: { at: [2, -46], dir: [0, -1] } },
    pieces: [
      { kind: 'leaf', pull: 'back', tone: 'body', under: true, leaf: { ax: -46, ay: 22, tx: -98, ty: 44, w: 19 } },
      { kind: 'leaf', pull: 'back', tone: 'body', under: true, leaf: { ax: 46, ay: 22, tx: 98, ty: 44, w: 19 } },
      { kind: 'ball', pull: 'front', tone: 'trim', inside: true, cx: 0, cy: 34, rx: 46, ry: 30 },
      { kind: 'ball', pull: 'front', tone: 'body', cx: -24, cy: 42, rx: 13, ry: 8 },
      { kind: 'ball', pull: 'front', tone: 'body', cx: 24, cy: 42, rx: 13, ry: 8 },
      { kind: 'eye', pull: 'top', x: -30, y: -52, r: 13, pupil: 6 },
      { kind: 'eye', pull: 'top', x: 30, y: -52, r: 13, pupil: 6 },
      { kind: 'blush', pull: 'front', x: -44, y: -6, r: 8 },
      { kind: 'blush', pull: 'front', x: 44, y: -6, r: 8 },
      { kind: 'smile', pull: 'front', x: 0, y: -8, w: 30, dip: 13 },
    ],
  },
  snail: {
    id: 'snail', body: SNAIL_BODY, axes: side, stand: 0, follow: 0.3, flips: true, size: 0.9,
    handles: { front: { at: [54, 2], dir: [0.8, -0.6] }, back: { at: [-54, 2], dir: [-1, 0.1] }, top: { at: [2, -46], dir: [0, -1] } },
    pieces: [
      { kind: 'ball', pull: 'top', tone: 'trim', cx: -20, cy: -46, rx: 47, ry: 43, spiral: true },
      { kind: 'ball', pull: 'front', tone: 'body', cx: 70, cy: -48, rx: 23, ry: 21 },
      { kind: 'leaf', pull: 'front', tone: 'body', under: true, leaf: { ax: 62, ay: -56, tx: 60, ty: -96, w: 4.6 } },
      { kind: 'leaf', pull: 'front', tone: 'body', under: true, leaf: { ax: 76, ay: -56, tx: 88, ty: -94, w: 4.6 } },
      { kind: 'eye', pull: 'front', x: 60, y: -100, r: 8, pupil: 3.8 },
      { kind: 'eye', pull: 'front', x: 89, y: -98, r: 8, pupil: 3.8 },
      { kind: 'blush', pull: 'front', x: 68, y: -42, r: 6 },
      { kind: 'smile', pull: 'front', x: 80, y: -42, w: 8, dip: 4 },
    ],
  },
};

/** Each vertex's share in each pull (the three shares of a vertex add to 1). */
export function pullShares(spec: HeroSpec): readonly Readonly<Record<PullId, number>>[] {
  return ANGLES.map(a => {
    const c = Math.cos(a), s = Math.sin(a);
    const raw = PULL_IDS.map(id => Math.pow(Math.max(0.04, ...spec.axes[id].map(([x, y]) => { const len = Math.hypot(x, y) || 1; return (c * x + s * y) / len; })), 2));
    const total = raw[0] + raw[1] + raw[2];
    return { front: raw[0] / total, back: raw[1] / total, top: raw[2] / total };
  });
}
const SHARES: Readonly<Record<HeroId, ReturnType<typeof pullShares>>> = { whale: pullShares(HEROES.whale), rocket: pullShares(HEROES.rocket), frog: pullShares(HEROES.frog), snail: pullShares(HEROES.snail) };
/** How much of the hero is out of the lump: 0 a lump, 1 finished. */
export const shaped = (pulls: Pulls) => (clamp01(pulls.front) + clamp01(pulls.back) + clamp01(pulls.top)) / 3;
/** The lump is rolled a little smaller than the finished animal is long. */
const LUMP_SCALE = 1.02;
/** The body outline for these pulls. A pull may overshoot a little (the clay stretches, then settles). */
export function heroOutline(hero: HeroId, pulls: Pulls): Pt[] {
  const spec = HEROES[hero], shares = SHARES[hero];
  return spec.body.map((to, i) => {
    const from = LUMP_BODY[i], share = shares[i];
    const k = share.front * pulls.front + share.back * pulls.back + share.top * pulls.top;
    return [lerp(from[0] * LUMP_SCALE, to[0], k), lerp(from[1] * LUMP_SCALE, to[1], k)] as Pt;
  });
}

/** A hero's place on the set: centre, turn (degrees, on top of its `stand`), squash and facing. */
export interface Pose { x: number; y: number; rot: number; sx: number; sy: number; flip: 1 | -1 }
export const REST_POSE: Pose = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, flip: 1 };
/** Local point → set point for a posed hero. */
export function posePoint(hero: HeroId, pose: Pose, p: Pt): Pt {
  const spec = HEROES[hero], r = ((pose.rot + spec.stand) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const X = p[0] * pose.sx * spec.size, Y = p[1] * pose.sy * spec.size;
  return [pose.x + pose.flip * (X * c - Y * s), pose.y + X * s + Y * c];
}
export const posePoints = (hero: HeroId, pose: Pose, points: readonly Pt[]): Pt[] => points.map(p => posePoint(hero, pose, p));
/** Set point → the hero's own local point (for a thumbprint that travels with the clay). */
export function unposePoint(hero: HeroId, pose: Pose, p: Pt): Pt {
  const spec = HEROES[hero], r = ((pose.rot + spec.stand) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const dx = (p[0] - pose.x) * pose.flip, dy = p[1] - pose.y;
  return [(dx * c + dy * s) / (pose.sx * spec.size), (-dx * s + dy * c) / (pose.sy * spec.size)];
}
/** How far below its centre the posed hero's lowest point is: seat it on the ground with this. */
export function heroDrop(hero: HeroId, pulls: Pulls, pose: Pose = REST_POSE): number {
  const at = { ...pose, x: 0, y: 0 };
  return Math.max(...posePoints(hero, at, heroOutline(hero, pulls)).map(p => p[1]));
}
/** Is the set point inside the posed body (a generous hit: the clay is for small fingers)? */
export function heroHit(hero: HeroId, pulls: Pulls, pose: Pose, p: Pt, slack = 14): boolean {
  const local = unposePoint(hero, pose, p), outline = heroOutline(hero, pulls);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of outline) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, rx = (maxX - minX) / 2 + slack, ry = (maxY - minY) / 2 + slack;
  return Math.pow((local[0] - cx) / rx, 2) + Math.pow((local[1] - cy) / ry, 2) <= 1;
}

/** The stop-motion boil: clay that was touched between frames never lands in
 * quite the same place. Seeded by the drawing, so a held drawing is still and
 * a replayed one is identical. `amount` is in local units (about 0.9 reads as clay). */
export function boilOutline(points: readonly Pt[], drawing: number, salt: number, amount = 0.9): Pt[] {
  if (amount <= 0) return points.slice();
  const n = points.length;
  // Low-frequency wobble (three seeded waves round the outline) plus a little per-vertex grit.
  const p1 = seeded(drawing, salt, 1) * TAU, p2 = seeded(drawing, salt, 2) * TAU, p3 = seeded(drawing, salt, 3) * TAU;
  return points.map(([x, y], i) => {
    const a = (i / n) * TAU, len = Math.hypot(x, y) || 1;
    const push = amount * (0.6 * Math.sin(2 * a + p1) + 0.5 * Math.sin(3 * a + p2) + 0.4 * Math.sin(5 * a + p3)) + (seeded(drawing, i, salt) - 0.5) * amount * 0.5;
    return [x + (x / len) * push, y + (y / len) * push] as Pt;
  });
}
/** A press: the clay flattens under the finger and spreads sideways. `press` 0…1. */
export function pressOutline(points: readonly Pt[], at: Pt, press: number): Pt[] {
  if (press <= 0) return points.slice();
  return points.map(([x, y]) => {
    const d = Math.hypot(x - at[0], y - at[1]), near = Math.exp(-Math.pow(d / 60, 2));
    return [x + (x - at[0]) * 0.1 * press * (1 - near), y + (at[1] + 6 - y) * 0.2 * press * near + y * -0.06 * press] as Pt;
  });
}

export interface PieceShape { piece: Piece; grow: number; points: Pt[] }
export const ovalPoints = (cx: number, cy: number, rx: number, ry: number, n = 16): Pt[] => Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt; });
const popOut = (k: number) => { const v = clamp01(k); return v <= 0 ? 0 : 1 - Math.pow(1 - v, 2.4); };
/** The hero's separate pieces in local space, each grown as far as its pull has come out. */
export function heroPieces(hero: HeroId, pulls: Pulls): PieceShape[] {
  const out: PieceShape[] = [];
  for (const piece of HEROES[hero].pieces) {
    const raw = pulls[piece.pull], grow = popOut(raw) * (raw > 1 ? raw : 1);
    if (grow <= 0.02) continue;
    if (piece.kind === 'leaf') {
      const { ax, ay, tx, ty, w } = piece.leaf;
      out.push({ piece, grow, points: leafPoints({ ax, ay, tx: lerp(ax, tx, grow), ty: lerp(ay, ty, grow), w: w * Math.min(1, 0.4 + grow * 0.6) }) });
    } else if (piece.kind === 'ball') {
      out.push({ piece, grow, points: ovalPoints(piece.cx, piece.cy, piece.rx * (piece.inside ? 1 : grow), piece.ry * (piece.inside ? 1 : grow)) });
    } else if (piece.kind === 'eye' || piece.kind === 'porthole') {
      out.push({ piece, grow, points: ovalPoints(piece.x, piece.y, piece.r * grow, piece.r * grow, 14) });
    } else out.push({ piece, grow, points: [] });
  }
  return out;
}

/* ── the second character: one small friend per film ───────────────────── */

export type BuddyId = 'seaBird' | 'starlet' | 'dragonfly' | 'ladybird';
export type BuddyAct = 'hopAct' | 'spinAct' | 'swayAct';
export const BUDDY_ACTS: readonly BuddyAct[] = ['hopAct', 'spinAct', 'swayAct'];
export interface BuddyPart { tone: ToneId; points: Pt[]; under?: boolean; face?: { x: number; y: number; r: number } }
export const starPoints = (r: number, inner: number): Pt[] => Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * TAU - Math.PI / 2, k = 0.5 + 0.5 * Math.cos(5 * (a + Math.PI / 2)); return [Math.cos(a) * lerp(inner, r, k), Math.sin(a) * lerp(inner, r, k)] as Pt; });
/** The friend's clay parts in its own local space (about 60 units across), flapping or twinkling with `beat` (0…1, loops). */
export function buddyParts(id: BuddyId, beat: number): BuddyPart[] {
  const flap = Math.sin(beat * TAU);
  if (id === 'starlet') return [{ tone: 'trim', points: starPoints(30 + 1.5 * flap, 17), face: { x: 0, y: 1, r: 3 } }];
  if (id === 'seaBird') return [
    { tone: 'pale', under: true, points: leafPoints({ ax: -6, ay: -4, tx: -36, ty: -20 - 14 * flap, w: 9 }) },
    { tone: 'pale', points: ovalPoints(0, 0, 22, 16) },
    { tone: 'pale', points: leafPoints({ ax: 4, ay: -4, tx: -16, ty: -24 - 16 * flap, w: 10 }) },
    { tone: 'warm', points: leafPoints({ ax: 18, ay: 0, tx: 34, ty: 3, w: 4 }), face: { x: 10, y: -5, r: 2.6 } },
  ];
  if (id === 'dragonfly') return [
    { tone: 'glass', under: true, points: leafPoints({ ax: 0, ay: -2, tx: -22, ty: -30 - 8 * flap, w: 9 }) },
    { tone: 'glass', under: true, points: leafPoints({ ax: 4, ay: -2, tx: 22, ty: -32 + 8 * flap, w: 9 }) },
    { tone: 'trim', points: leafPoints({ ax: 8, ay: 0, tx: -40, ty: 6, w: 5 }) },
    { tone: 'trim', points: ovalPoints(12, -1, 10, 9), face: { x: 15, y: -3, r: 2.6 } },
  ];
  return [
    { tone: 'dark', under: true, points: ovalPoints(20, 4, 10, 9), face: { x: 23, y: 2, r: 2.2 } },
    { tone: 'trim', points: ovalPoints(0, 0, 24, 18 + flap) },
    { tone: 'dark', points: ovalPoints(-8, -5, 4.5, 4.5) }, { tone: 'dark', points: ovalPoints(6, -8, 4, 4) }, { tone: 'dark', points: ovalPoints(2, 5, 4.5, 4.5) },
  ];
}
/** Where the friend is on a drawing of the film: its spot, plus its act. */
export function buddyPose(act: BuddyAct, at: Pt, drawing: number): { x: number; y: number; rot: number; sx: number; sy: number } {
  const beat = (drawing % 8) / 8, wave = Math.sin(beat * TAU);
  if (act === 'hopAct') { const up = Math.max(0, wave); return { x: at[0], y: at[1] - 26 * up, rot: 0, sx: 1 - 0.1 * up + (wave < -0.6 ? 0.1 : 0), sy: 1 + 0.12 * up - (wave < -0.6 ? 0.12 : 0) }; }
  if (act === 'spinAct') return { x: at[0], y: at[1] - 6, rot: beat * 360, sx: 1, sy: 1 };
  return { x: at[0] + 12 * wave, y: at[1] - 4 * Math.abs(wave), rot: 14 * wave, sx: 1, sy: 1 };
}
