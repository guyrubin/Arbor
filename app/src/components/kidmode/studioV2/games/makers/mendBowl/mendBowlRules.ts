/** Mend the Bowl rules. Pure: no React, no timers, no randomness inside.
 * The saved creation is bounded toy choices only: a glaze, one of three
 * authored break patterns, and the order the gold seams were traced.
 * The pattern geometry itself lives in `mendBowlPatterns.ts`, which this file
 * never imports, so the validator stays tiny in the main bundle. */
export const BOWL_GLAZES = ['celadon', 'indigo', 'rose', 'cream'] as const;
export type BowlGlaze = typeof BOWL_GLAZES[number];
export type BowlPattern = 0 | 1 | 2;
/** Seams per authored break pattern (index = pattern). Every pattern has one
 * inner junction, so a pattern of n pieces has exactly n seams (Euler:
 * pieces = seams - junctions + 1). `mendBowlPatterns.test.ts` holds the data to these. */
export const BOWL_SEAM_COUNTS: readonly [number, number, number] = [4, 5, 6];
export interface BowlCreation { kind: 'bowl'; glaze: BowlGlaze; pattern: BowlPattern; seams: number[] }

/** `seams` is a permutation of 0..n-1, n = that pattern's seam count. */
export function validBowl(value: unknown): value is BowlCreation {
  if (!value || typeof value !== 'object') return false;
  const v = value as BowlCreation;
  if (v.kind !== 'bowl' || !(BOWL_GLAZES as readonly string[]).includes(v.glaze) || ![0, 1, 2].includes(v.pattern) || !Array.isArray(v.seams)) return false;
  const n = BOWL_SEAM_COUNTS[v.pattern];
  return v.seams.length === n && v.seams.every(s => Number.isInteger(s) && s >= 0 && s < n) && new Set(v.seams).size === n;
}

/* ---------- geometry the play and the art share ---------- */
export interface Point { x: number; y: number }
/** A piece's pose relative to its home: its centre moved by (x, y) stage units
 * and turned by r degrees about its own centre. Home is {0, 0, 0}. */
export interface Pose { x: number; y: number; r: number }
export interface BowlPiece {
  /** Outline in stage units, at home. Built from the same edges as the seams. */
  polygon: readonly Point[];
  centroid: Point;
  /** Farthest outline point from the centre (for placing the turn buttons). */
  radius: number;
  /** The scattered pose after the break (authored per pattern). */
  start: Pose;
  /** Indexes of the seams on this piece's edge. */
  seams: readonly number[];
}
export interface BowlSeam {
  /** The shared edge between two pieces, as a polyline in stage units. */
  points: readonly Point[];
  /** The two pieces it joins. */
  between: readonly [number, number];
  length: number;
}
export interface BowlPatternData { pieces: readonly BowlPiece[]; seams: readonly BowlSeam[] }

export const HOME: Pose = { x: 0, y: 0, r: 0 };
/** A piece snaps when its centre is this close to home (stage units)… */
export const SNAP_DIST = 30;
/** …and it is turned no more than this from its true angle. */
export const SNAP_DEG = 25;
/** Within this distance of home, a drag eases the last few degrees… */
export const ASSIST_DIST = 84;
/** …as long as the piece is no further off than this. */
export const ASSIST_DEG = 40;
/** One tap of a turn button. */
export const ROTATE_STEP = 15;
/** Share of a seam's length the finger has to pass over. */
export const SEAM_COVER = 0.8;
/** Finger tolerance around a seam, in screen pixels (converted by the caller). */
export const SEAM_TOLERANCE_PX = 28;
/** Spacing of the coverage samples along a seam, in stage units. */
export const SEAM_SAMPLE = 4;

/** Degrees folded into (-180, 180]. */
export function normalizeDeg(deg: number): number {
  const d = ((deg % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}
/** One turn-button tap: the pose turned by `step` degrees. */
export function rotate(pose: Pose, step: number): Pose {
  return { ...pose, r: normalizeDeg(pose.r + step) };
}
/** Near home, the piece's turn eases toward true, so a young child is not
 * stuck on the last few degrees. Far away, or turned a lot, it is unchanged. */
export function assist(pose: Pose): Pose {
  const d = Math.hypot(pose.x, pose.y), r = normalizeDeg(pose.r);
  if (d >= ASSIST_DIST || Math.abs(r) > ASSIST_DEG) return { ...pose, r };
  return { ...pose, r: r * (d / ASSIST_DIST) };
}
/** True when the pose is close enough to home, place and turn, to snap. Every
 * pose is relative to the piece's own home, so a piece only fits its own place. */
export function fits(_piece: BowlPiece, pose: Pose): boolean {
  return Math.hypot(pose.x, pose.y) <= SNAP_DIST && Math.abs(normalizeDeg(pose.r)) <= SNAP_DEG;
}
/** The pose that puts the piece's centre at a stage point, keeping its turn. */
export function poseAt(piece: BowlPiece, point: Point, r: number): Pose {
  return { x: point.x - piece.centroid.x, y: point.y - piece.centroid.y, r };
}
/** A point of the piece's home outline, carried by a pose. */
export function posePoint(piece: BowlPiece, pose: Pose, p: Point): Point {
  const a = pose.r * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const dx = p.x - piece.centroid.x, dy = p.y - piece.centroid.y;
  return { x: piece.centroid.x + dx * c - dy * s + pose.x, y: piece.centroid.y + dx * s + dy * c + pose.y };
}
/** The whole bowl tipping about a pivot, expressed as each piece's pose. */
export function tipPose(piece: BowlPiece, pivot: Point, deg: number, lift: Point): Pose {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const dx = piece.centroid.x - pivot.x, dy = piece.centroid.y - pivot.y;
  return { x: pivot.x + dx * c - dy * s + lift.x - piece.centroid.x, y: pivot.y + dx * s + dy * c + lift.y - piece.centroid.y, r: deg };
}
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
/** Which home place (piece index) a stage point falls in, or -1. */
export function slotAt(pattern: BowlPatternData, p: Point): number {
  return pattern.pieces.findIndex(piece => pointInPolygon(p, piece.polygon));
}
/** Where a tap on the outline sends the chosen piece: into its own home when
 * the tap lands in its own place, else to the tapped point (then it drifts back). */
export function tapPose(pattern: BowlPatternData, index: number, point: Point, r: number): Pose {
  return slotAt(pattern, point) === index ? { x: 0, y: 0, r } : poseAt(pattern.pieces[index], point, r);
}
export function allPlaced(placed: readonly boolean[], pattern: BowlPatternData): boolean {
  return placed.length === pattern.pieces.length && placed.every(Boolean);
}
export function allTraced(order: readonly number[], pattern: BowlPatternData): boolean {
  return order.length === pattern.seams.length && new Set(order).size === order.length && order.every(i => Number.isInteger(i) && i >= 0 && i < pattern.seams.length);
}
/** The traced order with one more seam, once only. */
export function traceSeam(order: readonly number[], seam: number): number[] {
  return order.includes(seam) ? [...order] : [...order, seam];
}
/** Pick the next break pattern from a random number in [0, 1); a replay never repeats the last one. */
export function pickPattern(random: number, last: BowlPattern | null): BowlPattern {
  const options = ([0, 1, 2] as const).filter(p => p !== last);
  return options[Math.min(options.length - 1, Math.floor(Math.max(0, random) * options.length))];
}

/* ---------- tracing ---------- */
export function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}
/** Evenly spaced points along a polyline (by length), ends included. */
export function samplePolyline(points: readonly Point[], step = SEAM_SAMPLE): Point[] {
  const total = polylineLength(points);
  const n = Math.max(2, Math.round(total / step) + 1), out: Point[] = [];
  let seg = 1, walked = 0;
  for (let k = 0; k < n; k++) {
    const want = total * k / (n - 1);
    while (seg < points.length - 1 && walked + Math.hypot(points[seg].x - points[seg - 1].x, points[seg].y - points[seg - 1].y) < want) {
      walked += Math.hypot(points[seg].x - points[seg - 1].x, points[seg].y - points[seg - 1].y); seg++;
    }
    const a = points[seg - 1], b = points[seg], len = Math.hypot(b.x - a.x, b.y - a.y) || 1, t = Math.min(1, Math.max(0, (want - walked) / len));
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
/** The seam samples the finger passed within `tolerance` of, as one more stroke
 * segment (a → b) is added. Pure: returns a new array. */
export function markCoverage(samples: readonly Point[], covered: readonly boolean[], a: Point, b: Point, tolerance: number): boolean[] {
  return samples.map((s, i) => covered[i] || distanceToSegment(s, a, b) <= tolerance);
}
/** Share of a seam's samples covered. */
export function coverage(covered: readonly boolean[]): number {
  return covered.length ? covered.filter(Boolean).length / covered.length : 0;
}
/** True when a traced finger path covers at least SEAM_COVER of the seam. */
export function seamCovered(seam: BowlSeam, traced: readonly Point[], tolerance: number): boolean {
  const samples = samplePolyline(seam.points);
  let covered: boolean[] = samples.map(() => false);
  if (traced.length === 1) covered = markCoverage(samples, covered, traced[0], traced[0], tolerance);
  for (let i = 1; i < traced.length; i++) covered = markCoverage(samples, covered, traced[i - 1], traced[i], tolerance);
  return coverage(covered) >= SEAM_COVER;
}
/** The nearest seam to a tap, within tolerance, among those not yet gold; -1 if none. */
export function seamNear(pattern: BowlPatternData, p: Point, tolerance: number, skip: readonly number[] = []): number {
  let best = -1, bestD = tolerance;
  pattern.seams.forEach((seam, index) => {
    if (skip.includes(index)) return;
    for (let i = 1; i < seam.points.length; i++) {
      const d = distanceToSegment(p, seam.points[i - 1], seam.points[i]);
      if (d <= bestD) { bestD = d; best = index; }
    }
  });
  return best;
}
/** Which end the gold should flow from: 0 when the point is nearer the seam's start. */
export function flowFrom(seam: BowlSeam, p: Point): 0 | 1 {
  const a = seam.points[0], b = seam.points[seam.points.length - 1];
  return Math.hypot(p.x - a.x, p.y - a.y) <= Math.hypot(p.x - b.x, p.y - b.y) ? 0 : 1;
}
/** A stroke-dasharray (on pathLength 1) that paints exactly the covered runs. */
export function coverageDash(covered: readonly boolean[]): string {
  const n = covered.length;
  if (n < 2 || !covered.some(Boolean)) return '0 1';
  const step = 1 / (n - 1), parts: number[] = [0];
  let cursor = 0, i = 0;
  while (i < n) {
    if (!covered[i]) { i++; continue; }
    let j = i; while (j + 1 < n && covered[j + 1]) j++;
    const from = Math.max(0, (i - 0.5) * step), to = Math.min(1, (j + 0.5) * step);
    parts.push(from - cursor, to - from); cursor = to; i = j + 1;
  }
  parts.push(1 - cursor + 1);
  // [0, gap, dash, gap, dash, …, tail]: a leading zero dash keeps the pattern starting with a gap.
  return parts.map(v => Number(Math.max(0, v).toFixed(4))).join(' ');
}
