import { useId } from 'react';
import { CrankDefs, EngineArt, poseOf } from './crankArt';
import '../makerPalette.css';

/** How Things Move cover: the little engine on the cream stage under the
 * Studio night sky, its case half wiped away, the piston mid-stroke. Fills
 * its box (the box sets the size); one scene for tile, card and sticker. */
const POSE = poseOf(1.95);
export default function CrankWorksCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--studio-sky)' }} /><stop offset="1" style={{ stopColor: 'var(--studio-ink-soft)' }} /></linearGradient>
      <radialGradient id={`${id}stage`} cx=".38" cy=".18" r=".9"><stop offset="0" style={{ stopColor: 'var(--mk-white)' }} /><stop offset=".5" style={{ stopColor: 'var(--studio-canvas-soft)' }} /><stop offset="1" style={{ stopColor: 'var(--mk-paper-shade)' }} /></radialGradient>
      <radialGradient id={`${id}halo`} cx=".5" cy=".5" r=".5"><stop offset="0" style={{ stopColor: 'var(--mk-butter)', stopOpacity: .55 }} /><stop offset="1" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0 }} /></radialGradient>
    </defs>
    <CrankDefs id={id} />
    <rect width="400" height="300" fill={`url(#${id}sky)`} />
    {[[46, 40, 1.6], [92, 86, 1.1], [330, 34, 1.4], [362, 104, 1], [286, 70, .9], [30, 120, 1]].map(([x, y, r]) => <circle key={`${x}`} cx={x} cy={y} r={r} style={{ fill: 'var(--mk-butter)', opacity: .7 }} />)}
    <circle cx="200" cy="150" r="170" fill={`url(#${id}halo)`} />
    <ellipse cx="200" cy="318" rx="300" ry="78" fill={`url(#${id}stage)`} />
    <g transform="translate(64 -38) scale(.68)">
      <EngineArt id={id} pose={POSE} open={0.5} />
    </g>
  </svg>;
}
