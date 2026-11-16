import { useId, type Ref } from 'react';
import { MAX_CLICKS } from './windupRaceRules';
import { ROVER_ART, ROVER_FRAME } from './windupKit';

/** Rover, the kit's toy car, wearing a brass wind-up key on its start button.
 *
 * Car space: x to the right (the nose points +x), y DOWN, origin on the floor
 * under the middle of the car. Rover is the kit's own render (three-quarter
 * side view); the key, its spring, the glow of its eyes and its shadow are
 * drawn here in brass and light. Colour only from the maker palette. */

export const mk = (name: string) => `var(--mk-${name})`;
/** color-mix of two palette names (or one and transparent). */
export const mx = (a: string, b: string, share: number) => `color-mix(in srgb, ${mk(a)} ${share}%, ${b === 'transparent' ? 'transparent' : mk(b)})`;

/** How much a thing lying on the floor is foreshortened by the camera. */
export const TILT = 0.36;
/** Rover is drawn this long (table units; the rules' car is 96 nose to tail). */
export const ROVER_LONG = 106;
const PX = ROVER_LONG / ROVER_FRAME.w;
const carX = (px: number) => (px - ROVER_FRAME.footX) * PX, carY = (px: number) => (px - ROVER_FRAME.footY) * PX;
/** The top of Rover's start button, where the key stands, and the bow's centre above it. */
export const BUTTON_AT = { x: carX(ROVER_FRAME.buttonX), y: carY(ROVER_FRAME.buttonY) } as const;
export const KEY_AT = { x: BUTTON_AT.x, y: BUTTON_AT.y - 27 } as const;
/** The finger's path round the key (the dial), table units. */
export const ORBIT = 38;

/** The spring round the key's stem: more turns, packed tighter, as it is wound.
 * `tight` 0 = loose, 1 = wound all the way. Drawn from under the bow (y 9) to the button (y 26). */
export function coilPath(tight: number): string {
  const t = Math.max(0, Math.min(1, tight));
  const turns = 2.5 + 4.5 * t, top = 9 + 4 * t, bottom = 26, radius = 7.4 - 1.8 * t, steps = Math.round(18 * turns);
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const f = i / steps, a = f * turns * Math.PI * 2;
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * radius).toFixed(2)} ${(top + (bottom - top) * f + Math.sin(a) * radius * 0.3).toFixed(2)}`;
  }
  return d;
}
/** The bow's width for the key's turn (degrees): it spins about its upright
 * stem, so from the side it narrows to its edge and opens again twice a turn. */
export function bowWidth(angle: number): number {
  const c = Math.cos(angle * Math.PI / 180);
  return Math.abs(c) < 0.16 ? (c < 0 ? -0.16 : 0.16) : c;
}

export interface CarParts {
  /** Tilts, squashes and trembles (everything but the shadow). */
  body?: Ref<SVGGElement>;
  /** The bow: scaled across by `bowWidth`. */
  key?: Ref<SVGGElement>;
  coilPath?: Ref<SVGPathElement>;
  /** The glow of Rover's eyes (opacity). */
  lamps?: Ref<SVGGElement>;
  /** The horn's rings ahead of the nose. */
  honk?: Ref<SVGGElement>;
  shadow?: Ref<SVGEllipseElement>;
}

const BOW = 'M0 -3.4C-5.5 -14.5 -19.5 -13 -19.5 0C-19.5 13 -5.5 14.5 0 3.4C5.5 14.5 19.5 13 19.5 0C19.5 -13 5.5 -14.5 0 -3.4Z';

/** The brass key: a collar on the start button, the stem with the spring round it, the bow on top. */
function WindKey({ parts, ids, angle, tight }: { parts: CarParts; ids: string; angle: number; tight: number }) {
  return <g transform={`translate(${KEY_AT.x.toFixed(2)} ${KEY_AT.y.toFixed(2)})`}>
    <ellipse cx="0" cy="27.4" rx="12" ry="4.4" style={{ fill: mx('shadow', 'transparent', 26) }} />
    <ellipse cx="0" cy="26" rx="10.4" ry="3.9" style={{ fill: `url(#${ids}brass)` }} />
    <ellipse cx="-2.4" cy="25" rx="5" ry="1.4" style={{ fill: mx('white', 'transparent', 60) }} />
    <rect x="-2.7" y="6" width="5.4" height="20.4" rx="2.3" style={{ fill: `url(#${ids}stem)` }} />
    <path ref={parts.coilPath} d={coilPath(tight)} style={{ fill: 'none', stroke: `url(#${ids}brass)`, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <g ref={parts.key} transform={`scale(${bowWidth(angle).toFixed(3)} 1)`}>
      <path d={BOW} transform="translate(1.4 1.8)" style={{ fill: mx('shadow', 'transparent', 24) }} />
      <path d={BOW} style={{ fill: `url(#${ids}brass)` }} />
      <path d={BOW} style={{ fill: 'none', stroke: mx('gold-deep', 'transparent', 75), strokeWidth: .9 }} />
      {[-10.4, 10.4].map(x => <g key={x}>
        <ellipse cx={x} cy="0" rx="5" ry="6.2" style={{ fill: mx('gold-deep', 'umber', 62) }} />
        <ellipse cx={x + .8} cy="1" rx="3.9" ry="5.1" style={{ fill: mx('snow', 'steel-light', 60) }} />
      </g>)}
      <path d="M-16.5 -4.5C-15.5 -9.5 -11 -11.6 -6.4 -10.4" style={{ fill: 'none', stroke: mx('white', 'transparent', 85), strokeWidth: 1.8, strokeLinecap: 'round' }} />
      <path d="M5.2 -9.6C9.5 -11.8 14.6 -10 16.6 -5.4" style={{ fill: 'none', stroke: mx('white', 'transparent', 55), strokeWidth: 1.3, strokeLinecap: 'round' }} />
    </g>
    <circle cx="0" cy="5" r="3.5" style={{ fill: `url(#${ids}brass)` }} />
    <circle cx="-1" cy="4" r="1.1" style={{ fill: mx('white', 'transparent', 80) }} />
  </g>;
}

export function RoverCar({ parts = {}, keyAngle = 24, tight = 0, shadow = true }: { parts?: CarParts; keyAngle?: number; tight?: number; shadow?: boolean }) {
  const ids = useId().replace(/:/g, '');
  const stop = (offset: string, colour: string) => <stop offset={offset} style={{ stopColor: colour }} />;
  return <g className="wr-car">
    <defs>
      <linearGradient id={`${ids}brass`} x1="0" y1="0" x2="1" y2="1">{stop('0', mk('gold-light'))}{stop('.5', mk('gold'))}{stop('1', mk('gold-deep'))}</linearGradient>
      <linearGradient id={`${ids}stem`} x1="0" y1="0" x2="1" y2="0">{stop('0', mk('gold-deep'))}{stop('.4', mk('gold-light'))}{stop('1', mk('gold-deep'))}</linearGradient>
      <radialGradient id={`${ids}shade`} cx=".5" cy=".5" r=".5">{stop('0', mx('shadow', 'transparent', 42))}{stop('.55', mx('shadow', 'transparent', 24))}{stop('1', mx('shadow', 'transparent', 0))}</radialGradient>
      <radialGradient id={`${ids}glow`} cx=".5" cy=".5" r=".5">{stop('0', mx('white', 'transparent', 96))}{stop('.3', mx('sun', 'transparent', 75))}{stop('1', mx('amber', 'transparent', 0))}</radialGradient>
    </defs>
    {shadow && <ellipse ref={parts.shadow} cx="2" cy="-1.5" rx="60" ry="15" style={{ fill: `url(#${ids}shade)` }} />}
    <g ref={parts.body}>
      <image href={ROVER_ART} x={carX(0)} y={carY(0)} width={ROVER_LONG} height={ROVER_FRAME.h * PX} preserveAspectRatio="none" />
      {/* Rover's eyes shine when the horn sounds. */}
      <g ref={parts.lamps} style={{ opacity: 0 }}>
        {ROVER_FRAME.eyes.map(([x, y]) => <ellipse key={x} cx={carX(x)} cy={carY(y)} rx="10" ry="9" style={{ fill: `url(#${ids}glow)` }} />)}
      </g>
      <WindKey parts={parts} ids={ids} angle={keyAngle} tight={tight} />
    </g>
    <g ref={parts.honk} style={{ opacity: 0 }} transform="translate(54 -36)">
      {[0, 1, 2].map(i => <path key={i} d={`M${6 + i * 10} ${-9 - i * 5}Q${13 + i * 12} 0 ${6 + i * 10} ${9 + i * 5}`} style={{ fill: 'none', stroke: mx('amber', 'transparent', 90 - i * 20), strokeWidth: 3.6 - i * .5, strokeLinecap: 'round' }} />)}
    </g>
  </g>;
}

/** The dial round the key: twelve marks on the finger's path, one per click.
 * Interface, not scenery: its colours come from the Studio tokens (CSS). */
export function KeyDial({ clicks }: { clicks: number }) {
  return <g className="wr-dial" transform={`translate(${KEY_AT.x.toFixed(2)} ${KEY_AT.y.toFixed(2)})`} aria-hidden="true">
    <circle className="wr-dial__path" cx="0" cy="0" r={ORBIT} />
    {Array.from({ length: MAX_CLICKS }, (_, i) => {
      const a = (i / MAX_CLICKS) * Math.PI * 2 - Math.PI / 2;
      return <circle key={i} className="wr-dial__mark" data-on={i < clicks} data-next={i === clicks} cx={(Math.cos(a) * ORBIT).toFixed(1)} cy={(Math.sin(a) * ORBIT).toFixed(1)} r={i < clicks ? 3.1 : 2.1} />;
    })}
  </g>;
}
