import { useEffect, useRef } from 'react';
import { particleCounts, weatherAt, wrapYear } from './seasonDialRules';
import { readPalette, type Palette } from './seasonDialPaint';
import { SCENE_H, SCENE_W } from './SeasonScene';

/** The weather layer: ONE canvas over the scene, at most PARTICLE_CAP
 * particles. How many of each kind show is a function of `year`; where each
 * one is is a function of its own seed and the ambient clock, so nothing is
 * spawned or left behind: turn the dial back and the snow is simply not
 * there. With reduced motion or Pause, the clock stands still (a still frame
 * of the same weather). The canvas and its frame loop go when it unmounts. */
const NAMES = ['sky-pale', 'steel-light', 'blossom', 'rose', 'white', 'amber', 'orange', 'red', 'rust', 'snow', 'snow-shade', 'butter', 'lilac', 'violet', 'shadow', 'ink'] as const;

/** A fixed hash of (index, salt) into [0, 1). */
function hash(i: number, salt: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const mod = (v: number, m: number) => ((v % m) + m) % m;
const LEAF_COLOURS = ['amber', 'orange', 'red', 'rust'] as const;

export function drawWeather(ctx: CanvasRenderingContext2D, year: number, t: number, pal: Palette): void {
  const w = weatherAt(wrapYear(year)), n = particleCounts(w);
  ctx.clearRect(0, 0, SCENE_W, SCENE_H);

  // Summer cloud shadows sliding over the meadow.
  if (w.cloudShadows > 0.02) {
    ctx.fillStyle = pal.shadow;
    for (let k = 0; k < 2; k++) {
      const x = mod(t * 5 + k * 260, 620) - 110;
      ctx.globalAlpha = 0.09 * w.cloudShadows;
      ctx.beginPath(); ctx.ellipse(x, 284 + k * 16, 92 - k * 20, 11 - k * 2, 0, 0, Math.PI * 2); ctx.fill();
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
      const x = 170 + 120 * Math.sin(t * 0.21 + k * 2.4) + 30 * Math.sin(t * 0.53 + k);
      const y = 236 + 20 * Math.sin(t * 0.47 + k * 1.3) + 6 * Math.sin(t * 1.9 + k);
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

/** `still`: reduced motion or Pause — no frame loop, one frame per year change. */
export function SeasonWeather({ year, still }: { year: number; still: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const yearRef = useRef(year);
  const clock = useRef(24);
  const palette = useRef<Palette | null>(null);
  const draw = useRef<() => void>(() => {});
  yearRef.current = year;

  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const ctx = el.getContext('2d'); if (!ctx) return;
    palette.current = readPalette(NAMES, el);
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const box = el.getBoundingClientRect();
      const width = Math.max(1, Math.round(box.width * dpr)), height = Math.max(1, Math.round(box.height * dpr));
      if (el.width !== width || el.height !== height) { el.width = width; el.height = height; }
      // The canvas covers the scene exactly as the SVG does (same 5:4 box, slice).
      const k = Math.max(width / SCENE_W, height / SCENE_H);
      ctx.setTransform(k, 0, 0, k, (width - SCENE_W * k) / 2, (height - SCENE_H * k) / 2);
    };
    draw.current = () => { if (palette.current) drawWeather(ctx, yearRef.current, clock.current, palette.current); };
    fit(); draw.current();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { fit(); draw.current(); });
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      draw.current = () => {};
      // Release the bitmap: a zero-size canvas holds no memory.
      el.width = 0; el.height = 0;
    };
  }, []);

  useEffect(() => { draw.current(); }, [year]);

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
