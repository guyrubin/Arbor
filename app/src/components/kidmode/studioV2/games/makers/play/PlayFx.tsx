import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { prefersReducedMotion } from './playJuice';
import { FX_MAX, FX_PLANS, fxSpawn, fxStep, type FxKind, type FxOptions, type FxParticle } from './playFxMath';

export type { FxKind, FxOptions } from './playFxMath';
export interface PlayFxHandle {
  /** A burst at a stage point (fractions 0..1 of the layer). */
  burst(x: number, y: number, kind: FxKind, opts?: FxOptions): void;
  /** One or two particles left behind a fast thing; call it while it moves. */
  trail(x: number, y: number, kind: FxKind, opts?: FxOptions): void;
  clear(): void;
}
export interface PlayFxProps { className?: string; /** Above or below your props: z-index inside the world. Default 5. */ layer?: number }

const TONE_FALLBACK = '--studio-surface';
/** Palette token names (`'gold-light'`, `'white'`) resolve to `--mk-*`; a name
 * that starts `studio-` resolves to the Studio token. Resolved once per name
 * with `getComputedStyle`, so the canvas carries no colour literal. */
function resolveTone(el: Element, name: string, cache: Map<string, string>): string {
  const hit = cache.get(name); if (hit) return hit;
  const style = getComputedStyle(el);
  const token = name.startsWith('--') ? name : name.startsWith('studio-') ? `--${name}` : `--mk-${name}`;
  const value = style.getPropertyValue(token).trim() || style.getPropertyValue(TONE_FALLBACK).trim() || style.color;
  cache.set(name, value); return value;
}

/** The makers' particle layer: one canvas inside the world (so it moves with
 * the camera), DPR-aware, capped at `FX_MAX` particles, drawing only while
 * something is alive, paused when the tab is hidden and cleared on unmount.
 * Under reduced motion a burst is a single soft flash that fades (no travel). */
export const PlayFx = forwardRef<PlayFxHandle, PlayFxProps>(function PlayFx({ className, layer }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const state = useRef({ particles: [] as FxParticle[], frame: 0, last: 0, w: 0, h: 0, dpr: 1, alive: true, tones: new Map<string, string>() });

  useEffect(() => {
    const canvas = canvasRef.current, s = state.current;
    if (!canvas) return;
    s.alive = true;
    const measure = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
      // The layout box, not the camera-scaled one: particles live in world units.
      const w = canvas.offsetWidth || box.width, h = canvas.offsetHeight || box.height;
      if (!w || !h) return;
      s.w = w; s.h = h; s.dpr = dpr;
      const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(canvas);
    const onVisibility = () => { if (document.visibilityState === 'hidden') { if (s.frame) cancelAnimationFrame(s.frame); s.frame = 0; s.last = 0; } else if (s.particles.length && !s.frame) s.frame = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVisibility);
    function draw(time: number) {
      s.frame = 0;
      if (!s.alive || !canvas) return;
      const ctx = canvas.getContext('2d'); if (!ctx) { s.particles.length = 0; return; }
      const dt = s.last ? Math.min(0.05, (time - s.last) / 1000) : 1 / 60; s.last = time;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);
      s.particles = fxStep(s.particles, dt);
      for (const p of s.particles) paint(ctx, p, s.w, s.h, resolveTone(canvas, p.tone, s.tones));
      if (s.particles.length) s.frame = requestAnimationFrame(draw); else s.last = 0;
    }
    (s as typeof s & { kick?: () => void }).kick = () => { if (!s.frame && s.alive && document.visibilityState !== 'hidden') s.frame = requestAnimationFrame(draw); };
    return () => {
      s.alive = false; if (s.frame) cancelAnimationFrame(s.frame); s.frame = 0; s.last = 0; s.particles = [];
      observer?.disconnect(); document.removeEventListener('visibilitychange', onVisibility);
      try { canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); } catch { /* Canvas unavailable. */ }
    };
  }, []);

  useImperativeHandle(ref, () => {
    const s = state.current as typeof state.current & { kick?: () => void };
    const add = (x: number, y: number, kind: FxKind, opts: FxOptions | undefined, trail: boolean) => {
      if (!s.alive || !Number.isFinite(x) || !Number.isFinite(y) || !(kind in FX_PLANS)) return;
      const born = fxSpawn(x, y, kind, { ...opts, reduced: prefersReducedMotion(), trail, aspect: s.h ? s.w / s.h : 1 });
      s.particles = s.particles.concat(born);
      if (s.particles.length > FX_MAX) s.particles = s.particles.slice(s.particles.length - FX_MAX);
      s.kick?.();
    };
    return {
      burst: (x, y, kind, opts) => add(x, y, kind, opts, false),
      trail: (x, y, kind, opts) => add(x, y, kind, opts, true),
      clear: () => { s.particles = []; const c = canvasRef.current; try { c?.getContext('2d')?.clearRect(0, 0, c.width, c.height); } catch { /* Canvas unavailable. */ } },
    };
  }, []);

  return <canvas ref={canvasRef} className={`play-fx${className ? ` ${className}` : ''}`} style={layer == null ? undefined : { zIndex: layer }} aria-hidden="true" data-play-fx="" />;
});

const SOFT_RINGS: readonly (readonly [number, number])[] = [[1, 0.1], [0.82, 0.14], [0.64, 0.2], [0.46, 0.28], [0.28, 0.36]];
/** One particle. Position is in stage fractions; size is a fraction of the
 * shorter side, so a burst looks the same on a phone and a desktop. */
function paint(ctx: CanvasRenderingContext2D, p: FxParticle, w: number, h: number, colour: string) {
  const unit = Math.min(w, h), x = p.x * w, y = p.y * h, size = Math.max(0.5, p.size * unit), t = p.age / p.life;
  const fade = p.shape === 'ring' ? 1 - t : t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.88);
  ctx.globalAlpha = Math.max(0, Math.min(1, fade * p.alpha));
  ctx.fillStyle = colour; ctx.strokeStyle = colour;
  if (p.shape === 'ring') {
    ctx.lineWidth = Math.max(1, size * 0.14 * (1 - t));
    ctx.beginPath(); ctx.arc(x, y, size * (0.3 + t * 1.7), 0, Math.PI * 2); ctx.stroke();
  } else if (p.shape === 'star') {
    // A four-point glint: two crossed slivers that breathe.
    const pulse = 0.6 + 0.4 * Math.sin(p.age * 14 + p.spin);
    ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
    for (let i = 0; i < 2; i++) {
      ctx.rotate(Math.PI / 2 * i);
      ctx.beginPath(); ctx.moveTo(-size * pulse, 0); ctx.quadraticCurveTo(0, -size * 0.16, size * pulse, 0); ctx.quadraticCurveTo(0, size * 0.16, -size * pulse, 0); ctx.fill();
    }
    ctx.restore();
  } else if (p.shape === 'soft') {
    // A soft puff: stacked discs of the one colour (a gradient to transparent would pass through grey).
    const base = ctx.globalAlpha;
    for (const [share, alpha] of SOFT_RINGS) { ctx.globalAlpha = base * alpha; ctx.beginPath(); ctx.arc(x, y, size * share, 0, Math.PI * 2); ctx.fill(); }
  } else if (p.shape === 'petal') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.scale(1, 0.55 + 0.45 * Math.cos(p.age * 5 + p.spin));
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.quadraticCurveTo(size * 0.9, -size * 0.2, 0, size); ctx.quadraticCurveTo(-size * 0.9, -size * 0.2, 0, -size); ctx.fill();
    ctx.restore();
  } else if (p.shape === 'drop') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(p.vy, p.vx * (w / h)) - Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -size * 1.5); ctx.quadraticCurveTo(size * 0.8, 0, 0, size * 0.7); ctx.quadraticCurveTo(-size * 0.8, 0, 0, -size * 1.5); ctx.fill();
    ctx.restore();
  } else if (p.shape === 'chip' || p.shape === 'paper') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
    if (p.shape === 'paper') ctx.scale(1, Math.cos(p.age * 9 + p.spin));
    ctx.beginPath();
    if (p.shape === 'chip') { ctx.moveTo(-size, -size * 0.5); ctx.lineTo(size * 0.8, -size * 0.7); ctx.lineTo(size, size * 0.6); ctx.lineTo(-size * 0.6, size * 0.7); }
    else ctx.rect(-size, -size * 0.6, size * 2, size * 1.2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  } else {
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
