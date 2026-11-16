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
  const car = 150, k = car / ROVER_FRONT.w, carX = 132, carY = 252 - ROVER_FRONT.footY * k;
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
    <ellipse cx="62" cy="226" rx="46" ry="8" style={{ fill: `url(#${id}shade)` }} />
    <g transform="translate(62 228) scale(-1 1)"><image href={PEP_SIDE.src} x="-52" y="-109" width="104" height="109" preserveAspectRatio="none" /></g>
    <ellipse cx="338" cy="216" rx="32" ry="7" style={{ fill: `url(#${id}shade)` }} />
    <image href={FLOWER_OPEN.src} x="296" y="88" width="86" height="129" />
    {/* Dust behind the wheels, and the wind going by. */}
    {[[116, 250, 10], [98, 242, 7], [128, 258, 6]].map(([cx, cy, r]) => <circle key={cx} cx={cx} cy={cy} r={r} style={{ fill: mx('white', 'transparent', 72) }} />)}
    {[[20, 150, 70], [40, 176, 46], [8, 196, 58]].map(([x, y, len]) => <path key={y} d={`M${x} ${y}h${len}`} style={{ fill: 'none', stroke: mx('white', 'transparent', 78), strokeWidth: 3, strokeLinecap: 'round' }} />)}
    <ellipse cx={carX + 76} cy="254" rx="76" ry="13" style={{ fill: `url(#${id}shade)` }} />
    <g transform="rotate(-3 208 250)">
      <image href={ROVER_FRONT.src} x={carX} y={carY} width={car} height={ROVER_FRONT.h * k} />
      {/* The brass wind-up key on the start button. */}
      <rect x={keyX - 2.5} y={keyY - 24} width="5" height="26" rx="2" style={{ fill: `url(#${id}brass)` }} />
      <path d={`M${keyX} ${keyY - 22}c-20-16-30 8-14 10 10 1 12-6 14-10zm0 0c20-16 30 8 14 10-10 1-12-6-14-10z`} style={{ fill: `url(#${id}brass)`, stroke: mk('gold-deep'), strokeWidth: 1 }} />
      <circle cx={keyX - 12} cy={keyY - 21} r="4" style={{ fill: mx('white', 'transparent', 30) }} /><circle cx={keyX + 12} cy={keyY - 21} r="4" style={{ fill: mx('white', 'transparent', 30) }} />
    </g>
  </svg>;
}
