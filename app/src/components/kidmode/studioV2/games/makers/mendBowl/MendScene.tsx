/** The workshop table Mend the Bowl is played on: the kit's round table from
 * above (a shipped picture) with shipped kit props standing on it, the four
 * dishes of glaze, the dish of gold, the faint place where the bowl goes, and
 * the small pieces of interface that sit over the scene (the hint hand and the
 * progress marks). Scene art keeps its own left and right in both languages. */
import { memo, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { BOWL_GLAZES, type BowlGlaze } from './mendBowlRules';
import { BOWL_CENTRE, BOWL_R, OUTLINE_D } from './mendBowlPatterns';
import { GLAZE_SPOTS, TABLE_SPOTS, type TableSpot } from './mendBowlPlay';
import { KIT_BLOOM, KIT_FERN, KIT_GLAZE, KIT_GOLD, KIT_LAMP, type KitPicture } from './mendKit';
import { KitTable } from './BowlArt';

/** A kit picture standing at a spot on the table (stage units). */
function Picture({ spot, picture, className }: { spot: TableSpot; picture: KitPicture; className?: string }) {
  const height = spot.size * picture.h / picture.w;
  return <image className={className} href={picture.src} x={spot.x - spot.size / 2} y={spot.y - height / 2} width={spot.size} height={height} />;
}
/** Alternates between two identical animations so a second poke restarts it. */
const poke = (count: number) => count > 0 ? (count % 2 ? 'a' : 'b') : undefined;
const origin = (spot: TableSpot): CSSProperties => ({ transformOrigin: `${spot.x}px ${spot.y}px` });

export interface TablePokes { fern: number; gold: number; lamp: number; bloom: number }
interface GroundProps { viewBox: string; uid: string; glaze: BowlGlaze; dishes: boolean; tools: boolean; ghost: boolean; slotD: string | null; lamp: boolean; bloom: boolean; pokes: TablePokes }
export const TableGround = memo(function TableGround({ viewBox, uid, glaze, dishes, tools, ghost, slotD, lamp, bloom, pokes }: GroundProps) {
  return <svg viewBox={viewBox} className="mb-layer mb-ground" aria-hidden="true" focusable="false" data-lamp={lamp}>
    <defs>
      <radialGradient id={`${uid}-pool`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.62 }} /><stop offset=".55" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0.2 }} /><stop offset="1" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0 }} />
      </radialGradient>
    </defs>
    <KitTable />
    {/* The glass sun lamp throws a pool of daylight across the linen while it is lit. */}
    <circle className="mb-pool" cx={TABLE_SPOTS.lamp.x + 76} cy={TABLE_SPOTS.lamp.y + 84} r="168" fill={`url(#${uid}-pool)`} />
    <g className="mb-prop mb-prop--fern" data-poke={poke(pokes.fern)} style={origin(TABLE_SPOTS.fern)}><Picture spot={TABLE_SPOTS.fern} picture={KIT_FERN} /></g>
    <g className="mb-prop mb-prop--lamp" data-on={lamp} data-poke={poke(pokes.lamp)} style={origin(TABLE_SPOTS.lamp)}>
      <Picture spot={TABLE_SPOTS.lamp} picture={KIT_LAMP.unlit} />
      <Picture spot={TABLE_SPOTS.lamp} picture={KIT_LAMP.lit} className="mb-prop__lit" />
    </g>
    <g className="mb-prop mb-prop--bloom" data-on={bloom} data-poke={poke(pokes.bloom)} style={origin(TABLE_SPOTS.bloom)}>
      <Picture spot={TABLE_SPOTS.bloom} picture={KIT_BLOOM.folded} className="mb-prop__folded" />
      <Picture spot={{ ...TABLE_SPOTS.bloom, size: TABLE_SPOTS.bloom.size * 1.5 }} picture={KIT_BLOOM.open} className="mb-prop__open" />
    </g>
    <g className="mb-tools" data-shown={tools}><g className="mb-prop mb-prop--gold" data-poke={poke(pokes.gold)} style={origin(TABLE_SPOTS.gold)}><Picture spot={TABLE_SPOTS.gold} picture={KIT_GOLD} /></g></g>
    <g className="mb-dishes" data-shown={dishes}>
      {BOWL_GLAZES.map((g, i) => <g key={g} className="mb-dish" data-chosen={glaze === g} style={origin(GLAZE_SPOTS[i])}><Picture spot={GLAZE_SPOTS[i]} picture={KIT_GLAZE[g]} /></g>)}
    </g>
    {ghost && <g className="mb-ghost">
      <path d={OUTLINE_D} />
      <circle cx={BOWL_CENTRE.x} cy={BOWL_CENTRE.y} r={BOWL_R * 0.4} />
    </g>}
    {slotD && <path className="mb-slot" d={slotD} />}
  </svg>;
});

/** The hint: a small gloved hand that shows the gesture on the real thing.
 * It is positioned in stage pixels and never takes the pointer. */
export function HintHand({ x, y, pressed, shown, ms }: { x: number; y: number; pressed: boolean; shown: boolean; ms: number }) {
  return <div className="mb-hand" data-shown={shown} data-pressed={pressed} aria-hidden="true" style={{ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`, transitionDuration: `${ms}ms, 220ms` }}>
    <span className="mb-hand__ring" />
    <svg viewBox="0 0 48 58" focusable="false">
      {/* The same shapes twice: once as an outline, once as the glove, so they read as one hand. */}
      {(['line', 'glove'] as const).map(layer => <g key={layer} className={`mb-hand__${layer}`}>
        <rect x="9" y="3" width="11" height="32" rx="5.5" />
        <rect x="9" y="22" width="30" height="33" rx="11" />
        <rect x="19" y="19" width="8" height="16" rx="4" /><rect x="26" y="20" width="8" height="16" rx="4" /><rect x="32" y="23" width="7" height="14" rx="3.5" />
        <rect x="2" y="27" width="10" height="20" rx="5" transform="rotate(-24 7 37)" />
      </g>)}
    </svg>
  </div>;
}

/** How far along: one mark per piece or crack. Done is teal with a tick, so it never rests on colour alone. */
export function Marks({ done, total, label }: { done: number; total: number; label: string }) {
  return <div className="mb-marks" role="img" aria-label={label}>
    {Array.from({ length: total }, (_, i) => <span key={i} data-done={i < done}>{i < done && <Check size={13} strokeWidth={3.5} aria-hidden="true" />}</span>)}
  </div>;
}
