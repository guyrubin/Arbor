import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** Game-feel helpers shared by the twelve makers. Everything here is
 * decoration: play never waits on it, and every helper collapses to nothing
 * when the child's device asks for reduced motion. */

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
/** Reads the setting now (for handlers and timers; components use the hook). */
export function prefersReducedMotion(): boolean {
  try { return typeof window !== 'undefined' && !!window.matchMedia?.(REDUCED_QUERY).matches; } catch { return false; }
}
/** Live `prefers-reduced-motion`: re-renders when the setting changes. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    let media: MediaQueryList | undefined;
    try { media = window.matchMedia?.(REDUCED_QUERY); } catch { media = undefined; }
    if (!media) return;
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
/** A tiny seeded generator (mulberry32) for replay variety: the same seed
 * always lays a round out the same way, so tests can pin a layout. */
export function seededRandom(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A fresh seed for one round (the only non-deterministic call in the kit). */
export function roundSeed(): number { return Math.floor(Math.random() * 0x7fffffff) + 1; }
/** A seeded pick, and a seeded shuffle that does not touch its input. */
export function pick<T>(random: () => number, list: readonly T[]): T { return list[Math.min(list.length - 1, Math.floor(random() * list.length))]; }
export function shuffled<T>(random: () => number, list: readonly T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export interface PlayCamera { x: number; y: number; zoom: number }
export const CAMERA_HOME: PlayCamera = { x: 0.5, y: 0.5, zoom: 1 };
/** The world-layer transform for a camera: the focus point (stage fractions)
 * is brought toward the centre, clamped so the world never shows an edge. */
export function cameraTransform(camera: PlayCamera | undefined): { x: number; y: number; scale: number } {
  const zoom = clamp(camera?.zoom ?? 1, 1, 3);
  const room = (zoom - 1) / 2; // how far the scaled world may slide, as a fraction of the stage
  const x = clamp((0.5 - clamp(camera?.x ?? 0.5, 0, 1)) * zoom, -room, room);
  const y = clamp((0.5 - clamp(camera?.y ?? 0.5, 0, 1)) * zoom, -room, room);
  return { x: x * 100 + 0, y: y * 100 + 0, scale: zoom };
}

/** `const [shake, bump] = useShake()`: pass `shake` to `<PlayStage shake>`,
 * call `bump()` on a big moment. The stage plays one short shake per change. */
export function useShake(): [number, () => void] {
  const [shake, setShake] = useState(0);
  const bump = useCallback(() => setShake(n => n + 1), []);
  return [shake, bump];
}

export interface ParallaxOptions { enabled?: boolean; /** Listen to device tilt as well as the pointer. */ tilt?: boolean }
/** Writes `--play-px` and `--play-py` (each -1..1, eased) on the element from
 * the pointer position over it and, where the device offers it without a
 * permission prompt, from tilt. No re-renders; one rAF while it is moving.
 * CSS decides what moves: `translate: calc(var(--play-px) * 6px) …`. */
export function usePointerParallax<T extends HTMLElement>(options: ParallaxOptions | boolean = true): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const settings = typeof options === 'boolean' ? { enabled: options } : options;
  const enabled = settings.enabled !== false, tilt = settings.tilt !== false;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || prefersReducedMotion()) { el?.style.removeProperty('--play-px'); el?.style.removeProperty('--play-py'); return; }
    let targetX = 0, targetY = 0, x = 0, y = 0, frame = 0, alive = true;
    const step = () => {
      frame = 0; if (!alive) return;
      x += (targetX - x) * 0.12; y += (targetY - y) * 0.12;
      el.style.setProperty('--play-px', x.toFixed(3)); el.style.setProperty('--play-py', y.toFixed(3));
      if (Math.abs(targetX - x) > 0.002 || Math.abs(targetY - y) > 0.002) frame = requestAnimationFrame(step);
    };
    const aim = (nx: number, ny: number) => { targetX = clamp(nx, -1, 1); targetY = clamp(ny, -1, 1); if (!frame && alive) frame = requestAnimationFrame(step); };
    const onPointer = (event: PointerEvent) => {
      const box = el.getBoundingClientRect(); if (!box.width || !box.height) return;
      aim(((event.clientX - box.left) / box.width) * 2 - 1, ((event.clientY - box.top) / box.height) * 2 - 1);
    };
    const onLeave = () => aim(0, 0);
    const onTilt = (event: DeviceOrientationEvent) => { if (event.gamma == null || event.beta == null) return; aim(event.gamma / 24, (event.beta - 45) / 28); };
    el.addEventListener('pointermove', onPointer, { passive: true });
    el.addEventListener('pointerleave', onLeave, { passive: true });
    // Tilt only where the browser hands it over freely: never a permission prompt in a child's game.
    const Orientation = (globalThis as { DeviceOrientationEvent?: { requestPermission?: unknown } }).DeviceOrientationEvent;
    const tiltFree = tilt && !!Orientation && typeof Orientation.requestPermission !== 'function';
    if (tiltFree) window.addEventListener('deviceorientation', onTilt, { passive: true });
    return () => {
      alive = false; if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onPointer); el.removeEventListener('pointerleave', onLeave);
      if (tiltFree) window.removeEventListener('deviceorientation', onTilt);
      el.style.removeProperty('--play-px'); el.style.removeProperty('--play-py');
    };
  }, [enabled, tilt]);
  return ref;
}

let hitPauseTimer: ReturnType<typeof setTimeout> | undefined;
/** A hit-pause: every CSS animation under a play stage holds still for `ms`
 * (40 to 160 is the useful range), then carries on. Resolves when it ends;
 * resolves at once under reduced motion. Never gate play on it. */
export function hitPause(ms = 90): Promise<void> {
  if (typeof document === 'undefined' || prefersReducedMotion() || !(ms > 0)) return Promise.resolve();
  const root = document.documentElement;
  root.setAttribute('data-play-hitpause', '');
  if (hitPauseTimer) clearTimeout(hitPauseTimer);
  return new Promise(resolve => {
    hitPauseTimer = setTimeout(() => { hitPauseTimer = undefined; root.removeAttribute('data-play-hitpause'); resolve(); }, clamp(ms, 16, 400));
  });
}
/** Ends a hit-pause early (the stage calls it on unmount). */
export function releaseHitPause(): void {
  if (hitPauseTimer) { clearTimeout(hitPauseTimer); hitPauseTimer = undefined; }
  if (typeof document !== 'undefined') document.documentElement.removeAttribute('data-play-hitpause');
}

/** Spring presets for `motion` (`transition={spring.pop}`). One family, so
 * twelve activities move like one game. */
export const spring = {
  /** A thing arriving: quick, with a clear overshoot. */
  pop: { type: 'spring', stiffness: 520, damping: 22, mass: 0.8 },
  /** A thing landing on a surface: a little squash, settles fast. */
  land: { type: 'spring', stiffness: 380, damping: 18, mass: 1 },
  /** A soft return after a miss: no bounce to speak of. */
  settle: { type: 'spring', stiffness: 260, damping: 30, mass: 1 },
  /** Following a finger. */
  snap: { type: 'spring', stiffness: 900, damping: 46, mass: 0.6 },
  /** The camera and large layers. */
  camera: { type: 'spring', stiffness: 70, damping: 20, mass: 1.1 },
  /** Slow idle drifts. */
  drift: { type: 'spring', stiffness: 30, damping: 14, mass: 1.4 },
  /** Reduced motion: a short fade, no travel. */
  cut: { type: 'tween', duration: 0.12, ease: 'linear' },
} as const;
export type SpringName = keyof typeof spring;
/** The preset to use now: the named spring, or the cut under reduced motion. */
export function springFor(name: SpringName, reduced: boolean) { return reduced ? spring.cut : spring[name]; }
