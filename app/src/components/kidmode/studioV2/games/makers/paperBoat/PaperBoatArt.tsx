import type { CSSProperties } from 'react';

/** The Paper Boat's own drawn objects: the folded paper boat (flat, for the
 * book's cover and the Studio tile; in the book it is folded in real 3D, see
 * PaperBoatScenes), the paper lanterns, the paper waves, the wooden wheel and
 * the hand that shows a first move, and the printed water's ripple textures.
 * The scenery is cut from kit pictures (paperBoatKit.ts). Everything here is
 * lit like the reading room: daylight from the upper left, soft shade to the
 * lower right. Colour only through the makers' palette (--mk-*) and the
 * Studio tokens. */

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

/** A paper lantern: a pleated paper drum in a thin copper frame. On its crook
 * it hangs from a folded paper arm that stands in the water, over a channel;
 * afloat it sits on the water on a little paper raft. `lit` 0 … 1 warms it.
 * Drawn in a 60 × 80 box (on its crook) or a 30 × 36 box (afloat). */
export function LanternArt({ uid, mode, lit, swing = 0 }: { uid: string; mode: 'onCrook' | 'afloat'; lit: number; swing?: number }) {
  const g = (name: string) => `url(#${uid}-${name})`;
  const warm = Math.round(Math.max(0, Math.min(1, lit)) * 100);
  const paper = `color-mix(in srgb, ${mk('sun')} ${warm}%, ${mix('paper', 80, 'amber')})`;
  const deep = `color-mix(in srgb, ${mk('amber')} ${warm}%, ${mix('paper-shade', 70, 'rust')})`;
  const drum = <g>
    <rect x="-9.5" y="0" width="19" height="24" rx="5.5" fill={g('drum')} />
    {[-5.4, -1.8, 1.8, 5.4].map(x => <path key={x} d={`M${x} 1.6 V22.4`} style={{ fill: 'none', stroke: fade('rust', 34), strokeWidth: 0.8 }} />)}
    <ellipse cx="-2" cy="11" rx="3.4" ry="7" style={{ fill: fade('white', 20 + warm * 0.5) }} />
    <rect x="-7" y="-2.6" width="14" height="4" rx="1.6" style={{ fill: mix('rust', 70, 'wood-dark') }} />
    <rect x="-7" y="22.6" width="14" height="3.6" rx="1.6" style={{ fill: mix('rust', 70, 'wood-dark') }} />
    <rect x="-6" y="-2.2" width="12" height="1.1" rx=".5" style={{ fill: fade('white', 46) }} />
  </g>;
  const defs = <defs>
    <linearGradient id={`${uid}-drum`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: paper }} /><stop offset="1" style={{ stopColor: deep }} /></linearGradient>
    <linearGradient id={`${uid}-arm`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={{ stopColor: mk('white') }} /><stop offset="1" style={{ stopColor: mk('paper-shade') }} /></linearGradient>
  </defs>;
  if (mode === 'afloat') return <svg viewBox="0 0 30 36" width="100%" height="100%" aria-hidden="true" focusable="false" style={{ display: 'block', overflow: 'visible' }}>
    {defs}
    <ellipse cx="15" cy="33" rx="13" ry="3" style={{ fill: mix('white', 80, 'paper-shade') }} />
    <ellipse cx="15" cy="32.4" rx="13" ry="2.6" style={{ fill: 'none', stroke: fade('white', 80), strokeWidth: 0.8 }} />
    <g transform="translate(15 6)">{drum}</g>
  </svg>;
  return <svg viewBox="0 0 60 80" width="100%" height="100%" aria-hidden="true" focusable="false" style={{ display: 'block', overflow: 'visible' }}>
    {defs}
    {/* the paper crook: a folded strip that stands on its tab and bends over the channel */}
    <path d="M47 80 L47 26 C 47 10 38 5 28 6 L28 10 C 36 9.4 42.4 13 42.4 26 L42.4 80 Z" fill={g('arm')} />
    <path d="M47 80 L47 26 C 47 10 38 5 28 6" style={{ fill: 'none', stroke: fade('shadow', 30), strokeWidth: 0.8 }} />
    <rect x="38" y="76" width="14" height="4" rx="1" style={{ fill: mk('white') }} />
    <g transform={`rotate(${swing.toFixed(2)} 28 8)`}>
      <path d="M28 8 V20" style={{ fill: 'none', stroke: mix('rust', 60, 'wood-dark'), strokeWidth: 1.1 }} />
      <g transform="translate(28 22)">{drum}</g>
      <path d="M28 48 V54 M26.6 54 h2.8" style={{ fill: 'none', stroke: mix('poppy', 60, 'rust'), strokeWidth: 1.2, strokeLinecap: 'round' }} />
    </g>
  </svg>;
}

/** One row of paper waves across a page: scallops cut from blue-grey paper,
 * a white cut edge along the crests. `phase` slides the scallops so the rows
 * do not line up. 250 wide; the box sets the height. */
export function WaveArt({ uid, shade, phase = 0 }: { uid: string; shade: number; phase?: number }) {
  const step = 31.25, start = -step + (phase % 1) * step;
  let d = `M${start} 26`;
  for (let x = start; x < 260; x += step) d += ` Q ${x + step / 2} ${-6} ${x + step} 26`;
  const tone = Math.round(Math.max(0, Math.min(1, shade)) * 100);
  const top = `color-mix(in srgb, ${mk('sky-pale')} ${tone}%, ${mix('storm-grey', 50, 'sea')})`, low = `color-mix(in srgb, ${mk('sea')} ${tone}%, ${mix('slate', 60, 'teal-deep')})`;
  return <svg viewBox="0 0 250 40" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true" focusable="false" style={{ display: 'block', overflow: 'hidden' }}>
    <defs><linearGradient id={`${uid}-w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: top }} /><stop offset="1" style={{ stopColor: low }} /></linearGradient></defs>
    <path d={`${d} V40 H${start} Z`} fill={`url(#${uid}-w)`} />
    <path d={d} style={{ fill: 'none', stroke: fade('white', 88), strokeWidth: 1.6 }} />
    <path d={d} transform="translate(0 5)" style={{ fill: 'none', stroke: fade('white', 26), strokeWidth: 1 }} />
  </svg>;
}

/** A paper rainbow, for the one who taps every cloud. 200 × 100. */
export function RainbowArt() {
  const bands = ['poppy', 'amber', 'sun', 'spring', 'sky', 'violet'];
  return <svg viewBox="0 0 200 100" width="100%" height="100%" aria-hidden="true" focusable="false" style={{ display: 'block', overflow: 'visible' }}>
    {bands.map((tone, i) => <path key={tone} d={`M${8 + i * 7} 100 A ${92 - i * 7} ${92 - i * 7} 0 0 1 ${192 - i * 7} 100`} style={{ fill: 'none', stroke: mix(tone, 78, 'white'), strokeWidth: 7.4 }} />)}
    <path d="M4.4 100 A 95.6 95.6 0 0 1 195.6 100" style={{ fill: 'none', stroke: mk('white'), strokeWidth: 1.4 }} />
  </svg>;
}

/** The printed water's light and shade: fixed-seed noise stretched along the
 * current, as bright streaks and as deep ones. Tinted by matrix numbers. */
const ripple = (seed: number, tint: string, gain: string) => `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="180"><filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".011 .085" numOctaves="2" seed="${seed}" stitchTiles="stitch"/><feColorMatrix values="${tint} ${gain}"/></filter><rect width="360" height="180" filter="url(#n)"/></svg>`)}")`;
export const WATER_LIGHT = ripple(4, '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1', '3.4 0 0 0 -1.9');
export const WATER_DEEP = ripple(9, '0 0 0 0 .03  0 0 0 0 .16  0 0 0 0 .26', '-3 0 0 0 1.22');
