/** The whole bowl once every piece is home: the dark cracks waiting, the gold
 * as it flows, the light that runs with it, the bead under the finger, and
 * the slow turn at the end. The play view drives the moving parts (the flow,
 * its bright head, the sparks) straight on these elements from one frame
 * loop; this component only draws them and hands over the handles. */
import { memo, type MutableRefObject } from 'react';
import { samplePolyline, type BowlGlaze, type BowlPattern, type BowlSeam, type Point } from './mendBowlRules';
import { BOWL_CENTRE, BOWL_PATTERNS, BOWL_R, OUTLINE_D, polyD } from './mendBowlPatterns';
import { BowlBody, GoldDefs, GoldRibbon, ribbonD } from './BowlArt';

export const SPARK_COUNT = 30;
export interface GoldHandles {
  flow: (SVGPathElement | null)[]; comet: (SVGPathElement | null)[]; head: (SVGGElement | null)[];
  sparks: (SVGCircleElement | null)[]; bead: SVGGElement | null; trail: SVGPathElement | null;
}
export const emptyHandles = (): GoldHandles => ({ flow: [], comet: [], head: [], sparks: [], bead: null, trail: null });
export const seamMiddle = (seam: BowlSeam): Point => { const s = samplePolyline(seam.points); return s[Math.floor(s.length / 2)]; };
const star = (p: Point, r: number) => `M${p.x} ${p.y - r}L${p.x + r * 0.23} ${p.y - r * 0.23}L${p.x + r} ${p.y}L${p.x + r * 0.23} ${p.y + r * 0.23}L${p.x} ${p.y + r}L${p.x - r * 0.23} ${p.y + r * 0.23}L${p.x - r} ${p.y}L${p.x - r * 0.23} ${p.y - r * 0.23}Z`;

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
  lit: number; admire: boolean; lamp: boolean;
  /** Counts up on every beat the bowl answers (a seam closing, a fingertip ring). */
  pulse: number;
  handles: MutableRefObject<GoldHandles>;
}
export const MendedLayer = memo(function MendedLayer({ uid, viewBox, glaze, pattern, order, dash, flows, sealed, lit, admire, lamp, pulse, handles }: Props) {
  const seams = BOWL_PATTERNS[pattern].seams, h = handles.current;
  const directed = (i: number) => polyD(flows[i] === 1 ? [...seams[i].points].reverse() : seams[i].points);
  return <svg viewBox={viewBox} className="mb-layer mb-mended" aria-hidden="true" focusable="false" data-admire={admire} data-lamp={lamp}>
    <defs>
      <GoldDefs uid={uid} />
      <clipPath id={`${uid}-clip`}><path d={OUTLINE_D} /></clipPath>
      <radialGradient id={`${uid}-shade`} gradientUnits="userSpaceOnUse" cx={BOWL_CENTRE.x + 9} cy={BOWL_CENTRE.y + 11} r={BOWL_R + 16}>
        <stop offset="0" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.5 }} /><stop offset=".8" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.42 }} /><stop offset=".92" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.16 }} /><stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
      </radialGradient>
      <radialGradient id={`${uid}-hot`}><stop offset="0" style={{ stopColor: 'var(--mk-white)' }} /><stop offset=".45" style={{ stopColor: 'var(--mk-butter)' }} /><stop offset="1" style={{ stopColor: 'var(--mk-gold-light)', stopOpacity: 0 }} /></radialGradient>
      {seams.map((seam, i) => <mask key={i} id={`${uid}-m${i}`} maskUnits="userSpaceOnUse" x={BOWL_CENTRE.x - BOWL_R - 8} y={BOWL_CENTRE.y - BOWL_R - 8} width={BOWL_R * 2 + 16} height={BOWL_R * 2 + 16}>
        {/* Butt ends: a round cap would paint a dot where a dash has no length yet. */}
        {dash[i] && dash[i] !== '0 1' && <path d={polyD(seam.points)} pathLength={1} fill="none" strokeWidth="12" strokeLinejoin="round" strokeDasharray={dash[i]} style={{ stroke: 'var(--mk-white)' }} />}
        {flows[i] !== undefined && <path ref={el => { h.flow[i] = el; }} d={directed(i)} pathLength={1} fill="none" strokeWidth="12" strokeLinejoin="round" strokeDasharray="1 2" strokeDashoffset={sealed.includes(i) ? 0 : 1} style={{ stroke: 'var(--mk-white)' }} />}
      </mask>)}
    </defs>
    <circle className="mb-bowl-shade" cx={BOWL_CENTRE.x + 9} cy={BOWL_CENTRE.y + 11} r={BOWL_R + 16} fill={`url(#${uid}-shade)`} />
    <g className="mb-lift" data-pulse={pulse > 0 ? (pulse % 2 ? 'a' : 'b') : undefined}>
      <BowlBody glaze={glaze} uid={`${uid}-b`} shadow={false} />
      <g className="mb-seams" clipPath={`url(#${uid}-clip)`}>
        {seams.map((seam, i) => <g key={i} className="mb-crack" data-gold={order.includes(i)}>
          <path d={polyD(seam.points)} fill="none" strokeWidth="1.6" strokeLinejoin="round" style={{ stroke: 'color-mix(in srgb, var(--mk-umber) 70%, var(--mk-shadow))' }} />
          <path d={polyD(seam.points)} fill="none" strokeWidth=".7" strokeLinejoin="round" transform="translate(.8 .7)" opacity=".7" style={{ stroke: 'var(--mk-clay-pale)' }} />
        </g>)}
        {seams.map((seam, i) => <g key={i} mask={`url(#${uid}-m${i})`}>
          <GoldRibbon points={seam.points} seed={i + pattern * 7} uid={uid} />
          {/* Fresh gold is wet and bright; it settles to lacquer once the seam is closed. */}
          {flows[i] !== undefined && <path className="mb-wet" data-cool={sealed.includes(i)} d={ribbonD(seam.points, i + pattern * 7)} />}
        </g>)}
        {/* The light that runs along a seam: with the gold as it flows, and once more at the end. */}
        {seams.map((_seam, i) => flows[i] === undefined ? null : <path key={i} ref={el => { h.comet[i] = el; }} className="mb-comet" data-lit={admire && order.indexOf(i) < lit} d={directed(i)} pathLength={1} fill="none" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.16 2" />)}
        {admire && <g className="mb-glints">{order.map((s, k) => k < lit ? <path key={s} className="mb-glint" d={star(seamMiddle(seams[s]), 8)} /> : null)}</g>}
      </g>
    </g>
    {seams.map((_seam, i) => <g key={i} ref={el => { h.head[i] = el; }} className="mb-head">
      <circle r="11" fill={`url(#${uid}-hot)`} opacity=".7" /><circle r="3.4" style={{ fill: 'var(--mk-white)' }} />
    </g>)}
    <path ref={el => { h.trail = el; }} className="mb-trail" fill="none" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    <g ref={el => { h.bead = el; }} className="mb-bead">
      <circle r="13" fill={`url(#${uid}-hot)`} opacity=".6" /><circle r="4.6" style={{ fill: 'var(--mk-gold-light)' }} /><circle r="2" cx="-1.2" cy="-1.4" style={{ fill: 'var(--mk-white)' }} />
    </g>
    <g className="mb-sparks">{Array.from({ length: SPARK_COUNT }, (_, i) => <circle key={i} ref={el => { h.sparks[i] = el; }} r="1.6" />)}</g>
  </svg>;
});
