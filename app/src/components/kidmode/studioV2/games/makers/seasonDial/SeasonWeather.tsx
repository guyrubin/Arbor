import { useEffect, useRef } from 'react';
import { particleCounts, weatherAt, wrapYear } from './seasonDialRules';
import { applePaint, leafPaint, paintResolved, readPalette, type Palette } from './seasonDialPaint';
import { LOOK, SCENE_H, SCENE_W, allToyParticles, hash, type Poke, type ToyParticle } from './seasonDialToys';
import { FELT_FLOWER } from './seasonDialKit';

/** The weather layer: ONE canvas over the scene, at most PARTICLE_CAP
 * particles. How many of each kind show is a function of `year`; where each
 * one is is a function of its own seed and the ambient clock, so nothing is
 * spawned or left behind: turn the dial back and the snow is simply not
 * there. With reduced motion or Pause, the clock stands still (a still frame
 * of the same weather). The canvas and its frame loop go when it unmounts. */
const NAMES = ['sky-pale', 'steel-light', 'blossom', 'rose', 'rose-deep', 'white', 'amber', 'orange', 'red', 'rust', 'snow', 'snow-shade', 'butter', 'sun', 'lilac', 'violet', 'shadow', 'ink', 'spring', 'leaf', 'leaf-deep', 'umber', 'water', 'sky', 'teal', 'sea', 'poppy', 'bluebell'] as const;

const mod = (v: number, m: number) => ((v % m) + m) % m;
const LEAF_COLOURS = ['amber', 'orange', 'red', 'rust'] as const;

export function drawWeather(ctx: CanvasRenderingContext2D, year: number, t: number, pal: Palette): void {
  const w = weatherAt(wrapYear(year)), n = particleCounts(w);
  ctx.clearRect(0, 0, SCENE_W, SCENE_H);

  // Summer cloud shadows sliding over the terrace: soft, like the render's own.
  if (w.cloudShadows > 0.02) {
    for (let k = 0; k < 2; k++) {
      const x = mod(t * 5 + k * 260, 640) - 120, y = 250 + k * 34, rx = 120 - k * 24;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.14);
      const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      shade.addColorStop(0, pal.shadow); shade.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.1 * w.cloudShadows; ctx.fillStyle = shade;
      ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  // Spring rain: thin slanting strokes.
  if (n.rain) {
    ctx.lineCap = 'round'; ctx.lineWidth = 1.3;
    for (let i = 0; i < n.rain; i++) {
      const speed = 250 + hash(i, 3) * 110;
      const y = mod(hash(i, 2) * 340 + speed * t, 340) - 14;
      const x = mod(hash(i, 1) * 440 + speed * 0.18 * t, 440) - 20;
      ctx.strokeStyle = i % 3 ? pal['steel-light'] : pal.white;
      ctx.globalAlpha = (0.35 + 0.3 * hash(i, 4)) * Math.min(1, w.rain * 1.6);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2.8, y - 14); ctx.stroke();
    }
  }
  // Blossom petals drifting down as the blossom ends.
  for (let i = 0; i < n.petals; i++) {
    const fall = 16 + hash(i, 12) * 16;
    const y = mod(hash(i, 11) * 260 + fall * t, 260) + 40;
    const x = mod(hash(i, 10) * 300 + 9 * t + 10 * Math.sin(t * 0.9 + i), 300) + 60;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * (0.8 + hash(i, 13)) + i);
    ctx.globalAlpha = 0.85 * Math.min(1, w.petals * 1.8);
    ctx.fillStyle = i % 4 ? pal.blossom : pal.rose;
    ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Autumn: leaves blown on the wind from the left.
  for (let i = 0; i < n.leaves; i++) {
    const speed = 40 + hash(i, 21) * 46;
    const x = mod(hash(i, 20) * 460 + speed * t, 460) - 30;
    const y = mod(hash(i, 22) * 230 + speed * 0.42 * t + 14 * Math.sin(t * 1.3 + i * 2), 230) + 50;
    const s = 0.8 + hash(i, 24) * 0.6;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * (1.4 + hash(i, 23) * 2) + i); ctx.scale(s, s * Math.abs(Math.cos(t * 2.1 + i)) * 0.8 + s * 0.2);
    ctx.globalAlpha = 0.95 * Math.min(1, w.leaves * 1.8);
    ctx.fillStyle = pal[LEAF_COLOURS[i % LEAF_COLOURS.length]];
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.bezierCurveTo(-2.4, -3.6, 2.6, -3.6, 5, 0); ctx.bezierCurveTo(2.6, 3.6, -2.4, 3.6, -5, 0); ctx.fill();
    ctx.restore();
  }
  // Winter snow: soft flakes, nearer ones bigger, with a blue-lilac edge.
  for (let i = 0; i < n.snow; i++) {
    const near = hash(i, 33), fall = 12 + near * 26;
    const y = mod(hash(i, 31) * 340 + fall * t, 340) - 12;
    const x = mod(hash(i, 30) * 420 + 6 * t + 9 * Math.sin(t * (0.6 + near * 0.5) + i * 1.7), 420) - 10;
    const r = 0.9 + near * 1.9;
    ctx.globalAlpha = (0.65 + 0.35 * near) * Math.min(1, w.snow * 1.6);
    ctx.fillStyle = pal['snow-shade'];
    ctx.beginPath(); ctx.arc(x + 0.4, y + 0.5, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.snow;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Two butterflies over the summer meadow.
  if (w.butterflies > 0.02) {
    for (let k = 0; k < 2; k++) {
      const x = 150 + 110 * Math.sin(t * 0.21 + k * 2.4) + 30 * Math.sin(t * 0.53 + k);
      const y = 214 + 26 * Math.sin(t * 0.47 + k * 1.3) + 6 * Math.sin(t * 1.9 + k);
      const flap = 0.25 + 0.75 * Math.abs(Math.sin(t * 9 + k * 1.1));
      ctx.save(); ctx.translate(x, y); ctx.rotate(0.25 * Math.sin(t * 0.8 + k)); ctx.scale(1.7, 1.7);
      ctx.globalAlpha = w.butterflies;
      ctx.fillStyle = k ? pal.lilac : pal.butter;
      ctx.beginPath(); ctx.ellipse(-2.6 * flap, -1.6, 3 * flap, 2.6, -0.5, 0, Math.PI * 2); ctx.ellipse(2.6 * flap, -1.6, 3 * flap, 2.6, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = k ? pal.violet : pal.amber;
      ctx.beginPath(); ctx.ellipse(-1.8 * flap, 1.6, 2 * flap, 1.7, 0.4, 0, Math.PI * 2); ctx.ellipse(1.8 * flap, 1.6, 2 * flap, 1.7, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.ink; ctx.fillRect(-0.45, -2.6, 0.9, 5);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

/** The toys' particles (seasonDialToys): each a pure function of its poke,
 * the year and the poke's age, drawn over the weather. `flower` is the kit's
 * felt flower, once it has loaded. */
export function drawToys(ctx: CanvasRenderingContext2D, particles: readonly ToyParticle[], pal: Palette, kind: number, flower: CanvasImageSource | null): void {
  for (const p of particles) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = Math.min(1, Math.max(0, p.alpha));
    if (p.look === LOOK.fog) {
      const fog = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r);
      fog.addColorStop(0, pal.white); fog.addColorStop(0.5, pal.snow); fog.addColorStop(0.82, pal['snow-shade']); fog.addColorStop(1, 'transparent');
      ctx.fillStyle = fog; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
    } else if (p.look === LOOK.ring) {
      ctx.strokeStyle = pal.white; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * (p.grow ?? 0.3), 0, 0, Math.PI * 2); ctx.stroke();
    } else if (p.look === LOOK.bloom) {
      const k = p.grow ?? 1, h = p.r * 7 * k, w = h * 0.666;
      ctx.rotate(p.turn);
      if (flower) ctx.drawImage(flower, -w / 2, -h, w, h);
      else { ctx.fillStyle = pal.rose; ctx.beginPath(); ctx.arc(0, -h * 0.75, p.r * k, 0, Math.PI * 2); ctx.fill(); }
    } else if (p.look === LOOK.apple) {
      ctx.rotate(p.turn);
      ctx.fillStyle = pal.red; ctx.fillStyle = paintResolved(applePaint(p.tone, kind), pal);
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha *= 0.45; ctx.fillStyle = pal.white; ctx.beginPath(); ctx.arc(-p.r * 0.32, -p.r * 0.34, p.r * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = Math.min(1, p.alpha); ctx.strokeStyle = pal.umber; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -p.r * 0.8); ctx.lineTo(0.7, -p.r * 0.8 - 2.6); ctx.stroke();
    } else if (p.look === LOOK.leafLet) {
      ctx.rotate(p.turn); ctx.scale(p.r / 5, (p.r / 5) * (0.35 + 0.65 * Math.abs(Math.cos(p.turn * 1.7))));
      ctx.fillStyle = pal.orange; ctx.fillStyle = paintResolved(leafPaint(p.tone * 5), pal);
      ctx.beginPath(); ctx.moveTo(-5, 0); ctx.bezierCurveTo(-2.4, -3.6, 2.6, -3.6, 5, 0); ctx.bezierCurveTo(2.6, 3.6, -2.4, 3.6, -5, 0); ctx.fill();
    } else if (p.look === LOOK.petal) {
      ctx.rotate(p.turn); ctx.fillStyle = p.tone > 0.72 ? pal.rose : p.tone > 0.3 ? pal.blossom : pal.white;
      ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    } else if (p.look === LOOK.flake) {
      ctx.fillStyle = pal['snow-shade']; ctx.beginPath(); ctx.arc(0.4, 0.6, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.white; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
    } else if (p.look === LOOK.drop) {
      ctx.fillStyle = pal['sky-pale']; ctx.beginPath(); ctx.ellipse(0, 0, p.r * 0.8, p.r * 1.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.white; ctx.beginPath(); ctx.arc(-p.r * 0.2, -p.r * 0.4, p.r * 0.35, 0, Math.PI * 2); ctx.fill();
    } else if (p.look === LOOK.seedTuft) {
      ctx.rotate(p.turn); ctx.strokeStyle = pal.white; ctx.lineWidth = 0.6; ctx.lineCap = 'round';
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(k * 1.3, -p.r); ctx.stroke(); }
      ctx.fillStyle = pal.umber; ctx.beginPath(); ctx.ellipse(0, 1, 0.6, 1.3, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      // A little star: a mote of sunlight, or (white) a frost crystal with its blue-lilac edge.
      ctx.rotate(p.turn);
      const star = (r: number) => { ctx.beginPath(); for (let k = 0; k < 12; k++) { const a = (k * Math.PI) / 6, d = k % 2 ? r * 0.36 : r * 1.25; ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); } ctx.closePath(); ctx.fill(); };
      if (p.tone > 0.75) { ctx.fillStyle = pal['snow-shade']; star(p.r * 1.35); ctx.fillStyle = pal.white; star(p.r); }
      else { ctx.fillStyle = pal.sun; star(p.r); }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** `still`: reduced motion or Hold still — no frame loop: one frame per
 * change of the year or of the toys, each toy as one settled picture. */
export function SeasonWeather({ year, still, pokes, kind }: { year: number; still: boolean; pokes: readonly Poke[]; kind: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const yearRef = useRef(year);
  const stillRef = useRef(still); stillRef.current = still;
  const pokesRef = useRef(pokes); pokesRef.current = pokes;
  const kindRef = useRef(kind); kindRef.current = kind;
  const clock = useRef(24);
  const palette = useRef<Palette | null>(null);
  const flower = useRef<HTMLImageElement | null>(null);
  const draw = useRef<() => void>(() => {});
  yearRef.current = year;

  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const ctx = el.getContext('2d'); if (!ctx) return;
    palette.current = readPalette(NAMES, el);
    let gone = false;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { if (!gone) { flower.current = img; draw.current(); } };
    img.src = FELT_FLOWER.src;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const box = el.getBoundingClientRect();
      const width = Math.max(1, Math.round(box.width * dpr)), height = Math.max(1, Math.round(box.height * dpr));
      if (el.width !== width || el.height !== height) { el.width = width; el.height = height; }
      // The canvas covers the scene exactly as the SVG does (same box, slice).
      const k = Math.max(width / SCENE_W, height / SCENE_H);
      ctx.setTransform(k, 0, 0, k, (width - SCENE_W * k) / 2, (height - SCENE_H * k) / 2);
    };
    draw.current = () => {
      const pal = palette.current; if (!pal) return;
      drawWeather(ctx, yearRef.current, clock.current, pal);
      if (pokesRef.current.length) drawToys(ctx, allToyParticles(pokesRef.current, yearRef.current, performance.now(), stillRef.current), pal, kindRef.current, flower.current);
    };
    fit(); draw.current();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { fit(); draw.current(); });
    observer?.observe(el);
    return () => {
      gone = true; img.onload = null; flower.current = null;
      observer?.disconnect();
      draw.current = () => {};
      // Release the bitmap: a zero-size canvas holds no memory.
      el.width = 0; el.height = 0;
    };
  }, []);

  useEffect(() => { draw.current(); }, [year, pokes, kind, still]);

  useEffect(() => {
    if (still) { draw.current(); return; }
    let frame = 0, last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (document.visibilityState !== 'hidden') { clock.current += dt; draw.current(); }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [still]);

  return <canvas ref={canvas} className="sd-scene__weather" aria-hidden="true" />;
}
