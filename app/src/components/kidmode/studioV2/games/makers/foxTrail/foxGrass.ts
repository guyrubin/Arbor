import {
  FLAT_RECOVER, STREAM, TALL_GRASS, TUNNEL, WORLD_H, WORLD_W, bladeBend, bladeFlatten, clamp, groundAt, springBlade,
} from './foxTrailRules';

/** The planting that answers Pep: a few thousand blades in three rows (the bed
 * at the foot of the wall, the long lavender the path crosses, and the border
 * in the near foreground), each a tiny spring. Only blades on screen are moved
 * or drawn. Two canvases: the back row sits behind Pep, the front rows, the
 * dust, the drops and the night's lights in front of him. */

export type Rgb = readonly [number, number, number];
export interface GrassPalette {
  back: { dusk: readonly Rgb[]; night: readonly Rgb[] };
  front: { dusk: readonly Rgb[]; night: readonly Rgb[] };
  fore: { dusk: readonly Rgb[]; night: readonly Rgb[] };
  flower: { dusk: readonly Rgb[]; night: readonly Rgb[] };
  moon: Rgb; moonCore: Rgb; bud: Rgb; fluff: Rgb; firefly: Rgb; sparkleDusk: Rgb; sparkleNight: Rgb; ring: Rgb; mote: Rgb; dust: Rgb; drop: Rgb; paw: Rgb;
}
export const FORE_PARALLAX = 1.22;
/** Where the foreground border is rooted: the bottom edge every window shows. */
const FORE_BASE = WORLD_H - 36;
const ROWS = ['back', 'front', 'fore'] as const;
type Row = (typeof ROWS)[number];
interface Blades {
  n: number; x: Float32Array; base: Float32Array; h: Float32Array; w: Float32Array; rest: Float32Array;
  a: Float32Array; v: Float32Array; flat: Float32Array; flatDir: Int8Array; shade: Uint8Array;
  /** 0 blade, 1 dusk flower, 2 moonflower. */
  kind: Uint8Array; shed: Float32Array; open: Float32Array;
}
/** 0 seed fluff, 1 a mote of light, 2 dust, 3 a water drop. */
interface Mote { x: number; y: number; vx: number; vy: number; life: number; max: number; kind: 0 | 1 | 2 | 3 }
interface Fly { x: number; y: number; ph: number; sp: number; hover: number }

/** A fixed little generator so the meadow is the same every time. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const inStream = (x: number) => x > STREAM.from - 6 && x < STREAM.to + 6;
const inOak = (x: number) => x > TUNNEL.from - 30 && x < TUNNEL.to + 30;
const tall = (x: number) => x > TALL_GRASS.from && x < TALL_GRASS.to ? Math.sin(Math.PI * (x - TALL_GRASS.from) / (TALL_GRASS.to - TALL_GRASS.from)) : 0;

function makeRow(row: Row, rand: () => number): Blades {
  const xs: number[] = [], bases: number[] = [], hs: number[] = [], kinds: number[] = [];
  const span = row === 'fore' ? WORLD_W * FORE_PARALLAX + 1600 : WORLD_W;
  const gap = row === 'fore' ? 9 : row === 'front' ? 6.5 : 7.5;
  for (let x = 4; x < span; x += gap * (0.6 + rand() * 0.8)) {
    if (row !== 'fore' && (inStream(x) || inOak(x))) {
      // reeds stand at the stream's edges
      if (row === 'back' && inStream(x) && (x < STREAM.from + 34 || x > STREAM.to - 34)) { xs.push(x); bases.push(groundAt(x) + 2); hs.push(44 + rand() * 30); kinds.push(0); }
      continue;
    }
    const t = row === 'fore' ? 0 : tall(x);
    // Away from the lavender the paving is clear: only a tuft here and there in front of Pep.
    if (row === 'front' && t <= 0 && rand() < 0.86) continue;
    let h: number;
    if (row === 'fore') h = 16 + rand() * 30 + (rand() < 0.06 ? 16 : 0);
    else if (row === 'front') h = 8 + rand() * 12 + t * (58 + rand() * 30);
    else h = 12 + rand() * 18 + t * (50 + rand() * 26);
    const kindRoll = rand();
    const kind = row === 'fore' ? 0 : t > 0.2 ? 0 : kindRoll < 0.045 ? 1 : kindRoll < 0.085 ? 2 : 0;
    xs.push(x); bases.push(row === 'fore' ? 0 : groundAt(x) + (row === 'back' ? 12 : -9)); hs.push(kind ? h * 0.9 + 8 : h); kinds.push(kind);
  }
  const n = xs.length;
  const b: Blades = {
    n, x: Float32Array.from(xs), base: Float32Array.from(bases), h: Float32Array.from(hs), w: new Float32Array(n), rest: new Float32Array(n),
    a: new Float32Array(n), v: new Float32Array(n), flat: new Float32Array(n), flatDir: new Int8Array(n), shade: new Uint8Array(n),
    kind: Uint8Array.from(kinds), shed: new Float32Array(n), open: new Float32Array(n).fill(-1),
  };
  for (let i = 0; i < n; i++) {
    b.w[i] = (row === 'fore' ? 2.4 : 1.7) + rand() * (row === 'fore' ? 1.8 : 1.3);
    b.rest[i] = (rand() - 0.5) * 0.5;
    b.a[i] = b.rest[i];
    b.shade[i] = Math.floor(rand() * 3);
  }
  return b;
}

export interface GrassField {
  rows: Record<Row, Blades>;
  motes: Mote[];
  flies: Fly[];
  sparkles: { x: number; y: number; ph: number }[];
  /** Pawprints that glow for a while on the night paving. */
  paws: { x: number; y: number; t: number }[];
}
export function createGrass(): GrassField {
  const rand = seeded(20261116);
  const rows = { back: makeRow('back', rand), front: makeRow('front', rand), fore: makeRow('fore', rand) };
  const flies: Fly[] = Array.from({ length: 34 }, () => ({ x: rand() * WORLD_W, y: 0, ph: rand() * Math.PI * 2, sp: 0.4 + rand() * 0.7, hover: 40 + rand() * 210 }));
  const sparkles = Array.from({ length: 18 }, () => ({ x: STREAM.from + 30 + rand() * (STREAM.to - STREAM.from - 60), y: rand(), ph: rand() * Math.PI * 2 }));
  return { rows, motes: [], flies, sparkles, paws: [] };
}

export interface GrassFrame {
  t: number; dt: number; cam: number; viewW: number; scale: number;
  /** Device pixels from the canvas top to the top of the wood (tall phone windows). */
  top: number;
  fox: { x: number; y: number; vx: number; rolling: boolean; rollDir: number };
  reduced: boolean;
  /** Nightness of a screen point (0 dusk … 1 night): the ring's wipe. */
  night: (sx: number, sy: number) => number;
  /** 0..1 since the mirror woke (fireflies rise, flowers open). */
  wakeAge: number;
  isNight: boolean;
}

/** Moves the blades near the camera; returns how much grass is swishing (for the sound). */
export function updateGrass(g: GrassField, f: GrassFrame): number {
  let swish = 0;
  for (const row of ROWS) {
    const b = g.rows[row], par = row === 'fore' ? FORE_PARALLAX : 1;
    const left = f.cam * par - 60, right = f.cam * par + f.viewW + 60;
    // In the foreground, distance to the fox is measured on screen.
    const foxX = row === 'fore' ? f.fox.x + f.cam * (par - 1) : f.fox.x;
    const lift = row === 'fore' ? 30 : Math.max(0, f.fox.y - groundAt(f.fox.x));
    const strength = row === 'fore' ? 0.55 : 1;
    for (let i = 0; i < b.n; i++) {
      if (b.flat[i] > 0) b.flat[i] = Math.max(0, b.flat[i] - FLAT_RECOVER * f.dt);
      const x = b.x[i];
      if (x < left || x > right) continue;
      const fox = { x: foxX, vx: f.fox.vx, lift, rolling: f.fox.rolling };
      const sway = f.reduced ? 0 : Math.sin(f.t * 1.3 + x * 0.013) * 0.06 + Math.sin(f.t * 0.7 + x * 0.004) * 0.05;
      const target = b.rest[i] + sway + bladeBend(x, fox) * strength * (b.h[i] > 50 ? 0.9 : 1);
      const before = b.v[i];
      [b.a[i], b.v[i]] = springBlade(b.a[i], b.v[i], target, f.dt, f.reduced);
      if (row !== 'fore') {
        const flat = bladeFlatten(x, fox);
        if (flat > b.flat[i]) { b.flat[i] = flat; b.flatDir[i] = f.fox.rollDir > 0 ? 1 : -1; }
      }
      const kick = Math.abs(b.v[i] - before);
      if (Math.abs(x - foxX) < 90) swish += Math.min(1, Math.abs(b.v[i]) * 0.12) * (b.h[i] / 40);
      // A flower brushed hard sheds a few seeds.
      if (b.kind[i] === 1 && kick > 0.12 && b.shed[i] < f.t && g.motes.length < 46) {
        b.shed[i] = f.t + 2.5;
        const tip = tipOf(b, i, row, f);
        for (let k = 0; k < 3; k++) g.motes.push({ x: tip[0], y: tip[1], vx: (Math.sin(i * 7 + k) * 0.5 + Math.sign(f.fox.vx || 1) * 0.6) * 40, vy: -20 - k * 9, life: 0, max: 1.8 + k * 0.4, kind: 0 });
      }
      // Moonflowers open as the night finds them.
      if (b.kind[i] === 2 && f.isNight && b.open[i] < 0) b.open[i] = f.t + (f.reduced ? -2 : Math.abs(Math.sin(i * 12.9898)) * 0.8);
    }
  }
  for (let i = g.motes.length - 1; i >= 0; i--) {
    const m = g.motes[i]; m.life += f.dt;
    if (m.life > m.max) { g.motes.splice(i, 1); continue; }
    m.vy += (m.kind === 0 ? 14 : m.kind === 3 ? 520 : m.kind === 2 ? -14 : -10) * f.dt; m.vx *= 1 - (m.kind === 2 ? 2.4 : 0.8) * f.dt;
    m.x += m.vx * f.dt; m.y += m.vy * f.dt;
  }
  return clamp(swish / 28, 0, 1);
}

/** A puff at Pep's paws: dust off the paving (2) or drops off the pool and his coat (3). `dir` leans it. */
export function puff(g: GrassField, x: number, y: number, kind: 2 | 3, count: number, dir = 0) {
  for (let k = 0; k < count && g.motes.length < 90; k++) {
    const u = (k + 0.5) / count - 0.5, wob = Math.sin(k * 12.9898 + x) * 0.5;
    if (kind === 2) g.motes.push({ x: x + u * 30, y: y - 2, vx: u * 150 + dir * 70 + wob * 30, vy: -12 - Math.abs(wob) * 22, life: 0, max: 0.42 + Math.abs(wob) * 0.3, kind });
    else g.motes.push({ x: x + u * 34, y: y - 6, vx: u * 210 + dir * 60, vy: -150 - Math.abs(wob) * 150, life: 0, max: 0.5 + Math.abs(wob) * 0.25, kind });
  }
}
/** A pawprint left on the night paving. */
export function pawprint(g: GrassField, x: number, y: number, t: number) { g.paws.push({ x, y, t }); if (g.paws.length > 26) g.paws.shift(); }
/** Motes of light bursting from a found petal (world units, y down). */
export function burstMotes(g: GrassField, x: number, y: number, kind: 0 | 1, count: number) {
  for (let k = 0; k < count && g.motes.length < 90; k++) {
    const a = (k / count) * Math.PI * 2;
    g.motes.push({ x, y, vx: Math.cos(a) * (50 + (k % 3) * 25), vy: Math.sin(a) * 50 - 40, life: 0, max: 0.9 + (k % 4) * 0.15, kind });
  }
}

function tipOf(b: Blades, i: number, row: Row, f: GrassFrame): [number, number] {
  const flat = b.flat[i], h = b.h[i] * (1 - 0.72 * flat);
  const a = b.a[i] + b.flatDir[i] * flat * 1.15;
  const by = row === 'fore' ? FORE_BASE : WORLD_H - b.base[i];
  const bx = row === 'fore' ? b.x[i] - f.cam * (FORE_PARALLAX - 1) : b.x[i];
  return [bx + Math.sin(a) * h, by - Math.cos(a) * h];
}
/** A resolved token colour as a canvas fill (alpha goes through globalAlpha). */
const css = (c: Rgb) => `rgb(${c[0]},${c[1]},${c[2]})`;
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];

const BUCKETS = 4;
/** Draws one canvas. `which` = 'back' (behind the fox) or 'front' (in front: front row, foreground, lights). */
export interface GrassExtras { glow: HTMLCanvasElement | null; ring: null | { x: number; y: number; r: number; a: number }; /** Lights to draw as soft glows (world units, y down): the fallen star, petals in flight, the finale. */ lights?: readonly { x: number; y: number; r: number; a: number }[] }
export function drawGrass(ctx: CanvasRenderingContext2D, g: GrassField, f: GrassFrame, pal: GrassPalette, which: 'back' | 'front', extras?: GrassExtras) {
  const s = f.scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(s, 0, 0, s, 0, f.top);
  const rows: Row[] = which === 'back' ? ['back'] : ['front', 'fore'];
  for (const row of rows) {
    const b = g.rows[row], par = row === 'fore' ? FORE_PARALLAX : 1, shift = f.cam * par;
    const colours = pal[row];
    // Batch by shade and by how far the night has reached them: a handful of fills per row.
    const paths: Path2D[] = Array.from({ length: 3 * BUCKETS }, () => new Path2D());
    const flowers: number[] = [];
    for (let i = 0; i < b.n; i++) {
      const sx = b.x[i] - shift;
      if (sx < -50 || sx > f.viewW + 50) continue;
      const flat = b.flat[i];
      const h = b.h[i] * (1 - 0.72 * flat);
      const a = b.a[i] + b.flatDir[i] * flat * 1.15;
      const by = row === 'fore' ? FORE_BASE : WORLD_H - b.base[i];
      const tx = sx + Math.sin(a) * h, ty = by - Math.cos(a) * h;
      const mx = sx + Math.sin(a * 0.45) * h * 0.55, my = by - Math.cos(a * 0.45) * h * 0.55;
      const w = b.w[i];
      const nb = Math.min(BUCKETS - 1, Math.round(f.night(sx * s, by * s + f.top) * (BUCKETS - 1)));
      const p = paths[b.shade[i] * BUCKETS + nb];
      p.moveTo(sx - w, by);
      p.quadraticCurveTo(mx - w * 0.5, my, tx, ty);
      p.quadraticCurveTo(mx + w * 0.5, my, sx + w, by);
      p.closePath();
      if (b.kind[i]) flowers.push(i);
    }
    // The near border sits a little out of focus, like the front of a photograph (where the canvas can blur).
    if (row === 'fore' && typeof ctx.filter === 'string') ctx.filter = `blur(${(1.1 * s).toFixed(1)}px)`;
    ctx.globalAlpha = row === 'fore' ? 0.9 : 0.94;
    for (let k = 0; k < paths.length; k++) {
      const shade = Math.floor(k / BUCKETS), nb = k % BUCKETS;
      ctx.fillStyle = css(mixRgb(colours.dusk[shade], colours.night[shade], nb / (BUCKETS - 1)));
      ctx.fill(paths[k]);
    }
    ctx.globalAlpha = 1;
    if (row === 'fore' && typeof ctx.filter === 'string') ctx.filter = 'none';
    // Flower heads.
    for (const i of flowers) {
      const tip = tipOf(b, i, row, f); const sx = tip[0] - f.cam, sy = tip[1];
      const night = f.night(sx * s, sy * s + f.top);
      if (b.kind[i] === 1) {
        const c = mixRgb(pal.flower.dusk[i % pal.flower.dusk.length], pal.flower.night[i % pal.flower.night.length], night);
        ctx.fillStyle = css(c);
        ctx.beginPath(); for (let k = 0; k < 5; k++) { const ang = k * 1.2566 + b.a[i]; ctx.moveTo(sx, sy); ctx.ellipse(sx + Math.cos(ang) * 3.2, sy + Math.sin(ang) * 3.2, 3.1, 2, ang, 0, Math.PI * 2); } ctx.fill();
        ctx.fillStyle = css(pal.bud); ctx.beginPath(); ctx.arc(sx, sy, 1.8, 0, Math.PI * 2); ctx.fill();
      } else {
        const open = b.open[i] < 0 ? 0 : clamp((f.t - b.open[i]) / 1.6, 0, 1) * night;
        if (open <= 0.02) { ctx.fillStyle = css(pal.bud); ctx.beginPath(); ctx.ellipse(sx, sy, 2.2, 3.6, b.a[i], 0, Math.PI * 2); ctx.fill(); continue; }
        const r = 2 + open * 5.5;
        ctx.globalAlpha = 0.25 * open; ctx.fillStyle = css(pal.moon); ctx.beginPath(); ctx.arc(sx, sy, r * 2.2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = css(pal.moon);
        ctx.beginPath(); for (let k = 0; k < 6; k++) { const ang = k * 1.0472 + 0.3; ctx.moveTo(sx, sy); ctx.ellipse(sx + Math.cos(ang) * r * 0.62, sy + Math.sin(ang) * r * 0.62, r * 0.62, r * 0.28, ang, 0, Math.PI * 2); } ctx.fill();
        ctx.fillStyle = css(pal.moonCore); ctx.beginPath(); ctx.arc(sx, sy, 1.6 + open, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  if (which === 'back') {
    // Pawprints glow on the paving where Pep has run since the lights came back.
    for (const paw of g.paws) {
      const age = f.t - paw.t, sx = paw.x - f.cam; if (age > 5 || sx < -20 || sx > f.viewW + 20) continue;
      const a = Math.min(1, age * 6) * (1 - age / 5);
      ctx.fillStyle = css(pal.paw);
      ctx.globalAlpha = 0.16 * a; ctx.beginPath(); ctx.ellipse(sx, paw.y, 13, 4.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.6 * a; ctx.beginPath(); ctx.ellipse(sx, paw.y, 5, 1.9, 0, 0, Math.PI * 2);
      for (let k = -1; k <= 1; k++) ctx.ellipse(sx + 5.5 + Math.abs(k) * -1.2, paw.y + k * 1.9, 1.5, 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }

  // Seed fluff, motes of light, dust off the paving, drops off the pool.
  for (const m of g.motes) {
    const k = 1 - m.life / m.max, sx = m.x - f.cam, sy = m.y;
    if (m.kind === 0) { ctx.globalAlpha = 0.8 * k; ctx.fillStyle = css(pal.fluff); ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, Math.PI * 2); ctx.fill(); }
    else if (m.kind === 1) { ctx.globalAlpha = k; ctx.fillStyle = css(pal.mote); ctx.beginPath(); ctx.arc(sx, sy, 2.4 * k + 0.6, 0, Math.PI * 2); ctx.fill(); }
    else if (m.kind === 2) { ctx.globalAlpha = 0.2 * k; ctx.fillStyle = css(pal.dust); ctx.beginPath(); ctx.ellipse(sx, sy, 3 + (1 - k) * 7, 2 + (1 - k) * 4, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.globalAlpha = 0.85 * Math.min(1, k * 2); ctx.fillStyle = css(pal.drop); ctx.beginPath(); ctx.ellipse(sx, sy, 1.5, 2.6, Math.atan2(m.vx, -m.vy), 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // The stream glints: warm at dusk, silver stars at night.
  for (const sp of g.sparkles) {
    const sx = sp.x - f.cam; if (sx < -10 || sx > f.viewW + 10) continue;
    const sy = WORLD_H - (groundAt(STREAM.from) - STREAM.bed + STREAM.water) - 18 + sp.y * 96;
    const tw = f.reduced ? 0.5 : Math.max(0, Math.sin(f.t * 2.4 + sp.ph)) ** 4;
    const night = f.night(sx * s, sy * s + f.top);
    const size = 1.5 + tw * (2 + night * 4);
    ctx.globalAlpha = 0.25 + tw * 0.75; ctx.fillStyle = css(mixRgb(pal.sparkleDusk, pal.sparkleNight, night));
    ctx.beginPath(); ctx.moveTo(sx - size, sy); ctx.lineTo(sx, sy - size * 0.35); ctx.lineTo(sx + size, sy); ctx.lineTo(sx, sy + size * 0.35); ctx.closePath();
    if (night > 0.5) { ctx.moveTo(sx, sy - size); ctx.lineTo(sx + size * 0.3, sy); ctx.lineTo(sx, sy + size); ctx.lineTo(sx - size * 0.3, sy); ctx.closePath(); }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Fireflies rise out of the grass once the night has come.
  if (f.wakeAge > 0 && extras?.glow) {
    ctx.globalCompositeOperation = 'lighter';
    for (const fly of g.flies) {
      // Keep the swarm around the camera: wrap each one into view's neighbourhood.
      const span = f.viewW + 240;
      let x = ((fly.x - f.cam + 120) % span + span) % span - 120;
      x += f.reduced ? 0 : Math.sin(f.t * fly.sp + fly.ph) * 18;
      const wx = x + f.cam;
      const rise = f.reduced ? 1 : clamp((f.wakeAge - 0.4 - (fly.ph / 6.28) * 1.4) / 2.2, 0, 1);
      const ground = WORLD_H - groundAt(clamp(wx, 0, WORLD_W));
      const y = ground - 8 - (fly.hover + (f.reduced ? 0 : Math.sin(f.t * fly.sp * 0.8 + fly.ph * 2) * 16)) * (1 - (1 - rise) ** 2);
      const night = f.night(x * s, y * s + f.top);
      if (night < 0.5 || rise <= 0) continue;
      const pulse = f.reduced ? 0.8 : 0.45 + 0.55 * Math.max(0, Math.sin(f.t * (1.4 + fly.sp) + fly.ph)) ** 2;
      const r = 13 + pulse * 7;
      ctx.globalAlpha = pulse * night;
      ctx.drawImage(extras.glow, x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = css(pal.firefly); ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // Soft lights: the fallen star, petals on their way home, the finale.
  if (extras?.glow && extras.lights?.length) {
    ctx.globalCompositeOperation = 'lighter';
    for (const l of extras.lights) { if (l.a <= 0) continue; const x = l.x - f.cam; ctx.globalAlpha = Math.min(1, l.a); ctx.drawImage(extras.glow, x - l.r, l.y - l.r, l.r * 2, l.r * 2); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // The ring of light that sweeps back from the Dome's sun.
  const ring = extras?.ring;
  if (ring && ring.a > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const [width, alpha] of [[34, 0.12], [16, 0.26], [5, 0.7]] as const) {
      ctx.globalAlpha = alpha * ring.a; ctx.strokeStyle = css(pal.ring); ctx.lineWidth = width * s;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, Math.max(1, ring.r), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** A soft warm glow sprite for the fireflies (drawn once). */
export function glowSprite(c: Rgb): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 48;
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  // Concentric soft discs build the falloff (no alpha colours needed).
  ctx.fillStyle = css(c);
  for (let i = 0; i < 14; i++) { ctx.globalAlpha = 0.07 + (i > 10 ? 0.12 : 0); ctx.beginPath(); ctx.arc(24, 24, 24 * (1 - i / 14) ** 1.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  return canvas;
}
