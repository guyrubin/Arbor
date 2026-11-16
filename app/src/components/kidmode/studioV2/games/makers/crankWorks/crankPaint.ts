import {
  CAM, LINKAGE, WAVE_LINK, WAVE_RODS, bloomOpen, camAngle, camCentre, camLift, crankPin, pistonLift, waveAngle, waveLift, type Plan,
} from './crankWorksRules';
import {
  BELL, BENCH, BOARD, CHOCK, CRATE, CRATE_SLOT, GROUND, KNOB_RISE, POD, PUCK, ROD_GAP, ROD_RISE, S1, S2, S3, SOCKET, STEM, UNIT, WHEEL, pinAt,
  type PartKind,
} from './crankGeometry';

/* The painter. One canvas holds the whole picture: the Wonderworks pavilion,
 * the TrailBench (kit renders) and, built on the bench's deck, the machine,
 * drawn here in brass, steel, enamel, glass and pale wood. One light for
 * everything, from the upper left like the bench's own; a thing further back
 * sits a little higher (the bench is seen a little from above), so every
 * housing shows a sliver of its top and every part drops a soft shadow on
 * what is behind and below it. Colour comes only from the makers' palette,
 * read once from the page and mixed here as numbers. */

type RGB = readonly [number, number, number];
type Ctx = CanvasRenderingContext2D;
const TONE_NAMES = 'white paper cream shadow ink umber sand wood wood-light wood-dark gold gold-light gold-deep brass butter sun amber orange rust clay clay-light poppy red rose rose-deep blossom plum lilac violet bluebell teal teal-deep sea sky sky-pale water indigo indigo-deep steel steel-light steel-dark graphite leaf leaf-deep spring fur-dark'.split(' ');
export type Palette = Record<string, RGB>;
const camel = (name: string) => name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
function parseTone(value: string): RGB | null {
  const v = value.trim();
  if (v.startsWith('#') && (v.length === 7 || v.length === 4)) {
    const full = v.length === 4 ? v.slice(1).split('').map(c => c + c).join('') : v.slice(1);
    const n = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
    return n.some(Number.isNaN) ? null : [n[0], n[1], n[2]];
  }
  const m = v.match(/(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
/** Reads the makers' palette (and the Studio's focus teal) once from the page. */
export function readPalette(element: Element): Palette {
  const style = getComputedStyle(element), out: Palette = {};
  for (const name of TONE_NAMES) out[camel(name)] = parseTone(style.getPropertyValue(`--mk-${name}`)) ?? [128, 128, 128];
  out.focus = parseTone(style.getPropertyValue('--studio-teal-ink')) ?? out.tealDeep;
  out.signal = parseTone(style.getPropertyValue('--studio-signal')) ?? out.sun;
  return out;
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const col = (c: RGB, a = 1) => `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}${a >= 1 ? '' : hex2(a * 255)}`;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const TAU = Math.PI * 2;

type Stop = readonly [number, RGB, number?];
function addStops<G extends CanvasGradient>(g: G, stops: readonly Stop[]): G { for (const s of stops) g.addColorStop(clamp01(s[0]), col(s[1], s[2] ?? 1)); return g; }
const lin = (c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: readonly Stop[]) => addStops(c.createLinearGradient(x0, y0, x1, y1), stops);
const rad = (c: Ctx, x: number, y: number, r0: number, r1: number, stops: readonly Stop[], fx = x, fy = y) => addStops(c.createRadialGradient(fx, fy, r0, x, y, r1), stops);

/** A metal: its shade, body, lit face, glint, and the sky it mirrors. */
interface Metal { dark: RGB; mid: RGB; light: RGB; spec: RGB; sky: RGB }
interface Enamel { deep: RGB; base: RGB; light: RGB }
interface Mats { brass: Metal; steel: Metal; iron: Metal; enamels: Enamel[]; blooms: [RGB, RGB, RGB][]; beads: RGB[]; wood: [RGB, RGB, RGB]; leather: RGB }
function matsOf(P: Palette): Mats {
  return {
    brass: { dark: mix(P.goldDeep, P.umber, 0.45), mid: mix(P.brass, P.gold, 0.4), light: P.goldLight, spec: mix(P.butter, P.white, 0.6), sky: mix(P.goldLight, P.skyPale, 0.5) },
    steel: { dark: mix(P.steelDark, P.shadow, 0.25), mid: P.steel, light: P.steelLight, spec: P.white, sky: mix(P.steelLight, P.skyPale, 0.6) },
    iron: { dark: mix(P.graphite, P.shadow, 0.5), mid: P.graphite, light: P.steelDark, spec: P.steelLight, sky: P.steel },
    enamels: [
      { deep: mix(P.tealDeep, P.shadow, 0.25), base: P.teal, light: mix(P.sea, P.white, 0.25) },
      { deep: mix(P.rust, P.umber, 0.35), base: mix(P.orange, P.poppy, 0.35), light: mix(P.amber, P.butter, 0.4) },
      { deep: P.indigoDeep, base: mix(P.indigo, P.water, 0.45), light: mix(P.sky, P.bluebell, 0.3) },
    ],
    blooms: [[P.roseDeep, P.rose, P.blossom], [mix(P.amber, P.orange, 0.5), P.sun, P.butter], [P.violet, P.lilac, mix(P.lilac, P.white, 0.6)], [P.red, P.poppy, P.clayLight]],
    beads: [P.poppy, P.orange, P.sun, P.leaf, P.water, P.violet],
    wood: [mix(P.woodLight, P.cream, 0.45), mix(P.woodLight, P.sand, 0.4), mix(P.wood, P.woodDark, 0.3)],
    leather: mix(P.umber, P.furDark, 0.5),
  };
}
const matCache = new WeakMap<Palette, Mats>();
const mats = (P: Palette) => { let m = matCache.get(P); if (!m) { m = matsOf(P); matCache.set(P, m); } return m; };

/* ------------------------------------------------------------ materials */
function conic(c: Ctx, x: number, y: number, r: number, m: Metal): CanvasGradient {
  // Lathe-turned metal: bright streaks that stay where the light is while the wheel turns under them.
  if (typeof c.createConicGradient !== 'function') return rad(c, x, y, 0, r, [[0, m.light], [0.6, m.mid], [1, m.dark]], x - r * 0.4, y - r * 0.4);
  return addStops(c.createConicGradient(-2.5, x, y), [[0, m.spec], [0.05, m.light], [0.16, m.mid], [0.3, m.dark], [0.4, m.mid], [0.48, m.sky], [0.53, m.spec], [0.6, m.light], [0.72, m.mid], [0.86, m.dark], [0.95, m.light], [1, m.spec]]);
}
function disc(c: Ctx, x: number, y: number, r: number, m: Metal, bevel = true) {
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = conic(c, x, y, r, m); c.fill();
  if (!bevel) return;
  c.fillStyle = rad(c, x, y, r * 0.55, r, [[0, m.dark, 0], [0.82, m.dark, 0.1], [1, m.dark, 0.55]]); c.fill();
  c.lineWidth = Math.max(0.5, r * 0.07); c.strokeStyle = col(m.spec, 0.75); c.beginPath(); c.arc(x, y, r * 0.93, -2.75, -1.75); c.stroke();
}
function ringOf(c: Ctx, x: number, y: number, ro: number, ri: number, m: Metal) {
  c.beginPath(); c.arc(x, y, ro, 0, TAU); c.arc(x, y, ri, 0, TAU, true); c.fillStyle = conic(c, x, y, ro, m); c.fill('evenodd');
  const w = ro - ri;
  c.fillStyle = rad(c, x, y, ri, ro, [[0, m.dark, 0.5], [0.22, m.dark, 0], [0.7, m.dark, 0], [1, m.dark, 0.55]]); c.fill('evenodd');
  c.lineWidth = w * 0.14; c.strokeStyle = col(m.spec, 0.85); c.beginPath(); c.arc(x, y, ro - w * 0.3, -2.8, -1.7); c.stroke();
  c.strokeStyle = col(m.sky, 0.5); c.beginPath(); c.arc(x, y, ro - w * 0.3, 0.5, 1.5); c.stroke();
}
/** A round bar from one point to another, lit along its upper-left flank. */
function bar(c: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, m: Metal, cap = true) {
  const len = Math.hypot(x1 - x0, y1 - y0); if (!(len > 0)) return;
  c.save(); c.translate(x0, y0); c.rotate(Math.atan2(y1 - y0, x1 - x0));
  // Keep the bright flank on the side the light comes from, whichever way the bar lies.
  const flip = Math.cos(Math.atan2(y1 - y0, x1 - x0) + 0.6) < 0 ? -1 : 1, h = w / 2;
  c.fillStyle = lin(c, 0, -h * flip, 0, h * flip, [[0, m.mid], [0.16, m.light], [0.3, m.spec], [0.46, m.light], [0.72, m.mid], [1, m.dark]]);
  c.beginPath();
  if (cap) c.roundRect(-h * 0.6, -h, len + h * 1.2, w, h); else c.rect(0, -h, len, w);
  c.fill(); c.lineWidth = Math.max(0.4, w * 0.06); c.strokeStyle = col(m.dark, 0.5); c.stroke();
  c.restore();
}
function ball(c: Ctx, x: number, y: number, r: number, base: RGB, P: Palette, gloss = 0.9) {
  c.beginPath(); c.arc(x, y, r, 0, TAU);
  c.fillStyle = rad(c, x, y, r * 0.05, r * 1.25, [[0, mix(base, P.white, 0.7)], [0.3, mix(base, P.white, 0.15)], [0.7, base], [1, mix(base, P.shadow, 0.6)]], x - r * 0.38, y - r * 0.42); c.fill();
  c.lineWidth = r * 0.12; c.strokeStyle = col(mix(base, P.white, 0.55), 0.55); c.beginPath(); c.arc(x, y, r * 0.86, 0.5, 1.7); c.stroke();
  c.fillStyle = col(P.white, gloss); c.beginPath(); c.ellipse(x - r * 0.36, y - r * 0.44, r * 0.26, r * 0.15, -0.7, 0, TAU); c.fill();
}
function softShadow(c: Ctx, P: Palette, x: number, y: number, rx: number, ry: number, a: number) {
  c.save(); c.translate(x, y); c.scale(1, ry / rx);
  c.fillStyle = rad(c, 0, 0, 0, rx, [[0, P.shadow, a], [0.55, P.shadow, a * 0.55], [1, P.shadow, 0]]);
  c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
}
/** Enamel on a shape that is round from side to side (a cylinder, a drum). */
function enamel(c: Ctx, path: Path2D, x0: number, x1: number, y0: number, y1: number, e: Enamel, P: Palette, alpha = 1) {
  c.save(); c.globalAlpha *= alpha;
  c.fillStyle = lin(c, x0, 0, x1, 0, [[0, e.deep], [0.14, e.base], [0.3, e.light], [0.42, mix(e.light, e.base, 0.6)], [0.72, e.base], [1, e.deep]]); c.fill(path);
  c.fillStyle = lin(c, 0, y0, 0, y1, [[0, P.white, 0.14], [0.35, P.white, 0], [0.7, P.shadow, 0], [1, P.shadow, 0.34]]); c.fill(path);
  c.lineWidth = 0.9; c.strokeStyle = col(mix(e.deep, P.shadow, 0.5), 0.7); c.stroke(path);
  c.restore();
}
/** A brass corner plate, riveted on: (x, y) is the housing's corner, (sx, sy) the way in. */
function corner(c: Ctx, M: Mats, x: number, y: number, sx: number, sy: number) {
  c.save(); c.translate(x, y); c.scale(-sx, -sy);
  c.fillStyle = lin(c, 0, 0, 13, 13, [[0, M.brass.light], [0.45, M.brass.mid], [1, M.brass.dark]]);
  c.beginPath(); c.moveTo(0, 10); c.quadraticCurveTo(0, 0, 10, 0); c.lineTo(15, 0); c.quadraticCurveTo(6, 3, 5, 5); c.quadraticCurveTo(3, 6, 0, 15); c.closePath(); c.fill();
  c.restore(); rivet(c, x - sx * 5.4, y - sy * 5.4, 1.5, M.steel);
}
/** A small engraved maker's plate: brass, with two lines of fine marks (no letters). */
function plate(c: Ctx, P: Palette, M: Mats, x: number, y: number, w: number, h: number) {
  c.fillStyle = lin(c, x - w / 2, y, x + w / 2, y + h, [[0, M.brass.spec], [0.4, M.brass.light], [1, M.brass.mid]]); c.beginPath(); c.roundRect(x - w / 2, y, w, h, 2); c.fill();
  c.strokeStyle = col(M.brass.dark, 0.7); c.lineWidth = 0.6; c.stroke();
  c.strokeStyle = col(M.brass.dark, 0.55); c.lineWidth = 0.8; c.setLineDash([3, 1.4, 1.2, 1.4]); c.beginPath(); c.moveTo(x - w / 2 + 4, y + h * 0.36); c.lineTo(x + w / 2 - 4, y + h * 0.36); c.moveTo(x - w / 2 + 7, y + h * 0.68); c.lineTo(x + w / 2 - 7, y + h * 0.68); c.stroke(); c.setLineDash([]);
  rivet(c, x - w / 2 + 2, y + h / 2, 0.9, M.steel); rivet(c, x + w / 2 - 2, y + h / 2, 0.9, M.steel);
}
/** The inside of a housing seen through glass: deep, tinted by its enamel, lit along the rim. */
function inside(c: Ctx, P: Palette, path: Path2D, e: Enamel, y0: number, y1: number) {
  c.fillStyle = lin(c, 0, y0, 0, y1, [[0, mix(e.deep, P.shadow, 0.46)], [1, mix(e.deep, P.shadow, 0.7)]]); c.fill(path);
  c.save(); c.clip(path); c.strokeStyle = col(e.light, 0.22); c.lineWidth = 10; c.stroke(path); c.strokeStyle = col(P.white, 0.16); c.lineWidth = 3; c.stroke(path); c.restore();
}
function rivet(c: Ctx, x: number, y: number, r: number, m: Metal) {
  c.beginPath(); c.arc(x, y + r * 0.35, r * 1.15, 0, TAU); c.fillStyle = col(m.dark, 0.45); c.fill();
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = rad(c, x, y, 0, r, [[0, m.spec], [0.45, m.light], [1, m.dark]], x - r * 0.35, y - r * 0.4); c.fill();
}

/* ------------------------------------------------------------ the scene */
export interface PaintImages { roomImg: CanvasImageSource | null; bench: CanvasImageSource | null; chock: CanvasImageSource | null; tool: CanvasImageSource | null }
export interface Scene {
  theta: number; omega: number; time: number; plan: Plan;
  /** Where the pavilion picture lies (world units). */
  room: { x: number; y: number; size: number };
  /** How far each built thing has arrived: 0 not there, 1 home (the belt threads on with it). */
  flower: number; beads: number; bell: number;
  /** What still waits in the crate, and which of them asks to be picked. */
  waiting: readonly PartKind[]; ask: PartKind | null;
  /** A part in the hand. */
  carry: { kind: PartKind; x: number; y: number; tilt: number } | null;
  /** How clear each housing is: 0 enamel, 1 glass. */
  reveal: readonly [number, number, number];
  bellSwing: number; beadPop: readonly number[]; bloomPop: number; knobPop: number;
  chock: { hop: number; squash: number; lean: number; dx: number };
  /** AnchorCheck: where its tip is, how present it is, how far through its test. */
  tool: { x: number; y: number; show: number; clamp: number } | null;
  /** The tape AnchorCheck lays along the rod (0..1). */
  tape: number;
  /** The handle is in a hand. */
  held: boolean;
  jointCue: number; puckCue: number; lensOut: boolean; podOn: boolean; wheelCue: number; wheelFocus: boolean;
}

function keyhole(r: number, half: number, top: number, corner: number): Path2D {
  const p = new Path2D(), dy = Math.sqrt(r * r - half * half), a = Math.atan2(-dy, half);
  p.moveTo(-half, -dy); p.lineTo(-half, top + corner); p.quadraticCurveTo(-half, top, -half + corner, top); p.lineTo(half - corner, top); p.quadraticCurveTo(half, top, half, top + corner); p.lineTo(half, -dy);
  p.arc(0, 0, r, a, Math.PI - a, false); p.closePath(); return p;
}
const boxPath = (x: number, y: number, w: number, h: number, r: number) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
const KEYHOLE = { r: 47, half: 23, top: -146 };
let pathCache: { key: Path2D; back: Path2D; cam: Path2D; wave: Path2D } | null = null;
function paths() {
  if (!pathCache) pathCache = { key: keyhole(KEYHOLE.r, KEYHOLE.half, KEYHOLE.top, 9), back: keyhole(KEYHOLE.r - 3, KEYHOLE.half - 3, KEYHOLE.top + 3, 7), cam: boxPath(-37, -46, 74, 88, 12), wave: boxPath(-20, -32, (WAVE_RODS - 1) * ROD_GAP + 40, 60, 12) };
  return pathCache;
}

/** Paint the whole world. The context already carries the world transform. */
export function paintScene(c: Ctx, P: Palette, img: PaintImages, s: Scene) {
  const M = mats(P);
  // The pavilion, far behind: three arches and the valley, soft with distance.
  if (img.roomImg) {
    c.drawImage(img.roomImg, s.room.x, s.room.y, s.room.size, s.room.size);
    // The floor runs on toward the camera: the picture's last rows, drawn out, with the light falling off.
    const foot = s.room.y + s.room.size - 1, more = s.room.size * 1.6;
    c.drawImage(img.roomImg, 0, 1004, 1024, 18, s.room.x, foot, s.room.size, more);
    c.fillStyle = lin(c, 0, foot, 0, foot + more, [[0, P.white, 0], [0.5, P.white, 0.3], [1, P.white, 0.45]]); c.fillRect(s.room.x, foot, s.room.size, more);
  }
  else { c.fillStyle = col(P.skyPale); c.fillRect(s.room.x, s.room.y, s.room.size, s.room.size); }
  // The bench's shadow on the pale floor: wide and soft under the body, darker at each wheel and foot.
  softShadow(c, P, BENCH.w / 2 + 10, 512, 400, 34, 0.3);
  for (const [x, y, r] of [[60, 506, 60], [150, 520, 34], [500, 530, 36], [600, 538, 62], [720, 480, 54]]) softShadow(c, P, x, y, r, r * 0.2, 0.34);
  paintChock(c, P, img, s);
  if (img.bench) c.drawImage(img.bench, 0, 0, BENCH.w, BENCH.h);
  if (s.lensOut) {
    // The ProofLens is out of its tray: the empty well.
    c.fillStyle = rad(c, PUCK.x, PUCK.y + 2, 4, 36, [[0, mix(P.graphite, P.shadow, 0.65)], [0.8, mix(P.graphite, P.shadow, 0.4)], [1, P.graphite, 0]]);
    c.beginPath(); c.ellipse(PUCK.x, PUCK.y + 1, 36, 21, 0, 0, TAU); c.fill();
  }
  if (s.puckCue > 0) cueRing(c, P, PUCK.x, PUCK.y - 2, 30, 18, s.time, s.puckCue, P.sea);
  if (s.podOn) { c.fillStyle = rad(c, POD.x, POD.y, 0, 26, [[0, P.sea, 0.5 + 0.3 * Math.sin(s.time * 6)], [1, P.sea, 0]]); c.beginPath(); c.arc(POD.x, POD.y, 26, 0, TAU); c.fill(); }
  paintBoard(c, P, M);
  paintCrate(c, P, M, s);
  paintBelts(c, P, M, s);
  paintWave(c, P, M, s);
  paintCam(c, P, M, s);
  paintPiston(c, P, M, s);
  if (s.jointCue > 0) { const j = pinAt(s.theta); cueRing(c, P, j.x, j.y, 12, 12, s.time, s.jointCue, P.signal); }
  const wanted = s.carry?.kind ?? s.ask;
  if (wanted) cueRing(c, P, SOCKET[wanted].x, SOCKET[wanted].y, 15, 15, s.time, s.carry ? 1 : 0.7, P.signal);
  if (s.carry) { softShadow(c, P, s.carry.x + 4, GROUND + 6, 16, 5, 0.25); paintPart(c, P, M, s.carry.kind, s.carry.x, s.carry.y, 1.2, s.carry.tilt, s); }
  if (s.tool && s.tool.show > 0) paintTool(c, P, img, s.tool);
}

function cueRing(c: Ctx, P: Palette, x: number, y: number, rx: number, ry: number, time: number, a: number, tone: RGB) {
  const beat = (time * 0.9) % 1;
  c.save(); c.lineWidth = 2.2;
  c.strokeStyle = col(P.white, 0.9 * a); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.stroke();
  c.strokeStyle = col(tone, (1 - beat) * 0.9 * a); c.lineWidth = 3 * (1 - beat) + 0.6;
  c.beginPath(); c.ellipse(x, y, rx * (1 + beat * 0.5), ry * (1 + beat * 0.5), 0, 0, TAU); c.stroke(); c.restore();
}

function paintChock(c: Ctx, P: Palette, img: PaintImages, s: Scene) {
  if (!img.chock) return;
  const breath = Math.sin(s.time * 1.7) * 0.006, k = s.chock.squash;
  c.save();
  softShadow(c, P, CHOCK.x + CHOCK.w * 0.5 + s.chock.dx, CHOCK.y + CHOCK.h - 5, 150 - s.chock.hop * 0.3, 15, 0.3);
  c.translate(CHOCK.x + CHOCK.w * 0.42 + s.chock.dx, CHOCK.y + CHOCK.h - s.chock.hop);
  c.rotate(s.chock.lean); c.scale(1 + k * 0.5, 1 - k + breath);
  c.drawImage(img.chock, -CHOCK.w * 0.42, -CHOCK.h, CHOCK.w, CHOCK.h);
  c.restore();
}

function paintBoard(c: Ctx, P: Palette, M: Mats) {
  const B = BOARD, [pale, mid, dark] = M.wood;
  // The board's shadow on the deck's grip mats.
  c.fillStyle = col(P.shadow, 0.34); c.beginPath(); c.moveTo(B.frontL - 4, B.front + B.thick + 5); c.lineTo(B.frontR + 6, B.front + B.thick + 5); c.lineTo(B.frontR + 2, B.front + 2); c.lineTo(B.frontL, B.front + 2); c.fill();
  const top = new Path2D(); top.moveTo(B.backL, B.back); top.lineTo(B.backR, B.back); top.lineTo(B.frontR, B.front); top.lineTo(B.frontL, B.front); top.closePath();
  c.fillStyle = lin(c, B.frontL, B.back, B.frontR, B.front, [[0, mix(pale, P.white, 0.35)], [0.45, pale], [1, mid]]); c.fill(top);
  c.save(); c.clip(top);
  // Grain: long soft lines that follow the plank, a few darker, one knot.
  for (let i = 0; i < 16; i++) {
    const t = (i + 0.5) / 16, y = lerp(B.back, B.front, t), wob = 1.2 + (i * 7 % 5) * 0.4;
    c.strokeStyle = col(dark, i % 5 === 2 ? 0.2 : 0.09); c.lineWidth = i % 4 === 1 ? 1 : 0.6; c.beginPath(); c.moveTo(B.frontL - 10, y);
    for (let x = B.frontL; x <= B.frontR + 20; x += 40) c.quadraticCurveTo(x + 20, y + Math.sin(i * 1.7 + x * 0.02) * wob, x + 40, y + Math.sin(i + x * 0.013) * 0.8);
    c.stroke();
  }
  c.strokeStyle = col(dark, 0.22); c.lineWidth = 0.8; c.beginPath(); c.ellipse(452, 229, 9, 3, 0, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(452, 229, 4.5, 1.4, 0, 0, TAU); c.stroke();
  c.restore();
  // The front edge, sawn and sanded, with the light catching its top corner.
  c.fillStyle = lin(c, 0, B.front, 0, B.front + B.thick, [[0, mid], [1, mix(dark, P.umber, 0.25)]]); c.fillRect(B.frontL, B.front, B.frontR - B.frontL, B.thick);
  c.strokeStyle = col(dark, 0.16); c.lineWidth = 0.6;
  for (let x = B.frontL + 9; x < B.frontR; x += 23) { c.beginPath(); c.moveTo(x, B.front + 1); c.lineTo(x + 5, B.front + B.thick - 1); c.stroke(); }
  c.strokeStyle = col(P.white, 0.7); c.lineWidth = 1; c.beginPath(); c.moveTo(B.frontL, B.front + 0.3); c.lineTo(B.frontR, B.front + 0.3); c.stroke();
  // Each machine's own shadow, lying on the board to the lower right.
  softShadow(c, P, S1.x + 12, GROUND + 5, 62, 9, 0.42); softShadow(c, P, S2.x + 8, GROUND + 4, 38, 7, 0.36); softShadow(c, P, S3.x + 50, GROUND + 4, 76, 7, 0.36);
}

function paintCrate(c: Ctx, P: Palette, M: Mats, s: Scene) {
  const { x, y, w, h } = CRATE, [pale, mid, dark] = M.wood;
  softShadow(c, P, x + w / 2 + 8, y + h + 2, w * 0.62, 8, 0.4);
  // Back and inside of the open box.
  c.fillStyle = col(mix(dark, P.umber, 0.45)); c.beginPath(); c.roundRect(x + 2, y - 9, w - 4, h, 3); c.fill();
  for (const kind of s.waiting) {
    const slot = CRATE_SLOT[kind];
    if (s.ask === kind) { const pulse = 0.5 + 0.5 * Math.sin(s.time * 5); c.fillStyle = rad(c, slot.x, slot.y - 6, 2, 26, [[0, P.white, 0.75], [0.5, P.signal, 0.35 + 0.2 * pulse], [1, P.signal, 0]]); c.beginPath(); c.arc(slot.x, slot.y - 6, 26, 0, TAU); c.fill(); }
    const bob = s.ask === kind ? Math.sin(s.time * 4) * 1.6 - 2 : 0;
    paintPart(c, P, M, kind, slot.x, slot.y + bob, 0.86, kind === 'flowerPart' ? -0.12 : kind === 'bellPart' ? 0.1 : 0, s);
  }
  // The front board, with its grain, a hand-hold and brass corners.
  c.fillStyle = lin(c, x, y, x + w, y + h, [[0, mix(pale, P.white, 0.25)], [0.6, pale], [1, mid]]); c.beginPath(); c.roundRect(x, y, w, h, 3); c.fill();
  c.strokeStyle = col(dark, 0.14); c.lineWidth = 0.6;
  for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(x + 2, y + i * h / 5); c.quadraticCurveTo(x + w / 2, y + i * h / 5 + (i % 2 ? 1.6 : -1.4), x + w - 2, y + i * h / 5); c.stroke(); }
  c.fillStyle = col(mix(dark, P.umber, 0.5), 0.75); c.beginPath(); c.roundRect(x + w / 2 - 11, y + 7, 22, 6, 3); c.fill();
  c.strokeStyle = col(P.white, 0.65); c.lineWidth = 0.9; c.beginPath(); c.moveTo(x + 3, y + 0.6); c.lineTo(x + w - 3, y + 0.6); c.stroke();
  for (const cx of [x + 5, x + w - 5]) for (const cy of [y + 5, y + h - 5]) rivet(c, cx, cy, 1.7, M.brass);
}

/** A part as it looks in the crate and in the hand. */
function paintPart(c: Ctx, P: Palette, M: Mats, kind: PartKind, x: number, y: number, scale: number, tilt: number, s: Scene) {
  c.save(); c.translate(x, y); c.rotate(tilt); c.scale(scale * UNIT, scale * UNIT);
  if (kind === 'flowerPart') { bar(c, 0, 26, 0, 0, 3.4, M.steel); c.scale(1.2, 1.2); flower(c, P, M.blooms[s.plan.bloom], 0, 0, 0.06, s.time); }
  else if (kind === 'beadsPart') [[-9, 2], [9, 3], [0, -8], [-15, -12], [14, -11], [1, -22]].forEach(([bx, by], i) => ball(c, bx, by - 4, 8.4, M.beads[s.plan.beads[i]], P));
  else bellShape(c, P, M, 0, -22, 0);
  c.restore();
}

function belt(c: Ctx, P: Palette, M: Mats, ax: number, ay: number, ar: number, bx: number, by: number, br: number, shown: number, travel: number) {
  if (shown <= 0) return;
  const a = Math.atan2(by - ay, bx - ax), nx = -Math.sin(a), ny = Math.cos(a);
  c.save(); c.lineCap = 'round';
  for (const side of [-1, 1]) {
    const x0 = ax + nx * ar * side, y0 = ay + ny * ar * side, x1 = lerp(x0, bx + nx * br * side, shown), y1 = lerp(y0, by + ny * br * side, shown);
    c.strokeStyle = col(P.shadow, 0.3); c.lineWidth = 3.4; c.beginPath(); c.moveTo(x0 + 1.5, y0 + 3); c.lineTo(x1 + 1.5, y1 + 3); c.stroke();
    c.strokeStyle = col(M.leather); c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = col(mix(M.leather, P.sand, 0.55)); c.lineWidth = 0.8; c.setLineDash([2.4, 3.2]); c.lineDashOffset = -travel * side; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.setLineDash([]);
  }
  c.restore();
}
function paintBelts(c: Ctx, P: Palette, M: Mats, s: Scene) {
  const travel = s.theta * 12;
  belt(c, P, M, S1.x, S1.y, 11.5, S2.x, S2.y + 2, 10.5, clamp01(s.flower * 1.6 - 0.5), travel);
  belt(c, P, M, S2.x, S2.y + 2, 10.5, S3.x, S3.y + 2, 8.6, clamp01(s.beads * 1.6 - 0.5), travel);
}
function pulley(c: Ctx, P: Palette, M: Mats, r: number, angle: number) {
  c.beginPath(); c.arc(1, 2.5, r + 0.6, 0, TAU); c.fillStyle = col(P.shadow, 0.3); c.fill();
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = col(M.leather); c.fill();
  disc(c, 0, 0, r - 2.4, M.brass);
  c.save(); c.rotate(angle);
  for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.beginPath(); c.arc(0, -(r - 2.4) * 0.56, (r - 2.4) * 0.2, 0, TAU); c.fillStyle = col(M.brass.dark, 0.85); c.fill(); }
  c.restore(); disc(c, 0, 0, (r - 2.4) * 0.3, M.steel);
}

/* ------------------------------------------------------------ the piston */
function paintPiston(c: Ctx, P: Palette, M: Mats, s: Scene) {
  const e = M.enamels[s.plan.enamel % 3], glass = clamp01(s.reveal[0]), th = s.theta, { key, back } = paths();
  const pin = crankPin(th), lift = pistonLift(th), knobY = -(lift + KNOB_RISE) - s.knobPop * 5;
  c.save(); c.translate(S1.x, S1.y); c.scale(UNIT, UNIT);
  // Foot and base plate.
  const foot = new Path2D(); foot.moveTo(-27, 34); foot.lineTo(27, 34); foot.lineTo(43, 80); foot.lineTo(-43, 80); foot.closePath();
  enamel(c, foot, -43, 43, 34, 80, e, P); bar(c, -50, 82, 50, 82, 7, M.brass);
  for (const x of [-40, 40]) rivet(c, x, 82, 2.3, M.steel);
  // The housing's top sliver (it is seen a little from above), then, behind glass or enamel, the works.
  c.save(); c.translate(0, -5); c.fillStyle = col(mix(e.deep, P.shadow, 0.35)); c.fill(key); c.restore();
  if (glass > 0) {
    inside(c, P, key, e, KEYHOLE.top, 47);
    c.fillStyle = lin(c, -20, 0, 20, 0, [[0, P.shadow, 0.5], [0.3, P.steelDark, 0.28], [0.6, P.steelDark, 0.2], [1, P.shadow, 0.55]]); c.fillRect(-20, KEYHOLE.top + 4, 40, 110);
    // Crank web with its counterweight, turning about the shaft.
    c.save(); c.rotate(th);
    disc(c, 0, 0, 36, M.iron);
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 35, Math.PI / 2 - 1.05, Math.PI / 2 + 1.05); c.closePath(); c.fillStyle = conic(c, 0, 0, 35, M.steel); c.fill();
    bar(c, 0, 0, 0, -LINKAGE.r, 15, M.steel);
    c.restore();
    disc(c, 0, 0, 7, M.brass);
    // The rod: one rigid bar from the crank pin to the wrist pin. Its two ends are the only places it is held.
    softShadow(c, P, (pin.x) / 2 + 3, (pin.y - lift) / 2 + 5, 14, 46, 0.25);
    bar(c, pin.x, pin.y, 0, -lift, 9.5, M.steel);
    ringOf(c, pin.x, pin.y, 11, 5.4, M.steel); disc(c, pin.x, pin.y, 5.6, M.brass);
    if (s.tape > 0) tape(c, P, pin.x, pin.y, 0, -lift, s.tape);
    // The piston: a brass block that can only slide in its bore.
    const py = -lift;
    c.fillStyle = lin(c, -20, 0, 20, 0, [[0, M.brass.dark], [0.2, M.brass.mid], [0.38, M.brass.spec], [0.55, M.brass.light], [0.8, M.brass.mid], [1, M.brass.dark]]);
    c.beginPath(); c.roundRect(-20, py - 20, 40, 32, 4); c.fill();
    c.fillStyle = col(M.brass.dark, 0.8); c.fillRect(-20, py - 14, 40, 2.2); c.fillRect(-20, py - 8.5, 40, 2.2);
    c.fillStyle = col(M.brass.spec, 0.7); c.fillRect(-18, py - 19, 36, 1.4);
    ringOf(c, 0, py, 8, 4, M.steel); disc(c, 0, py, 4.2, M.brass);
    bar(c, 0, py - 20, 0, knobY + 6, 6, M.steel, false);
  }
  if (glass < 1) {
    // Enamel, closed: nothing of the works to see but the knob on top.
    bar(c, 0, KEYHOLE.top - 2, 0, knobY + 6, 6, M.steel, false);
    enamel(c, key, -47, 47, KEYHOLE.top, 47, e, P, 1 - glass);
    c.save(); c.globalAlpha = 1 - glass; c.clip(key);
    // Gloss: a long window-light on the cylinder, a shorter one on the round case.
    const drift = Math.sin(s.time * 0.5) * 1.6;
    c.fillStyle = col(P.white, 0.34); c.beginPath(); c.roundRect(-14 + drift, KEYHOLE.top + 12, 4.5, 86, 2.2); c.fill();
    c.fillStyle = col(P.skyPale, 0.2); c.beginPath(); c.roundRect(-7, KEYHOLE.top + 18, 2, 70, 1); c.fill();
    c.strokeStyle = col(P.white, 0.3); c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, 38, -2.6, -1.9); c.stroke();
    c.restore();
    c.save(); c.globalAlpha = 1 - glass;
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.26; if (Math.abs(Math.sin(a)) * 41 < 21 && Math.cos(a) > 0) continue; rivet(c, Math.sin(a) * 41, -Math.cos(a) * 41, 2.2, M.brass); }
    c.restore();
  } else {
    c.save(); c.clip(key); c.strokeStyle = col(P.sky, 0.3); c.lineWidth = 9; c.stroke(key); c.fillStyle = col(P.white, 0.1); c.fillRect(-14, KEYHOLE.top + 12, 5, 86); c.restore();
  }
  if (glass > 0) { c.strokeStyle = col(P.white, 0.75 * glass); c.lineWidth = 1.6; c.stroke(key); c.strokeStyle = col(P.sky, 0.5 * glass); c.lineWidth = 0.8; c.stroke(back); }
  // Brass: the collar, the cap with its gland nut, and the knob that bobs.
  bar(c, -27, -46, 27, -46, 8, M.brass); bar(c, -27, KEYHOLE.top + 1, 27, KEYHOLE.top + 1, 9, M.brass); bar(c, -9, KEYHOLE.top - 7, 9, KEYHOLE.top - 7, 7, M.brass);
  softShadow(c, P, 2, knobY + 12, 9, 3, 0.3);
  ball(c, 0, knobY, 10 + s.knobPop * 1.5, mix(M.brass.mid, M.brass.light, 0.4), P);
  c.restore();

  // The flywheel, on the same shaft, in front.
  paintWheel(c, P, M, s, glass);
}

function tape(c: Ctx, P: Palette, x0: number, y0: number, x1: number, y1: number, shown: number) {
  // AnchorCheck's tape: fixed marks along the rod. The marks never spread: the rod never stretches.
  const len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
  c.save(); c.translate(x0, y0); c.rotate(a); c.globalAlpha *= shown;
  c.strokeStyle = col(P.focus); c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -9); c.lineTo(len * shown, -9); c.stroke();
  c.lineWidth = 1.4; for (let i = 0; i <= 6; i++) { const x = len * i / 6; if (x > len * shown + 0.1) break; c.beginPath(); c.moveTo(x, -13); c.lineTo(x, -5); c.stroke(); }
  c.restore();
}

function paintWheel(c: Ctx, P: Palette, M: Mats, s: Scene, glass: number) {
  const R = 73, th = s.theta, fast = clamp01((Math.abs(s.omega) - 5) / 6);
  c.save(); c.translate(WHEEL.x, WHEEL.y); c.scale(UNIT, UNIT); c.globalAlpha = 1 - glass * 0.74;
  // Its shadow on the housing behind it.
  c.save(); c.globalAlpha *= 0.3; c.strokeStyle = col(P.shadow); c.lineWidth = 15; c.beginPath(); c.arc(5, 8, R - 6, 0, TAU); c.stroke(); c.restore();
  // The rim's thickness, then five tapered spokes turning with the crank, then the rim's face.
  c.beginPath(); c.arc(0, -4.5, R, 0, TAU); c.arc(0, -4.5, R - 12, 0, TAU, true); c.fillStyle = col(M.brass.dark); c.fill('evenodd');
  c.save(); c.rotate(th); c.globalAlpha *= 1 - fast * 0.45;
  for (let i = 0; i < 5; i++) {
    c.save(); c.rotate(i * TAU / 5);
    c.fillStyle = lin(c, -6, 0, 6, 0, [[0, M.brass.dark], [0.3, M.brass.light], [0.5, M.brass.spec], [0.7, M.brass.mid], [1, M.brass.dark]]);
    c.beginPath(); c.moveTo(-6.5, -11); c.quadraticCurveTo(-3, -36, -4.2, -62); c.lineTo(4.2, -62); c.quadraticCurveTo(3, -36, 6.5, -11); c.closePath(); c.fill();
    c.restore();
  }
  c.restore();
  if (fast > 0) { c.save(); c.globalAlpha *= fast * 0.35; c.fillStyle = conic(c, 0, 0, 62, M.brass); c.beginPath(); c.arc(0, 0, 62, 0, TAU); c.arc(0, 0, 14, 0, TAU, true); c.fill('evenodd'); c.restore(); }
  ringOf(c, 0, 0, R, R - 12.5, M.brass);
  // A ring of small drilled marks on the rim: they show the turning when the spokes blur.
  c.save(); c.rotate(th); for (let i = 0; i < 10; i++) { c.rotate(TAU / 10); c.beginPath(); c.arc(0, -(R - 6.2), 1.5, 0, TAU); c.fillStyle = col(M.brass.dark, 0.8); c.fill(); c.beginPath(); c.arc(0.4, -(R - 5.8), 0.6, 0, TAU); c.fillStyle = col(M.brass.spec, 0.8); c.fill(); }
  c.restore();
  // Hub and nut.
  c.beginPath(); c.arc(1.5, 3, 16.5, 0, TAU); c.fillStyle = col(P.shadow, 0.3); c.fill();
  disc(c, 0, 0, 15.5, M.brass); disc(c, 0, 0, 6.4, M.steel);
  c.save(); c.rotate(th); c.fillStyle = col(M.steel.dark, 0.85); c.fillRect(-4.2, -0.9, 8.4, 1.8); c.restore();
  // The handle: a turned wooden knob on a brass stalk, set on a spoke. This is what a hand takes hold of.
  const hx = Math.sin(th) * 56, hy = -Math.cos(th) * 56;
  if (fast > 0.05) { c.save(); c.globalAlpha *= fast * 0.5; c.strokeStyle = col(M.wood[1]); c.lineWidth = 15; c.lineCap = 'round'; const a0 = th - Math.PI / 2, d = Math.sign(s.omega) * (0.25 + fast * 0.5); c.beginPath(); c.arc(0, 0, 56, Math.min(a0, a0 - d), Math.max(a0, a0 - d)); c.stroke(); c.restore(); }
  softShadow(c, P, hx + 5, hy + 8, 13, 9, 0.4);
  disc(c, hx, hy, 7.5, M.brass);
  const [pale, mid, dark] = M.wood, wood = mix(mid, P.orange, 0.22);
  if (s.held) { c.fillStyle = rad(c, hx, hy - 3, 6, 26, [[0, P.white, 0.6], [1, P.white, 0]]); c.beginPath(); c.arc(hx, hy - 3, 26, 0, TAU); c.fill(); }
  c.beginPath(); c.arc(hx, hy - 3, s.held ? 13.6 : 12.5, 0, TAU);
  c.fillStyle = rad(c, hx, hy - 3, 1, 15, [[0, mix(pale, P.white, 0.55)], [0.35, wood], [0.8, mix(dark, P.rust, 0.3)], [1, mix(dark, P.umber, 0.5)]], hx - 4.5, hy - 8.5); c.fill();
  c.strokeStyle = col(dark, 0.3); c.lineWidth = 0.7; for (const r of [4.5, 8.5]) { c.beginPath(); c.arc(hx, hy - 3, r, 0, TAU); c.stroke(); }
  c.fillStyle = col(P.white, 0.8); c.beginPath(); c.ellipse(hx - 4.6, hy - 8.6, 3.4, 1.9, -0.7, 0, TAU); c.fill();
  c.restore();
  if (s.wheelCue > 0) {
    // The way to go: a dotted arc ahead of the handle, clockwise.
    c.save(); c.translate(WHEEL.x, WHEEL.y); c.strokeStyle = col(P.white, 0.85 * s.wheelCue); c.lineWidth = 3; c.lineCap = 'round'; c.setLineDash([0.1, 8]);
    const a0 = th - Math.PI / 2 + 0.36; c.beginPath(); c.arc(0, 0, WHEEL.grip, a0, a0 + 1.5); c.stroke(); c.setLineDash([]);
    const a1 = a0 + 1.62, ax = Math.cos(a1) * WHEEL.grip, ay = Math.sin(a1) * WHEEL.grip;
    c.fillStyle = col(P.white, 0.9 * s.wheelCue); c.translate(ax, ay); c.rotate(a1 + Math.PI / 2); c.beginPath(); c.moveTo(6, 0); c.lineTo(-3, -5); c.lineTo(-3, 5); c.closePath(); c.fill(); c.restore();
  }
  if (s.wheelFocus) { c.strokeStyle = col(P.focus); c.lineWidth = 3; c.beginPath(); c.arc(WHEEL.x, WHEEL.y, WHEEL.r + 6, 0, TAU); c.stroke(); c.strokeStyle = col(P.white); c.lineWidth = 1.2; c.beginPath(); c.arc(WHEEL.x, WHEEL.y, WHEEL.r + 8.6, 0, TAU); c.stroke(); }
}

/* --------------------------------------------------------- the flower */
function flower(c: Ctx, P: Palette, tones: readonly [RGB, RGB, RGB], x: number, y: number, open: number, time: number, pop = 0) {
  const [deep, base, pale] = tones, o = clamp01(open), sway = Math.sin(time * 1.3) * 0.03;
  c.save(); c.translate(x, y); c.rotate(sway); c.scale(1 + pop * 0.18, 1 + pop * 0.18);
  // Two felt leaves on the stem, and the green cup the petals sit in.
  for (const side of [-1, 1]) { c.save(); c.translate(0, 12); c.rotate(side * (0.75 + o * 0.25)); c.fillStyle = lin(c, 0, 0, 0, -17, [[0, P.leafDeep], [1, P.leaf]]); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(6.5, -9, 0, -18); c.quadraticCurveTo(-6.5, -9, 0, 0); c.fill(); c.strokeStyle = col(P.spring, 0.6); c.lineWidth = 0.6; c.setLineDash([1.6, 1.8]); c.beginPath(); c.moveTo(0, -2); c.lineTo(0, -15); c.stroke(); c.setLineDash([]); c.restore(); }
  const petal = (angle: number, len: number, wide: number, shade: number) => {
    c.save(); c.rotate(angle);
    c.fillStyle = lin(c, 0, 0, 0, -len, [[0, mix(deep, P.shadow, 0.15 + shade * 0.2)], [0.45, mix(base, deep, shade)], [1, mix(pale, base, shade)]]);
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(wide, -len * 0.25, wide * 0.9, -len * 0.85, 0, -len); c.bezierCurveTo(-wide * 0.9, -len * 0.85, -wide, -len * 0.25, 0, 0); c.fill();
    // Felt: a line of small stitches up the middle.
    c.strokeStyle = col(mix(pale, P.white, 0.4), 0.7); c.lineWidth = 0.7; c.setLineDash([1.8, 2]); c.beginPath(); c.moveTo(0, -len * 0.18); c.lineTo(0, -len * 0.84); c.stroke(); c.setLineDash([]);
    c.restore();
  };
  const spread = lerp(0.14, 1.12, o), len = lerp(25, 29, o), wide = lerp(6, 12.5, o);
  for (const k of [-2, 2, -1, 1, 0]) petal(k * spread * 0.62 + 0.06, len * (k === 0 ? 1 : 0.96), wide, 0.45);
  for (const k of [-1.5, 1.5, -0.5, 0.5]) petal(k * spread * 0.74, len * 0.8, wide * 0.9, 0);
  c.fillStyle = lin(c, -7, 0, 7, 0, [[0, P.leafDeep], [0.4, P.leaf], [1, P.leafDeep]]); c.beginPath(); c.moveTo(-6.5, -5); c.quadraticCurveTo(0, -9, 6.5, -5); c.lineTo(3.4, 4); c.lineTo(-3.4, 4); c.closePath(); c.fill();
  if (o > 0.3) ball(c, 0, -lerp(7, 10, o), lerp(0, 6.6, clamp01((o - 0.3) / 0.5)), P.sun, P, 0.6);
  c.restore();
}

function paintCam(c: Ctx, P: Palette, M: Mats, s: Scene) {
  const e = M.enamels[(s.plan.enamel + 1) % 3], glass = clamp01(s.reveal[1]), a = camAngle(s.theta), lift = camLift(a), top = -(lift + STEM), { cam } = paths();
  c.save(); c.translate(S2.x, S2.y); c.scale(UNIT, UNIT);
  c.save(); c.translate(0, -5); c.fillStyle = col(mix(e.deep, P.shadow, 0.35)); c.fill(cam); c.restore();
  for (const x of [-27, 27]) bar(c, x - 7, 44, x + 7, 44, 6, M.brass);
  // The stem rises through a brass bush; the flower, once planted, rides on its cup.
  bar(c, 0, -lift + 2, 0, top, 5, M.steel, false);
  if (glass > 0) {
    inside(c, P, cam, e, -46, 42);
    // The cam: a round brass disc set off-centre on its shaft. Its top pushes the flat follower.
    const cc = camCentre(a);
    softShadow(c, P, cc.x + 3, cc.y + 5, CAM.R + 3, CAM.R + 3, 0.35);
    disc(c, cc.x, cc.y, CAM.R, M.brass);
    c.save(); c.translate(cc.x, cc.y); c.rotate(a); for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.beginPath(); c.arc(0, 11.5, 4.2, 0, TAU); c.fillStyle = col(mix(e.deep, P.shadow, 0.8)); c.fill(); c.strokeStyle = col(M.brass.spec, 0.5); c.lineWidth = 0.6; c.stroke(); }
    c.restore();
    disc(c, 0, 0, 5.5, M.steel); c.save(); c.rotate(a); c.fillStyle = col(M.steel.dark); c.fillRect(-1, -5, 2, 3.4); c.restore();
    bar(c, -19, -lift - 2.4, 19, -lift - 2.4, 5, M.steel);
    bar(c, 0, -lift - 4, 0, -48, 5, M.steel, false);
    c.strokeStyle = col(P.white, 0.75 * glass); c.lineWidth = 1.6; c.stroke(cam);
  }
  if (glass < 1) {
    enamel(c, cam, -37, 37, -46, 42, e, P, 1 - glass);
    c.save(); c.globalAlpha = 1 - glass; c.clip(cam); c.fillStyle = col(P.white, 0.3); c.beginPath(); c.roundRect(-27, -38, 4.5, 50, 2.2); c.fill(); c.fillStyle = col(P.skyPale, 0.18); c.beginPath(); c.roundRect(-20, -34, 2, 38, 1); c.fill(); c.restore();
    c.save(); c.globalAlpha = 1 - glass; for (const x of [-1, 1]) for (const y of [-1, 1]) corner(c, M, x * 37, y < 0 ? -46 : 42, x, y); plate(c, P, M, 0, 27, 30, 9); c.restore();
  }
  bar(c, -39, -48, 39, -48, 7, M.brass); bar(c, -8, -56, 8, -56, 9, M.brass);
  // The pulley on the front, turning with the cam.
  c.save(); c.translate(0, 3); c.globalAlpha = 1 - glass * 0.72; pulley(c, P, M, 14.5, a); c.restore();
  // Cup and flower.
  bar(c, -5, top, 5, top, 5, M.brass);
  if (s.flower > 0) {
    const arrive = clamp01(s.flower * 2.2), open = s.flower >= 1 ? bloomOpen(a) : 0.04;
    c.save(); c.translate(0, top - 8 - (1 - arrive) * 30); c.globalAlpha = arrive; const squash = 1 + Math.sin(clamp01(s.flower * 2.2 - 1) * Math.PI) * 0.16; c.scale(squash, 2 - squash);
    c.scale(1.34, 1.34); flower(c, P, M.blooms[s.plan.bloom], 0, 0, open, s.time, s.bloomPop); c.restore();
  }
  c.restore();
}

/* ------------------------------------------------------- the bead rods */
function bellShape(c: Ctx, P: Palette, M: Mats, x: number, y: number, swing: number) {
  c.save(); c.translate(x, y); c.rotate(swing);
  c.fillStyle = lin(c, -15, 0, 15, 0, [[0, M.brass.dark], [0.22, M.brass.mid], [0.4, M.brass.spec], [0.55, M.brass.light], [0.82, M.brass.mid], [1, M.brass.dark]]);
  c.beginPath(); c.moveTo(-4, 2); c.bezierCurveTo(-13, 5, -10, 20, -16, 25); c.quadraticCurveTo(0, 30, 16, 25); c.bezierCurveTo(10, 20, 13, 5, 4, 2); c.closePath(); c.fill();
  c.strokeStyle = col(M.brass.dark, 0.6); c.lineWidth = 0.8; c.stroke();
  c.fillStyle = col(M.brass.dark, 0.5); c.beginPath(); c.ellipse(0, 25.4, 15.4, 3, 0, 0, TAU); c.fill();
  c.strokeStyle = col(M.brass.spec, 0.8); c.lineWidth = 1; c.beginPath(); c.moveTo(-9.5, 20.5); c.quadraticCurveTo(0, 24, 9.5, 20.5); c.stroke();
  ball(c, 0, 27, 3.4, M.steel.mid, P); disc(c, 0, 1, 3.6, M.brass);
  c.restore();
}
function paintWave(c: Ctx, P: Palette, M: Mats, s: Scene) {
  const e = M.enamels[(s.plan.enamel + 2) % 3], glass = clamp01(s.reveal[2]), { wave } = paths(), span = (WAVE_RODS - 1) * ROD_GAP;
  c.save(); c.translate(S3.x, S3.y); c.scale(UNIT, UNIT);
  // The bell on its hook, over the last rod.
  if (s.bell > 0) {
    const bx = (BELL.x - S3.x) / UNIT, by = (BELL.y - S3.y) / UNIT, drop = (1 - clamp01(s.bell * 1.4)) * -34;
    c.save(); c.globalAlpha = clamp01(s.bell * 3);
    c.strokeStyle = col(M.steel.dark); c.lineWidth = 4.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(span + 30, 28); c.lineTo(span + 30, by + 6); c.quadraticCurveTo(span + 30, by - 12, bx + 8, by - 10); c.quadraticCurveTo(bx, by - 9, bx, by - 2); c.stroke();
    c.strokeStyle = col(M.steel.spec, 0.7); c.lineWidth = 1.1; c.beginPath(); c.moveTo(span + 28.8, 26); c.lineTo(span + 28.8, by + 6); c.stroke();
    bellShape(c, P, M, bx, by + drop, s.bellSwing);
    c.restore();
  }
  c.save(); c.translate(0, -5); c.fillStyle = col(mix(e.deep, P.shadow, 0.35)); c.fill(wave); c.restore();
  for (const x of [-10, span + 10]) bar(c, x - 7, 30, x + 7, 30, 6, M.brass);
  const tops: number[] = [];
  for (let i = 0; i < WAVE_RODS; i++) { const lift = waveLift(i, s.theta); tops.push(-(lift + ROD_RISE)); bar(c, i * ROD_GAP, -lift, i * ROD_GAP, tops[i], 3.6, M.steel, false); }
  if (glass > 0) {
    inside(c, P, wave, e, -32, 28);
    // The belt that turns all six, then six small cranks, each set a step later than its neighbour.
    c.strokeStyle = col(M.leather); c.lineWidth = 2.6; c.beginPath(); c.moveTo(0, 7.4); c.lineTo(span, 7.4); c.moveTo(0, -7.4); c.lineTo(span, -7.4); c.stroke();
    c.strokeStyle = col(mix(M.leather, P.sand, 0.5)); c.lineWidth = 0.7; c.setLineDash([2, 3]); c.lineDashOffset = -s.theta * 7.4; c.beginPath(); c.moveTo(0, 7.4); c.lineTo(span, 7.4); c.stroke(); c.setLineDash([]);
    for (let i = 0; i < WAVE_RODS; i++) {
      const x = i * ROD_GAP, a = waveAngle(i, s.theta), p = crankPin(a, WAVE_LINK), lift = waveLift(i, s.theta);
      disc(c, x, 0, 10.6, M.iron);
      c.save(); c.translate(x, 0); c.rotate(a); bar(c, 0, 0, 0, -WAVE_LINK.r, 5.5, M.steel); c.restore();
      bar(c, x + p.x, p.y, x, -lift, 3.6, M.steel);
      disc(c, x + p.x, p.y, 3, M.brass);
      c.fillStyle = lin(c, x - 5, 0, x + 5, 0, [[0, M.brass.dark], [0.4, M.brass.spec], [1, M.brass.mid]]); c.beginPath(); c.roundRect(x - 5, -lift - 5, 10, 9, 2); c.fill();
    }
    c.strokeStyle = col(P.white, 0.75 * glass); c.lineWidth = 1.6; c.stroke(wave);
  }
  if (glass < 1) {
    enamel(c, wave, -20, span + 20, -32, 28, e, P, 1 - glass);
    c.save(); c.globalAlpha = 1 - glass; c.clip(wave); c.fillStyle = col(P.white, 0.26); c.beginPath(); c.roundRect(-12, -24, span * 0.5, 4, 2); c.fill(); c.fillStyle = col(P.skyPale, 0.16); c.beginPath(); c.roundRect(-12, -17, span * 0.3, 2, 1); c.fill(); c.restore();
    c.save(); c.globalAlpha = 1 - glass; for (const x of [-1, 1]) for (const y of [-1, 1]) corner(c, M, x < 0 ? -20 : span + 20, y < 0 ? -32 : 28, x, y); plate(c, P, M, span / 2, 12, 46, 9); c.restore();
  }
  bar(c, -22, -34, span + 22, -34, 7, M.brass);
  for (let i = 0; i < WAVE_RODS; i++) bar(c, i * ROD_GAP - 4.5, -39, i * ROD_GAP + 4.5, -39, 6, M.brass);
  c.save(); c.translate(0, 3); c.globalAlpha = 1 - glass * 0.72; pulley(c, P, M, 12, waveAngle(0, s.theta)); c.restore();
  // The beads: painted wooden balls. Each drops onto its rod in turn; each glows as it tops out.
  for (let i = 0; i < WAVE_RODS; i++) {
    const here = clamp01(s.beads * (WAVE_RODS + 1.5) - i * 1.1);
    if (here <= 0) { bar(c, i * ROD_GAP - 2.4, tops[i], i * ROD_GAP + 2.4, tops[i], 2.4, M.brass); continue; }
    const x = i * ROD_GAP, y = tops[i] - 7 - (1 - here) * (1 - here) * 46, pop = s.beadPop[i] ?? 0, tone = M.beads[s.plan.beads[i]];
    if (pop > 0) { c.fillStyle = rad(c, x, y, 2, 26, [[0, P.white, 0.8 * pop], [0.4, tone, 0.5 * pop], [1, tone, 0]]); c.beginPath(); c.arc(x, y, 26, 0, TAU); c.fill(); }
    ball(c, x, y - pop * 2.5, 9 * (1 + pop * 0.22), tone, P);
  }
  c.restore();
}

function paintTool(c: Ctx, P: Palette, img: PaintImages, tool: NonNullable<Scene['tool']>) {
  // AnchorCheck (the kit's own render): its tip on the joint, a teal ring as it tests.
  c.save(); c.globalAlpha = clamp01(tool.show);
  if (tool.clamp > 0) {
    for (let k = 0; k < 3; k++) { const t = clamp01(tool.clamp * 3 - k); if (t <= 0 || t >= 1) continue; c.strokeStyle = col(P.focus, (1 - t) * 0.9); c.lineWidth = 2.4 * (1 - t) + 0.6; c.beginPath(); c.arc(tool.x, tool.y, 6 + t * 20, 0, TAU); c.stroke(); }
    c.fillStyle = col(P.white, 0.9); c.beginPath(); c.arc(tool.x, tool.y, 3.2, 0, TAU); c.fill(); c.fillStyle = col(P.focus); c.beginPath(); c.arc(tool.x, tool.y, 2, 0, TAU); c.fill();
  }
  if (img.tool) {
    const k = 0.2, w = 495 * k, h = 304 * k, tipX = 20 * k, tipY = 244 * k;
    softShadow(c, P, tool.x + 56, GROUND + 10, 44, 6, 0.22 * tool.show);
    c.translate(tool.x, tool.y); c.rotate(0.14 + (1 - tool.show) * 0.5); c.drawImage(img.tool, -tipX, -tipY, w, h);
  }
  c.restore();
}

/* -------------------------------------------------------------- the lens */
/** The ProofLens, held over the machine: a puck of pearl shell and graphite
 * with a cyan light, and in its glass the same machine with its housings
 * clear. `glass` is that picture, already painted, the size of the lens. */
export function paintLens(c: Ctx, P: Palette, x: number, y: number, R: number, glass: CanvasImageSource | null, lit: number, time: number, grow = 1) {
  const M = mats(P), r = R * grow, rim = Math.max(7, r * 0.15), inner = r - rim;
  c.save();
  c.fillStyle = rad(c, x + r * 0.16, y + r * 0.3, r * 0.5, r * 1.25, [[0, P.shadow, 0.34], [1, P.shadow, 0]]); c.beginPath(); c.arc(x + r * 0.16, y + r * 0.3, r * 1.25, 0, TAU); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, inner, 0, TAU); c.clip();
  if (glass) c.drawImage(glass, x - inner, y - inner, inner * 2, inner * 2); else { c.fillStyle = col(P.indigoDeep); c.fillRect(x - r, y - r, r * 2, r * 2); }
  // The glass itself: a cool edge, a curved window-light, a sweep that drifts.
  c.fillStyle = rad(c, x, y, inner * 0.55, inner, [[0, P.sea, 0], [0.8, P.sea, 0.1], [1, P.indigoDeep, 0.5]]); c.fillRect(x - r, y - r, r * 2, r * 2);
  c.strokeStyle = col(P.white, 0.4); c.lineWidth = inner * 0.09; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, inner * 0.8, -2.55, -1.75); c.stroke();
  c.strokeStyle = col(P.white, 0.16); c.lineWidth = inner * 0.05; c.beginPath(); c.arc(x, y, inner * 0.84, 0.6, 1.2); c.stroke();
  const sweep = ((time * 0.35) % 1) * 2 - 1; c.fillStyle = lin(c, x + sweep * inner - 14, y, x + sweep * inner + 14, y, [[0, P.white, 0], [0.5, P.white, 0.09], [1, P.white, 0]]); c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
  // Shell: pearl ring, graphite bezel, the cyan light (brighter when it has found a part), the orange button.
  ringOf(c, x, y, r, inner + rim * 0.34, M.steel);
  c.beginPath(); c.arc(x, y, inner + rim * 0.36, 0, TAU); c.arc(x, y, inner, 0, TAU, true); c.fillStyle = col(mix(P.graphite, P.shadow, 0.35)); c.fill('evenodd');
  const glow = 0.5 + 0.5 * lit;
  c.strokeStyle = col(mix(P.sea, P.white, 0.25 * lit), glow); c.lineWidth = rim * 0.17; c.beginPath(); c.arc(x, y, inner + rim * 0.18, Math.PI * 0.62 - lit * 2.6, Math.PI * 0.62 + 0.9 + lit * 2.6); c.stroke();
  const ba = -0.55; c.save(); c.translate(x + Math.cos(ba) * (r - rim * 0.34), y + Math.sin(ba) * (r - rim * 0.34)); c.rotate(ba + Math.PI / 2);
  c.fillStyle = lin(c, 0, -rim * 0.3, 0, rim * 0.3, [[0, mix(P.orange, P.white, 0.3)], [1, mix(P.orange, P.rust, 0.5)]]); c.beginPath(); c.roundRect(-rim * 0.62, -rim * 0.26, rim * 1.24, rim * 0.52, rim * 0.24); c.fill(); c.restore();
  c.restore();
}

/** A soft fingertip hint: where a hand would take hold. Screen space. */
export function paintHint(c: Ctx, P: Palette, x: number, y: number, press: number, show: number) {
  if (show <= 0) return;
  c.save(); c.globalAlpha = show; const r = 17 - press * 3;
  c.fillStyle = rad(c, x, y, r * 0.2, r * 1.9, [[0, P.white, 0.55], [1, P.white, 0]]); c.beginPath(); c.arc(x, y, r * 1.9, 0, TAU); c.fill();
  c.fillStyle = col(P.white, 0.92); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.strokeStyle = col(P.graphite, 0.55); c.lineWidth = 2; c.stroke();
  c.restore();
}
