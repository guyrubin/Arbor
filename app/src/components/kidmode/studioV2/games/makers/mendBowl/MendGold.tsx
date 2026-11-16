/** The whole bowl once every piece is home: the dark cracks waiting, the gold
 * as it flows, the light that runs with it and the sheen that slides across
 * it as the light moves, the bead under the finger, and at the end the tea
 * rising in the well with its steam. The play view drives the moving parts
 * (the flow and its bright head) straight on these elements from one frame
 * loop; this component only draws them and hands over the handles. */
import { memo, type MutableRefObject } from 'react';
import { samplePolyline, type BowlGlaze, type BowlPattern, type BowlSeam, type Point } from './mendBowlRules';
import { BOWL_CENTRE, BOWL_PATTERNS, BOWL_R, OUTLINE_D, polyD } from './mendBowlPatterns';
import { BowlBody, GoldDefs, GoldRibbon, ribbonD } from './BowlArt';

export interface GoldHandles {
  flow: (SVGPathElement | null)[]; comet: (SVGPathElement | null)[]; head: (SVGGElement | null)[];
  bead: SVGGElement | null; trail: SVGPathElement | null;
}
export const emptyHandles = (): GoldHandles => ({ flow: [], comet: [], head: [], bead: null, trail: null });
export const seamMiddle = (seam: BowlSeam): Point => { const s = samplePolyline(seam.points); return s[Math.floor(s.length / 2)]; };
const star = (p: Point, r: number) => `M${p.x} ${p.y - r}L${p.x + r * 0.23} ${p.y - r * 0.23}L${p.x + r} ${p.y}L${p.x + r * 0.23} ${p.y + r * 0.23}L${p.x} ${p.y + r}L${p.x - r * 0.23} ${p.y + r * 0.23}L${p.x - r} ${p.y}L${p.x - r * 0.23} ${p.y - r * 0.23}Z`;
/** How far up the wall the tea stands (a share of the rim's radius). */
export const TEA_R = BOWL_R * 0.71;
const tone = (name: string) => `var(--mk-${name})`;

interface Props {
  uid: string; viewBox: string; glaze: BowlGlaze; pattern: BowlPattern;
  /** Seams in the order their gold started. */
  order: readonly number[];
  /** Painted-so-far dashes per seam (pathLength 1). */
  dash: readonly string[];
  /** Which end each seam's gold runs from. */
  flows: Readonly<Record<number, 0 | 1>>;
  /** Seams whose gold has arrived. */
  sealed: readonly number[];
  /** How many seams the closing light has run along. */
  lit: number; finale: boolean; lamp: boolean;
  /** Counts up on every beat the bowl answers (a seam closing, a fingertip ring). */
  pulse: number;
  /** The tea: not yet, pouring, or standing; and which pot it came from (palette token names). */
  tea: 'none' | 'pour' | 'full'; teaLight: string; teaDeep: string;
  /** A petal from the knit bloom floats in it (the secret). */
  petal: boolean;
  handles: MutableRefObject<GoldHandles>;
}
export const MendedLayer = memo(function MendedLayer({ uid, viewBox, glaze, pattern, order, dash, flows, sealed, lit, finale, lamp, pulse, tea, teaLight, teaDeep, petal, handles }: Props) {
  const seams = BOWL_PATTERNS[pattern].seams, h = handles.current, C = BOWL_CENTRE;
  const directed = (i: number) => polyD(flows[i] === 1 ? [...seams[i].points].reverse() : seams[i].points);
  return <svg viewBox={viewBox} className="mb-layer mb-mended" aria-hidden="true" focusable="false" data-finale={finale} data-lamp={lamp} data-tea={tea}>
    <defs>
      <GoldDefs uid={uid} />
      <clipPath id={`${uid}-clip`}><path d={OUTLINE_D} /></clipPath>
      <radialGradient id={`${uid}-shade`} gradientUnits="userSpaceOnUse" cx={C.x + 9} cy={C.y + 11} r={BOWL_R + 16}>
        <stop offset="0" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.5 }} /><stop offset=".8" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.42 }} /><stop offset=".92" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.16 }} /><stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
      </radialGradient>
      <radialGradient id={`${uid}-hot`}><stop offset="0" style={{ stopColor: 'var(--mk-white)' }} /><stop offset=".45" style={{ stopColor: 'var(--mk-butter)' }} /><stop offset="1" style={{ stopColor: 'var(--mk-gold-light)', stopOpacity: 0 }} /></radialGradient>
      {/* The sheen: one band of window light, lying across the bowl like the highlight in the glaze. */}
      <linearGradient id={`${uid}-sheen`} gradientUnits="userSpaceOnUse" x1={C.x - 34} y1={C.y - 34} x2={C.x + 34} y2={C.y + 34}>
        <stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} /><stop offset=".5" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.95 }} /><stop offset="1" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} />
      </linearGradient>
      {/* Tea: deep in the well, a little clearer where it thins against the wall; the window lies on its surface. */}
      <radialGradient id={`${uid}-tea`} gradientUnits="userSpaceOnUse" cx={C.x + 3} cy={C.y + 4} r={TEA_R}>
        <stop offset="0" style={{ stopColor: tone(teaDeep), stopOpacity: 0.96 }} /><stop offset=".5" style={{ stopColor: `color-mix(in srgb, ${tone(teaDeep)} 72%, ${tone(teaLight)})`, stopOpacity: 0.94 }} /><stop offset=".9" style={{ stopColor: tone(teaLight), stopOpacity: 0.88 }} /><stop offset="1" style={{ stopColor: tone(teaLight), stopOpacity: 0.74 }} />
      </radialGradient>
      {/* The wall's shade lies on the near-left of the surface; the far-right takes the daylight. */}
      <linearGradient id={`${uid}-teaLight`} gradientUnits="userSpaceOnUse" x1={C.x - TEA_R * 0.75} y1={C.y - TEA_R * 0.75} x2={C.x + TEA_R * 0.75} y2={C.y + TEA_R * 0.75}>
        <stop offset="0" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.42 }} /><stop offset=".42" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.06 }} /><stop offset=".7" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.04 }} /><stop offset="1" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.3 }} />
      </linearGradient>
      <filter id={`${uid}-wet`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation=".7" /></filter>
      <filter id={`${uid}-steam`} filterUnits="userSpaceOnUse" x={C.x - BOWL_R * 1.6} y={C.y - BOWL_R * 1.8} width={BOWL_R * 3.2} height={BOWL_R * 3.2}><feGaussianBlur stdDeviation="7" /></filter>
      {/* The lamp's light, gathered round the bowl for the finale. */}
      <radialGradient id={`${uid}-halo`} gradientUnits="userSpaceOnUse" cx={C.x} cy={C.y} r={BOWL_R * 1.9}>
        <stop offset=".45" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.7 }} /><stop offset=".7" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0.3 }} /><stop offset="1" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0 }} />
      </radialGradient>
      <mask id={`${uid}-all`} maskUnits="userSpaceOnUse" x={C.x - BOWL_R - 8} y={C.y - BOWL_R - 8} width={BOWL_R * 2 + 16} height={BOWL_R * 2 + 16}>
        {sealed.map(i => <path key={i} d={ribbonD(seams[i].points, i + pattern * 7)} style={{ fill: 'var(--mk-white)' }} />)}
      </mask>
      {seams.map((seam, i) => <mask key={i} id={`${uid}-m${i}`} maskUnits="userSpaceOnUse" x={C.x - BOWL_R - 8} y={C.y - BOWL_R - 8} width={BOWL_R * 2 + 16} height={BOWL_R * 2 + 16}>
        {/* Butt ends: a round cap would paint a dot where a dash has no length yet. */}
        {dash[i] && dash[i] !== '0 1' && <path d={polyD(seam.points)} pathLength={1} fill="none" strokeWidth="12" strokeLinejoin="round" strokeDasharray={dash[i]} style={{ stroke: 'var(--mk-white)' }} />}
        {flows[i] !== undefined && <path ref={el => { h.flow[i] = el; }} d={directed(i)} pathLength={1} fill="none" strokeWidth="12" strokeLinejoin="round" strokeDasharray="1 2" strokeDashoffset={sealed.includes(i) ? 0 : 1} style={{ stroke: 'var(--mk-white)' }} />}
      </mask>)}
    </defs>
    {finale && <circle className="mb-halo" cx={C.x} cy={C.y} r={BOWL_R * 1.9} fill={`url(#${uid}-halo)`} />}
    <circle className="mb-bowl-shade" cx={C.x + 9} cy={C.y + 11} r={BOWL_R + 16} fill={`url(#${uid}-shade)`} />
    <g className="mb-lift" data-pulse={pulse > 0 ? (pulse % 2 ? 'a' : 'b') : undefined}>
      <BowlBody glaze={glaze} uid={`${uid}-b`} shadow={false} />
      <g className="mb-seams" clipPath={`url(#${uid}-clip)`}>
        {seams.map((seam, i) => <g key={i} className="mb-crack" data-gold={order.includes(i)}>
          <path d={polyD(seam.points)} fill="none" strokeWidth="1.7" strokeLinejoin="round" style={{ stroke: 'color-mix(in srgb, var(--mk-umber) 70%, var(--mk-shadow))' }} />
          <path d={polyD(seam.points)} fill="none" strokeWidth=".7" strokeLinejoin="round" transform="translate(.8 .7)" opacity=".7" style={{ stroke: 'var(--mk-clay-pale)' }} />
        </g>)}
        {seams.map((seam, i) => <g key={i} mask={`url(#${uid}-m${i})`}>
          <GoldRibbon points={seam.points} seed={i + pattern * 7} uid={uid} />
          {/* Fresh gold is wet and bright; it settles to lacquer once the seam is closed. */}
          {flows[i] !== undefined && <path className="mb-wet" data-cool={sealed.includes(i)} d={ribbonD(seam.points, i + pattern * 7)} />}
        </g>)}
        {/* Gold catches the light: the band slides with the pointer (or the tilt of the device) and drifts by itself. */}
        {sealed.length > 0 && <g mask={`url(#${uid}-all)`}><g className="mb-sheen"><rect className="mb-sheen__band" x={C.x - BOWL_R * 2.4} y={C.y - BOWL_R * 2.4} width={BOWL_R * 4.8} height={BOWL_R * 4.8} fill={`url(#${uid}-sheen)`} /></g></g>}
        {/* The light that runs along a seam: with the gold as it flows, and once more at the end. */}
        {seams.map((_seam, i) => flows[i] === undefined ? null : <path key={i} ref={el => { h.comet[i] = el; }} className="mb-comet" data-lit={finale && order.indexOf(i) < lit} d={directed(i)} pathLength={1} fill="none" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.16 2" />)}
        {/* Tea: it rises from the well; the seams stay in sight above it and glimmer through it. */}
        {tea !== 'none' && <g className="mb-tea" data-tea={tea}>
          <g className="mb-tea__level">
            <circle cx={C.x} cy={C.y} r={TEA_R} fill={`url(#${uid}-tea)`} />
            <circle cx={C.x} cy={C.y} r={TEA_R} fill={`url(#${uid}-teaLight)`} />
            {/* The meniscus: the tea climbs the glaze a hair and catches a line of light. */}
            <circle className="mb-tea__edge" cx={C.x} cy={C.y} r={TEA_R - 2.4} />
            <circle className="mb-tea__rim" cx={C.x} cy={C.y} r={TEA_R - 0.6} />
            <g className="mb-tea__window" filter={`url(#${uid}-wet)`}><g transform={`translate(${C.x + 27} ${C.y + 36}) rotate(38)`}>
              <rect x="-8.4" y="-6.2" width="7.6" height="5.4" rx="1.2" /><rect x=".8" y="-6.2" width="7.6" height="5.4" rx="1.2" /><rect x="-8.4" y=".8" width="7.6" height="5.4" rx="1.2" /><rect x=".8" y=".8" width="7.6" height="5.4" rx="1.2" />
            </g></g>
            {[0, 1, 2].map(k => <circle key={k} className="mb-tea__ripple" data-k={k} cx={C.x} cy={C.y} r={TEA_R * 0.5} />)}
            {petal && <g className="mb-tea__petal" transform={`translate(${C.x - 22} ${C.y + 14})`}><path d="M0 -9C7 -6 8 4 0 10C-8 4 -7 -6 0 -9Z" /><path className="mb-tea__petal-vein" d="M0 -7V8" /></g>}
          </g>
        </g>}
        {finale && <g className="mb-glints">{order.map((s, k) => k < lit ? <path key={s} className="mb-glint" d={star(seamMiddle(seams[s]), 8)} /> : null)}</g>}
      </g>
      {tea === 'full' && <g className="mb-steam" filter={`url(#${uid}-steam)`}>
        {[0, 1, 2].map(k => <ellipse key={k} className="mb-steam__wisp" data-k={k} cx={C.x - 14 + k * 16} cy={C.y - 6 + k * 7} rx="15" ry="22" />)}
      </g>}
    </g>
    {seams.map((_seam, i) => <g key={i} ref={el => { h.head[i] = el; }} className="mb-head">
      <circle r="11" fill={`url(#${uid}-hot)`} opacity=".7" /><circle r="3.4" style={{ fill: 'var(--mk-white)' }} />
    </g>)}
    <path ref={el => { h.trail = el; }} className="mb-trail" fill="none" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    <g ref={el => { h.bead = el; }} className="mb-bead">
      <circle r="13" fill={`url(#${uid}-hot)`} opacity=".6" /><circle r="4.6" style={{ fill: 'var(--mk-gold-light)' }} /><circle r="2" cx="-1.2" cy="-1.4" style={{ fill: 'var(--mk-white)' }} />
    </g>
  </svg>;
});
