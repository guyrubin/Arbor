import { DIVE_STOPS, ROD, toScreen, type DiveCamera, type PondLife } from './tinyDive';
import { blend, ink, type Palette, type Rgb } from './tinyRender';

/** Tiny Structures: the lens view. One map of the drop of pond water (in
 * micrometres) drawn at whatever field the dive has reached: the drop on
 * the LeafLab, then open water with a water flea, single cells, bacteria and
 * phages, each at its true size on the map. Everything alive moves a little.
 * The water darkens as the dive goes below what a glass lens can show. */

const WHITE: Rgb = [255, 255, 255];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };
const hash = (x: number, y: number, n: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + n * 74.7) * 43758.5453; return s - Math.floor(s); };

/** The water's colour at a field width: daylight green near the top, deep blue at the bottom of the dive. */
export function waterTones(p: Palette, field: number): { top: Rgb; bottom: Rgb; deep: number } {
  const d = clamp01(1 - smooth(Math.log10(1.2), Math.log10(700), Math.log10(Math.max(0.1, field))));
  const top = blend(blend(p.tone('sky-pale'), p.tone('celadon'), 0.35), blend(p.tone('teal-deep'), p.tone('indigo'), 0.35), d);
  const bottom = blend(blend(p.tone('celadon'), p.tone('sea'), 0.45), blend(p.tone('indigo-deep'), p.tone('teal-deep'), 0.4), d);
  return { top, bottom, deep: d };
}

function background(ctx: CanvasRenderingContext2D, w: number, h: number, camera: DiveCamera, time: number, p: Palette) {
  const side = Math.min(w, h), k = side / camera.field, cx = w / 2, cy = h / 2;
  const drop = toScreen(camera, DIVE_STOPS[0].at, side, cx, cy), dropR = 2500 * k;
  const inWater = smooth(5200, 2600, camera.field);
  if (inWater < 1) {
    // The LeafLab's sample plate: pale ceramic, a teal ring, and the drop standing on it.
    const g = ctx.createRadialGradient(drop.x - side * 0.2, drop.y - side * 0.3, side * 0.1, drop.x, drop.y, Math.max(w, h));
    g.addColorStop(0, ink(WHITE)); g.addColorStop(0.5, ink(p.tone('snow'))); g.addColorStop(1, ink(blend(p.tone('snow-shade'), p.tone('steel-light'), 0.4)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ink(p.tone('teal'), 0.75); ctx.lineWidth = Math.max(2, 260 * k); ctx.beginPath(); ctx.arc(drop.x, drop.y, 4700 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = ink(p.tone('sea'), 0.35); ctx.lineWidth = Math.max(1, 90 * k); ctx.beginPath(); ctx.arc(drop.x, drop.y, 5300 * k, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.fillStyle = ink(p.tone('steel'), 0.5); ctx.beginPath(); ctx.arc(drop.x + Math.cos(a) * 6100 * k, drop.y + Math.sin(a) * 6100 * k, Math.max(1.2, 70 * k), 0, Math.PI * 2); ctx.fill(); }
    // The drop's soft shadow and its body.
    ctx.fillStyle = ink(p.tone('shadow'), 0.16); ctx.beginPath(); ctx.ellipse(drop.x + dropR * 0.06, drop.y + dropR * 0.1, dropR * 1.04, dropR * 1.04, 0, 0, Math.PI * 2); ctx.fill();
  }
  const tones = waterTones(p, camera.field);
  ctx.save();
  if (inWater < 1) { ctx.beginPath(); ctx.arc(drop.x, drop.y, dropR, 0, Math.PI * 2); ctx.clip(); }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, ink(tones.top)); g.addColorStop(1, ink(tones.bottom));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // Light moving in the water: wide soft pools that drift.
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 5; i++) {
    const x = w * (0.5 + 0.42 * Math.sin(time * 0.11 + i * 2.1)), y = h * (0.42 + 0.36 * Math.cos(time * 0.09 + i * 1.7)), r = side * (0.34 + 0.1 * Math.sin(time * 0.2 + i));
    const s = ctx.createRadialGradient(x, y, 0, x, y, r), light = blend(p.tone('sky-pale'), p.tone('sea'), tones.deep * 0.8);
    s.addColorStop(0, ink(light, 0.2 - 0.08 * tones.deep)); s.addColorStop(1, ink(light, 0));
    ctx.fillStyle = s; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // Specks at every scale: as the field shrinks they stream outward, and finer ones come into view.
  const level = Math.log(camera.field) / Math.log(4), n = Math.floor(level), frac = level - n;
  for (const [lv, strength] of [[n, Math.sin(Math.PI * clamp01(frac * 0.5 + 0.5))], [n - 1, Math.sin(Math.PI * clamp01(frac * 0.5))]] as const) {
    const step = 4 ** lv / 2.6, x0 = Math.floor((camera.x - w / 2 / k) / step), x1 = Math.ceil((camera.x + w / 2 / k) / step), y0 = Math.floor((camera.y - h / 2 / k) / step), y1 = Math.ceil((camera.y + h / 2 / k) / step);
    if ((x1 - x0) * (y1 - y0) > 900) continue;
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const r1 = hash(gx, gy, lv), r2 = hash(gy, gx, lv + 9); if (r1 < 0.45) continue;
      const wx = (gx + r2 + 0.06 * Math.sin(time * 0.5 + r1 * 20)) * step, wy = (gy + r1 + 0.06 * Math.cos(time * 0.4 + r2 * 20)) * step;
      const sx = cx + (wx - camera.x) * k, sy = cy + (wy - camera.y) * k, size = step * k * (0.012 + 0.03 * r2);
      ctx.fillStyle = ink(blend(WHITE, p.tone('spring'), r2 * 0.5), strength * (0.2 + 0.4 * r1) * (1 - 0.35 * tones.deep));
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.5, size), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  if (inWater < 1) {
    // The drop's skin: a bright rim and the window's reflection, fading as the lens goes in.
    const a = 1 - inWater;
    const rim = ctx.createRadialGradient(drop.x, drop.y, dropR * 0.72, drop.x, drop.y, dropR);
    rim.addColorStop(0, ink(p.tone('teal'), 0)); rim.addColorStop(0.8, ink(p.tone('teal'), 0.22 * a)); rim.addColorStop(1, ink(p.tone('teal-deep'), 0.6 * a));
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(drop.x, drop.y, dropR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ink(WHITE, 0.85 * a); ctx.lineWidth = Math.max(1.5, dropR * 0.045); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(drop.x, drop.y, dropR * 0.86, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
    ctx.fillStyle = ink(WHITE, 0.7 * a); ctx.beginPath(); ctx.ellipse(drop.x - dropR * 0.4, drop.y - dropR * 0.46, dropR * 0.16, dropR * 0.08, -0.7, 0, Math.PI * 2); ctx.fill();
  }
}

/* ---------- the animals and cells, each drawn one unit long ---------- */
type Draw = (ctx: CanvasRenderingContext2D, p: Palette, time: number, px: number, mood: number) => void;
const line = (ctx: CanvasRenderingContext2D, px: number, width: number) => { ctx.lineWidth = Math.max(0.8 / px, width); };

const flea: Draw = (ctx, p, time, px, mood) => {
  const beat = Math.sin(time * 5.5) * (0.5 + mood), shell = p.tone('butter'), edge = p.tone('wood');
  // Swimming arms: two branched antennae that row.
  ctx.strokeStyle = ink(edge, 0.85); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(-0.2, -0.05 * s); ctx.rotate(s * (-1.9 + 0.32 * beat));
    line(ctx, px, 0.028); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0.26, 0); ctx.stroke();
    for (const fork of [-0.45, 0.4]) { ctx.save(); ctx.translate(0.26, 0); ctx.rotate(fork); line(ctx, px, 0.018); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0.2, 0); ctx.stroke();
      for (let i = 1; i <= 3; i++) { line(ctx, px, 0.008); ctx.beginPath(); ctx.moveTo(0.07 * i, 0); ctx.lineTo(0.07 * i + 0.08, 0.07 * (fork > 0 ? 1 : -1)); ctx.stroke(); } ctx.restore(); }
    ctx.restore();
  }
  // The clear shell, the gut seen through it, the eggs, the tail spine.
  const g = ctx.createRadialGradient(0.0, -0.08, 0.04, 0.04, 0, 0.42);
  g.addColorStop(0, ink(WHITE, 0.75)); g.addColorStop(0.6, ink(shell, 0.62)); g.addColorStop(1, ink(p.tone('sand'), 0.8));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-0.3, 0.02); ctx.bezierCurveTo(-0.3, -0.3, 0.3, -0.34, 0.4, -0.02); ctx.bezierCurveTo(0.36, 0.3, -0.2, 0.3, -0.3, 0.02); ctx.fill();
  ctx.strokeStyle = ink(edge, 0.7); line(ctx, px, 0.014); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.4, -0.02); ctx.lineTo(0.56, 0.02); line(ctx, px, 0.016); ctx.stroke();
  ctx.strokeStyle = ink(p.tone('leaf'), 0.85); line(ctx, px, 0.05); ctx.beginPath(); ctx.moveTo(-0.24, 0.02); ctx.bezierCurveTo(-0.1, 0.16, 0.12, 0.14, 0.26, -0.02); ctx.stroke();
  for (const [x, y] of [[0.02, -0.14], [0.13, -0.13], [0.08, -0.05]] as const) { ctx.fillStyle = ink(p.tone('amber'), 0.6); ctx.beginPath(); ctx.arc(x, y, 0.05, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = ink(p.tone('rose'), 0.5 + 0.3 * Math.sin(time * 9)); ctx.beginPath(); ctx.arc(-0.1, -0.16, 0.03 + 0.008 * Math.sin(time * 9), 0, Math.PI * 2); ctx.fill();
  // The head, its beak and the one big eye.
  ctx.fillStyle = ink(shell, 0.85); ctx.beginPath(); ctx.moveTo(-0.26, -0.1); ctx.bezierCurveTo(-0.44, -0.16, -0.52, 0.0, -0.46, 0.12); ctx.bezierCurveTo(-0.4, 0.1, -0.3, 0.1, -0.26, 0.08); ctx.fill(); ctx.strokeStyle = ink(edge, 0.7); line(ctx, px, 0.014); ctx.stroke();
  ctx.fillStyle = ink(p.tone('ink')); ctx.beginPath(); ctx.arc(-0.38, -0.03, 0.055, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ink(WHITE, 0.9); ctx.beginPath(); ctx.arc(-0.395, -0.045, 0.018, 0, Math.PI * 2); ctx.fill();
};

const paramecium: Draw = (ctx, p, time, px, mood) => {
  const shape = () => { ctx.beginPath(); ctx.moveTo(-0.5, 0); ctx.bezierCurveTo(-0.48, -0.2, -0.1, -0.24, 0.2, -0.2); ctx.bezierCurveTo(0.46, -0.16, 0.52, -0.04, 0.5, 0.02); ctx.bezierCurveTo(0.48, 0.16, 0.2, 0.22, -0.06, 0.2); ctx.bezierCurveTo(-0.2, 0.12, -0.48, 0.16, -0.5, 0); };
  // Cilia: a coat of tiny hairs, beating in waves.
  if (px > 26) {
    ctx.strokeStyle = ink(p.tone('sky-pale'), 0.8); line(ctx, px, 0.006); ctx.beginPath();
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * Math.PI * 2, x = Math.cos(a) * 0.5, y = Math.sin(a) * (0.21 - 0.03 * Math.cos(a)), wave = Math.sin(time * (9 + 6 * mood) + i * 0.7) * 0.5;
      ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a + wave) * 0.05, y + Math.sin(a + wave) * 0.05);
    }
    ctx.stroke();
  }
  const g = ctx.createLinearGradient(0, -0.22, 0, 0.22);
  g.addColorStop(0, ink(blend(p.tone('sky-pale'), WHITE, 0.4), 0.9)); g.addColorStop(1, ink(p.tone('sea'), 0.78));
  shape(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = ink(p.tone('teal'), 0.75); line(ctx, px, 0.012); ctx.stroke();
  // The mouth groove, the big kernel, food bubbles, and two star-shaped pumps.
  ctx.strokeStyle = ink(p.tone('teal-deep'), 0.4); line(ctx, px, 0.03); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0.24, 0.16); ctx.quadraticCurveTo(0.02, 0.12, -0.06, 0.0); ctx.stroke();
  ctx.fillStyle = ink(p.tone('bluebell'), 0.55); ctx.beginPath(); ctx.ellipse(-0.04, -0.04, 0.13, 0.07, 0.3, 0, Math.PI * 2); ctx.fill();
  for (const [x, y, r, tone] of [[0.24, -0.06, 0.035, 'spring'], [0.32, 0.05, 0.028, 'leaf'], [-0.26, 0.04, 0.03, 'spring'], [0.1, 0.1, 0.022, 'butter']] as const) { ctx.fillStyle = ink(p.tone(tone), 0.7); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  for (const [x, phase] of [[-0.34, 0], [0.38, 1.6]] as const) {
    const r = 0.03 + 0.016 * Math.sin(time * 1.6 + phase);
    ctx.strokeStyle = ink(WHITE, 0.75); line(ctx, px, 0.008); ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.moveTo(x, -0.02); ctx.lineTo(x + Math.cos(a) * 0.07, -0.02 + Math.sin(a) * 0.07); }
    ctx.stroke(); ctx.fillStyle = ink(WHITE, 0.8); ctx.beginPath(); ctx.arc(x, -0.02, r, 0, Math.PI * 2); ctx.fill();
  }
};

const volvox: Draw = (ctx, p, time, px) => {
  const g = ctx.createRadialGradient(-0.15, -0.18, 0.05, 0, 0, 0.5);
  g.addColorStop(0, ink(blend(p.tone('spring'), WHITE, 0.5), 0.9)); g.addColorStop(0.7, ink(p.tone('spring'), 0.75)); g.addColorStop(1, ink(p.tone('leaf'), 0.85));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, Math.PI * 2); ctx.fill();
  if (px < 14) return;
  for (let i = 0; i < 46; i++) { const a = i * 2.39996 + time * 0.12, r = 0.47 * Math.sqrt((i + 0.5) / 46); ctx.fillStyle = ink(p.tone('leaf-deep'), 0.55); ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 0.016, 0, Math.PI * 2); ctx.fill(); }
  for (const [x, y, r] of [[0.14, 0.1, 0.12], [-0.18, 0.12, 0.09], [-0.04, -0.2, 0.1]] as const) { ctx.fillStyle = ink(p.tone('leaf-deep'), 0.6); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
};
const euglena: Draw = (ctx, p, time, px) => {
  ctx.strokeStyle = ink(p.tone('leaf'), 0.7); line(ctx, px, 0.02); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.46, 0);
  for (let i = 1; i <= 10; i++) ctx.lineTo(-0.46 - i * 0.05, Math.sin(time * 8 + i * 0.9) * 0.05 * (i / 10));
  ctx.stroke();
  const g = ctx.createLinearGradient(0, -0.16, 0, 0.16); g.addColorStop(0, ink(p.tone('spring'), 0.95)); g.addColorStop(1, ink(p.tone('leaf'), 0.9));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-0.48, 0); ctx.bezierCurveTo(-0.3, -0.2, 0.2, -0.2, 0.5, 0); ctx.bezierCurveTo(0.2, 0.2, -0.3, 0.2, -0.48, 0); ctx.fill();
  ctx.fillStyle = ink(p.tone('poppy'), 0.9); ctx.beginPath(); ctx.arc(-0.34, -0.02, 0.035, 0, Math.PI * 2); ctx.fill();
  for (const x of [-0.12, 0.04, 0.2]) { ctx.fillStyle = ink(p.tone('leaf-deep'), 0.5); ctx.beginPath(); ctx.ellipse(x, 0, 0.05, 0.08, 0, 0, Math.PI * 2); ctx.fill(); }
};
const diatom: Draw = (ctx, p, _time, px) => {
  const g = ctx.createLinearGradient(0, -0.12, 0, 0.12); g.addColorStop(0, ink(blend(p.tone('gold-light'), WHITE, 0.4), 0.85)); g.addColorStop(1, ink(p.tone('amber'), 0.7));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-0.5, 0); ctx.quadraticCurveTo(0, -0.24, 0.5, 0); ctx.quadraticCurveTo(0, 0.24, -0.5, 0); ctx.fill();
  ctx.strokeStyle = ink(p.tone('gold-deep'), 0.7); line(ctx, px, 0.012); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.44, 0); ctx.lineTo(0.44, 0); for (let i = -4; i <= 4; i++) { const x = i * 0.09, hh = 0.1 * (1 - (x / 0.5) ** 2); ctx.moveTo(x, -hh); ctx.lineTo(x, hh); } line(ctx, px, 0.008); ctx.stroke();
};
const waterBear: Draw = (ctx, p, time, px, mood) => {
  const skin = p.tone('clay-pale'), edge = p.tone('clay'), walk = time * (3 + 6 * mood);
  ctx.lineCap = 'round';
  // Eight stubby legs, each with tiny claws, stepping in turn.
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const x = -0.26 + i * 0.17, swing = Math.sin(walk + i * 1.6 + (s > 0 ? Math.PI : 0)) * 0.05;
    ctx.strokeStyle = ink(edge, 0.9); line(ctx, px, 0.085); ctx.beginPath(); ctx.moveTo(x, s * 0.12); ctx.lineTo(x + swing, s * 0.27); ctx.stroke();
    ctx.strokeStyle = ink(skin, 1); line(ctx, px, 0.06); ctx.beginPath(); ctx.moveTo(x, s * 0.12); ctx.lineTo(x + swing, s * 0.26); ctx.stroke();
    ctx.strokeStyle = ink(p.tone('umber'), 0.8); line(ctx, px, 0.012); ctx.beginPath(); for (const c of [-0.02, 0, 0.02]) { ctx.moveTo(x + swing + c, s * 0.28); ctx.lineTo(x + swing + c * 1.8, s * 0.33); } ctx.stroke();
  }
  // A plump body in soft folds, a round head, a little snout and two eyes.
  for (let i = 4; i >= 0; i--) {
    const x = -0.34 + i * 0.16, r = 0.16 + 0.03 * Math.sin(i * 1.3) + (i === 2 ? 0.02 : 0);
    const g = ctx.createRadialGradient(x - 0.04, -0.06, 0.02, x, 0, r); g.addColorStop(0, ink(blend(skin, WHITE, 0.6))); g.addColorStop(1, ink(blend(skin, edge, 0.35)));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, 0, r * 0.82, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ink(edge, 0.45); line(ctx, px, 0.01); ctx.stroke();
  }
  ctx.fillStyle = ink(blend(skin, edge, 0.3)); ctx.beginPath(); ctx.ellipse(0.47, 0, 0.05, 0.06, 0, 0, Math.PI * 2); ctx.fill();
  for (const s of [-1, 1]) { ctx.fillStyle = ink(p.tone('ink')); ctx.beginPath(); ctx.arc(0.36, s * 0.06, 0.018, 0, Math.PI * 2); ctx.fill(); }
};
const rotifer: Draw = (ctx, p, time, px, mood) => {
  const skin = p.tone('butter'), edge = p.tone('brass');
  const g = ctx.createLinearGradient(0, -0.2, 0, 0.2); g.addColorStop(0, ink(blend(skin, WHITE, 0.5), 0.9)); g.addColorStop(1, ink(skin, 0.8));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0.3, -0.16); ctx.bezierCurveTo(0.1, -0.24, -0.14, -0.2, -0.26, -0.06); ctx.lineTo(-0.5, -0.02); ctx.lineTo(-0.5, 0.02); ctx.lineTo(-0.26, 0.06); ctx.bezierCurveTo(-0.14, 0.2, 0.1, 0.24, 0.3, 0.16); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = ink(edge, 0.7); line(ctx, px, 0.012); ctx.stroke();
  // Its crown: two wheels of hairs that seem to turn.
  for (const s of [-1, 1]) {
    ctx.fillStyle = ink(skin, 0.9); ctx.beginPath(); ctx.arc(0.34, s * 0.1, 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ink(edge, 0.8); line(ctx, px, 0.01); ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + time * (5 + 5 * mood) * s; ctx.moveTo(0.34 + Math.cos(a) * 0.08, s * 0.1 + Math.sin(a) * 0.08); ctx.lineTo(0.34 + Math.cos(a) * 0.13, s * 0.1 + Math.sin(a) * 0.13); }
    ctx.stroke();
  }
  ctx.fillStyle = ink(p.tone('leaf'), 0.6); ctx.beginPath(); ctx.ellipse(0, 0, 0.12, 0.08, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ink(p.tone('poppy'), 0.8); ctx.beginPath(); ctx.arc(0.24, 0, 0.02, 0, Math.PI * 2); ctx.fill();
};

/** A rod-shaped bacterium, one unit long: a living single cell. Close up it
 * shows its wall in layers, the loose tangle of its own DNA and the tiny
 * knobs on its skin where a phage's fibres can hold. */
const rod: Draw = (ctx, p, time, px, mood) => {
  const half = ROD.width / ROD.length / 2, big = px > 420;
  const capsule = (grow: number) => { const r = half + grow; ctx.beginPath(); ctx.moveTo(-0.5 + half, -r); ctx.lineTo(0.5 - half, -r); ctx.arc(0.5 - half, 0, r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-0.5 + half, r); ctx.arc(-0.5 + half, 0, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); };
  if (px > 40 && !big) {
    // Whip-like tails, far thinner than the cell.
    ctx.strokeStyle = ink(p.tone('celadon'), 0.55); line(ctx, px, 0.012); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.5, 0);
    for (let i = 1; i <= 16; i++) ctx.lineTo(-0.5 - i * 0.045, Math.sin(time * 6 + i * 0.8) * 0.06);
    ctx.stroke();
  }
  const g = ctx.createLinearGradient(0, -half, 0, half);
  g.addColorStop(0, ink(blend(p.tone('spring'), WHITE, 0.35), 0.95)); g.addColorStop(0.5, ink(p.tone('celadon'), 0.92)); g.addColorStop(1, ink(p.tone('celadon-deep'), 0.95));
  capsule(0); ctx.fillStyle = g; ctx.fill();
  if (px < 12) return;
  ctx.strokeStyle = ink(p.tone('leaf-deep'), 0.7); line(ctx, px, big ? 0.006 : 0.016); ctx.stroke();
  if (px > 60) {
    if (!big) { capsule(-0.022); ctx.strokeStyle = ink(WHITE, 0.4); line(ctx, px, 0.008); ctx.stroke(); }
    // Its own DNA: a loose tangle in the middle, not in a shell.
    ctx.strokeStyle = ink(p.tone('leaf-deep'), 0.38); line(ctx, px, 0.014); ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const u = i / 60, x = -0.2 + 0.4 * u + 0.05 * Math.sin(u * 23 + time * 0.3), y = Math.sin(u * 17) * half * 0.42 + Math.cos(u * 31 + time * 0.2) * half * 0.14; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    for (let i = 0; i < 26; i++) { const x = -0.42 + hash(i, 3, 1) * 0.84, y = (hash(i, 7, 2) - 0.5) * half * 1.5; ctx.fillStyle = ink(p.tone('leaf-deep'), 0.3); ctx.beginPath(); ctx.arc(x, y, 0.006, 0, Math.PI * 2); ctx.fill(); }
  }
  if (big) {
    // Close up, the cell's coat is three thin layers over a crowded inside (drawn only where the lens is looking).
    const top = -half, coat = blend(p.tone('spring'), WHITE, 0.5);
    ctx.save(); capsule(0); ctx.clip();
    const cg = ctx.createLinearGradient(0, top, 0, top + 0.1);
    cg.addColorStop(0, ink(coat)); cg.addColorStop(0.06, ink(p.tone('spring'))); cg.addColorStop(0.085, ink(p.tone('celadon-deep'))); cg.addColorStop(0.15, ink(blend(p.tone('celadon'), p.tone('spring'), 0.35)));
    cg.addColorStop(0.2, ink(p.tone('celadon-deep'))); cg.addColorStop(0.24, ink(blend(p.tone('celadon'), WHITE, 0.25))); cg.addColorStop(0.3, ink(blend(p.tone('celadon'), p.tone('celadon-deep'), 0.5))); cg.addColorStop(1, ink(blend(p.tone('celadon-deep'), p.tone('teal-deep'), 0.55)));
    ctx.fillStyle = cg; ctx.fillRect(-0.5, top, 1, 0.1);
    const step = 0.0075;
    for (let gx = Math.floor(-0.2 / step); gx <= Math.ceil(0.4 / step); gx++) for (let gy = 4; gy <= 12; gy++) {
      const r1 = hash(gx, gy, 5), r2 = hash(gy, gx, 8); if (r1 < 0.3) continue;
      const x = (gx + r2) * step, y = top + (gy + r1) * step + 0.0015 * Math.sin(time * 1.1 + r1 * 30);
      ctx.fillStyle = ink(blend(p.tone('spring'), WHITE, r2 * 0.6), 0.16 + 0.3 * r1 * (1 - (gy - 4) / 10)); ctx.beginPath(); ctx.arc(x, y, 0.0012 + 0.0016 * r2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Its faint halo in the water.
    const halo = ctx.createLinearGradient(0, top - 0.03, 0, top);
    halo.addColorStop(0, ink(p.tone('spring'), 0)); halo.addColorStop(1, ink(p.tone('spring'), 0.22));
    ctx.fillStyle = halo; ctx.fillRect(-0.5 + half, top - 0.03, 1 - 2 * half, 0.03);
    // The skin's knobs, along the upper side: where the fibre tips can take hold.
    for (let i = 0; i < 90; i++) {
      const x = -0.5 + half + (i + 0.5) / 90 * (1 - 2 * half), lit = 0.5 + 0.5 * Math.sin(time * 1.2 + i * 0.6);
      ctx.fillStyle = ink(blend(p.tone('spring'), WHITE, 0.3 + 0.4 * lit * (0.4 + mood)), 0.95); ctx.beginPath(); ctx.arc(x, -half - 0.0035, 0.0045, 0, Math.PI * 2); ctx.fill();
    }
  } else if (px > 90) {
    ctx.strokeStyle = ink(p.tone('celadon-deep'), 0.6); line(ctx, px, 0.006); ctx.beginPath();
    for (let i = 0; i < 40; i++) { const x = -0.5 + half + i / 40 * (1 - 2 * half); for (const s of [-1, 1]) { ctx.moveTo(x, s * half); ctx.lineTo(x + 0.006, s * (half + 0.03)); } }
    ctx.stroke();
  }
};

/** A phage seen small: the same shape as the model, in pale lines. */
const phageMark: Draw = (ctx, p, _time, px) => {
  const tone = blend(p.tone('snow'), WHITE, 0.5);
  ctx.strokeStyle = ink(tone, 0.95); ctx.fillStyle = ink(tone, 0.95); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Drawn upright, head up; one unit tall.
  ctx.beginPath(); ctx.moveTo(0, -0.5); ctx.lineTo(0.14, -0.4); ctx.lineTo(0.14, -0.2); ctx.lineTo(0, -0.1); ctx.lineTo(-0.14, -0.2); ctx.lineTo(-0.14, -0.4); ctx.closePath(); ctx.fill();
  line(ctx, px, 0.07); ctx.beginPath(); ctx.moveTo(0, -0.1); ctx.lineTo(0, 0.32); ctx.stroke();
  line(ctx, px, 0.035); ctx.beginPath();
  for (const s of [-1, 1]) for (const reach of [0.38, 0.2]) { ctx.moveTo(0, 0.32); ctx.lineTo(s * reach * 0.75, 0.24); ctx.lineTo(s * reach, 0.5); }
  ctx.stroke();
};

const DRAW: Readonly<Record<PondLife['kind'], Draw>> = { flea, paramecium, volvox, euglena, diatom, waterBear, rotifer, rod, phage: phageMark };

export interface PondOptions {
  /** Things the game draws itself (the phage being landed). */
  skip?: (life: PondLife) => boolean;
  /** How lively each thing is, 0 to 1 (a tap makes one wriggle). */
  mood?: (life: PondLife) => number;
  /** Called for a phage big enough to be drawn as the real model. Return true when it was drawn. */
  phage?: (life: PondLife, x: number, y: number, px: number) => boolean;
}
/** Where a thing is now: it drifts a little round its place on the map. */
export function lifeAt(life: PondLife, time: number): { x: number; y: number; turn: number } {
  const still = life.role === 'bacterium' ? 0 : 1, drift = life.size * (life.kind === 'rod' || life.kind === 'phage' ? 0.05 : 0.07) * still;
  return {
    x: life.x + Math.sin(time * 0.5 + life.phase) * drift, y: life.y + Math.cos(time * 0.4 + life.phase * 1.7) * drift,
    turn: life.turn + (life.role === 'bacterium' ? 0 : Math.sin(time * 0.3 + life.phase) * (life.kind === 'phage' ? 16 : 7)),
  };
}
export function drawPond(ctx: CanvasRenderingContext2D, w: number, h: number, camera: DiveCamera, life: readonly PondLife[], time: number, p: Palette, options: PondOptions = {}): void {
  const side = Math.min(w, h), cx = w / 2, cy = h / 2;
  background(ctx, w, h, camera, time, p);
  for (const one of life) {
    if (options.skip?.(one)) continue;
    const here = lifeAt(one, time), s = toScreen(camera, here, side, cx, cy), px = one.size * s.k;
    if (px < 1.3 || px > side * 9) continue;
    if (s.x < -px || s.x > w + px || s.y < -px || s.y > h + px) continue;
    const alpha = smooth(1.3, 5, px) * (1 - smooth(side * 5, side * 9, px));
    if (one.kind === 'phage' && px > 30 && options.phage?.(one, s.x, s.y, px)) continue;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(s.x, s.y); ctx.rotate(here.turn * Math.PI / 180); ctx.scale(px, px);
    if (px < 4 && one.kind !== 'phage') { ctx.fillStyle = ink(one.kind === 'rod' ? p.tone('celadon') : p.tone('spring'), 0.9); ctx.beginPath(); ctx.ellipse(0, 0, 0.5, 0.3, 0, 0, Math.PI * 2); ctx.fill(); }
    else DRAW[one.kind](ctx, p, time + one.phase, px, options.mood?.(one) ?? 0);
    ctx.restore();
  }
}
