/** The refraction map: a real per-pixel remap of the backdrop through the
 * bottle, fed to an SVG feDisplacementMap. For every point inside the glass it
 * stores where the eye's ray actually lands on the wall behind:
 *  - through water the bottle is a cylindrical lens: the middle of the view
 *    is flipped left for right and magnified, the edges squeezed, and the
 *    picture is stretched upright by a quarter, so the wall's bands and the
 *    diagonal stripe break at the glass edge and again at the water line;
 *  - through the air above the water only the two thin walls bend the light,
 *    a small outward push near the edges;
 *  - frost keeps the same bend, weaker, and the filter blurs it.
 * The map is drawn once per shape and finish on a small canvas and kept. */
import { AXIS_X, BASE_Y, ELLIPSE, PROFILES, WALL, baseRadius, radiusAt, topY, type ShapeId } from './bottleGeometry';

export interface RefractionMap { href: string; x: number; y: number; width: number; height: number; scale: number }

/** The ray's landing point on the wall for a point of the picture inside the glass. */
/** `still` is the bottle at rest with its water at the profile's level. Play
 * draws two pictures instead and lets the moving water line choose between
 * them: `air` (walls only, everywhere) and `wet` (the water lens, everywhere). */
export type RefractionMode = 'still' | 'air' | 'wet';

export function refractedPoint(shape: ShapeId, x: number, y: number, frost = false, mode: RefractionMode = 'still'): { x: number; y: number } | null {
  const top = topY(shape);
  const rb = baseRadius(shape);
  let r = radiusAt(shape, y);
  if (y > BASE_Y) {
    // The near half of the base ring.
    const u0 = (x - AXIS_X) / rb;
    if (Math.abs(u0) >= 1 || y > BASE_Y + rb * ELLIPSE * Math.sqrt(1 - u0 * u0)) return null;
    r = rb;
  }
  if (y < top || r <= 0) return null;
  const u = (x - AXIS_X) / r;
  if (Math.abs(u) >= 1) return null;
  const level = PROFILES[shape].water, rw = radiusAt(shape, level) * (1 - WALL);
  const uw = (x - AXIS_X) / Math.max(1, rw);
  const surfaceBack = Math.abs(uw) < 1 ? level - rw * ELLIPSE * Math.sqrt(1 - uw * uw) : level;
  const wet = mode !== 'air' && (mode === 'wet' || y >= surfaceBack) && Math.abs(u) < 1 - WALL * 0.6;
  const k = frost ? 0.72 : 1;
  if (wet) {
    // Flip and magnify the middle (slope -0.48 at the axis), squeeze the edges (|g(1)| = 1.22).
    const g = 0.48 * u + 0.74 * u * u * u;
    const lensX = AXIS_X - r * g;
    const mid = (level + BASE_Y) / 2;
    const lensY = mid + (y - mid) * 0.8 + 6;
    return { x: x + (lensX - x) * k, y: y + (lensY - y) * k };
  }
  // Air: the walls push the view outward near the edges only.
  const push = r * 0.2 * Math.pow(Math.abs(u), 6) * Math.sign(u);
  return { x: x + push * k, y };
}

const cache = new Map<string, RefractionMap | null>();

/** The map for a shape and finish, or null where there is no canvas (tests,
 * very old browsers): the bottle then shows the wall unbent but still tinted. */
export function refractionMap(shape: ShapeId, frost = false, mode: RefractionMode = 'still'): RefractionMap | null {
  const key = `${shape}:${frost ? 'frost' : 'gloss'}:${mode}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  let map: RefractionMap | null = null;
  try { map = drawMap(shape, frost, mode); } catch { map = null; }
  cache.set(key, map);
  return map;
}

/** Map pixels per scene unit: the filter scales the map up smoothly. */
const DENSITY = 1;

function drawMap(shape: ShapeId, frost: boolean, mode: RefractionMode): RefractionMap | null {
  if (typeof document === 'undefined' || typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent)) return null;
  const top = Math.floor(topY(shape) - 2), bottom = Math.ceil(BASE_Y + baseRadius(shape) * ELLIPSE + 2);
  const half = Math.ceil(Math.max(...PROFILES[shape].knots.map(([, r]) => r)) + 2);
  const x0 = AXIS_X - half, width = half * 2, height = bottom - top;
  const w = Math.round(width * DENSITY), h = Math.round(height * DENSITY);
  const dx = new Float32Array(w * h), dy = new Float32Array(w * h);
  let most = 1;
  for (let j = 0; j < h; j++) {
    const y = top + (j + 0.5) / DENSITY;
    for (let i = 0; i < w; i++) {
      const x = x0 + (i + 0.5) / DENSITY;
      const p = refractedPoint(shape, x, y, frost, mode);
      if (!p) continue;
      const n = j * w + i;
      dx[n] = p.x - x; dy[n] = p.y - y;
      most = Math.max(most, Math.abs(dx[n]), Math.abs(dy[n]));
    }
  }
  const scale = Math.ceil(most * 2 + 2);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.createImageData(w, h);
  for (let n = 0; n < w * h; n++) {
    image.data[n * 4] = Math.round((dx[n] / scale + 0.5) * 255);
    image.data[n * 4 + 1] = Math.round((dy[n] / scale + 0.5) * 255);
    image.data[n * 4 + 2] = 128;
    image.data[n * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return { href: canvas.toDataURL('image/png'), x: x0, y: top, width, height, scale };
}
