/** The workshop Mend the Bowl is played in, seen from directly above (one
 * camera, one light): the kit's pearl floor with its window light, the kit's
 * round table cut out and standing on it with its own shadow thrown to the
 * lower right, shipped kit props lying on the linen (all photographed from
 * above), the four dishes of glaze, the dish of gold, and the faint place
 * where the bowl goes. Scene art keeps its own left and right in both
 * languages. The hint hand is the one piece of interface that lives here. */
import { memo, type CSSProperties } from 'react';
import { BOWL_GLAZES, type BowlGlaze } from './mendBowlRules';
import { BOWL_CENTRE, BOWL_R, OUTLINE_D } from './mendBowlPatterns';
import { GLAZE_SPOTS, type TableLayout, type TableSpot } from './mendBowlPlay';
import { KIT_BLOOM, KIT_FERN, KIT_GLAZE, KIT_GOLD, KIT_LAMP, KIT_TABLETOP, type KitPicture } from './mendKit';

/** A kit picture lying at a spot on the table (stage units). */
function Picture({ spot, picture, className }: { spot: TableSpot; picture: KitPicture; className?: string }) {
  const height = spot.size * picture.h / picture.w;
  return <image className={className} href={picture.src} x={spot.x - spot.size / 2} y={spot.y - height / 2} width={spot.size} height={height} />;
}
/** Alternates between two identical animations so a second poke restarts it. */
const poke = (count: number) => count > 0 ? (count % 2 ? 'a' : 'b') : undefined;
const origin = (spot: TableSpot): CSSProperties => ({ transformOrigin: `${spot.x}px ${spot.y}px` });
/** The tabletop picture in stage units: its linen is centred on the bowl. */
export const TABLETOP_BOX = (() => {
  const scale = KIT_TABLETOP.linenUnits / KIT_TABLETOP.linen;
  return { x: BOWL_CENTRE.x - KIT_TABLETOP.centre.x * scale, y: BOWL_CENTRE.y - KIT_TABLETOP.centre.y * scale, w: KIT_TABLETOP.w * scale, h: KIT_TABLETOP.h * scale, r: KIT_TABLETOP.wood * scale };
})();

export interface TablePokes { fern: number; gold: number; lamp: number; bloom: number; dish: number }
interface GroundProps { viewBox: string; uid: string; glaze: BowlGlaze; spots: TableLayout; dishes: boolean; tools: boolean; ghost: boolean; slotD: string | null; lamp: boolean; bloom: boolean; pokes: TablePokes }
export const TableGround = memo(function TableGround({ viewBox, uid, glaze, spots, dishes, tools, ghost, slotD, lamp, bloom, pokes }: GroundProps) {
  const T = TABLETOP_BOX, C = BOWL_CENTRE;
  return <svg viewBox={viewBox} className="mb-layer mb-ground" aria-hidden="true" focusable="false" data-lamp={lamp}>
    <defs>
      <radialGradient id={`${uid}-pool`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.62 }} /><stop offset=".55" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0.2 }} /><stop offset="1" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0 }} />
      </radialGradient>
      {/* The table's shadow on the floor: tight under its edge, soft and long away from the window. */}
      <radialGradient id={`${uid}-under`} cx=".5" cy=".5" r=".5">
        <stop offset=".8" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.34 }} /><stop offset=".92" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.16 }} /><stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
      </radialGradient>
      <radialGradient id={`${uid}-edge`} cx=".5" cy=".5" r=".5">
        <stop offset=".955" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.3 }} /><stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
      </radialGradient>
      <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" /></filter>
    </defs>
    <circle cx={C.x + 26} cy={C.y + 34} r={T.r + 34} fill={`url(#${uid}-under)`} />
    <circle cx={C.x + 3} cy={C.y + 4} r={T.r + 8} fill={`url(#${uid}-edge)`} />
    <image href={KIT_TABLETOP.src} x={T.x} y={T.y} width={T.w} height={T.h} preserveAspectRatio="none" />
    {/* The glass sun lamp throws a pool of daylight across the linen while it is lit. */}
    <circle className="mb-pool" cx={spots.lamp.x + (spots.lamp.x < C.x ? 76 : -76)} cy={spots.lamp.y + 84} r="168" fill={`url(#${uid}-pool)`} />
    {/* Every prop lies on the table: a soft contact shadow to the lower right, like the table's own. */}
    <g className="mb-prop mb-prop--fern" data-poke={poke(pokes.fern)} style={origin(spots.fern)}><Picture spot={spots.fern} picture={KIT_FERN} /></g>
    <g className="mb-prop mb-prop--lamp" data-on={lamp} data-poke={poke(pokes.lamp)} style={origin(spots.lamp)}>
      <Picture spot={spots.lamp} picture={KIT_LAMP.unlit} />
      <Picture spot={spots.lamp} picture={KIT_LAMP.lit} className="mb-prop__lit" />
    </g>
    <g className="mb-prop mb-prop--bloom" data-on={bloom} data-poke={poke(pokes.bloom)} style={origin(spots.bloom)}>
      <Picture spot={spots.bloom} picture={KIT_BLOOM.folded} className="mb-prop__folded" />
      <Picture spot={{ ...spots.bloom, size: spots.bloom.size * 1.5 }} picture={KIT_BLOOM.open} className="mb-prop__open" />
    </g>
    <g className="mb-tools" data-shown={tools}><g className="mb-prop mb-prop--gold" data-poke={poke(pokes.gold)} style={origin(spots.gold)}><Picture spot={spots.gold} picture={KIT_GOLD} /></g></g>
    <g className="mb-dishes" data-shown={dishes}>
      {BOWL_GLAZES.map((g, i) => <g key={g} className="mb-dish" data-chosen={glaze === g} data-poke={glaze === g ? poke(pokes.dish) : undefined} style={origin(GLAZE_SPOTS[i])}><Picture spot={GLAZE_SPOTS[i]} picture={KIT_GLAZE[g]} /></g>)}
    </g>
    {ghost && <g className="mb-ghost">
      <path d={OUTLINE_D} filter={`url(#${uid}-soft)`} />
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
