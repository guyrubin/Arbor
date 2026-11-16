import { memo, useId, type CSSProperties } from 'react';
import type { TextileCloth, TextileFlower } from './stitchGardenRules';
import { FLOWER_LIKES } from './stitchGardenPlay';
import { CLOTH_TONES, FlowerSwatch, THREAD_COLOURS, WantToken } from './StitchArt';
import '../makerPalette.css';

/** The sewing things that lie on Aya's table, each seen from straight above
 * and lit from the window at the top left, like the table itself: spools on
 * their sides in a shallow basket, paper seed packets, a pile of folded
 * cloths. They are the game's pickers: each is the picture inside a real
 * button. All colour is the makers' palette through var() and color-mix(). */

const veil = (token: string, pct: number) => `color-mix(in srgb, var(${token}) ${pct}%, transparent)`;
const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;
const stop = (offset: number, colour: string, opacity = 1) => <stop offset={offset} style={{ stopColor: colour, stopOpacity: opacity }} />;

/** A wooden spool of thread lying on its side: the wound thread between two
 * flanges, a line of sheen along it, the winding showing as fine slanted
 * turns, and a loose end curling away. */
export const SpoolArt = memo(function SpoolArt({ thread }: { thread: number }) {
  const raw = useId(), id = raw.replace(/:/g, '');
  const colour = THREAD_COLOURS[thread] ?? THREAD_COLOURS[0];
  const deep = mix(colour, 58, 'var(--mk-shadow)'), lit = mix(colour, 56, 'var(--mk-white)');
  const wood = 'color-mix(in srgb, var(--mk-wood-light) 70%, var(--mk-white))', woodDeep = 'color-mix(in srgb, var(--mk-wood) 80%, var(--mk-umber))';
  return <svg className="sg-spool-art" viewBox="0 0 60 78" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="0">{stop(0, deep)}{stop(0.2, colour)}{stop(0.36, lit)}{stop(0.52, colour)}{stop(1, deep)}</linearGradient>
      <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="0">{stop(0, woodDeep)}{stop(0.3, wood)}{stop(0.62, 'var(--mk-wood-light)')}{stop(1, woodDeep)}</linearGradient>
      <pattern id={`${id}p`} width="60" height="3.1" patternUnits="userSpaceOnUse" patternTransform="rotate(-7)"><path d="M0 2.6H60" style={{ stroke: veil('--mk-shadow', 30), strokeWidth: 0.8 }} /><path d="M0 1.1H60" style={{ stroke: veil('--mk-white', 20), strokeWidth: 0.6 }} /></pattern>
      <clipPath id={`${id}c`}><rect x="10" y="11" width="40" height="56" rx="7" /></clipPath>
    </defs>
    <ellipse className="sg-cast" cx="34" cy="43" rx="27" ry="35" style={{ fill: veil('--mk-shadow', 26) }} />
    <path className="sg-spool-art__tail" d="M48 54C60 58 54 70 45 73" style={{ fill: 'none', stroke: colour, strokeWidth: 2.1 }} strokeLinecap="round" />
    <rect x="4" y="60" width="52" height="13" rx="6.2" fill={`url(#${id}w)`} />
    <rect x="10" y="11" width="40" height="56" rx="7" fill={`url(#${id}t)`} />
    <g clipPath={`url(#${id}c)`}><rect x="6" y="6" width="48" height="66" fill={`url(#${id}p)`} /></g>
    <path d="M24.5 16V60" style={{ stroke: veil('--mk-white', 46), strokeWidth: 3.4 }} strokeLinecap="round" />
    <rect x="4" y="5" width="52" height="13" rx="6.2" fill={`url(#${id}w)`} />
    <path d="M9 8.6h32" style={{ stroke: veil('--mk-white', 60), strokeWidth: 1.6 }} strokeLinecap="round" />
    <path d="M9 63.6h30" style={{ stroke: veil('--mk-white', 40), strokeWidth: 1.4 }} strokeLinecap="round" />
    <path d="M6 16.4h48M6 71.4h48" style={{ stroke: veil('--mk-umber', 38), strokeWidth: 1 }} strokeLinecap="round" />
  </svg>;
});

/** The shallow woven basket the spools lie in, from above: a rim of wicker turns round a darker floor. */
export const BasketArt = memo(function BasketArt() {
  const raw = useId(), id = raw.replace(/:/g, '');
  const wicker = 'color-mix(in srgb, var(--mk-sand) 72%, var(--mk-wood-light))';
  return <svg className="sg-basket-art" viewBox="0 0 320 110" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">{stop(0, mix('var(--mk-wood)', 62, 'var(--mk-umber)'))}{stop(0.3, mix('var(--mk-wood-light)', 62, 'var(--mk-wood)'))}{stop(1, 'var(--mk-wood-light)')}</linearGradient>
      <pattern id={`${id}k`} width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 2.2h4.5M4.5 6.7h4.5" style={{ stroke: veil('--mk-umber', 20), strokeWidth: 1.6 }} strokeLinecap="round" /><path d="M2.2 4.5v4.5M6.7 0v4.5" style={{ stroke: veil('--mk-white', 26), strokeWidth: 1.6 }} strokeLinecap="round" /></pattern>
    </defs>
    <rect className="sg-cast" x="7" y="9" width="312" height="101" rx="26" style={{ fill: veil('--mk-shadow', 26) }} />
    <rect x="1" y="1" width="314" height="104" rx="26" style={{ fill: wicker }} />
    <rect x="1" y="1" width="314" height="104" rx="26" fill={`url(#${id}k)`} />
    <rect x="1.8" y="1.8" width="312.4" height="102.4" rx="25" style={{ fill: 'none', stroke: veil('--mk-white', 60), strokeWidth: 1.6 }} />
    <rect x="11" y="11" width="294" height="84" rx="17" fill={`url(#${id}f)`} />
    <rect x="11" y="11" width="294" height="84" rx="17" style={{ fill: 'none', stroke: veil('--mk-umber', 40), strokeWidth: 1.4 }} />
  </svg>;
});

/** A paper seed packet lying flat: a crimped top, a round window with the
 * flower worked in the chosen thread, and the mark of what the flower likes
 * (sun, water or shade) printed in its corner. */
export const PacketArt = memo(function PacketArt({ flower, thread, cloth }: { flower: TextileFlower; thread: number; cloth: TextileCloth }) {
  const raw = useId(), id = raw.replace(/:/g, '');
  return <span className="sg-packet-art" data-flower={flower}>
    <svg viewBox="0 0 70 92" aria-hidden="true" focusable="false">
      <defs><linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1">{stop(0, 'var(--mk-white)')}{stop(0.6, 'var(--mk-paper)')}{stop(1, 'var(--mk-paper-shade)')}</linearGradient></defs>
      <path className="sg-cast" d="M7 9h62v84H7z" style={{ fill: veil('--mk-shadow', 24) }} />
      <path d="M3 5l4.600 2.600 4.600 -2.600 4.600 2.600 4.600 -2.600 4.600 2.600 4.600 -2.600 4.600 2.600 4.600 -2.600 4.600 2.600 4.600 -2.600 4.600 2.600 4.600 -2.600 4.600 2.600 4.600 -2.600V86a3 3 0 0 1 -3 3H6a3 3 0 0 1 -3 -3Z" fill={`url(#${id}p)`} style={{ stroke: veil('--mk-umber', 22), strokeWidth: 0.8 }} strokeLinejoin="round" />
      <path d="M4 15.5H66" style={{ stroke: veil('--mk-umber', 18), strokeWidth: 1 }} strokeDasharray="2.4 2" />
      <path d="M4 16.8H66" style={{ stroke: veil('--mk-white', 80), strokeWidth: 0.8 }} />
      <rect x="6.5" y="19.5" width="57" height="66" rx="2.2" style={{ fill: 'none', stroke: mix('var(--mk-leaf)', 50, 'var(--mk-paper-shade)'), strokeWidth: 1.2 }} />
      <g transform="translate(55.5 76.500) scale(.78)"><circle r="12" style={{ fill: 'var(--mk-white)', stroke: veil('--mk-umber', 20), strokeWidth: 1 }} /><WantToken want={FLOWER_LIKES[flower]} /></g>
    </svg>
    <span className="sg-packet-art__window"><FlowerSwatch flower={flower} thread={thread} cloth={cloth} /></span>
  </span>;
});

/** One folded cloth, from above: the weave, a soft fold along one side and the layers showing at its near edge. */
function FoldedCloth({ id, cloth, x, y, turn }: { id: string; cloth: TextileCloth; x: number; y: number; turn: number }) {
  const dye = CLOTH_TONES[cloth].dye ?? 'color-mix(in srgb, var(--mk-linen) 55%, var(--mk-white))';
  const edge = mix(dye, 72, 'var(--mk-shadow)');
  return <g transform={`translate(${x} ${y}) rotate(${turn} 32 32)`} data-cloth={cloth}>
    <rect className="sg-cast" x="5" y="7" width="64" height="64" rx="7" style={{ fill: veil('--mk-shadow', 26) }} />
    <rect x="1.5" y="5" width="63" height="61" rx="6" style={{ fill: edge }} />
    <rect x="0" y="2.5" width="64" height="61" rx="6" style={{ fill: mix(dye, 86, 'var(--mk-shadow)') }} />
    <rect x="0" y="0" width="64" height="60" rx="6" style={{ fill: dye }} />
    <rect x="0" y="0" width="64" height="60" rx="6" fill={`url(#${id})`} />
    <path d="M5 4.500H59" style={{ stroke: veil('--mk-white', 50), strokeWidth: 2.4 }} strokeLinecap="round" />
    <path d="M46 2V58" style={{ stroke: veil('--mk-shadow', 16), strokeWidth: 3 }} /><path d="M44 2V58" style={{ stroke: veil('--mk-white', 30), strokeWidth: 1.2 }} />
    <rect x="5" y="5" width="54" height="50" rx="3" style={{ fill: 'none', stroke: CLOTH_TONES[cloth].hem, strokeWidth: 1.3 }} strokeDasharray="3.4 2.6" strokeLinecap="round" opacity=".7" />
  </g>;
}
/** The pile of folded cloths: the two that are not in the hoop, the next one on top. */
export const ClothPile = memo(function ClothPile({ next, under, flip }: { next: TextileCloth; under: TextileCloth; flip: number }) {
  const raw = useId(), id = raw.replace(/:/g, '');
  return <svg className="sg-pile-art" viewBox="-6 -6 92 92" data-flip={flip ? flip % 2 : undefined} aria-hidden="true" focusable="false">
    <defs><pattern id={`${id}w`} width="4" height="4" patternUnits="userSpaceOnUse">
      <rect x=".2" y=".3" width="1.8" height="1.3" rx=".5" style={{ fill: veil('--mk-white', 26) }} /><rect x="2.2" y="2.3" width="1.8" height="1.3" rx=".5" style={{ fill: veil('--mk-white', 26) }} />
      <path d="M0 1.85h4M0 3.85h4M2.050 0v4M.050 0v4" style={{ stroke: veil('--mk-shadow', 14), strokeWidth: 0.4 }} />
    </pattern></defs>
    <FoldedCloth id={`${id}w`} cloth={under} x={12} y={13} turn={9} />
    <g className="sg-pile-art__top" key={next}><FoldedCloth id={`${id}w`} cloth={next} x={2} y={1} turn={-5} /></g>
  </svg>;
});

/** A soft pool of light under a chosen thing: how the table says "this one" without a tick. */
export const chosenGlow = (on: boolean): CSSProperties => ({ '--sg-chosen': on ? 1 : 0 } as CSSProperties);

/** Aya's worktable: pale maple boards, seen from straight above. Drawn, not
 * photographed: boards of slightly different tone with staggered joints, the
 * grain as long streaks of the wood's own colour, a dark seam and a lit edge
 * between boards. Sized in stage px, so the grain never stretches. */
export const WoodTop = memo(function WoodTop({ w, h }: { w: number; h: number }) {
  const raw = useId(), id = raw.replace(/:/g, '');
  const board = Math.max(78, Math.min(150, h / 6.4)), rows = Math.ceil(h / board);
  const base = 'color-mix(in srgb, var(--mk-wood-light) 40%, var(--mk-white))';
  const tints = [0, 7, 3, 10, 5, 1, 8];
  return <svg className="sg-wood" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <filter id={`${id}g`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.0026 0.13" numOctaves="3" seed="11" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -1.02" result="streak" />
        <feFlood style={{ floodColor: 'var(--mk-wood)' }} result="tone" />
        <feComposite in="tone" in2="streak" operator="in" />
      </filter>
    </defs>
    <rect width={w} height={h} style={{ fill: base }} />
    {Array.from({ length: rows }, (_, r) => <rect key={r} y={r * board} width={w} height={board} style={{ fill: mix('var(--mk-wood-light)', tints[r % tints.length], 'transparent') }} />)}
    <rect width={w} height={h} filter={`url(#${id}g)`} opacity=".4" />
    {Array.from({ length: rows }, (_, r) => { const y = r * board, joint = ((r * 0.37 + 0.21) % 1) * w;
      return <g key={r}>
        {r > 0 && <><path d={`M0 ${y}H${w}`} style={{ stroke: veil('--mk-umber', 26), strokeWidth: 1.4 }} /><path d={`M0 ${y + 1.6}H${w}`} style={{ stroke: veil('--mk-white', 55), strokeWidth: 1 }} /></>}
        <path d={`M${joint} ${y + 1}V${y + board - 1}`} style={{ stroke: veil('--mk-umber', 22), strokeWidth: 1.2 }} /><path d={`M${joint + 1.4} ${y + 1}V${y + board - 1}`} style={{ stroke: veil('--mk-white', 45), strokeWidth: 0.9 }} />
      </g>; })}
  </svg>;
});
