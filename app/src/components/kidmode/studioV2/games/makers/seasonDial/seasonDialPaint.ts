import { LEAF_RAMP, mixPaint, type Paint } from './seasonDialRules';

/** A rules `Paint` as CSS: palette tokens through var(), mixes through
 * color-mix(). No colour literal is ever written. */
export function paint(p: Paint): string {
  if (typeof p === 'string') return `var(--mk-${p})`;
  return `color-mix(in srgb, ${paint(p.a)}, ${paint(p.b)} ${Math.round(p.t * 1000) / 10}%)`;
}
/** A point on the leaf ramp (0 fresh green … 5 red) as a paint. */
export function leafPaint(tint: number): Paint {
  const t = Math.min(LEAF_RAMP.length - 1, Math.max(0, tint));
  const i = Math.min(LEAF_RAMP.length - 2, Math.floor(t));
  return mixPaint(LEAF_RAMP[i], LEAF_RAMP[i + 1], t - i);
}
/** The light from the top left: lit leaves take a little butter, the far
 * side of the crown a little shadow. `shade` 0 lit … 1 shaded. */
export function shaded(p: Paint, shade: number): Paint {
  if (shade > 0.45) return mixPaint(p, 'shadow', (shade - 0.45) * 0.5);
  if (shade < 0.35) return mixPaint(p, 'butter', (0.35 - shade) * 0.55);
  return p;
}

/** The palette, read once from the page, for the canvas (which cannot use
 * var()). Values come from makerPalette.css; nothing is hard-coded here. */
export type Palette = Readonly<Record<string, string>>;
export function readPalette(names: readonly string[], from: Element | null): Palette {
  const out: Record<string, string> = {};
  try {
    const style = from ? getComputedStyle(from) : null;
    for (const name of names) out[name] = style?.getPropertyValue(`--mk-${name}`).trim() || 'currentColor';
  } catch {
    for (const name of names) out[name] = 'currentColor';
  }
  return out;
}
