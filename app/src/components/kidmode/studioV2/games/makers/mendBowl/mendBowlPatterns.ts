/** Mend the Bowl geometry: the bowl's outline in 3/4 view and the three
 * authored break patterns. Each pattern is only a list of cracks; the pieces
 * are the faces those cracks cut out of the outline, found by walking the
 * same edges, so a seam is by construction the exact shared edge of the two
 * pieces it joins. Deterministic: no randomness, the jag of a crack comes
 * from a fixed hash. Stage units throughout (STAGE.w by STAGE.h). */
import { polylineLength, type BowlPatternData, type BowlPiece, type BowlSeam, type Point, type Pose } from './mendBowlRules';

export const STAGE = { w: 440, h: 390 } as const;
/** The rim ellipse (a 3/4 view from slightly above). */
export const RIM = { cx: 220, cy: 118, rx: 138, ry: 40 } as const;
/** The foot ring: its top (where the glaze stops) and its bottom ellipse. */
export const FOOT = { cx: 220, topY: 256, topRx: 50, topRy: 8, y: 268, rx: 52, ry: 11 } as const;
/** The centre the pieces fly out from, and the point the bowl tips over. */
export const BOWL_CENTRE: Point = { x: 220, y: 178 };
export const TIP_PIVOT: Point = { x: 272, y: 268 };

const BODY_R = [{ x: 358, y: 118 }, { x: 358, y: 196 }, { x: 318, y: 246 }, { x: 270, y: 256 }] as const;
const BODY_L = [{ x: 170, y: 256 }, { x: 122, y: 246 }, { x: 82, y: 196 }, { x: 82, y: 118 }] as const;
/** The bowl's silhouette, exactly as the art draws it. */
export const OUTLINE_D = `M82 118A138 40 0 0 1 358 118C358 196 318 246 270 256L272 268A52 11 0 0 1 168 268L170 256C122 246 82 196 82 118Z`;
export const RIM_D = `M82 118A138 40 0 0 1 358 118A138 40 0 0 1 82 118Z`;

function cubic(p: readonly Point[], u: number): Point {
  const v = 1 - u;
  return { x: v * v * v * p[0].x + 3 * v * v * u * p[1].x + 3 * v * u * u * p[2].x + u * u * u * p[3].x, y: v * v * v * p[0].y + 3 * v * v * u * p[1].y + 3 * v * u * u * p[2].y + u * u * u * p[3].y };
}
/** A point of the silhouette at boundary parameter t in [0, 4): 0–1 the back
 * of the rim (left end over the top to the right end), 1–2 the right side of
 * the body, 2–3 the foot, 3–4 the left side back up. Clockwise on screen. */
export function outlineAt(t: number): Point {
  const w = ((t % 4) + 4) % 4, k = Math.floor(w), u = w - k;
  if (k === 0) { const a = Math.PI + u * Math.PI; return { x: RIM.cx + RIM.rx * Math.cos(a), y: RIM.cy + RIM.ry * Math.sin(a) }; }
  if (k === 1) return cubic(BODY_R, u);
  if (k === 3) return cubic(BODY_L, u);
  if (u <= 0.1) { const s = u / 0.1; return { x: 270 + 2 * s, y: 256 + 12 * s }; }
  if (u >= 0.9) { const s = (u - 0.9) / 0.1; return { x: 168 + 2 * s, y: 268 - 12 * s }; }
  const a = (u - 0.1) / 0.8 * Math.PI;
  return { x: FOOT.cx + FOOT.rx * Math.cos(a), y: FOOT.y + FOOT.ry * Math.sin(a) };
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

interface Half { from: string; to: string; points: Point[]; seam: number; twin: number }
/** Walks the planar graph (outline arcs + cracks) and returns its inner faces. */
function buildPattern(spec: PatternSpec): BowlPatternData {
  const key = (e: End) => e === 'j' ? 'j' : `b${e.t}`;
  const at = (e: End) => e === 'j' ? spec.junction : outlineAt(e.t);
  const halves: Half[] = [];
  const add = (from: string, to: string, points: Point[], seam: number) => {
    const i = halves.length;
    halves.push({ from, to, points, seam, twin: i + 1 }, { from: to, to: from, points: [...points].reverse(), seam, twin: i });
  };
  const seamPoints = spec.cracks.map((c, i) => jagged([at(c.from), ...c.via.map(([x, y]) => ({ x, y })), at(c.to)], i + 1));
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
    // Upward moves are shorter: the stage has less room above the rim than below the foot.
    const start: Pose = { x: Math.round(dx / len * s.d + (s.dx ?? 0)), y: Math.round(dy / len * s.d * (dy < 0 ? 0.7 : 1) + (s.dy ?? 0)), r: s.r };
    return { polygon: poly, centroid: f.c, radius: Math.max(...poly.map(p => Math.hypot(p.x - f.c.x, p.y - f.c.y))), start, seams: [...new Set(f.seams)].sort((a, b) => a - b) };
  });
  const seams: BowlSeam[] = seamPoints.map((points, s) => {
    const owners = pieces.map((p, i) => p.seams.includes(s) ? i : -1).filter(i => i >= 0);
    return { points, between: [owners[0], owners[1]] as const, length: polylineLength(points) };
  });
  return { pieces, seams };
}

/** Pattern 0: four pieces — a three-way break under the front rim and a chip off the left rim. */
const P0: PatternSpec = {
  junction: { x: 210, y: 186 },
  cracks: [
    { from: 'j', to: { t: 0.47 }, via: [[208, 160], [207, 132], [205, 104]] },
    { from: 'j', to: { t: 1.42 }, via: [[242, 194], [276, 186], [308, 196]] },
    { from: 'j', to: { t: 2.75 }, via: [[200, 212], [192, 238], [182, 258]] },
    { from: { t: 3.55 }, to: { t: 0.2 }, via: [[124, 186], [141, 160], [137, 131], [122, 111]] },
  ],
  scatter: [{ d: 50, r: 45 }, { d: 50, r: -30 }, { d: 50, r: 30 }, { d: 50, r: -45 }],
};
/** Pattern 1: five pieces — a four-way break inside the bowl and a chip off the right rim. */
const P1: PatternSpec = {
  junction: { x: 226, y: 148 },
  cracks: [
    { from: 'j', to: { t: 0.3 }, via: [[204, 132], [180, 116], [158, 101]] },
    { from: 'j', to: { t: 0.66 }, via: [[242, 128], [256, 110], [268, 94]] },
    { from: 'j', to: { t: 1.7 }, via: [[250, 178], [266, 206], [284, 230]] },
    { from: 'j', to: { t: 3.3 }, via: [[200, 172], [166, 188], [130, 196]] },
    { from: { t: 0.84 }, to: { t: 1.4 }, via: [[300, 124], [292, 152], [312, 180]] },
  ],
  scatter: [{ d: 50, r: -30 }, { d: 50, r: 45, dy: 8 }, { d: 50, r: -45, dx: -4, dy: -12 }, { d: 54, r: 30, dx: 4, dy: 18 }, { d: 50, r: -30 }],
};
/** Pattern 2: six pieces — a five-way break low on the body and a long shard off the right side. */
const P2: PatternSpec = {
  junction: { x: 212, y: 196 },
  cracks: [
    { from: 'j', to: { t: 0.24 }, via: [[192, 172], [164, 140], [130, 108]] },
    { from: 'j', to: { t: 0.62 }, via: [[226, 168], [240, 134], [252, 104]] },
    { from: 'j', to: { t: 1.54 }, via: [[244, 204], [280, 208], [312, 218]] },
    { from: 'j', to: { t: 2.45 }, via: [[218, 220], [222, 244], [226, 262]] },
    { from: 'j', to: { t: 3.42 }, via: [[184, 206], [150, 212], [120, 210]] },
    { from: { t: 0.8 }, to: { t: 1.34 }, via: [[300, 118], [292, 148], [318, 184]] },
  ],
  scatter: [{ d: 50, r: -45 }, { d: 50, r: 30 }, { d: 50, r: 30 }, { d: 50, r: -30 }, { d: 50, r: 45 }, { d: 50, r: -30 }],
};
export const BOWL_PATTERNS: readonly [BowlPatternData, BowlPatternData, BowlPatternData] = [buildPattern(P0), buildPattern(P1), buildPattern(P2)];
/** SVG path data of a polyline / closed polygon. */
export const polyD = (points: readonly Point[], close = false) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + (close ? 'Z' : '');
