import { useId } from 'react';
import { RoverCar, mx } from './windupCar';
import { FLOWER_OPEN_ART, PEP_SIDE_ART, WALL_ART } from './windupKit';

/** Wind-up Racer cover, a kit picture: Rover with its brass wind-up key on the
 * pavilion floor, Pep scouting behind it, the knit flower ahead. One subject,
 * no text; it reads at 80px (Rover and the key sit in the middle third that
 * every crop keeps). */
export default function WindupRaceCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${id}shade`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: mx('shadow', 'transparent', 30) }} /><stop offset="1" style={{ stopColor: mx('shadow', 'transparent', 0) }} />
      </radialGradient>
    </defs>
    {/* The pavilion room: its arches and the valley behind, its pale floor in front. */}
    <image href={WALL_ART} x="-40" y="-150" width="480" height="480" preserveAspectRatio="none" />
    <rect x="0" y="224" width="400" height="76" style={{ fill: mx('white', 'transparent', 30) }} />
    {/* The dashed lane line of the kit's Rover floor. */}
    <path d="M-10 268H410" style={{ fill: 'none', stroke: mx('white', 'transparent', 96), strokeWidth: 7, strokeDasharray: '46 30' }} />
    <ellipse cx="74" cy="212" rx="50" ry="9" style={{ fill: `url(#${id}shade)` }} />
    <g transform="translate(74 214) scale(-1 1)"><image href={PEP_SIDE_ART} x="-55" y="-116" width="110" height="116" preserveAspectRatio="none" /></g>
    <ellipse cx="340" cy="216" rx="34" ry="8" style={{ fill: `url(#${id}shade)` }} />
    <image href={FLOWER_OPEN_ART} x="296" y="84" width="88" height="132" />
    {/* A little dust behind the wheels. */}
    {[[112, 244, 9], [96, 236, 6], [124, 250, 5]].map(([cx, cy, r]) => <circle key={cx} cx={cx} cy={cy} r={r} style={{ fill: mx('white', 'transparent', 70) }} />)}
    <g transform="translate(208 252) scale(1.56) rotate(-2)">
      <RoverCar keyAngle={38} tight={0.6} />
    </g>
  </svg>;
}
