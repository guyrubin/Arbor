import { useId } from 'react';
import PhageArt from './PhageArt';

/** Tiny Structures cover: the finished phage standing on the curve of a
 * bacterium, in the activity's night-slate room. Fills its box; one subject
 * that reads at 80 px (tile, sticker) and in the tall card window. */
export default function TinyBuildersCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId();
  // The card window is wide (its crop keeps only the middle band), the tile
  // square: the card draws the phage smaller and lower, a little off-centre
  // so the hero beside it never covers the head.
  const card = size === 'card';
  const s = card ? 0.5 : 0.84, ground = card ? 236 : 286, x = card ? 168 : 200, cy = ground + 176;
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${id}room`} cx=".34" cy=".2" r="1">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--mk-slate) 80%, var(--mk-indigo))' }} />
        <stop offset=".6" style={{ stopColor: 'color-mix(in srgb, var(--mk-indigo-deep) 70%, var(--mk-slate))' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-night)' }} />
      </radialGradient>
      <radialGradient id={`${id}halo`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--mk-sea) 34%, transparent)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-sea) 0%, transparent)' }} />
      </radialGradient>
      <linearGradient id={`${id}cell`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--mk-spring) 78%, var(--mk-white))' }} />
        <stop offset=".35" style={{ stopColor: 'color-mix(in srgb, var(--mk-spring) 60%, var(--mk-leaf))' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-leaf-deep) 80%, var(--mk-night))' }} />
      </linearGradient>
      <clipPath id={`${id}clip`}><ellipse cx={x} cy={cy} rx="320" ry="178" /></clipPath>
      <filter id={`${id}skin`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="3" seed="3" />
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .2 0" />
      </filter>
    </defs>
    <rect width="400" height="300" style={{ fill: `url(#${id}room)` }} />
    <ellipse cx={x} cy={ground - 190 * s} rx={130 * s + 20} ry={130 * s + 20} style={{ fill: `url(#${id}halo)` }} />
    {[[46, 60, 1.6], [88, 34, 1.1], [330, 46, 1.4], [358, 112, 1], [300, 18, 1], [40, 150, 1.1]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} style={{ fill: 'color-mix(in srgb, var(--mk-sky-pale) 60%, transparent)' }} />)}
    <ellipse cx={x} cy={cy} rx="320" ry="178" style={{ fill: `url(#${id}cell)` }} opacity=".95" />
    <g clipPath={`url(#${id}clip)`}>
      <rect x="-20" y={ground - 16} width="440" height="80" filter={`url(#${id}skin)`} />
      {[[110, 12, 3], [150, 6, 2.4], [262, 10, 2.8], [300, 8, 2.4], [70, 12, 2.2], [340, 8, 2.2], [214, 11, 2.6], [120, 30, 2.4], [250, 34, 2.2]].map(([dx, dy, r], i) => <circle key={i} cx={dx} cy={ground + dy} r={r} style={{ fill: 'color-mix(in srgb, var(--mk-leaf-deep) 45%, transparent)' }} />)}
      <ellipse cx={x} cy={cy} rx="306" ry="166" fill="none" strokeWidth="1.5" style={{ stroke: 'color-mix(in srgb, var(--mk-white) 35%, transparent)' }} />
    </g>
    <ellipse cx={x} cy={cy} rx="320" ry="178" fill="none" strokeWidth="3" style={{ stroke: 'color-mix(in srgb, var(--mk-celadon) 80%, var(--mk-white))' }} />
    <ellipse cx={x + 3} cy={ground + 1} rx={100 * s} ry="8" style={{ fill: 'color-mix(in srgb, var(--mk-leaf-deep) 50%, transparent)' }} />
    <g transform={`translate(${x - 200 * s} ${ground - 338 * s}) scale(${s})`}><PhageArt rotation={22} tilt={0.18} /></g>
  </svg>;
}
