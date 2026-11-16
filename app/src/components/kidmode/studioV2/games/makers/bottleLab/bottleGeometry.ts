/** Bottle Lab geometry. Pure numbers, no React. Every bottle is a solid of
 * revolution: a half-profile r(y) (radius at each height of the picture),
 * seen from a little above, so every level ring is an ellipse whose height is
 * ELLIPSE times its width. The silhouette, the glass bands, the stickers'
 * places, the bubbles' bounds and the refraction map all read the same r(y),
 * so they can never disagree. Scene units: a 360 by 440 still life. */
export type ShapeId = 'round' | 'tall' | 'flask';

export const SCENE_W = 360;
export const SCENE_H = 440;
/** The bottle's axis. */
export const AXIS_X = 180;
/** Where the paper wall meets the table. */
export const TABLE_Y = 318;
/** The level the bottle stands on (the middle of its base ring). */
export const BASE_Y = 380;
/** How round a level ring looks from the child's eye: its height over its width. */
export const ELLIPSE = 0.16;
/** The glass is this thick, as a share of the radius, before the water starts. */
export const WALL = 0.075;

interface Profile {
  /** [y, radius] knots, top of the neck first; the last knot is the base. */
  knots: readonly (readonly [number, number])[];
  /** The still water's level. */
  water: number;
  /** The three sticker rows, top first. */
  rows: readonly [number, number, number];
  /** The sticker size on this shape, in scene units. */
  sticker: number;
}

export const PROFILES: Readonly<Record<ShapeId, Profile>> = {
  /** A round carafe: short neck, a full belly, a small foot. */
  round: {
    knots: [[156, 16], [182, 17], [198, 26], [214, 46], [238, 70], [270, 84], [304, 86], [336, 78], [362, 60], [380, 46]],
    water: 242, rows: [252, 294, 336], sticker: 36,
  },
  /** A tall drinking bottle: rounded shoulder, straight sides. */
  tall: {
    knots: [[118, 15], [146, 16], [164, 27], [182, 46], [202, 57], [222, 60], [352, 60], [370, 58], [380, 54]],
    water: 214, rows: [236, 286, 336], sticker: 34,
  },
  /** A lab flask: a long neck and a wide cone. */
  flask: {
    knots: [[150, 15], [206, 16], [218, 21], [254, 40], [300, 63], [340, 83], [362, 90], [374, 86], [380, 80]],
    water: 268, rows: [280, 314, 348], sticker: 32,
  },
};

const tops: Record<ShapeId, number> = { round: PROFILES.round.knots[0][0], tall: PROFILES.tall.knots[0][0], flask: PROFILES.flask.knots[0][0] };
export const topY = (shape: ShapeId) => tops[shape];

/** Monotone cubic (Fritsch–Carlson) through the knots: smooth, and it never
 * overshoots, so a straight side stays straight and a neck never bulges. */
function slopes(knots: Profile['knots']): number[] {
  const n = knots.length, d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((knots[i + 1][1] - knots[i][1]) / (knots[i + 1][0] - knots[i][0]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return m;
}
const SLOPES: Record<ShapeId, number[]> = { round: slopes(PROFILES.round.knots), tall: slopes(PROFILES.tall.knots), flask: slopes(PROFILES.flask.knots) };

/** The outside radius at height y; 0 above the neck and below the base. */
export function radiusAt(shape: ShapeId, y: number): number {
  const k = PROFILES[shape].knots, m = SLOPES[shape];
  if (!Number.isFinite(y) || y < k[0][0] || y > k[k.length - 1][0]) return 0;
  let i = 0;
  while (i < k.length - 2 && y > k[i + 1][0]) i++;
  const [y0, r0] = k[i], [y1, r1] = k[i + 1], h = y1 - y0, t = (y - y0) / h;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * r0 + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * r1 + (t3 - t2) * h * m[i + 1];
}
export const baseRadius = (shape: ShapeId) => { const k = PROFILES[shape].knots; return k[k.length - 1][1]; };
export const maxRadius = (shape: ShapeId) => Math.max(...PROFILES[shape].knots.map(([, r]) => r));

const STEP = 2;
function heights(shape: ShapeId, from = topY(shape), to = BASE_Y): number[] {
  const out: number[] = [];
  for (let y = from; y < to; y += STEP) out.push(y);
  out.push(to);
  return out;
}
const f = (n: number) => Math.round(n * 10) / 10;

/** A band of the surface between two signed horizontal fractions of the
 * radius (-1 is the left edge, 1 the right), from one height to another. The
 * glass bands, the shine and the rim light are all drawn with it, so they
 * follow the neck and the belly exactly. */
export function bandPath(shape: ShapeId, uA: number, uB: number, from = topY(shape), to = BASE_Y): string {
  const ys = heights(shape, Math.max(from, topY(shape)), Math.min(to, BASE_Y));
  const a = ys.map(y => `${f(AXIS_X + uA * radiusAt(shape, y))} ${f(y)}`);
  const b = ys.slice().reverse().map(y => `${f(AXIS_X + uB * radiusAt(shape, y))} ${f(y)}`);
  return `M${a.join('L')}L${b.join('L')}Z`;
}

/** The outline: right side down, the near half of the base ring, the left side up, the far half of the lip. */
export function silhouettePath(shape: ShapeId, scale = 1): string {
  const ys = heights(shape), rb = baseRadius(shape) * scale, top = topY(shape), rt = radiusAt(shape, top) * scale;
  const right = ys.map(y => `${f(AXIS_X + radiusAt(shape, y) * scale)} ${f(y)}`);
  const left = ys.slice().reverse().map(y => `${f(AXIS_X - radiusAt(shape, y) * scale)} ${f(y)}`);
  return `M${right.join('L')}A${f(rb)} ${f(rb * ELLIPSE)} 0 0 1 ${f(AXIS_X - rb)} ${BASE_Y}L${left.slice(1).join('L')}A${f(rt)} ${f(rt * ELLIPSE)} 0 0 1 ${f(AXIS_X + rt)} ${top}Z`;
}

/** The inside of the glass, where water and bubbles may be. */
export const innerPath = (shape: ShapeId) => silhouettePath(shape, 1 - WALL);

/** The water: the inside of the glass below the far edge of the surface ring. */
export function waterPath(shape: ShapeId, level = PROFILES[shape].water): string {
  const k = 1 - WALL, rw = radiusAt(shape, level) * k, rb = baseRadius(shape) * k;
  const ys = heights(shape, level);
  const right = ys.map(y => `${f(AXIS_X + radiusAt(shape, y) * k)} ${f(y)}`);
  const left = ys.slice().reverse().map(y => `${f(AXIS_X - radiusAt(shape, y) * k)} ${f(y)}`);
  return `M${right.join('L')}A${f(rb)} ${f(rb * ELLIPSE)} 0 0 1 ${f(AXIS_X - rb)} ${BASE_Y}L${left.slice(1).join('L')}A${f(rw)} ${f(rw * ELLIPSE)} 0 0 1 ${f(AXIS_X + rw)} ${level}Z`;
}

/** The lowest point of the outline (the near edge of the base ring). */
export const bottomY = (shape: ShapeId) => BASE_Y + baseRadius(shape) * ELLIPSE;

/** Where a point of the surface lands in the picture: `u` across (sin of its
 * angle), `depth` toward the child (cos of its angle). A ring is an ellipse
 * seen from above, so the near side sits lower than the far side. */
export function surfacePoint(shape: ShapeId, y: number, u: number, depth: number) {
  const r = radiusAt(shape, y);
  return { x: AXIS_X + u * r, y: y + depth * r * ELLIPSE, r };
}
