import { useId } from 'react';
import { TinCar, mk, mx } from './windupCar';

/** Wind-up Racer cover: the tin car mid-run along the table, the domino row
 * behind it tipping over in a wave. One subject, no text; it reads at 80px
 * (the car and the brass key sit in the middle third that every crop keeps). */
const DOMINOES: readonly { x: number; tip: number; colour: string }[] = [
  { x: 30, tip: 84, colour: 'water' }, { x: 60, tip: 76, colour: 'violet' }, { x: 90, tip: 64, colour: 'teal' },
  { x: 120, tip: 50, colour: 'amber' }, { x: 150, tip: 38, colour: 'red' }, { x: 180, tip: 26, colour: 'poppy' }, { x: 230, tip: 14, colour: 'water' },
  { x: 262, tip: 5, colour: 'violet' }, { x: 294, tip: 0, colour: 'teal' }, { x: 326, tip: 0, colour: 'amber' }, { x: 358, tip: 0, colour: 'red' },
];

export default function WindupRaceCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId().replace(/:/g, '');
  const stop = (offset: string, colour: string) => <stop offset={offset} style={{ stopColor: colour }} />;
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}wall`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('paper', 'butter', 70))}{stop('1', mx('sand', 'clay-pale', 55))}</linearGradient>
      <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">{stop('0', mk('sky'))}{stop('1', mk('butter'))}</linearGradient>
      <radialGradient id={`${id}sun`} cx=".5" cy=".5" r=".5">{stop('0', mk('white'))}{stop('.4', mx('sun', 'white', 55))}{stop('1', mx('sun', 'transparent', 0))}</radialGradient>
      <linearGradient id={`${id}top`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('wood', 'wood-dark', 70))}{stop('1', mx('wood-light', 'wood', 70))}</linearGradient>
      <linearGradient id={`${id}apron`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('wood-light', 'white', 75))}{stop('.15', mk('wood'))}{stop('1', mk('wood-dark'))}</linearGradient>
      <linearGradient id={`${id}beam`} x1="0" y1="0" x2="1" y2="1">{stop('0', mx('butter', 'transparent', 75))}{stop('1', mx('butter', 'transparent', 0))}</linearGradient>
    </defs>
    {/* The room: warm wallpaper and a corner of the sunny window. Everything that
        matters sits in the middle band (y 70 to 230) that every crop keeps. */}
    <rect width="400" height="300" style={{ fill: `url(#${id}wall)` }} />
    {[20, 54, 88, 122, 156, 190, 224, 258, 292, 326, 360, 394].map(x => <rect key={x} x={x} y="0" width="2" height="160" style={{ fill: mx('sand', 'transparent', 35) }} />)}
    <rect x="-10" y="-10" width="140" height="104" rx="6" style={{ fill: mk('white') }} />
    <rect x="0" y="0" width="118" height="84" rx="3" style={{ fill: `url(#${id}sky)` }} />
    <circle cx="40" cy="26" r="40" style={{ fill: `url(#${id}sun)` }} />
    <path d="M0 66C28 52 64 56 118 61L118 84L0 84Z" style={{ fill: mx('spring', 'sage', 55) }} />
    <rect x="56" y="0" width="6" height="84" style={{ fill: mk('white') }} />
    <rect x="-10" y="84" width="150" height="10" rx="5" style={{ fill: mk('white') }} />
    <path d="M36 0L118 0L330 160L170 160Z" style={{ fill: `url(#${id}beam)`, opacity: .5 }} />
    {/* The table. */}
    <rect x="0" y="146" width="400" height="16" style={{ fill: mx('umber', 'transparent', 12) }} />
    <rect x="0" y="156" width="400" height="76" style={{ fill: `url(#${id}top)` }} />
    {[174, 196, 216].map(y => <path key={y} d={`M0 ${y}C120 ${y - 3} 260 ${y + 3} 400 ${y - 1}`} style={{ fill: 'none', stroke: mx('wood-dark', 'transparent', 25), strokeWidth: 1.4 }} />)}
    <rect x="0" y="232" width="400" height="68" style={{ fill: `url(#${id}apron)` }} />
    {/* The domino row behind the lane, tipping in a wave from the left. */}
    {DOMINOES.map(d => <g key={d.x} transform={`translate(${d.x} 178) rotate(${d.tip}) scale(.86)`}>
      <rect x="-15" y="-66" width="15" height="66" rx="3" style={{ fill: mk(d.colour) }} />
      <rect x="-15" y="-66" width="5" height="66" rx="2" style={{ fill: mx('white', 'transparent', 35) }} />
      <rect x="-15" y="-35" width="15" height="2.6" style={{ fill: mx('white', 'transparent', 70) }} />
      <circle cx="-7.5" cy="-51" r="2.6" style={{ fill: mk('white') }} />
      <circle cx="-7.5" cy="-16" r="2.6" style={{ fill: mk('white') }} />
    </g>)}
    {/* A little puff of dust behind the wheels. */}
    {[[84, 200, 7], [71, 194, 5], [95, 205, 4]].map(([cx, cy, r]) => <circle key={cx} cx={cx} cy={cy} r={r} style={{ fill: mx('white', 'transparent', 50) }} />)}
    {/* The car itself, nose up a touch as it pulls away. */}
    <g transform="translate(176 208) scale(1.62) rotate(-2)">
      <TinCar keyAngle={64} tight={0.55} turns={6} spin={40} />
    </g>
  </svg>;
}
