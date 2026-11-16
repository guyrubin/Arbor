/** Clay Theatre's painter: plasticine on a 2D canvas. Every colour is read
 * from the makers' palette at run time (no literal lives here) and mixed in
 * code. One light for the whole picture, the rotunda's own: high and from the
 * right. A blob of clay is its base colour, a broad light-to-shade wash, a
 * soft occlusion band inside the whole edge, a lit band inside the edge that
 * faces the light, a core shadow and a thin bounce light on the far edge, a
 * waxy sheen, and then what makes it clay: thumb whorls, pits and tool
 * creases, moved a little on every new drawing (the boil). */
import { seeded, type Pt } from './clayShapes';

export type RGB = readonly [number, number, number];
export const PALETTE_NAMES = [
  'white', 'chalk', 'snow', 'paper', 'cream', 'linen', 'sand', 'shadow', 'ink', 'night', 'indigo', 'indigo-deep', 'slate',
  'poppy', 'orange', 'amber', 'leaf', 'water', 'violet', 'sun', 'butter', 'rose', 'blossom', 'lilac', 'bluebell',
  'sky', 'sky-pale', 'sea', 'teal', 'teal-deep', 'spring', 'leaf-deep', 'moss', 'sage', 'celadon', 'steel', 'steel-light', 'steel-dark', 'gold-light', 'umber', 'wood-light',
] as const;
export type PaletteName = typeof PALETTE_NAMES[number];
export type Palette = Readonly<Record<PaletteName, RGB>>;
const GREY: RGB = [150, 150, 150];
function parseColour(value: string): RGB | null {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) { const h = hex[1].length === 3 ? hex[1].split('').map(c => c + c).join('') : hex[1]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (fn) { const p = fn[1].split(/[\s,/]+/).map(Number); if (p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]; }
  return null;
}
/** Resolves the palette once for an element (the tokens sit on :root). */
export function readPalette(el: Element | null): Palette {
  const style = el && typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
  const out = {} as Record<PaletteName, RGB>;
  for (const name of PALETTE_NAMES) out[name] = (style && parseColour(style.getPropertyValue(`--mk-${name}`))) || GREY;
  return out;
}
export const mixRgb = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const paint = (c: RGB, alpha = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
/** Plasticine is saturated but chalky. */
export const chalked = (c: RGB, pal: Palette): RGB => mixRgb(c, pal.chalk, 0.14);

/** The picture's one light: a unit vector pointing AT the light (high, from the right). */
export const LIGHT: Pt = [0.5, -0.866];

type Ctx = CanvasRenderingContext2D;
/** A closed smooth outline through the points (Catmull-Rom as cubic Béziers). */
export function trace(ctx: Ctx, points: readonly Pt[]): void {
  const n = points.length;
  ctx.beginPath();
  if (n < 3) return;
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  ctx.closePath();
}
function bounds(points: readonly Pt[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, sx = 0, sy = 0;
  for (const [x, y] of points) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); sx += x; sy += y; }
  const n = points.length || 1;
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, cx: sx / n, cy: sy / n };
}
const deviceScale = (ctx: Ctx) => { try { const m = ctx.getTransform(); return Math.hypot(m.a, m.b) || 1; } catch { return 1; } };
/** A soft band of colour INSIDE the current clip, following the outline: the
 * outline is stroked far off the canvas and only its blurred shadow lands in
 * the picture, shifted by (dx, dy). Works in every browser (no ctx.filter). */
function band(ctx: Ctx, points: readonly Pt[], colour: string, blur: number, width: number, dx: number, dy: number) {
  const k = deviceScale(ctx), far = 30000;
  ctx.save();
  ctx.shadowColor = colour; ctx.shadowBlur = blur * k; ctx.shadowOffsetX = far + dx * k; ctx.shadowOffsetY = dy * k;
  ctx.translate(-far / k, 0);
  ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.strokeStyle = paint([0, 0, 0], 1);
  trace(ctx, points); ctx.stroke();
  ctx.restore();
}

export interface ClayPrint { x: number; y: number; r: number; rot: number }
export interface ClayLook {
  /** Stable identity of this piece (its texture), and the drawing it is on (its boil). */
  seed: number; drawing: number;
  /** Pixels per clay unit: scales the texture with the piece. */
  unit: number;
  /** 0 a flat silhouette (thumbnails), 1 everything. */
  detail?: number;
  /** Thumbprints the child pressed in, in canvas pixels. */
  prints?: readonly ClayPrint[];
  /** A second clay being kneaded in: streaks of it, `amount` 0…1. */
  marble?: { tone: RGB; amount: number };
  /** Shine: 1 fresh plasticine, 0 dry. */
  gloss?: number;
  alpha?: number;
}
/** One piece of plasticine. `points` are canvas pixels. */
export function paintClay(ctx: Ctx, points: readonly Pt[], tone: RGB, pal: Palette, look: ClayLook): void {
  if (points.length < 3) return;
  const b = bounds(points), R = Math.max(b.w, b.h) / 2, r = Math.min(b.w, b.h) / 2, u = look.unit, detail = look.detail ?? 1, gloss = look.gloss ?? 1;
  if (R < 0.5) return;
  const [lx, ly] = LIGHT, deep = mixRgb(tone, pal.shadow, 0.62), lit = mixRgb(tone, pal.white, 0.7);
  ctx.save();
  if (look.alpha != null) ctx.globalAlpha *= look.alpha;
  trace(ctx, points); ctx.fillStyle = paint(tone); ctx.fill();
  if (detail <= 0.05) { ctx.restore(); return; }
  ctx.clip();
  // The broad wash: toward the light the clay is paler, away from it deeper.
  const wash = ctx.createLinearGradient(b.cx + lx * R, b.cy + ly * R, b.cx - lx * R, b.cy - ly * R);
  wash.addColorStop(0, paint(lit, 0.42)); wash.addColorStop(0.42, paint(lit, 0)); wash.addColorStop(0.58, paint(deep, 0)); wash.addColorStop(1, paint(deep, 0.5));
  ctx.fillStyle = wash; ctx.fillRect(b.x0 - 2, b.y0 - 2, b.w + 4, b.h + 4);
  if (look.marble && look.marble.amount > 0.02) marble(ctx, b, look.marble.tone, look.marble.amount, look, pal);
  if (detail > 0.3) {
    const soft = Math.max(2, r * 0.34);
    band(ctx, points, paint(deep, 0.5), soft, Math.max(2, r * 0.2), 0, 0);                              // occlusion all round
    band(ctx, points, paint(deep, 0.62), soft * 1.2, Math.max(3, r * 0.36), lx * r * 0.2, ly * r * 0.2); // core shadow, far side
    band(ctx, points, paint(lit, 0.75), soft * 0.8, Math.max(2, r * 0.2), -lx * r * 0.22, -ly * r * 0.22); // lit edge
    band(ctx, points, paint(mixRgb(tone, pal.snow, 0.6), 0.3), Math.max(1.2, r * 0.07), Math.max(1, r * 0.05), lx * r * 0.03, ly * r * 0.03); // bounce
  }
  if (detail > 0.55) texture(ctx, b, tone, pal, look);
  for (const print of look.prints ?? []) thumbprint(ctx, print, tone, pal, u);
  // The waxy sheen: one broad soft highlight and a small bright core, on the side of the light.
  const hx = b.cx + lx * R * 0.34 + (seeded(look.seed, look.drawing, 41) - 0.5) * u * 1.2, hy = b.cy + ly * r * 0.5 + (seeded(look.seed, look.drawing, 43) - 0.5) * u * 1.2;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.atan2(ly, lx) + Math.PI / 2); ctx.scale(1.7, 0.75);
  const sheen = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);
  sheen.addColorStop(0, paint(pal.white, 0.5 * gloss)); sheen.addColorStop(0.35, paint(pal.white, 0.2 * gloss)); sheen.addColorStop(1, paint(pal.white, 0));
  ctx.fillStyle = sheen; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
  if (detail > 0.3) {
    const core = ctx.createRadialGradient(r * 0.1, -r * 0.04, 0, r * 0.1, -r * 0.04, r * 0.13);
    core.addColorStop(0, paint(pal.white, 0.9 * gloss)); core.addColorStop(0.5, paint(pal.white, 0.45 * gloss)); core.addColorStop(1, paint(pal.white, 0));
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.04, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = paint(pal.white, 0.55 * gloss); ctx.beginPath(); ctx.ellipse(-r * 0.22, r * 0.02, r * 0.045, r * 0.03, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
  // The edge is held against the bright room by a thin deeper line, never a black outline.
  if (detail > 0.3) { ctx.save(); if (look.alpha != null) ctx.globalAlpha *= look.alpha; trace(ctx, points); ctx.lineWidth = Math.max(0.8, u * 0.9); ctx.strokeStyle = paint(deep, 0.42); ctx.stroke(); ctx.restore(); }
}
/** Thumb whorls, pits and creases: what hands leave in plasticine. Positions
 * are fixed by the piece's seed and nudged by the drawing, so the texture
 * boils with the clay instead of sliding over it. */
function texture(ctx: Ctx, b: ReturnType<typeof bounds>, tone: RGB, pal: Palette, look: ClayLook) {
  const u = look.unit, s = look.seed, d = look.drawing, area = b.w * b.h;
  const groove = paint(mixRgb(tone, pal.shadow, 0.7), 0.2), ridge = paint(pal.white, 0.2);
  const whorls = Math.max(2, Math.min(7, Math.round(area / (2600 * u * u))));
  ctx.lineCap = 'round';
  for (let i = 0; i < whorls; i++) {
    const x = b.x0 + b.w * (0.14 + 0.72 * seeded(s, i, 1)) + (seeded(s, i, d, 2) - 0.5) * u, y = b.y0 + b.h * (0.16 + 0.68 * seeded(s, i, 3)) + (seeded(s, i, d, 4) - 0.5) * u;
    const turn = seeded(s, i, 5) * Math.PI * 2, rings = 4 + Math.floor(seeded(s, i, 6) * 3), squash = 0.62 + 0.3 * seeded(s, i, 7);
    ctx.save(); ctx.translate(x, y); ctx.rotate(turn); ctx.scale(1, squash); ctx.lineWidth = Math.max(0.6, 0.7 * u);
    for (let k = 1; k <= rings; k++) {
      const rad = k * 2.5 * u, from = seeded(s, i, k, 8) * 1.2, sweep = Math.PI * (0.9 + 0.7 * seeded(s, i, k, 9));
      ctx.strokeStyle = groove; ctx.beginPath(); ctx.arc(0, 0, rad, from, from + sweep); ctx.stroke();
      ctx.strokeStyle = ridge; ctx.beginPath(); ctx.arc(0, 0.8 * u, rad, from, from + sweep); ctx.stroke();
    }
    ctx.restore();
  }
  const pits = Math.max(3, Math.min(12, Math.round(area / (1500 * u * u))));
  for (let i = 0; i < pits; i++) {
    const x = b.x0 + b.w * seeded(s, i, 21), y = b.y0 + b.h * seeded(s, i, 22), rad = (0.7 + 1.5 * seeded(s, i, 23)) * u;
    ctx.fillStyle = paint(mixRgb(tone, pal.shadow, 0.7), 0.26); ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = paint(pal.white, 0.3); ctx.beginPath(); ctx.arc(x - LIGHT[0] * rad * 0.8, y - LIGHT[1] * rad * 0.8, rad * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  // One or two long shallow creases where the lump was rolled.
  for (let i = 0; i < 2; i++) {
    const x = b.x0 + b.w * (0.2 + 0.5 * seeded(s, i, 31)), y = b.y0 + b.h * (0.25 + 0.5 * seeded(s, i, 32)), len = Math.min(b.w, b.h) * (0.25 + 0.3 * seeded(s, i, 33)), a = seeded(s, i, 34) * Math.PI;
    ctx.lineWidth = Math.max(0.6, 0.8 * u);
    for (const [off, colour] of [[0, groove], [0.9 * u, ridge]] as const) {
      ctx.strokeStyle = colour; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2 + off);
      ctx.quadraticCurveTo(x + Math.sin(a) * len * 0.18, y - Math.cos(a) * len * 0.18 + off, x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2 + off); ctx.stroke();
    }
  }
}
/** A thumb pressed into the clay: a shallow dish (its wall toward the light in shade, its far wall lit) with the thumb's own ridges. */
function thumbprint(ctx: Ctx, p: ClayPrint, tone: RGB, pal: Palette, u: number) {
  const [lx, ly] = LIGHT, deep = mixRgb(tone, pal.shadow, 0.7);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rot * Math.PI) / 180); ctx.scale(1, 0.78);
  const dish = ctx.createRadialGradient(lx * p.r * 0.35, ly * p.r * 0.35, p.r * 0.1, 0, 0, p.r);
  dish.addColorStop(0, paint(deep, 0.42)); dish.addColorStop(0.7, paint(deep, 0.16)); dish.addColorStop(1, paint(deep, 0));
  ctx.fillStyle = dish; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = paint(pal.white, 0.5); ctx.lineWidth = Math.max(1, 1.4 * u); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, p.r * 0.92, Math.atan2(-ly, -lx) - 1, Math.atan2(-ly, -lx) + 1); ctx.stroke();
  ctx.lineWidth = Math.max(0.6, 0.7 * u);
  for (let k = 1; k <= 5; k++) {
    ctx.strokeStyle = paint(deep, 0.3); ctx.beginPath(); ctx.arc(0, p.r * 0.2, k * p.r * 0.16, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    ctx.strokeStyle = paint(pal.white, 0.22); ctx.beginPath(); ctx.arc(0, p.r * 0.2 + 0.8 * u, k * p.r * 0.16, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  }
  ctx.restore();
}
/** Streaks of a second clay being kneaded in: wide soft swirls that tighten and fade as it blends. */
function marble(ctx: Ctx, b: ReturnType<typeof bounds>, tone: RGB, amount: number, look: ClayLook, pal: Palette) {
  const s = look.seed, streak = paint(chalked(tone, pal), 0.85 * amount), n = 5;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const y = b.y0 + b.h * ((i + 0.5) / n), wob = b.h * 0.22, ph = seeded(s, i, 51) * 6.28 + look.drawing * 0.5;
    ctx.strokeStyle = streak; ctx.lineWidth = Math.max(2, b.h * 0.085 * (0.6 + seeded(s, i, 52)) * (0.4 + amount));
    ctx.beginPath(); ctx.moveTo(b.x0 - 4, y + Math.sin(ph) * wob);
    ctx.bezierCurveTo(b.x0 + b.w * 0.3, y + Math.sin(ph + 1.7) * wob, b.x0 + b.w * 0.6, y + Math.sin(ph + 3.1) * wob, b.x1 + 4, y + Math.sin(ph + 4.6) * wob);
    ctx.stroke();
  }
  ctx.restore();
}

/** The soft shadow a piece leaves on the surface it stands on. */
export function paintShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, pal: Palette, strength = 0.34): void {
  if (rx <= 0.5 || ry <= 0.2) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
  g.addColorStop(0, paint(pal.shadow, strength)); g.addColorStop(0.55, paint(pal.shadow, strength * 0.45)); g.addColorStop(1, paint(pal.shadow, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
/** An onion-skin ghost: where the clay was on an earlier frame. */
export function paintGhost(ctx: Ctx, points: readonly Pt[], pal: Palette, strength: number, unit: number): void {
  if (points.length < 3 || strength <= 0) return;
  ctx.save();
  trace(ctx, points); ctx.fillStyle = paint(pal.white, 0.3 * strength); ctx.fill();
  ctx.setLineDash([5 * unit, 5 * unit]); ctx.lineWidth = Math.max(1.4, 1.8 * unit); ctx.lineCap = 'round';
  ctx.strokeStyle = paint(pal.teal, 0.85 * strength); ctx.stroke();
  ctx.restore();
}
/** A pressed groove (a smile, a shell's spiral): a dark line with a lit lip under it. */
export function paintGroove(ctx: Ctx, draw: () => void, tone: RGB, pal: Palette, width: number): void {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.translate(0, width * 0.55); ctx.lineWidth = width; ctx.strokeStyle = paint(pal.white, 0.4); draw(); ctx.stroke();
  ctx.translate(0, -width * 0.55); ctx.strokeStyle = paint(mixRgb(tone, pal.shadow, 0.78), 0.82); draw(); ctx.stroke();
  ctx.restore();
}

const feltCache = new WeakMap<object, CanvasPattern | null>();
/** A felt nap: a small tile of seeded specks, laid over cloth with a low alpha. */
export function feltPattern(ctx: Ctx, pal: Palette): CanvasPattern | null {
  const hit = feltCache.get(ctx.canvas);
  if (hit !== undefined) return hit;
  let pattern: CanvasPattern | null = null;
  try {
    const tile = document.createElement('canvas'); tile.width = 96; tile.height = 96;
    const t = tile.getContext('2d');
    if (t) {
      for (let i = 0; i < 1400; i++) {
        const x = seeded(i, 1) * 96, y = seeded(i, 2) * 96, len = 1 + seeded(i, 3) * 2.4, a = seeded(i, 4) * Math.PI;
        t.strokeStyle = paint(seeded(i, 5) < 0.5 ? pal.white : pal.shadow, 0.03 + 0.06 * seeded(i, 6)); t.lineWidth = 0.8;
        t.beginPath(); t.moveTo(x, y); t.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); t.stroke();
      }
      pattern = ctx.createPattern(tile, 'repeat');
    }
  } catch { pattern = null; }
  feltCache.set(ctx.canvas, pattern);
  return pattern;
}
