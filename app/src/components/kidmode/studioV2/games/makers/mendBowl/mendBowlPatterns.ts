/** Mend the Bowl geometry: the bowl seen from directly above (it sits on the
 * kit's round table, which is seen from above too) and the three authored
 * break patterns. Each pattern is only a list of cracks; the pieces are the
 * faces those cracks cut out of the outline, found by walking the same edges,
 * so a seam is by construction the exact shared edge of the two pieces it
 * joins. Deterministic: no randomness, the jag of a crack comes from a fixed
 * hash. Stage units throughout: the table's centre is the stage's centre. */
import { polylineLength, type BowlPatternData, type BowlPiece, type BowlSeam, type Point, type Pose } from './mendBowlRules';

export const STAGE = { w: 440, h: 440 } as const;
/** The bowl's centre (the centre of the table) and the radius of its rim. */
export const BOWL_CENTRE: Point = { x: 220, y: 220 };
export const BOWL_R = 100;
/** The table's linen top, in stage units: everything in play stays on it. */
export const LINEN_R = 205;

/** The bowl's silhouette from above: its round rim. */
export const OUTLINE_D = `M${BOWL_CENTRE.x - BOWL_R} ${BOWL_CENTRE.y}A${BOWL_R} ${BOWL_R} 0 0 1 ${BOWL_CENTRE.x + BOWL_R} ${BOWL_CENTRE.y}A${BOWL_R} ${BOWL_R} 0 0 1 ${BOWL_CENTRE.x - BOWL_R} ${BOWL_CENTRE.y}Z`;

/** A point of the rim at boundary parameter t in [0, 4): 0 the left, 1 the
 * top (far side), 2 the right, 3 the bottom (near side). Clockwise on screen. */
export function outlineAt(t: number): Point {
  const a = Math.PI + (((t % 4) + 4) % 4) * Math.PI / 2;
  return { x: BOWL_CENTRE.x + BOWL_R * Math.cos(a), y: BOWL_CENTRE.y + BOWL_R * Math.sin(a) };
}
const GRID = 40;
/** The outline from t0 to t1 (forward, wrapping), ends included. */
function outlineArc(t0: number, t1: number): Point[] {
  const end = t1 > t0 ? t1 : t1 + 4, out = [outlineAt(t0)];
  for (let g = Math.floor(t0 * GRID) + 1; g / GRID < end - 1e-6; g++) if (g / GRID > t0 + 1e-6) out.push(outlineAt(g / GRID));
  out.push(outlineAt(end));
  return out;
}
export const OUTLINE_POINTS: readonly Point[] = outlineArc(0, 3.9999).slice(0, -1);

type End = { t: number } | 'j';
interface Crack { from: End; to: End; via: readonly [number, number][] }
interface PatternSpec {
  junction: Point;
  cracks: readonly Crack[];
  /** Scatter per piece (in face order): how far it slides out and its turn. */
  scatter: readonly { d: number; r: number; dx?: number; dy?: number }[];
}

/** A small fixed hash in [-1, 1]: the jag of the break, the same every time. */
function jag(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}
/** Each authored run of a crack is split in three, the inner points nudged
 * sideways a little, so the break reads as fired clay, not a ruler line. */
function jagged(points: Point[], seed: number): Point[] {
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, amp = Math.min(3.2, len * 0.09);
    for (const f of [1 / 3, 2 / 3]) {
      const off = jag(seed * 31 + i * 7 + f * 3) * amp;
      out.push({ x: a.x + dx * f + nx * off, y: a.y + dy * f + ny * off });
    }
    out.push(b);
  }
  // Inner points are rounded; the ends stay exact so they meet the outline and the junction.
  return out.map((p, i) => i === 0 || i === out.length - 1 ? p : { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
}
const area = (poly: readonly Point[]) => poly.reduce((sum, p, i) => { const q = poly[(i + 1) % poly.length]; return sum + p.x * q.y - q.x * p.y; }, 0) / 2;
function centroidOf(poly: readonly Point[]): Point {
  let cx = 0, cy = 0; const a = area(poly);
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length], f = p.x * q.y - q.x * p.y; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f; });
  return { x: cx / (6 * a), y: cy / (6 * a) };
}
export const OUTLINE_AREA = Math.abs(area(OUTLINE_POINTS));

/** The cracks are authored on a rim of radius 92 about the centre; this carries a point to the real rim. */
const authored = (x: number, y: number): Point => ({ x: BOWL_CENTRE.x + (x - BOWL_CENTRE.x) * BOWL_R / 92, y: BOWL_CENTRE.y + (y - BOWL_CENTRE.y) * BOWL_R / 92 });

interface Half { from: string; to: string; points: Point[]; seam: number; twin: number }
/** Walks the planar graph (outline arcs + cracks) and returns its inner faces. */
function buildPattern(spec: PatternSpec): BowlPatternData {
  const key = (e: End) => e === 'j' ? 'j' : `b${e.t}`;
  const at = (e: End) => e === 'j' ? authored(spec.junction.x, spec.junction.y) : outlineAt(e.t);
  const halves: Half[] = [];
  const add = (from: string, to: string, points: Point[], seam: number) => {
    const i = halves.length;
    halves.push({ from, to, points, seam, twin: i + 1 }, { from: to, to: from, points: [...points].reverse(), seam, twin: i });
  };
  const seamPoints = spec.cracks.map((c, i) => jagged([at(c.from), ...c.via.map(([x, y]) => authored(x, y)), at(c.to)], i + 1));
  spec.cracks.forEach((c, i) => add(key(c.from), key(c.to), seamPoints[i], i));
  const ts = [...new Set(spec.cracks.flatMap(c => [c.from, c.to]).filter((e): e is { t: number } => e !== 'j').map(e => e.t))].sort((a, b) => a - b);
  ts.forEach((t, i) => { const next = ts[(i + 1) % ts.length]; add(`b${t}`, `b${next}`, outlineArc(t, next), -1); });

  const angle = (h: Half) => Math.atan2(h.points[1].y - h.points[0].y, h.points[1].x - h.points[0].x);
  const out = new Map<string, number[]>();
  halves.forEach((h, i) => out.set(h.from, [...(out.get(h.from) ?? []), i]));
  for (const list of out.values()) list.sort((a, b) => angle(halves[a]) - angle(halves[b]));
  const next = (i: number) => { const list = out.get(halves[i].to)!, k = list.indexOf(halves[i].twin); return list[(k - 1 + list.length) % list.length]; };

  const seen = new Set<number>(), faces: { poly: Point[]; seams: number[] }[] = [];
  halves.forEach((_, start) => {
    if (seen.has(start)) return;
    const poly: Point[] = [], seams: number[] = [];
    for (let i = start, guard = 0; !seen.has(i) && guard < 64; i = next(i), guard++) {
      seen.add(i); poly.push(...halves[i].points.slice(0, -1));
      if (halves[i].seam >= 0) seams.push(halves[i].seam);
    }
    faces.push({ poly, seams });
  });
  // The outer face walks the whole outline the other way round: drop it.
  const outer = faces.reduce((best, f, i) => Math.abs(area(f.poly)) > Math.abs(area(faces[best].poly)) ? i : best, 0);
  const inner = faces.filter((_, i) => i !== outer).map(f => ({ ...f, c: centroidOf(f.poly) }));
  // Face order: round the bowl from the left, so the authored scatter reads in order.
  inner.sort((a, b) => Math.atan2(a.c.y - BOWL_CENTRE.y, a.c.x - BOWL_CENTRE.x) - Math.atan2(b.c.y - BOWL_CENTRE.y, b.c.x - BOWL_CENTRE.x));

  const pieces: BowlPiece[] = inner.map((f, i) => {
    const poly = area(f.poly) < 0 ? [...f.poly].reverse() : f.poly;
    const s = spec.scatter[i], dx = f.c.x - BOWL_CENTRE.x, dy = f.c.y - BOWL_CENTRE.y, len = Math.hypot(dx, dy) || 1;
    const start: Pose = { x: Math.round(dx / len * s.d + (s.dx ?? 0)), y: Math.round(dy / len * s.d + (s.dy ?? 0)), r: s.r };
    return { polygon: poly, centroid: f.c, radius: Math.max(...poly.map(p => Math.hypot(p.x - f.c.x, p.y - f.c.y))), start, seams: [...new Set(f.seams)].sort((a, b) => a - b) };
  });
  const seams: BowlSeam[] = seamPoints.map((points, s) => {
    const owners = pieces.map((p, i) => p.seams.includes(s) ? i : -1).filter(i => i >= 0);
    return { points, between: [owners[0], owners[1]] as const, length: polylineLength(points) };
  });
  return { pieces, seams };
}

/** Pattern 0: four pieces — a three-way break off-centre and a chip off the far-left rim. */
const P0: PatternSpec = {
  junction: { x: 232, y: 236 },
  cracks: [
    { from: 'j', to: { t: 0.92 }, via: [[230, 204], [220, 168]] },
    { from: 'j', to: { t: 2.2 }, via: [[260, 236], [286, 246]] },
    { from: 'j', to: { t: 3.4 }, via: [[212, 256], [190, 276]] },
    { from: { t: 3.98 }, to: { t: 0.78 }, via: [[156, 210], [178, 186], [186, 158]] },
  ],
  scatter: [{ d: 52, r: 45, dx: 6, dy: 22 }, { d: 64, r: -30, dx: -2, dy: -22 }, { d: 56, r: 30 }, { d: 56, r: -45 }],
};
/** Pattern 1: five pieces — a four-way break near the middle and a chip off the near-right rim. */
const P1: PatternSpec = {
  junction: { x: 206, y: 214 },
  cracks: [
    { from: 'j', to: { t: 0.45 }, via: [[188, 198], [168, 178]] },
    { from: 'j', to: { t: 1.25 }, via: [[218, 186], [238, 160]] },
    { from: 'j', to: { t: 2.02 }, via: [[240, 214], [276, 222]] },
    { from: 'j', to: { t: 3.08 }, via: [[206, 246], [212, 280]] },
    { from: { t: 2.18 }, to: { t: 2.92 }, via: [[274, 246], [254, 262], [236, 286]] },
  ],
  scatter: [{ d: 56, r: -30 }, { d: 56, r: 45 }, { d: 70, r: -45, dx: 26, dy: -30 }, { d: 56, r: 30, dx: -40, dy: 18 }, { d: 56, r: -30, dx: -8, dy: -10 }],
};
/** Pattern 2: six pieces — a five-way break below the middle and a chip off the far-left rim. */
const P2: PatternSpec = {
  junction: { x: 226, y: 230 },
  cracks: [
    { from: 'j', to: { t: 0.14 }, via: [[196, 222], [162, 212]] },
    { from: 'j', to: { t: 1.04 }, via: [[226, 198], [220, 162]] },
    { from: 'j', to: { t: 1.78 }, via: [[252, 216], [280, 200]] },
    { from: 'j', to: { t: 2.62 }, via: [[242, 252], [260, 276]] },
    { from: 'j', to: { t: 3.38 }, via: [[212, 254], [192, 280]] },
    { from: { t: 0.24 }, to: { t: 0.94 }, via: [[164, 196], [186, 182], [206, 158]] },
  ],
  scatter: [{ d: 70, r: -45, dx: -30, dy: 14 }, { d: 56, r: 30, dx: 34, dy: -26 }, { d: 60, r: 30, dx: 30, dy: 14 }, { d: 56, r: -30, dx: 0, dy: 26 }, { d: 56, r: 45 }, { d: 56, r: -30 }],
};
export const BOWL_PATTERNS: readonly [BowlPatternData, BowlPatternData, BowlPatternData] = [buildPattern(P0), buildPattern(P1), buildPattern(P2)];
/** SVG path data of a polyline / closed polygon. */
export const polyD = (points: readonly Point[], close = false) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + (close ? 'Z' : '');
