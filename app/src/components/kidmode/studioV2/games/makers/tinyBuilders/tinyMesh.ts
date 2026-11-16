/** Tiny Structures: the small 3D kit behind the bench and the lens view.
 * Pure numbers: vectors, one pinhole camera, and the phage model's own
 * geometry (a T4-like phage, simplified; see SIMPLIFICATIONS in the rules).
 * Model space: y is up, the six feet stand on y = 0, the axis is x = z = 0,
 * and one unit is one twentieth of the old drawing's unit (the model is about
 * fifteen units tall). Nothing here touches the DOM. */

export type V3 = readonly [number, number, number];
export const v3 = (x: number, y: number, z: number): V3 => [x, y, z];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const RAD = Math.PI / 180;

/** A rotation as three rows. */
export type M3 = readonly [V3, V3, V3];
export const IDENTITY: M3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
export const apply = (m: M3, p: V3): V3 => [dot(m[0], p), dot(m[1], p), dot(m[2], p)];
export function matMul(a: M3, b: M3): M3 {
  const col = (j: number): V3 => [b[0][j], b[1][j], b[2][j]];
  const row = (r: V3): V3 => [dot(r, col(0)), dot(r, col(1)), dot(r, col(2))];
  return [row(a[0]), row(a[1]), row(a[2])];
}
export function rotX(deg: number): M3 { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return [[1, 0, 0], [0, c, -s], [0, s, c]]; }
export function rotY(deg: number): M3 { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; }
export function rotZ(deg: number): M3 { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; }

/** Where a part is: a point, a turn about the upright axis, and two tips
 * (sideways and forward) that lay it down on the bench. */
export interface Pose { x: number; y: number; z: number; yaw: number; tipZ: number; tipX: number; /** A turn about the part's own axis, made before it is tipped. */ spin: number }
export const UPRIGHT: Pose = { x: 0, y: 0, z: 0, yaw: 0, tipZ: 0, tipX: 0, spin: 0 };
export const poseMatrix = (p: Pose): M3 => matMul(rotY(p.yaw), matMul(rotX(p.tipX), matMul(rotZ(p.tipZ), rotY(p.spin))));
/** The pose that puts a part's own centre (a model point) at a world point. */
export function poseAbout(centre: V3, at: V3, turn: { yaw: number; tipZ: number; tipX: number; spin: number }): Pose {
  const m = poseMatrix({ x: 0, y: 0, z: 0, ...turn }), c = apply(m, centre);
  return { x: at[0] - c[0], y: at[1] - c[1], z: at[2] - c[2], ...turn };
}
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const l = (u: number, v: number) => u + (v - u) * t;
  return { x: l(a.x, b.x), y: l(a.y, b.y), z: l(a.z, b.z), yaw: l(a.yaw, b.yaw), tipZ: l(a.tipZ, b.tipZ), tipX: l(a.tipX, b.tipX), spin: l(a.spin, b.spin) };
}
/** A full placement: model point → world point. */
export interface Frame { m: M3; at: V3; scale: number }
export const frameOf = (pose: Pose, scale = 1): Frame => ({ m: poseMatrix(pose), at: [pose.x, pose.y, pose.z], scale });
export const place = (f: Frame, p: V3): V3 => add(mul(apply(f.m, p), f.scale), f.at);
/** A frame inside a frame (the model on its turntable, a part on the model). */
export function nest(outer: Frame, inner: Frame): Frame {
  return { m: matMul(outer.m, inner.m), at: place(outer, inner.at), scale: outer.scale * inner.scale };
}

/* ---------- the camera ---------- */
/** One pinhole camera for a picture: it looks at `target` from `dist` away and
 * `elev` degrees above it. `cx, cy` is where the target lands on the screen
 * and `ppu` how many pixels one unit is at the target's distance. */
export interface View { cx: number; cy: number; ppu: number; dist: number; elev: number; target: V3; /** A turn in the picture plane (the lens view). */ roll?: number }
export interface Screen { x: number; y: number; /** Pixels per unit at this point. */ s: number; /** Distance from the eye, for sorting. */ depth: number }
export function project(view: View, p: V3): Screen {
  const e = view.elev * RAD, se = Math.sin(e), ce = Math.cos(e);
  const v = sub(p, view.target);
  // Eye space: right is x; up is (0, ce, -se); forward is (0, -se, -ce); the eye sits `dist` back.
  const xr = v[0], yu = v[1] * ce - v[2] * se, zf = view.dist - (v[1] * se + v[2] * ce);
  const depth = Math.max(view.dist * 0.08, zf), s = view.ppu * view.dist / depth;
  let x = xr * s, y = -yu * s;
  if (view.roll) { const c = Math.cos(view.roll * RAD), r = Math.sin(view.roll * RAD); [x, y] = [x * c - y * r, x * r + y * c]; }
  return { x: view.cx + x, y: view.cy + y, s, depth };
}
/** The unit vector from a point toward the eye (for shading and culling). */
export function toEye(view: View, p: V3): V3 {
  const e = view.elev * RAD;
  const eye = add(view.target, [0, view.dist * Math.sin(e), view.dist * Math.cos(e)]);
  return unit(sub(eye, p));
}
/** The world point under a screen point, on the plane z = `z` (carrying a
 * part) or, with `ground`, on the bench top y = 0. Ignores `roll`. */
export function unproject(view: View, sx: number, sy: number, z: number, ground = false): V3 {
  const e = view.elev * RAD, se = Math.sin(e), ce = Math.cos(e);
  const eye = add(view.target, [0, view.dist * se, view.dist * ce]);
  // A ray through the pixel: forward + right * a + up * b.
  const a = (sx - view.cx) / (view.ppu * view.dist), b = -(sy - view.cy) / (view.ppu * view.dist);
  const ray: V3 = [a, -se + b * ce, -ce - b * se];
  const t = ground ? (Math.abs(ray[1]) < 1e-6 ? 0 : -eye[1] / ray[1]) : (Math.abs(ray[2]) < 1e-6 ? 0 : (z - eye[2]) / ray[2]);
  return add(eye, mul(ray, t));
}

/* ---------- the phage, in model units ---------- */
export const PHAGE = {
  footR: 5.6,
  hip: { r: 1.45, y: 2.45 },
  knee: { r: 4.2, y: 3.6 },
  base: { y0: 2.1, y1: 2.8, r: 1.5 },
  sheath: { y0: 2.8, y1: 8.2, r: 0.62, ribs: 12 },
  tubeR: 0.24,
  collar: { y0: 8.2, y1: 8.8, r: 0.74, plateR: 1.08, plateY: 8.5 },
  head: { y0: 8.8, y1: 14.9, r: 2.15, cap: 1.33 },
  whisker: { r0: 0.95, y0: 8.45, r1: 2.2, y1: 7.15 },
  height: 14.9,
} as const;
export const FIBRE_COUNT = 6;
/** Fibre i leaves the baseplate at this angle (degrees round the axis). */
export const fibreAngle = (i: number): number => 30 + 60 * (((i % FIBRE_COUNT) + FIBRE_COUNT) % FIBRE_COUNT);
export const LEG_UPPER = Math.hypot(PHAGE.knee.r - PHAGE.hip.r, PHAGE.knee.y - PHAGE.hip.y);
export const LEG_LOWER = Math.hypot(PHAGE.footR - PHAGE.knee.r, PHAGE.knee.y);
/** The sheath squeezed as far as it goes (a share of its relaxed length). */
export const SHEATH_MIN = 0.42;

/** The knee that joins a hip to a foot with the two fixed leg lengths (the
 * upper, outer answer of the two), as radius and height. When the two are too
 * far apart to reach, the leg lies straight between them. */
export function kneeBetween(hip: { r: number; y: number }, foot: { r: number; y: number }, upper = LEG_UPPER, lower = LEG_LOWER): { r: number; y: number } {
  const dx = foot.r - hip.r, dy = foot.y - hip.y, d = Math.hypot(dx, dy);
  if (d < 1e-6) return { r: hip.r + upper, y: hip.y };
  if (d >= upper + lower) return { r: hip.r + dx * upper / d, y: hip.y + dy * upper / d };
  const a = (upper * upper - lower * lower + d * d) / (2 * d), h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const mx = hip.r + dx * a / d, my = hip.y + dy * a / d;
  // Two answers, mirrored across the hip-foot line: take the higher one (the knee stands up).
  const k1 = { r: mx + h * dy / d, y: my - h * dx / d }, k2 = { r: mx - h * dy / d, y: my + h * dx / d };
  return k1.y >= k2.y ? k1 : k2;
}
export interface Leg { hip: V3; knee: V3; foot: V3 }
/** One leg in model space. `sink` lowers the body onto planted feet (the
 * knees rise and spread); `flex` (-1 to 1) is a little dance: the foot lifts
 * and tucks. Leg lengths never change. */
export function legPoints(i: number, sink = 0, flex = 0): Leg {
  const a = fibreAngle(i) * RAD, c = Math.cos(a), s = Math.sin(a);
  const hip = { r: PHAGE.hip.r, y: PHAGE.hip.y - sink };
  const lift = Math.max(0, flex), tuck = Math.abs(flex);
  const foot = { r: PHAGE.footR - 0.9 * tuck, y: 1.5 * lift };
  const knee = kneeBetween(hip, foot);
  const at = (p: { r: number; y: number }): V3 => [p.r * c, p.y, p.r * s];
  return { hip: at(hip), knee: at(knee), foot: at(foot) };
}

/** The head: a 20-faced shell, an icosahedron drawn out along the axis (two
 * five-sided caps and a ten-faced band). Twelve corners. */
export function headVertices(h: { y0: number; y1: number; r: number; cap: number } = PHAGE.head): V3[] {
  const out: V3[] = [[0, h.y1, 0]];
  for (let k = 0; k < 5; k++) { const a = (72 * k) * RAD; out.push([h.r * Math.cos(a), h.y1 - h.cap, h.r * Math.sin(a)]); }
  for (let k = 0; k < 5; k++) { const a = (72 * k + 36) * RAD; out.push([h.r * Math.cos(a), h.y0 + h.cap, h.r * Math.sin(a)]); }
  out.push([0, h.y0, 0]);
  return out;
}
export const HEAD_FACES: readonly (readonly [number, number, number])[] = (() => {
  const faces: [number, number, number][] = [];
  for (let k = 0; k < 5; k++) {
    const u0 = 1 + k, u1 = 1 + (k + 1) % 5, l0 = 6 + k, l1 = 6 + (k + 1) % 5;
    faces.push([0, u1, u0], [u0, u1, l0], [u1, l1, l0], [11, l0, l1]);
  }
  return faces;
})();
/** A face's outward unit normal (the corners run so that it points away from the axis). */
export function faceNormal(a: V3, b: V3, c: V3, inside: V3): V3 {
  const n = unit(cross(sub(b, a), sub(c, a)));
  return dot(n, sub(a, inside)) >= 0 ? n : mul(n, -1);
}
/** The DNA thread inside the head: a coil wound round the axis. `left` is the
 * share still inside (it empties from the top as it slides out). */
export function dnaCoil(left = 1, steps = 150, h = PHAGE.head): V3[] {
  const top = h.y1 - 1.1, bottom = h.y0 + 0.75, turns = 11, keep = Math.max(0, Math.min(1, left));
  const out: V3[] = [];
  if (keep <= 0) return out;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; if (t < 1 - keep) continue;
    const y = top + (bottom - top) * t, a = t * turns * 360 * RAD;
    // The coil follows the shell: narrow under each cap, wide in the band.
    const cap = Math.min(1, Math.min(y - h.y0, h.y1 - y) / h.cap);
    const r = h.r * 0.62 * (0.28 + 0.72 * cap);
    out.push([r * Math.cos(a), y, r * Math.sin(a)]);
  }
  return out;
}
/** A six-sided plate: its twelve corners (bottom ring, then top ring). */
export function hexPrism(r: number, y0: number, y1: number, turn = 0): V3[] {
  const ring = (y: number): V3[] => Array.from({ length: 6 }, (_, k) => { const a = (60 * k + turn) * RAD; return [r * Math.cos(a), y, r * Math.sin(a)] as V3; });
  return [...ring(y0), ...ring(y1)];
}
