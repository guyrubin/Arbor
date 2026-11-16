/** The rendered bowl as a picture the SVG layers can show. The arithmetic is
 * `bowlRender.ts`; this file is the only part that touches the DOM: it reads
 * the glaze colours from the makers' palette (resolved with getComputedStyle,
 * so no colour is written here), paints the pixels to a canvas and hands back
 * an image URL per glaze. A small texture is ready at once; the full one is
 * worked out in slices between frames and replaces it. Where there is no
 * canvas (tests, a server render) the hook returns null and the bowl falls
 * back to its vector drawing. */
import { useSyncExternalStore } from 'react';
import { BOWL_GLAZES, type BowlGlaze } from './mendBowlRules';
import { bowlLighting, bowlPixels, emptyLighting, keepLighting, lightRows, type BowlLighting, type BowlTones, type Rgb } from './bowlRender';

type Mix = readonly [token: string, share?: number, other?: string];
type Recipe = Readonly<Record<keyof BowlTones, Mix>>;
/** Each glaze, as mixes of palette tokens. */
export const GLAZE_PAINT: Readonly<Record<BowlGlaze, Recipe>> = {
  celadon: { base: ['--mk-celadon'], deep: ['--mk-celadon-deep', 0.8, '--mk-teal-deep'], light: ['--mk-celadon', 0.4, '--mk-white'], clay: ['--mk-clay-pale'], speck: ['--mk-umber'], bounce: ['--mk-linen'] },
  indigo: { base: ['--mk-bluebell', 0.5, '--mk-indigo'], deep: ['--mk-indigo-deep'], light: ['--mk-sky', 0.5, '--mk-bluebell'], clay: ['--mk-clay-pale'], speck: ['--mk-sky-pale'], bounce: ['--mk-linen'] },
  rose: { base: ['--mk-rose', 0.86, '--mk-blossom'], deep: ['--mk-rose-deep'], light: ['--mk-blossom'], clay: ['--mk-clay-pale'], speck: ['--mk-plum'], bounce: ['--mk-linen'] },
  cream: { base: ['--mk-cream', 0.8, '--mk-sand'], deep: ['--mk-sand', 0.8, '--mk-wood-light'], light: ['--mk-white', 0.7, '--mk-cream'], clay: ['--mk-clay-light'], speck: ['--mk-umber'], bounce: ['--mk-linen'] },
};
const SMALL = 144, FULL = 512, SLICE_MS = 7;

const urls = new Map<BowlGlaze, string>(), rank = new Map<BowlGlaze, number>();
const listeners = new Set<() => void>();
let started = false, fullReady = false;
const emit = () => listeners.forEach(fn => fn());

function canPaint(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  // jsdom has a canvas element and no context: asking only prints an error.
  return !/jsdom/i.test(window.navigator?.userAgent ?? '');
}
/** A palette token's colour, read from the live stylesheet. */
function tokenRgb(probe: HTMLElement, token: string): Rgb | null {
  probe.style.color = ''; probe.style.color = `var(${token})`;
  const parts = getComputedStyle(probe).color.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return null;
  const v = parts.slice(0, 3).map(Number);
  // `color(srgb r g b)` is written in 0…1; `rgb()` in 0…255.
  return /color\(/.test(getComputedStyle(probe).color) ? [v[0] * 255, v[1] * 255, v[2] * 255] : [v[0], v[1], v[2]];
}
function resolveTones(): Record<BowlGlaze, BowlTones> | null {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  try {
    const out = {} as Record<BowlGlaze, BowlTones>;
    for (const glaze of BOWL_GLAZES) {
      const tones = {} as Record<keyof BowlTones, Rgb>;
      for (const key of Object.keys(GLAZE_PAINT[glaze]) as (keyof BowlTones)[]) {
        const [token, share = 1, other] = GLAZE_PAINT[glaze][key];
        const a = tokenRgb(probe, token), b = other ? tokenRgb(probe, other) : a;
        if (!a || !b) return null;
        tones[key] = [a[0] * share + b[0] * (1 - share), a[1] * share + b[1] * (1 - share), a[2] * share + b[2] * (1 - share)];
      }
      out[glaze] = tones;
    }
    return out;
  } finally { probe.remove(); }
}
function paint(light: BowlLighting, tones: BowlTones): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = light.size;
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  const image = ctx.createImageData(light.size, light.size);
  image.data.set(bowlPixels(light, tones));
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/webp', 0.94);
}
function paintAll(light: BowlLighting, tones: Record<BowlGlaze, BowlTones>, first: BowlGlaze, done?: () => void) {
  // The glaze on the table first; the rest one per turn of the event loop.
  const order = [first, ...BOWL_GLAZES.filter(g => g !== first)];
  const next = () => {
    const glaze = order.shift(); if (!glaze) { done?.(); return; }
    try { const url = (rank.get(glaze) ?? 0) <= light.size ? paint(light, tones[glaze]) : null; if (url) { urls.set(glaze, url); rank.set(glaze, light.size); emit(); } } catch { /* The vector bowl stays. */ }
    setTimeout(next, 0);
  };
  next();
}
/** Starts the textures (once per page): a small one now, the full one in slices. */
export function warmBowlTextures(first: BowlGlaze = 'celadon'): void {
  if (started || !canPaint()) return;
  started = true;
  let tones: Record<BowlGlaze, BowlTones> | null = null;
  try { tones = resolveTones(); } catch { tones = null; }
  if (!tones) return;
  const palette = tones;
  try { paintAll(bowlLighting(SMALL), palette, first); } catch { return; }
  const full = emptyLighting(FULL);
  let row = 0;
  const slice = () => {
    const until = performance.now() + SLICE_MS;
    while (row < FULL && performance.now() < until) { lightRows(full, row, row + 4); row += 4; }
    if (row < FULL) { setTimeout(slice, 12); return; }
    keepLighting(full);
    paintAll(full, palette, first, () => { fullReady = true; });
  };
  setTimeout(slice, 60);
}
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
/** The rendered bowl for a glaze as an image URL, or null while there is none. */
export function useBowlTexture(glaze: BowlGlaze): string | null {
  return useSyncExternalStore(subscribe, () => urls.get(glaze) ?? null, () => null);
}
/** True once the full-size textures are in (the rendered checks wait for it). */
export function bowlTexturesReady(): boolean { return fullReady; }
