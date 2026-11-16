import { useId, useMemo } from 'react';
import type { TextileFlower } from './stitchGardenRules';
import { motifStitches } from './stitchGardenStitches';
import { MotifThreads, clothStyle } from './StitchArt';
import '../makerPalette.css';

/** Three finished flowers, drawn large enough to read on an 80 px tile. */
const BLOOMS: readonly { flower: TextileFlower; cell: number; thread: number; x: number; y: number; scale: number }[] = [
  { flower: 'poppy', cell: 4, thread: 0, x: 152, y: 150, scale: 1.3 },
  { flower: 'daisy', cell: 6, thread: 4, x: 206, y: 134, scale: 1.45 },
  { flower: 'bluebell', cell: 2, thread: 3, x: 258, y: 152, scale: 1.3 },
];

/** Stitch Garden cover: the hoop on linen with three finished flowers, lying
 * on the cream work table under the Studio's night sky. One clear subject, no
 * text; fills its box (the box sets the size). */
export default function StitchGardenCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const raw = useId(), id = raw.replace(/:/g, '');
  const blooms = useMemo(() => BLOOMS.map(b => ({ ...b, stitches: motifStitches(b.flower, b.cell) })), []);
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block', ...clothStyle('linen') }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--mk-night)' }} /><stop offset="1" style={{ stopColor: 'var(--mk-indigo-deep)' }} /></linearGradient>
      <radialGradient id={`${id}table`} cx=".38" cy=".3" r=".9"><stop offset="0" style={{ stopColor: 'var(--mk-white)' }} /><stop offset=".55" style={{ stopColor: 'var(--mk-cream)' }} /><stop offset="1" style={{ stopColor: 'var(--mk-paper-shade)' }} /></radialGradient>
      <pattern id={`${id}w`} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" style={{ fill: 'var(--sg-ground)' }} />
        <rect y=".3" width="4" height="1.5" rx=".7" style={{ fill: 'var(--sg-weft)' }} opacity=".55" />
        <rect x="2.3" width="1.4" height="4" rx=".7" style={{ fill: 'var(--sg-warp)' }} opacity=".5" />
      </pattern>
      <linearGradient id={`${id}wood`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: 'var(--mk-wood-light)' }} /><stop offset=".55" style={{ stopColor: 'var(--mk-wood)' }} /><stop offset="1" style={{ stopColor: 'var(--mk-wood-dark)' }} /></linearGradient>
      <linearGradient id={`${id}brass`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--mk-gold-light)' }} /><stop offset="1" style={{ stopColor: 'var(--mk-gold-deep)' }} /></linearGradient>
      <radialGradient id={`${id}lift`} cx=".32" cy=".25" r=".8"><stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.28 }} /><stop offset=".65" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} /><stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.18 }} /></radialGradient>
      <clipPath id={`${id}c`}><circle cx="205" cy="158" r="112" /></clipPath>
    </defs>
    <rect width="400" height="300" fill={`url(#${id}sky)`} />
    <g style={{ fill: 'var(--mk-butter)' }} opacity=".7"><circle cx="46" cy="40" r="1.6" /><circle cx="352" cy="30" r="1.3" /><circle cx="372" cy="88" r="1.1" /><circle cx="24" cy="112" r="1" /></g>
    <ellipse cx="200" cy="318" rx="290" ry="214" fill={`url(#${id}table)`} />
    {/* Cloth corners peek out beyond the hoop. */}
    <path d="M86 52L322 44L332 274L80 280Z" transform="translate(5 6)" style={{ fill: 'color-mix(in srgb, var(--mk-shadow) 14%, transparent)' }} />
    <path d="M86 52L322 44L332 274L80 280Z" fill={`url(#${id}w)`} />
    <ellipse cx="212" cy="168" rx="134" ry="132" style={{ fill: 'color-mix(in srgb, var(--mk-shadow) 22%, transparent)' }} />
    <circle cx="205" cy="158" r="112" fill={`url(#${id}w)`} />
    <g clipPath={`url(#${id}c)`}>
      {blooms.map(b => <g key={b.flower} transform={`translate(${b.x} ${b.y}) scale(${b.scale})`}><MotifThreads stitches={b.stitches} thread={b.thread} count={b.stitches.length} flower={b.flower} cell={b.cell} /></g>)}
    </g>
    <circle cx="205" cy="158" r="112" fill={`url(#${id}lift)`} />
    <circle cx="205" cy="158" r="112" style={{ fill: 'none', strokeWidth: 5 }} stroke={`url(#${id}wood)`} opacity=".85" />
    <circle cx="205" cy="158" r="122" style={{ fill: 'none', strokeWidth: 15 }} stroke={`url(#${id}wood)`} />
    <path d="M100 120A116 116 0 0 1 170 46" style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-white) 45%, transparent)', strokeWidth: 3 }} strokeLinecap="round" />
    <rect x="193" y="22" width="10" height="18" rx="3" fill={`url(#${id}wood)`} /><rect x="207" y="22" width="10" height="18" rx="3" fill={`url(#${id}wood)`} />
    <rect x="182" y="26" width="48" height="8" rx="4" fill={`url(#${id}brass)`} />
    <circle cx="234" cy="30" r="8" fill={`url(#${id}brass)`} />
    <path d="M230 27l8 6" style={{ stroke: 'var(--mk-gold-deep)', strokeWidth: 1.8 }} strokeLinecap="round" />
  </svg>;
}
