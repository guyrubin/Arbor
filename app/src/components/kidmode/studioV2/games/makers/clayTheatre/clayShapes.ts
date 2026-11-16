/** Clay Theatre geometry. Pure: numbers in, numbers out, no React.
 *
 * Every clay body is ONE closed outline with a fixed number of vertices,
 * sampled at the same angles in the same order, so any in-between of the lump
 * and a finished hero is a real in-between shape (vertex i of the lump
 * travels to vertex i of the whale), never a cross-fade. Local coordinates: origin at the body's middle, nose toward +x,
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
