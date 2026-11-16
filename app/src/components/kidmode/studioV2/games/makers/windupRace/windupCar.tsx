import { useId, type Ref } from 'react';
import { MAX_CLICKS } from './windupRaceRules';
import { KEY_ART, ROVER_ART, ROVER_IS_TOP_VIEW } from './windupKit';

/** Rover, the kit's knit-and-felt toy car, wearing a brass wind-up key.
 *
 * Car space: x to the right (the nose points +x), y DOWN, origin on the floor
 * halfway between the wheels; the car is about 100 long. The camera looks
 * side-on from a little above, so things lying flat are foreshortened by TILT.
 * Rover is the kit picture; the key, its spring, the lamps' glow and the
 * shadow are drawn here in brass and light. Colour only from the maker
 * palette, through var(). */

export const mk = (name: string) => `var(--mk-${name})`;
/** color-mix of two palette names (or one and transparent). */
export const mx = (a: string, b: string, share: number) => `color-mix(in srgb, ${mk(a)} ${share}%, ${b === 'transparent' ? 'transparent' : mk(b)})`;

/** How much a thing lying on the floor is foreshortened (sin of the camera's 30°). */
export const TILT = 0.5;
/** Rover's roof above the floor, and the key's bow centre (car space). */
export const ROOF = 31;
export const KEY_AT = { x: -7, y: -(ROOF + 27) } as const;
/** The path a finger takes round the key: an ellipse this wide and TILT as high. */
export const ORBIT = 36;

/** The spring round the key's stem: more turns, packed tighter, as it is wound.
 * `tight` 0 = loose, 1 = wound all the way. Drawn from the bow (y 9) to the roof (y 25). */
export function coilPath(tight: number): string {
  const t = Math.max(0, Math.min(1, tight));
  const turns = 2.5 + 4.5 * t, top = 9 + 5 * t, bottom = 25, radius = 7.2 - 1.6 * t, steps = Math.round(18 * turns);
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const f = i / steps, a = f * turns * Math.PI * 2;
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * radius).toFixed(2)} ${(top + (bottom - top) * f + Math.sin(a) * radius * 0.3).toFixed(2)}`;
  }
  return d;
}
/** The bow's width for the key's turn (degrees): it spins about its upright
 * stem, so side-on it narrows to its edge and opens again twice a turn. */
export function bowWidth(angle: number): number {
  const c = Math.cos(angle * Math.PI / 180);
  return Math.abs(c) < 0.14 ? (c < 0 ? -0.14 : 0.14) : c;
}

export interface CarParts {
  /** Tilts, squashes and trembles (everything but the shadow). */
  body?: Ref<SVGGElement>;
  /** The bow: scaled across by `bowWidth`. */
  key?: Ref<SVGGElement>;
  coilPath?: Ref<SVGPathElement>;
  /** The lamps' glow (opacity). */
  lamps?: Ref<SVGGElement>;
  /** The horn's rings ahead of the nose. */
  honk?: Ref<SVGGElement>;
  shadow?: Ref<SVGEllipseElement>;
}

const BOW = 'M0 -3.4C-5.5 -14.5 -19.5 -13 -19.5 0C-19.5 13 -5.5 14.5 0 3.4C5.5 14.5 19.5 13 19.5 0C19.5 -13 5.5 -14.5 0 -3.4Z';

/** The brass key on Rover's roof: base plate, stem with the spring round it, the bow on top. */
function WindKey({ parts, ids, angle, tight }: { parts: CarParts; ids: string; angle: number; tight: number }) {
  return <g transform={`translate(${KEY_AT.x} ${KEY_AT.y})`}>
    <ellipse cx="0" cy="26.5" rx="11" ry="4.6" style={{ fill: mx('shadow', 'transparent', 22) }} />
    <ellipse cx="0" cy="25.4" rx="9.6" ry="4" style={{ fill: `url(#${ids}brass)` }} />
    <ellipse cx="-2" cy="24.4" rx="5" ry="1.5" style={{ fill: mx('white', 'transparent', 55) }} />
    <rect x="-2.6" y="6" width="5.2" height="19.6" rx="2.2" style={{ fill: `url(#${ids}stem)` }} />
    <path ref={parts.coilPath} d={coilPath(tight)} style={{ fill: 'none', stroke: `url(#${ids}brass)`, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <g ref={parts.key} transform={`scale(${bowWidth(angle).toFixed(3)} 1)`}>
      {KEY_ART
        ? <image href={KEY_ART} x="-21" y="-16" width="42" height="34" preserveAspectRatio="xMidYMid meet" />
        : <>
          <path d={BOW} transform="translate(1.2 1.6)" style={{ fill: mx('shadow', 'transparent', 26) }} />
          <path d={BOW} style={{ fill: `url(#${ids}brass)` }} />
          <path d={BOW} style={{ fill: 'none', stroke: mx('gold-deep', 'transparent', 70), strokeWidth: .8 }} />
          {[-10.4, 10.4].map(x => <g key={x}>
            <ellipse cx={x} cy="0" rx="5" ry="6.2" style={{ fill: mx('gold-deep', 'umber', 62) }} />
            <ellipse cx={x + .7} cy=".9" rx="4" ry="5.2" style={{ fill: mx('linen', 'white', 45) }} />
          </g>)}
          <path d="M-16.5 -4.5C-15.5 -9.5 -11 -11.6 -6.4 -10.4" style={{ fill: 'none', stroke: mx('white', 'transparent', 80), strokeWidth: 1.7, strokeLinecap: 'round' }} />
          <path d="M5.2 -9.6C9.5 -11.8 14.6 -10 16.6 -5.4" style={{ fill: 'none', stroke: mx('white', 'transparent', 55), strokeWidth: 1.3, strokeLinecap: 'round' }} />
        </>}
    </g>
    <circle cx="0" cy="5" r="3.4" style={{ fill: `url(#${ids}brass)` }} />
    <circle cx="-1" cy="4" r="1.1" style={{ fill: mx('white', 'transparent', 75) }} />
  </g>;
}

export function RoverCar({ parts = {}, keyAngle = 24, tight = 0, shadow = true }: { parts?: CarParts; keyAngle?: number; tight?: number; shadow?: boolean }) {
  const ids = useId().replace(/:/g, '');
  // The shipped Rover is seen from straight above, nose up, 266 by 300. Laid
  // nose-right it is 100 long and 88.7 deep; the camera foreshortens the depth.
  const deep = 88.7, long = 100;
  const top = (drop: number, shade?: number) => <g transform={`translate(0 ${-ROOF + drop}) scale(1 ${TILT}) rotate(90)`} style={shade ? { filter: `brightness(${shade}) saturate(1.08)` } : undefined}>
    <image href={ROVER_ART} x={-deep / 2} y={-long / 2} width={deep} height={long} preserveAspectRatio="none" />
  </g>;
  return <g className="wr-car">
    <defs>
      <linearGradient id={`${ids}brass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: mk('gold-light') }} />
        <stop offset=".5" style={{ stopColor: mk('gold') }} />
        <stop offset="1" style={{ stopColor: mk('gold-deep') }} />
      </linearGradient>
      <linearGradient id={`${ids}stem`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" style={{ stopColor: mk('gold-deep') }} />
        <stop offset=".4" style={{ stopColor: mk('gold-light') }} />
        <stop offset="1" style={{ stopColor: mk('gold-deep') }} />
      </linearGradient>
      <radialGradient id={`${ids}shade`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: mx('shadow', 'transparent', 34) }} />
        <stop offset=".6" style={{ stopColor: mx('shadow', 'transparent', 20) }} />
        <stop offset="1" style={{ stopColor: mx('shadow', 'transparent', 0) }} />
      </radialGradient>
      <radialGradient id={`${ids}glow`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: mx('white', 'transparent', 95) }} />
        <stop offset=".35" style={{ stopColor: mx('sun', 'transparent', 70) }} />
        <stop offset="1" style={{ stopColor: mx('sun', 'transparent', 0) }} />
      </radialGradient>
    </defs>
    {shadow && <ellipse ref={parts.shadow} cx="3" cy="5" rx="62" ry="27" style={{ fill: `url(#${ids}shade)` }} />}
    <g ref={parts.body}>
      {ROVER_IS_TOP_VIEW
        ? <>
          {/* The knit body's near side, drawn as the roof picture stepped down to the floor in shade. */}
          {top(25, .62)}{top(18, .7)}{top(11, .78)}{top(5, .88)}{top(0)}
        </>
        : <image href={ROVER_ART} x="-56" y="-74" width="112" height="78" preserveAspectRatio="xMidYMax meet" />}
      {/* The lamps light when the horn sounds. */}
      <g ref={parts.lamps} style={{ opacity: 0 }}>
        <ellipse cx="47" cy={-ROOF - 9} rx="13" ry="8" style={{ fill: `url(#${ids}glow)` }} />
        <ellipse cx="47" cy={-ROOF + 9} rx="13" ry="8" style={{ fill: `url(#${ids}glow)` }} />
      </g>
      <WindKey parts={parts} ids={ids} angle={keyAngle} tight={tight} />
    </g>
    <g ref={parts.honk} style={{ opacity: 0 }} transform="translate(60 -30)">
      {[0, 1, 2].map(i => <path key={i} d={`M${8 + i * 10} ${-9 - i * 5}Q${15 + i * 12} 0 ${8 + i * 10} ${9 + i * 5}`} style={{ fill: 'none', stroke: mx('gold', 'transparent', 85 - i * 18), strokeWidth: 3.4 - i * .5, strokeLinecap: 'round' }} />)}
    </g>
  </g>;
}

/** The dial round the key: twelve marks on the finger's path, one per click.
 * Interface, not scenery: its colours come from the Studio tokens (CSS). */
export function KeyDial({ clicks }: { clicks: number }) {
  return <g className="wr-dial" transform={`translate(${KEY_AT.x} ${KEY_AT.y})`} aria-hidden="true">
    <ellipse className="wr-dial__path" cx="0" cy="0" rx={ORBIT} ry={ORBIT * TILT} />
    {Array.from({ length: MAX_CLICKS }, (_, i) => {
      const a = (i / MAX_CLICKS) * Math.PI * 2 - Math.PI / 2, x = Math.cos(a) * ORBIT, y = Math.sin(a) * ORBIT * TILT;
      return <circle key={i} className="wr-dial__mark" data-on={i < clicks} data-next={i === clicks} cx={x.toFixed(1)} cy={y.toFixed(1)} r={i < clicks ? 2.6 : 1.8} />;
    })}
    <path className="wr-dial__arrow" d={`M${ORBIT + 5} -3l4.4 7.6l-8.4 .8z`} />
  </g>;
}
