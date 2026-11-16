import type { CSSProperties, ReactNode } from 'react';

/** The Paper Boat's shared cut-paper vocabulary. Every piece is a flat matte
 * shape with a lighter 1–2px top edge (the cut catching the light from the
 * top-left); depth comes from the cast shadows the book draws under each
 * standing layer, never from outlines. Colour only through the makers'
 * palette (--mk-*) and the Studio tokens. */

export const mk = (name: string) => `var(--mk-${name})`;
/** `a` mixed with `b` (`pct` of `a`). */
export const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${mk(a)} ${Math.round(pct)}%, ${mk(b)})`;
/** `a` at `pct` opacity. */
export const fade = (a: string, pct: number) => `color-mix(in srgb, ${mk(a)} ${Math.round(pct)}%, transparent)`;
/** A colour string's lighter edge: the same paper a little paler. */
export const edgeOf = (colour: string) => `color-mix(in srgb, ${colour} 52%, ${mk('white')})`;

/** A cut-paper shape: the shape, with its lighter top edge peeking out above. */
export function Cut({ d, fill, edge, lift = 1.4, style, className }: { d: string; fill: string; edge?: string | false; lift?: number; style?: CSSProperties; className?: string }) {
  return <g className={className} style={style}>
    {edge !== false && <path d={d} transform={`translate(0 ${-lift})`} style={{ fill: edge ?? edgeOf(fill) }} />}
    <path d={d} style={{ fill }} />
  </g>;
}

/** The paper boat, side on, bow to the right (the book mirrors it in Hebrew).
 * A classic folded newspaper boat: a trapezoid hull with its inner fold showing,
 * a centre sail creased down the middle. White, with a faint blue fold shading,
 * so it is the same boat on every spread. Drawn in an 80 × 60 box. */
export function BoatArt({ glow = false }: { glow?: boolean }) {
  const white = mk('white'), crease = mix('white', 74, 'sky-pale'), shade = mix('snow', 72, 'snow-shade'), deep = mix('snow-shade', 70, 'sky');
  return <g>
    {glow && <ellipse cx="40" cy="52" rx="38" ry="9" style={{ fill: fade('sun', 55) }} />}
    {/* sail: lit left half, shaded right half, the crease between */}
    <Cut d="M40 4 L24 35 L40 35 Z" fill={white} edge={mk('white')} />
    <path d="M40 4 L56 35 L40 35 Z" style={{ fill: crease }} />
    <path d="M40 4 L41.2 35 L40 35 Z" style={{ fill: mix('sky-pale', 60, 'snow-shade') }} />
    {/* hull */}
    <Cut d="M3 34 L77 34 L63 53 L17 53 Z" fill={white} />
    <path d="M10 43 L70 43 L63 53 L17 53 Z" style={{ fill: shade }} />
    {/* the inner fold of the hull */}
    <path d="M24 34 L40 47 L56 34 Z" style={{ fill: crease }} />
    <path d="M40 47 L56 34 L58.5 34 Z" style={{ fill: deep }} />
    <path d="M3 34 L17 53 L19 53 L8 34 Z" style={{ fill: mix('white', 80, 'snow-shade') }} />
    <path d="M77 34 L63 53 L61 53 L72 34 Z" style={{ fill: deep }} />
  </g>;
}

/** The boat as an SVG box (for the cover and the book). */
export function Boat({ glow, className, style }: { glow?: boolean; className?: string; style?: CSSProperties }) {
  return <svg viewBox="0 0 80 60" className={className} style={style} aria-hidden="true" focusable="false"><BoatArt glow={glow} /></svg>;
}

/** The water ring a floating boat makes. */
export function Ripple({ cx, cy, rx, ry, colour = 'sky-pale', opacity = 0.7 }: { cx: number; cy: number; rx: number; ry: number; colour?: string; opacity?: number }) {
  return <g style={{ opacity }}>
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} style={{ fill: 'none', stroke: fade(colour, 80), strokeWidth: 1.6 }} />
    <ellipse cx={cx} cy={cy} rx={rx * 0.62} ry={ry * 0.6} style={{ fill: 'none', stroke: fade(colour, 55), strokeWidth: 1.2 }} />
  </g>;
}

/** A rounded tuft of leaves (bushes, canopies): overlapping lobes, lit on top. */
export function Lobes({ lobes, fill, shade, light }: { lobes: readonly (readonly [number, number, number])[]; fill: string; shade: string; light?: string }) {
  return <g>
    {lobes.map(([cx, cy, r], i) => <circle key={`s${i}`} cx={cx + r * 0.12} cy={cy + r * 0.16} r={r} style={{ fill: shade }} />)}
    {lobes.map(([cx, cy, r], i) => <circle key={`f${i}`} cx={cx} cy={cy} r={r * 0.94} style={{ fill }} />)}
    {light && lobes.map(([cx, cy, r], i) => <circle key={`l${i}`} cx={cx - r * 0.28} cy={cy - r * 0.32} r={r * 0.42} style={{ fill: light }} />)}
  </g>;
}

/** Reeds and bulrushes: blades and a few brown heads. */
export function Reeds({ w, h, blades, tone = 'leaf', heads = true }: { w: number; h: number; blades: number; tone?: string; heads?: boolean }) {
  const items: ReactNode[] = [];
  for (let i = 0; i < blades; i++) {
    const x = (w * (i + 0.5)) / blades + (i % 2 ? 2 : -2), tall = h * (0.62 + ((i * 37) % 30) / 80), lean = ((i * 53) % 13) - 6;
    const fill = i % 3 === 0 ? mk('leaf-deep') : i % 3 === 1 ? mk(tone) : mix(tone, 70, 'spring');
    items.push(<Cut key={`b${i}`} d={`M${x - 3} ${h} Q ${x - 1 + lean * 0.3} ${h - tall * 0.6} ${x + lean} ${h - tall} Q ${x + 1 + lean * 0.4} ${h - tall * 0.55} ${x + 3} ${h} Z`} fill={fill} lift={1} />);
    if (heads && i % 2 === 0) items.push(<g key={`h${i}`}><rect x={x + lean * 0.86 - 2.6} y={h - tall * 0.92} width="5.2" height={Math.min(16, tall * 0.26)} rx="2.6" style={{ fill: mk('umber') }} /><rect x={x + lean * 0.86 - 1.4} y={h - tall * 0.92 + 1} width="1.6" height={Math.min(12, tall * 0.2)} rx=".8" style={{ fill: mk('fur-light') }} /></g>);
  }
  return <g>{items}</g>;
}

/** The paper wheel: a ship's wheel printed on a cut card disc (its handles cut
 * past the rim), pinned at the centre with a brass paper fastener. 200 × 200. */
export function WheelDisc() {
  const handles = Array.from({ length: 8 }, (_, i) => i * 45);
  return <g>
    {/* the card disc with its cut handles */}
    <g style={{ filter: 'none' }}>
      {handles.map(a => <rect key={`k${a}`} x="92" y="6" width="16" height="34" rx="8" transform={`rotate(${a} 100 100)`} style={{ fill: mk('wood-dark') }} />)}
      {handles.map(a => <rect key={`h${a}`} x="93" y="5" width="14" height="32" rx="7" transform={`rotate(${a} 100 100)`} style={{ fill: mk('wood-light') }} />)}
      <circle cx="100" cy="101.5" r="70" style={{ fill: mk('wood-dark') }} />
      <circle cx="100" cy="100" r="70" style={{ fill: mk('paper') }} />
    </g>
    {/* the printed ship's wheel */}
    <circle cx="100" cy="100" r="60" style={{ fill: 'none', stroke: mk('wood'), strokeWidth: 12 }} />
    <circle cx="100" cy="100" r="60" style={{ fill: 'none', stroke: mk('wood-light'), strokeWidth: 3, strokeDasharray: '7 9' }} />
    {handles.map(a => <rect key={`s${a}`} x="96.5" y="38" width="7" height="50" rx="3" transform={`rotate(${a} 100 100)`} style={{ fill: mk('wood') }} />)}
    <circle cx="100" cy="100" r="22" style={{ fill: mk('wood') }} />
    <circle cx="100" cy="100" r="15" style={{ fill: mk('wood-light') }} />
    {/* the top handle is gold: it shows which way the wheel is turned */}
    <rect x="93" y="5" width="14" height="32" rx="7" style={{ fill: mk('gold-light') }} />
    <rect x="96" y="9" width="4" height="22" rx="2" style={{ fill: mk('butter') }} />
    {/* the brass paper fastener */}
    <circle cx="100" cy="100" r="8" style={{ fill: mk('gold-deep') }} />
    <circle cx="100" cy="99" r="7" style={{ fill: mk('gold') }} />
    <circle cx="98" cy="97" r="2.5" style={{ fill: mk('gold-light') }} />
  </g>;
}

/** Paper fibre: a fixed-seed noise tile, printed faintly over every page. No
 * colour literal: the noise is tinted by matrix numbers. */
export const PAPER_GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="11" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .32  0 0 0 0 .25  0 0 0 0 .16  1.1 0 0 0 -.52"/></filter><rect width="180" height="180" filter="url(#n)"/></svg>')}")`;
/** Long fibres: a stretched noise for the cover cloth and the wheel pocket. */
export const CLOTH_GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9 .12" numOctaves="2" seed="4" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  .9 0 0 0 -.5"/></filter><rect width="160" height="160" filter="url(#n)"/></svg>')}")`;
