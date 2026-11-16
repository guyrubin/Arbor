/** Stitch Garden: the embroidery itself. Each of the five flowers is worked
 * the way a needleworker would work it, as an ordered list of thread
 * segments: stem first (stem stitch), then leaves (satin or fishbone), then
 * petals (lazy-daisy loops or satin), then the centre (french knots).
 *
 * Pure and deterministic: a seeded PRNG keyed by flower and cell adds the
 * small hand-made wobble, so the same flower on the same cell always comes
 * out stitch-for-stitch the same (the kept cloth re-renders identically).
 * Coordinates are in the hoop drawing's own space (ART_W × ART_H). */
import { TEXTILE_CELLS, type TextileFlower } from './stitchGardenRules';

export const ART_W = 440, ART_H = 450;
export const HOOP_CX = 220, HOOP_CY = 228;
/** The cloth that shows inside the inner ring. */
export const CLOTH_R = 192;

/** The twelve places a flower can grow: a 4×3 grid fitted inside the round
 * hoop (the outer columns of the top and bottom rows step in a little so
 * every flower stays clear of the wood). Offsets from the hoop centre. */
const CELL_OFFSETS: readonly (readonly [number, number])[] = [
  [-94, -86], [-36, -96], [36, -96], [94, -86],
  [-110, -12], [-37, -12], [37, -12], [110, -12],
  [-96, 60], [-36, 70], [36, 70], [96, 60],
];
/** Flowers are worked at this size on the cloth (their frame is about 64 units tall). */
export const MOTIF_SCALE = 1.3;
export function cellCentre(cell: number): { x: number; y: number } {
  const [dx, dy] = CELL_OFFSETS[cell] ?? [0, 0];
  return { x: HOOP_CX + dx, y: HOOP_CY + dy };
}
/** Where a child aims for a cell: the middle of the flower that grows there. */
export function cellTarget(cell: number): { x: number; y: number } {
  const c = cellCentre(cell);
  return { x: c.x, y: c.y - 2 };
}

/** Thread tones. `thread` is the child's chosen colour, `threadDeep` the same
 * thread in shade (a petal behind another); the rest are fixed garden tones. */
export type StitchTone = 'thread' | 'threadDeep' | 'leaf' | 'leafDeep' | 'moss' | 'sun' | 'umber' | 'ink';
export type StitchPart = 'stem' | 'leaf' | 'petal' | 'centre';
/** One length of thread on the cloth. A knot is a french knot at (x1, y1)
 * with diameter `w`; anything else runs from 1 to 2, bending through c when set. */
export interface Stitch {
  x1: number; y1: number; x2: number; y2: number;
  cx?: number; cy?: number;
  w: number; tone: StitchTone; part: StitchPart; knot?: true;
}

type Pt = { x: number; y: number };
const r1 = (n: number) => Math.round(n * 10) / 10;

/** FNV-1a over the key, then mulberry32: small, fast, the same everywhere. */
export function seedFor(flower: TextileFlower, cell: number): number {
  let h = 2166136261;
  for (const ch of `${flower}:${cell}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const quad = (a: Pt, c: Pt, b: Pt, t: number): Pt => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
const quadNormal = (a: Pt, c: Pt, b: Pt, t: number): Pt => {
  const dx = 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x), dy = 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y);
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
};
const polar = (c: Pt, angleDeg: number, r: number): Pt => ({ x: c.x + Math.cos(angleDeg * Math.PI / 180) * r, y: c.y + Math.sin(angleDeg * Math.PI / 180) * r });

/** Collects stitches in the flower's own little frame (origin at the cell
 * centre, stem base at y = 30, head towards negative y) with the hand wobble,
 * then places them on the cloth. */
class Needle {
  readonly out: Stitch[] = [];
  constructor(private readonly rand: () => number) {}
  j(amount: number) { return (this.rand() * 2 - 1) * amount; }
  /** A straight or curved stitch, a touch longer or shorter and a degree or
   * two off, as a hand makes it. */
  run(a: Pt, b: Pt, w: number, tone: StitchTone, part: StitchPart, c?: Pt) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const k = 1 + this.j(0.05), turn = this.j(3) * Math.PI / 180, cos = Math.cos(turn), sin = Math.sin(turn);
    const move = (p: Pt): Pt => { const dx = (p.x - mx) * k, dy = (p.y - my) * k; return { x: mx + dx * cos - dy * sin + this.j(0.35), y: my + dx * sin + dy * cos + this.j(0.35) }; };
    const p1 = move(a), p2 = move(b), pc = c ? move(c) : undefined;
    this.out.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, ...(pc ? { cx: pc.x, cy: pc.y } : {}), w: w * (1 + this.j(0.06)), tone, part });
  }
  knot(p: Pt, d: number, tone: StitchTone) {
    const at = { x: p.x + this.j(0.3), y: p.y + this.j(0.3) };
    this.out.push({ x1: at.x, y1: at.y, x2: at.x, y2: at.y, w: d * (1 + this.j(0.08)), tone, part: 'centre', knot: true });
  }
  /** Stem stitch: short slanted stitches, each overlapping the one before by
   * half, down a gentle curve; it reads as a twisted cord. */
  stem(a: Pt, c: Pt, b: Pt, n: number, w: number, tone: StitchTone) {
    const step = 1 / (n + 0.7);
    for (let i = 0; i < n; i++) {
      const t0 = i * step, t1 = Math.min(1, t0 + 1.7 * step);
      const p0 = quad(a, c, b, t0), p1 = quad(a, c, b, t1), n0 = quadNormal(a, c, b, t0), n1 = quadNormal(a, c, b, t1);
      const slant = w * 0.38;
      this.run({ x: p0.x + n0.x * slant, y: p0.y + n0.y * slant }, { x: p1.x - n1.x * slant, y: p1.y - n1.y * slant }, w, tone, 'stem');
    }
  }
  /** Satin stitch: parallel strokes laid side by side across a leaf or petal
   * shape, slanted a little towards the tip. */
  satin(base: Pt, tip: Pt, width: number, n: number, w: number, tone: StitchTone, part: StitchPart, bend = 0) {
    const mid = { x: (base.x + tip.x) / 2, y: (base.y + tip.y) / 2 };
    const len = Math.hypot(tip.x - base.x, tip.y - base.y) || 1;
    const c = { x: mid.x - (tip.y - base.y) / len * bend, y: mid.y + (tip.x - base.x) / len * bend };
    const half = (s: number) => width / 2 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, s))), 0.8);
    // Satin lies close: each stroke is as wide as the gap to the next, so the shape reads filled.
    const lay = Math.min(4, Math.max(w, len / (n + 1) * 1.05));
    for (let k = 1; k <= n; k++) {
      const s = k / (n + 1), d = 0.55 / (n + 1);
      const sa = s - d, sb = s + d;
      const pa = quad(base, c, tip, sa), pb = quad(base, c, tip, sb), na = quadNormal(base, c, tip, sa), nb = quadNormal(base, c, tip, sb);
      this.run({ x: pa.x + na.x * half(sa), y: pa.y + na.y * half(sa) }, { x: pb.x - nb.x * half(sb), y: pb.y - nb.y * half(sb) }, lay, tone, part);
    }
  }
  /** Fishbone: strokes from alternate edges in to the midrib, base to tip. */
  fishbone(base: Pt, tip: Pt, width: number, n: number, w: number, tone: StitchTone, bend = 0) {
    const mid = { x: (base.x + tip.x) / 2, y: (base.y + tip.y) / 2 };
    const len = Math.hypot(tip.x - base.x, tip.y - base.y) || 1;
    const c = { x: mid.x - (tip.y - base.y) / len * bend, y: mid.y + (tip.x - base.x) / len * bend };
    for (let k = 0; k < n; k++) {
      const s = (k + 0.6) / (n + 0.6), side = k % 2 === 0 ? 1 : -1;
      const edge = quad(base, c, tip, s), nn = quadNormal(base, c, tip, s), rib = quad(base, c, tip, Math.min(1, s + 0.13));
      const half = width / 2 * Math.sin(Math.PI * Math.min(0.98, s));
      this.run({ x: edge.x + nn.x * half * side, y: edge.y + nn.y * half * side }, rib, w, tone, 'leaf');
    }
  }
  /** Lazy daisy: one loop of thread laid out from the centre and held at its
   * tip by a tiny tack stitch. */
  daisyLoop(centre: Pt, angle: number, r0: number, r1: number, width: number, w: number, tone: StitchTone, tack: boolean) {
    const base = polar(centre, angle, r0), tip = polar(centre, angle, r1), mid = polar(centre, angle, (r0 + r1) / 2 + 0.6);
    const nx = -Math.sin(angle * Math.PI / 180), ny = Math.cos(angle * Math.PI / 180);
    this.run(base, tip, w, tone, 'petal', { x: mid.x + nx * width, y: mid.y + ny * width });
    this.run(tip, base, w, tone, 'petal', { x: mid.x - nx * width, y: mid.y - ny * width });
    if (tack) this.run(polar(centre, angle, r1 - 0.4), polar(centre, angle, r1 + 2.2), w * 0.8, tone, 'petal');
  }
  /** A petal filled with straight strokes fanning out from the flower's heart. */
  fan(centre: Pt, angle: number, spread: number, n: number, r0: number, r: number, w: number, tone: StitchTone) {
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0 : k / (n - 1) * 2 - 1, a = angle + u * spread;
      const reach = r * (0.8 + 0.2 * Math.cos(u * Math.PI / 2)) + this.j(0.8);
      this.run(polar(centre, a, r0), polar(centre, a, reach), w, tone, 'petal');
    }
  }
}

function daisy(n: Needle) {
  n.stem({ x: 0, y: 30 }, { x: n.j(3), y: 12 }, { x: n.j(1.5), y: -8 }, 7, 1.8, 'leaf');
  const side = n.j(1) < 0 ? -1 : 1;
  n.satin({ x: side * 0.6, y: 16 }, { x: side * 15, y: 7 }, 7, 6, 1.5, 'leaf', 'leaf', side * -1.5);
  const head = { x: 0, y: -15 }, turn = n.j(18);
  for (let i = 0; i < 10; i++) n.daisyLoop(head, turn + i * 36, 3.6, 13.2 + n.j(0.8), 2.5, 1.5, 'thread', true);
  n.knot(head, 3, 'sun');
  for (let i = 0; i < 5; i++) n.knot(polar(head, turn + i * 72, 2.3), 2.4, 'sun');
}

function tulip(n: Needle) {
  n.stem({ x: 0, y: 30 }, { x: n.j(2), y: 10 }, { x: 0, y: -6 }, 8, 2, 'leaf');
  n.satin({ x: -1, y: 29 }, { x: -16, y: -4 }, 7, 7, 1.6, 'leafDeep', 'leaf', 3);
  n.satin({ x: 1, y: 29 }, { x: 15, y: 3 }, 6.5, 7, 1.6, 'leaf', 'leaf', -3);
  n.satin({ x: -2.4, y: -5 }, { x: -11.5, y: -29 }, 10, 7, 2, 'threadDeep', 'petal', 2.5);
  n.satin({ x: 2.4, y: -5 }, { x: 11.5, y: -29 }, 10, 7, 2, 'threadDeep', 'petal', -2.5);
  n.satin({ x: 0, y: -4 }, { x: n.j(0.8), y: -32 }, 12, 8, 2.1, 'thread', 'petal');
}

function poppy(n: Needle) {
  n.stem({ x: 0, y: 30 }, { x: 6 + n.j(2), y: 6 }, { x: 1, y: -9 }, 9, 1.35, 'moss');
  const side = n.j(1) < 0 ? -1 : 1;
  n.fishbone({ x: side * 2, y: 22 }, { x: side * 16, y: 9 }, 8, 7, 1.2, 'moss', side * -2);
  const head = { x: 0.5, y: -16 }, turn = n.j(10);
  n.fan(head, -140 + turn, 30, 6, 2, 15, 2.6, 'threadDeep');
  n.fan(head, -40 + turn, 30, 6, 2, 15, 2.6, 'threadDeep');
  n.fan(head, 150 + turn, 34, 7, 2, 14, 2.7, 'thread');
  n.fan(head, 30 + turn, 34, 7, 2, 14, 2.7, 'thread');
  for (let i = 0; i < 8; i++) n.run(polar(head, turn + i * 45 + 22, 3.4), polar(head, turn + i * 45 + 22, 7), 0.9, 'ink', 'centre');
  n.knot(head, 4.6, 'moss');
  for (let i = 0; i < 4; i++) n.knot(polar(head, turn + i * 90 + 45, 6.2), 1.9, 'ink');
}

/** A bluebell: an upright stem that bends over at the top like a shepherd's
 * crook, with three bells hanging from it on the side it leans to, each one
 * clear of the others. A bell is five curved satin strokes (the outer two in
 * shade, so it reads round), two curled tips at its lip and a pale clapper. */
function bluebell(n: Needle) {
  const s = n.j(1) < 0 ? -1 : 1;
  const at = (x: number, y: number): Pt => ({ x: s * (x - 8), y });
  n.satin(at(-1, 30), at(-12, 3), 4.6, 4, 1.6, 'leaf', 'leaf', s * 2);
  n.satin(at(1, 30), at(10, 15), 4, 3, 1.6, 'leafDeep', 'leaf', -s * 1.5);
  const foot = at(0, 30), neck = at(1.5, -15), crown = at(5, -38), tip = at(21, -23.5);
  n.stem(foot, at(-2.5, 8), neck, 6, 1.7, 'leafDeep');
  n.stem(neck, crown, tip, 5, 1.45, 'leafDeep');
  const bell = (from: Pt, top: Pt, size: number) => {
    n.run(from, top, 1.1, 'leafDeep', 'stem');
    const high = 12.5 * size;
    for (const u of [-1, 1, -0.5, 0.5, 0]) {
      const edge = Math.abs(u) === 1;
      n.run({ x: top.x + u * 1.7 * size, y: top.y + Math.abs(u) * 1.3 * size }, { x: top.x + u * 4.5 * size, y: top.y + high - Math.abs(u) * 0.6 }, 2.7 * size, edge ? 'threadDeep' : 'thread', 'petal',
        { x: top.x + u * 5.6 * size, y: top.y + high * 0.42 });
    }
    for (const u of [-1, 1]) n.run({ x: top.x + u * 4.4 * size, y: top.y + high - 0.4 }, { x: top.x + u * 7.3 * size, y: top.y + high - 2.6 * size }, 1.5 * size, 'thread', 'petal', { x: top.x + u * 6.6 * size, y: top.y + high + 0.9 * size });
    n.knot({ x: top.x, y: top.y + high + 1.1 * size }, 2.3 * size, 'sun');
  };
  bell(quad(foot, at(-2.5, 8), neck, 0.86), at(8, -6.5), 1.08);
  bell(quad(neck, crown, tip, 0.46), at(10.4, -23), 0.92);
  bell(tip, at(23.4, -18.6), 0.74);
}

function sunflower(n: Needle) {
  n.stem({ x: 0, y: 30 }, { x: n.j(2.5), y: 8 }, { x: 0, y: -4 }, 9, 2.5, 'leafDeep');
  n.satin({ x: -0.6, y: 17 }, { x: -18, y: 7 }, 10, 6, 1.7, 'leaf', 'leaf', -3);
  n.satin({ x: 0.6, y: 9 }, { x: 17, y: -1 }, 9, 6, 1.7, 'leaf', 'leaf', 3);
  const head = { x: 0, y: -18 }, turn = n.j(15);
  for (let i = 0; i < 10; i++) n.run(polar(head, turn + i * 36 + 18, 7), polar(head, turn + i * 36 + 18, 16 + n.j(0.8)), 3.1, 'threadDeep', 'petal');
  for (let i = 0; i < 11; i++) n.daisyLoop(head, turn + i * (360 / 11), 7, 15.6 + n.j(0.7), 2.1, 1.5, 'thread', false);
  for (let k = 0; k < 10; k++) n.knot(polar(head, turn + k * 137.5, 1.75 * Math.sqrt(k + 0.5)), 2.4, k % 4 === 3 ? 'ink' : 'umber');
}

const WORK: Record<TextileFlower, (n: Needle) => void> = { daisy, tulip, poppy, bluebell, sunflower };

/** The flower's stitches in its own frame (cell centre at 0,0), with the
 * hand wobble and its small lean and size set by the cell. */
export function motifStitches(flower: TextileFlower, cell: number): Stitch[] {
  if (!WORK[flower] || !Number.isInteger(cell) || cell < 0 || cell >= TEXTILE_CELLS) return [];
  const rand = prng(seedFor(flower, cell));
  const lean = (rand() * 2 - 1) * 5 * Math.PI / 180, size = (0.95 + rand() * 0.1) * MOTIF_SCALE;
  const needle = new Needle(rand);
  WORK[flower](needle);
  const cos = Math.cos(lean) * size, sin = Math.sin(lean) * size, pivotY = 24 * MOTIF_SCALE;
  const place = (x: number, y: number) => ({ x: r1(x * cos - (y - 24) * sin), y: r1(x * sin + (y - 24) * cos + pivotY) });
  return needle.out.map(st => {
    const a = place(st.x1, st.y1), b = place(st.x2, st.y2);
    const out: Stitch = { x1: a.x, y1: a.y, x2: b.x, y2: b.y, w: r1(st.w * size / MOTIF_SCALE * 1.12), tone: st.tone, part: st.part };
    if (st.cx !== undefined && st.cy !== undefined) { const c = place(st.cx, st.cy); out.cx = c.x; out.cy = c.y; }
    if (st.knot) out.knot = true;
    return out;
  });
}

/** `stitchesFor(flower, cell)`: the ordered segments for that flower on that
 * cell, on the cloth. Same input, same stitches. */
export function stitchesFor(flower: TextileFlower, cell: number): Stitch[] {
  const at = cellCentre(cell);
  return motifStitches(flower, cell).map(st => {
    const out: Stitch = { ...st, x1: r1(st.x1 + at.x), y1: r1(st.y1 + at.y), x2: r1(st.x2 + at.x), y2: r1(st.y2 + at.y) };
    if (st.cx !== undefined && st.cy !== undefined) { out.cx = r1(st.cx + at.x); out.cy = r1(st.cy + at.y); }
    return out;
  });
}

/** How long the needle takes over one flower, and over pulling one out. */
export const STITCH_MS = 1600, UNPICK_MS = 720;
/** A tiny tick every few stitches, not every one. */
export const TICK_EVERY = 4;
