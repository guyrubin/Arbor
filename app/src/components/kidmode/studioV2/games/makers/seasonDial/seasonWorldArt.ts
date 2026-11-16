import { LEAF_RAMP, appleState, blossomState, budState, leafState, snowCap, type LeafSeed } from './seasonDialRules';
import { seededPlay } from './seasonDialPlay';

/** The Weather Maker's painted world: the old apple tree and everything the
 * weather leaves on the terrace, drawn on Canvas 2D with real material
 * shading (lit side, core shadow, bounce light, rim). Colour comes only from
 * the makers' palette, resolved once at run time and mixed in code; nothing
 * here is a colour literal. The tree is grown once from a fixed seed: the
 * same tree all year, changing bough by bough. Units: the tree's own height
 * is 1, its foot at (0, 0), up is negative y. */

/* ── colour ─────────────────────────────────────────────────────────────── */

export type Rgb = readonly [number, number, number];
export interface Tones { readonly of: (name: string) => Rgb; readonly css: (c: Rgb) => string; /** The same colour, see-through (0 clear … 1 solid), for gradient stops. */ readonly clear: (c: Rgb, alpha: number) => string }
export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => { const s = t < 0 ? 0 : t > 1 ? 1 : t; return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]; };
/** Reads palette tokens (`--mk-<name>`) from the page into numbers, through
 * a one-pixel canvas so any CSS colour syntax resolves. */
export function readTones(from: Element): Tones {
  const cache = new Map<string, Rgb>(), text = new Map<number, string>();
  let probe: CanvasRenderingContext2D | null = null;
  try { const c = document.createElement('canvas'); c.width = c.height = 1; probe = c.getContext('2d', { willReadFrequently: true }); } catch { probe = null; }
  const style = getComputedStyle(from);
  const of = (name: string): Rgb => {
    const hit = cache.get(name); if (hit) return hit;
    let out: Rgb = [128, 128, 128];
    const value = style.getPropertyValue(`--mk-${name}`).trim();
    if (probe && value) {
      try { probe.clearRect(0, 0, 1, 1); probe.fillStyle = value; probe.fillRect(0, 0, 1, 1); const d = probe.getImageData(0, 0, 1, 1).data; out = [d[0], d[1], d[2]]; } catch { /* keep the grey */ }
    }
    cache.set(name, out); return out;
  };
  const css = (c: Rgb): string => {
    const key = ((Math.round(c[0]) & 255) << 16) | ((Math.round(c[1]) & 255) << 8) | (Math.round(c[2]) & 255);
    let s = text.get(key);
    if (!s) { s = `#${(0x1000000 | key).toString(16).slice(1)}`; if (text.size < 4000) text.set(key, s); }
    return s;
  };
  const clear = (c: Rgb, alpha: number): string => `${css(c)}${(0x100 | Math.round(Math.max(0, Math.min(1, alpha)) * 255)).toString(16).slice(1)}`;
  return { of, css, clear };
}

/* ── the tree, grown once ───────────────────────────────────────────────── */

export interface TSeg { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; readonly w1: number; readonly w2: number; readonly depth: number; readonly bough: number }
export interface TLeaf { readonly x: number; readonly y: number; readonly a: number; readonly len: number; readonly z: number; readonly lx: number; readonly ly: number; readonly seed: LeafSeed; readonly bough: number }
export interface TSpot { readonly x: number; readonly y: number; readonly r: number; readonly seed: number; readonly z: number; readonly a: number }
export interface WorldTree {
  readonly segs: readonly TSeg[]; readonly leaves: readonly TLeaf[]; readonly blossoms: readonly TSpot[]; readonly apples: readonly TSpot[];
  readonly crown: { readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number };
  readonly knot: { readonly x: number; readonly y: number }; readonly boughs: number;
  /** Half the tree's width, for the picture it is cached in. */
  readonly reach: number;
}
const BOUGHS = [
  { angle: -168, length: 0.2, width: 0.04, from: 0.62 }, { angle: -132, length: 0.235, width: 0.05, from: 0.86 }, { angle: -93, length: 0.25, width: 0.05, from: 1 },
  { angle: -55, length: 0.235, width: 0.052, from: 0.92 }, { angle: -14, length: 0.2, width: 0.04, from: 0.7 },
] as const;
/** The order the boughs take each change in: leaf from the low sunny side
 * up, colour from the top down, fall from the windward side across. */
const GROW_ORDER = [1, 3, 0, 4, 2], TURN_ORDER = [3, 1, 4, 0, 2], FALL_ORDER = [0, 2, 1, 3, 4];
/** The same three orders, for the tests: boughs are numbered left to right. */
export const BOUGH_ORDERS = { grow: GROW_ORDER, turn: TURN_ORDER, fall: FALL_ORDER } as const;
export function growTree(seed = 1871): WorldTree {
  const rand = seededPlay(seed);
  const segs: TSeg[] = [], twigs: { x: number; y: number; a: number; bough: number }[] = [];
  const rad = (deg: number) => (deg * Math.PI) / 180;
  /** A limb: a few gnarled pieces that sweep out and then climb toward the
   * light, a leader that carries on and side shoots that fork away. */
  const limb = (x: number, y: number, angle: number, length: number, width: number, depth: number, max: number, bough: number) => {
    const parts = depth < 3 ? 4 : 3, end = width * (depth >= max ? 0.34 : 0.7);
    let a = angle, cx = x, cy = y, w = width;
    for (let i = 0; i < parts; i++) {
      a += (rand() - 0.5) * (depth < 2 ? 16 : 30);
      a += (-90 - a) * (depth < 3 ? 0.1 : 0.05); // every limb bends up toward the sky as it goes
      const step = length / parts, nx = cx + Math.cos(rad(a)) * step, ny = cy + Math.sin(rad(a)) * step, nw = width + (end - width) * ((i + 1) / parts);
      segs.push({ x1: cx, y1: cy, x2: nx, y2: ny, w1: w, w2: nw, depth, bough });
      if (depth >= max - 1 && i >= parts - 2) twigs.push({ x: nx, y: ny, a: rad(a), bough });
      // A side shoot part-way along the bigger limbs, so the crown fills between the forks.
      if (depth < max - 1 && i === 1 && rand() < 0.75) limb(nx, ny, a + (rand() < 0.5 ? -1 : 1) * (38 + rand() * 24), length * 0.52, nw * 0.5, depth + 2 > max ? max : depth + 2, max, bough);
      cx = nx; cy = ny; w = nw;
    }
    if (depth >= max) return;
    const spread = 26 + rand() * 18, lean = (rand() - 0.5) * 16;
    limb(cx, cy, a + lean - spread * 0.5, length * (0.7 + rand() * 0.1), w * 0.78, depth + 1, max, bough);
    limb(cx, cy, a + lean + spread, length * (0.6 + rand() * 0.12), w * 0.62, depth + 1, max, bough);
    if (depth >= 2 && rand() < 0.4) limb(cx, cy, a + lean - spread * 1.5, length * 0.5, w * 0.5, depth + 1, max, bough);
  };
  // The trunk: stout and short, flaring into the bed, leaning a little with a bend in it.
  const trunk = [{ x: 0.004, y: 0.004, w: 0.14 }, { x: 0, y: -0.035, w: 0.1 }, { x: -0.012, y: -0.1, w: 0.086 }, { x: -0.03, y: -0.18, w: 0.08 }, { x: -0.034, y: -0.25, w: 0.076 }, { x: -0.026, y: -0.31, w: 0.07 }];
  for (let i = 0; i < trunk.length - 1; i++) segs.push({ x1: trunk[i].x, y1: trunk[i].y, x2: trunk[i + 1].x, y2: trunk[i + 1].y, w1: trunk[i].w, w2: trunk[i + 1].w, depth: 0, bough: 2 });
  const along = (f: number) => { const t = 3 + f * 2, i = Math.min(trunk.length - 2, Math.floor(t)), u = t - i; return { x: trunk[i].x + (trunk[i + 1].x - trunk[i].x) * u, y: trunk[i].y + (trunk[i + 1].y - trunk[i].y) * u }; };
  BOUGHS.forEach((b, i) => { const o = along(b.from); limb(o.x, o.y, b.angle, b.length, b.width, 1, 5, i); });

  const xs = twigs.map(t => t.x), ys = twigs.map(t => t.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const crown = { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: (maxX - minX) / 2 + 0.05, ry: (maxY - minY) / 2 + 0.05 };
  const rankOf = (order: readonly number[], bough: number) => order.indexOf(bough);
  const c = (v: number) => Math.min(0.999, Math.max(0, v));
  const seedFor = (bough: number): LeafSeed => ({
    grow: c((rankOf(GROW_ORDER, bough) + rand() * 1.7) / 5.9), turn: c((rankOf(TURN_ORDER, bough) + rand() * 1.9) / 6.1),
    fall: c((rankOf(FALL_ORDER, bough) + rand() * 1.8) / 6), hue: rand(),
  });
  const leaves: TLeaf[] = [];
  const addLeaf = (x: number, y: number, toward: number, bough: number) => {
    const out = Math.atan2(y - crown.cy, x - crown.cx);
    // Leaves fan out from the twig, lean away from the crown's heart and droop a little.
    let a = toward + (rand() - 0.5) * 2.2;
    a += Math.sin(out - a) * 0.35; a += Math.cos(a) * 0.22;
    leaves.push({ x, y, a, len: 0.04 + rand() * 0.024, z: rand(), lx: (x - crown.cx) / crown.rx, ly: (y - crown.cy) / crown.ry, seed: seedFor(bough), bough });
  };
  for (const t of twigs) for (let k = 0; k < 5; k++) {
    const back = rand() * 0.075 - 0.02, across = (rand() - 0.5) * 0.085;
    addLeaf(t.x - Math.cos(t.a) * back - Math.sin(t.a) * across, t.y - Math.sin(t.a) * back + Math.cos(t.a) * across, t.a, t.bough);
  }
  for (const s of segs) {
    if (s.depth < 3) continue;
    for (let k = 0; k < 2; k++) { const u = rand(); addLeaf(s.x1 + (s.x2 - s.x1) * u + (rand() - 0.5) * 0.03, s.y1 + (s.y2 - s.y1) * u + (rand() - 0.5) * 0.03, Math.atan2(s.y2 - s.y1, s.x2 - s.x1) + (rand() < 0.5 ? 1 : -1) * 1.2, s.bough); }
  }
  leaves.sort((p, q) => p.z - q.z);
  const spot = (t: { x: number; y: number; bough: number }, jitter: number, rMin: number, rMax: number, order: readonly number[]): TSpot => ({
    x: t.x + (rand() - 0.5) * jitter, y: t.y + (rand() - 0.5) * jitter, r: rMin + rand() * (rMax - rMin), seed: c((rankOf(order, t.bough) + rand() * 1.6) / 5.8), z: rand(), a: rand() * Math.PI * 2,
  });
  const blossoms = Array.from({ length: 130 }, (_, i) => spot(twigs[(i * 7 + 3) % twigs.length], 0.075, 0.019, 0.028, GROW_ORDER));
  const low = twigs.filter(t => t.y > crown.cy - 0.06).sort((p, q) => p.x - q.x);
  const apples = Array.from({ length: 12 }, (_, i) => low[Math.floor(((i + 0.5) / 12) * low.length)]).map(t => ({ ...spot(t, 0.03, 0.027, 0.036, GROW_ORDER), y: t.y + 0.03 + rand() * 0.02, seed: rand() }));
  // Normalise: the highest leaf tip is the tree's height.
  const top = Math.min(...leaves.map(l => l.y - l.len)), k = 1 / -top;
  const sc = <T extends { x: number; y: number }>(p: T): T => ({ ...p, x: p.x * k, y: p.y * k });
  const reach = (Math.max(...leaves.map(l => Math.abs(l.x))) + 0.07) * k;
  return {
    segs: segs.map(s => ({ ...s, x1: s.x1 * k, y1: s.y1 * k, x2: s.x2 * k, y2: s.y2 * k, w1: s.w1 * k, w2: s.w2 * k })),
    leaves: leaves.map(l => ({ ...sc(l), len: l.len * k })), blossoms: blossoms.map(b => ({ ...sc(b), r: b.r * k })), apples: apples.map(a => ({ ...sc(a), r: a.r * k })),
    crown: { cx: crown.cx * k, cy: crown.cy * k, rx: crown.rx * k, ry: crown.ry * k }, knot: { x: -0.022 * k, y: -0.19 * k }, boughs: BOUGHS.length, reach,
  };
}

/* ── painting the tree ──────────────────────────────────────────────────── */

export interface TreeLook {
  readonly year: number;
  /** Where the light comes from, as a unit vector on the picture (toward the sun). */
  readonly lightX: number; readonly lightY: number;
  /** 0 a white noon … 1 golden hour. */
  readonly gold: number;
  /** Daylight, 0..1. */
  readonly day: number;
  /** How much of the branches' snow has been shaken off, 0..1. */
  readonly snowOff: number;
  /** Apples already shaken down (by index). */
  readonly picked: ReadonlySet<number>;
  /** This year's apple colour (palette name). */
  readonly ripe: string;
  /** A blossom burst under a touch: flowers near it open wide for a moment. */
  readonly bloom: { readonly x: number; readonly y: number; readonly t: number } | null;
}
type Ctx = CanvasRenderingContext2D;
const SHADES = 6, TINT_STEPS = 40;
interface Paints { leaf: string[][]; bark: string[]; bounce: string; snow: string; snowShade: string; petal: string[]; petalHeart: string; bud: string; shadow: Rgb; glow: Rgb; gold: Rgb; tones: Tones }
const paintCache = new WeakMap<Tones, Paints>();
function paintsOf(tones: Tones): Paints {
  const hit = paintCache.get(tones); if (hit) return hit;
  const ramp = LEAF_RAMP.map(n => tones.of(n)), deep = tones.of('indigo-deep'), light = tones.of('butter'), sun = tones.of('sun');
  const leaf: string[][] = [];
  for (let i = 0; i <= TINT_STEPS; i++) {
    const t = (i / TINT_STEPS) * (ramp.length - 1), j = Math.min(ramp.length - 2, Math.floor(t)), base = mixRgb(ramp[j], ramp[j + 1], t - j), row: string[] = [];
    for (let s = 0; s < SHADES; s++) {
      const u = s / (SHADES - 1);
      row.push(tones.css(u < 0.5 ? mixRgb(mixRgb(base, deep, 0.5), base, u * 2) : mixRgb(base, mixRgb(light, sun, 0.3), (u - 0.5) * 0.9)));
    }
    leaf.push(row);
  }
  const umber = tones.of('umber'), wood = tones.of('wood'), dark = mixRgb(umber, tones.of('shadow'), 0.42), mid = mixRgb(umber, wood, 0.4), lit = mixRgb(tones.of('wood-light'), light, 0.25);
  const made: Paints = {
    leaf, bark: [dark, mixRgb(dark, mid, 0.6), mid, mixRgb(mid, lit, 0.5), lit].map(tones.css), bounce: tones.css(mixRgb(mid, tones.of('sky'), 0.45)),
    snow: tones.css(tones.of('snow')), snowShade: tones.css(mixRgb(tones.of('snow-shade'), tones.of('lilac'), 0.25)),
    petal: [tones.css(mixRgb(tones.of('white'), tones.of('blossom'), 0.25)), tones.css(tones.of('blossom')), tones.css(mixRgb(tones.of('blossom'), tones.of('rose'), 0.45))],
    petalHeart: tones.css(tones.of('amber')), bud: tones.css(mixRgb(tones.of('rose-deep'), tones.of('rose'), 0.4)), shadow: deep, glow: mixRgb(light, sun, 0.4), gold: tones.of('orange'), tones,
  };
  paintCache.set(tones, made); return made;
}
function leafPath(ctx: Ctx, x: number, y: number, a: number, len: number, wide: number) {
  const c = Math.cos(a), s = Math.sin(a), mx = x + c * len * 0.45, my = y + s * len * 0.45, tx = x + c * len, ty = y + s * len, px = -s * wide, py = c * wide;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx + px, my + py, tx, ty); ctx.quadraticCurveTo(mx - px, my - py, x, y);
}
/** One leaf of the tree's own kind, anywhere (in the air, on the floor). */
export function paintLooseLeaf(ctx: Ctx, tones: Tones, x: number, y: number, a: number, len: number, tint: number, shade: number, squash = 1) {
  const p = paintsOf(tones), row = p.leaf[Math.max(0, Math.min(TINT_STEPS, Math.round((tint / (LEAF_RAMP.length - 1)) * TINT_STEPS)))];
  ctx.save(); ctx.translate(x, y); ctx.scale(1, squash);
  leafPath(ctx, -Math.cos(a) * len * 0.5, -Math.sin(a) * len * 0.5, a, len, len * 0.24);
  ctx.fillStyle = row[Math.max(0, Math.min(SHADES - 1, Math.round(shade * (SHADES - 1))))]; ctx.fill();
  ctx.restore();
}
export function paintApple(ctx: Ctx, tones: Tones, x: number, y: number, r: number, red: number, ripe: string) {
  const unripe = mixRgb(tones.of('spring'), tones.of('leaf'), 0.3), gold = mixRgb(unripe, tones.of('amber'), 0.8);
  const skin = red < 0.5 ? mixRgb(unripe, gold, red * 2) : mixRgb(gold, tones.of(ripe), (red - 0.5) * 2);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, tones.css(mixRgb(skin, tones.of('butter'), 0.55))); g.addColorStop(0.45, tones.css(skin)); g.addColorStop(1, tones.css(mixRgb(skin, tones.of('plum'), 0.5)));
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x - r * 0.36, y - r * 0.42, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2); ctx.globalAlpha *= 0.7; ctx.fillStyle = tones.css(tones.of('white')); ctx.fill(); ctx.globalAlpha /= 0.7;
  ctx.beginPath(); ctx.moveTo(x, y - r * 0.85); ctx.quadraticCurveTo(x + r * 0.1, y - r * 1.3, x + r * 0.32, y - r * 1.45); ctx.lineWidth = Math.max(1, r * 0.16); ctx.lineCap = 'round'; ctx.strokeStyle = tones.css(tones.of('umber')); ctx.stroke();
}
/** The tree's painter. What never changes with the year (the wood, the
 * snow that lies on it) is painted once into its own picture and kept;
 * leaves and blossom are stamped from small sprites, one per colour, so the
 * whole crown can be repainted on every frame the dial moves. */
export interface TreePainter {
  /** Paints the tree `H` px tall into `ctx`, a canvas of `q` device px per px whose origin (the tree's foot) is at (`ox`, `oy`). */
  paint(ctx: Ctx, H: number, q: number, ox: number, oy: number, look: TreeLook): void;
  release(): void;
}
const LEAF_PX = 48, FLOWER_PX = 22;
export function makeTreePainter(tree: WorldTree, tones: Tones): TreePainter {
  const p = paintsOf(tones);
  let wood: { key: string; cv: HTMLCanvasElement; snow: HTMLCanvasElement } | null = null;
  const sheet = (w: number, h: number) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };
  // One sheet of sprites: a leaf for every tint and shade (a column a shade), then the three blossoms.
  const CW = LEAF_PX + 4, CH = 28, FW = FLOWER_PX * 2 + 4, leafRows = TINT_STEPS + 1;
  const atlas = sheet(Math.max(CW * SHADES, FW * 3), CH * leafRows + FW);
  {
    const c = atlas.getContext('2d');
    if (c) {
      for (let tint = 0; tint < leafRows; tint++) for (let shade = 0; shade < SHADES; shade++) {
        c.save(); c.translate(shade * CW, tint * CH);
        leafPath(c, 2, 14, 0, LEAF_PX, LEAF_PX * 0.25); c.fillStyle = p.leaf[tint][shade]; c.fill();
        // The half away from the light is a shade deeper; a midrib catches it.
        c.save(); c.clip(); c.globalAlpha = 0.22; c.fillStyle = p.leaf[tint][Math.max(0, shade - 2)]; c.fillRect(0, 14, CW, 14); c.restore();
        c.beginPath(); c.moveTo(6, 14); c.lineTo(LEAF_PX * 0.86, 14); c.lineWidth = 1.4; c.lineCap = 'round'; c.globalAlpha = 0.42; c.strokeStyle = p.leaf[tint][Math.min(SHADES - 1, shade + 1)]; c.stroke();
        c.restore();
      }
      for (let lit = 0; lit < 3; lit++) {
        const R = FLOWER_PX;
        c.save(); c.translate(lit * FW + R + 2, CH * leafRows + R + 2);
        for (let k = 0; k < 5; k++) {
          const a = (k * Math.PI * 2) / 5;
          c.beginPath(); c.ellipse(Math.cos(a) * R * 0.52, Math.sin(a) * R * 0.52, R * 0.5, R * 0.36, a, 0, Math.PI * 2); c.fillStyle = p.petal[lit]; c.fill();
          c.beginPath(); c.ellipse(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3, R * 0.22, R * 0.1, a, 0, Math.PI * 2); c.globalAlpha = 0.5; c.fillStyle = p.petal[2]; c.fill(); c.globalAlpha = 1;
        }
        c.beginPath(); c.arc(0, 0, R * 0.22, 0, Math.PI * 2); c.fillStyle = p.petalHeart; c.fill();
        c.restore();
      }
    }
  }
  /** The wood and its snow, painted once for a size and a side of light. */
  const woodFor = (H: number, q: number, lightSide: number, ly: number) => {
    const cw = Math.ceil((tree.reach * 2 * H + 24) * q), ch = Math.ceil(H * 1.14 * q), key = `${cw}|${ch}|${lightSide}`;
    if (wood && wood.key === key) return wood;
    const cv = wood?.cv ?? sheet(cw, ch), snow = wood?.snow ?? sheet(cw, ch);
    for (const each of [cv, snow]) { each.width = cw; each.height = ch; }
    const lx = lightSide / 3, ctx = cv.getContext('2d'), sc = snow.getContext('2d');
    if (ctx) {
      ctx.setTransform(q, 0, 0, q, cw / 2, H * 1.06 * q); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const order = tree.segs.slice().sort((m, n) => m.depth - n.depth || n.w1 - m.w1);
      // Each limb a tapering round stroke, shaded in five steps toward the light, with a cool bounce on its far edge.
      const layers = [[1, 0], [0.8, 0.075], [0.58, 0.16], [0.34, 0.25], [0.13, 0.33]] as const;
      for (let k = 0; k < layers.length; k++) {
        ctx.strokeStyle = p.bark[k];
        for (const s of order) {
          const w = ((s.w1 + s.w2) / 2) * H; if (k > 0 && w < 2.2) continue;
          const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy) || 1;
          let nx = -dy / len, ny = dx / len; if (nx * lx + ny * ly < 0) { nx = -nx; ny = -ny; }
          const off = layers[k][1] * w;
          ctx.lineWidth = Math.max(1, w * layers[k][0]);
          ctx.beginPath(); ctx.moveTo(s.x1 * H + nx * off, s.y1 * H + ny * off); ctx.lineTo(s.x2 * H + nx * off, s.y2 * H + ny * off); ctx.stroke();
        }
      }
      ctx.strokeStyle = p.bounce; ctx.globalAlpha = 0.34;
      for (const s of order) {
        const w = ((s.w1 + s.w2) / 2) * H; if (w < 5) continue;
        const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy) || 1;
        let nx = -dy / len, ny = dx / len; if (nx * lx + ny * ly > 0) { nx = -nx; ny = -ny; }
        ctx.lineWidth = Math.max(1, w * 0.1);
        ctx.beginPath(); ctx.moveTo(s.x1 * H + nx * w * 0.4, s.y1 * H + ny * w * 0.4); ctx.lineTo(s.x2 * H + nx * w * 0.4, s.y2 * H + ny * w * 0.4); ctx.stroke();
      }
      // Bark: short furrows along the thick wood, dark and light, the same every time.
      const grain = seededPlay(97);
      for (const s of order) {
        const w = ((s.w1 + s.w2) / 2) * H; if (w < 9) continue;
        const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
        for (let i = 0; i < Math.round(w / 3); i++) {
          const across = (grain() - 0.5) * 0.8 * w, u0 = grain() * 0.7, u1 = Math.min(1, u0 + 0.15 + grain() * 0.25), lightOne = grain() < 0.35;
          ctx.globalAlpha = lightOne ? 0.22 : 0.3; ctx.strokeStyle = lightOne ? p.bark[4] : p.bark[0]; ctx.lineWidth = Math.max(0.7, w * 0.035);
          ctx.beginPath(); ctx.moveTo((s.x1 + dx * u0) * H + nx * across, (s.y1 + dy * u0) * H + ny * across); ctx.lineTo((s.x1 + dx * u1) * H + nx * across * 0.92, (s.y1 + dy * u1) * H + ny * across * 0.92); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      // The knot hole.
      const kx = tree.knot.x * H, ky = tree.knot.y * H, kr = H * 0.017;
      ctx.beginPath(); ctx.ellipse(kx, ky, kr * 1.25, kr * 1.7, 0.15, 0, Math.PI * 2); ctx.fillStyle = p.bark[3]; ctx.fill();
      ctx.beginPath(); ctx.ellipse(kx + kr * 0.1, ky + kr * 0.1, kr * 0.85, kr * 1.25, 0.15, 0, Math.PI * 2); ctx.fillStyle = tones.css(mixRgb(tones.of('umber'), tones.of('night'), 0.6)); ctx.fill();
    }
    if (sc) {
      // Snow lies on the upper side of every limb that is not too steep: a blue-lilac under-edge, white on top.
      sc.setTransform(q, 0, 0, q, cw / 2, H * 1.06 * q); sc.lineCap = 'round';
      for (const pass of [0, 1]) {
        sc.strokeStyle = pass ? p.snow : p.snowShade;
        for (const s of tree.segs) {
          if (s.depth < 1) continue;
          const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy) || 1; if (Math.abs(dy / len) > 0.78) continue;
          let ux = -dy / len, uy = dx / len; if (uy > 0) { ux = -ux; uy = -uy; }
          const w = ((s.w1 + s.w2) / 2) * H, lift = w * 0.42 + (pass ? H * 0.006 : 0);
          sc.lineWidth = (w * 0.42 + H * 0.008) * (pass ? 0.78 : 1.12);
          sc.beginPath(); sc.moveTo(s.x1 * H + ux * lift, s.y1 * H + uy * lift); sc.lineTo(s.x2 * H + ux * lift, s.y2 * H + uy * lift); sc.stroke();
        }
      }
    }
    wood = { key, cv, snow };
    return wood;
  };
  return {
    paint(ctx, H, q, ox, oy, look) {
      const year = look.year, lx = look.lightX, ly = look.lightY, X = ox * q, Y = oy * q;
      /** Stamps one cell of the sprite sheet, turned by `a` and scaled by `f`, with its own point (px, py) at (x, y). */
      const stamp = (sx: number, sy: number, sw: number, sh: number, x: number, y: number, a: number, f: number, px: number, py: number) => {
        const c = Math.cos(a) * f, s = Math.sin(a) * f;
        ctx.setTransform(c, s, -s, c, X + x * q, Y + y * q); ctx.drawImage(atlas, sx, sy, sw, sh, -px, -py, sw, sh);
      };
      const drawLeaves = (from: number, to: number) => {
        for (const l of tree.leaves) {
          if (l.z < from || l.z >= to) continue;
          const st = leafState(l.seed, year); if (st.on <= 0.01 || st.size <= 0.02) continue;
          const lit = l.lx * lx + l.ly * ly, mass = Math.sin(l.lx * 5.1 + l.ly * 3.3) * Math.cos(l.ly * 4.7 - l.lx * 2.9);
          const s = Math.max(0, Math.min(1, 0.4 + 0.4 * lit + (l.z - 0.5) * 0.46 + 0.14 * mass + (l.seed.hue - 0.5) * 0.14));
          const tint = Math.max(0, Math.min(TINT_STEPS, Math.round((st.tint / (LEAF_RAMP.length - 1)) * TINT_STEPS)));
          const len = l.len * H * (0.25 + 0.75 * st.size), drop = st.drop;
          ctx.globalAlpha = Math.min(1, st.on * 1.2);
          stamp(Math.round(s * (SHADES - 1)) * CW, tint * CH, CW, CH, l.x * H + drop * (l.seed.hue - 0.5) * H * 0.05, l.y * H + drop * drop * H * 0.11, l.a + drop * (l.seed.hue - 0.5) * 3, (len * q) / LEAF_PX, 2, 14);
        }
        ctx.globalAlpha = 1;
      };
      ctx.save();
      drawLeaves(0, 0.34);
      const made = woodFor(H, q, Math.round(Math.max(-1, Math.min(1, lx)) * 3), ly);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(made.cv, X - made.cv.width / 2, Y - H * 1.06 * q);
      const cap = snowCap(year) * (1 - look.snowOff);
      if (cap > 0.02) { ctx.globalAlpha = Math.min(1, cap * 1.3); ctx.drawImage(made.snow, X - made.snow.width / 2, Y - H * 1.06 * q); ctx.globalAlpha = 1; }
      drawLeaves(0.34, 0.7);
      // Buds, then blossom: five petals round a gold heart, opening bough by bough.
      for (const b of tree.blossoms) {
        const st = blossomState(b.seed, year), x = b.x * H, y = b.y * H;
        let open = st.open * st.on;
        if (look.bloom && st.on > 0.05) { const d = Math.hypot(b.x - look.bloom.x, b.y - look.bloom.y); if (d < 0.2) open = Math.min(1.35, open + (1 - d / 0.2) * look.bloom.t * 0.9); }
        if (open > 0.04) {
          const lit = Math.max(0, Math.min(2, Math.round(1 - ((b.x - tree.crown.cx) / tree.crown.rx) * lx - ((b.y - tree.crown.cy) / tree.crown.ry) * ly + (0.5 - b.z))));
          ctx.globalAlpha = Math.min(1, st.on * 1.4);
          stamp(lit * FW, CH * leafRows, FW, FW, x, y, b.a, (b.r * H * (0.35 + 0.65 * open) * q) / FLOWER_PX, FLOWER_PX + 2, FLOWER_PX + 2);
        } else {
          const bud = budState(b.seed, year); if (bud <= 0.04) continue;
          ctx.setTransform(q, 0, 0, q, X, Y); ctx.globalAlpha = bud; ctx.beginPath(); ctx.arc(x, y, b.r * H * 0.3 * (0.5 + 0.5 * bud), 0, Math.PI * 2); ctx.fillStyle = p.bud; ctx.fill();
        }
      }
      ctx.setTransform(q, 0, 0, q, X, Y); ctx.globalAlpha = 1;
      tree.apples.forEach((a, i) => {
        if (look.picked.has(i)) return;
        const st = appleState(a.seed, year); if (st.size < 0.05) return;
        ctx.globalAlpha = Math.min(1, st.size * 2); paintApple(ctx, tones, a.x * H, a.y * H, a.r * H * (0.4 + 0.6 * st.size), st.red, look.ripe);
      });
      ctx.globalAlpha = 1;
      drawLeaves(0.7, 1.01);
      ctx.setTransform(q, 0, 0, q, X, Y);
      // One light over all of it: a warm rim toward the sun, a cool core shadow turning away from it.
      const cx = tree.crown.cx * H, cy = tree.crown.cy * H, R = Math.max(tree.crown.rx, tree.crown.ry) * H;
      const warm = mixRgb(p.glow, p.gold, look.gold * 0.75);
      ctx.globalCompositeOperation = 'source-atop';
      const veil = ctx.createLinearGradient(cx + lx * R, cy + ly * R, cx - lx * R, cy - ly * R + R * 0.3);
      veil.addColorStop(0, tones.clear(warm, (0.2 + 0.3 * look.gold) * look.day)); veil.addColorStop(0.45, tones.clear(warm, 0)); veil.addColorStop(0.55, tones.clear(p.shadow, 0)); veil.addColorStop(1, tones.clear(p.shadow, 0.3));
      ctx.fillStyle = veil; ctx.fillRect(-H, -H * 1.3, H * 2, H * 1.5);
      if (look.day < 0.98) { ctx.globalAlpha = 0.4 * (1 - look.day); ctx.fillStyle = tones.css(p.shadow); ctx.fillRect(-H, -H * 1.3, H * 2, H * 1.5); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.restore();
    },
    release() {
      atlas.width = 0; atlas.height = 0;
      if (wood) { wood.cv.width = 0; wood.cv.height = 0; wood.snow.width = 0; wood.snow.height = 0; wood = null; }
    },
  };
}

/* ── the terrace's own things ───────────────────────────────────────────── */

/** The round bed the tree grows from: white stone rim with the terrace's teal
 * inlay, dark soil, seen at the floor's angle. */
export function paintBed(ctx: Ctx, tones: Tones, x: number, y: number, rx: number, snow: number, green: number) {
  const ry = rx * 0.27, white = tones.of('white'), stone = mixRgb(white, tones.of('steel-light'), 0.35);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y + ry * 0.5, rx * 1.12, ry * 1.2, 0, 0, Math.PI * 2); ctx.globalAlpha = 0.22; ctx.fillStyle = tones.css(tones.of('shadow')); ctx.fill(); ctx.globalAlpha = 1;
  const rim = ctx.createLinearGradient(x - rx, y, x + rx, y); rim.addColorStop(0, tones.css(white)); rim.addColorStop(0.6, tones.css(stone)); rim.addColorStop(1, tones.css(mixRgb(stone, tones.of('steel'), 0.5)));
  ctx.beginPath(); ctx.ellipse(x, y + ry * 0.2, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = tones.css(mixRgb(stone, tones.of('steel'), 0.45)); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = rim; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y, rx * 0.9, ry * 0.88, 0, 0, Math.PI * 2); ctx.lineWidth = Math.max(1.5, rx * 0.035); ctx.strokeStyle = tones.css(mixRgb(tones.of('celadon-deep'), tones.of('sea'), 0.35)); ctx.stroke();
  const soil = ctx.createRadialGradient(x - rx * 0.2, y - ry * 0.2, rx * 0.1, x, y, rx * 0.84);
  const earth = mixRgb(tones.of('umber'), tones.of('fur-dark'), 0.4), top = mixRgb(mixRgb(earth, tones.of('leaf'), green * 0.75), tones.of('snow'), snow);
  soil.addColorStop(0, tones.css(mixRgb(top, white, 0.12))); soil.addColorStop(1, tones.css(mixRgb(top, tones.of('shadow'), 0.3)));
  ctx.beginPath(); ctx.ellipse(x, y + ry * 0.04, rx * 0.8, ry * 0.76, 0, 0, Math.PI * 2); ctx.fillStyle = soil; ctx.fill();
  ctx.restore();
}
/** A puddle on the floor: the sky in it, a darker lip, a streak of light. */
export function paintPuddle(ctx: Ctx, tones: Tones, x: number, y: number, rx: number, ry: number, fill: number, sky: Rgb, t: number) {
  if (fill <= 0.02) return;
  const k = 0.35 + 0.65 * fill;
  ctx.save(); ctx.globalAlpha = Math.min(1, fill * 1.5) * 0.9;
  ctx.beginPath(); ctx.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(x, y - ry * k, x, y + ry * k);
  g.addColorStop(0, tones.css(mixRgb(sky, tones.of('slate'), 0.35))); g.addColorStop(1, tones.css(mixRgb(sky, tones.of('white'), 0.45)));
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = tones.css(mixRgb(sky, tones.of('slate'), 0.6)); ctx.globalAlpha *= 0.5; ctx.stroke();
  ctx.globalAlpha = Math.min(1, fill * 1.5) * (0.5 + 0.2 * Math.sin(t * 1.3 + x));
  ctx.beginPath(); ctx.ellipse(x - rx * k * 0.3, y - ry * k * 0.25, rx * k * 0.34, ry * k * 0.16, 0, 0, Math.PI * 2); ctx.fillStyle = tones.css(tones.of('white')); ctx.fill();
  ctx.restore();
}
/** A cloud: a heap of soft puffs, white on top, heavier and greyer below as it fills with rain. */
export function paintCloud(ctx: Ctx, tones: Tones, x: number, y: number, size: number, heavy: number, alpha: number, puffSeed: number, squash = 1) {
  const top = mixRgb(tones.of('white'), tones.of('steel-light'), heavy * 0.6), under = mixRgb(mixRgb(tones.of('chalk'), tones.of('snow-shade'), 0.45), tones.of('storm-grey'), heavy * 0.8);
  ctx.save(); ctx.translate(x, y); ctx.scale(1 + (1 - squash) * 0.5, squash);
  for (const pass of [0, 1]) {
    const random = seededPlay(puffSeed), c = pass ? top : under;
    for (let i = 0; i < 8; i++) {
      const px = (random() - 0.5) * size * 1.9, py = (random() - 0.5) * size * 0.3 + (pass ? -size * 0.16 : size * 0.12) - Math.cos((px / size) * 1.4) * size * 0.16, pr = size * (0.36 + random() * 0.3) * (pass ? 0.84 : 1);
      const g = ctx.createRadialGradient(px, py - pr * 0.2, pr * 0.2, px, py, pr);
      g.addColorStop(0, tones.clear(c, alpha)); g.addColorStop(0.55, tones.clear(c, alpha * 0.92)); g.addColorStop(1, tones.clear(c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, pr, pr * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
/** The snow friend: three packed balls with blue-lilac shade, a scarf in this year's colour, twig arms. */
export function paintSnowFriend(ctx: Ctx, tones: Tones, x: number, y: number, h: number, scarf: string, lightX: number, wobble: number) {
  const snow = tones.of('snow'), shade = mixRgb(tones.of('snow-shade'), tones.of('lilac'), 0.3);
  ctx.save(); ctx.translate(x, y); ctx.rotate(wobble * 0.09);
  ctx.beginPath(); ctx.ellipse(0, 0, h * 0.34, h * 0.07, 0, 0, Math.PI * 2); ctx.globalAlpha = 0.25; ctx.fillStyle = tones.css(tones.of('indigo')); ctx.fill(); ctx.globalAlpha = 1;
  const ball = (cy: number, r: number) => {
    const g = ctx.createRadialGradient(lightX * r * 0.45, cy - r * 0.4, r * 0.15, 0, cy, r * 1.05);
    g.addColorStop(0, tones.css(tones.of('white'))); g.addColorStop(0.55, tones.css(snow)); g.addColorStop(1, tones.css(shade));
    ctx.beginPath(); ctx.arc(0, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  };
  ctx.strokeStyle = tones.css(tones.of('umber')); ctx.lineWidth = Math.max(1.5, h * 0.022); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-h * 0.14, -h * 0.5); ctx.lineTo(-h * 0.36, -h * 0.66); ctx.moveTo(-h * 0.3, -h * 0.62); ctx.lineTo(-h * 0.33, -h * 0.74);
  ctx.moveTo(h * 0.14, -h * 0.5); ctx.lineTo(h * 0.37, -h * 0.62); ctx.moveTo(h * 0.3, -h * 0.58); ctx.lineTo(h * 0.36, -h * 0.7); ctx.stroke();
  ball(-h * 0.2, h * 0.24); ball(-h * 0.52, h * 0.18); ball(-h * 0.78, h * 0.135);
  ctx.beginPath(); ctx.ellipse(0, -h * 0.665, h * 0.15, h * 0.045, 0, 0, Math.PI * 2); ctx.fillStyle = tones.css(tones.of(scarf)); ctx.fill();
  ctx.beginPath(); ctx.moveTo(h * 0.08, -h * 0.66); ctx.lineTo(h * 0.16, -h * 0.47); ctx.lineTo(h * 0.07, -h * 0.47); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tones.css(tones.of('graphite'));
  for (const ex of [-0.05, 0.05]) { ctx.beginPath(); ctx.arc(ex * h, -h * 0.81, h * 0.016, 0, Math.PI * 2); ctx.fill(); }
  for (const by of [-0.56, -0.48]) { ctx.beginPath(); ctx.arc(0, by * h, h * 0.014, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(0, -h * 0.775); ctx.lineTo(h * 0.11, -h * 0.755); ctx.lineTo(0, -h * 0.745); ctx.closePath(); ctx.fillStyle = tones.css(tones.of('orange')); ctx.fill();
  ctx.restore();
}
/** The rainbow over the valley: seven bands from the palette. */
export const RAINBOW_BANDS = ['red', 'orange', 'sun', 'leaf', 'sea', 'water', 'violet'] as const;
export function paintRainbow(ctx: Ctx, tones: Tones, cx: number, cy: number, r: number, alpha: number) {
  if (alpha <= 0.01) return;
  ctx.save(); ctx.lineCap = 'butt';
  const band = r * 0.022;
  RAINBOW_BANDS.forEach((name, i) => {
    ctx.beginPath(); ctx.arc(cx, cy, r - i * band, Math.PI, Math.PI * 2);
    ctx.lineWidth = band * 1.08; ctx.globalAlpha = alpha * 0.5; ctx.strokeStyle = tones.css(tones.of(name)); ctx.stroke();
  });
  ctx.restore();
}
/** A mound of snow lying on a ledge. */
export function paintSnowMound(ctx: Ctx, tones: Tones, x: number, y: number, w: number, h: number) {
  if (h <= 0.4) return;
  ctx.beginPath(); ctx.ellipse(x, y, w * 0.62, h, 0, Math.PI, Math.PI * 2); ctx.fillStyle = tones.css(tones.of('snow')); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + w * 0.1, y, w * 0.5, h * 0.42, 0, Math.PI, Math.PI * 2); ctx.globalAlpha *= 0.5; ctx.fillStyle = tones.css(mixRgb(tones.of('snow-shade'), tones.of('lilac'), 0.2)); ctx.fill(); ctx.globalAlpha /= 0.5;
}
