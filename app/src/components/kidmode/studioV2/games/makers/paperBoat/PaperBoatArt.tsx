import type { CSSProperties } from 'react';

/** The Paper Boat's own drawn objects: the folded paper boat, the wooden wheel
 * and the hand that shows a first move. Everything else in the book is cut
 * from kit pictures (paperBoatKit.ts). These three are lit like the reading
 * room: daylight from the upper left, soft shade to the lower right. Colour
 * only through the makers' palette (--mk-*) and the Studio tokens. */

export const mk = (name: string) => `var(--mk-${name})`;
/** `a` mixed with `b` (`pct` of `a`). */
export const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${mk(a)} ${Math.round(pct)}%, ${mk(b)})`;
/** `a` at `pct` opacity. */
export const fade = (a: string, pct: number) => `color-mix(in srgb, ${mk(a)} ${Math.round(pct)}%, transparent)`;

function Grad({ id, stops, x2 = 0, y2 = 1 }: { id: string; stops: readonly (readonly [number, string])[]; x2?: number; y2?: number }) {
  return <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>{stops.map(([at, colour]) => <stop key={at} offset={at} style={{ stopColor: colour }} />)}</linearGradient>;
}

/** The paper boat, side on, bow to the right (the book mirrors it in Hebrew).
 * A classic folded boat in crisp white paper: a trapezoid hull with its inner
 * fold showing, a centre sail creased down the middle, one thin teal stripe.
 * Each facet is a soft gradient, so it reads as folded paper in daylight and
 * is the same boat on every spread. Drawn in an 80 × 60 box. */
export function BoatArt({ uid, stripe = 'teal' }: { uid: string; stripe?: string }) {
  const g = (name: string) => `url(#${uid}-${name})`;
  const white = mk('white'), cool = mix('white', 70, 'sky-pale'), shade = mix('snow', 62, 'snow-shade'), deep = mix('snow-shade', 74, 'sky');
  return <g>
    <defs>
      <Grad id={`${uid}-lit`} stops={[[0, white], [1, mix('white', 86, 'sky-pale')]]} x2={1} y2={1} />
      <Grad id={`${uid}-turn`} stops={[[0, cool], [1, mix('snow-shade', 60, 'sky-pale')]]} x2={1} y2={1} />
      <Grad id={`${uid}-hull`} stops={[[0, white], [0.55, mix('white', 80, 'snow-shade')], [1, shade]]} />
      <Grad id={`${uid}-keel`} stops={[[0, shade], [1, deep]]} />
    </defs>
    {/* sail: lit left half, turned right half, the crease between */}
    <path d="M40 3 L23.5 35 L40 35 Z" fill={g('lit')} />
    <path d="M40 3 L56.5 35 L40 35 Z" fill={g('turn')} />
    <path d="M40 3 L41.3 35 L40 35 Z" style={{ fill: fade('snow-shade', 80) }} />
    <path d="M40 3 L23.5 35" style={{ fill: 'none', stroke: white, strokeWidth: 0.9 }} />
    {/* hull */}
    <path d="M3 34 L77 34 L63 53 L17 53 Z" fill={g('hull')} />
    <path d="M10.4 44 L69.6 44 L63 53 L17 53 Z" fill={g('keel')} />
    <path d="M7 39.4 L73 39.4 L71.6 41.4 L8.4 41.4 Z" style={{ fill: mix(stripe, 82, 'white') }} />
    {/* the inner fold of the hull, and the bow turning away from the light */}
    <path d="M24 34 L40 47 L56 34 Z" fill={g('turn')} />
    <path d="M40 47 L56 34 L58.6 34 Z" style={{ fill: deep }} />
    <path d="M77 34 L63 53 L60.6 53 L71.4 34 Z" style={{ fill: deep }} />
    <path d="M3 34 L77 34" style={{ fill: 'none', stroke: white, strokeWidth: 1.1 }} />
  </g>;
}

/** The boat as an SVG box. */
export function Boat({ uid, stripe, className, style }: { uid: string; stripe?: string; className?: string; style?: CSSProperties }) {
  return <svg viewBox="0 0 80 60" className={className} style={style} aria-hidden="true" focusable="false"><BoatArt uid={uid} stripe={stripe} /></svg>;
}

/** The wheel: a toy ship's wheel in pale wood, turned handles past the rim, a
 * teal felt hub. The top handle is wrapped in coral knit, so the way the
 * wheel is turned can be read at a glance. 200 × 200. */
export function WheelDisc({ uid }: { uid: string }) {
  const g = (name: string) => `url(#${uid}-${name})`;
  const handles = Array.from({ length: 8 }, (_, i) => i * 45);
  return <g>
    <defs>
      <Grad id={`${uid}-wood`} stops={[[0, mix('wood-light', 78, 'white')], [0.5, mk('wood-light')], [1, mk('wood')]]} x2={1} y2={1} />
      <Grad id={`${uid}-rim`} stops={[[0, mk('wood-light')], [1, mix('wood', 78, 'wood-dark')]]} x2={1} y2={1} />
      <Grad id={`${uid}-knit`} stops={[[0, mix('rose', 60, 'clay-light')], [1, mix('poppy', 62, 'clay')]]} x2={1} y2={1} />
      <radialGradient id={`${uid}-felt`} cx=".38" cy=".34" r=".7"><stop offset="0" style={{ stopColor: mix('sea', 70, 'teal') }} /><stop offset="1" style={{ stopColor: mk('teal-deep') }} /></radialGradient>
    </defs>
    {handles.map(a => <g key={a} transform={`rotate(${a} 100 100)`}>
      <rect x="93.5" y="7.5" width="14" height="34" rx="7" style={{ fill: fade('shadow', 22) }} />
      <rect x="93" y="5" width="14" height="34" rx="7" fill={g('wood')} />
      <rect x="95.4" y="8" width="3" height="24" rx="1.5" style={{ fill: fade('white', 55) }} />
    </g>)}
    <circle cx="101" cy="102.5" r="66" style={{ fill: 'none', stroke: fade('shadow', 22), strokeWidth: 15 }} />
    <circle cx="100" cy="100" r="66" style={{ fill: 'none', strokeWidth: 15 }} stroke={g('rim')} />
    <circle cx="100" cy="100" r="72.4" style={{ fill: 'none', stroke: fade('white', 60), strokeWidth: 1.4 }} />
    <circle cx="100" cy="100" r="59" style={{ fill: 'none', stroke: fade('wood-dark', 40), strokeWidth: 1.2 }} />
    {handles.map(a => <g key={`s${a}`} transform={`rotate(${a} 100 100)`}>
      <rect x="96.2" y="40" width="8" height="46" rx="3.4" fill={g('wood')} />
      <rect x="97.4" y="42" width="1.8" height="40" rx=".9" style={{ fill: fade('white', 50) }} />
    </g>)}
    <circle cx="101" cy="102" r="25" style={{ fill: fade('shadow', 24) }} />
    <circle cx="100" cy="100" r="24" fill={g('rim')} />
    <circle cx="100" cy="100" r="17" fill={g('felt')} />
    <circle cx="100" cy="100" r="17" style={{ fill: 'none', stroke: fade('white', 34), strokeWidth: 1.2, strokeDasharray: '2 3' }} />
    <circle cx="100" cy="100" r="4.6" style={{ fill: mix('wood-light', 80, 'white') }} />
    {/* the top handle, in coral knit */}
    <rect x="93" y="5" width="14" height="34" rx="7" fill={g('knit')} />
    {[11, 17, 23, 29].map(y => <path key={y} d={`M94 ${y} q 6 3 12 0`} style={{ fill: 'none', stroke: fade('white', 45), strokeWidth: 1.2 }} />)}
  </g>;
}

/** The hand that shows the first move: a soft white mitt with one finger out,
 * its tip at (0, 0) of the box it is placed in. Chrome, so Studio tokens. */
export function HintHand({ press }: { press: number }) {
  return <svg className="pb-hand__art" viewBox="-16 -8 56 70" width="56" height="70" aria-hidden="true" focusable="false">
    <circle cx="0" cy="0" r={5 + 9 * press} style={{ fill: 'none', stroke: 'var(--studio-signal)', strokeWidth: 3, opacity: 0.25 + 0.75 * press }} />
    <g transform={`translate(0 ${2 - 2 * press}) rotate(-14)`}>
      <path d="M-5 0 C -5 -5 5 -5 5 0 L 6 22 C 12 20 22 24 22 33 L 21 46 C 20 55 12 58 5 58 L -1 58 C -8 58 -13 53 -14 46 L -16 34 C -17 28 -12 26 -8 29 L -6 31 Z" style={{ fill: 'var(--studio-surface)', stroke: 'var(--studio-graphite)', strokeWidth: 2.2, strokeLinejoin: 'round' }} />
      <path d="M6 30 L6 36 M12 30 L12 37" style={{ fill: 'none', stroke: 'var(--studio-line)', strokeWidth: 2, strokeLinecap: 'round' }} />
    </g>
  </svg>;
}

/** Paper fibre: a fixed-seed noise tile, printed faintly over every page. No
 * colour literal: the noise is tinted by matrix numbers. */
export const PAPER_GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="11" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .32  0 0 0 0 .25  0 0 0 0 .16  1.1 0 0 0 -.52"/></filter><rect width="180" height="180" filter="url(#n)"/></svg>')}")`;
