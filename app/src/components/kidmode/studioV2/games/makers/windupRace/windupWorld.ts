import { NEAR, horizonY, project, type Camera } from './windupCamera';
import { CUSHION, FLOWER_FOLDED, FLOWER_OPEN, PEP_BOW, PEP_SIDE, PEP_SIT, PETALS, PLANTERS, ROVER_FRONT, ROVER_MARKS, ROVER_REAR, RUG_TOP, SIGN_TOP, VALLEY, type KitSprite } from './windupKit';
import { gustAt, type Course, type Daylight, type Line } from './windupRaceRules';

/** Wind-up Racer's world, drawn on one canvas through one camera.
 *
 * A toy's-eye picture: Rover is a toy on the pavilion's pearl floor, so the
 * arcade behind it is building-sized and far away, the felt track and the
 * knit props beside it are toy-sized and near. Everything is placed in world
 * units and projected by `windupCamera`: the floor's joints, the track, the
 * arches, the sunlight that falls through them onto the floor, each kit
 * picture and its shadow. Colour comes from the makers' palette, read from
 * the page at run time; this file carries no colour literal. */

/* ---------- the place ---------- */

export const TRACK_HALF = 1.3;
/** The arcade wall: where it stands, how thick and how tall it is, and its arches. */
export const WALL_Z = 14, WALL_T = 1.8, WALL_H = 30, BAY = 14, ARCH_HALF = 4.7, ARCH_SPRING = 9.5;
/** The terrace's low wall. */
export const PARAPET_Z = 21, PARAPET_H = 0.8;
const FLOOR_FAR = 90, FLOOR_NEAR = -26;
/** How far to the side of the middle Rover runs on a line past the fork. */
export const LINE_Z = 0.66;

/** How far round the colour wheel a knit flower's petals are turned: coral (as cut), amber, rose, lilac. */
export const FLOWER_HUES = [0, 0, 30, -24, -112] as const;

export interface Scenery {
  /** Arch centres, along the wall. */
  arches: number[];
  /** Fern planters at the foot of the wall's piers. */
  piers: number[];
  /** Pennants and pots of grass where a gust blows: they show which way. */
  flags: { x: number; z: number; tone: number; gust: number }[];
  reeds: { x: number; z: number; gust: number; seed: number }[];
  /** Kit planters beside the calm stretches. */
  pots: { x: number; z: number; kind: number }[];
}
function hash(n: number): number { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

/** Lay the scenery for a course. Pure: the course (and its seed) decide all of it. */
export function buildScenery(course: Course): Scenery {
  const arches: number[] = [], piers: number[] = [];
  for (const zone of course.zones) {
    if (zone.kind === 'arcade') {
      const first = Math.ceil((zone.from + ARCH_HALF + 2 - 5) / BAY) * BAY + 5;
      for (let x = first; x <= zone.to - ARCH_HALF - 2; x += BAY) { arches.push(x); piers.push(x - BAY / 2); }
      if (arches.length) piers.push(arches[arches.length - 1] + BAY / 2);
    }
  }
  const flags: Scenery['flags'] = [], reeds: Scenery['reeds'] = [];
  course.gusts.forEach((gust, index) => {
    let n = 0;
    for (let x = gust.from + 0.6; x <= gust.to - 0.2; x += 2.3, n++) flags.push({ x, z: 2.9 + (n % 2) * 0.5, tone: (n + index) % 4, gust: index });
    for (let x = gust.from + 1.7; x <= gust.to - 0.4; x += 2.3) reeds.push({ x, z: 2.15, gust: index, seed: hash(x * 3.3) });
  });
  const busy = (x: number) => course.gusts.some(g => x > g.from - 1.5 && x < g.to + 1.5) || course.hills.some(h => x > h.from - 2 && x < h.from + h.up + h.flat + 2)
    || course.blooms.some(b => Math.abs(b - x) < 1.9) || Math.abs(x - course.goal) < 4 || x < course.start + 3;
  const pots: Scenery['pots'] = [];
  for (let x = course.start + 5; x < course.length - 4; x += 9.5) { const at = x + hash(x + course.seed) * 3; if (!busy(at)) pots.push({ x: at, z: 4.6 + hash(at) * 1.2, kind: Math.floor(hash(at * 1.7 + course.seed) * 3) }); }
  return { arches, piers, flags, reeds, pots };
}

/** The sun of a play: how far a thing's shadow reaches along x and toward the camera per unit of height. */
export interface Sun { kx: number; kz: number; warm: number }
export function sunFor(light: Daylight): Sun {
  return light === 'morning' ? { kx: 0.55, kz: 1.3, warm: 0.25 } : light === 'goldenHour' ? { kx: -0.5, kz: 1.5, warm: 0.8 } : { kx: 0.3, kz: 1.12, warm: 0.5 };
}
const inArch = (xw: number, h: number, arches: readonly number[]) => {
  for (const c of arches) {
    const dx = xw - c;
    if (dx > -ARCH_HALF && dx < ARCH_HALF && (h <= ARCH_SPRING || dx * dx + (h - ARCH_SPRING) * (h - ARCH_SPRING) <= ARCH_HALF * ARCH_HALF)) return true;
  }
  return false;
};
/** Is the floor point (x, z), or a point `y` above it, in sunlight (1) or in the wall's shade (0)? */
export function litAt(course: Course, scenery: Scenery, sun: Sun, x: number, z: number, y = 0): number {
  // Walk back up the sunbeam to the wall's plane.
  const h = y + (WALL_Z - z) / sun.kz;
  if (h < 0) return 1;
  const xw = x - sun.kx * (h - y);
  let wall = false;
  for (const zone of course.zones) if (zone.kind === 'arcade' && xw >= zone.from && xw <= zone.to) wall = true;
  if (!wall || h > WALL_H) return 1;
  return inArch(xw, h, scenery.arches) ? 1 : 0;
}
/** The same, softened over Rover's length. */
export function lightOn(course: Course, scenery: Scenery, sun: Sun, x: number, z: number, y = 0): number {
  return (litAt(course, scenery, sun, x - 0.45, z, y) + litAt(course, scenery, sun, x, z, y) * 2 + litAt(course, scenery, sun, x + 0.45, z, y)) / 4;
}

/* ---------- colour ---------- */

export type RGB = readonly [number, number, number];
export const mixTone = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** A canvas colour from 0..1 channels, in the space-separated form every supported browser reads. */
export const ink = (c: RGB, alpha = 1) => `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)} / ${alpha.toFixed(3)})`;
/** Reads palette tokens from the page, once each. */
export class Palette {
  private cache = new Map<string, RGB>();
  private probe: HTMLElement | null = null;
  constructor(private host: HTMLElement) {}
  get(token: string): RGB {
    const hit = this.cache.get(token); if (hit) return hit;
    let value: RGB = [1, 1, 1];
    try {
      if (!this.probe) { this.probe = document.createElement('span'); this.probe.style.display = 'none'; this.host.appendChild(this.probe); }
      this.probe.style.color = `var(${token})`;
      const text = getComputedStyle(this.probe).color, parts = (text.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
      if (parts.length >= 3) value = text.startsWith('color') ? [parts[0], parts[1], parts[2]] : [parts[0] / 255, parts[1] / 255, parts[2] / 255];
    } catch { /* Not in a browser: white. */ }
    this.cache.set(token, value); return value;
  }
  dispose() { this.probe?.remove(); this.probe = null; }
}

/* ---------- pictures ---------- */

export class Pictures {
  private map = new Map<string, HTMLImageElement>();
  private shaded = new Map<string, HTMLCanvasElement>();
  private variants = new Map<string, HTMLCanvasElement>();
  load(src: string) {
    if (this.map.has(src) || typeof Image === 'undefined') return;
    const img = new Image(); img.decoding = 'async'; img.src = src; this.map.set(src, img);
  }
  get(src: string): HTMLImageElement | null { const img = this.map.get(src); return img && img.complete && img.naturalWidth > 0 ? img : null; }
  /** The picture with its warm petals turned to another colour of the same knit (drawn once).
   * Only the coral wool moves round the colour wheel: stems, leaves and the sun's face stay. */
  variant(src: string, turn: number): HTMLImageElement | HTMLCanvasElement | null {
    const img = this.get(src); if (!img || !turn || typeof document === 'undefined') return img;
    const key = `${src}|${turn}`, hit = this.variants.get(key); if (hit) return hit;
    try {
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const c = canvas.getContext('2d', { willReadFrequently: true }); if (!c) return img;
      c.drawImage(img, 0, 0);
      const data = c.getImageData(0, 0, canvas.width, canvas.height), px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        if (px[i + 3] < 8 || r < g + 26 || r < b + 26 || g > b + 86) continue;
        // Turn the hue, keep the lightness and most of the saturation.
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min || 1;
        let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h = ((h * 60 + turn) % 360 + 360) % 360;
        const sat = (d / (max || 1)) * (turn < -60 ? 0.72 : 0.92), v = max, cc = v * sat, x = cc * (1 - Math.abs((h / 60) % 2 - 1)), m = v - cc;
        const [r1, g1, b1] = h < 60 ? [cc, x, 0] : h < 120 ? [x, cc, 0] : h < 180 ? [0, cc, x] : h < 240 ? [0, x, cc] : h < 300 ? [x, 0, cc] : [cc, 0, x];
        px[i] = r1 + m; px[i + 1] = g1 + m; px[i + 2] = b1 + m;
      }
      c.putImageData(data, 0, 0);
      this.variants.set(key, canvas); return canvas;
    } catch { return img; }
  }
  /** A picture with a shade laid over it (drawn once), for a thing standing out of the sun. */
  shade(key: string, source: HTMLImageElement | HTMLCanvasElement | null, tint: RGB, amount: number): HTMLCanvasElement | null {
    const hit = this.shaded.get(key); if (hit) return hit;
    if (!source || typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
    const c = canvas.getContext('2d'); if (!c) return null;
    c.drawImage(source, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = ink(tint, amount); c.fillRect(0, 0, canvas.width, canvas.height);
    this.shaded.set(key, canvas); return canvas;
  }
  ready(sources: readonly string[]): boolean { return sources.every(src => !!this.get(src)); }
}

/* ---------- small things in the air ---------- */

export const FX_CAP = 150;
/** dust, a knit petal, a glint, a streak of wind, a mote in a sunbeam. */
export type MoteKind = 0 | 1 | 2 | 3 | 4;
interface Mote { kind: MoteKind; x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number; tone: number; rot: number; spin: number }
export class Fx {
  list: Mote[] = [];
  private n = 0;
  private rnd() { this.n++; return hash(this.n * 1.618 + 0.37); }
  add(kind: MoteKind, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, tone = 0) {
    if (this.list.length >= FX_CAP) this.list.shift();
    this.list.push({ kind, x, y, z, vx, vy, vz, age: 0, life, size, tone, rot: this.rnd() * 6.28, spin: (this.rnd() - 0.5) * 8 });
  }
  /** A puff of floor dust behind the wheels. */
  dust(x: number, z: number, amount: number, back: number) {
    for (let i = 0; i < amount; i++) this.add(0, x + (this.rnd() - 0.5) * 0.3, 0.08 + this.rnd() * 0.1, z + (this.rnd() - 0.5) * 0.7, -back * (0.4 + this.rnd()), 0.5 + this.rnd() * 0.9, (this.rnd() - 0.5) * 0.9, 0.5 + this.rnd() * 0.5, 0.16 + this.rnd() * 0.2);
  }
  petals(x: number, y: number, z: number, amount: number, push = 0) {
    for (let i = 0; i < amount; i++) this.add(1, x, y, z, (this.rnd() - 0.5) * 2.4 + push, 1.2 + this.rnd() * 2.2, (this.rnd() - 0.5) * 1.6, 1.3 + this.rnd() * 0.9, 0.16 + this.rnd() * 0.1, Math.floor(this.rnd() * PETALS.length));
  }
  glints(x: number, y: number, z: number, amount: number, wide = 0.5) {
    for (let i = 0; i < amount; i++) this.add(2, x + (this.rnd() - 0.5) * wide * 2, y + (this.rnd() - 0.5) * wide, z + (this.rnd() - 0.5) * wide, (this.rnd() - 0.5) * 0.8, 0.3 + this.rnd() * 0.8, (this.rnd() - 0.5) * 0.5, 0.5 + this.rnd() * 0.6, 0.1 + this.rnd() * 0.1);
  }
  streak(x: number, y: number, z: number, speed: number) { this.add(3, x, y, z, speed, 0, 0, 0.55 + this.rnd() * 0.3, 1.2 + this.rnd() * 1.6); }
  step(dt: number) {
    let keep = 0;
    for (const m of this.list) {
      m.age += dt; if (m.age >= m.life) continue;
      m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt; m.rot += m.spin * dt;
      if (m.kind === 0) { m.vx *= 1 - 2.2 * dt; m.vy *= 1 - 2.5 * dt; m.size += dt * 0.5; }
      else if (m.kind === 1) { m.vy -= 3.4 * dt; m.vx *= 1 - 0.8 * dt; if (m.y < 0.03) { m.y = 0.03; m.vy = 0; m.vx *= 1 - 5 * dt; m.spin *= 0.9; } }
      else if (m.kind === 2) { m.vy -= 0.6 * dt; }
      this.list[keep++] = m;
    }
    this.list.length = keep;
  }
  clear() { this.list.length = 0; }
}

/* ---------- one frame ---------- */

export type PepPose = 'sit' | 'bow' | 'side';
export interface Frame {
  width: number; height: number; time: number;
  cam: Camera; course: Course; scenery: Scenery; sun: Sun; reduced: boolean;
  rover: { x: number; y: number; z: number; pitch: number; sx: number; sy: number; rear: boolean; flip: boolean; glow: number; keyAngle: number; keySpin: number; tight: number; tremble: number; lean: number; wheel: number; roll: number };
  pep: { x: number; y: number; z: number; pose: PepPose; flip: boolean; sx: number; sy: number; show: boolean };
  /** How open each trackside flower is (0 folded .. 1 open), and the big one at the goal. */
  blooms: readonly number[]; goalBloom: number;
  balls: readonly { x: number; z: number }[];
  cushion: number;
  /** The signpost disc's turn (radians) and whether to show it. */
  signTurn: number; line: Line;
  /** 0..1: how fast the world is going by. */
  speed: number;
  /** A white flash and a fade to pearl (0..1 each). */
  flash: number; fade: number;
  /** The secret: a ribbon of colour behind Rover. */
  ribbon: readonly { x: number; y: number; z: number }[] | null;
  /** The secret prism's catch-light in the set-piece (0..1). */
  shafts: number;
  fx: Fx;
}
export interface Hit { id: string; x: number; y: number; r: number }

const T = {
  white: '--mk-white', snow: '--mk-snow', snowShade: '--mk-snow-shade', chalk: '--mk-chalk', sky: '--mk-sky', skyPale: '--mk-sky-pale', steel: '--mk-steel', steelLight: '--mk-steel-light',
  slate: '--mk-slate', shadow: '--mk-shadow', teal: '--mk-teal', tealDeep: '--mk-teal-deep', sea: '--mk-sea', cream: '--mk-cream', paper: '--mk-paper', linen: '--mk-linen',
  wood: '--mk-wood', woodLight: '--mk-wood-light', woodDark: '--mk-wood-dark', gold: '--mk-gold', goldLight: '--mk-gold-light', goldDeep: '--mk-gold-deep', leaf: '--mk-leaf', leafDeep: '--mk-leaf-deep',
  spring: '--mk-spring', moss: '--mk-moss', poppy: '--mk-poppy', orange: '--mk-orange', amber: '--mk-amber', sun: '--mk-sun', butter: '--mk-butter', rose: '--mk-rose', clayLight: '--mk-clay-light',
  lilac: '--mk-lilac', bluebell: '--mk-bluebell', violet: '--mk-violet', blossom: '--mk-blossom', indigo: '--mk-indigo',
} as const;

/** Traces a flat polygon (x, y, z triples) as a sub-path, clipped to the lens. Returns false when none of it shows. */
function trace(ctx: CanvasRenderingContext2D, cam: Camera, pts: readonly number[], k = 1): boolean {
  const n = pts.length / 3;
  let px = 0, py = 0, pd = 0, started = false, count = 0;
  const lx = pts[(n - 1) * 3] - cam.ex, ly = pts[(n - 1) * 3 + 1] - cam.ey, lz = pts[(n - 1) * 3 + 2] - cam.ez;
  px = lx * cam.rx + lz * cam.rz; py = lx * cam.ux + ly * cam.uy + lz * cam.uz; pd = lx * cam.fx + ly * cam.fy + lz * cam.fz;
  const emit = (x: number, y: number, d: number) => {
    const s = cam.focal / d, sx = (cam.cx + x * s) * k, sy = (cam.cy - y * s) * k;
    if (started) ctx.lineTo(sx, sy); else { ctx.moveTo(sx, sy); started = true; }
    count++;
  };
  for (let i = 0; i < n; i++) {
    const dx = pts[i * 3] - cam.ex, dy = pts[i * 3 + 1] - cam.ey, dz = pts[i * 3 + 2] - cam.ez;
    const x = dx * cam.rx + dz * cam.rz, y = dx * cam.ux + dy * cam.uy + dz * cam.uz, d = dx * cam.fx + dy * cam.fy + dz * cam.fz;
    const inNow = d >= NEAR, inPrev = pd >= NEAR;
    if (inNow !== inPrev) { const t = (NEAR - pd) / (d - pd); emit(px + (x - px) * t, py + (y - py) * t, NEAR); }
    if (inNow) emit(x, y, d);
    px = x; py = y; pd = d;
  }
  if (started) ctx.closePath();
  return count >= 3;
}
const quadXZ = (x0: number, x1: number, z0: number, z1: number, y = 0) => [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1];
function fillPoly(ctx: CanvasRenderingContext2D, cam: Camera, pts: readonly number[], style: string | CanvasGradient, k = 1) {
  ctx.beginPath(); if (trace(ctx, cam, pts, k)) { ctx.fillStyle = style; ctx.fill(); }
}
/** The outline of an arch opening in a wall plane at depth z. */
function archPoints(c: number, z: number, grow = 0): number[] {
  const a = ARCH_HALF + grow, out = [c - a, 0, z, c - a, ARCH_SPRING, z];
  for (let i = 1; i < 12; i++) { const t = Math.PI - (i / 12) * Math.PI; out.push(c + Math.cos(t) * a, ARCH_SPRING + Math.sin(t) * a, z); }
  out.push(c + a, ARCH_SPRING, z, c + a, 0, z);
  return out;
}
/** The patch of floor an arch's sunlight falls on. */
function poolPoints(c: number, sun: Sun, y = 0): number[] {
  const pts = archPoints(c, WALL_Z), out: number[] = [];
  for (let i = 0; i < pts.length; i += 3) { const h = pts[i + 1]; out.push(pts[i] + sun.kx * h, y, WALL_Z - sun.kz * h); }
  return out;
}

/** Sets the context so that drawing in (u, v) lands flat on the floor at (x, z): u runs along x, v toward the camera's side. */
function onFloor(ctx: CanvasRenderingContext2D, cam: Camera, x: number, z: number, y = 0.02): number {
  const p = project(cam, x, y, z), px = project(cam, x + 0.4, y, z), pz = project(cam, x, y, z - 0.4);
  if (!p || !px || !pz) return 0;
  ctx.transform((px.x - p.x) / 0.4, (px.y - p.y) / 0.4, (pz.x - p.x) / 0.4, (pz.y - p.y) / 0.4, p.x, p.y);
  return p.scale;
}

export class World {
  readonly pictures = new Pictures();
  readonly hits: Hit[] = [];
  private lightMap: HTMLCanvasElement | null = null;
  private fern: HTMLCanvasElement | null = null;
  constructor(private palette: Palette) {
    for (const s of [ROVER_FRONT, ROVER_REAR, PEP_SIDE, PEP_SIT, PEP_BOW, FLOWER_FOLDED, FLOWER_OPEN, CUSHION, RUG_TOP, SIGN_TOP, ...PLANTERS, ...PETALS]) this.pictures.load(s.src);
    this.pictures.load(VALLEY.src);
  }
  private c(token: string): RGB { return this.palette.get(token); }

  /** A fern in a white planter, drawn once and kept (it stands far off, a little soft). */
  private fernSprite(): HTMLCanvasElement | null {
    if (this.fern || typeof document === 'undefined') return this.fern;
    const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 300;
    const g = canvas.getContext('2d'); if (!g) return null;
    const leafA = this.c(T.leaf), leafB = this.c(T.leafDeep), leafC = this.c(T.spring), white = this.c(T.white), shade = this.c(T.snowShade);
    for (let i = 0; i < 17; i++) {
      const t = i / 16, angle = -Math.PI * (0.06 + t * 0.88), len = 86 + hash(i * 7.1) * 46, droop = 34 + hash(i * 3.3) * 30;
      const tone = mixTone(mixTone(leafB, leafA, hash(i * 1.9)), leafC, hash(i * 5.3) * 0.5);
      g.strokeStyle = ink(tone, 0.94); g.lineCap = 'round';
      let x = 150, y = 196;
      for (let s = 0; s < 14; s++) {
        const f = s / 14, a = angle + f * f * (Math.cos(angle) > 0 ? 1 : -1) * 0.9;
        const nx = x + Math.cos(a) * len / 14, ny = y + Math.sin(a) * len / 14 + f * droop / 14;
        g.lineWidth = 2.2 * (1 - f) + 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
        const side = 9 * (1 - f * 0.7) + 2, nrm = a + Math.PI / 2;
        g.lineWidth = 2.6 * (1 - f * 0.6);
        for (const dir of [-1, 1]) { g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + Math.cos(nrm) * side * dir + Math.cos(a) * 4, ny + Math.sin(nrm) * side * dir + Math.sin(a) * 4); g.stroke(); }
        x = nx; y = ny;
      }
    }
    const box = g.createLinearGradient(0, 196, 0, 290);
    box.addColorStop(0, ink(mixTone(white, shade, 0.2))); box.addColorStop(1, ink(mixTone(white, shade, 0.75)));
    g.fillStyle = box; g.beginPath(); g.roundRect(70, 196, 160, 96, 12); g.fill();
    g.fillStyle = ink(this.c(T.teal), 0.75); g.fillRect(70, 276, 160, 5);
    this.fern = canvas; return canvas;
  }

  /** The floor's light: sun everywhere, the wall's shade laid over it, the arches' pools cut back in. Small and soft. */
  private drawLight(f: Frame): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const k = 1 / 3, w = Math.max(2, Math.ceil(f.width * k)), h = Math.max(2, Math.ceil(f.height * k));
    const map = this.lightMap ?? (this.lightMap = document.createElement('canvas'));
    if (map.width !== w || map.height !== h) { map.width = w; map.height = h; }
    const g = map.getContext('2d'); if (!g) return null;
    const warm = f.sun.warm, shade = mixTone(mixTone(this.c(T.snowShade), this.c(T.steel), 0.35), this.c(T.lilac), warm * 0.22);
    const lit = mixTone(this.c(T.white), this.c(T.butter), warm * 0.3);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = ink(lit); g.fillRect(0, 0, w, h);
    // A soft edge to every shadow, where the browser can blur a canvas (elsewhere the small map's own softness does).
    const canBlur = typeof g.filter === 'string';
    if (canBlur) g.filter = 'blur(1.6px)';
    const { cam, course, sun } = f;
    for (const zone of course.zones) {
      if (zone.kind === 'arcade') {
        const top = WALL_H;
        fillPoly(g, cam, [zone.from, 0, WALL_Z, zone.to, 0, WALL_Z, zone.to + sun.kx * top, 0, WALL_Z - sun.kz * top, zone.from + sun.kx * top, 0, WALL_Z - sun.kz * top], ink(shade), k);
      } else {
        // The parapet's short shadow.
        fillPoly(g, cam, [zone.from, 0, PARAPET_Z, zone.to, 0, PARAPET_Z, zone.to + sun.kx * PARAPET_H, 0, PARAPET_Z - sun.kz * PARAPET_H, zone.from + sun.kx * PARAPET_H, 0, PARAPET_Z - sun.kz * PARAPET_H], ink(mixTone(lit, shade, 0.7)), k);
      }
    }
    for (const c of f.scenery.arches) if (Math.abs(c - cam.ex) < 120) fillPoly(g, cam, poolPoints(c, sun), ink(lit), k);
    if (canBlur) g.filter = 'none';
    return map;
  }

  draw(ctx: CanvasRenderingContext2D, f: Frame) {
    const { cam, course, scenery, sun, width: W, height: H, time } = f, c = (token: string) => this.c(token);
    const pics = this.pictures;
    this.hits.length = 0;
    const hy = horizonY(cam);
    const warm = sun.warm;
    const shadeTint = mixTone(c(T.indigo), c(T.slate), 0.5), spriteShade = mixTone(c(T.slate), c(T.bluebell), 0.35);

    /* -- far away: the sky and Horizon Valley -- */
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, hy));
    sky.addColorStop(0, ink(mixTone(c(T.sky), c(T.bluebell), 0.12))); sky.addColorStop(1, ink(mixTone(c(T.skyPale), c(T.butter), warm * 0.25)));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const valley = pics.get(VALLEY.src);
    if (valley) {
      const s = Math.max(W * 1.35 / VALLEY.w, (hy + 40) / (VALLEY.horizon * VALLEY.h));
      // Far things only turn with the camera: they do not slide as it travels.
      const pan = Math.atan2(cam.fx, cam.fz) * W * 0.3;
      ctx.drawImage(valley, W / 2 - VALLEY.w * s / 2 - pan, hy - VALLEY.horizon * VALLEY.h * s, VALLEY.w * s, VALLEY.h * s);
    }

    /* -- the floor -- */
    const floorTone = mixTone(c(T.white), c(T.chalk), 0.55);
    fillPoly(ctx, cam, quadXZ(cam.ex - 120, cam.ex + 240, FLOOR_NEAR, FLOOR_FAR), ink(floorTone));
    // Joints between the big stone tiles: they run to the two vanishing points.
    ctx.lineWidth = 1; ctx.strokeStyle = ink(c(T.slate), 0.11);
    ctx.beginPath();
    const jx0 = Math.floor((cam.ex - 50) / 6) * 6;
    for (let x = jx0; x < cam.ex + 110; x += 6) trace(ctx, cam, [x - 0.03, 0, FLOOR_NEAR, x + 0.03, 0, FLOOR_NEAR, x + 0.03, 0, WALL_Z + 30, x - 0.03, 0, WALL_Z + 30]);
    for (let z = -24; z <= 42; z += 6) if (z < -3 || z > 3) trace(ctx, cam, [cam.ex - 60, 0, z - 0.03, cam.ex + 130, 0, z - 0.03, cam.ex + 130, 0, z + 0.03, cam.ex - 60, 0, z + 0.03]);
    ctx.fillStyle = ink(c(T.slate), 0.1); ctx.fill();

    /* -- the felt track, laid on the floor -- */
    const x0 = -5, x1 = course.length;
    const felt = mixTone(mixTone(c(T.tealDeep), c(T.slate), 0.45), c(T.white), 0.4), feltLight = mixTone(felt, c(T.white), 0.3);
    fillPoly(ctx, cam, quadXZ(x0 - 0.1, x1 + 0.1, -TRACK_HALF - 0.13, -TRACK_HALF + 0.1), ink(c(T.shadow), 0.2));
    fillPoly(ctx, cam, quadXZ(x0, x1, -TRACK_HALF, TRACK_HALF, 0.03), ink(felt));
    fillPoly(ctx, cam, quadXZ(x0, x1, -TRACK_HALF * 0.55, TRACK_HALF * 0.55, 0.03), ink(feltLight, 0.35));
    const stitch = mixTone(c(T.cream), c(T.white), 0.4);
    for (const z of [-TRACK_HALF + 0.14, TRACK_HALF - 0.2]) fillPoly(ctx, cam, quadXZ(x0, x1, z, z + 0.06, 0.035), ink(stitch, 0.9));
    ctx.beginPath();
    const d0 = Math.max(x0, Math.floor((cam.ex - 30) / 2) * 2);
    for (let x = d0; x < Math.min(x1, cam.ex + 70); x += 2) if (!course.hills.some(hill => x > hill.from - 1 && x < hill.from + hill.up + hill.flat)) trace(ctx, cam, quadXZ(x, x + 1, -0.055, 0.055, 0.035));
    ctx.fillStyle = ink(stitch, 0.92); ctx.fill();
    // The start line: a chequered band, as on any racetrack.
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) {
      const z = -TRACK_HALF + 0.2 + i * (TRACK_HALF * 2 - 0.4) / 8, x = course.start - 0.95 + j * 0.3;
      fillPoly(ctx, cam, quadXZ(x, x + 0.3, z, z + (TRACK_HALF * 2 - 0.4) / 8, 0.036), ink(stitch, 0.95));
    }
    // The knit rug road: stripes across the low line.
    for (const rug of course.rugs) {
      const za = -TRACK_HALF + 0.08, zb = rug.line === 'low' ? -0.06 : TRACK_HALF - 0.08;
      for (let x = rug.from, i = 0; x < rug.to; x += 0.5, i++) fillPoly(ctx, cam, quadXZ(x, Math.min(rug.to, x + 0.5), za, zb, 0.07), ink(i % 2 ? mixTone(c(T.cream), c(T.white), 0.3) : mixTone(c(T.clayLight), c(T.poppy), 0.25)));
      fillPoly(ctx, cam, quadXZ(rug.from, rug.to, za - 0.09, za + 0.02, 0.05), ink(c(T.amber)));
    }
    // Chevrons that point to the chosen line before the fork.
    if (course.fork) {
      const side = f.line === 'high' ? 1 : -1;
      for (let i = 0; i < 4; i++) {
        const x = course.fork.at - 7 + i * 1.6, z = side * LINE_Z * (0.25 + i * 0.25), glow = 0.55 + 0.45 * Math.sin(time * 5 - i * 0.9);
        fillPoly(ctx, cam, [x, 0.04, z - 0.42, x + 0.5, 0.04, z, x, 0.04, z + 0.42, x + 0.22, 0.04, z + 0.42, x + 0.72, 0.04, z, x + 0.22, 0.04, z - 0.42], ink(c(T.butter), 0.35 + glow * 0.5));
      }
    }
    // Kit pictures that lie flat: the arrow disc at the start, the signpost disc, the target rug at the goal.
    const flat = (s: KitSprite, x: number, z: number, turn: number, wide: number) => {
      const img = pics.get(s.src); if (!img) return null;
      ctx.save();
      const scale = onFloor(ctx, cam, x, z, 0.05);
      if (scale) { const k = wide / s.w; ctx.rotate(turn); ctx.scale(k, k); ctx.rotate(Math.PI / 2); ctx.drawImage(img, -s.footX, -s.footY); }
      ctx.restore();
      return scale ? project(cam, x, 0.05, z) : null;
    };
    flat(RUG_TOP, course.goal + 1.4, 0, 0, RUG_TOP.wide);
    flat(SIGN_TOP, course.start + 1.6, 2.6, 0, 1.5);
    if (course.fork) {
      const p = flat(SIGN_TOP, course.fork.at - 3.2, -2.6, f.signTurn, 1.9);
      if (p) this.hits.push({ id: 'signDisc', x: p.x, y: p.y, r: Math.max(34, p.scale * 1.1) });
    }

    /* -- the sun through the arches, on everything that lies on the floor -- */
    const light = this.drawLight(f);
    if (light) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(light, 0, 0, W, H); ctx.restore(); }
    // The polished stone picks up the bright arches.
    for (const a of scenery.arches) {
      const p = project(cam, a, 0, WALL_Z); if (!p || p.x < -W || p.x > 2 * W) continue;
      const pts = archPoints(a, WALL_Z).map((v, i) => (i % 3 === 1 ? -v * 0.5 : v));
      ctx.beginPath(); if (trace(ctx, cam, pts)) { const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.scale * 7); g.addColorStop(0, ink(c(T.skyPale), 0.3)); g.addColorStop(1, ink(c(T.skyPale), 0)); ctx.fillStyle = g; ctx.fill(); }
    }
    // Haze where the floor meets the far wall.
    const haze = ctx.createLinearGradient(0, hy, 0, hy + (H - hy) * 0.5);
    const hazeTone = mixTone(c(T.white), c(T.blossom), warm > 0.6 ? 0.45 : 0);
    haze.addColorStop(0, ink(hazeTone, 0.5)); haze.addColorStop(1, ink(hazeTone, 0));
    ctx.fillStyle = haze; ctx.fillRect(0, hy, W, (H - hy) * 0.5);

    /* -- the far side: the terrace wall, or the arcade -- */
    for (const zone of course.zones) {
      if (zone.kind === 'terrace') {
        const from = Math.max(zone.from, cam.ex - 90), to = Math.min(zone.to + 40, cam.ex + 160);
        if (to <= from) continue;
        const base = project(cam, cam.ex + 10, 0, PARAPET_Z), top = project(cam, cam.ex + 10, PARAPET_H, PARAPET_Z);
        if (base && top) {
          const face = ctx.createLinearGradient(0, top.y, 0, base.y);
          face.addColorStop(0, ink(mixTone(c(T.white), c(T.snowShade), 0.18))); face.addColorStop(1, ink(mixTone(c(T.white), c(T.snowShade), 0.6)));
          fillPoly(ctx, cam, [from, 0, PARAPET_Z, to, 0, PARAPET_Z, to, PARAPET_H, PARAPET_Z, from, PARAPET_H, PARAPET_Z], face);
          fillPoly(ctx, cam, [from, PARAPET_H * 0.8, PARAPET_Z, to, PARAPET_H * 0.8, PARAPET_Z, to, PARAPET_H * 0.88, PARAPET_Z, from, PARAPET_H * 0.88, PARAPET_Z], ink(c(T.teal), 0.8));
          fillPoly(ctx, cam, [from, PARAPET_H, PARAPET_Z, to, PARAPET_H, PARAPET_Z, to, PARAPET_H + 0.12, PARAPET_Z, from, PARAPET_H + 0.12, PARAPET_Z], ink(c(T.white)));
        }
      } else {
        const from = Math.max(zone.from, cam.ex - 110), to = Math.min(zone.to, cam.ex + 170);
        if (to <= from) continue;
        const mine = scenery.arches.filter(a => a > from - BAY && a < to + BAY && a - ARCH_HALF >= zone.from && a + ARCH_HALF <= zone.to);
        const base = project(cam, cam.ex + 8, 0, WALL_Z);
        const baseY = base ? base.y : hy + 20;
        const wallLit = mixTone(c(T.white), c(T.butter), warm * 0.35), wallShade = mixTone(mixTone(mixTone(c(T.white), c(T.snowShade), 0.78), c(T.steel), 0.16), c(T.lilac), warm * 0.16);
        // The thickness of the wall shows inside each arch: the sun catches it.
        ctx.beginPath(); trace(ctx, cam, [from, 0, WALL_Z + WALL_T, to, 0, WALL_Z + WALL_T, to, WALL_H, WALL_Z + WALL_T, from, WALL_H, WALL_Z + WALL_T]);
        for (const a of mine) trace(ctx, cam, archPoints(a, WALL_Z + WALL_T));
        ctx.fillStyle = ink(cam.fx > 0 ? wallLit : mixTone(wallLit, wallShade, 0.55)); ctx.fill('evenodd');
        ctx.beginPath(); trace(ctx, cam, [from, 0, WALL_Z, to, 0, WALL_Z, to, WALL_H, WALL_Z, from, WALL_H, WALL_Z]);
        for (const a of mine) trace(ctx, cam, archPoints(a, WALL_Z));
        const face = ctx.createLinearGradient(0, baseY - (baseY - hy + 60) * 4, 0, baseY);
        face.addColorStop(0, ink(mixTone(wallShade, c(T.steel), 0.3))); face.addColorStop(0.7, ink(wallShade)); face.addColorStop(1, ink(mixTone(wallShade, c(T.white), 0.55)));
        ctx.fillStyle = face; ctx.fill('evenodd');
        // A lit edge round each arch, and the wall's end where the terrace begins.
        ctx.lineWidth = 1.5; ctx.strokeStyle = ink(c(T.white), 0.8);
        for (const a of mine) { ctx.beginPath(); if (trace(ctx, cam, archPoints(a, WALL_Z))) ctx.stroke(); }
        if (zone.to < cam.ex + 170) fillPoly(ctx, cam, [zone.to, 0, WALL_Z, zone.to, 0, WALL_Z + WALL_T, zone.to, WALL_H, WALL_Z + WALL_T, zone.to, WALL_H, WALL_Z], ink(cam.ex > zone.to ? wallLit : mixTone(wallShade, c(T.steel), 0.2)));
        if (zone.from > cam.ex - 110) fillPoly(ctx, cam, [zone.from, 0, WALL_Z, zone.from, 0, WALL_Z + WALL_T, zone.from, WALL_H, WALL_Z + WALL_T, zone.from, WALL_H, WALL_Z], ink(cam.ex < zone.from ? wallLit : mixTone(wallShade, c(T.steel), 0.2)));
        // Ferns in white planters at the foot of each pier.
        const fern = this.fernSprite();
        if (fern) for (const x of scenery.piers) {
          if (x < zone.from + 1 || x > zone.to - 1) continue;
          const p = project(cam, x, 0, WALL_Z - 1.2); if (!p || p.x < -200 || p.x > W + 200) continue;
          const size = p.scale * 6.4;
          ctx.fillStyle = ink(c(T.shadow), 0.16); ctx.beginPath(); ctx.ellipse(p.x, p.y, size * 0.34, size * 0.045, 0, 0, Math.PI * 2); ctx.fill();
          ctx.drawImage(fern, p.x - size / 2, p.y - size * (290 / 300), size, size);
        }
      }
    }

    /* -- shafts of light from the arches to the floor -- */
    if (!f.reduced || f.shafts > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (const a of scenery.arches) {
        const top = project(cam, a, ARCH_SPRING + ARCH_HALF * 0.5, WALL_Z); if (!top || top.x < -W * 0.8 || top.x > W * 1.8) continue;
        const h1 = ARCH_SPRING + ARCH_HALF * 0.55, w1 = ARCH_HALF * 0.82;
        const pts = [a - w1, h1, WALL_Z, a + w1, h1, WALL_Z, a + w1 + sun.kx * h1, 0, WALL_Z - sun.kz * h1, a - w1 + sun.kx * h1, 0, WALL_Z - sun.kz * h1];
        const end = project(cam, a + sun.kx * h1, 0, Math.max(cam.ez + 1, WALL_Z - sun.kz * h1));
        ctx.beginPath();
        if (trace(ctx, cam, pts)) {
          const g = ctx.createLinearGradient(top.x, top.y, end ? end.x : top.x, end ? end.y : H);
          const strength = 0.14 + 0.34 * f.shafts;
          g.addColorStop(0, ink(mixTone(c(T.white), c(T.butter), 0.3 + warm * 0.4), strength)); g.addColorStop(1, ink(c(T.butter), strength * 0.25));
          ctx.fillStyle = g; ctx.fill();
        }
      }
      ctx.restore();
    }

    /* -- things that stand on the floor, far to near -- */
    type Item = { depth: number; draw: () => void };
    const items: Item[] = [];
    const depth = (x: number, z: number) => (x - cam.ex) * cam.fx + (z - cam.ez) * cam.fz;
    const shadowAt = (x: number, z: number, y: number, rx: number, rz: number, strength: number, under = false) => {
      // The shadow falls away from the sun; a thing in the air throws it further and softer.
      // (`under`: the soft dark straight below a flying thing, which is what tells the eye how high it is.)
      ctx.save();
      const scale = under ? onFloor(ctx, cam, x, z) : onFloor(ctx, cam, x + sun.kx * (y + 0.12), z - sun.kz * (y + 0.12) - rz * 0.25);
      if (scale) {
        ctx.scale(rx, rz);
        const g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1);
        g.addColorStop(0, ink(shadeTint, strength)); g.addColorStop(0.55, ink(shadeTint, strength * 0.7)); g.addColorStop(1, ink(shadeTint, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    };
    const stand = (s: KitSprite, x: number, y: number, z: number, o: { flip?: boolean; rot?: number; sx?: number; sy?: number; size?: number; alpha?: number; lit?: number; hue?: number } = {}) => {
      const img = o.hue ? pics.variant(s.src, o.hue) : pics.get(s.src), p = project(cam, x, y, z); if (!img || !p) return null;
      const widePx = s.wide * p.scale * (o.size ?? 1), k = widePx / s.w;
      if (p.x + widePx < -40 || p.x - widePx > W + 40) return p;
      const lit = o.lit ?? 1;
      ctx.save(); ctx.translate(p.x, p.y);
      if (o.rot) ctx.rotate(o.rot);
      ctx.scale((o.flip ? -1 : 1) * (o.sx ?? 1), o.sy ?? 1);
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.drawImage(img, -s.footX * k, -s.footY * k, s.w * k, s.h * k);
      if (lit < 0.98) { const dark = pics.shade(`${s.src}|${o.hue ?? 0}`, img, spriteShade, 0.24); if (dark) { ctx.globalAlpha = (o.alpha ?? 1) * (1 - lit); ctx.drawImage(dark, -s.footX * k, -s.footY * k, s.w * k, s.h * k); } }
      ctx.restore();
      return p;
    };
    const lit = (x: number, z: number, y = 0.5) => lightOn(course, scenery, sun, x, z, y);
    const breeze = (x: number) => gustAt(course, x).push;

    // Kit planters beside the calm stretches.
    for (const pot of scenery.pots) {
      const d = depth(pot.x, pot.z); if (d < NEAR + 0.3 || d > 70) continue;
      items.push({ depth: d, draw: () => { shadowAt(pot.x, pot.z, 0, 0.75, 0.45, 0.3); stand(PLANTERS[pot.kind], pot.x, 0, pot.z, { lit: lit(pot.x, pot.z, 1), rot: Math.sin(time * 1.1 + pot.x) * 0.012 }); } });
    }
    // Pennants: they hang in still air and stream the way the gust blows.
    const pennants = [c(T.poppy), c(T.amber), c(T.teal), mixTone(c(T.cream), c(T.white), 0.4)];
    for (const flag of scenery.flags) {
      const d = depth(flag.x, flag.z); if (d < NEAR + 0.3 || d > 60) continue;
      items.push({ depth: d, draw: () => {
        const foot = project(cam, flag.x, 0, flag.z), head = project(cam, flag.x, 2.5, flag.z); if (!foot || !head) return;
        if (foot.x < -120 || foot.x > W + 120) return;
        const push = course.gusts[flag.gust].push, dir = Math.sign(push), u = foot.scale, on = lit(flag.x, flag.z, 2);
        shadowAt(flag.x, flag.z, 0, 0.22, 0.14, 0.28);
        ctx.lineCap = 'round'; ctx.strokeStyle = ink(mixTone(c(T.woodLight), c(T.wood), 0.4)); ctx.lineWidth = Math.max(1.5, u * 0.07);
        ctx.beginPath(); ctx.moveTo(foot.x, foot.y); ctx.lineTo(head.x, head.y); ctx.stroke();
        ctx.fillStyle = ink(c(T.goldLight)); ctx.beginPath(); ctx.arc(head.x, head.y, Math.max(1.5, u * 0.07), 0, Math.PI * 2); ctx.fill();
        // The cloth: a tapering band that ripples along its length.
        const along = cam.rx * dir, len = u * 1.25, drop = u * 0.62, tone = mixTone(pennants[flag.tone], shadeTint, (1 - on) * 0.3);
        const pts: number[] = [], back: number[] = [];
        for (let i = 0; i <= 8; i++) {
          const t = i / 8, wave = f.reduced ? 0 : Math.sin(time * 11 - t * 7 + flag.x) * u * 0.07 * t;
          const x = head.x + along * len * t, y = head.y + u * 0.08 + wave + t * t * u * 0.1;
          pts.push(x, y); back.push(x, y + drop * (1 - t * 0.92) + wave * 0.5);
        }
        ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        for (let i = back.length - 2; i >= 0; i -= 2) ctx.lineTo(back[i], back[i + 1]);
        ctx.closePath();
        const g = ctx.createLinearGradient(head.x, 0, head.x + along * len, 0);
        g.addColorStop(0, ink(mixTone(tone, c(T.shadow), 0.14))); g.addColorStop(0.35, ink(mixTone(tone, c(T.white), 0.22))); g.addColorStop(0.7, ink(tone)); g.addColorStop(1, ink(mixTone(tone, c(T.white), 0.16)));
        ctx.fillStyle = g; ctx.fill();
      } });
    }
    // Pots of grass: every blade leans with the gust.
    for (const reed of scenery.reeds) {
      const d = depth(reed.x, reed.z); if (d < NEAR + 0.3 || d > 55) continue;
      items.push({ depth: d, draw: () => {
        const foot = project(cam, reed.x, 0, reed.z); if (!foot || foot.x < -100 || foot.x > W + 100) return;
        const u = foot.scale, push = course.gusts[reed.gust].push, on = lit(reed.x, reed.z, 0.8), bend = Math.sign(push) * cam.rx;
        shadowAt(reed.x, reed.z, 0, 0.42, 0.26, 0.3);
        ctx.lineCap = 'round';
        for (let i = 0; i < 11; i++) {
          const t = i / 10 - 0.5, tall = u * (0.95 + hash(reed.seed * 9 + i) * 0.75);
          const sway = f.reduced ? 0.6 : 0.62 + 0.38 * Math.sin(time * (5 + hash(i) * 3) + i + reed.x);
          const tipX = foot.x + t * u * 0.5 + bend * tall * 0.62 * sway, tipY = foot.y - u * 0.42 - tall * (1 - 0.2 * sway);
          const tone = mixTone(mixTone(c(T.leafDeep), c(T.leaf), hash(i * 3.1 + reed.seed)), c(T.spring), hash(i * 5.7) * 0.45);
          ctx.strokeStyle = ink(mixTone(tone, shadeTint, (1 - on) * 0.28)); ctx.lineWidth = Math.max(1.2, u * (0.06 - Math.abs(t) * 0.03));
          ctx.beginPath(); ctx.moveTo(foot.x + t * u * 0.36, foot.y - u * 0.4); ctx.quadraticCurveTo(foot.x + t * u * 0.5, foot.y - u * 0.4 - tall * 0.6, tipX, tipY); ctx.stroke();
        }
        const g = ctx.createLinearGradient(foot.x - u * 0.34, 0, foot.x + u * 0.34, 0);
        g.addColorStop(0, ink(mixTone(c(T.white), c(T.snowShade), 0.55))); g.addColorStop(0.45, ink(c(T.white))); g.addColorStop(1, ink(mixTone(c(T.white), c(T.snowShade), 0.75)));
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(foot.x - u * 0.34, foot.y - u * 0.44); ctx.lineTo(foot.x + u * 0.34, foot.y - u * 0.44); ctx.lineTo(foot.x + u * 0.26, foot.y - u * 0.02);
        ctx.quadraticCurveTo(foot.x, foot.y + u * 0.05, foot.x - u * 0.26, foot.y - u * 0.02); ctx.closePath(); ctx.fill();
        ctx.fillStyle = ink(c(T.teal), 0.8); ctx.fillRect(foot.x - u * 0.32, foot.y - u * 0.36, u * 0.64, Math.max(1, u * 0.04));
      } });
    }
    // The knit flowers: folded until Rover passes, then open.
    course.blooms.forEach((x, i) => {
      const z = 2.25 + (i % 2) * 0.55, d = depth(x, z); if (d < NEAR + 0.3 || d > 70) return;
      items.push({ depth: d, draw: () => {
        const open = f.blooms[i] ?? 0, pop = open > 0 && open < 1 ? Math.sin(open * Math.PI) : 0, sway = f.reduced ? 0 : Math.sin(time * 1.6 + x) * 0.025 + breeze(x) * 0.012 * Math.sin(time * 9 + x);
        shadowAt(x, z, 0, 0.5, 0.3, 0.3);
        const p = stand(open > 0.5 ? FLOWER_OPEN : FLOWER_FOLDED, x, 0, z, { hue: FLOWER_HUES[Math.floor(hash(x * 2.3 + course.seed * 0.01) * FLOWER_HUES.length)], lit: lit(x, z, 1.4), rot: sway, sx: 1 + pop * 0.18, sy: 1 + pop * 0.22 - (open > 0 && open < 0.5 ? 0.12 : 0) });
        if (p) this.hits.push({ id: `bloom${i}`, x: p.x, y: p.y - p.scale * 1.2, r: Math.max(28, p.scale * 0.8) });
      } });
    });
    // The big flower at the goal, the cushion behind it, and the wool balls.
    {
      const x = course.goal + 1.2, z = 3.1;
      items.push({ depth: depth(x, z), draw: () => {
        const open = f.goalBloom, pop = open > 0 && open < 1 ? Math.sin(open * Math.PI) : 0;
        shadowAt(x, z, 0, 1, 0.55, 0.32);
        const p = stand(open > 0.5 ? FLOWER_OPEN : FLOWER_FOLDED, x, 0, z, { size: 2.3, lit: lit(x, z, 2.4), rot: f.reduced ? 0 : Math.sin(time * 1.3) * 0.02, sx: 1 + pop * 0.2, sy: 1 + pop * 0.25 });
        if (p) this.hits.push({ id: 'goalFlower', x: p.x, y: p.y - p.scale * 2.4, r: Math.max(36, p.scale * 1.4) });
      } });
      const cx = course.cushion + 1.25;
      items.push({ depth: depth(cx, 0.4), draw: () => {
        shadowAt(cx, 0, 0, 1.5, 0.8, 0.3);
        const p = stand(CUSHION, cx, 0, 0, { lit: lit(cx, 0, 0.5), sx: 1 - f.cushion * 0.16, sy: 1 + f.cushion * 0.1, size: 1.15 });
        if (p) this.hits.push({ id: 'cushion', x: p.x, y: p.y - p.scale * 0.6, r: Math.max(34, p.scale * 1.2) });
      } });
    }
    for (const ball of f.balls) items.push({ depth: depth(ball.x, ball.z), draw: () => {
      const p = project(cam, ball.x, 0.34, ball.z); if (!p) return;
      shadowAt(ball.x, ball.z, 0, 0.42, 0.26, 0.34);
      const r = p.scale * 0.34, base = mixTone(c(T.bluebell), c(T.lilac), 0.4), on = lit(ball.x, ball.z, 0.4);
      const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
      g.addColorStop(0, ink(mixTone(base, c(T.white), 0.55))); g.addColorStop(0.6, ink(mixTone(base, shadeTint, (1 - on) * 0.25))); g.addColorStop(1, ink(mixTone(base, c(T.indigo), 0.45)));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      // Strands of wool wound round it; they turn as it rolls.
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.clip();
      ctx.translate(p.x, p.y); ctx.rotate(ball.x / 0.34);
      ctx.lineWidth = Math.max(1, r * 0.09);
      for (let i = 0; i < 7; i++) { ctx.strokeStyle = ink(i % 2 ? mixTone(base, c(T.white), 0.35) : mixTone(base, c(T.indigo), 0.25), 0.7); ctx.beginPath(); ctx.ellipse(0, (i - 3) * r * 0.24, r * 1.05, r * (0.3 + (i % 3) * 0.16), (i - 3) * 0.3, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      this.hits.push({ id: 'woolBall', x: p.x, y: p.y, r: Math.max(30, r * 1.6) });
    } });
    // Ramps and the plank: blocks of pale wood with a felt top.
    course.hills.forEach(hill => {
      const za = hill.line === 'high' ? 0.06 : -TRACK_HALF, zb = TRACK_HALF, end = hill.from + hill.up + hill.flat, top = hill.from + hill.up;
      const key = Math.max(depth(hill.from, zb), depth(end, zb), depth(hill.from, za), depth(end, za)) + 0.2;
      items.push({ depth: key, draw: () => {
        const on = lit((hill.from + end) / 2, 0, hill.height);
        const woodTop = mixTone(mixTone(c(T.woodLight), c(T.cream), 0.35), shadeTint, (1 - on) * 0.2), woodSide = mixTone(mixTone(c(T.wood), c(T.woodLight), 0.35), shadeTint, (1 - on) * 0.25), woodEnd = mixTone(c(T.wood), c(T.woodDark), 0.25);
        // A long soft shadow on the sun's far side.
        fillPoly(ctx, cam, [hill.from, 0.01, za, end, 0.01, za, end + sun.kx * hill.height, 0.01, za - sun.kz * hill.height, top + sun.kx * hill.height, 0.01, za - sun.kz * hill.height], ink(shadeTint, 0.26));
        fillPoly(ctx, cam, [hill.from, 0, zb, top, hill.height, zb, end, hill.height, zb, end, 0, zb], ink(woodEnd));
        fillPoly(ctx, cam, [hill.from, 0.03, za, top, hill.height, za, top, hill.height, zb, hill.from, 0.03, zb], ink(woodTop));
        if (hill.flat > 0) fillPoly(ctx, cam, [top, hill.height, za, end, hill.height, za, end, hill.height, zb, top, hill.height, zb], ink(mixTone(woodTop, c(T.white), 0.12)));
        // Two felt runners up the middle, so the wheels grip.
        for (const zc of [(za + zb) / 2 - 0.36, (za + zb) / 2 + 0.36]) {
          fillPoly(ctx, cam, [hill.from, 0.04, zc - 0.11, top, hill.height + 0.01, zc - 0.11, top, hill.height + 0.01, zc + 0.11, hill.from, 0.04, zc + 0.11], ink(felt, 0.9));
          if (hill.flat > 0) fillPoly(ctx, cam, [top, hill.height + 0.01, zc - 0.11, end, hill.height + 0.01, zc - 0.11, end, hill.height + 0.01, zc + 0.11, top, hill.height + 0.01, zc + 0.11], ink(felt, 0.9));
        }
        fillPoly(ctx, cam, [hill.from, 0, za, top, hill.height, za, end, hill.height, za, end, 0, za], ink(woodSide));
        // The grain of the side, and a bright top edge.
        ctx.strokeStyle = ink(c(T.woodDark), 0.16); ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) { const a = project(cam, hill.from + (end - hill.from) * i * 0.08, hill.height * i * 0.22, za), b = project(cam, end, hill.height * i * 0.22, za); if (a && b && hill.height * i * 0.22 < hill.height) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
        const e0 = project(cam, hill.from, 0.03, za), e1 = project(cam, top, hill.height, za), e2 = project(cam, end, hill.height, za);
        if (e0 && e1 && e2) { ctx.strokeStyle = ink(c(T.white), 0.55); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.stroke(); }
        if (cam.ex > end - 0.5) fillPoly(ctx, cam, [end, 0, za, end, hill.height, za, end, hill.height, zb, end, 0, zb], ink(mixTone(woodEnd, c(T.woodDark), 0.2)));
      } });
    });
    // Pep.
    if (f.pep.show) items.push({ depth: depth(f.pep.x, f.pep.z), draw: () => {
      const s = f.pep.pose === 'sit' ? PEP_SIT : f.pep.pose === 'bow' ? PEP_BOW : PEP_SIDE;
      shadowAt(f.pep.x, f.pep.z, f.pep.y, 1.15, 0.6, 0.34 / (1 + f.pep.y));
      const p = stand(s, f.pep.x, f.pep.y, f.pep.z, { flip: f.pep.flip, sx: f.pep.sx, sy: f.pep.sy, lit: lit(f.pep.x, f.pep.z, 1.2) });
      if (p) this.hits.push({ id: 'pepDog', x: p.x, y: p.y - p.scale * 1.1, r: Math.max(40, p.scale * 1.1) });
    } });
    // Rover, its shadow, its key.
    items.push({ depth: depth(f.rover.x, f.rover.z), draw: () => this.drawRover(ctx, f, shadowAt) });
    items.sort((a, b) => b.depth - a.depth);
    for (const item of items) item.draw();

    /* -- the air -- */
    this.drawFx(ctx, f);
    // Speed: thin bright lines that run with the track.
    if (f.speed > 0.05 && !f.reduced) {
      const dirX = cam.rx, dirY = cam.ux * -1, norm = Math.hypot(dirX, dirY) || 1;
      ctx.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        const seed = hash(i * 13.7), y = H * (0.12 + hash(i * 3.1) * 0.86), phase = (time * (1.6 + seed) + seed * 9) % 1;
        const len = W * (0.1 + seed * 0.16) * f.speed, x = W * (1.15 - phase * 1.5);
        ctx.strokeStyle = ink(c(T.white), (0.1 + 0.3 * seed) * f.speed * Math.sin(phase * Math.PI)); ctx.lineWidth = 1 + seed * 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dirX / norm * len, y + dirY / norm * len); ctx.stroke();
      }
    }
    if (f.flash > 0) { ctx.fillStyle = ink(c(T.white), Math.min(1, f.flash)); ctx.fillRect(0, 0, W, H); }
    if (f.fade > 0) { ctx.fillStyle = ink(mixTone(c(T.white), c(T.chalk), 0.4), Math.min(1, f.fade)); ctx.fillRect(0, 0, W, H); }
  }

  private drawRover(ctx: CanvasRenderingContext2D, f: Frame, shadowAt: (x: number, z: number, y: number, rx: number, rz: number, strength: number, under?: boolean) => void) {
    const { cam, rover, time } = f, c = (token: string) => this.c(token);
    const s = rover.rear ? ROVER_REAR : ROVER_FRONT, img = this.pictures.get(s.src);
    const p = project(cam, rover.x, rover.y, rover.z); if (!p) return;
    // On the floor the shadow hugs the wheels; in the air it slides away and thins.
    shadowAt(rover.x, rover.z, rover.y, 0.78, 0.5, 0.5 / (1 + rover.y * 0.9));
    if (rover.y > 0.08) shadowAt(rover.x, rover.z, 0, 0.7 + rover.y * 0.12, 0.42 + rover.y * 0.08, 0.34 / (1 + rover.y * 0.35), true);
    if (rover.y < 0.05) shadowAt(rover.x - f.sun.kx * 0.1, rover.z + f.sun.kz * 0.1 + 0.12, 0, 0.66, 0.34, 0.62);
    // The secret ribbon trails behind.
    if (f.ribbon && f.ribbon.length > 2) {
      const tones = [c(T.poppy), c(T.amber), c(T.sun), c(T.leaf), c(T.sea), c(T.violet)];
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      tones.forEach((tone, band) => {
        ctx.beginPath(); let on = false;
        f.ribbon!.forEach((pt, i) => { const q = project(cam, pt.x, pt.y + 0.2 + band * 0.07, pt.z); if (!q) return; if (on) ctx.lineTo(q.x, q.y); else { ctx.moveTo(q.x, q.y); on = true; } if (i === 0) ctx.lineWidth = Math.max(1.5, q.scale * 0.07); });
        ctx.strokeStyle = ink(tone, 0.62); ctx.stroke();
      });
    }
    if (!img) return;
    const u = p.scale, widePx = s.wide * u, k = widePx / s.w, sign = rover.flip ? -1 : 1;
    const lit = lightOn(f.course, f.scenery, f.sun, rover.x, rover.z, rover.y + 0.4);
    const jitter = rover.tremble ? Math.sin(time * 71) * rover.tremble : 0;
    ctx.save();
    ctx.translate(p.x + jitter, p.y + (rover.tremble ? Math.cos(time * 53) * rover.tremble * 0.5 : 0));
    // The body tips about the wheels: nose up for a climb, nose down to lean into the wind.
    ctx.rotate(-(rover.pitch - rover.lean * 0.14) * (cam.rx >= 0 ? 1 : -1) * Math.max(0.5, Math.abs(cam.rx)));
    ctx.scale(sign * rover.sx, rover.sy);
    ctx.drawImage(img, -s.footX * k, -s.footY * k, s.w * k, s.h * k);
    if (lit < 0.98) { const dark = this.pictures.shade(`${s.src}|0`, img, mixTone(c(T.slate), c(T.bluebell), 0.35), 0.24); if (dark) { ctx.globalAlpha = 1 - lit; ctx.drawImage(dark, -s.footX * k, -s.footY * k, s.w * k, s.h * k); ctx.globalAlpha = 1; } }
    // In the slow moment the sunbeam catches the whole shell.
    if (f.shafts > 0.05) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.1 * f.shafts * lit; ctx.drawImage(img, -s.footX * k, -s.footY * k, s.w * k, s.h * k); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    // The hubs turn: three soft spokes of shade on each wheel face, lost in a blur at speed.
    if (rover.roll < 0.95) for (const [wx, wy, rx, ry] of ROVER_MARKS.wheels) {
      ctx.save(); ctx.translate((wx - s.footX) * k, (wy - s.footY) * k); ctx.scale(rx * k, ry * k); ctx.rotate(rover.wheel * (rover.rear ? -1 : 1));
      ctx.fillStyle = ink(c(T.woodDark), 0.13 * (1 - rover.roll));
      for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.moveTo(0.16, -0.07); ctx.lineTo(0.92, -0.2); ctx.arc(0, 0, 0.94, -0.21, 0.21); ctx.lineTo(0.16, 0.07); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    // Its lamps glow brighter the tighter the spring.
    if (!rover.rear) {
      ctx.globalCompositeOperation = 'lighter';
      for (const [ex, ey, er] of ROVER_MARKS.eyes) {
        const x = (ex - s.footX) * k, y = (ey - s.footY) * k, r = er * k * (1.5 + rover.glow * 1.6 + (f.reduced ? 0 : Math.sin(time * 3) * 0.1));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, ink(c(T.sun), 0.25 + rover.glow * 0.5)); g.addColorStop(1, ink(c(T.amber), 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // The brass key on the start button.
    ctx.translate((ROVER_MARKS.buttonX - s.footX) * k, (ROVER_MARKS.buttonY - s.footY) * k);
    this.drawKey(ctx, u, rover.keyAngle, rover.keySpin, rover.tight, lit);
    ctx.restore();
    const top = project(cam, rover.x, rover.y + 0.62, rover.z);
    if (top) this.hits.push({ id: 'roverCar', x: p.x, y: (p.y + top.y) / 2, r: Math.max(44, u * 0.7) });
  }

  /** The wind-up key: a brass stem with a coil round it and a two-eyed bow that turns about the stem. Drawn at the button, y up negative, in pixels (`u` per unit). */
  private drawKey(ctx: CanvasRenderingContext2D, u: number, angle: number, spin: number, tight: number, lit: number) {
    const c = (token: string) => this.c(token);
    const gold = mixTone(c(T.gold), c(T.shadow), (1 - lit) * 0.18), light = c(T.goldLight), deep = c(T.goldDeep);
    const stemH = u * 0.34, stemW = Math.max(2, u * 0.05), bowY = -stemH - u * 0.17, ring = u * 0.155;
    // The coil: more turns, packed tighter, as it is wound.
    const turns = 3 + tight * 4, coilW = u * (0.12 - tight * 0.03), coilTop = -stemH + u * 0.02 + tight * u * 0.08;
    ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.2, u * 0.024);
    const steps = Math.round(turns * 14);
    const coil = (i: number) => { const t = i / steps, a = t * turns * Math.PI * 2 + angle; return { x: Math.cos(a) * coilW, y: coilTop * (1 - t) - u * 0.01 * t + Math.sin(a) * coilW * 0.28, front: Math.sin(a) > 0 }; };
    const strands = (front: boolean) => {
      ctx.strokeStyle = ink(front ? light : deep, 0.95); ctx.beginPath();
      for (let i = 1; i <= steps; i++) { const a = coil(i - 1), b = coil(i); if (b.front === front) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } }
      ctx.stroke();
    };
    strands(false);
    const stem = ctx.createLinearGradient(-stemW, 0, stemW, 0);
    stem.addColorStop(0, ink(deep)); stem.addColorStop(0.4, ink(light)); stem.addColorStop(1, ink(gold));
    ctx.fillStyle = stem; ctx.fillRect(-stemW / 2, -stemH - u * 0.04, stemW, stemH + u * 0.04);
    strands(true);
    // The bow turns about the stem: seen from the side it narrows to its edge and opens again.
    const turn = Math.cos(angle), wide = Math.max(0.14, Math.abs(turn));
    if (spin > 0.25) {
      // Spinning back as the spring lets go: a brass blur.
      ctx.fillStyle = ink(light, 0.3 + 0.2 * spin); ctx.beginPath(); ctx.ellipse(0, bowY, ring * 2.1, ring * 1.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ink(gold, 0.5); ctx.lineWidth = Math.max(1, u * 0.02); ctx.stroke();
    }
    ctx.save(); ctx.translate(0, bowY); ctx.scale(wide, 1);
    const g = ctx.createLinearGradient(-ring * 2, -ring, ring * 2, ring);
    const near = turn >= 0 ? light : gold, far = turn >= 0 ? gold : light;
    g.addColorStop(0, ink(mixTone(near, c(T.white), 0.35))); g.addColorStop(0.45, ink(near)); g.addColorStop(0.55, ink(far)); g.addColorStop(1, ink(deep));
    ctx.fillStyle = g; ctx.globalAlpha = spin > 0.25 ? 0.55 : 1;
    ctx.beginPath();
    for (const side of [-1, 1]) { ctx.moveTo(side * ring * 1.02 + ring, 0); ctx.arc(side * ring * 1.02, 0, ring, 0, Math.PI * 2); }
    for (const side of [-1, 1]) { ctx.moveTo(side * ring * 1.02 + ring * 0.52, 0); ctx.arc(side * ring * 1.02, 0, ring * 0.52, 0, Math.PI * 2, true); }
    ctx.fill('evenodd');
    ctx.strokeStyle = ink(c(T.white), 0.75); ctx.lineWidth = Math.max(1, u * 0.018) / wide;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * ring * 1.02, 0, ring * 0.82, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke(); }
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.fillStyle = ink(gold); ctx.beginPath(); ctx.arc(0, bowY, Math.max(2, u * 0.045), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ink(c(T.white), 0.8); ctx.beginPath(); ctx.arc(-u * 0.012, bowY - u * 0.012, Math.max(1, u * 0.016), 0, Math.PI * 2); ctx.fill();
  }

  private drawFx(ctx: CanvasRenderingContext2D, f: Frame) {
    const { cam } = f, c = (token: string) => this.c(token), W = f.width;
    const dustTone = mixTone(c(T.white), c(T.linen), 0.35);
    for (const m of f.fx.list) {
      const p = project(cam, m.x, m.y, m.z); if (!p || p.x < -60 || p.x > W + 60) continue;
      const t = m.age / m.life, u = p.scale;
      if (m.kind === 0) {
        const r = Math.max(2, m.size * u), a = 0.5 * (1 - t) * (t < 0.1 ? t / 0.1 : 1);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, ink(dustTone, a)); g.addColorStop(1, ink(dustTone, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      } else if (m.kind === 1) {
        const s = PETALS[m.tone % PETALS.length], img = this.pictures.get(s.src); if (!img) continue;
        const wide = Math.max(5, m.size * u), k = wide / s.w;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(m.rot); ctx.scale(1, 0.45 + 0.55 * Math.abs(Math.cos(m.rot * 1.7)));
        ctx.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1; ctx.drawImage(img, -s.w * k / 2, -s.h * k / 2, s.w * k, s.h * k); ctx.restore();
      } else if (m.kind === 2) {
        const r = Math.max(2, m.size * u) * (0.6 + 0.4 * Math.sin(m.age * 16 + m.rot)), a = Math.sin(Math.min(1, t) * Math.PI);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(p.x, p.y); ctx.rotate(m.rot * 0.2);
        ctx.fillStyle = ink(mixTone(c(T.white), c(T.sun), 0.35), a);
        for (let i = 0; i < 2; i++) { ctx.rotate(Math.PI / 2 * i); ctx.beginPath(); ctx.moveTo(-r, 0); ctx.quadraticCurveTo(0, -r * 0.16, r, 0); ctx.quadraticCurveTo(0, r * 0.16, -r, 0); ctx.fill(); }
        ctx.restore();
      } else if (m.kind === 3) {
        const q = project(cam, m.x - Math.sign(m.vx) * m.size, m.y, m.z); if (!q) continue;
        ctx.strokeStyle = ink(c(T.white), 0.5 * Math.sin(t * Math.PI)); ctx.lineWidth = Math.max(1, u * 0.025); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo((p.x + q.x) / 2, (p.y + q.y) / 2 - u * 0.06, q.x, q.y); ctx.stroke();
      } else {
        ctx.fillStyle = ink(c(T.butter), 0.75 * Math.sin(t * Math.PI)); ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, u * 0.02), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}
