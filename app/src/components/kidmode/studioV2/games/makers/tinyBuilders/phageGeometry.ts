/** Tiny Structures geometry: one T4-like phage, measured in drawing units
 * (about 1.1 units to a nanometre of the real T4, rounded), standing upright
 * with its tail down. Pure numbers only: no React, no colour. The 2.5D view
 * turns the model about its vertical (tail) axis by `rotation` degrees and
 * looks at it slightly from above (`tilt`, the share of depth that shows as
 * height), so a point nearer the viewer sits a little lower on the page.
 *
 * Proportions follow the real particle, simplified: head about 111 x 78 nm,
 * sheath about 98 nm long and 21 nm wide, contracting to about 37 % of its
 * length and half again as wide; six long tail fibres, each two segments
 * with a knee, fixed at the six corners of a hexagonal baseplate. */

export const CX = 200;
/** The drawing's own box. Every scene, thumbnail and hotspot uses it. */
export const VIEW_W = 400, VIEW_H = 440;
/** The tilt used while building and turning; the landing eases it to 0, the
 * side view of a textbook cross-section. */
export const VIEW_TILT = 0.22;

export const HEAD = { top: 40, bottom: 162, r: 43, cap: 26.6 } as const;
export const COLLAR = { top: 162, bottom: 174, r: 14, plateY: 167, plateR: 21 } as const;
export const SHEATH = { top: 174, length: 108, r: 12, rings: 12 } as const;
/** Fully squeezed sheath: share of its length, and how much wider it gets. */
export const SHEATH_MIN = 0.37, SHEATH_WIDEN = 0.5;
export const TUBE_R = 4.6;
export const BASE = { top: 282, height: 13, r: 29 } as const;
/** Fibre rest pose in its own plane: (distance from the axis, height). */
export const FIBRE = { corner: { r: 29, y: 289 }, knee: { r: 84, y: 266 }, tip: { r: 112, y: 338 } } as const;
export const FIBRE_L1 = Math.hypot(FIBRE.knee.r - FIBRE.corner.r, FIBRE.knee.y - FIBRE.corner.y);
export const FIBRE_L2 = Math.hypot(FIBRE.tip.r - FIBRE.knee.r, FIBRE.tip.y - FIBRE.knee.y);
/** The six fibres (and the baseplate corners) sit at 60 degree steps, starting 30 degrees round. */
export const FIBRE_COUNT = 6;
export const FIBRE_OFFSET = 30;
/** Whiskers on the collar: six short thin fibres. */
export const WHISKER = { from: { r: 19, y: 168 }, to: { r: 44, y: 194 } } as const;

const RAD = Math.PI / 180;
export const toRad = (deg: number) => deg * RAD;
export function normDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

export interface Pt { x: number; y: number }
export interface Pt3 { x: number; y: number; z: number }
/** A point at distance `r` from the axis, at angle `theta` (degrees) round
 * it and height `y`, turned by `rotation` and seen with `tilt`. */
export function project(r: number, theta: number, y: number, rotation: number, tilt: number): Pt3 & { sx: number; sy: number } {
  const a = toRad(theta + rotation);
  const x = r * Math.cos(a), z = r * Math.sin(a);
  return { x, y, z, sx: CX + x, sy: y + z * tilt };
}

/* ---------- the head: an icosahedron elongated along its five-fold axis ---------- */
/** Twelve corners: top apex, a ring of five, a ring of five turned 36 degrees, bottom apex. */
export function headVertices(): { r: number; theta: number; y: number }[] {
  const out: { r: number; theta: number; y: number }[] = [{ r: 0, theta: 0, y: HEAD.top }];
  for (let k = 0; k < 5; k++) out.push({ r: HEAD.r, theta: k * 72, y: HEAD.top + HEAD.cap });
  for (let k = 0; k < 5; k++) out.push({ r: HEAD.r, theta: k * 72 + 36, y: HEAD.bottom - HEAD.cap });
  out.push({ r: 0, theta: 0, y: HEAD.bottom });
  return out;
}
/** Twenty triangles: five round the top, ten in the long middle band, five round the bottom. */
export const HEAD_FACES: readonly (readonly [number, number, number])[] = (() => {
  const U = (k: number) => 1 + (k % 5), L = (k: number) => 6 + (k % 5);
  const faces: [number, number, number][] = [];
  for (let k = 0; k < 5; k++) faces.push([0, U(k), U(k + 1)]);
  for (let k = 0; k < 5; k++) { faces.push([U(k), U(k + 1), L(k)]); faces.push([L(k), L(k + 1), U(k + 1)]); }
  for (let k = 0; k < 5; k++) faces.push([11, L(k + 1), L(k)]);
  return faces;
})();

const sub = (a: Pt3, b: Pt3): Pt3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Pt3, b: Pt3): Pt3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const dot = (a: Pt3, b: Pt3) => a.x * b.x + a.y * b.y + a.z * b.z;
const unit = (a: Pt3): Pt3 => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
/** One light, from the top-left and a little in front (y grows downwards). */
export const LIGHT: Pt3 = unit({ x: -0.55, y: -0.75, z: 0.45 });
/** From the model towards the eye, for a given tilt. */
export const viewDir = (tilt: number): Pt3 => unit({ x: 0, y: -tilt, z: 1 });

export interface Facet { points: Pt[]; light: number; front: boolean; height: number; depth: number }
/** The head's twenty facets, each with its projected outline, how much light
 * it catches (0 to 1), whether it faces the eye, its height share (0 top, 1
 * bottom) and its mean depth (for drawing order). `dy` moves the whole head. */
export function headFacets(rotation: number, tilt: number, dy = 0): Facet[] {
  const verts = headVertices().map(v => project(v.r, v.theta, v.y + dy, rotation, tilt));
  const centre: Pt3 = { x: 0, y: (HEAD.top + HEAD.bottom) / 2 + dy, z: 0 };
  const eye = viewDir(tilt);
  return HEAD_FACES.map(([a, b, c]) => {
    const A = verts[a], B = verts[b], C = verts[c];
    let n = unit(cross(sub(B, A), sub(C, A)));
    const mid: Pt3 = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3, z: (A.z + B.z + C.z) / 3 };
    if (dot(n, sub(mid, centre)) < 0) n = { x: -n.x, y: -n.y, z: -n.z };
    return {
      points: [A, B, C].map(p => ({ x: p.sx, y: p.sy })),
      light: Math.max(0, dot(n, LIGHT)),
      front: dot(n, eye) > 0,
      height: (mid.y - dy - HEAD.top) / (HEAD.bottom - HEAD.top),
      depth: mid.z,
    };
  });
}
/** The outline of the head as seen: the convex hull of its projected corners. */
export function headOutline(rotation: number, tilt: number, dy = 0): Pt[] {
  return hull(headVertices().map(v => { const p = project(v.r, v.theta, v.y + dy, rotation, tilt); return { x: p.sx, y: p.sy }; }));
}
export function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const turn = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [], upper: Pt[] = [];
  for (const q of p) { while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
/** Half-width of the head's inside at a height, for the DNA coil. */
export function headInnerRadius(y: number): number {
  const a = HEAD.top + HEAD.cap, b = HEAD.bottom - HEAD.cap, inner = HEAD.r * 0.72;
  if (y <= HEAD.top || y >= HEAD.bottom) return 0;
  if (y < a) return inner * (y - HEAD.top) / HEAD.cap;
  if (y > b) return inner * (HEAD.bottom - y) / HEAD.cap;
  return inner;
}

/* ---------- the fibres ---------- */
/** Where fibre `index` points: its angle round the axis, how far it reaches
 * sideways (cos, -1 left to 1 right) and how near it is (sin, 1 = facing the
 * eye, -1 = behind the tail). The same cos foreshortening turns every part. */
export function fibreAngle(index: number, rotation: number): number {
  return normDeg(FIBRE_OFFSET + index * (360 / FIBRE_COUNT) + rotation);
}
/** Two-segment leg with fixed lengths: the knee that joins `corner` to `tip`
 * in the fibre's own plane (r outward, y down), bending outward and up like
 * a lander's leg. Out of reach, the leg straightens toward the tip. */
export function kneeFor(corner: { r: number; y: number }, tip: { r: number; y: number }, l1 = FIBRE_L1, l2 = FIBRE_L2): { r: number; y: number } {
  const dr = tip.r - corner.r, dy = tip.y - corner.y;
  const d = Math.hypot(dr, dy);
  if (d === 0) return { r: corner.r + l1, y: corner.y };
  if (d >= l1 + l2) return { r: corner.r + dr / d * l1, y: corner.y + dy / d * l1 };
  const a = Math.max(0, Math.min(d, (l1 * l1 - l2 * l2 + d * d) / (2 * d)));
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mr = corner.r + dr * a / d, my = corner.y + dy * a / d;
  // The two answers sit either side of the line from corner to tip: take the
  // one further out and higher (the knee points away from the tail).
  const k1 = { r: mr + h * dy / d, y: my - h * dr / d };
  const k2 = { r: mr - h * dy / d, y: my + h * dr / d };
  return k1.r - k1.y * 0.01 >= k2.r - k2.y * 0.01 ? k1 : k2;
}

/* ---------- the DNA coil ---------- */
export const DNA = { top: 56, bottom: 150, turns: 13 } as const;
/** Points of the wound thread in the head, as runs that are behind (back)
 * or in front of (front) the axis. `left` (0 to 1) is how much is still in
 * the head: the coil empties from the bottom, where the thread leaves. */
export function dnaCoil(rotation: number, tilt: number, left: number, dy = 0, steps = 260): { back: Pt[][]; front: Pt[][]; end: Pt | null } {
  const share = Math.max(0, Math.min(1, left));
  const back: Pt[][] = [], front: Pt[][] = [];
  if (share <= 0) return { back, front, end: null };
  const total = Math.max(2, Math.round(steps * share));
  let run: Pt[] = [], side: boolean | null = null, end: Pt | null = null;
  for (let i = 0; i <= total; i++) {
    const s = i / steps; // 0 top of the coil
    const y = DNA.top + (DNA.bottom - DNA.top) * s;
    const u = s * DNA.turns * 360;
    const p = project(headInnerRadius(y) * 0.92, u, y + dy, rotation, tilt);
    const isFront = p.z >= 0;
    const pt = { x: p.sx, y: p.sy };
    if (side !== null && isFront !== side) { run.push(pt); (side ? front : back).push(run); run = [pt]; } else run.push(pt);
    side = isFront; end = pt;
  }
  if (run.length > 1 && side !== null) (side ? front : back).push(run);
  return { back, front, end };
}
