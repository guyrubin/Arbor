/** Paints the woolly mammoth on a 2D canvas, over the rendered hall and
 * steppe pictures: its shadow, its base shapes, then thousands of strands
 * part by part, back to front, with the snow on its back, the light on the
 * glass and the loose things in the air. Each strand
 * is a quadratic curve split in two: a darker, wider root half and a lighter,
 * thinner tip half, so every hair runs dark at the skin to sun-bleached at the
 * end. Rows paint bottom first, so each higher row of hair lies over the one
 * below, with a soft shadow pass under every row of guard hair: that overlap
 * is the depth. Colours come from the makers' palette (`--mk-*`), resolved
 * once from CSS and mixed here; there are no colour literals in this file. */
import { COLOUR_BINS, PARTS, TIER_WIDTH, TRUNK_SAMPLES, gustAt, seeded, trunkAngle, trunkHalfWidth, type Camera, type StrandSet, type Tier, type Vec } from './iceAgeFriendRules';
import { TRUNK_LENGTH, bezierAt, type Bezier, type MammothView } from './mammothShape';
import type { SnowClump } from './mammothPlayRules';

export type RGB = readonly [number, number, number];
const PALETTE_KEYS = [
  'fur-dark', 'fur', 'fur-light', 'fur-tip', 'umber', 'rust', 'shadow', 'cream', 'paper-shade', 'sand', 'white', 'snow', 'snow-shade', 'chalk', 'sky-pale', 'storm-grey',
  'wood', 'wood-light', 'wood-dark', 'rose', 'clay', 'ink-soft', 'moss', 'teal-deep',
  // The Ice Age sky, from a gold afternoon to the aurora.
  'sky', 'water', 'sea', 'teal', 'celadon', 'spring', 'lilac', 'violet', 'plum', 'bluebell', 'indigo', 'indigo-deep', 'night', 'slate', 'orange', 'amber', 'sun', 'butter', 'blossom', 'rose-deep',
] as const;
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
export interface Inks { root: string[]; tip: string[]; under: string[]; underTip: string[]; wool: string; woolTip: string; shadow: string; highlight: string; sheen: string }
export function makeInks(p: Palette): Inks {
  const deep = mix(p['fur-dark'], p.shadow, 0.35);
  const roots: RGB[] = [deep, p['fur-dark'], mix(p['fur-dark'], p.fur, 0.6), p.fur, mix(p.fur, p.rust, 0.55)];
  // The tips are only a little lighter than the roots: the hour's light, laid over the whole coat, does the rest.
  const tips: RGB[] = [mix(p['fur-dark'], p.fur, 0.4), mix(p['fur-dark'], p.fur, 0.8), mix(p.fur, p.rust, 0.5), mix(p.fur, p['fur-light'], 0.6), mix(p['fur-light'], p['fur-tip'], 0.4)];
  const bins = Array.from({ length: COLOUR_BINS }, (_, i) => i / (COLOUR_BINS - 1));
  return {
    root: bins.map(t => paint(ramp(roots, t))),
    tip: bins.map(t => paint(ramp(tips, t))),
    under: bins.map(t => paint(ramp(roots, t * 0.7))),
    underTip: bins.map(t => paint(ramp(tips, t * 0.65))),
    // The woolly undercoat where the long hair is parted: pale, soft and dense.
    wool: paint(mix(p['fur-light'], p.sand, 0.45)), woolTip: paint(mix(p['fur-tip'], p.cream, 0.5)),
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

/** Idle life, mood and gestures, all small: weight shift and lean, nod, ear
 * flick, tail swish, trunk swing, lift and curl, the eyelid, the brow and the
 * jaw, a lifted foot, and the heavy step of the turn (hop, squash, face). */
export type LegId = 'legFront' | 'legHind' | 'legFarFront' | 'legFarHind';
export interface Pose {
  swayX: number; swayY: number; nod: number; ear: number; tail: number; swing: number; lift: number; curl: number;
  /** Eyelid 0 wide open .. 1 shut. */
  lid: number;
  /** Brow -1 soft .. 1 raised. */
  brow: number;
  /** Jaw 0 closed .. 1 open. */
  jaw: number;
  /** Width of the animal while it turns about (1 = side on). */
  turn: number;
  hop: number; squash: number;
  /** How far each foot is off the snow, in world units. */
  step: Record<LegId, number>;
  /** The slow breath, 0 out .. 1 in: the chest fills and the shoulders rise. */
  breath: number;
}
export const REST_POSE: Pose = { swayX: 0, swayY: 0, nod: 0, ear: 0, tail: 0, swing: 0, lift: 0, curl: 0, lid: 0.2, brow: 0, jaw: 0, turn: 1, hop: 0, squash: 0, step: { legFront: 0, legHind: 0, legFarFront: 0, legFarHind: 0 }, breath: 0 };

/** How much taller the body is at the top of a breath. */
export const BREATH_RISE = 0.022;
export interface PartFrames { body: Affine; head: Affine; ear: Affine; tail: Affine; legs: Record<LegId, Affine> }
/** The parts' transforms for a pose; facing right, every turn is mirrored. */
export function partFrames(view: MammothView, pose: Pose): PartFrames {
  const m = view.mirror ? -1 : 1;
  const cx = (view.furBounds.minX + view.furBounds.maxX) / 2, gy = view.groundY;
  // The whole animal: lifted by the hop, pressed toward the snow by the squash, closed by the turn.
  const ky = 1 - 0.06 * pose.squash;
  const base: Affine = [pose.turn, 0, 0, ky, cx - pose.turn * cx, gy - ky * gy - pose.hop];
  // The breath: the body fills from the belly up, so the hump and the shoulders rise and the feet stay planted.
  const belly = view.groundY - 96, by = 1 + BREATH_RISE * pose.breath;
  const body = compose(compose(base, translate(pose.swayX * m, pose.swayY)), [1 + BREATH_RISE * 0.3 * pose.breath, 0, 0, by, -BREATH_RISE * 0.3 * pose.breath * cx, belly - by * belly]);
  const head = compose(body, rotateAbout(view.pivots.neck, (pose.nod - 0.012 * pose.breath) * m));
  const leg = (id: LegId) => (pose.step[id] ? compose(base, translate(0, -pose.step[id])) : base);
  return {
    body, head, ear: compose(head, rotateAbout(view.pivots.ear, pose.ear * m)), tail: compose(body, rotateAbout(view.pivots.tail, pose.tail * m)),
    legs: { legFront: leg('legFront'), legHind: leg('legHind'), legFarFront: leg('legFarFront'), legFarHind: leg('legFarHind') },
  };
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
    const raw = trunkAngle(s, pose.lift, pose.swing, pose.curl);
    const a = view.mirror ? Math.PI - raw : raw;
    line.x[i] = x; line.y[i] = y; line.a[i] = a; line.hw[i] = trunkHalfWidth(s) * k;
    // The next point steps along the mean direction of this segment.
    const ahead = trunkAngle(Math.min(1, s + 1 / (n - 1)), pose.lift, pose.swing, pose.curl);
    const next = view.mirror ? Math.PI - ahead : ahead;
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

interface Statics { shapes: Record<string, Path2D>; tuskNear: TuskPaths; tuskFar: TuskPaths; snowTilt: number[] }
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
  // The lie of the snow at each spot: it follows the slope of the back.
  const snowTilt = view.snow.map((spot, i) => {
    const a = view.snow[i - 1]?.part === spot.part ? view.snow[i - 1].at : spot.at, b = view.snow[i + 1]?.part === spot.part ? view.snow[i + 1].at : spot.at;
    const tilt = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return tilt > Math.PI / 2 ? tilt - Math.PI : tilt < -Math.PI / 2 ? tilt + Math.PI : tilt;
  });
  const result = { shapes, tuskNear: tuskPaths(view.tusks.near, 1), tuskFar: tuskPaths(view.tusks.far, 0.94), snowTilt };
  staticCache.set(view, result);
  return result;
}

/* ── the frame ────────────────────────────────────────────────────────── */

export interface Flake { x: number; y: number; r: number; speed: number; drift: number }
export interface Puff { x: number; y: number; born: number; /** A great breath (the call, the sigh on the glass) is bigger. */ big?: number }
/** Loose snow in the air: brushed off the back, shaken out of the coat, knocked off by a heavy step. World units. */
export interface Mote { x: number; y: number; vx: number; vy: number; r: number; born: number; life: number; floor: number }
/** A patch of breath on the glass, where the trunk tip or a finger met it. World units. */
export interface Mist { x: number; y: number; r: number; born: number }
export const MIST_SECONDS = 3.2;
/** A plucked bunch of grass, carried by the child, flying to the trunk or held in its tip. World units. */
export interface Bundle { x: number; y: number; angle: number; size: number }
/** A tuft of steppe grass the child can pluck: where its roots are (world units), how much has grown back, when it was last rustled, and whether it is the one to try next. */
export interface Sheaf { x: number; y: number; size: number; grown: number; shaken: number; cue?: boolean }
/** How the hour lights the animal: where the light is (a unit vector on screen,
 * pointing at it), its colour and strength, the colour of the shadow side,
 * how far the whole animal sinks into the dark, and the snow's light from below. */
export interface Light { dir: Vec; key: RGB; keyAmount: number; shade: RGB; shadeAmount: number; ambient: RGB; ambientAmount: number; bounce: RGB; bounceAmount: number }
/** What the crew's tools draw on the picture while they are at work. */
export interface ToolMarks {
  /** RouteScope: how far along the near tusk the measure has come (0..1); `guide` shows the way still to go. */
  routeScope?: { k: number; guide: boolean } | null;
  /** WaitRing round the offered grass (world point), 0..1 full. */
  waitRing?: { at: Vec; k: number } | null;
  /** ProofLens: its round frame on the coat (world point, world radius) and how ready the picture is (0..1). */
  proofLens?: { at: Vec; r: number; ready: number } | null;
  /** ScoutCam: the finder (CSS px) and how far its lock has closed (0..1). */
  scoutCam?: { x: number; y: number; r: number; lock: number } | null;
  /** ViewCheck: the eye's height on its gauge (0 a child's .. 1 a calf's), and where the gauge stands (CSS px). */
  viewCheck?: { low: number; x: number; top: number; bottom: number } | null;
  /** The shutter's flash (0..1). */
  flash?: number;
}
/** The wall of glass, in world units. */
export interface Glass {
  panes: Path2D | null;
  /** The whole wall's box, for the light that lies across it. */
  box: { minX: number; minY: number; maxX: number; maxY: number };
  /** One great breath that whitens everything for a moment (0..1): the way through opens under it. */
  bloom: number;
  /** The frost, painted over the box (null once it has melted). */
  frost: CanvasImageSource | null;
}
/** One animal to paint: the mammoth, or the calf. */
export interface AnimalInput {
  view: MammothView; strands: StrandSet; dyn: Dynamics; tier: Tier; pose: Pose;
  /** Its place in the world: identity for the mammoth; smaller and to one side for the calf. */
  place: Affine;
  snow: readonly SnowClump[];
  tusks: boolean;
  /** Where the ProofLens looks (the animal's own space): inside it the undercoat shows pale where the long hair is parted. */
  lens: { x: number; y: number; r: number } | null;
  /** How solid it is (1 = fully there). */
  fade: number;
}
export interface FrameInput {
  ctx: CanvasRenderingContext2D;
  /** A second canvas of the same size: each animal is painted and lit there, then laid on the picture. */
  scratch: HTMLCanvasElement;
  width: number; height: number; dpr: number;
  camera: Camera; baseScale: number;
  /** Where the camera's centre sits on the stage, in CSS pixels. */
  anchor: Vec;
  animal: AnimalInput; calf: AnimalInput | null;
  time: number; wind: number;
  palette: Palette; inks: Inks; light: Light;
  /** The steppe behind the animals and in front of them. */
  back: (() => void) | null; front: (() => void) | null;
  /** The wall of glass, while the hall is between us and the Ice Age. */
  glass: Glass | null;
  flakes: readonly Flake[]; puffs: readonly Puff[]; mists: readonly Mist[]; motes: readonly Mote[];
  bundle: Bundle | null; tufts: readonly Sheaf[];
  marks: ToolMarks;
}
export interface FrameOutput { frames: PartFrames; trunk: TrunkLine; calfFrames: PartFrames | null }

const trunkScratch = new WeakMap<Dynamics, TrunkLine>();
const shownCount = new WeakMap<Dynamics, number>();
/** About how many hairs one frame may paint. */
const LOCK_BUDGET = 22000;
/** From this many device pixels to a world unit, single hairs show: they are painted thicker, with a highlight. */
const DETAIL_PX = 2.2;

export function drawFrame(input: FrameInput): FrameOutput {
  const { ctx, width, height, dpr, camera, baseScale, palette: p, anchor, glass } = input;
  const S = baseScale * camera.zoom;
  const world: Affine = [dpr * S, 0, 0, dpr * S, dpr * (anchor[0] - camera.x * S), dpr * (anchor[1] - camera.y * S)];
  const toWorld = () => ctx.setTransform(world[0], world[1], world[2], world[3], world[4], world[5]);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width * dpr, height * dpr);
  input.back?.();

  const main = drawAnimal(input, input.animal, world, S);
  const calf = input.calf ? drawAnimal(input, input.calf, world, S) : null;

  // What lies on the glass itself: the snow falling beyond it, the daylight across it, the frost, breath on it.
  // (The hall's picture lies over the canvas and hides all of this but what shows through its windows.)
  if (glass?.panes) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFlakes(ctx, input.flakes, width, height, p);
    toWorld();
    drawSheen(ctx, glass, p);
    if (glass.frost) { try { ctx.drawImage(glass.frost, glass.box.minX, glass.box.minY, glass.box.maxX - glass.box.minX, glass.box.maxY - glass.box.minY); } catch { /* not painted yet */ } }
    drawMists(ctx, input.mists, p, input.time);
    ctx.restore();
  }
  input.front?.();
  if (!glass) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawFlakes(ctx, input.flakes, width, height, p); }

  toWorld();
  for (const tuft of input.tufts) drawSheaf(ctx, tuft, p, input.time, S);
  if (input.bundle) drawBundle(ctx, input.bundle, p);
  drawPuffs(ctx, input.puffs, p, input.time);
  drawMotes(ctx, input.motes, p, input.time);

  /* the crew's tools at work */
  const marks = input.marks;
  if (marks.routeScope) {
    const m = compose(compose(world, input.animal.place), main.frames.head);
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    drawMeasure(ctx, statics(input.animal.view).tuskNear, p, marks.routeScope.k, S, marks.routeScope.guide, input.time);
  }
  toWorld();
  if (marks.waitRing) drawWaitRing(ctx, marks.waitRing, p, S);
  if (marks.proofLens) drawLens(ctx, marks.proofLens, p, S, input.time);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (marks.scoutCam) drawFinder(ctx, marks.scoutCam, p);
  if (marks.viewCheck) drawGauge(ctx, marks.viewCheck, p);
  // One great breath whitens everything: the way through the glass opens under it.
  if (glass && glass.bloom > 0.01) {
    const cx = width / 2, cy = height * 0.48, r = Math.hypot(width, height) * (0.2 + 0.6 * glass.bloom);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, paint(p.white, Math.min(1, glass.bloom * 1.4))); g.addColorStop(0.7, paint(p.snow, Math.min(1, glass.bloom * 1.15))); g.addColorStop(1, paint(p.snow, glass.bloom * glass.bloom));
    ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
  }
  if (marks.flash && marks.flash > 0.01) { ctx.fillStyle = paint(p.white, Math.min(1, marks.flash)); ctx.fillRect(0, 0, width, height); }
  return { frames: main.frames, trunk: main.trunk, calfFrames: calf?.frames ?? null };
}

/** Paints one animal on the scratch canvas (its shadow goes straight on the
 * picture), lights it there, and lays it on the picture. Lighting it apart is
 * what lets the light fall on the hair alone, never on the sky behind it. */
function drawAnimal(input: FrameInput, a: AnimalInput, world: Affine, S: number): { frames: PartFrames; trunk: TrunkLine } {
  const { ctx, width, height, dpr, camera, anchor, palette: p, light } = input;
  const { view, pose, place } = a;
  const animal = compose(world, place), SA = S * place[0];
  const st = statics(view), frames = partFrames(view, pose);
  const trunk = trunkLine(view, pose, trunkScratch.get(a.dyn));
  trunkScratch.set(a.dyn, trunk);
  if (a.fade <= 0.005) return { frames, trunk };
  // The visible part of the animal's own space, for skipping strands that are off screen.
  const left = camera.x - anchor[0] / S, right = camera.x + (width - anchor[0]) / S, top = camera.y - anchor[1] / S, bottom = camera.y + (height - anchor[1]) / S;
  const view4 = { minX: (left - place[4]) / place[0] - 140, maxX: (right - place[4]) / place[0] + 140, minY: (top - place[5]) / place[3] - 140, maxY: (bottom - place[5]) / place[3] + 140 };
  // Its box on the canvas (device px), with room for the longest hair and a lifted trunk.
  const b = view.bounds, pad = 150;
  const [x0, y0] = apply(animal, [b.minX - pad, b.minY - pad * 2.2]), [x1, y1] = apply(animal, [b.maxX + pad, b.maxY + pad * 0.4]);
  const bx = Math.max(0, Math.floor(Math.min(x0, x1))), by = Math.max(0, Math.floor(Math.min(y0, y1)));
  const bw = Math.min(Math.ceil(width * dpr), Math.ceil(Math.max(x0, x1))) - bx, bh = Math.min(Math.ceil(height * dpr), Math.ceil(Math.max(y0, y1))) - by;

  // Its shadow lies on the ground, under everything.
  ctx.setTransform(animal[0], animal[1], animal[2], animal[3], animal[4], animal[5]);
  ctx.globalAlpha = a.fade;
  drawShadow(ctx, view, p, pose, light);
  ctx.globalAlpha = 1;
  if (bw <= 0 || bh <= 0) return { frames, trunk };

  const sx = input.scratch.getContext('2d');
  if (!sx) return { frames, trunk };
  sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalAlpha = 1; sx.globalCompositeOperation = 'source-over';
  sx.clearRect(bx, by, bw, bh);
  const set = (m: Affine) => { const t = compose(animal, m); sx.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]); };
  // Seen close, each strand is a lock of two or three hairs: as many as the frame can afford, from how many strands the last frame showed.
  const shown = shownCount.get(a.dyn) ?? a.strands.count, locks = SA < 0.85 ? 1 : Math.max(1, Math.min(3, Math.floor(LOCK_BUDGET / Math.max(1, shown))));
  const hair: HairInput = { ctx: sx, strands: a.strands, dyn: a.dyn, time: input.time, wind: input.wind, inks: input.inks, tier: a.tier, detail: SA * dpr >= DETAIL_PX, mirror: view.mirror, lens: a.lens, locks };
  const byPart = new Map(a.strands.parts.map(part => [part.part, part]));
  const none = { part: 'body' as const, start: 0, end: 0, rows: [] };
  let trunkPath: Path2D | null = null;
  for (const id of PARTS) {
    const part = byPart.get(id) ?? { ...none, part: id };
    switch (id) {
      case 'legFarHind': case 'legFarFront': case 'legHind': case 'legFront': {
        set(frames.legs[id]);
        drawLegBase(sx, st.shapes[id], view, id, p);
        drawStrands(hair, part, view4, SA, false, trunk, st.shapes[id]);
        drawToes(sx, view, id, p);
        break;
      }
      // The far tusk sits behind the head and trunk but in front of the far legs.
      case 'tuskFar': if (a.tusks) { set(frames.head); drawTusk(sx, st.tuskFar, p, true); } break;
      case 'tail': set(frames.tail); fillShape(sx, st.shapes.tail, view, p, 'tail'); drawStrands(hair, part, view4, SA, false, trunk, st.shapes.tail); break;
      case 'body': set(frames.body); fillShape(sx, st.shapes.body, view, p, 'body'); drawStrands(hair, part, view4, SA, false, trunk, st.shapes.body); drawSnow(sx, view, st, a.snow, 'body', p); break;
      case 'head': set(frames.head); fillShape(sx, st.shapes.head, view, p, 'head'); drawStrands(hair, part, view4, SA, false, trunk, st.shapes.head); drawFace(sx, view, p, pose); drawSnow(sx, view, st, a.snow, 'head', p); break;
      case 'ear': set(frames.ear); fillShape(sx, st.shapes.ear, view, p, 'ear'); drawStrands(hair, part, view4, SA, false, trunk, st.shapes.ear); drawEarRim(sx, st.shapes.ear, p); break;
      case 'trunk': set(frames.head); trunkPath = drawTrunkBase(sx, trunk, view, p); drawStrands(hair, part, view4, SA, true, trunk, trunkPath); drawTrunkTip(sx, trunk, view, p); break;
      case 'tuskNear': if (a.tusks) { set(frames.head); drawTusk(sx, st.tuskNear, p, false); } break;
      case 'sheath': if (a.tusks) { set(frames.head); fillShape(sx, st.shapes.sheath, view, p, 'sheath'); drawStrands(hair, part, view4, SA, false, trunk, st.shapes.sheath); } break;
    }
  }
  let count = 0;
  for (let i = 0; i < a.strands.count; i++) count += scratch.on[i];
  shownCount.set(a.dyn, count);
  // The body's own roundness, then the hour's light: laid over the hair only.
  set(frames.body);
  drawVolume(sx, view, p);
  drawLight(sx, view, light, p);
  sx.globalCompositeOperation = 'source-over'; sx.globalAlpha = 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.max(0, Math.min(1, a.fade));
  ctx.drawImage(input.scratch, bx, by, bw, bh, bx, by, bw, bh);
  ctx.globalAlpha = 1;
  return { frames, trunk };
}

/* ── the hour's light on the coat ─────────────────────────────────────── */

interface Edge { ax: number; ay: number; bx: number; by: number; nx: number; ny: number }
const edgeCache = new WeakMap<MammothView, Edge[]>();
/** The animal's true outline: every edge of its parts that is not hidden inside another part, with the way it faces. */
function outlineEdges(view: MammothView): Edge[] {
  const cached = edgeCache.get(view); if (cached) return cached;
  const s = view.shapes, parts = [s.body, s.head, s.legFront, s.legHind, s.legFarFront, s.legFarHind, s.tail, s.ear], edges: Edge[] = [];
  const inside = (x: number, y: number, poly: readonly Vec[]) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit; }
    return hit;
  };
  for (const poly of parts) {
    let area = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) area += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
    const turn = area > 0 ? 1 : -1;
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length], len = Math.hypot(bx - ax, by - ay);
      if (len < 0.01) continue;
      const nx = ((by - ay) / len) * turn, ny = (-(bx - ax) / len) * turn, mx = (ax + bx) / 2 + nx * 8, my = (ay + by) / 2 + ny * 8;
      if (parts.some(other => other !== poly && inside(mx, my, other))) continue;
      edges.push({ ax, ay, bx, by, nx, ny });
    }
  }
  edgeCache.set(view, edges);
  return edges;
}
const lightPaths = new WeakMap<MammothView, Map<string, { lit: Path2D; dark: Path2D; under: Path2D }>>();
function drawLight(ctx: CanvasRenderingContext2D, view: MammothView, light: Light, p: Palette) {
  const b = view.furBounds, w = b.maxX - b.minX, h = b.maxY - b.minY, [lx, ly] = light.dir;
  const key = `${Math.round(lx * 12)}:${Math.round(ly * 12)}`;
  let map = lightPaths.get(view); if (!map) { map = new Map(); lightPaths.set(view, map); }
  let paths = map.get(key);
  if (!paths) {
    paths = { lit: new Path2D(), dark: new Path2D(), under: new Path2D() };
    for (const e of outlineEdges(view)) {
      const facing = e.nx * lx + e.ny * ly;
      const path = facing > 0.2 ? paths.lit : facing < -0.2 ? paths.dark : null;
      if (path) { path.moveTo(e.ax, e.ay); path.lineTo(e.bx, e.by); }
      if (e.ny > 0.55) { paths.under.moveTo(e.ax, e.ay); paths.under.lineTo(e.bx, e.by); }
    }
    map.set(key, paths);
  }
  ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const box = () => ctx.fillRect(b.minX - 420, b.minY - 420, w + 840, h + 620);
  // The hour's own colour over the whole animal: nothing at noon, deep blue at night.
  if (light.ambientAmount > 0.005) { ctx.fillStyle = paint(light.ambient, Math.min(0.85, light.ambientAmount)); box(); }
  // Across the animal: the end nearer the light warms, the far end cools.
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2, reach = Math.abs(lx) * w * 0.5 + Math.abs(ly) * h * 0.5;
  const across = ctx.createLinearGradient(cx + lx * reach, cy + ly * reach, cx - lx * reach, cy - ly * reach);
  across.addColorStop(0, paint(light.key, Math.min(0.6, light.keyAmount * 1.5))); across.addColorStop(0.45, paint(light.key, 0)); across.addColorStop(0.55, paint(light.shade, 0)); across.addColorStop(1, paint(light.shade, Math.min(0.7, light.shadeAmount * 2.6)));
  ctx.fillStyle = across; box();
  // The form shadow gathers along every edge that faces away; the light wraps every edge that faces it.
  for (const [wide, k] of [[150, 0.8], [96, 1], [52, 1.1], [22, 1.2]] as const) { ctx.strokeStyle = paint(light.shade, Math.min(0.5, light.shadeAmount * k)); ctx.lineWidth = wide; ctx.stroke(paths.dark); }
  for (const [wide, k] of [[104, 0.55], [60, 0.8], [30, 1.1], [12, 1.5]] as const) { ctx.strokeStyle = paint(light.key, Math.min(0.7, light.keyAmount * k)); ctx.lineWidth = wide; ctx.stroke(paths.lit); }
  // The snow throws a little light back up under the belly and the chin.
  if (light.bounceAmount > 0.005) for (const [wide, k] of [[34, 1], [14, 1.3]] as const) { ctx.strokeStyle = paint(light.bounce, Math.min(0.5, light.bounceAmount * k)); ctx.lineWidth = wide; ctx.stroke(paths.under); }
  ctx.globalCompositeOperation = 'source-over';
}

/** The long, soft shadow the animal throws on the snow, away from the light. Darker under each foot. */
function drawShadow(ctx: CanvasRenderingContext2D, view: MammothView, p: Palette, pose: Pose, light: Light) {
  const g = view.groundY;
  const feet = Object.values(view.feet), lo = Math.min(...feet.map(f => f.x0)), hi = Math.max(...feet.map(f => f.x1));
  // The lower the light, the longer the shadow and the further it reaches away from it.
  const low = Math.max(0, 1 + light.dir[1]), throwX = -light.dir[0] * (60 + 260 * low);
  const cx = (lo + hi) / 2 + pose.swayX * (view.mirror ? -1 : 1) + throwX * 0.5, rx = Math.max(40, (hi - lo) / 2 + 100 + Math.abs(throwX) * 0.5);
  // In the air for the turn, the shadow thins and narrows.
  const air = Math.max(0, Math.min(1, pose.hop / 16)), wide = 0.35 + 0.65 * pose.turn, k = 1 - 0.4 * air;
  const tone = mix(light.shade, p['ink-soft'], 0.25);
  ctx.save(); ctx.translate(cx, g + 3); ctx.scale(wide, 0.085);
  const shade = ctx.createRadialGradient(-throwX * 0.25, 0, 0, 0, 0, rx);
  shade.addColorStop(0, paint(tone, 0.5 * k)); shade.addColorStop(0.55, paint(tone, 0.27 * k)); shade.addColorStop(1, paint(tone, 0));
  ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const mid = (view.furBounds.minX + view.furBounds.maxX) / 2;
  for (const [id, f] of Object.entries(view.feet) as [LegId, { x0: number; x1: number; y: number }][]) {
    // A lifted foot's shadow shrinks under it.
    const up = Math.max(0, Math.min(1, (pose.step[id] + pose.hop) / 18)), s = (1 - 0.45 * up) * wide, rw = ((f.x1 - f.x0) / 2 + 14) * s;
    const x = mid + ((f.x0 + f.x1) / 2 - mid) * pose.turn;
    ctx.save(); ctx.translate(x, f.y + 1); ctx.scale(1, 0.2);
    const foot = ctx.createRadialGradient(0, 0, 0, 0, 0, rw);
    foot.addColorStop(0, paint(mix(tone, p.shadow, 0.5), 0.58 * k)); foot.addColorStop(0.7, paint(tone, 0.24 * k)); foot.addColorStop(1, paint(tone, 0));
    ctx.fillStyle = foot; ctx.beginPath(); ctx.arc(0, 0, rw, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

function drawVolume(ctx: CanvasRenderingContext2D, view: MammothView, p: Palette) {
  const b = view.furBounds, w = b.maxX - b.minX, h = b.maxY - b.minY;
  const before = ctx.globalCompositeOperation, alpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'source-atop';
  const under = ctx.createLinearGradient(0, b.minY + h * 0.46, 0, b.maxY);
  under.addColorStop(0, paint(p.shadow, 0)); under.addColorStop(0.5, paint(p.shadow, 0.2)); under.addColorStop(1, paint(p.shadow, 0.44));
  ctx.fillStyle = under; ctx.fillRect(b.minX - 120, b.minY + h * 0.46, w + 240, h * 0.6);
  const sky = ctx.createLinearGradient(0, b.minY - 20, 0, b.minY + h * 0.36);
  sky.addColorStop(0, paint(mix(p['sky-pale'], p.white, 0.4), 0.3)); sky.addColorStop(1, paint(p['sky-pale'], 0));
  ctx.fillStyle = sky; ctx.fillRect(b.minX - 120, b.minY - 40, w + 240, h * 0.36 + 40);
  // The far end of the animal falls a little into the room's shade; the end nearer the light stays warm.
  const along = ctx.createLinearGradient(b.minX, 0, b.maxX, 0);
  along.addColorStop(0, paint(p['fur-tip'], 0.07)); along.addColorStop(0.5, paint(p.shadow, 0)); along.addColorStop(1, paint(p.shadow, 0.2));
  ctx.fillStyle = along; ctx.fillRect(b.minX - 120, b.minY - 40, w + 240, h + 80);
  ctx.globalCompositeOperation = before; ctx.globalAlpha = alpha;
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
    // A mid tone of the coat itself, so what shows between the strands is deeper fur, not a hole.
    const top = which === 'ear' ? mix(p['fur-dark'], p.shadow, 0.25) : mix(p.fur, p['fur-dark'], 0.3);
    g.addColorStop(0, paint(top)); g.addColorStop(0.5, paint(mix(p['fur-dark'], p.fur, 0.4))); g.addColorStop(1, paint(mix(p['fur-dark'], p.shadow, 0.3)));
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
function drawLegBase(ctx: CanvasRenderingContext2D, path: Path2D, view: MammothView, leg: LegId, p: Palette) {
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
function drawToes(ctx: CanvasRenderingContext2D, view: MammothView, leg: LegId, p: Palette) {
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

/** The face: a dark, kind eye under a heavy lid that closes as the mammoth
 * settles, a soft brow that lifts when it is surprised, and the small pointed
 * lower lip behind the tusk, with a mouth line that turns up at its corner.
 * Drawn facing left in its own frame and flipped for the other side; only the
 * catchlight stays on the side the light comes from. */
function drawFace(ctx: CanvasRenderingContext2D, view: MammothView, p: Palette, pose: Pose) {
  const m = view.mirror ? -1 : 1;
  const lid = Math.max(0, Math.min(1, pose.lid)), brow = Math.max(-1, Math.min(1, pose.brow));
  const skin = mix(mix(p['fur-dark'], p.umber, 0.55), p.clay, 0.16), deep = mix(p.umber, p.shadow, 0.7);

  /* the mouth */
  ctx.save(); ctx.translate(view.mouth[0], view.mouth[1]); ctx.scale(m * 0.9, 0.82);
  const jaw = Math.max(0, Math.min(1, pose.jaw));
  // Inside, seen only while it chews or calls.
  if (jaw > 0.02) {
    ctx.fillStyle = paint(mix(deep, p.rose, 0.18));
    ctx.beginPath(); ctx.moveTo(-46, -3); ctx.quadraticCurveTo(-22, 7, 2, 0); ctx.lineTo(-4, 6 + 16 * jaw); ctx.quadraticCurveTo(-26, 14 + 20 * jaw, -44, 6 + 14 * jaw); ctx.closePath(); ctx.fill();
  }
  // The lower lip: a small pointed lip that hangs from the corner of the mouth.
  ctx.save(); ctx.rotate(-0.34 * jaw);
  const lipFill = ctx.createLinearGradient(-30, 0, -22, 24);
  lipFill.addColorStop(0, paint(mix(skin, p.clay, 0.18))); lipFill.addColorStop(1, paint(mix(skin, p.shadow, 0.45)));
  ctx.fillStyle = lipFill;
  ctx.beginPath(); ctx.moveTo(2, 0); ctx.quadraticCurveTo(-22, 8, -47, -2); ctx.quadraticCurveTo(-50, 12, -38, 19); ctx.quadraticCurveTo(-18, 25, -2, 14); ctx.quadraticCurveTo(4, 8, 2, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = paint(p['fur-tip'], 0.3); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-42, 3); ctx.quadraticCurveTo(-24, 11, -6, 6); ctx.stroke();
  ctx.restore();
  // The mouth line, turning up at the corner under the cheek.
  ctx.strokeStyle = paint(deep, 0.9); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-47, -3); ctx.quadraticCurveTo(-22, 7, 1, 0); ctx.quadraticCurveTo(7, -2.5, 9, -7.5); ctx.stroke();
  ctx.restore();

  /* the eye */
  const [ex, ey] = view.eye;
  // A little larger than life: a mammoth's eye is small, and this one has to be met.
  ctx.save(); ctx.translate(ex, ey); ctx.scale(m * 1.3, 1.3);
  // The socket: bare, creased skin round the eye, darker than the fur.
  const socket = ctx.createRadialGradient(0, 0, 4, 0, 0, 21);
  socket.addColorStop(0, paint(mix(skin, p.shadow, 0.5), 0.95)); socket.addColorStop(0.62, paint(mix(skin, p.shadow, 0.4), 0.7)); socket.addColorStop(1, paint(skin, 0));
  ctx.fillStyle = socket; ctx.beginPath(); ctx.ellipse(0.5, 0.5, 21, 15, -0.12, 0, Math.PI * 2); ctx.fill();
  // The eye's opening, an almond: inner corner toward the trunk, outer toward the ear.
  const almond = new Path2D();
  almond.moveTo(-11.5, 1.6); almond.bezierCurveTo(-7, -6.8, 5, -8.4, 11.5, -1); almond.bezierCurveTo(6, 6.4, -6, 7, -11.5, 1.6); almond.closePath();
  ctx.save(); ctx.clip(almond);
  ctx.fillStyle = paint(mix(p.umber, p.shadow, 0.55)); ctx.fillRect(-13, -10, 26, 20);
  // A warm brown iris with a dark pupil.
  const iris = ctx.createRadialGradient(-0.6, -0.4, 1.2, -0.3, -0.2, 7.4);
  iris.addColorStop(0, paint(deep)); iris.addColorStop(0.42, paint(deep)); iris.addColorStop(0.5, paint(mix(p.rust, p.umber, 0.35))); iris.addColorStop(0.86, paint(mix(p.wood, p.umber, 0.5))); iris.addColorStop(1, paint(mix(p.umber, p.shadow, 0.6)));
  ctx.fillStyle = iris; ctx.beginPath(); ctx.arc(-0.3, -0.2, 7.4, 0, Math.PI * 2); ctx.fill();
  // Light from the top left of the scene, whichever way the animal faces.
  ctx.fillStyle = paint(p.white, 0.95); ctx.beginPath(); ctx.arc(-2.7 * m, -3.1, 2.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = paint(p.white, 0.4); ctx.beginPath(); ctx.arc(2.4 * m, 2.4, 1.1, 0, Math.PI * 2); ctx.fill();
  // The upper lid comes down over it: heavy at rest, shut when it settles or blinks.
  const drop = -9 + 17.5 * lid;
  ctx.fillStyle = paint(mix(skin, p.shadow, 0.22));
  ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(14, -12); ctx.lineTo(14, -1 + 2 * lid); ctx.quadraticCurveTo(0, drop + 3.4 * (1 - lid) + 6 * lid, -14, 1.6); ctx.closePath(); ctx.fill();
  ctx.restore();
  // The lid's edge and three lashes at the outer corner.
  ctx.strokeStyle = paint(deep, 0.95); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  const edgeY = (t: number) => { const a = -11.5 + 23 * t, open = -8.2 * Math.sin(Math.PI * t) + 1.6 - 2.6 * t, shut = 6.6 * Math.sin(Math.PI * t) * 0.92 + 1.6 - 2.6 * t; return [a, open + (shut - open) * Math.min(1, lid * 1.02)] as const; };
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) { const [x, y] = edgeY(i / 10); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const t of [0.6, 0.76, 0.9]) { const [x, y] = edgeY(t); ctx.moveTo(x, y); ctx.lineTo(x + 3.2, y + (lid > 0.7 ? 3.6 : -3.6)); }
  ctx.stroke();
  // A pale lower lid, and the crease that folds above the eye.
  ctx.strokeStyle = paint(p['fur-tip'], 0.34); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-9.5, 5.6); ctx.quadraticCurveTo(0, 9.8, 10, 2.6); ctx.stroke();
  ctx.strokeStyle = paint(deep, 0.5); ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-12, -6.6); ctx.quadraticCurveTo(0, -13.4, 13, -5.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12.6, 1); ctx.lineTo(17.4, 2.4); ctx.moveTo(12.2, 3.6); ctx.lineTo(16, 6.4); ctx.stroke();
  // The brow: a soft, sunlit ridge that lifts with surprise and eases when content.
  ctx.rotate(-0.1 - 0.1 * brow);
  ctx.strokeStyle = paint(p['fur-tip'], 0.5); ctx.lineWidth = 4.2;
  ctx.beginPath(); ctx.moveTo(-14, -14.5 - 3.4 * brow); ctx.quadraticCurveTo(-1, -22 - 4.6 * brow, 15, -15.5 - 2.4 * brow); ctx.stroke();
  ctx.strokeStyle = paint(mix(p['fur-dark'], p.shadow, 0.5), 0.55); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-13, -11.6 - 3 * brow); ctx.quadraticCurveTo(-1, -18.4 - 4.2 * brow, 14.4, -12.4 - 2 * brow); ctx.stroke();
  ctx.restore();
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
  // Soft folds across the skin, closer together toward the tip, seen when close.
  ctx.save(); ctx.clip(path);
  ctx.strokeStyle = paint(mix(p['fur-dark'], p.shadow, 0.5), 0.45); ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 3; i < n - 1; i += i > n * 0.6 ? 1 : 2) {
    const [ax, ay] = edge(i, 1), [bx, by] = edge(i, -1);
    const bow = 4 * view.trunkScale;
    ctx.moveTo(ax, ay); ctx.quadraticCurveTo(line.x[i] + Math.cos(line.a[i]) * bow, line.y[i] + Math.sin(line.a[i]) * bow, bx, by);
  }
  ctx.stroke();
  // Light catches the dorsal (front) edge; the underside falls into shade.
  ctx.strokeStyle = paint(p['fur-light'], 0.24); ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const [x, y] = edge(i, 0.72); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke();
  ctx.strokeStyle = paint(p.shadow, 0.2); ctx.lineWidth = 7;
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const [x, y] = edge(i, -0.8); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke();
  ctx.restore();
  return path;
}
/** The trunk tip: a long finger on top and a broad lobe below, with the nostrils' shadow between them. */
function drawTrunkTip(ctx: CanvasRenderingContext2D, line: TrunkLine, view: MammothView, p: Palette) {
  const n = TRUNK_SAMPLES, a = line.a[n - 1], h = line.hw[n - 1], sign = view.mirror ? -1 : 1;
  const skin = mix(mix(p['fur-dark'], p.umber, 0.6), p.clay, 0.16);
  ctx.save(); ctx.translate(line.x[n - 1], line.y[n - 1]); ctx.rotate(a); ctx.scale(1, sign);
  // Here +x runs on past the end of the trunk and +y is its front (dorsal) side.
  const fill = ctx.createLinearGradient(0, h, 0, -h);
  fill.addColorStop(0, paint(mix(skin, p['fur-light'], 0.2))); fill.addColorStop(1, paint(mix(skin, p.shadow, 0.35)));
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-h * 0.5, h);
  ctx.bezierCurveTo(h * 0.7, h * 1.08, h * 1.9, h * 0.86, h * 2.05, h * 0.5);
  ctx.bezierCurveTo(h * 2.0, h * 0.22, h * 1.2, h * 0.14, h * 0.78, 0);
  ctx.bezierCurveTo(h * 1.14, -h * 0.16, h * 1.2, -h * 0.74, h * 0.84, -h * 0.94);
  ctx.bezierCurveTo(h * 0.5, -h * 1.08, h * 0.1, -h, -h * 0.5, -h);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = paint(mix(p.umber, p.shadow, 0.65));
  ctx.beginPath(); ctx.ellipse(h * 0.8, -h * 0.02, h * 0.3, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = paint(p['fur-tip'], 0.3); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(h * 0.3, h * 0.82); ctx.quadraticCurveTo(h * 1.3, h * 0.84, h * 1.86, h * 0.56); ctx.stroke();
  ctx.restore();
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
  if (far) { ctx.fillStyle = paint(mix(p['storm-grey'], p.shadow, 0.3), 0.3); ctx.fill(tusk.outline); }
  ctx.restore();
}

/** The RouteScope's reading: a fine teal line laid along the outside of the tusk as it is measured, with a tick at every
 * step and a bead at each end. While there is tusk still to measure, a dotted way runs on ahead and a ring beats at the place to go next. */
function drawMeasure(ctx: CanvasRenderingContext2D, tusk: TuskPaths, p: Palette, k: number, S: number, guide: boolean, time: number) {
  const n = tusk.spine.length, done = Math.max(0, Math.min(1, k)), upto = Math.max(0, Math.round((n - 1) * done));
  const q = Math.floor(n / 5), qa = tusk.spine[q - 1], qb = tusk.spine[q + 1];
  const side = -(qb[1] - qa[1]) + (qb[0] - qa[0]) > 0 ? 1 : -1;
  const at = (i: number, out: number): Vec => {
    const a = tusk.spine[Math.max(0, i - 1)], b = tusk.spine[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const m = Math.hypot(nx, ny) || 1; nx = (nx / m) * side; ny = (ny / m) * side;
    return [tusk.spine[i][0] + nx * (tusk.widths[i] + out), tusk.spine[i][1] + ny * (tusk.widths[i] + out)];
  };
  const gap = 9 / Math.max(0.5, Math.sqrt(S)), line = Math.max(1.6, 2.6 / S);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (guide && upto < n - 1) {
    ctx.strokeStyle = paint(p.white, 0.85); ctx.lineWidth = line * 1.1; ctx.setLineDash([line * 0.2, line * 4.2]);
    ctx.beginPath();
    for (let i = upto; i < n; i++) { const [x, y] = at(i, gap); if (i === upto) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
    // The place to put a finger next: a ring that beats.
    const [nx, ny] = at(Math.min(n - 1, upto), gap), beat = 0.5 + 0.5 * Math.sin(time * 4.2);
    ctx.strokeStyle = paint(p.white, 0.95 - 0.5 * beat); ctx.lineWidth = line * 1.5;
    ctx.beginPath(); ctx.arc(nx, ny, (15 + 9 * beat) / Math.max(0.6, S), 0, Math.PI * 2); ctx.stroke();
  }
  if (upto > 0) {
    for (const [colour, w] of [[paint(p.white, 0.92), line * 2.5], [paint(p['teal-deep']), line]] as const) {
      ctx.strokeStyle = colour; ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i <= upto; i++) { const [x, y] = at(i, gap); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= upto; i += 4) { const [x, y] = at(i, gap - 3.5), [x2, y2] = at(i, gap + 5.5); ctx.moveTo(x, y); ctx.lineTo(x2, y2); }
      ctx.stroke();
    }
  }
  for (const i of upto > 0 ? [0, upto] : [0]) {
    const [x, y] = at(i, gap);
    ctx.fillStyle = paint(p.white); ctx.beginPath(); ctx.arc(x, y, line * 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = paint(p['teal-deep']); ctx.beginPath(); ctx.arc(x, y, line * 1.7, 0, Math.PI * 2); ctx.fill();
  }
}
/** The ScoutCam's finder: four soft corners round the place Pep's camera looks at, and a ring that closes as it locks on. CSS px. */
function drawFinder(ctx: CanvasRenderingContext2D, tool: NonNullable<ToolMarks['scoutCam']>, p: Palette) {
  const lock = Math.max(0, Math.min(1, tool.lock)), r = tool.r * (1 - 0.14 * lock), arm = r * 0.42, cx = tool.x, cy = tool.y;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Outside the finder the view dims a little, so the eye goes where the camera looks.
  ctx.fillStyle = paint(p.night, 0.14 + 0.1 * lock);
  ctx.beginPath(); ctx.rect(-10, -10, cx * 2 + 4000, cy * 2 + 4000); ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2, true); ctx.fill('evenodd');
  for (const [colour, w, alpha] of [[p['ink-soft'], 6, 0.35], [lock > 0.98 ? mix(p.celadon, p.white, 0.3) : p.white, 3.4, 0.98]] as const) {
    ctx.strokeStyle = paint(colour, alpha); ctx.lineWidth = w;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      ctx.moveTo(cx + sx * r, cy + sy * (r - arm)); ctx.quadraticCurveTo(cx + sx * r, cy + sy * r, cx + sx * (r - arm), cy + sy * r);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = paint(p.white, 0.85); ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7); ctx.stroke();
  if (lock > 0.02) {
    ctx.strokeStyle = paint(mix(p.celadon, p.white, 0.3)); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lock); ctx.stroke();
  }
}
/** The WaitRing round an offered tuft: a pale band that fills, patiently. World units. */
function drawWaitRing(ctx: CanvasRenderingContext2D, ring: NonNullable<ToolMarks['waitRing']>, p: Palette, S: number) {
  const r = 46 / Math.max(0.5, S), [x, y] = ring.at, k = Math.max(0, Math.min(1, ring.k));
  ctx.lineCap = 'round';
  ctx.strokeStyle = paint(p.shadow, 0.22); ctx.lineWidth = 9 / S; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = paint(p.white, 0.86); ctx.lineWidth = 6.5 / S; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  if (k > 0.01) { ctx.strokeStyle = paint(mix(p.teal, p.celadon, 0.35)); ctx.lineWidth = 6.5 / S; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); }
}
/** The ProofLens's round frame on the coat: white while the child parts the hair, teal with a steady ring when the picture is there to take. World units. */
function drawLens(ctx: CanvasRenderingContext2D, lens: NonNullable<ToolMarks['proofLens']>, p: Palette, S: number, time: number) {
  const [x, y] = lens.at, r = lens.r, ready = Math.max(0, Math.min(1, lens.ready)), tone = mix(p.white, mix(p.celadon, p.white, 0.25), ready);
  ctx.lineCap = 'round';
  // The coat outside the frame falls back a little.
  ctx.fillStyle = paint(p.shadow, 0.2);
  ctx.beginPath(); ctx.rect(x - 4000, y - 4000, 8000, 8000); ctx.arc(x, y, r, 0, Math.PI * 2, true); ctx.fill('evenodd');
  ctx.strokeStyle = paint(p.shadow, 0.3); ctx.lineWidth = 8 / S; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = paint(tone); ctx.lineWidth = 4.5 / S;
  if (ready < 0.99) ctx.setLineDash([r * 0.34, r * 0.185]);
  ctx.lineDashOffset = ready < 0.99 ? -time * r * 0.12 : 0;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  ctx.lineWidth = 3.4 / S; ctx.beginPath();
  for (let i = 0; i < 4; i++) { const a = (Math.PI / 2) * i + Math.PI / 4; ctx.moveTo(x + Math.cos(a) * r * 0.74, y + Math.sin(a) * r * 0.74); ctx.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); }
  ctx.stroke();
}
/** The ViewCheck's gauge: a slim rail down one side with the eye's height on it, a child's at the top, a calf's at the bottom. CSS px. */
function drawGauge(ctx: CanvasRenderingContext2D, gauge: NonNullable<ToolMarks['viewCheck']>, p: Palette) {
  const { x, top, bottom } = gauge, low = Math.max(0, Math.min(1, gauge.low)), y = top + (bottom - top) * low;
  ctx.lineCap = 'round';
  ctx.strokeStyle = paint(p.shadow, 0.26); ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  ctx.strokeStyle = paint(p.white, 0.9); ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  ctx.strokeStyle = paint(mix(p.teal, p.celadon, 0.35)); ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, y); ctx.stroke();
  // The calf's mark at the foot of the rail, and the eye that slides down to it.
  ctx.fillStyle = paint(p.white); ctx.beginPath(); ctx.arc(x, bottom, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = paint(mix(p.teal, p.celadon, 0.35), low > 0.98 ? 1 : 0.35); ctx.beginPath(); ctx.arc(x, bottom, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = paint(p.shadow, 0.3); ctx.beginPath(); ctx.arc(x, y + 2, 21, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = paint(p.white); ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = paint(p['teal-deep']); ctx.beginPath(); ctx.ellipse(x, y, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = paint(p.white); ctx.beginPath(); ctx.arc(x - 3, y - 2, 2.6, 0, Math.PI * 2); ctx.fill();
}

/** Snow lying on the crown, the hump and the back: one soft, lumpy blanket that follows the slope, lit from the top left, blue in its own shade. */
function drawSnow(ctx: CanvasRenderingContext2D, view: MammothView, st: Statics, snow: readonly SnowClump[], part: 'head' | 'body', p: Palette) {
  const lumps: { x: number; y: number; rx: number; ry: number; tilt: number; a: number }[] = [];
  for (const clump of snow) {
    const spot = view.snow[clump.spot];
    if (!spot || spot.part !== part || clump.amount <= 0) continue;
    const k = 0.55 + 0.45 * clump.amount, r = spot.r * clump.size * 1.5 * k, tilt = st.snowTilt[clump.spot] + clump.tilt * 0.25;
    const c = Math.cos(tilt), s = Math.sin(tilt), [x, y] = spot.at;
    for (const [dx, dy, kx, ky] of [[-0.62, 0.08, 0.6, 0.34], [0.6, 0.1, 0.58, 0.32], [0, -0.06, 0.92, 0.44]] as const) {
      lumps.push({ x: x + (dx * c - dy * s) * r, y: y - r * 0.1 + (dx * s + dy * c) * r, rx: r * kx, ry: r * ky * (0.7 + 0.3 * clump.amount), tilt, a: Math.min(1, clump.amount * 1.6) });
    }
  }
  if (!lumps.length) return;
  // The shade the blanket lays on the hair under it, then its blue underside, then the sunlit top.
  for (const pass of [0, 1, 2] as const) {
    for (const l of lumps) {
      ctx.save(); ctx.translate(l.x, l.y + (pass === 0 ? l.ry * 0.9 : pass === 1 ? l.ry * 0.3 : 0)); ctx.rotate(l.tilt); ctx.scale(1, l.ry / l.rx);
      const g = ctx.createRadialGradient(pass === 2 ? -l.rx * 0.25 : 0, pass === 2 ? -l.rx * 0.3 : 0, 0, 0, 0, l.rx);
      if (pass === 0) { g.addColorStop(0, paint(p.shadow, 0.3 * l.a)); g.addColorStop(1, paint(p.shadow, 0)); }
      else if (pass === 1) { g.addColorStop(0, paint(mix(p['snow-shade'], p['storm-grey'], 0.18), 0.95 * l.a)); g.addColorStop(0.8, paint(p['snow-shade'], 0.85 * l.a)); g.addColorStop(1, paint(p['snow-shade'], 0)); }
      else { g.addColorStop(0, paint(p.white, l.a)); g.addColorStop(0.62, paint(p.snow, 0.97 * l.a)); g.addColorStop(0.9, paint(mix(p.snow, p['snow-shade'], 0.4), 0.7 * l.a)); g.addColorStop(1, paint(p.snow, 0)); }
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, l.rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

const BLADES: readonly { dx: number; h: number; lean: number; w: number }[] = [
  { dx: -15, h: 30, lean: -0.5, w: 3.4 }, { dx: -9, h: 44, lean: -0.24, w: 3.8 }, { dx: -3, h: 52, lean: -0.06, w: 4.2 }, { dx: 2, h: 40, lean: 0.1, w: 3.6 },
  { dx: 7, h: 49, lean: 0.24, w: 4 }, { dx: 12, h: 34, lean: 0.46, w: 3.4 }, { dx: -6, h: 26, lean: 0.34, w: 3 }, { dx: 5, h: 28, lean: -0.36, w: 3 }, { dx: 16, h: 24, lean: 0.62, w: 3 },
];
function blade(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, lean: number, w: number, bend: number, inks: readonly [string, string, string], alt: boolean) {
  const tx = x + Math.sin(lean) * h + bend, ty = y - Math.cos(lean) * h;
  const g = ctx.createLinearGradient(x, y, tx, ty);
  g.addColorStop(0, inks[0]); g.addColorStop(0.55, alt ? inks[1] : inks[0]); g.addColorStop(1, inks[2]);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - w, y + 2);
  ctx.quadraticCurveTo(x - w * 0.3 + bend * 0.3, y - h * 0.55, tx, ty);
  ctx.quadraticCurveTo(x + w * 0.5 + bend * 0.3, y - h * 0.5, x + w, y + 2);
  ctx.closePath(); ctx.fill();
}
const grassInks = (p: Palette): readonly [string, string, string] => [paint(mix(p.wood, p.moss, 0.3)), paint(mix(p['wood-light'], p.sand, 0.5)), paint(mix(p.sand, p.cream, 0.4))];
/** A tuft of dry steppe grass standing through the snow: cropped where a bunch was taken, growing back, rustling when touched. */
function drawSheaf(ctx: CanvasRenderingContext2D, sheaf: Sheaf, p: Palette, time: number, S: number) {
  const inks = grassInks(p), rustle = Math.max(0, 1 - (time - sheaf.shaken) / 0.6), k = sheaf.size;
  // The one to try next wears a ring that beats.
  if (sheaf.cue) {
    const beat = 0.5 + 0.5 * Math.sin(time * 4.2);
    ctx.strokeStyle = paint(p.white, 0.95 - 0.5 * beat); ctx.lineWidth = 3.4 / S;
    ctx.beginPath(); ctx.ellipse(sheaf.x, sheaf.y - 16 * k, (34 + 8 * beat) * k, (30 + 7 * beat) * k, 0, 0, Math.PI * 2); ctx.stroke();
  }
  BLADES.forEach((b, i) => {
    const h = b.h * k * (0.42 + 0.58 * sheaf.grown) * (1.25);
    blade(ctx, sheaf.x + b.dx * k * 1.3, sheaf.y, h, b.lean * 0.8, b.w * k, Math.sin(time * 26 + i * 1.7) * 5 * rustle * k + Math.sin(time * 0.9 + i) * 1.2 * k, inks, i % 2 === 1);
  });
  // Snow banked round its foot.
  const mound = ctx.createRadialGradient(sheaf.x - 6 * k, sheaf.y - 2 * k, 0, sheaf.x, sheaf.y + 2 * k, 34 * k);
  mound.addColorStop(0, paint(p.white, 0.95)); mound.addColorStop(0.7, paint(p.snow, 0.9)); mound.addColorStop(1, paint(p['snow-shade'], 0));
  ctx.save(); ctx.translate(sheaf.x, sheaf.y + 2 * k); ctx.scale(1, 0.3); ctx.translate(-sheaf.x, -(sheaf.y + 2 * k));
  ctx.fillStyle = mound; ctx.beginPath(); ctx.arc(sheaf.x, sheaf.y + 2 * k, 34 * k, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
/** A bunch of grass in the air or in the trunk's tip. */
function drawBundle(ctx: CanvasRenderingContext2D, bundle: Bundle, p: Palette) {
  const inks = grassInks(p);
  ctx.save(); ctx.translate(bundle.x, bundle.y); ctx.rotate(bundle.angle); ctx.scale(bundle.size, bundle.size);
  BLADES.slice(0, 6).forEach((b, i) => blade(ctx, b.dx * 0.5, 14, b.h * 0.9, b.lean * 0.7, b.w, 0, inks, i % 2 === 1));
  ctx.restore();
}
export const PUFF_SECONDS = 2.2;
function drawPuffs(ctx: CanvasRenderingContext2D, puffs: readonly Puff[], p: Palette, time: number) {
  for (const puff of puffs) {
    const age = (time - puff.born) / PUFF_SECONDS;
    if (age < 0 || age >= 1) continue;
    const big = puff.big ?? 1, r = (8 + 34 * Math.sqrt(age)) * big, alpha = Math.min(0.7, 0.42 * (0.7 + 0.3 * big)) * (1 - age) * Math.min(1, age * 5);
    for (let k = 0; k < 3; k++) {
      const x = puff.x + (k - 1) * r * 0.45 + age * 26 * big, y = puff.y - age * 38 * big - k * r * 0.2;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, paint(p.white, alpha)); g.addColorStop(1, paint(p.white, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
}
function drawMotes(ctx: CanvasRenderingContext2D, motes: readonly Mote[], p: Palette, time: number) {
  if (!motes.length) return;
  // Loose snow: a soft blue edge so it shows against the pearl floor as well as the fur.
  for (const pass of [0, 1]) {
    for (const band of [0.35, 0.7, 1]) {
      ctx.fillStyle = pass ? paint(p.white, band) : paint(mix(p['snow-shade'], p['storm-grey'], 0.25), band * 0.55);
      ctx.beginPath();
      for (const mote of motes) {
        const age = (time - mote.born) / mote.life;
        if (age < 0 || age >= 1) continue;
        const a = age < 0.7 ? 1 : (1 - age) / 0.3;
        if (Math.abs(a - band) > 0.34 && !(band === 1 && a > 0.84) && !(band === 0.35 && a < 0.35)) continue;
        const r = mote.r + (pass ? 0 : 0.9);
        ctx.moveTo(mote.x + r, mote.y + (pass ? 0 : 0.7)); ctx.arc(mote.x, mote.y + (pass ? 0 : 0.7), r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
}
/** Daylight lying across the glass: two soft slanting bands, so the wall reads as glass and what is beyond it as beyond. */
function drawSheen(ctx: CanvasRenderingContext2D, glass: Glass, p: Palette) {
  const { minX, minY, maxX, maxY } = glass.box, w = maxX - minX, h = maxY - minY;
  ctx.fillStyle = paint(p['sky-pale'], 0.07); ctx.fillRect(minX, minY, w, h);
  for (const [at, wide, alpha] of [[0.2, 0.09, 0.2], [0.36, 0.035, 0.14], [0.74, 0.06, 0.16]] as const) {
    const x = minX + w * at, bw = w * wide, slant = h * 0.42;
    const g = ctx.createLinearGradient(x, 0, x + bw, 0);
    g.addColorStop(0, paint(p.white, 0)); g.addColorStop(0.5, paint(p.white, alpha * 0.8)); g.addColorStop(1, paint(p.white, 0));
    ctx.save(); ctx.transform(1, 0, -slant / h, 1, slant * (maxY / h), 0);
    ctx.fillStyle = g; ctx.fillRect(x - w, minY, bw + 2 * w, h);
    ctx.restore();
  }
}
function drawMists(ctx: CanvasRenderingContext2D, mists: readonly Mist[], p: Palette, time: number) {
  for (const mist of mists) {
    const age = (time - mist.born) / MIST_SECONDS;
    if (age < 0 || age >= 1) continue;
    const r = mist.r * (0.7 + 0.5 * Math.min(1, age * 5)), alpha = 0.78 * Math.min(1, age * 9) * Math.pow(1 - age, 1.4);
    const g = ctx.createRadialGradient(mist.x, mist.y, 0, mist.x, mist.y, r);
    g.addColorStop(0, paint(p.white, alpha)); g.addColorStop(0.6, paint(p.snow, alpha * 0.7)); g.addColorStop(1, paint(p.snow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mist.x, mist.y, r, 0, Math.PI * 2); ctx.fill();
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

const scratch = { m: new Float32Array(0), q1: new Float32Array(0), q2: new Float32Array(0), p2: new Float32Array(0), off: new Float32Array(0), on: new Uint8Array(0) };
function ensureScratch(n: number) {
  if (scratch.m.length >= n * 2) return;
  scratch.m = new Float32Array(n * 2); scratch.q1 = new Float32Array(n * 2); scratch.q2 = new Float32Array(n * 2); scratch.p2 = new Float32Array(n * 2); scratch.off = new Float32Array(n * 2); scratch.on = new Uint8Array(n);
}

/** What the hair needs to be painted: where, which coat, how it is moving, and how closely it is seen. */
interface HairInput {
  ctx: CanvasRenderingContext2D; strands: StrandSet; dyn: Dynamics; time: number; wind: number; inks: Inks; tier: Tier;
  /** Close enough that single hairs show: thicker strokes with a highlight. */
  detail: boolean; mirror: boolean;
  /** How many hairs each strand stands for (1..3): seen close, every strand is a lock of two or three hairs, so the coat stays thick. */
  locks: number;
  /** The ProofLens's frame in the animal's space: inside it the undercoat is painted pale, so the two coats tell apart. */
  lens: { x: number; y: number; r: number } | null;
}
function drawStrands(input: HairInput, part: StrandSet['parts'][number], view4: { minX: number; maxX: number; minY: number; maxY: number }, S: number, isTrunk: boolean, trunk: TrunkLine, clip?: Path2D) {
  const { ctx, strands: s, dyn, time, wind, inks, tier, mirror, detail, lens, locks } = input;
  ensureScratch(s.count);
  const { m, q1, q2, p2, off, on } = scratch;
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
        if (locks > 1) {
          // The other hairs of the lock lie a little to each side of the strand, closing in toward its tip.
          const ax = p2x - rx, ay = p2y - ry, al = Math.hypot(ax, ay) || 1, spread = 1.5 + 0.9 * Math.sin(s.phase[i] * 5);
          off[j] = (-ay / al) * spread; off[j + 1] = (ax / al) * spread;
        }
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
        if (locks > 1) {
          const ox = off[j], oy = off[j + 1];
          ctx.moveTo(dyn.wx[i] + ox, dyn.wy[i] + oy); ctx.quadraticCurveTo(q1[j] + ox, q1[j + 1] + oy, m[j] + ox * 0.8, m[j + 1] + oy * 0.8);
          if (locks > 2) { ctx.moveTo(dyn.wx[i] - ox * 1.1, dyn.wy[i] - oy * 1.1); ctx.quadraticCurveTo(q1[j] - ox * 1.1, q1[j + 1] - oy * 1.1, m[j] - ox * 0.9, m[j + 1] - oy * 0.9); }
        }
      }
      if (!any) continue;
      ctx.strokeStyle = guard ? inks.root[group.bin] : inks.under[group.bin];
      ctx.lineWidth = Math.max(minW, (guard ? 1.6 : 1.3) * widthK); ctx.stroke();
      ctx.beginPath();
      for (let i = group.start; i < group.end; i++) {
        if (!on[i]) continue;
        const j = i * 2;
        ctx.moveTo(m[j], m[j + 1]); ctx.quadraticCurveTo(q2[j], q2[j + 1], p2[j], p2[j + 1]);
        if (locks > 1) {
          const ox = off[j], oy = off[j + 1];
          ctx.moveTo(m[j] + ox * 0.8, m[j + 1] + oy * 0.8); ctx.quadraticCurveTo(q2[j] + ox * 0.6, q2[j + 1] + oy * 0.6, p2[j] + ox * 0.35 - (p2[j] - m[j]) * 0.12, p2[j + 1] + oy * 0.35 - (p2[j + 1] - m[j + 1]) * 0.12);
          if (locks > 2) { ctx.moveTo(m[j] - ox * 0.9, m[j + 1] - oy * 0.9); ctx.quadraticCurveTo(q2[j] - ox * 0.7, q2[j + 1] - oy * 0.7, p2[j] - ox * 0.4 - (p2[j] - m[j]) * 0.2, p2[j + 1] - oy * 0.4 - (p2[j + 1] - m[j + 1]) * 0.2); }
        }
      }
      ctx.strokeStyle = guard ? inks.tip[group.bin] : inks.underTip[group.bin];
      ctx.lineWidth = Math.max(minW, (guard ? 1.0 : 0.85) * widthK); ctx.stroke();
      // Under the ProofLens the woolly undercoat is pale and thick, so it shows wherever the long hair is parted.
      if (!guard && lens) {
        let wool = false;
        ctx.beginPath();
        for (let i = group.start; i < group.end; i++) {
          if (!on[i] || Math.hypot(dyn.wx[i] - lens.x, dyn.wy[i] - lens.y) > lens.r * 1.05) continue;
          const j = i * 2; wool = true;
          ctx.moveTo(dyn.wx[i], dyn.wy[i]); ctx.quadraticCurveTo(q1[j], q1[j + 1], m[j], m[j + 1]); ctx.quadraticCurveTo(q2[j], q2[j + 1], p2[j], p2[j + 1]);
        }
        if (wool) { ctx.strokeStyle = group.bin % 2 ? inks.woolTip : inks.wool; ctx.lineWidth = Math.max(minW, 2.3 * widthK); ctx.stroke(); }
      }
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

/* ── frost on the glass ───────────────────────────────────────────────── */

/** The frost on the wall of glass: a painted sheet of ice ferns, and the
 * clear patches a hand has wiped in it. `canvas` is what is drawn over the
 * glass; it is repainted only when something was wiped. */
export interface FrostLayer {
  canvas: HTMLCanvasElement;
  /** Wipes a round patch at (u, v), 0..1 across the sheet, of radius r (a fraction of its width). */
  wipe(u: number, v: number, r: number): void;
  /** Thins all of it by k (0..1): the last of the frost melting away. */
  melt(k: number): void;
  /** Repaints the sheet if it changed. */
  settle(): void;
}
export function makeFrostLayer(width: number, height: number, seed: number, p: Palette): FrostLayer | null {
  if (typeof document === 'undefined') return null;
  const make = () => { const c = document.createElement('canvas'); c.width = Math.max(8, Math.round(width)); c.height = Math.max(8, Math.round(height)); return c; };
  const sheet = make(), mask = make(), out = make();
  const g = sheet.getContext('2d'), mg = mask.getContext('2d'), og = out.getContext('2d');
  if (!g || !mg || !og) return null;
  const W = sheet.width, H = sheet.height, random = seeded(seed);
  // The ice itself: milky, a little bluer toward the foot of the pane, never quite opaque, so a great dark shape shows through as a shadow.
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, paint(p.white, 0.9)); base.addColorStop(0.5, paint(p.snow, 0.86)); base.addColorStop(1, paint(mix(p.snow, p['snow-shade'], 0.5), 0.9));
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  // Thicker and thinner patches.
  for (let i = 0; i < 46; i++) {
    const x = random() * W, y = random() * H, r = (0.06 + random() * 0.16) * W, thick = random() < 0.6;
    const blot = g.createRadialGradient(x, y, 0, x, y, r);
    blot.addColorStop(0, paint(thick ? p.white : p['snow-shade'], thick ? 0.2 : 0.16)); blot.addColorStop(1, paint(thick ? p.white : p['snow-shade'], 0));
    g.fillStyle = blot; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // The low sun behind it warms one side.
  const sun = g.createRadialGradient(W * 0.22, H * 0.6, 0, W * 0.22, H * 0.6, W * 0.62);
  sun.addColorStop(0, paint(mix(p.butter, p.sun, 0.35), 0.5)); sun.addColorStop(0.5, paint(p.butter, 0.18)); sun.addColorStop(1, paint(p.butter, 0));
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = sun; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  // Ice ferns: each grows from a seed, branching and branching again.
  g.lineCap = 'round';
  const fern = (x: number, y: number, angle: number, length: number, depth: number) => {
    const steps = Math.max(3, Math.round(length / (W * 0.012)));
    let px = x, py = y, a = angle;
    for (let i = 0; i < steps; i++) {
      a += (random() - 0.5) * 0.16;
      const step = length / steps, nx = px + Math.cos(a) * step, ny = py + Math.sin(a) * step, taper = 1 - i / steps;
      g.strokeStyle = paint(p.white, (0.34 + 0.4 * taper) * (depth === 0 ? 1 : 0.8)); g.lineWidth = Math.max(0.6, (depth === 0 ? 2.1 : 1.2) * taper * (W / 700));
      g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
      if (depth < 2 && i > 0 && i % 2 === 0) for (const side of [-1, 1]) fern(nx, ny, a + side * (0.9 + random() * 0.25), length * 0.36 * taper + W * 0.006, depth + 1);
      px = nx; py = ny;
    }
  };
  for (let i = 0; i < 30; i++) {
    const edge = random() < 0.62, side = Math.floor(random() * 4);
    const x = edge ? (side === 0 ? 0 : side === 1 ? W : random() * W) : random() * W, y = edge ? (side === 2 ? 0 : side === 3 ? H : random() * H) : random() * H;
    const toward = Math.atan2(H / 2 - y, W / 2 - x) + (random() - 0.5) * 1.6;
    fern(x, y, edge ? toward : random() * Math.PI * 2, (0.1 + random() * 0.2) * W, 0);
  }
  // Glints of ice.
  g.fillStyle = paint(p.white, 0.95);
  for (let i = 0; i < 150; i++) { const x = random() * W, y = random() * H, r = 0.5 + random() * random() * 1.9 * (W / 700); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  mg.fillStyle = paint(p.white); mg.fillRect(0, 0, W, H);
  let dirty = true;
  return {
    canvas: out,
    wipe(u, v, r) {
      const x = u * W, y = v * H, radius = Math.max(4, r * W);
      mg.globalCompositeOperation = 'destination-out';
      const brush = mg.createRadialGradient(x, y, radius * 0.4, x, y, radius);
      brush.addColorStop(0, paint(p.white, 1)); brush.addColorStop(1, paint(p.white, 0));
      mg.fillStyle = brush; mg.beginPath(); mg.arc(x, y, radius, 0, Math.PI * 2); mg.fill();
      mg.globalCompositeOperation = 'source-over';
      dirty = true;
    },
    melt(k) {
      mg.globalCompositeOperation = 'destination-out'; mg.fillStyle = paint(p.white, Math.max(0, Math.min(1, k))); mg.fillRect(0, 0, W, H); mg.globalCompositeOperation = 'source-over';
      dirty = true;
    },
    settle() {
      if (!dirty) return;
      dirty = false;
      og.globalCompositeOperation = 'source-over'; og.clearRect(0, 0, W, H); og.drawImage(sheet, 0, 0);
      og.globalCompositeOperation = 'destination-in'; og.drawImage(mask, 0, 0); og.globalCompositeOperation = 'source-over';
    },
  };
}
