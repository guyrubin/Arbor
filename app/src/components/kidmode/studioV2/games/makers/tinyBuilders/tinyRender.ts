import {
  FIBRE_COUNT, HEAD_FACES, PHAGE, RAD, SHEATH_MIN, add, apply, dnaCoil, dot, faceNormal, fibreAngle, headVertices, hexPrism, legPoints, mul, place, project, toEye, unit,
  type Frame, type Screen, type V3, type View,
} from './tinyMesh';

/** Tiny Structures: the painter. Canvas 2D drawing of the phage and its parts
 * as lit objects: a translucent faceted head with a glowing coil inside, a
 * ribbed tail with a spring's sheen, a machined baseplate and six jointed
 * legs. One light for the whole picture (the windows behind and to the left,
 * and a soft fill from the room). Colour comes only from the makers' palette,
 * resolved once from the stylesheet. */

export type Rgb = readonly [number, number, number];
const WHITE: Rgb = [255, 255, 255], BLACK: Rgb = [0, 0, 0];
const two = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
/** A canvas colour from numbers (no literal lives in this file). */
export const ink = (c: Rgb, alpha = 1): string => `#${two(c[0])}${two(c[1])}${two(c[2])}${two(alpha * 255)}`;
export const blend = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function parse(value: string): Rgb | null {
  const v = value.trim();
  if (v.startsWith('#')) {
    const h = v.slice(1), wide = h.length >= 6;
    const at = (i: number) => parseInt(wide ? h.slice(i * 2, i * 2 + 2) : h[i] + h[i], 16);
    const out: Rgb = [at(0), at(1), at(2)];
    return out.every(Number.isFinite) ? out : null;
  }
  const m = v.match(/(-?[\d.]+)[,\s]+(-?[\d.]+)[,\s]+(-?[\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
/** The palette, read from the page: `tone('teal')` is `--mk-teal`. */
export interface Palette { tone(name: string): Rgb }
export function readPalette(el: Element | null): Palette {
  const cache = new Map<string, Rgb>();
  let style: CSSStyleDeclaration | null = null;
  return {
    tone(name) {
      const hit = cache.get(name); if (hit) return hit;
      let out: Rgb | null = null;
      try { style ??= el ? getComputedStyle(el) : null; out = style ? parse(style.getPropertyValue(name.startsWith('studio-') ? `--${name}` : `--mk-${name}`)) : null; } catch { out = null; }
      const value = out ?? (name === 'shadow' || name === 'night' ? BLACK : WHITE);
      cache.set(name, value); return value;
    },
  };
}

export type PaintId = 'lagoon' | 'bluebell' | 'iris' | 'coral' | 'honey' | 'real' | 'ghost';
interface Mat { light: Rgb; base: Rgb; deep: Rgb }
export interface Tones { resin: Mat; glow: Rgb; spring: Mat; metal: Mat; dna: Rgb; alpha: number; ghost: boolean }
const RESIN: Readonly<Record<PaintId, readonly [string, string, string, string]>> = {
  lagoon: ['sky', 'teal', 'teal-deep', 'sky-pale'], bluebell: ['snow-shade', 'bluebell', 'indigo-deep', 'sky-pale'], iris: ['lilac', 'violet', 'plum', 'blossom'],
  coral: ['blossom', 'rose-deep', 'plum', 'butter'], honey: ['butter', 'orange', 'rust', 'sun'], real: ['snow', 'snow-shade', 'steel', 'white'], ghost: ['sky-pale', 'sea', 'sea', 'white'],
};
const mat = (p: Palette, light: string, base: string, deep: string): Mat => ({ light: p.tone(light), base: p.tone(base), deep: p.tone(deep) });
/** The bench model wears made-up colours; the real phage is pale and
 * colourless, with only its DNA tinted so the eye can follow it. */
export function tonesFor(p: Palette, paint: PaintId): Tones {
  const [l, b, d, g] = RESIN[paint];
  if (paint === 'ghost') { const m = mat(p, l, b, d); return { resin: m, glow: p.tone(g), spring: m, metal: m, dna: p.tone('white'), alpha: 0.3, ghost: true }; }
  const real = paint === 'real';
  return {
    resin: mat(p, l, b, d), glow: p.tone(g),
    spring: real ? mat(p, 'white', 'snow', 'steel-light') : mat(p, 'gold-light', 'gold', 'gold-deep'),
    metal: real ? mat(p, 'white', 'snow-shade', 'steel') : mat(p, 'steel-light', 'steel', 'graphite'),
    dna: p.tone(real ? 'orange' : 'amber'), alpha: 1, ghost: false,
  };
}

const KEY: V3 = unit([-0.5, 0.72, -0.42]), FILL: V3 = unit([0.45, 0.5, 0.74]);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
function shade(m: Mat, t: number): Rgb { const u = clamp01(t); return u < 0.5 ? blend(m.deep, m.base, u * 2) : blend(m.base, m.light, (u - 0.5) * 2); }
function lit(n: V3): number { return 0.2 + 0.5 * Math.max(0, dot(n, KEY)) + 0.5 * Math.max(0, dot(n, FILL)); }

/** A round bar between two world points, seen as a lit cylinder. */
function bar(ctx: CanvasRenderingContext2D, a: Screen, b: Screen, ra: number, rb: number, m: Mat, alpha: number, capFar = 0, capNear = 0) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  const nx = d > 1e-3 ? -dy / d : 1, ny = d > 1e-3 ? dx / d : 0;
  // The sheen runs across the bar: shadow side, a bright stripe, the body, a dark edge and a thin rim of window light.
  const flip = nx < 0 ? -1 : 1, r = Math.max(ra, rb);
  const g = ctx.createLinearGradient(a.x - nx * r * flip, a.y - ny * r * flip, a.x + nx * r * flip, a.y + ny * r * flip);
  g.addColorStop(0, ink(blend(m.base, m.light, 0.5), alpha)); g.addColorStop(0.2, ink(m.light, alpha)); g.addColorStop(0.3, ink(blend(m.light, WHITE, 0.7), alpha));
  g.addColorStop(0.42, ink(m.base, alpha)); g.addColorStop(0.8, ink(m.deep, alpha)); g.addColorStop(1, ink(blend(m.deep, m.base, 0.6), alpha));
  ctx.fillStyle = g;
  const ang = Math.atan2(ny, nx);
  ctx.beginPath();
  ctx.moveTo(a.x + nx * ra, a.y + ny * ra); ctx.lineTo(b.x + nx * rb, b.y + ny * rb); ctx.lineTo(b.x - nx * rb, b.y - ny * rb); ctx.lineTo(a.x - nx * ra, a.y - ny * ra);
  ctx.closePath(); ctx.fill();
  // Round ends: each end's disc, as flat as the eye sees it.
  if (capFar > 0) { ctx.beginPath(); ctx.ellipse(a.x, a.y, ra, Math.max(0.2, ra * capFar), ang, 0, Math.PI * 2); ctx.fill(); }
  if (capNear > 0) { ctx.beginPath(); ctx.ellipse(b.x, b.y, rb, Math.max(0.2, rb * capNear), ang, 0, Math.PI * 2); ctx.fill(); }
}
/** A disc facing along `axis` at a world point: its ellipse on the screen. */
function disc(ctx: CanvasRenderingContext2D, view: View, c: V3, axis: V3, r: number) {
  const p = project(view, c), q = project(view, add(c, axis));
  const facing = Math.abs(dot(unit(axis), toEye(view, c)));
  const ang = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI / 2;
  ctx.beginPath(); ctx.ellipse(p.x, p.y, r * p.s, Math.max(0.3, r * p.s * facing), ang, 0, Math.PI * 2);
  return { p, facing, ang };
}

export interface PhageLook {
  tones: Tones;
  /** Which parts are there. */
  head?: boolean; collar?: boolean; tail?: boolean; baseplate?: boolean; fibres?: readonly boolean[];
  /** The body sunk onto planted feet (model units). */
  sink?: number;
  /** Each leg's little dance, -1 to 1. */
  flex?: readonly number[];
  /** Sheath length share (1 relaxed … SHEATH_MIN squeezed). */
  sheath?: number;
  /** DNA moved out of the head, 0 to 1. */
  dna?: number;
  /** The glow inside the head, 0 to 1.6. */
  glow?: number;
  /** The loose leg ring (all six, or pair `ring`), shown while the legs are a part of their own. */
  ring?: boolean;
  /** Seconds, for shimmer. */
  time?: number;
  /** Stretch along the axis (squash and settle), about 1. */
  stretch?: number;
}
const ALL_SIX: readonly boolean[] = [true, true, true, true, true, true];

function drawLeg(ctx: CanvasRenderingContext2D, view: View, f: Frame, i: number, look: PhageLook, foot: boolean) {
  const t = look.tones, leg = legPoints(i, look.sink ?? 0, look.flex?.[i] ?? 0);
  const hip = project(view, place(f, leg.hip)), knee = project(view, place(f, leg.knee)), tip = project(view, place(f, leg.foot));
  const w = 0.2 * f.scale;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pass = (width: number, colour: string, lift: number) => {
    ctx.strokeStyle = colour; ctx.beginPath();
    ctx.lineWidth = Math.max(0.6, width * hip.s); ctx.moveTo(hip.x, hip.y - lift * hip.s); ctx.lineTo(knee.x, knee.y - lift * knee.s); ctx.stroke();
    ctx.beginPath(); ctx.lineWidth = Math.max(0.6, width * 0.82 * tip.s); ctx.moveTo(knee.x, knee.y - lift * knee.s); ctx.lineTo(tip.x, tip.y - lift * tip.s); ctx.stroke();
  };
  pass(w * 2, ink(t.metal.deep, t.alpha), 0);
  pass(w * 1.25, ink(t.metal.base, t.alpha), w * 0.2);
  pass(w * 0.42, ink(blend(t.metal.light, WHITE, 0.5), t.alpha * 0.9), w * 0.52);
  // The knee is a ball joint; the foot a small pad.
  for (const [p, r] of [[knee, 0.3], [hip, 0.24]] as const) {
    const R = Math.max(1, r * f.scale * p.s), g = ctx.createRadialGradient(p.x - R * 0.35, p.y - R * 0.4, R * 0.1, p.x, p.y, R);
    g.addColorStop(0, ink(WHITE, t.alpha)); g.addColorStop(0.35, ink(t.metal.light, t.alpha)); g.addColorStop(1, ink(t.metal.deep, t.alpha));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill();
  }
  if (foot) {
    const R = Math.max(1, 0.34 * f.scale * tip.s);
    ctx.fillStyle = ink(t.metal.deep, t.alpha); ctx.beginPath(); ctx.ellipse(tip.x, tip.y, R, R * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ink(t.metal.light, t.alpha * 0.8); ctx.beginPath(); ctx.ellipse(tip.x - R * 0.15, tip.y - R * 0.14, R * 0.6, R * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBase(ctx: CanvasRenderingContext2D, view: View, f: Frame, look: PhageLook) {
  const t = look.tones, sink = look.sink ?? 0, b = PHAGE.base;
  const local = hexPrism(b.r, b.y0 - sink, b.y1 - sink, 0), world = local.map(p => place(f, p)), pts = world.map(p => project(view, p));
  const centre = place(f, [0, (b.y0 + b.y1) / 2 - sink, 0]), eye = toEye(view, centre);
  const poly = (ids: number[], colour: string) => { ctx.fillStyle = colour; ctx.beginPath(); ids.forEach((id, k) => (k ? ctx.lineTo(pts[id].x, pts[id].y) : ctx.moveTo(pts[id].x, pts[id].y))); ctx.closePath(); ctx.fill(); };
  const up = unit(apply(f.m, [0, 1, 0])), topFirst = dot(up, eye) < 0;
  const cap = (top: boolean) => {
    const ids = top ? [6, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5], n = top ? up : mul(up, -1);
    if (dot(n, eye) <= 0) return;
    poly(ids, ink(shade(t.metal, lit(n) + 0.18), t.alpha));
    // Machined: a bright bevel ring and the dark seat the tail stands in.
    const c = place(f, [0, top ? b.y1 - sink : b.y0 - sink, 0]);
    const ring = disc(ctx, view, c, n, b.r * 0.8 * f.scale); ctx.strokeStyle = ink(blend(t.metal.light, WHITE, 0.6), t.alpha * 0.85); ctx.lineWidth = Math.max(0.6, 0.09 * f.scale * ring.p.s); ctx.stroke();
    disc(ctx, view, c, n, b.r * 0.5 * f.scale); ctx.fillStyle = ink(t.metal.deep, t.alpha * 0.9); ctx.fill();
    disc(ctx, view, c, n, b.r * 0.36 * f.scale); ctx.fillStyle = ink(blend(t.metal.deep, BLACK, 0.35), t.alpha * 0.9); ctx.fill();
  };
  if (topFirst) cap(true);
  for (let k = 0; k < 6; k++) {
    const a = (60 * k + 30) * RAD, n = unit(apply(f.m, [Math.cos(a), 0, Math.sin(a)]));
    if (dot(n, eye) <= 0) continue;
    const j = (k + 1) % 6, v = lit(n);
    poly([k, j, 6 + j, 6 + k], ink(shade(t.metal, v), t.alpha));
    // A thin bright chamfer on the upper edge.
    ctx.strokeStyle = ink(WHITE, t.alpha * (0.25 + 0.5 * v)); ctx.lineWidth = Math.max(0.5, 0.05 * f.scale * pts[6 + k].s);
    ctx.beginPath(); ctx.moveTo(pts[6 + k].x, pts[6 + k].y); ctx.lineTo(pts[6 + j].x, pts[6 + j].y); ctx.stroke();
  }
  cap(!topFirst);
}

function drawTail(ctx: CanvasRenderingContext2D, view: View, f: Frame, look: PhageLook) {
  const t = look.tones, sink = look.sink ?? 0, s = PHAGE.sheath, share = Math.max(SHEATH_MIN, Math.min(1, look.sheath ?? 1));
  const squeezed = (1 - share) / (1 - SHEATH_MIN), length = (s.y1 - s.y0) * share, y0 = s.y0 - sink, radius = s.r * (1 + 0.46 * squeezed) * f.scale;
  const axis = unit(apply(f.m, [0, 1, 0])), mid = place(f, [0, y0 + length / 2, 0]), eye = toEye(view, mid);
  const along = dot(axis, eye), cap = Math.abs(along);
  // The stiff tube inside: it shows below the baseplate as the sleeve squeezes.
  const drop = (s.y1 - s.y0) - length;
  if (drop > 0.02) {
    const top = project(view, place(f, [0, PHAGE.base.y0 - sink, 0])), tip = project(view, place(f, [0, PHAGE.base.y0 - sink - drop, 0]));
    bar(ctx, top, tip, PHAGE.tubeR * f.scale * top.s, PHAGE.tubeR * 0.9 * f.scale * tip.s, t.metal, t.alpha, 0, cap);
  }
  // Ribs, far end first, so each one's rim sits over the last.
  const n = s.ribs, order = Array.from({ length: n }, (_, k) => (along >= 0 ? k : n - 1 - k));
  for (const k of order) {
    const a = project(view, place(f, [0, y0 + length * k / n, 0])), b = project(view, place(f, [0, y0 + length * (k + 0.86) / n, 0]));
    const far = along >= 0 ? a : b, near = along >= 0 ? b : a;
    bar(ctx, far, near, radius * far.s, radius * near.s, t.spring, t.alpha, cap, cap);
    // The groove between two ribs: a dark band at the rib's lower end.
    if (!t.ghost) {
      const g0 = project(view, place(f, [0, y0 + length * (k + (along >= 0 ? 0 : 0.86)) / n, 0])), g1 = project(view, place(f, [0, y0 + length * (k + (along >= 0 ? 0.26 : 0.6)) / n, 0]));
      bar(ctx, g0, g1, radius * 0.985 * g0.s, radius * 0.985 * g1.s, { light: t.spring.base, base: t.spring.deep, deep: blend(t.spring.deep, BLACK, 0.45) }, t.alpha * 0.62, cap, cap);
    }
    // The spring's sheen: a bright lip on each rib, where it faces the window.
    ctx.strokeStyle = ink(blend(t.spring.light, WHITE, 0.55), t.alpha * 0.8); ctx.lineWidth = Math.max(0.5, 0.07 * f.scale * near.s);
    const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
    ctx.beginPath(); ctx.ellipse(near.x, near.y, radius * near.s * 0.98, Math.max(0.3, radius * near.s * cap), ang, Math.PI * 1.08, Math.PI * 1.62); ctx.stroke();
  }
}

function drawCollar(ctx: CanvasRenderingContext2D, view: View, f: Frame, look: PhageLook, lower: number) {
  const t = look.tones, c = PHAGE.collar, sink = (look.sink ?? 0) + lower;
  const axis = unit(apply(f.m, [0, 1, 0])), eye = toEye(view, place(f, [0, c.plateY - sink, 0])), cap = Math.abs(dot(axis, eye));
  // Whiskers first: six fine wires curving down from under the plate.
  const w = PHAGE.whisker;
  ctx.lineCap = 'round'; ctx.strokeStyle = ink(t.metal.base, t.alpha * 0.9);
  for (let i = 0; i < 6; i++) {
    const a = (60 * i) * RAD, at = (r: number, y: number): V3 => [r * Math.cos(a), y - sink, r * Math.sin(a)];
    const p0 = project(view, place(f, at(w.r0, w.y0))), p1 = project(view, place(f, at(w.r1 * 0.75, w.y0 + 0.15))), p2 = project(view, place(f, at(w.r1, w.y1)));
    ctx.lineWidth = Math.max(0.5, 0.07 * f.scale * p0.s); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y); ctx.stroke();
  }
  const a = project(view, place(f, [0, c.y0 - sink, 0])), b = project(view, place(f, [0, c.y1 - sink, 0]));
  bar(ctx, a, b, c.r * f.scale * a.s, c.r * f.scale * b.s, t.metal, t.alpha, cap, cap);
  const p0 = project(view, place(f, [0, c.plateY - 0.1 - sink, 0])), p1 = project(view, place(f, [0, c.plateY + 0.1 - sink, 0]));
  bar(ctx, p0, p1, c.plateR * f.scale * p0.s, c.plateR * f.scale * p1.s, t.metal, t.alpha, cap, cap);
  const top = disc(ctx, view, place(f, [0, c.plateY + 0.1 - sink, 0]), axis, c.plateR * f.scale);
  ctx.fillStyle = ink(shade(t.metal, 0.82), t.alpha); ctx.fill();
  ctx.strokeStyle = ink(WHITE, t.alpha * 0.6); ctx.lineWidth = Math.max(0.5, 0.05 * f.scale * top.p.s); ctx.stroke();
}

function drawHead(ctx: CanvasRenderingContext2D, view: View, f: Frame, look: PhageLook, lower: number) {
  const t = look.tones, h = PHAGE.head, sink = (look.sink ?? 0) + lower, time = look.time ?? 0;
  const local = headVertices(), world = local.map(p => place(f, [p[0], p[1] - sink, p[2]])), pts = world.map(p => project(view, p));
  const centreLocal: V3 = [0, (h.y0 + h.y1) / 2 - sink, 0], centre = place(f, centreLocal), c = project(view, centre), eye = toEye(view, centre);
  const faces = HEAD_FACES.map(ids => {
    const [a, b, d] = ids.map(i => world[i]) as [V3, V3, V3];
    const n = faceNormal(a, b, d, centre);
    return { ids, n, facing: dot(n, eye) };
  });
  const path = (ids: readonly number[]) => { ctx.beginPath(); ids.forEach((id, k) => (k ? ctx.lineTo(pts[id].x, pts[id].y) : ctx.moveTo(pts[id].x, pts[id].y))); ctx.closePath(); };
  const ghost = t.ghost, alpha = t.alpha;
  // The far side of the shell, seen through the resin: the window light comes in here.
  for (const face of faces) if (face.facing <= 0) { path(face.ids); ctx.fillStyle = ink(shade(t.resin, 0.3 + 0.75 * Math.max(0, dot(face.n, KEY))), alpha * (ghost ? 0.5 : 0.9)); ctx.fill(); }
  if (!ghost) {
    // The glow inside, and the coil of DNA it lights.
    const glow = (look.glow ?? 0.7) * (0.86 + 0.14 * Math.sin(time * 1.7)), R = h.r * 1.9 * f.scale * c.s;
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R);
    g.addColorStop(0, ink(blend(t.glow, WHITE, 0.75), clamp01(0.95 * glow))); g.addColorStop(0.4, ink(blend(t.glow, WHITE, 0.3), clamp01(0.5 * glow))); g.addColorStop(1, ink(t.glow, 0));
    // The glow is light inside the shell: it is drawn only where the shell is.
    ctx.save(); ctx.beginPath(); for (const face of faces) { face.ids.forEach((id, k) => (k ? ctx.lineTo(pts[id].x, pts[id].y) : ctx.moveTo(pts[id].x, pts[id].y))); ctx.closePath(); } ctx.clip();
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const left = 1 - clamp01(look.dna ?? 0);
    if (left > 0.01) {
      const coil = dnaCoil(left).map(p => project(view, place(f, [p[0], p[1] - sink, p[2]])));
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [width, colour] of [[0.2, ink(t.dna, 0.55)], [0.09, ink(blend(t.dna, WHITE, 0.6), 0.95)]] as const) {
        ctx.strokeStyle = colour; ctx.lineWidth = Math.max(0.6, width * f.scale * c.s);
        ctx.beginPath(); coil.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      }
    }
  }
  // The near facets: translucent resin, each catching the light its own way.
  for (const face of faces) {
    if (face.facing <= 0) continue;
    const v = lit(face.n), half = unit(add(KEY, eye)), spec = Math.max(0, dot(face.n, half)) ** 18, fillSpec = Math.max(0, dot(face.n, unit(add(FILL, eye)))) ** 26;
    path(face.ids);
    const [a, b, d] = face.ids.map(i => pts[i]);
    const g = ctx.createLinearGradient(a.x, a.y, (b.x + d.x) / 2, (b.y + d.y) / 2);
    const body = ghost ? 0.36 : 0.5 + 0.34 * (1 - face.facing);
    g.addColorStop(0, ink(shade(t.resin, v * 0.9 + 0.16), alpha * body)); g.addColorStop(1, ink(shade(t.resin, v * 0.9 - 0.16), alpha * Math.min(1, body + 0.16)));
    ctx.fillStyle = g; ctx.fill();
    const gleam = clamp01(spec * 0.9 + fillSpec * 0.75 + (ghost ? 0 : 0.06 * Math.max(0, Math.sin(time * 0.9 + face.ids[1] * 1.3))));
    if (gleam > 0.02) { ctx.fillStyle = ink(WHITE, alpha * gleam * 0.8); ctx.fill(); }
  }
  // Each near facet is cut: a dark line under the bright one, so the shell reads against a bright window.
  if (!ghost) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, 0.13 * f.scale * c.s); ctx.strokeStyle = ink(t.resin.deep, alpha * 0.55); for (const face of faces) if (face.facing > 0) { path(face.ids); ctx.stroke(); } }
  // Facet edges catch the light: fine bright lines on the near side.
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(0.6, 0.055 * f.scale * c.s); ctx.strokeStyle = ink(blend(t.resin.light, WHITE, 0.7), alpha * (ghost ? 0.9 : 0.7));
  for (const face of faces) if (face.facing > 0) { path(face.ids); ctx.stroke(); }
}

/** The loose leg ring that makes six legs (or one pair) a part of their own. */
function drawRing(ctx: CanvasRenderingContext2D, view: View, f: Frame, look: PhageLook, from: number, to: number) {
  const t = look.tones, y = PHAGE.hip.y - (look.sink ?? 0), r = PHAGE.hip.r;
  ctx.lineCap = 'round';
  for (const [width, colour] of [[0.34, ink(t.metal.deep, t.alpha)], [0.16, ink(t.metal.light, t.alpha)]] as const) {
    ctx.strokeStyle = colour; ctx.beginPath();
    for (let a = from; a <= to + 0.01; a += 12) { const p = project(view, place(f, [r * Math.cos(a * RAD), y, r * Math.sin(a * RAD)])); ctx.lineWidth = Math.max(0.6, width * f.scale * p.s); if (a === from) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    ctx.stroke();
  }
}

/** The phage, or whichever of its parts are there, in one frame. Drawn back
 * to front for a camera that looks from the front, level or from above. */
export function drawPhage(ctx: CanvasRenderingContext2D, view: View, frame: Frame, look: PhageLook): void {
  const stretch = look.stretch ?? 1;
  const thin = 1 / Math.sqrt(stretch), wide = (row: V3): V3 => [row[0] * thin, row[1] * stretch, row[2] * thin];
  const f: Frame = stretch === 1 ? frame : { ...frame, m: [wide(frame.m[0]), wide(frame.m[1]), wide(frame.m[2])] };
  const fibres = look.fibres ?? ALL_SIX, share = Math.max(SHEATH_MIN, Math.min(1, look.sheath ?? 1));
  const lower = (PHAGE.sheath.y1 - PHAGE.sheath.y0) * (1 - share);
  const eye = toEye(view, f.at);
  const near = (i: number) => { const a = fibreAngle(i) * RAD; return dot(apply(f.m, [Math.cos(a), 0, Math.sin(a)]), eye); };
  const legs = Array.from({ length: FIBRE_COUNT }, (_, i) => i).filter(i => fibres[i]).sort((a, b) => near(a) - near(b));
  const upright = dot(unit(apply(f.m, [0, 1, 0])), eye) >= -0.2;
  if (look.ring) {
    const on = legs.length === FIBRE_COUNT ? [0, 360] : legs.length ? [fibreAngle(Math.min(...legs)), fibreAngle(Math.min(...legs)) + 180] : null;
    if (on) drawRing(ctx, view, f, look, on[0], on[1]);
  }
  for (const i of legs) if (near(i) < 0) drawLeg(ctx, view, f, i, look, true);
  const body = () => {
    if (look.baseplate ?? true) drawBase(ctx, view, f, look);
    if (look.tail ?? true) drawTail(ctx, view, f, look);
    if (look.collar ?? true) drawCollar(ctx, view, f, look, lower);
  };
  if (upright) body();
  for (const i of legs) if (near(i) >= 0) drawLeg(ctx, view, f, i, look, true);
  if (look.head ?? true) drawHead(ctx, view, f, look, lower);
  if (!upright) body();
}

/** The DNA thread on its way out: down the tube and a little way into the
 * cell, where it curls. `dna` is 0 to 1; drawn after the cell wall. */
export function drawThread(ctx: CanvasRenderingContext2D, view: View, frame: Frame, look: PhageLook, time: number): void {
  const dna = clamp01(look.dna ?? 0); if (dna <= 0) return;
  const t = look.tones, sink = look.sink ?? 0, share = Math.max(SHEATH_MIN, Math.min(1, look.sheath ?? 1));
  const lower = (PHAGE.sheath.y1 - PHAGE.sheath.y0) * (1 - share), top = PHAGE.head.y0 - sink - lower, tipY = PHAGE.base.y0 - sink - lower;
  const reach = dna * 2.2, inTube = Math.min(1, reach), pts: Screen[] = [];
  for (let i = 0; i <= 24; i++) pts.push(project(view, place(frame, [0, top + (tipY - top) * (i / 24) * inTube, 0])));
  // Past the tip the thread is free: it drifts and curls inside the cell.
  const free = Math.max(0, reach - 1) / 1.2;
  for (let i = 1; i <= 36 * free; i++) {
    const u = i / 36, y = tipY - u * 3.6, sway = Math.sin(u * 7 + time * 1.4) * (0.25 + u * 1.3);
    pts.push(project(view, place(frame, [sway, y, Math.cos(u * 5 + time) * 0.3 * u])));
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [width, colour] of [[0.5, ink(t.dna, 0.22)], [0.22, ink(t.dna, 0.75)], [0.09, ink(blend(t.dna, WHITE, 0.7), 1)]] as const) {
    ctx.strokeStyle = colour; ctx.lineWidth = Math.max(0.7, width * frame.scale * pts[0].s);
    ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  }
}

/** A soft contact shadow on the bench top (y = 0), under a world point. */
export function drawShadow(ctx: CanvasRenderingContext2D, view: View, at: V3, radius: number, strength: number, tone: Rgb): void {
  if (strength <= 0.005 || radius <= 0) return;
  // The windows are behind: the shadow leans a little toward the eye.
  const p = project(view, [at[0] + 0.25, 0, at[2] + 0.5 + at[1] * 0.12]), flat = Math.max(0.12, Math.sin(view.elev * RAD));
  const R = radius * p.s;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, flat);
  const g = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
  g.addColorStop(0, ink(tone, clamp01(strength))); g.addColorStop(0.55, ink(tone, clamp01(strength * 0.45))); g.addColorStop(1, ink(tone, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

/** A ring of light on a seam (the click) or round the turntable. */
export function drawGlowRing(ctx: CanvasRenderingContext2D, view: View, frame: Frame, y: number, radius: number, colour: Rgb, alpha: number, width = 0.16): void {
  if (alpha <= 0.01) return;
  const c = place(frame, [0, y, 0]), axis = unit(apply(frame.m, [0, 1, 0]));
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (const [w, a] of [[width * 4, 0.22], [width * 2, 0.5], [width, 1]] as const) {
    const d = disc(ctx, view, c, axis, radius * frame.scale);
    ctx.strokeStyle = ink(colour, clamp01(alpha * a)); ctx.lineWidth = Math.max(0.8, w * frame.scale * d.p.s); ctx.stroke();
  }
  ctx.restore();
}
