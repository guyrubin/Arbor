/** Woolly Mammoth rules. Pure: no React, no DOM, no timers, no randomness
 * inside (a seed or a random source is passed in). The fur is generated here
 * from authored regions (`mammothShape.ts`), so the same seed always grows the
 * same coat; the camera, the springs, the wind and the five discoveries are
 * plain functions the component steps every frame. */
export const ICE_AGE_FRIEND_ROUNDS = 1;

export type Vec = readonly [number, number];
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
export interface Camera { x: number; y: number; zoom: number }

/* ── randomness ───────────────────────────────────────────────────────── */

/** A small seeded generator (mulberry32): the same seed gives the same coat. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── geometry helpers ─────────────────────────────────────────────────── */

export function pointInPolygon(x: number, y: number, poly: readonly Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function polygonBounds(poly: readonly Vec[]): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  return { minX, minY, maxX, maxY };
}
export function polygonArea(poly: readonly Vec[]): number {
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) sum += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  return Math.abs(sum / 2);
}
/** A closed Catmull-Rom curve through the authored points, sampled densely:
 * the smooth outline the art is drawn and hit-tested with. */
export function smoothClosed(points: readonly Vec[], samples = 8): Vec[] {
  const out: Vec[] = [], n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    for (let k = 0; k < samples; k++) {
      const t = k / samples, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

/* ── the flow field ───────────────────────────────────────────────────── */

/** Where hair lies, by kind of coat. `u` runs from the head end (0) to the
 * tail end (1) of the region; `v` from its top (0) to its bottom (1). The
 * answer is an angle in radians in screen space for an animal facing LEFT:
 * 0 points to the tail, π/2 points down. */
export type FlowKind = 'flank' | 'ridge' | 'skirt' | 'head' | 'crownTuft' | 'ear' | 'leg' | 'tail' | 'sheath';
export function flowAngle(kind: FlowKind, u: number, v: number): number {
  const down = Math.PI / 2;
  switch (kind) {
    // Down and a little back; steeper low on the flank, flatter up by the back.
    case 'flank': return down - 0.55 + 0.45 * v + 0.12 * (u - 0.5);
    // The mane on the hump and back: swept back, falling as it goes.
    case 'ridge': return 0.42 + 0.35 * v;
    // The long skirt hangs almost straight down.
    case 'skirt': return down - 0.08 + 0.1 * (u - 0.5);
    // Short and dense, combed back and down off the face.
    case 'head': return 0.55 + 0.5 * v - 0.2 * (1 - u) * (1 - v);
    // The tuft on top of the domed crown stands up and back.
    case 'crownTuft': return -0.9 + 0.5 * u;
    case 'ear': return down - 0.35;
    case 'leg': return down + 0.06 * (u - 0.5);
    case 'tail': return down - 0.25;
    case 'sheath': return down + 0.35;
  }
}

/* ── the coat ─────────────────────────────────────────────────────────── */

/** Every strand belongs to one part; parts are drawn back to front in this order. */
/** The trunk paints before the head, so it grows out from under the face's fur. */
export const PARTS = ['legFarHind', 'legFarFront', 'tuskFar', 'legHind', 'legFront', 'tail', 'body', 'trunk', 'head', 'ear', 'tuskNear', 'sheath'] as const;
export type PartId = typeof PARTS[number];

export interface FurRegion {
  id: string;
  part: PartId;
  kind: FlowKind;
  /** Smoothed outline in world units (the trunk's is not used: see `trunk`). */
  poly: readonly Vec[];
  /** Share of the tier's strands. */
  share: number;
  /** Fraction that are long guard hairs; the rest is short undercoat. */
  guard: number;
  under: readonly [number, number];
  long: readonly [number, number];
  /** 0 = the near side in full light, 1 = deep on the far side. */
  depth: number;
  /** Fraction of the region's strands seeded on its outline as a ragged fringe. */
  fringe: number;
  /** The trunk's strands are seeded along it (s 0..1, t -1..1) and placed every frame. */
  trunk?: boolean;
}

export type Tier = 'full' | 'light';
export const TIER_STRANDS: Readonly<Record<Tier, number>> = { full: 10500, light: 3600 };
/** Light-tier strands are fewer and thicker, so the coat still reads as hair. */
export const TIER_WIDTH: Readonly<Record<Tier, number>> = { full: 1, light: 1.75 };
export const COLOUR_BINS = 7;
/** Height of one painting row in world units. */
export const ROW_HEIGHT = 26;

export interface StrandGroup { start: number; end: number; bin: number; cls: number; minX: number; minY: number; maxX: number; maxY: number }
export interface StrandRow { start: number; end: number; cls: number; groups: StrandGroup[] }
export interface StrandPart { part: PartId; start: number; end: number; rows: StrandRow[] }
export interface StrandSet {
  count: number;
  /** Root (world units; for the trunk: s and t). */
  rx: Float32Array; ry: Float32Array;
  /** Rest control point and tip, relative to the root (for the trunk: in the trunk's own frame). */
  cx: Float32Array; cy: Float32Array; tx: Float32Array; ty: Float32Array;
  len: Float32Array;
  /** Per-strand phase for flutter. */
  phase: Float32Array;
  /** 0 undercoat, 1 guard hair. */
  cls: Uint8Array;
  bin: Uint8Array;
  parts: StrandPart[];
}

interface Raw { part: number; region: number; x: number; y: number; cx: number; cy: number; tx: number; ty: number; len: number; phase: number; cls: number; bin: number; row: number }

/** How bright a strand is (0..1), from one light at the top left of the
 * whole animal, the region's depth, the coat layer and a little variety. */
export function lightAt(x: number, y: number, bounds: Bounds, depth: number, cls: number, jitter: number): number {
  const lx = (x - bounds.minX) / Math.max(1, bounds.maxX - bounds.minX), ly = (y - bounds.minY) / Math.max(1, bounds.maxY - bounds.minY);
  return 1.02 - 0.78 * ly - 0.22 * lx - 0.42 * depth - (cls === 0 ? 0.28 : 0) + jitter;
}
export function binFor(light: number): number {
  return Math.max(0, Math.min(COLOUR_BINS - 1, Math.floor(light * COLOUR_BINS)));
}

/** One strand's rest shape from its angle and length: long hair droops under
 * its own weight, and a small sideways curl keeps the coat from looking combed. */
export function strandShape(angle: number, len: number, curl: number, mirror: boolean): { cx: number; cy: number; tx: number; ty: number } {
  const down = Math.PI / 2;
  const droop = Math.min(0.75, len / 150);
  const a0 = mirror ? Math.PI - angle : angle;
  // Droop pulls the tip toward straight down, on whichever side it already leans.
  const a1 = a0 + (down - a0) * droop * 0.6;
  const nx = -Math.sin(a0), ny = Math.cos(a0);
  return {
    cx: Math.cos(a0) * len * 0.5 + nx * curl * len,
    cy: Math.sin(a0) * len * 0.5 + ny * curl * len,
    tx: Math.cos(a1) * len,
    ty: Math.sin(a1) * len,
  };
}

/** Seeds the whole coat for one view. Deterministic for a seed and tier.
 * Strands are sorted part by part, undercoat before guard hair, bottom row
 * first (so each higher row lies over the one below it), then by colour so a
 * row paints in a handful of strokes. */
export function generateStrands(regions: readonly FurRegion[], tier: Tier, seed: number, options: { mirror?: boolean; bounds: Bounds }): StrandSet {
  const random = seeded(seed);
  const total = TIER_STRANDS[tier];
  const raws: Raw[] = [];
  const mirror = !!options.mirror;
  const shareSum = regions.reduce((sum, r) => sum + r.share, 0);
  regions.forEach((region, regionIndex) => {
    const part = PARTS.indexOf(region.part);
    const want = Math.max(4, Math.round((total * region.share) / shareSum));
    const fringe = Math.round(want * region.fringe), inner = want - fringe;
    const push = (x: number, y: number, u: number, v: number, outward: number | null) => {
      // Fringe strands are always guard hair: the outline is made of long hair.
      const cls = outward !== null || random() < region.guard ? 1 : 0;
      const range = cls ? region.long : region.under;
      const len = range[0] + (range[1] - range[0]) * Math.pow(random(), 0.8);
      if (region.trunk) {
        // Along the trunk: lie down its length, splaying a little toward the edges.
        // Here x is s (base 0 .. tip 1) and y is t (-1 .. 1 across the trunk).
        const s = x, t = y;
        const angle = t * 0.5 + (random() - 0.5) * 0.35;
        const curl = (random() - 0.5) * 0.25;
        const nx = -Math.sin(angle), ny = Math.cos(angle);
        const tip = angle + t * 0.15;
        raws.push({ part, region: regionIndex, x: s, y: t, cx: Math.cos(angle) * len * 0.5 + nx * curl * len, cy: Math.sin(angle) * len * 0.5 + ny * curl * len, tx: Math.cos(tip) * len, ty: Math.sin(tip) * len, len, phase: random() * Math.PI * 2, cls, bin: binFor(0.66 - 0.45 * s + (random() - 0.5) * 0.4 - (cls === 0 ? 0.25 : 0) + t * 0.18), row: Math.floor(s * 12) });
        return;
      }
      const flow = flowAngle(region.kind, mirror ? 1 - u : u, v);
      let angle = flow + (random() - 0.5) * 0.32;
      // A fringe strand turns most of the way toward the outside of the outline.
      if (outward !== null) {
        const canonical = mirror ? Math.PI - outward : outward;
        let delta = canonical - angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        angle += delta * 0.7;
      }
      const shape = strandShape(angle, len, (random() - 0.5) * 0.42, mirror);
      const light = lightAt(x, y, options.bounds, region.depth, cls, (random() - 0.5) * 0.36);
      raws.push({ part, region: regionIndex, x, y, ...shape, len, phase: random() * Math.PI * 2, cls, bin: binFor(light), row: Math.floor(y / ROW_HEIGHT) });
    };
    if (region.trunk) {
      for (let i = 0; i < want; i++) push(Math.pow(random(), 0.9) * 0.97, random() * 2 - 1, 0, 0, null);
      return;
    }
    const box = polygonBounds(region.poly), area = polygonArea(region.poly);
    const w = box.maxX - box.minX, h = box.maxY - box.minY;
    const uv = (x: number, y: number) => [(x - box.minX) / Math.max(1, w), (y - box.minY) / Math.max(1, h)] as const;
    // Jittered grid: even cover without clumps (Poisson-ish), every cell its own throw.
    const cell = Math.sqrt(area / Math.max(1, inner));
    let placed = 0;
    for (let gy = box.minY + cell / 2; gy < box.maxY && placed < inner; gy += cell) {
      for (let gx = box.minX + cell / 2; gx < box.maxX && placed < inner; gx += cell) {
        const x = gx + (random() - 0.5) * cell * 0.9, y = gy + (random() - 0.5) * cell * 0.9;
        if (!pointInPolygon(x, y, region.poly)) continue;
        const [u, v] = uv(x, y); push(x, y, u, v, null); placed++;
      }
    }
    // Along the outline: a ragged fringe breaks the smooth edge everywhere.
    const outline = region.poly, n = outline.length;
    for (let i = 0; i < fringe; i++) {
      const at = random() * n, k = Math.floor(at), f = at - k;
      const a = outline[k % n], b = outline[(k + 1) % n];
      const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
      // Outward normal of a polygon; flip if it points inside.
      let nx = b[1] - a[1], ny = -(b[0] - a[0]);
      const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
      if (pointInPolygon(x + nx * 3, y + ny * 3, outline)) { nx = -nx; ny = -ny; }
      const [u, v] = uv(x, y); push(x - nx * 2, y - ny * 2, u, v, Math.atan2(ny, nx));
    }
  });
  raws.sort((a, b) => a.part - b.part || a.cls - b.cls || b.row - a.row || a.bin - b.bin || a.x - b.x);
  const count = raws.length;
  const set: StrandSet = {
    count, rx: new Float32Array(count), ry: new Float32Array(count), cx: new Float32Array(count), cy: new Float32Array(count),
    tx: new Float32Array(count), ty: new Float32Array(count), len: new Float32Array(count), phase: new Float32Array(count),
    cls: new Uint8Array(count), bin: new Uint8Array(count), parts: [],
  };
  let part: StrandPart | null = null, row: StrandRow | null = null, group: StrandGroup | null = null, rowKey = '';
  raws.forEach((s, i) => {
    set.rx[i] = s.x; set.ry[i] = s.y; set.cx[i] = s.cx; set.cy[i] = s.cy; set.tx[i] = s.tx; set.ty[i] = s.ty;
    set.len[i] = s.len; set.phase[i] = s.phase; set.cls[i] = s.cls; set.bin[i] = s.bin;
    if (!part || part.part !== PARTS[s.part]) { part = { part: PARTS[s.part], start: i, end: i, rows: [] }; set.parts.push(part); row = null; }
    const key = `${s.cls}:${s.row}`;
    if (!row || rowKey !== key) { row = { start: i, end: i, cls: s.cls, groups: [] }; part.rows.push(row); rowKey = key; group = null; }
    if (!group || group.bin !== s.bin) { group = { start: i, end: i, bin: s.bin, cls: s.cls, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }; row.groups.push(group); }
    group.minX = Math.min(group.minX, s.x - s.len); group.maxX = Math.max(group.maxX, s.x + s.len);
    group.minY = Math.min(group.minY, s.y - s.len); group.maxY = Math.max(group.maxY, s.y + s.len);
    part.end = i + 1; row.end = i + 1; group.end = i + 1;
  });
  return set;
}

/* ── wind ─────────────────────────────────────────────────────────────── */

/** How hard the wind blows overall at time `t` seconds (0..1), slowly rising and falling. */
export function windStrength(t: number): number {
  return Math.max(0, Math.min(1, 0.5 + 0.3 * Math.sin(t * 0.37) + 0.2 * Math.sin(t * 0.91 + 1)));
}
/** The gust at world x: a wave that travels with the wind (left to right),
 * so a ripple visibly passes through the coat. 0..1. */
export function gustAt(x: number, t: number, strength: number): number {
  return strength * (0.5 + 0.38 * Math.sin(x * 0.011 - t * 2.3) + 0.12 * Math.sin(x * 0.031 - t * 3.7 + 1.3));
}

/* ── springs ──────────────────────────────────────────────────────────── */

export const SPRING_OMEGA = 3.4;
export const SPRING_DAMPING = 0.8;
/** One semi-implicit step of a damped spring pulling an offset back to rest.
 * With the defaults a combed strand is back within about a second and a half. */
export function springStep(offset: number, velocity: number, dt: number, omega = SPRING_OMEGA, zeta = SPRING_DAMPING): [number, number] {
  const step = Math.min(dt, 0.05);
  const v = velocity + (-omega * omega * offset - 2 * zeta * omega * velocity) * step;
  return [offset + v * step, v];
}
/** The push a stroke gives a strand at distance `d` from the finger (radius `r`). */
export function strokeWeight(d: number, r: number): number {
  if (d >= r) return 0;
  const k = 1 - d / r;
  return k * k;
}
/** Keeps a combed offset within reach of the strand: hair bends, it does not stretch. */
export function capOffset(ox: number, oy: number, len: number): [number, number] {
  const max = len * 0.85, m = Math.hypot(ox, oy);
  return m <= max || m === 0 ? [ox, oy] : [(ox / m) * max, (oy / m) * max];
}

/* ── camera ───────────────────────────────────────────────────────────── */

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
/** From here on, strands draw thicker with a highlight so single hairs show. */
export const DETAIL_ZOOM = 2.5;
export const FOCUS_ZOOM = 2.2;
export function clampZoom(zoom: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number.isFinite(zoom) ? zoom : ZOOM_MIN));
}
/** The camera's centre kept so the view never leaves the animal by more than
 * margin world units. `half` is the half size of the view at zoom 1 in
 * world units. When the view is wider than the animal and its margin, the
 * animal stays centred on that axis. */
export function clampCamera(view: { x: number; y: number }, zoom: number, bounds: Bounds, half: { w: number; h: number }, margin: number): { x: number; y: number } {
  const z = clampZoom(zoom);
  const hw = half.w / z, hh = half.h / z;
  const axis = (value: number, min: number, max: number, h: number) => {
    const lo = min - margin + h, hi = max + margin - h;
    if (lo > hi) return (min + max) / 2;
    return Math.max(lo, Math.min(hi, Number.isFinite(value) ? value : (min + max) / 2));
  };
  return { x: axis(view.x, bounds.minX, bounds.maxX, hw), y: axis(view.y, bounds.minY, bounds.maxY, hh) };
}
/** Zooms by `factor` keeping the world point `focus` under the same spot on screen. */
export function zoomAbout(camera: Camera, factor: number, focus: { x: number; y: number }): Camera {
  const zoom = clampZoom(camera.zoom * factor), k = camera.zoom / zoom;
  return { zoom, x: focus.x + (camera.x - focus.x) * k, y: focus.y + (camera.y - focus.y) * k };
}
export function wholeView(bounds: Bounds): Camera {
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, zoom: ZOOM_MIN };
}
/** Where the camera glides to show one discovery: centred on it, close up, within bounds. */
export function focusTarget(point: { x: number; y: number }, bounds: Bounds, half: { w: number; h: number }, margin: number, zoom = FOCUS_ZOOM): Camera {
  const z = clampZoom(zoom);
  return { ...clampCamera(point, z, bounds, half, margin), zoom: z };
}
/** Eases between two cameras (t 0..1), zooming in log space so it feels even. */
export function mixCamera(a: Camera, b: Camera, t: number): Camera {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom: Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * k) };
}

/* ── quality tier ─────────────────────────────────────────────────────── */

export const TIER_FRAME_MS = 24;
/** The tier from the first second's frame times: slower than ~24 ms a frame
 * on average drops to the light coat. Too few samples keeps what we have. */
export function chooseTier(frameMs: readonly number[], current: Tier = 'full'): Tier {
  const usable = frameMs.filter(ms => Number.isFinite(ms) && ms > 0 && ms < 1000);
  if (current === 'light' || usable.length < 8) return current;
  const mean = usable.reduce((s, ms) => s + ms, 0) / usable.length;
  return mean > TIER_FRAME_MS ? 'light' : 'full';
}

/* ── the five discoveries ─────────────────────────────────────────────── */

export const DISCOVERIES = ['coats', 'ears', 'tusks', 'trunk', 'hump'] as const;
export type DiscoveryId = typeof DISCOVERIES[number];
export function isDiscovery(id: string): id is DiscoveryId {
  return (DISCOVERIES as readonly string[]).includes(id);
}
/** Adds a find; finding the same thing again changes nothing. Kept in the canonical order. */
export function discover(found: readonly DiscoveryId[], id: string): DiscoveryId[] {
  if (!isDiscovery(id) || found.includes(id)) return [...found];
  return DISCOVERIES.filter(d => d === id || found.includes(d));
}
export function allFound(found: readonly DiscoveryId[]): boolean {
  return DISCOVERIES.every(d => found.includes(d));
}

/* ── the trunk ────────────────────────────────────────────────────────── */

export const TRUNK_SAMPLES = 28;
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** The trunk's direction at s (0 base, 1 tip), facing left. At rest it hangs
 * with the tip curling forward; lifted, it sweeps forward and curls up. A slow
 * swing bends it a little more toward the tip. Curled (0..1), the lower part
 * rolls back under and up, carrying what the tip holds to the mouth. */
export function trunkAngle(s: number, lift: number, swing: number, curl = 0): number {
  const rest = 1.72 - 0.12 * s + 0.95 * smooth(0.66, 1, s);
  const raised = 2.45 + 2.0 * Math.pow(s, 1.15);
  const k = Math.max(0, Math.min(1, lift));
  const c = Math.max(-0.4, Math.min(1, curl));
  const rolled = 1.72 - 0.32 * s - 4.5 * Math.pow(Math.max(0, (s - 0.16) / 0.84), 1.5);
  const base = rest + (raised - rest) * k;
  return base + (rolled - base) * c + swing * s;
}
/** Half width of the trunk at s, in world units: broad where it leaves the face, slim at the tip. */
export function trunkHalfWidth(s: number): number {
  return 33 - 22.5 * Math.pow(Math.max(0, Math.min(1, s)), 0.72);
}
