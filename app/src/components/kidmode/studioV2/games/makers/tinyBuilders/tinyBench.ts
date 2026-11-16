import { IDENTITY, RAD, project, type Frame, type V3, type View } from './tinyMesh';
import { blend, drawGlowRing, drawShadow, ink, type Palette, type Rgb } from './tinyRender';
import { PAD_RADIUS } from './tinyBuildersRules';

/** Tiny Structures: the TrailBench top, drawn in the same camera and light as
 * everything that stands on it. The far rail runs across the picture; the
 * deck is the TrailBench's dark grip mat in its pale shell, lit from the
 * windows behind; the model's turntable is a white disc with a teal ring of
 * light. Kit pictures (Aya, the ProofLens, the LeafLab) are placed on that
 * same ground with contact shadows. */

export const RAIL_Z = -12.6;
const WHITE: Rgb = [255, 255, 255];
/** A rounded box where the browser has one, a plain box where it does not. */
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2))); else ctx.rect(x, y, w, h);
}

export interface BenchState {
  /** The turntable's turn in degrees (its tick marks show it). */
  yaw: number;
  /** The teal ring of light, 0 to 1.5. */
  ring: number;
  /** How much of the stand rod is up, 0 to 1. */
  rod: number;
  time: number;
}

function quad(ctx: CanvasRenderingContext2D, view: View, pts: readonly V3[]) {
  ctx.beginPath();
  pts.forEach((p, i) => { const s = project(view, p); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); });
  ctx.closePath();
}

/** The deck and its far rail, from the rail down to the bottom of the picture. */
export function drawDeck(ctx: CanvasRenderingContext2D, view: View, w: number, h: number, p: Palette, time: number): void {
  const far = project(view, [0, 0, RAIL_Z]), railTop = project(view, [0, 1.15, RAIL_Z]), railFront = project(view, [0, 0, RAIL_Z + 1.5]);
  const shell = p.tone('snow'), shellShade = p.tone('snow-shade'), matFar = blend(p.tone('slate'), p.tone('steel'), 0.35), matNear = blend(p.tone('graphite'), p.tone('shadow'), 0.25);
  // The mat: lighter where it runs toward the windows.
  const g = ctx.createLinearGradient(0, far.y, 0, h);
  g.addColorStop(0, ink(matFar)); g.addColorStop(0.35, ink(blend(matFar, matNear, 0.55))); g.addColorStop(1, ink(matNear));
  ctx.fillStyle = g; ctx.fillRect(0, far.y, w, h - far.y);
  // The windows, mirrored softly in the mat: three pale streaks that spread toward the eye.
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (const x of [-15, 0, 15]) {
    const a = project(view, [x - 3.4, 0, RAIL_Z + 1.5]), b = project(view, [x + 3.4, 0, RAIL_Z + 1.5]), c = project(view, [x * 1.5 + 6, 0, 22]), d = project(view, [x * 1.5 - 6, 0, 22]);
    const s = ctx.createLinearGradient(0, a.y, 0, c.y);
    s.addColorStop(0, ink(p.tone('sky-pale'), 0.34)); s.addColorStop(0.5, ink(p.tone('sky-pale'), 0.1)); s.addColorStop(1, ink(p.tone('sky-pale'), 0));
    ctx.fillStyle = s; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // The mat's grooves: fine lines running away and across, in perspective.
  ctx.lineWidth = 1;
  for (let z = RAIL_Z + 3; z < 40; z += 2.6) {
    const a = project(view, [-60, 0, z]), b = project(view, [60, 0, z]); if (a.y > h + 4) break;
    ctx.strokeStyle = ink(p.tone('shadow'), 0.16); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = ink(WHITE, 0.035); ctx.beginPath(); ctx.moveTo(a.x, a.y + 1); ctx.lineTo(b.x, b.y + 1); ctx.stroke();
  }
  for (let x = -54; x <= 54; x += 6) {
    const a = project(view, [x, 0, RAIL_Z + 1.5]), b = project(view, [x, 0, 44]);
    ctx.strokeStyle = ink(p.tone('shadow'), 0.1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // The rail: the pale shell's raised lip, with the bench's orange clips and its cyan light.
  const railG = ctx.createLinearGradient(0, railTop.y, 0, railFront.y);
  railG.addColorStop(0, ink(WHITE)); railG.addColorStop(0.3, ink(shell)); railG.addColorStop(1, ink(blend(shellShade, p.tone('steel'), 0.3)));
  ctx.fillStyle = railG; ctx.fillRect(0, railTop.y, w, railFront.y - railTop.y);
  ctx.fillStyle = ink(p.tone('shadow'), 0.34); ctx.fillRect(0, railFront.y, w, Math.max(2, (railFront.y - railTop.y) * 0.28));
  ctx.fillStyle = ink(WHITE, 0.9); ctx.fillRect(0, railTop.y, w, Math.max(1, (railFront.y - railTop.y) * 0.1));
  for (const x of [-21, -7.5, 7.5, 21]) {
    const a = project(view, [x - 0.9, 0.9, RAIL_Z + 0.8]), b = project(view, [x + 0.9, 0.2, RAIL_Z + 1.5]);
    ctx.fillStyle = ink(p.tone('orange')); box(ctx, a.x, a.y, b.x - a.x, Math.max(3, b.y - a.y), 3); ctx.fill();
    ctx.fillStyle = ink(WHITE, 0.4); ctx.fillRect(a.x + 1, a.y + 1, b.x - a.x - 2, 1.5);
  }
  const pulse = 0.6 + 0.4 * Math.sin(time * 1.3);
  for (const x of [-14.2, 14.2]) {
    const a = project(view, [x - 3.6, 0.62, RAIL_Z + 1.2]), b = project(view, [x + 3.6, 0.38, RAIL_Z + 1.4]);
    ctx.save(); ctx.shadowColor = ink(p.tone('sea'), 0.9 * pulse); ctx.shadowBlur = 10;
    ctx.fillStyle = ink(blend(p.tone('sea'), WHITE, 0.35 + 0.3 * pulse)); box(ctx, a.x, a.y, b.x - a.x, Math.max(2.5, b.y - a.y), 2); ctx.fill(); ctx.restore();
  }
}

const FLAT: Frame = { m: IDENTITY, at: [0, 0, 0], scale: 1 };
/** The turntable: a white ceramic disc on the mat, its teal ring of light, tick marks that turn with it, and the glass stand rod. */
export function drawTurntable(ctx: CanvasRenderingContext2D, view: View, p: Palette, state: BenchState): void {
  const flat = Math.sin(view.elev * RAD), c0 = project(view, [0, 0, 0]), c1 = project(view, [0, 0.42, 0]);
  const R0 = PAD_RADIUS * c0.s, R1 = PAD_RADIUS * c1.s;
  drawShadow(ctx, view, [0, 0, 0.4], PAD_RADIUS * 1.22, 0.55, p.tone('shadow'));
  // The side band, then the top.
  ctx.fillStyle = ink(blend(p.tone('teal'), p.tone('teal-deep'), 0.4));
  ctx.beginPath(); ctx.ellipse(c0.x, c0.y, R0, R0 * flat, 0, 0, Math.PI); ctx.lineTo(c1.x - R1, c1.y); ctx.ellipse(c1.x, c1.y, R1, R1 * flat, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  const top = ctx.createLinearGradient(c1.x - R1, c1.y - R1 * flat, c1.x + R1 * 0.6, c1.y + R1 * flat);
  top.addColorStop(0, ink(WHITE)); top.addColorStop(0.55, ink(p.tone('snow'))); top.addColorStop(1, ink(blend(p.tone('snow-shade'), p.tone('snow'), 0.35)));
  ctx.fillStyle = top; ctx.beginPath(); ctx.ellipse(c1.x, c1.y, R1, R1 * flat, 0, 0, Math.PI * 2); ctx.fill();
  // Tick marks, turning with the table.
  ctx.strokeStyle = ink(p.tone('steel'), 0.75); ctx.lineCap = 'round';
  for (let k = 0; k < 24; k++) {
    const a = (k * 15 + state.yaw) * RAD, long = k % 6 === 0;
    const at = (r: number) => project(view, [r * Math.cos(a), 0.42, r * Math.sin(a)]);
    const i = at(PAD_RADIUS * (long ? 0.86 : 0.9)), o = at(PAD_RADIUS * 0.95);
    ctx.lineWidth = Math.max(0.8, (long ? 0.12 : 0.07) * i.s); ctx.beginPath(); ctx.moveTo(i.x, i.y); ctx.lineTo(o.x, o.y); ctx.stroke();
  }
  // The inlaid ring of light.
  const frame: Frame = { ...FLAT, at: [0, 0.42, 0] };
  ctx.strokeStyle = ink(p.tone('teal'), 0.9); ctx.lineWidth = Math.max(1.2, 0.22 * c1.s);
  ctx.beginPath(); ctx.ellipse(c1.x, c1.y, R1 * 0.78, R1 * 0.78 * flat, 0, 0, Math.PI * 2); ctx.stroke();
  drawGlowRing(ctx, view, frame, 0, PAD_RADIUS * 0.78, blend(p.tone('sea'), WHITE, 0.3), (0.28 + 0.1 * Math.sin(state.time * 1.6)) + state.ring, 0.14);
  // The stand rod: clear glass, a bright edge and a soft core.
  if (state.rod > 0.02) {
    const foot = project(view, [0, 0.42, 0]), tip = project(view, [0, 0.42 + 13.4 * state.rod, 0]), r = Math.max(1, 0.15 * foot.s);
    const g = ctx.createLinearGradient(foot.x - r, 0, foot.x + r, 0);
    g.addColorStop(0, ink(WHITE, 0.75)); g.addColorStop(0.4, ink(p.tone('sky-pale'), 0.28)); g.addColorStop(1, ink(p.tone('steel-light'), 0.65));
    ctx.fillStyle = g; box(ctx, foot.x - r, tip.y, r * 2, foot.y - tip.y, r); ctx.fill();
    ctx.fillStyle = ink(p.tone('steel-light')); ctx.beginPath(); ctx.ellipse(foot.x, foot.y, r * 3.2, r * 3.2 * flat, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ink(WHITE, 0.8); ctx.beginPath(); ctx.ellipse(foot.x, foot.y - r * 0.3, r * 2, r * 2 * flat, 0, 0, Math.PI * 2); ctx.fill();
  }
}

export interface Sprite { image: HTMLImageElement | null; /** The part of the picture to show: x, y, width, height in its pixels. */ crop?: readonly [number, number, number, number] }
/** A kit picture standing or lying on the bench: `width` in units, its base
 * centre at a world point. `rise` lifts it; `lean` tilts it (degrees). */
export function drawSprite(ctx: CanvasRenderingContext2D, view: View, sprite: Sprite, at: V3, width: number, opts: { baseline?: number; lean?: number; alpha?: number; squash?: number } = {}): { x: number; y: number; w: number; h: number } | null {
  const img = sprite.image; if (!img || !img.complete || !img.naturalWidth) return null;
  const [sx, sy, sw, sh] = sprite.crop ?? [0, 0, img.naturalWidth, img.naturalHeight];
  const p = project(view, at), w = width * p.s, h = w * sh / sw, baseline = opts.baseline ?? 1, squash = opts.squash ?? 1;
  ctx.save(); ctx.translate(p.x, p.y); if (opts.lean) ctx.rotate(opts.lean * RAD); ctx.scale(1 / Math.sqrt(squash), squash);
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h * baseline, w, h);
  ctx.restore();
  return { x: p.x - w / 2, y: p.y - h * baseline, w, h };
}

/** A drop of pond water: a small clear dome with the window in it. */
export function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, p: Palette, glow = 0): void {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.45, r * 0.1, x, y, r);
  g.addColorStop(0, ink(WHITE, 0.95)); g.addColorStop(0.35, ink(p.tone('sky-pale'), 0.8)); g.addColorStop(0.8, ink(p.tone('celadon'), 0.75)); g.addColorStop(1, ink(p.tone('teal'), 0.85));
  ctx.fillStyle = ink(p.tone('shadow'), 0.25); ctx.beginPath(); ctx.ellipse(x + r * 0.1, y + r * 0.55, r * 1.05, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.78, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ink(WHITE, 0.9); ctx.beginPath(); ctx.ellipse(x - r * 0.32, y - r * 0.3, r * 0.26, r * 0.14, -0.5, 0, Math.PI * 2); ctx.fill();
  if (glow > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; const s = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2); s.addColorStop(0, ink(p.tone('sky'), 0.7 * glow)); s.addColorStop(1, ink(p.tone('sky'), 0)); ctx.fillStyle = s; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
}

/** Dust in the window light: a few slow motes, each on its own lazy path. */
export function drawMotes(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, p: Palette, count = 14): void {
  for (let i = 0; i < count; i++) {
    const a = i * 12.9898, b = i * 78.233;
    const fx = (Math.sin(a) * 43758.5453) % 1, fy = (Math.sin(b) * 12543.123) % 1;
    const x = ((Math.abs(fx) + time * (0.004 + 0.003 * (i % 4))) % 1) * w, y = (Math.abs(fy) * 0.55 + 0.04 * Math.sin(time * 0.3 + i)) * h;
    const r = 0.8 + (i % 3) * 0.6, alpha = 0.16 + 0.16 * Math.sin(time * 0.7 + i * 1.7);
    ctx.fillStyle = ink(blend(p.tone('butter'), WHITE, 0.6), Math.max(0, alpha)); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

/** A marking ring: the "next" cue. It marks a thing and never fills. */
export function drawCue(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, time: number, colour: Rgb): void {
  const beat = (time * 0.9) % 1, grow = 1 + 0.16 * beat;
  ctx.strokeStyle = ink(colour, 0.95 * (1 - beat * 0.7)); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(x, y, rx * grow, ry * grow, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = ink(WHITE, 0.6 * (1 - beat)); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(x, y, rx * grow + 3, ry * grow + 3, 0, 0, Math.PI * 2); ctx.stroke();
}
