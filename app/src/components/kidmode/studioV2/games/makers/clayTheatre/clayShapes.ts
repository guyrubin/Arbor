/** Clay Theatre geometry. Pure: numbers in, numbers out, no React.
 *
 * The clay body of the first film is ONE closed outline with a fixed number
 * of vertices, sampled at the same angles in the same order for the whale,
 * the lump and the rocket. Any in-between is therefore a real in-between
 * shape (vertex i of the whale travels to vertex i of the rocket), never a
 * cross-fade. Local coordinates: origin at the body's middle, nose toward +x,
 * y down, about 200 units long. */
export type Pt = readonly [number, number];
export const BODY_VERTICES = 40;

const TAU = Math.PI * 2;
const ANGLES: readonly number[] = Array.from({ length: BODY_VERTICES }, (_, i) => (i / BODY_VERTICES) * TAU);
const sgnPow = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const unit = (v: number) => Math.min(1, Math.max(0, v));

/** A rounded whale: a full round head, a soft belly, a back that narrows into the tail stalk. */
function whalePoint(a: number): Pt {
  const c = Math.cos(a), s = Math.sin(a);
  const x = c >= 0 ? 80 * c : 100 * c;
  const taper = c >= 0 ? 1 : 1 - 0.78 * Math.pow(-c, 1.7);
  const hump = s < 0 ? 1 + 0.08 * Math.max(0, c) : 0.86;
  // The tail stalk curves up, the way a cartoon whale's does.
  const curl = -26 * Math.pow(unit((-x - 30) / 70), 2);
  return [x, s * 50 * taper * hump + curl];
}
/** A squashed lump: a little uneven, flat where it sits, with a thumb dent pressed into its top. */
function lumpPoint(a: number): Pt {
  const c = Math.cos(a), s = Math.sin(a);
  let r = 56 * (1 + 0.05 * Math.cos(3 * a + 0.7) + 0.03 * Math.cos(5 * a + 1.9));
  r -= 10 * Math.exp(-Math.pow(wrap(a + Math.PI / 2 - 0.35) / 0.3, 2));
  const x = r * c * 1.1;
  let y = r * s;
  if (y > 38) y = 38 + (y - 38) * 0.35;
  return [x, y];
}
/** A rocket lying nose-east: a rounded can, a pulled cone, a slightly flared base. */
function rocketPoint(a: number): Pt {
  const c = Math.cos(a), s = Math.sin(a);
  const x = sgnPow(c, 0.55) * (c >= 0 ? 108 : 78);
  let y = sgnPow(s, 0.55) * 33;
  if (x > 16) y *= 1 - 0.9 * Math.pow((x - 16) / 92, 1.4);
  if (x < -55) y *= 1 + 0.2 * ((-x - 55) / 23);
  return [x, y];
}
export const WHALE_BODY: readonly Pt[] = ANGLES.map(whalePoint);
export const LUMP_BODY: readonly Pt[] = ANGLES.map(lumpPoint);
export const ROCKET_BODY: readonly Pt[] = ANGLES.map(rocketPoint);
export const BODY_KEYFRAMES = { whale: WHALE_BODY, lump: LUMP_BODY, rocket: ROCKET_BODY } as const;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const easeInOut = (k: number) => { const v = clamp01(k); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
export const easeOut = (k: number) => 1 - Math.pow(1 - clamp01(k), 3);
export const easeIn = (k: number) => Math.pow(clamp01(k), 2.2);
/** 0 → 1 over [a, b], eased. */
export const span = (t: number, a: number, b: number, ease = easeInOut) => ease((t - a) / (b - a));

/** Vertex-by-vertex in-between of two outlines. Throws if they do not match. */
export function lerpShape(a: readonly Pt[], b: readonly Pt[], k: number): Pt[] {
  if (a.length !== b.length) throw new Error('clay keyframes must share a vertex count');
  return a.map((p, i) => [lerp(p[0], b[i][0], k), lerp(p[1], b[i][1], k)] as Pt);
}

/** A stable pseudo-random number in [0, 1) for the given integers: the same
 * frame always gets the same boil, the same droplet the same arc. */
export function seeded(...values: number[]): number {
  let h = 2166136261 >>> 0;
  for (const value of values) {
    h ^= Math.imul((Math.round(value * 1000) | 0) ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35);
    h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

/** The stop-motion boil: every vertex shifts by at most ±0.6 units, seeded by
 * the frame, so a held frame is still and a replayed frame is identical. */
export const BOIL = 0.6;
export function boil(points: readonly Pt[], frame: number, salt: number): Pt[] {
  return points.map((p, i) => [p[0] + (seeded(frame, i, salt) - 0.5) * 2 * BOIL, p[1] + (seeded(frame, i, salt + 7) - 0.5) * 2 * BOIL] as Pt);
}

/** Places local points in the world: scale, rotate (degrees), then move. */
export function place(points: readonly Pt[], cx: number, cy: number, rotDeg: number, sx = 1, sy = sx): Pt[] {
  const r = (rotDeg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return points.map(([x, y]) => { const X = x * sx, Y = y * sy; return [cx + X * c - Y * s, cy + X * s + Y * c] as Pt; });
}
export function placePoint(p: Pt, cx: number, cy: number, rotDeg: number, sx = 1, sy = sx): Pt { return place([p], cx, cy, rotDeg, sx, sy)[0]; }
/** The other way: a point on the stage, back in a placed body's own coordinates. */
export function unplacePoint(p: Pt, cx: number, cy: number, rotDeg: number, sx = 1, sy = sx): Pt {
  const r = (rotDeg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), dx = p[0] - cx, dy = p[1] - cy;
  return [(dx * c + dy * s) / sx, (-dx * s + dy * c) / sy];
}

/** A closed, smooth outline through the points (Catmull-Rom as cubic Béziers). */
export function smoothPath(points: readonly Pt[]): string {
  const n = points.length;
  if (n < 3) return '';
  const f = (v: number) => (Math.round(v * 10) / 10).toString();
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

/** A leaf-shaped clay piece from its root to its tip (flukes, fins, petals, pads). */
export interface Leaf { ax: number; ay: number; tx: number; ty: number; w: number }
export const LEAF_VERTICES = 12;
export function leafPoints(leaf: Leaf): Pt[] {
  const dx = leaf.tx - leaf.ax, dy = leaf.ty - leaf.ay, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len, half = LEAF_VERTICES / 2;
  const side = (u: number, sign: number): Pt => {
    const w = leaf.w * Math.pow(Math.sin(Math.PI * u), 0.75) * (1 - 0.35 * u) * sign;
    return [leaf.ax + dx * u + nx * w, leaf.ay + dy * u + ny * w];
  };
  const out: Pt[] = [];
  for (let i = 0; i < half; i++) out.push(side(i / (half - 1), 1));
  for (let i = half - 1; i >= 0; i--) out.push(side(i / (half - 1), -1));
  return out;
}
export function lerpLeaf(a: Leaf, b: Leaf, k: number): Leaf {
  return { ax: lerp(a.ax, b.ax, k), ay: lerp(a.ay, b.ay, k), tx: lerp(a.tx, b.tx, k), ty: lerp(a.ty, b.ty, k), w: lerp(a.w, b.w, k) };
}
export interface Oval { cx: number; cy: number; rx: number; ry: number }
export function lerpOval(a: Oval, b: Oval, k: number): Oval {
  return { cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k), rx: lerp(a.rx, b.rx, k), ry: lerp(a.ry, b.ry, k) };
}

/** The small separate parts, keyed like the body (whale → lump → rocket). */
export interface PartKey {
  /** Eye → porthole: the ring grows in, the pupil shrinks away. */
  eye: { x: number; y: number; ring: number; pupil: number };
  smile: number;
  flukes: readonly [Leaf, Leaf];
  /** The water spout on the whale's head sinks in; the flame is its own part at the base. */
  spout: { x: number; y: number; s: number };
  /** Trim clay, clipped inside the body: the whale's belly slides up into the rocket's nose cap. */
  trim: Oval;
  band: Oval;
  dent: number;
}
export const PART_KEYS: Readonly<Record<'whale' | 'lump' | 'rocket', PartKey>> = {
  whale: {
    eye: { x: 50, y: -13, ring: 0, pupil: 4.8 }, smile: 1,
    flukes: [{ ax: -94, ay: -27, tx: -114, ty: -58, w: 10 }, { ax: -94, ay: -22, tx: -132, ty: -24, w: 10 }],
    spout: { x: 32, y: -54, s: 1 },
    trim: { cx: 8, cy: 36, rx: 76, ry: 22 }, band: { cx: -74, cy: 0, rx: 0, ry: 0 }, dent: 0,
  },
  lump: {
    eye: { x: 26, y: -8, ring: 3.5, pupil: 3.8 }, smile: 0,
    flukes: [{ ax: -52, ay: -18, tx: -64, ty: -32, w: 5 }, { ax: -52, ay: 18, tx: -64, ty: 32, w: 5 }],
    spout: { x: 14, y: -48, s: 0 },
    trim: { cx: 2, cy: 46, rx: 64, ry: 20 }, band: { cx: -60, cy: 0, rx: 0, ry: 30 }, dent: 1,
  },
  rocket: {
    eye: { x: 36, y: 0, ring: 15, pupil: 0 }, smile: 0,
    flukes: [{ ax: -48, ay: -30, tx: -88, ty: -54, w: 13 }, { ax: -48, ay: 30, tx: -88, ty: 54, w: 13 }],
    spout: { x: -60, y: 0, s: 0 },
    trim: { cx: 120, cy: 0, rx: 46, ry: 46 }, band: { cx: -66, cy: 0, rx: 9, ry: 60 }, dent: 0,
  },
};
export function lerpParts(a: PartKey, b: PartKey, k: number): PartKey {
  return {
    eye: { x: lerp(a.eye.x, b.eye.x, k), y: lerp(a.eye.y, b.eye.y, k), ring: lerp(a.eye.ring, b.eye.ring, k), pupil: lerp(a.eye.pupil, b.eye.pupil, k) },
    smile: lerp(a.smile, b.smile, k),
    flukes: [lerpLeaf(a.flukes[0], b.flukes[0], k), lerpLeaf(a.flukes[1], b.flukes[1], k)],
    spout: { x: lerp(a.spout.x, b.spout.x, k), y: lerp(a.spout.y, b.spout.y, k), s: lerp(a.spout.s, b.spout.s, k) },
    trim: lerpOval(a.trim, b.trim, k), band: lerpOval(a.band, b.band, k), dent: lerp(a.dent, b.dent, k),
  };
}

/** The whale's tail beats up and down (whales swim with their tails, not
 * side to side): rear vertices lift by a weight that grows toward the tail. */
export function tailWeight(x: number): number { return Math.pow(clamp01((-x - 18) / 82), 1.5); }
export function beatBody(points: readonly Pt[], lift: number): Pt[] {
  return points.map(([x, y]) => [x, y + lift * tailWeight(x)] as Pt);
}
/** A body arched along its length: positive bends the nose and tail down. */
export function bendBody(points: readonly Pt[], bend: number): Pt[] {
  return points.map(([x, y]) => [x, y + bend * Math.pow(x / 90, 2) * 30] as Pt);
}
/** A fluke rides the bent body rigidly: moved by the bend at its root and
 * turned by the body's slope there (bending its own points would stretch it). */
export function bendLeaf(leaf: Leaf, bend: number): Leaf {
  if (!bend) return leaf;
  const at = (x: number) => bend * Math.pow(x / 90, 2) * 30, slope = (bend * 2 * leaf.ax * 30) / 8100;
  const dy = at(leaf.ax);
  return { ...leaf, ay: leaf.ay + dy, ty: leaf.ty + dy + slope * (leaf.tx - leaf.ax) };
}
