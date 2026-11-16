import { useId } from 'react';
import { FLOWER_OPEN, PEP_SIDE, ROOM_ART, ROVER_FRONT, ROVER_MARKS } from './windupKit';

const mk = (name: string) => `var(--mk-${name})`;
const mx = (a: string, b: string, share: number) => `color-mix(in srgb, ${mk(a)} ${share}%, ${b === 'transparent' ? 'transparent' : mk(b)})`;

/** Wind-up Racer cover, a kit picture: Rover tearing along its felt track
 * under the pavilion's arches, its brass key spinning, Pep bounding behind,
 * a knit flower ahead. One subject, no text; it reads at 80px (Rover and the
 * key sit in the middle third that every crop keeps). */
export default function WindupRaceCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId().replace(/:/g, '');
  const car = 150, k = car / ROVER_FRONT.w, carX = 104, carY = 252 - ROVER_FRONT.footY * k;
  const keyX = carX + ROVER_MARKS.buttonX * k, keyY = carY + ROVER_MARKS.buttonY * k;
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${id}shade`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: mx('shadow', 'transparent', 34) }} /><stop offset="1" style={{ stopColor: mx('shadow', 'transparent', 0) }} />
      </radialGradient>
      <linearGradient id={`${id}brass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: mk('gold-light') }} /><stop offset=".55" style={{ stopColor: mk('gold') }} /><stop offset="1" style={{ stopColor: mk('gold-deep') }} />
      </linearGradient>
      <linearGradient id={`${id}felt`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: mx('teal-deep', 'white', 62) }} /><stop offset="1" style={{ stopColor: mx('teal-deep', 'slate', 58) }} />
      </linearGradient>
    </defs>
    {/* The pavilion room: its arches and the valley behind. */}
    <image href={ROOM_ART} x="-40" y="-150" width="480" height="480" preserveAspectRatio="none" />
    {/* The felt track, running away to the arches. */}
    <path d="M-20 300 L-20 236 L420 214 L420 300Z" style={{ fill: `url(#${id}felt)` }} />
    <path d="M-20 240 L420 218" style={{ fill: 'none', stroke: mx('cream', 'white', 50), strokeWidth: 3 }} />
    <path d="M-20 272 L420 252" style={{ fill: 'none', stroke: mx('cream', 'white', 50), strokeWidth: 5, strokeDasharray: '38 30' }} />
    <ellipse cx="44" cy="222" rx="40" ry="7" style={{ fill: `url(#${id}shade)` }} />
    <g transform="translate(44 224) scale(-1 1)"><image href={PEP_SIDE.src} x="-44" y="-92" width="88" height="92" preserveAspectRatio="none" /></g>
    <ellipse cx="338" cy="216" rx="32" ry="7" style={{ fill: `url(#${id}shade)` }} />
    <image href={FLOWER_OPEN.src} x="296" y="88" width="86" height="129" />
    {/* Dust behind the wheels, and the wind going by. */}
    {[[92, 252, 10], [74, 246, 7], [102, 260, 6]].map(([cx, cy, r]) => <circle key={cx} cx={cx} cy={cy} r={r} style={{ fill: mx('white', 'transparent', 72) }} />)}
    <ellipse cx={carX + 76} cy="254" rx="76" ry="13" style={{ fill: `url(#${id}shade)` }} />
    <g transform="rotate(-3 180 250)">
      <image href={ROVER_FRONT.src} x={carX} y={carY} width={car} height={ROVER_FRONT.h * k} />
      {/* The brass wind-up key on the start button. */}
      <rect x={keyX - 2.5} y={keyY - 30} width="5" height="32" rx="2" style={{ fill: `url(#${id}brass)` }} />
      {[-1, 1].map(side => <circle key={side} cx={keyX + side * 12.5} cy={keyY - 34} r="9" style={{ fill: 'none', stroke: `url(#${id}brass)`, strokeWidth: 6.5 }} />)}
      {[-1, 1].map(side => <path key={side} d={`M${keyX + side * 12.5 - 7.5} ${keyY - 37}a8 8 0 0 1 7-5`} style={{ fill: 'none', stroke: mx('white', 'transparent', 80), strokeWidth: 1.6, strokeLinecap: 'round' }} />)}
      <circle cx={keyX} cy={keyY - 34} r="3.4" style={{ fill: mk('gold') }} />
    </g>
  </svg>;
}
