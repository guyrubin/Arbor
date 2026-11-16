/** Paints the woolly mammoth on a 2D canvas: the snow it stands on, its base
 * shapes, then thousands of strands part by part, back to front. Each strand
 * is a quadratic curve split in two: a darker, wider root half and a lighter,
 * thinner tip half, so every hair runs dark at the skin to sun-bleached at the
 * end. Rows paint bottom first, so each higher row of hair lies over the one
 * below, with a soft shadow pass under every row of guard hair: that overlap
 * is the depth. Colours come from the makers' palette (`--mk-*`), resolved
 * once from CSS and mixed here; there are no colour literals in this file. */
import { COLOUR_BINS, DETAIL_ZOOM, PARTS, TIER_WIDTH, TRUNK_SAMPLES, gustAt, trunkAngle, trunkHalfWidth, type Camera, type StrandSet, type Tier, type Vec } from './iceAgeFriendRules';
import { TRUNK_LENGTH, bezierAt, type Bezier, type MammothView } from './mammothShape';

export type RGB = readonly [number, number, number];
const PALETTE_KEYS = ['fur-dark', 'fur', 'fur-light', 'fur-tip', 'umber', 'rust', 'shadow', 'cream', 'paper-shade', 'sand', 'white', 'snow', 'snow-shade', 'chalk', 'sky-pale', 'storm', 'wood', 'wood-light', 'wood-dark', 'rose', 'clay', 'ink-soft'] as const;
export type PaletteKey = typeof PALETTE_KEYS[number];
export type Palette = Record<PaletteKey, RGB>;

function parseColour(value: string): RGB | null {
  const v = value.trim();
  if (v.startsWith('#') && (v.length === 7 || v.length === 4)) {
    const full = v.length === 4 ? v.slice(1).split('').map(c => c + c).join('') : v.slice(1);
    const n = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
    return n.some(Number.isNaN) ? null : [n[0], n[1], n[2]];
  }
  const m = v.match(/(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
/** Reads the makers' palette once from the page's CSS. */
export function readPalette(element: Element): Palette {
  const style = getComputedStyle(element);
  const neutral: RGB = [128, 128, 128];
  return Object.fromEntries(PALETTE_KEYS.map(key => [key, parseColour(style.getPropertyValue(`--mk-${key}`)) ?? neutral])) as Palette;
}
export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
/** A canvas colour string (with alpha) built from palette values. */
export function paint(c: RGB, alpha = 1): string {
  return `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}${alpha >= 1 ? '' : hex2(alpha * 255)}`;
}
/** Samples a ramp of colours at t (0..1). */
function ramp(stops: readonly RGB[], t: number): RGB {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

/** Strand colours per bin: roots from deep umber to warm rust, tips from
 * brown through rust to sun-bleached straw. */
export interface Inks { root: string[]; tip: string[]; under: string[]; underTip: string[]; shadow: string; highlight: string; sheen: string }
export function makeInks(p: Palette): Inks {
  const deep = mix(p['fur-dark'], p.shadow, 0.35);
  const roots: RGB[] = [deep, p['fur-dark'], mix(p['fur-dark'], p.fur, 0.6), p.fur, mix(p.fur, p.rust, 0.55)];
  const tips: RGB[] = [mix(p['fur-dark'], p.fur, 0.55), p.fur, mix(p.fur, p.rust, 0.7), p['fur-light'], mix(p['fur-light'], p['fur-tip'], 0.85)];
  const bins = Array.from({ length: COLOUR_BINS }, (_, i) => i / (COLOUR_BINS - 1));
  return {
    root: bins.map(t => paint(ramp(roots, t))),
    tip: bins.map(t => paint(ramp(tips, t))),
    under: bins.map(t => paint(ramp(roots, t * 0.7))),
    underTip: bins.map(t => paint(ramp(tips, t * 0.65))),
    shadow: paint(p.shadow, 0.26),
    highlight: paint(mix(p['fur-tip'], p.white, 0.35), 0.6),
    sheen: paint(mix(p['fur-tip'], p.white, 0.3), 0.78),
  };
}

/* ── affine transforms (canvas order: a b c d e f) ────────────────────── */

export type Affine = [number, number, number, number, number, number];
export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];
export function compose(m: Affine, n: Affine): Affine {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
export function translate(x: number, y: number): Affine { return [1, 0, 0, 1, x, y]; }
export function rotateAbout(p: Vec, angle: number): Affine {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c, s, -s, c, p[0] - c * p[0] + s * p[1], p[1] - s * p[0] - c * p[1]];
}
export function scaleAboutX(x: number, k: number): Affine { return [k, 0, 0, 1, x - k * x, 0]; }
export function apply(m: Affine, p: Vec): Vec { return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; }

/** Idle and finale motion, all small: weight shift, nod, ear flick, tail swish, trunk swing and lift, blink. */
export interface Pose { swayX: number; swayY: number; nod: number; ear: number; tail: number; swing: number; lift: number; blink: number; turn: number }
export const REST_POSE: Pose = { swayX: 0, swayY: 0, nod: 0, ear: 0, tail: 0, swing: 0, lift: 0, blink: 0, turn: 1 };

export interface PartFrames { body: Affine; head: Affine; ear: Affine; tail: Affine; legs: Affine }
/** The parts' transforms for a pose; in the turned view every turn is mirrored. */
export function partFrames(view: MammothView, pose: Pose): PartFrames {
  const m = view.mirror ? -1 : 1;
  const cx = (view.furBounds.minX + view.furBounds.maxX) / 2;
  const turn = scaleAboutX(cx, pose.turn);
  const body = compose(turn, translate(pose.swayX * m, pose.swayY));
  const head = compose(body, rotateAbout(view.pivots.neck, pose.nod * m));
  return { body, head, ear: compose(head, rotateAbout(view.pivots.ear, pose.ear * m)), tail: compose(body, rotateAbout(view.pivots.tail, pose.tail * m)), legs: turn };
}

/** The trunk's centre line for a pose, in head space: points, directions and half widths. */
export interface TrunkLine { x: Float32Array; y: Float32Array; a: Float32Array; hw: Float32Array }
export function trunkLine(view: MammothView, pose: Pose, out?: TrunkLine): TrunkLine {
  const n = TRUNK_SAMPLES;
  const line = out ?? { x: new Float32Array(n), y: new Float32Array(n), a: new Float32Array(n), hw: new Float32Array(n) };
  const k = view.trunkScale, step = (TRUNK_LENGTH * k) / (n - 1);
  let x = view.trunkBase[0], y = view.trunkBase[1];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const raw = trunkAngle(s, pose.lift, pose.swing);
    const a = view.mirror ? Math.PI - raw : raw;
    line.x[i] = x; line.y[i] = y; line.a[i] = a; line.hw[i] = trunkHalfWidth(s) * k;
    // The next point steps along the mean direction of this segment.
    const next = view.mirror ? Math.PI - trunkAngle(Math.min(1, s + 1 / (n - 1)), pose.lift, pose.swing) : trunkAngle(Math.min(1, s + 1 / (n - 1)), pose.lift, pose.swing);
    const mid = a + (next - a) / 2;
    x += Math.cos(mid) * step; y += Math.sin(mid) * step;
  }
  return line;
}
/** A point across the trunk at s (0..1) and t (-1..1), in head space, with its direction. */
export function trunkPoint(line: TrunkLine, s: number, t: number, mirror: boolean): [number, number, number] {
  const f = Math.max(0, Math.min(1, s)) * (TRUNK_SAMPLES - 1), i = Math.min(TRUNK_SAMPLES - 2, Math.floor(f)), k = f - i;
  const x = line.x[i] + (line.x[i + 1] - line.x[i]) * k, y = line.y[i] + (line.y[i + 1] - line.y[i]) * k;
  const a = line.a[i] + (line.a[i + 1] - line.a[i]) * k, hw = line.hw[i] + (line.hw[i + 1] - line.hw[i]) * k;
  const sign = mirror ? -1 : 1;
  return [x - Math.sin(a) * t * hw * sign, y + Math.cos(a) * t * hw * sign, a];
}

/** Per-strand motion state: the combed offset of each tip and its velocity. */
export interface Dynamics { ox: Float32Array; oy: Float32Array; vx: Float32Array; vy: Float32Array; active: Uint8Array; live: number[]; wx: Float32Array; wy: Float32Array }
export function makeDynamics(count: number): Dynamics {
  return { ox: new Float32Array(count), oy: new Float32Array(count), vx: new Float32Array(count), vy: new Float32Array(count), active: new Uint8Array(count), live: [], wx: new Float32Array(count), wy: new Float32Array(count) };
}

/* ── cached static paths per view ─────────────────────────────────────── */

interface Statics { shapes: Record<string, Path2D>; tuskNear: TuskPaths; tuskFar: TuskPaths; grass: { x: number; y: number; blades: { dx: number; h: number; lean: number; w: number }[] }[] }
interface TuskPaths { outline: Path2D; spine: Vec[]; from: Vec; to: Vec; widths: number[] }
const staticCache = new WeakMap<MammothView, Statics>();
function polyPath(poly: readonly Vec[]): Path2D {
  const path = new Path2D();
  poly.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  return path;
}
function tuskPaths(chain: readonly Bezier[], scale: number): TuskPaths {
  const spine: Vec[] = [];
  chain.forEach((b, j) => { for (let i = j ? 1 : 0; i <= 22; i++) spine.push(bezierAt(b, i / 22)); });
  const n = spine.length, widths: number[] = [], left: Vec[] = [], right: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const w = (13.5 * Math.pow(1 - s, 0.72) + 1.4) * scale;
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    widths.push(w); left.push([spine[i][0] + nx * w, spine[i][1] + ny * w]); right.push([spine[i][0] - nx * w, spine[i][1] - ny * w]);
  }
  const path = new Path2D();
  left.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  const tip = spine[n - 1], before = spine[n - 2];
  path.quadraticCurveTo(tip[0] + (tip[0] - before[0]) * 1.6, tip[1] + (tip[1] - before[1]) * 1.6, right[n - 1][0], right[n - 1][1]);
  for (let i = n - 1; i >= 0; i--) path.lineTo(right[i][0], right[i][1]);
  path.closePath();
  return { outline: path, spine, from: spine[0], to: tip, widths };
}
function statics(view: MammothView): Statics {
  const cached = staticCache.get(view); if (cached) return cached;
  const shapes: Record<string, Path2D> = {};
  for (const [key, poly] of Object.entries(view.shapes)) shapes[key] = polyPath(poly);
  // Dry steppe grass poking through the snow, a few tufts in front and behind.
  const spots: Vec[] = [[150, 646], [910, 634], [590, 676], [-70, 664], [1060, 652], [330, 708], [780, 700]];
  let seed = 7;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const grass = spots.map(([x, y]) => ({ x, y: y + (view.groundY - 615), blades: Array.from({ length: 6 + Math.floor(r() * 4) }, () => ({ dx: (r() - 0.5) * 34, h: 22 + r() * 30, lean: (r() - 0.5) * 0.7, w: 3 + r() * 2.5 })) }));
  const result = { shapes, tuskNear: tuskPaths(view.tusks.near, 1), tuskFar: tuskPaths(view.tusks.far, view.view === 'side' ? 0.94 : 0.9), grass };
  staticCache.set(view, result);
  return result;
}

/* ── the frame ────────────────────────────────────────────────────────── */

export interface Flake { x: number; y: number; r: number; speed: number; drift: number }
export interface Puff { x: number; y: number; born: number }
export interface FrameInput {
  ctx: CanvasRenderingContext2D;
  width: number; height: number; dpr: number;
  camera: Camera; baseScale: number;
  view: MammothView; strands: StrandSet; dyn: Dynamics; tier: Tier;
  time: number; wind: number; pose: Pose;
  palette: Palette; inks: Inks;
  flakes: readonly Flake[]; puffs: readonly Puff[];
}
export interface FrameOutput { frames: PartFrames; trunk: TrunkLine }

const trunkScratch = new WeakMap<MammothView, TrunkLine>();

export function drawFrame(input: FrameInput): FrameOutput {
  const { ctx, width, height, dpr, camera, baseScale, view, palette: p, pose } = input;
  const S = baseScale * camera.zoom;
  const world: Affine = [dpr * S, 0, 0, dpr * S, dpr * (width / 2 - camera.x * S), dpr * (height / 2 - camera.y * S)];
  const set = (m: Affine) => { const t = compose(world, m); ctx.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]); };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width * dpr, height * dpr);
  // The visible world, for skipping strands that are off screen.
  const view4 = { minX: camera.x - width / 2 / S - 140, maxX: camera.x + width / 2 / S + 140, minY: camera.y - height / 2 / S - 140, maxY: camera.y + height / 2 / S + 140 };
  const st = statics(view);
  const frames = partFrames(view, pose);
  const trunk = trunkLine(view, pose, trunkScratch.get(view));
  trunkScratch.set(view, trunk);

  drawGround(ctx, set, view, p, pose);

  const byPart = new Map(input.strands.parts.map(part => [part.part, part]));
  const none = { part: 'body' as const, start: 0, end: 0, rows: [] };
  for (const id of PARTS) {
    const part = byPart.get(id) ?? { ...none, part: id };
    switch (id) {
      case 'legFarHind': case 'legFarFront': case 'legHind': case 'legFront': {
        set(frames.legs);
        drawLegBase(ctx, st.shapes[id], view, id, p);
        drawStrands(input, part, view4, S, false, trunk, st.shapes[id]);
        drawToes(ctx, view, id, p);
        break;
      }
      // The far tusk sits behind the head and trunk but in front of the far legs.
      case 'tuskFar': set(frames.head); drawTusk(ctx, st.tuskFar, p, true); break;
      case 'tail': set(frames.tail); fillShape(ctx, st.shapes.tail, view, p, 'tail'); drawStrands(input, part, view4, S, false, trunk, st.shapes.tail); break;
      case 'body': set(frames.body); fillShape(ctx, st.shapes.body, view, p, 'body'); drawStrands(input, part, view4, S, false, trunk, st.shapes.body); break;
      case 'head': set(frames.head); fillShape(ctx, st.shapes.head, view, p, 'head'); drawStrands(input, part, view4, S, false, trunk, st.shapes.head); drawFace(ctx, view, p, pose); break;
      case 'ear': set(frames.ear); fillShape(ctx, st.shapes.ear, view, p, 'ear'); drawStrands(input, part, view4, S, false, trunk, st.shapes.ear); drawEarRim(ctx, st.shapes.ear, p); break;
      case 'trunk': set(frames.head); drawStrands(input, part, view4, S, true, trunk, drawTrunkBase(ctx, trunk, view, p)); drawTrunkTip(ctx, trunk, view, p); break;
      case 'tuskNear': set(frames.head); drawTusk(ctx, st.tuskNear, p, false); break;
      case 'sheath': set(frames.head); fillShape(ctx, st.shapes.sheath, view, p, 'sheath'); drawStrands(input, part, view4, S, false, trunk, st.shapes.sheath); break;
    }
  }

  set(IDENTITY);
  drawGrass(ctx, st.grass, p, input.time, input.wind);
  drawPuffs(ctx, input.puffs, p, input.time);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawFlakes(ctx, input.flakes, width, height, p);
  return { frames, trunk };
}

function drawGround(ctx: CanvasRenderingContext2D, set: (m: Affine) => void, view: MammothView, p: Palette, pose: Pose) {
  set(IDENTITY);
  const g = view.groundY;
  const ground = new Path2D();
  ground.moveTo(-3000, g - 30);
  for (let x = -3000; x <= 4000; x += 250) ground.quadraticCurveTo(x + 125, g - 34 + Math.sin(x * 0.013) * 9, x + 250, g - 26 + Math.sin((x + 250) * 0.008) * 6);
  ground.lineTo(4000, g + 4000); ground.lineTo(-3000, g + 4000); ground.closePath();
  const fill = ctx.createLinearGradient(0, g - 40, 0, g + 260);
  fill.addColorStop(0, paint(p.white)); fill.addColorStop(0.18, paint(p.snow)); fill.addColorStop(1, paint(mix(p['snow-shade'], p.chalk, 0.4)));
  ctx.fillStyle = fill; ctx.fill(ground);
  // A soft blue-grey shadow under the whole animal, darker under each foot.
  const feet = Object.values(view.feet), lo = Math.min(...feet.map(f => f.x0)), hi = Math.max(...feet.map(f => f.x1));
  const cx = (lo + hi) / 2 + pose.swayX * (view.mirror ? -1 : 1), rx = Math.max(40, (hi - lo) / 2 + 70);
  ctx.save(); ctx.translate(cx, g + 4); ctx.scale(1, 0.09);
  const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  shade.addColorStop(0, paint(mix(p.storm, p.shadow, 0.4), 0.42)); shade.addColorStop(0.6, paint(p.storm, 0.18)); shade.addColorStop(1, paint(p.storm, 0));
  ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = paint(mix(p.storm, p.shadow, 0.5), 0.3);
  for (const f of Object.values(view.feet)) { ctx.beginPath(); ctx.ellipse((f.x0 + f.x1) / 2, f.y + 1, (f.x1 - f.x0) / 2 + 10, 7, 0, 0, Math.PI * 2); ctx.fill(); }
}

const gradientCache = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient>>();
function gradient(ctx: CanvasRenderingContext2D, key: string, make: () => CanvasGradient): CanvasGradient {
  let map = gradientCache.get(ctx); if (!map) { map = new Map(); gradientCache.set(ctx, map); }
  let g = map.get(key); if (!g) { g = make(); map.set(key, g); }
  return g;
}
function fillShape(ctx: CanvasRenderingContext2D, path: Path2D, view: MammothView, p: Palette, which: 'body' | 'head' | 'ear' | 'tail' | 'sheath') {
  const b = view.furBounds;
  const fill = gradient(ctx, `${view.view}:${which}`, () => {
    const g = ctx.createLinearGradient(b.minX + (b.maxX - b.minX) * 0.15, b.minY, b.minX + (b.maxX - b.minX) * 0.7, b.maxY);
    const top = which === 'ear' ? mix(p['fur-dark'], p.shadow, 0.25) : mix(p.fur, p['fur-dark'], 0.35);
    g.addColorStop(0, paint(top)); g.addColorStop(0.5, paint(p['fur-dark'])); g.addColorStop(1, paint(mix(p['fur-dark'], p.shadow, 0.5)));
    return g;
  });
  ctx.fillStyle = fill; ctx.fill(path);
  if (which === 'ear') {
    // The inner fold of the small ear, a shade deeper.
    ctx.save(); ctx.clip(path);
    const e = view.shapes.ear, cx = e.reduce((s, q) => s + q[0], 0) / e.length, cy = e.reduce((s, q) => s + q[1], 0) / e.length;
    ctx.fillStyle = paint(mix(p['fur-dark'], p.shadow, 0.55), 0.8);
    ctx.beginPath(); ctx.ellipse(cx + (view.mirror ? -3 : 3), cy + 3, 9, 15, view.mirror ? -0.3 : 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
function drawLegBase(ctx: CanvasRenderingContext2D, path: Path2D, view: MammothView, leg: 'legFarHind' | 'legFarFront' | 'legHind' | 'legFront', p: Palette) {
  const far = leg === 'legFarHind' || leg === 'legFarFront';
  const f = view.feet[leg];
  const fill = gradient(ctx, `${view.view}:${leg}`, () => {
    const g = ctx.createLinearGradient(f.x0, f.y - 180, f.x1, f.y);
    const tone = far ? mix(p['fur-dark'], p.shadow, 0.45) : p['fur-dark'];
    g.addColorStop(0, paint(mix(tone, p.fur, far ? 0.1 : 0.3))); g.addColorStop(1, paint(mix(tone, p.shadow, 0.35)));
    return g;
  });
  ctx.fillStyle = fill; ctx.fill(path);
}
/** Broad round feet with a dusty sole and small pale toenails along the front. */
function drawToes(ctx: CanvasRenderingContext2D, view: MammothView, leg: 'legFarHind' | 'legFarFront' | 'legHind' | 'legFront', p: Palette) {
  const far = leg === 'legFarHind' || leg === 'legFarFront';
  const f = view.feet[leg], w = f.x1 - f.x0;
  ctx.fillStyle = paint(mix(mix(p.umber, p['paper-shade'], 0.3), p.shadow, far ? 0.4 : 0.1));
  ctx.beginPath(); ctx.ellipse((f.x0 + f.x1) / 2, f.y - 6, w / 2 + 3, 9, 0, 0, Math.PI * 2); ctx.fill();
  const nail = paint(mix(mix(p.sand, p.cream, 0.4), p.shadow, far ? 0.35 : 0));
  const rim = paint(mix(p.sand, p.umber, 0.45), far ? 0.5 : 0.8);
  const front = view.mirror ? 1 : -1;
  for (let i = 0; i < 3; i++) {
    const x = (f.x0 + f.x1) / 2 + front * w * (0.12 + i * 0.15), y = f.y - 7 + i * 0.6;
    ctx.fillStyle = rim; ctx.beginPath(); ctx.ellipse(x, y + 1, 7.4, 5.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = nail; ctx.beginPath(); ctx.ellipse(x - 0.6, y, 6.2, 4.6, 0, 0, Math.PI * 2); ctx.fill();
  }
}

/** A lit rim round the small ear, so it reads against the head's fur. */
function drawEarRim(ctx: CanvasRenderingContext2D, ear: Path2D, p: Palette) {
  ctx.save(); ctx.clip(ear);
  ctx.strokeStyle = paint(p['fur-tip'], 0.35); ctx.lineWidth = 5; ctx.stroke(ear);
  ctx.restore();
}

/** The eye (with its blink), a soft brow and the lower lip under the trunk. */
function drawFace(ctx: CanvasRenderingContext2D, view: MammothView, p: Palette, pose: Pose) {
  const [ex, ey] = view.eye, m = view.mirror ? -1 : 1, k = view.trunkScale;
  ctx.fillStyle = paint(p.shadow, 0.38);
  ctx.beginPath(); ctx.ellipse(ex, ey + 1, 12 * k, 9 * k, -0.15 * m, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = paint(mix(p.umber, p.shadow, 0.65));
  ctx.beginPath(); ctx.ellipse(ex, ey, 6.4 * k, 5.2 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = paint(mix(p.rust, p.umber, 0.5), 0.9);
  ctx.beginPath(); ctx.ellipse(ex + 0.6 * m, ey + 0.8, 3.6 * k, 3.2 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = paint(p.white, 0.9);
  ctx.beginPath(); ctx.arc(ex - 2.2 * m * k, ey - 2 * k, 1.7 * k, 0, Math.PI * 2); ctx.fill();
  if (pose.blink > 0) {
    ctx.fillStyle = paint(mix(p['fur-dark'], p.fur, 0.35));
    ctx.beginPath(); ctx.ellipse(ex, ey - 6 * k + 6 * k * pose.blink, 8 * k, 7 * k * pose.blink, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Lashes and a lit brow ridge above the eye.
  ctx.strokeStyle = paint(p.shadow, 0.75); ctx.lineWidth = 1.1; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { const x = ex + (-5 + i * 3.4) * m * k; ctx.moveTo(x, ey - 4.5 * k); ctx.lineTo(x - 2.5 * m, ey - 9 * k); }
  ctx.stroke();
  ctx.strokeStyle = paint(p['fur-tip'], 0.35); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(ex + 2 * m, ey + 6 * k, 15 * k, Math.PI * 1.15, Math.PI * 1.75); ctx.stroke();
}

function drawTrunkBase(ctx: CanvasRenderingContext2D, line: TrunkLine, view: MammothView, p: Palette): Path2D {
  const n = TRUNK_SAMPLES, sign = view.mirror ? -1 : 1;
  const path = new Path2D();
  const edge = (i: number, side: number): Vec => [line.x[i] - Math.sin(line.a[i]) * line.hw[i] * side * sign, line.y[i] + Math.cos(line.a[i]) * line.hw[i] * side * sign];
  // Start a little up inside the face so the trunk grows out of it.
  const back = 4 * view.trunkScale, a0 = line.a[0];
  const s0 = [line.x[0] - Math.cos(a0) * back, line.y[0] - Math.sin(a0) * back];
  const w0 = line.hw[0] * 0.8;
  path.moveTo(s0[0] - Math.sin(a0) * w0 * sign, s0[1] + Math.cos(a0) * w0 * sign);
  for (let i = 0; i < n; i++) { const [x, y] = edge(i, 1); path.lineTo(x, y); }
  const tip = [line.x[n - 1] + Math.cos(line.a[n - 1]) * line.hw[n - 1], line.y[n - 1] + Math.sin(line.a[n - 1]) * line.hw[n - 1]];
  const r = edge(n - 1, -1);
  path.quadraticCurveTo(tip[0], tip[1], r[0], r[1]);
  for (let i = n - 1; i >= 0; i--) { const [x, y] = edge(i, -1); path.lineTo(x, y); }
  path.lineTo(s0[0] + Math.sin(a0) * w0 * sign, s0[1] - Math.cos(a0) * w0 * sign);
  path.closePath();
  const g = ctx.createLinearGradient(line.x[0], line.y[0], line.x[n - 1], line.y[n - 1]);
  g.addColorStop(0, paint(mix(p['fur-dark'], p.fur, 0.25))); g.addColorStop(0.7, paint(mix(p['fur-dark'], p.umber, 0.5))); g.addColorStop(1, paint(mix(p.umber, p['paper-shade'], 0.18)));
  ctx.fillStyle = g; ctx.fill(path);
  // Soft folds across the skin, seen when close.
  ctx.save(); ctx.clip(path);
  ctx.strokeStyle = paint(mix(p['fur-dark'], p.shadow, 0.5), 0.45); ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 3; i < n - 1; i += 2) {
    const [ax, ay] = edge(i, 1), [bx, by] = edge(i, -1);
    const bow = 4 * view.trunkScale;
    ctx.moveTo(ax, ay); ctx.quadraticCurveTo(line.x[i] + Math.cos(line.a[i]) * bow, line.y[i] + Math.sin(line.a[i]) * bow, bx, by);
  }
  ctx.stroke();
  // Light catches the dorsal (front) edge.
  ctx.strokeStyle = paint(p['fur-light'], 0.22); ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const [x, y] = edge(i, 0.72); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke();
  ctx.restore();
  return path;
}
/** The trunk tip: a long finger on top and a broad lobe below. */
function drawTrunkTip(ctx: CanvasRenderingContext2D, line: TrunkLine, view: MammothView, p: Palette) {
  const n = TRUNK_SAMPLES, a = line.a[n - 1], hw = line.hw[n - 1], sign = view.mirror ? -1 : 1;
  const tx = Math.cos(a), ty = Math.sin(a), nx = -Math.sin(a) * sign, ny = Math.cos(a) * sign;
  const x = line.x[n - 1], y = line.y[n - 1];
  const skin = paint(mix(mix(p['fur-dark'], p.umber, 0.6), p.clay, 0.12)), dark = paint(mix(p.umber, p.shadow, 0.6));
  // Upper finger: long and narrow, on the dorsal side.
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(x + tx * hw * 0.85 + nx * hw * 0.42, y + ty * hw * 0.85 + ny * hw * 0.42, hw * 0.62, hw * 0.3, a, 0, Math.PI * 2); ctx.fill();
  // Lower lobe: short and wide.
  ctx.beginPath(); ctx.ellipse(x + tx * hw * 0.55 - nx * hw * 0.36, y + ty * hw * 0.55 - ny * hw * 0.36, hw * 0.42, hw * 0.5, a, 0, Math.PI * 2); ctx.fill();
  // The nostrils' shadow between them.
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.ellipse(x + tx * hw * 0.85, y + ty * hw * 0.85, hw * 0.22, hw * 0.18, a, 0, Math.PI * 2); ctx.fill();
}

function drawTusk(ctx: CanvasRenderingContext2D, tusk: TuskPaths, p: Palette, far: boolean) {
  const g = ctx.createLinearGradient(tusk.from[0], tusk.from[1], tusk.to[0], tusk.to[1]);
  g.addColorStop(0, paint(mix(p.sand, p.umber, 0.35))); g.addColorStop(0.22, paint(p.sand)); g.addColorStop(0.6, paint(p.cream)); g.addColorStop(1, paint(p.white));
  ctx.fillStyle = g; ctx.fill(tusk.outline);
  ctx.save(); ctx.clip(tusk.outline);
  // One side of the tusk faces the light all along it (chosen near the root), so the shading never crosses over.
  const q = Math.floor(tusk.spine.length / 5), qa = tusk.spine[q - 1], qb = tusk.spine[q + 1];
  const side = -(qb[1] - qa[1]) + (qb[0] - qa[0]) > 0 ? -1 : 1;
  const offset = (k: number) => {
    ctx.beginPath();
    tusk.spine.forEach(([x, y], i) => {
      const a = tusk.spine[Math.max(0, i - 1)], b = tusk.spine[Math.min(tusk.spine.length - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const m = Math.hypot(nx, ny) || 1; nx = (nx / m) * side; ny = (ny / m) * side;
      const w = tusk.widths[i] * k;
      if (i) ctx.lineTo(x + nx * w, y + ny * w); else ctx.moveTo(x + nx * w, y + ny * w);
    });
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  offset(-0.75); ctx.strokeStyle = paint(mix(p.umber, p.sand, 0.4), 0.38); ctx.lineWidth = 7; ctx.stroke();
  offset(0.45); ctx.strokeStyle = paint(p.white, 0.7); ctx.lineWidth = 2.6; ctx.stroke();
  // Faint growth lines near the root.
  ctx.strokeStyle = paint(p['paper-shade'], 0.35); ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 3; i < 10; i += 3) {
    const [x, y] = tusk.spine[i], a = tusk.spine[i - 1], b = tusk.spine[i + 1];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    const w = tusk.widths[i];
    ctx.moveTo(x + nx * w, y + ny * w); ctx.lineTo(x - nx * w, y - ny * w);
  }
  ctx.stroke();
  if (far) { ctx.fillStyle = paint(mix(p.storm, p.shadow, 0.3), 0.3); ctx.fill(tusk.outline); }
  ctx.restore();
}

/** Tips of dry grass bend with the same wind that moves the coat. */
function drawGrass(ctx: CanvasRenderingContext2D, tufts: Statics['grass'], p: Palette, time: number, wind: number) {
  const back = paint(mix(p.wood, p.umber, 0.25)), front = paint(mix(p['wood-light'], p.sand, 0.5)), tip = paint(mix(p.sand, p.cream, 0.4));
  for (const tuft of tufts) {
    const bend = gustAt(tuft.x, time, wind) * 9;
    tuft.blades.forEach((b, i) => {
      const x = tuft.x + b.dx, y = tuft.y;
      const tx = x + Math.sin(b.lean) * b.h + bend, ty = y - Math.cos(b.lean) * b.h;
      const g = ctx.createLinearGradient(x, y, tx, ty);
      g.addColorStop(0, back); g.addColorStop(0.55, i % 2 ? front : back); g.addColorStop(1, tip);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - b.w, y + 2);
      ctx.quadraticCurveTo(x - b.w * 0.3 + bend * 0.3, y - b.h * 0.55, tx, ty);
      ctx.quadraticCurveTo(x + b.w * 0.5 + bend * 0.3, y - b.h * 0.5, x + b.w, y + 2);
      ctx.closePath(); ctx.fill();
    });
  }
}
export const PUFF_SECONDS = 2.2;
function drawPuffs(ctx: CanvasRenderingContext2D, puffs: readonly Puff[], p: Palette, time: number) {
  for (const puff of puffs) {
    const age = (time - puff.born) / PUFF_SECONDS;
    if (age < 0 || age >= 1) continue;
    const r = 8 + 34 * Math.sqrt(age), alpha = 0.42 * (1 - age) * Math.min(1, age * 5);
    for (let k = 0; k < 3; k++) {
      const x = puff.x + (k - 1) * r * 0.45 + age * 26, y = puff.y - age * 38 - k * r * 0.2;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, paint(p.white, alpha)); g.addColorStop(1, paint(p.white, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
}
function drawFlakes(ctx: CanvasRenderingContext2D, flakes: readonly Flake[], width: number, height: number, p: Palette) {
  if (!flakes.length) return;
  const sizes: [number, number, string][] = [[0, 1.6, paint(p.white, 0.55)], [1.6, 2.4, paint(p.white, 0.75)], [2.4, 9, paint(p.white, 0.92)]];
  for (const [lo, hi, colour] of sizes) {
    ctx.fillStyle = colour; ctx.beginPath();
    for (const f of flakes) {
      if (f.r < lo || f.r >= hi) continue;
      const x = f.x * width, y = f.y * height;
      ctx.moveTo(x + f.r, y); ctx.arc(x, y, f.r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

/* ── strands ──────────────────────────────────────────────────────────── */

const scratch = { m: new Float32Array(0), q1: new Float32Array(0), q2: new Float32Array(0), p2: new Float32Array(0), on: new Uint8Array(0) };
function ensureScratch(n: number) {
  if (scratch.m.length >= n * 2) return;
  scratch.m = new Float32Array(n * 2); scratch.q1 = new Float32Array(n * 2); scratch.q2 = new Float32Array(n * 2); scratch.p2 = new Float32Array(n * 2); scratch.on = new Uint8Array(n);
}

function drawStrands(input: FrameInput, part: StrandSet['parts'][number], view4: { minX: number; maxX: number; minY: number; maxY: number }, S: number, isTrunk: boolean, trunk: TrunkLine, clip?: Path2D) {
  const { ctx, strands: s, dyn, time, wind, inks, tier, camera } = input;
  ensureScratch(s.count);
  const { m, q1, q2, p2, on } = scratch;
  const mirror = input.view.mirror;
  const detail = camera.zoom >= DETAIL_ZOOM;
  const widthK = TIER_WIDTH[tier] * (detail ? 1.18 : 1);
  // Never thinner than about half a screen pixel, so far-out hair does not vanish.
  const minW = 0.55 / S;
  // Compute every visible strand of the part once.
  for (const row of part.rows) {
    for (const group of row.groups) {
      const visible = isTrunk || !(group.maxX < view4.minX || group.minX > view4.maxX || group.maxY < view4.minY || group.minY > view4.maxY);
      for (let i = group.start; i < group.end; i++) {
        if (!visible) { on[i] = 0; continue; }
        let rx = s.rx[i], ry = s.ry[i], cx = s.cx[i], cy = s.cy[i], tx = s.tx[i], ty = s.ty[i];
        if (isTrunk) {
          const [x, y, a] = trunkPoint(trunk, rx, ry * 0.92, mirror);
          const c = Math.cos(a), sn = Math.sin(a), ly = mirror ? -1 : 1;
          const lcx = cx, lcy = cy * ly, ltx = tx, lty = ty * ly;
          cx = lcx * c - lcy * sn; cy = lcx * sn + lcy * c; tx = ltx * c - lty * sn; ty = ltx * sn + lty * c;
          rx = x; ry = y;
        } else if (rx < view4.minX || rx > view4.maxX || ry < view4.minY || ry > view4.maxY) { on[i] = 0; continue; }
        dyn.wx[i] = rx; dyn.wy[i] = ry;
        on[i] = 1;
        const len = s.len[i];
        const g = wind > 0 ? gustAt(rx, time, wind) : 0;
        const flutter = g > 0 ? Math.sin(time * 6.3 + s.phase[i]) * 0.07 * g * len : 0;
        const wx = g * len * 0.24 + flutter, wy = -0.05 * g * len + Math.abs(flutter) * 0.3;
        const ox = wx + dyn.ox[i], oy = wy + dyn.oy[i];
        const p1x = rx + cx + ox * 0.4, p1y = ry + cy + oy * 0.4;
        const p2x = rx + tx + ox, p2y = ry + ty + oy;
        const j = i * 2;
        m[j] = (rx + 2 * p1x + p2x) / 4; m[j + 1] = (ry + 2 * p1y + p2y) / 4;
        q1[j] = (rx + p1x) / 2; q1[j + 1] = (ry + p1y) / 2;
        q2[j] = (p1x + p2x) / 2; q2[j + 1] = (p1y + p2y) / 2;
        p2[j] = p2x; p2[j + 1] = p2y;
      }
    }
  }
  ctx.lineCap = 'round';
  for (const row of part.rows) {
    const guard = row.cls === 1;
    // The soft shadow a row of guard hair throws on the coat beneath it.
    if (guard) {
      ctx.beginPath();
      let any = false;
      for (let i = row.start; i < row.end; i++) {
        if (!on[i]) continue;
        const j = i * 2; any = true;
        ctx.moveTo(m[j] + 1.4, m[j + 1] + 2.6); ctx.quadraticCurveTo(q2[j] + 1.4, q2[j + 1] + 2.6, p2[j] + 1.4, p2[j + 1] + 2.6);
      }
      // A shadow falls on the coat, never on the sky: it is clipped to the part's own shape.
      if (any) { ctx.save(); if (clip) ctx.clip(clip); ctx.strokeStyle = inks.shadow; ctx.lineWidth = Math.max(minW, 2.6 * widthK); ctx.stroke(); ctx.restore(); }
    }
    for (const group of row.groups) {
      let any = false;
      ctx.beginPath();
      for (let i = group.start; i < group.end; i++) {
        if (!on[i]) continue;
        const j = i * 2; any = true;
        ctx.moveTo(dyn.wx[i], dyn.wy[i]); ctx.quadraticCurveTo(q1[j], q1[j + 1], m[j], m[j + 1]);
      }
      if (!any) continue;
      ctx.strokeStyle = guard ? inks.root[group.bin] : inks.under[group.bin];
      ctx.lineWidth = Math.max(minW, (guard ? 1.6 : 1.3) * widthK); ctx.stroke();
      ctx.beginPath();
      for (let i = group.start; i < group.end; i++) {
        if (!on[i]) continue;
        const j = i * 2;
        ctx.moveTo(m[j], m[j + 1]); ctx.quadraticCurveTo(q2[j], q2[j + 1], p2[j], p2[j + 1]);
      }
      ctx.strokeStyle = guard ? inks.tip[group.bin] : inks.underTip[group.bin];
      ctx.lineWidth = Math.max(minW, (guard ? 1.0 : 0.85) * widthK); ctx.stroke();
      // Freshly combed hair lies smooth and catches the light: the trail the finger leaves.
      if (dyn.live.length) {
        let sheen = false;
        ctx.beginPath();
        for (let i = group.start; i < group.end; i++) {
          if (!on[i] || !dyn.active[i] || Math.abs(dyn.ox[i]) + Math.abs(dyn.oy[i]) < s.len[i] * 0.2) continue;
          const j = i * 2; sheen = true;
          ctx.moveTo(q1[j], q1[j + 1]); ctx.quadraticCurveTo(m[j], m[j + 1], q2[j], q2[j + 1]); ctx.lineTo(p2[j], p2[j + 1]);
        }
        if (sheen) { ctx.strokeStyle = inks.sheen; ctx.lineWidth = Math.max(minW, (guard ? 0.9 : 0.7) * widthK); ctx.stroke(); }
      }
      // Close up, each guard hair catches the light along its upper edge.
      if (detail && guard && group.bin >= 2) {
        ctx.beginPath();
        for (let i = group.start; i < group.end; i++) {
          if (!on[i]) continue;
          const j = i * 2;
          ctx.moveTo(m[j] - 0.45, m[j + 1] - 0.5); ctx.quadraticCurveTo(q2[j] - 0.45, q2[j + 1] - 0.5, p2[j] - 0.3, p2[j + 1] - 0.35);
        }
        ctx.strokeStyle = inks.highlight; ctx.lineWidth = Math.max(minW, 0.42 * widthK); ctx.stroke();
      }
    }
  }
}
