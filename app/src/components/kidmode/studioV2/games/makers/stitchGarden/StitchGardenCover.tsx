import { useId, useMemo } from 'react';
import type { TextileFlower } from './stitchGardenRules';
import { CLOTH_R, HOOP_CX, HOOP_CY, motifStitches } from './stitchGardenStitches';
import { FERN, PINCUSHION, TABLE } from './stitchGardenKit';
import { MotifThreads } from './StitchArt';
import '../makerPalette.css';

/** Three finished flowers, drawn large enough to read on an 80 px tile. */
const BLOOMS: readonly { flower: TextileFlower; cell: number; thread: number; x: number; y: number; scale: number }[] = [
  { flower: 'poppy', cell: 4, thread: 0, x: 148, y: 150, scale: 1.25 },
  { flower: 'daisy', cell: 6, thread: 4, x: 204, y: 132, scale: 1.4 },
  { flower: 'bluebell', cell: 2, thread: 3, x: 262, y: 150, scale: 1.25 },
];
const WOOD_LIGHT = 'color-mix(in srgb, var(--mk-wood-light) 48%, var(--mk-white))';
const WOOD_SHADE = 'color-mix(in srgb, var(--mk-wood) 58%, var(--mk-steel-dark))';

/** Stitch Garden cover, a kit picture: Aya's round linen table from above
 * (`scene-table`), the hoop on it with three stitched flowers, her fern and
 * the knit pincushion beside it, all seen from straight above. One clear subject,
 * no text; fills its box (the box sets the size). */
export default function StitchGardenCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const raw = useId(), id = raw.replace(/:/g, '');
  const blooms = useMemo(() => BLOOMS.map(b => ({ ...b, stitches: motifStitches(b.flower, b.cell) })), []);
  // The table picture, placed so its teal ring is 150 units out from the hoop's middle.
  const k = 150 / TABLE.r, cx = 205, cy = 152, hoop = 104;
  const table = { href: size === 'tile' && TABLE.src480 ? TABLE.src480 : TABLE.src, x: cx - TABLE.cx * k, y: cy - TABLE.cy * k, width: TABLE.width * k, height: TABLE.height * k };
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}wood`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: WOOD_LIGHT }} /><stop offset=".55" style={{ stopColor: 'color-mix(in srgb, var(--mk-wood-light) 62%, var(--mk-steel-light))' }} /><stop offset="1" style={{ stopColor: WOOD_SHADE }} /></linearGradient>
      <linearGradient id={`${id}brass`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--mk-gold-light)' }} /><stop offset="1" style={{ stopColor: 'var(--mk-gold-deep)' }} /></linearGradient>
      <radialGradient id={`${id}shadow`} cx=".5" cy=".5" r=".5"><stop offset=".8" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.3 }} /><stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} /></radialGradient>
      <clipPath id={`${id}c`}><circle cx={cx} cy={cy} r={hoop} /></clipPath>
    </defs>
    <image {...table} preserveAspectRatio="none" />
    <ellipse cx={cx + 5} cy={cy + 8} rx={hoop + 22} ry={hoop + 21} fill={`url(#${id}shadow)`} />
    <g clipPath={`url(#${id}c)`}>
      <image {...table} preserveAspectRatio="none" />
      <circle cx={cx} cy={cy} r={hoop} style={{ fill: 'color-mix(in srgb, var(--mk-white) 18%, transparent)' }} />
      <circle cx={cx + 2} cy={cy + 3} r={hoop} style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-shadow) 15%, transparent)', strokeWidth: 7 }} />
      {blooms.map(b => <g key={b.flower} transform={`translate(${b.x} ${b.y}) scale(${b.scale})`}><MotifThreads stitches={b.stitches} thread={b.thread} count={b.stitches.length} flower={b.flower} cell={b.cell} /></g>)}
    </g>
    <circle cx={cx} cy={cy} r={hoop} style={{ fill: 'none', strokeWidth: 4.5 }} stroke={`url(#${id}wood)`} opacity=".9" />
    <circle cx={cx} cy={cy} r={hoop + 8} style={{ fill: 'none', strokeWidth: 12 }} stroke={`url(#${id}wood)`} />
    <path d={`M${cx - hoop - 5} ${cy - 30}A${hoop + 10} ${hoop + 10} 0 0 1 ${cx - 34} ${cy - hoop - 6}`} style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-white) 55%, transparent)', strokeWidth: 2.4 }} strokeLinecap="round" />
    <rect x={cx - 11} y={cy - hoop - 24} width="9" height="18" rx="3" fill={`url(#${id}wood)`} /><rect x={cx + 2} y={cy - hoop - 24} width="9" height="18" rx="3" fill={`url(#${id}wood)`} />
    <rect x={cx - 22} y={cy - hoop - 20} width="46" height="7" rx="3.5" fill={`url(#${id}brass)`} />
    <circle cx={cx + 28} cy={cy - hoop - 16.5} r="7.5" fill={`url(#${id}brass)`} />
    {/* Seen from above like the table: the fern at the far corner, the knit pincushion by the hoop. */}
    <ellipse cx="368" cy="46" rx="42" ry="30" style={{ fill: 'color-mix(in srgb, var(--mk-shadow) 22%, transparent)' }} />
    <image href={FERN.src} x="296" y="-34" width="128" height={128 * FERN.height / FERN.width} />
    <ellipse cx="58" cy="262" rx="30" ry="22" style={{ fill: 'color-mix(in srgb, var(--mk-shadow) 22%, transparent)' }} />
    <image href={PINCUSHION.src} x="22" y="222" width="66" height={66 * PINCUSHION.height / PINCUSHION.width} />
  </svg>;
}
