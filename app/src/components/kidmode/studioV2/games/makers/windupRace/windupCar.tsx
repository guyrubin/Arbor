import { useId, type Ref } from 'react';

/** The tin wind-up car, drawn once and shared by the game and its cover.
 * Lithographed tin: a cream body with a red stripe and a gold pinline, blue
 * wheels with white hubs, tab seams, a brass key on the side, a little window
 * onto the coiled spring and a brass gauge. Light from the top left.
 *
 * Car space: x to the right (the nose points +x), y DOWN, origin on the
 * ground halfway between the wheels. The car is 96 long. Colour comes only
 * from the maker palette, through var(). */

export const mk = (name: string) => `var(--mk-${name})`;
/** color-mix of two palette names (or one and transparent). */
export const mx = (a: string, b: string, share: number) => `color-mix(in srgb, ${mk(a)} ${share}%, ${b === 'transparent' ? 'transparent' : mk(b)})`;

/** An Archimedean coil for the spring window. `tight` 0 = loose, 1 = wound all the way. */
export function coilPath(tight: number): string {
  const t = Math.max(0, Math.min(1, tight));
  const turns = 2.6 + 2.6 * t, inner = 1.4, outer = 6.4 - 2.2 * t, steps = 72;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const f = i / steps, a = f * turns * Math.PI * 2, r = inner + (outer - inner) * f;
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  }
  return d;
}
/** The gauge needle's turn (degrees) for the turns left in the spring. */
export function gaugeAngle(turns: number, max = 12): number {
  return -115 + 230 * Math.max(0, Math.min(1, turns / max));
}

export interface CarParts {
  body?: Ref<SVGGElement>;
  rear?: Ref<SVGGElement>;
  front?: Ref<SVGGElement>;
  key?: Ref<SVGGElement>;
  coil?: Ref<SVGGElement>;
  coilPath?: Ref<SVGPathElement>;
  needle?: Ref<SVGGElement>;
}

const BODY = 'M-47 -17C-50 -22 -50 -32 -44 -37C-38 -42 -27 -43 -20 -44C-16 -55 -6 -60 6 -58C14 -57 18 -50 20 -44C32 -42 44 -37 49 -29C52 -23 50 -18 46 -16L45.7 -16A16 16 0 0 0 14.3 -16L-14.3 -16A16 16 0 0 0 -45.7 -16Z';
const KEY_BOW = 'M-2.6 -3C-10 -6 -12 -23 0 -23C12 -23 10 -6 2.6 -3L2.6 3C10 6 12 23 0 23C-12 23 -10 6 -2.6 3Z';

function Wheel({ x, part, spin, ids }: { x: number; part?: Ref<SVGGElement>; spin: number; ids: string }) {
  return <g transform={`translate(${x} -13)`}>
    <g ref={part} transform={`rotate(${spin})`}>
      <circle r="13" style={{ fill: `url(#${ids}wheel)` }} />
      <circle r="11.2" style={{ fill: 'none', stroke: mx('indigo', 'water', 55), strokeWidth: 1.2 }} />
      {[0, 90, 180, 270].map(a => <circle key={a} cx={Math.cos(a * Math.PI / 180) * 8.4} cy={Math.sin(a * Math.PI / 180) * 8.4} r="1.5" style={{ fill: mx('sky-pale', 'water', 70) }} />)}
      <circle r="5.6" style={{ fill: `url(#${ids}hub)` }} />
      <path d="M-1.2 -4.2h2.4v8.4h-2.4z" style={{ fill: mx('steel', 'white', 45) }} />
    </g>
    {/* The tin catches the light on the top left, whatever the wheel's turn. */}
    <path d="M-9.6 -6.4A11 11 0 0 1 2 -11" style={{ fill: 'none', stroke: mx('white', 'transparent', 55), strokeWidth: 1.8, strokeLinecap: 'round' }} />
  </g>;
}

export function TinCar({ parts = {}, keyAngle = 20, tight = 0, turns = 0, spin = 0, shadow = true }: { parts?: CarParts; keyAngle?: number; tight?: number; turns?: number; spin?: number; shadow?: boolean }) {
  const ids = useId().replace(/:/g, '');
  return <g className="wr-car">
    <defs>
      <linearGradient id={`${ids}tin`} x1="0" y1="0" x2=".25" y2="1">
        <stop offset="0" style={{ stopColor: mk('white') }} />
        <stop offset=".45" style={{ stopColor: mk('cream') }} />
        <stop offset="1" style={{ stopColor: mx('paper-shade', 'linen-shade', 55) }} />
      </linearGradient>
      <linearGradient id={`${ids}stripe`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: mx('poppy', 'red', 45) }} />
        <stop offset="1" style={{ stopColor: mx('red', 'rust', 70) }} />
      </linearGradient>
      <linearGradient id={`${ids}glass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: mk('sky-pale') }} />
        <stop offset="1" style={{ stopColor: mx('indigo', 'sky', 45) }} />
      </linearGradient>
      <radialGradient id={`${ids}wheel`} cx=".35" cy=".3" r=".8">
        <stop offset="0" style={{ stopColor: mx('sky', 'water', 30) }} />
        <stop offset=".7" style={{ stopColor: mk('water') }} />
        <stop offset="1" style={{ stopColor: mx('indigo', 'water', 70) }} />
      </radialGradient>
      <radialGradient id={`${ids}hub`} cx=".35" cy=".3" r=".8">
        <stop offset="0" style={{ stopColor: mk('white') }} />
        <stop offset="1" style={{ stopColor: mk('chalk') }} />
      </radialGradient>
      <linearGradient id={`${ids}brass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: mk('gold-light') }} />
        <stop offset=".55" style={{ stopColor: mk('gold') }} />
        <stop offset="1" style={{ stopColor: mk('gold-deep') }} />
      </linearGradient>
      <clipPath id={`${ids}clip`}><path d={BODY} /></clipPath>
    </defs>
    {shadow && <ellipse cx="0" cy="0.5" rx="50" ry="3.6" style={{ fill: mx('shadow', 'transparent', 30) }} />}
    {/* The chassis between the wheels, in the body's shadow. */}
    <rect x="-42" y="-18" width="84" height="6" rx="3" style={{ fill: mx('graphite', 'umber', 70) }} />
    <Wheel x={-30} part={parts.rear} spin={spin} ids={ids} />
    <Wheel x={30} part={parts.front} spin={spin} ids={ids} />
    <g ref={parts.body}>
      <path d={BODY} style={{ fill: `url(#${ids}tin)` }} />
      <g clipPath={`url(#${ids}clip)`}>
        {/* The stripe and its gold pinline, printed on the tin. */}
        <path d="M-52 -28C-20 -31 20 -31 54 -27L54 -20C20 -24 -20 -24 -52 -21Z" style={{ fill: `url(#${ids}stripe)` }} />
        <path d="M-52 -29.4C-20 -32.4 20 -32.4 54 -28.4" style={{ fill: 'none', stroke: mk('gold-light'), strokeWidth: 1 }} />
        {/* Lower body in shade, light from the top left. */}
        <path d="M-52 -19C-20 -21 20 -21 54 -18L54 -10L-52 -10Z" style={{ fill: mx('umber', 'transparent', 16) }} />
        {/* The tab seam where the two tin halves meet. */}
        <path d="M-20 -44.5L-20 -26" style={{ stroke: mx('umber', 'transparent', 22), strokeWidth: .8 }} />
        <path d="M-19.2 -44L-19.2 -26" style={{ stroke: mx('white', 'transparent', 60), strokeWidth: .6 }} />
      </g>
      {/* Tabs folded through their slots along the sill. */}
      {[-6, 4].map(x => <rect key={x} x={x} y="-19.2" width="5" height="3.4" rx=".8" style={{ fill: mx('linen-shade', 'umber', 82) }} />)}
      {/* Cockpit glass. */}
      <path d="M-14 -45C-10 -54 -2 -56.5 5 -55.5C11 -54.5 14.5 -50 15.5 -45Z" style={{ fill: `url(#${ids}glass)` }} />
      <path d="M-9 -47.5C-6 -52 -1 -53.6 3 -53.4" style={{ fill: 'none', stroke: mx('white', 'transparent', 75), strokeWidth: 1.4, strokeLinecap: 'round' }} />
      {/* Lamps. */}
      <ellipse cx="46.6" cy="-29" rx="2.2" ry="2.8" style={{ fill: mk('butter') }} />
      <ellipse cx="-47.4" cy="-28" rx="1.6" ry="2.4" style={{ fill: mk('red') }} />
      {/* The spring window: brass rim, the coil inside turns and tightens. */}
      <circle cx="-1" cy="-36" r="7.6" style={{ fill: `url(#${ids}brass)` }} />
      <circle cx="-1" cy="-36" r="6.3" style={{ fill: mx('graphite', 'indigo-deep', 70) }} />
      <g transform="translate(-1 -36)">
        <g ref={parts.coil}>
          <path ref={parts.coilPath} d={coilPath(tight)} style={{ fill: 'none', stroke: mk('gold-light'), strokeWidth: 1.1, strokeLinecap: 'round' }} />
        </g>
      </g>
      <path d="M-5.6 -40.2A6 6 0 0 1 2 -41.6" style={{ fill: 'none', stroke: mx('white', 'transparent', 45), strokeWidth: 1.2, strokeLinecap: 'round' }} />
      {/* The gauge: how much spring is in it. */}
      <circle cx="29" cy="-34.5" r="5.8" style={{ fill: `url(#${ids}brass)` }} />
      <circle cx="29" cy="-34.5" r="4.6" style={{ fill: mk('white') }} />
      <path d="M25.2 -32.2A4.4 4.4 0 0 1 32.8 -32.2" style={{ fill: 'none', stroke: mx('gold', 'transparent', 70), strokeWidth: .7, strokeDasharray: '.7 1.1' }} />
      <g transform="translate(29 -34.5)">
        <g ref={parts.needle} transform={`rotate(${gaugeAngle(turns)})`}>
          <path d="M-.55 0L0 -4L.55 0Z" style={{ fill: mk('red') }} />
        </g>
        <circle r="1" style={{ fill: mk('graphite') }} />
      </g>
      {/* The gloss along the roof line. */}
      <path d="M-42 -38.6C-34 -41.4 -26 -42 -20.5 -43" style={{ fill: 'none', stroke: mx('white', 'transparent', 85), strokeWidth: 1.6, strokeLinecap: 'round' }} />
      <path d="M22 -42.2C30 -41 38 -38 44 -33.4" style={{ fill: 'none', stroke: mx('white', 'transparent', 70), strokeWidth: 1.3, strokeLinecap: 'round' }} />
      {/* The key, on the side at the back: it turns in the picture's own plane. */}
      <g transform="translate(-33 -33) scale(1.2)">
        <circle r="4.6" style={{ fill: mx('gold-deep', 'umber', 70) }} />
        <g ref={parts.key} transform={`rotate(${keyAngle})`}>
          <path d={KEY_BOW} transform="translate(.8 1.2)" style={{ fill: mx('shadow', 'transparent', 22) }} />
          <path d={KEY_BOW} style={{ fill: `url(#${ids}brass)` }} />
          <circle cy="-14" r="3.2" style={{ fill: mx('gold-deep', 'umber', 60) }} />
          <circle cy="14" r="3.2" style={{ fill: mx('gold-deep', 'umber', 60) }} />
          <path d="M-6.5 -16C-6 -19.5 -3.2 -21 -.6 -21" style={{ fill: 'none', stroke: mx('white', 'transparent', 70), strokeWidth: 1.2, strokeLinecap: 'round' }} />
        </g>
        <circle r="3.3" style={{ fill: `url(#${ids}brass)` }} />
        <circle cx="-.9" cy="-.9" r="1" style={{ fill: mx('white', 'transparent', 70) }} />
      </g>
    </g>
  </g>;
}
