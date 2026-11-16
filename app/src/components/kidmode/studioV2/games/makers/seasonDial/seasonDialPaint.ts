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

/** The three years' own small colours (seasonDialRules `yearKind`): how the
 * apples ripen, the birds' breasts and the snow friend's scarf. */
export const YEAR_LOOKS = [
  { ripe: 'red', breast: 'orange', scarf: 'red', scarfEnd: 'poppy' },
  { ripe: 'amber', breast: 'bluebell', scarf: 'teal', scarfEnd: 'sea' },
  { ripe: 'rose-deep', breast: 'butter', scarf: 'violet', scarfEnd: 'lilac' },
] as const;
export const yearLook = (kind: number) => YEAR_LOOKS[((Math.floor(kind) % YEAR_LOOKS.length) + YEAR_LOOKS.length) % YEAR_LOOKS.length];
/** An apple's skin as it ripens: green, then gold, then this year's colour. */
export function applePaint(red: number, kind: number): Paint {
  const unripe = mixPaint('spring', 'leaf', 0.3);
  return red < 0.5 ? mixPaint(unripe, 'amber', red * 1.6) : mixPaint(mixPaint(unripe, 'amber', 0.8), yearLook(kind).ripe, (red - 0.5) * 2);
}
/** A paint as one colour the canvas can take: the palette's resolved values
 * through color-mix(), so a canvas shape and its SVG twin are the same colour. */
export function paintResolved(p: Paint, palette: Palette): string {
  if (typeof p === 'string') return palette[p] ?? 'currentColor';
  return `color-mix(in srgb, ${paintResolved(p.a, palette)}, ${paintResolved(p.b, palette)} ${Math.round(p.t * 1000) / 10}%)`;
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
