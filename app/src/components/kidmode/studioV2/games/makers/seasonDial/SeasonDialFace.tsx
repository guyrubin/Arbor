import { memo, useId } from 'react';
import { isLit, turnsToAngle, type Season } from './seasonDialRules';

/** The Weather Maker's dial: brass and enamel. The face (four illustrated
 * quarters, ticks, the four badges) stays put; the knurled rim and the brass
 * pointer turn together. Drawn in units of a 260 box around the centre. The
 * dial is a physical object: it never mirrors in Hebrew. */

/** The enamel of each quarter (spring, summer, autumn, winter). */
export const QUARTER_FILL = [
  'color-mix(in srgb, var(--mk-blossom), var(--mk-white) 35%)',
  'color-mix(in srgb, var(--mk-butter), var(--mk-sky-pale) 30%)',
  'color-mix(in srgb, var(--mk-clay-pale), var(--mk-amber) 30%)',
  'color-mix(in srgb, var(--mk-sky-pale), var(--mk-lilac) 35%)',
] as const;
const QUARTER_DEEP = ['var(--mk-rose)', 'var(--mk-sun)', 'var(--mk-orange)', 'var(--mk-bluebell)'] as const;

const polar = (r: number, deg: number) => [r * Math.sin((deg * Math.PI) / 180), -r * Math.cos((deg * Math.PI) / 180)] as const;
const f1 = (v: number) => v.toFixed(1);

/** The four seasons' little enamel pictures, centred on 0,0, about 44 across. */
export function SeasonArt({ season }: { season: Season }) {
  if (season === 0) return <g>
    <path d="M-4 12C-10 13-15 10-17 5C-11 4-6 6-4 12Z" style={{ fill: 'var(--mk-leaf)' }} />
    <path d="M5 13C10 16 16 14 18 10C13 8 8 9 5 13Z" style={{ fill: 'var(--mk-spring)' }} />
    {[0, 72, 144, 216, 288].map(a => <g key={a} transform={`rotate(${a})`}>
      <path d="M0-2C-7-6-8-15-2-17C0-16 1-16 2-17C8-15 7-6 0-2Z" style={{ fill: 'var(--mk-blossom)' }} />
      <path d="M0-4C-3-7-3-11-1-13" style={{ fill: 'none', stroke: 'var(--mk-rose)', strokeWidth: 1.4, strokeLinecap: 'round', opacity: 0.7 }} />
    </g>)}
    <circle r="4.6" style={{ fill: 'var(--mk-amber)' }} />
    {[0, 60, 120, 180, 240, 300].map(a => { const [x, y] = polar(6.6, a); return <circle key={a} cx={f1(x)} cy={f1(y)} r="1.2" style={{ fill: 'var(--mk-rose-deep)' }} />; })}
    <circle cx="-1.4" cy="-1.4" r="1.5" style={{ fill: 'var(--mk-butter)' }} />
  </g>;
  if (season === 1) return <g>
    {Array.from({ length: 10 }, (_, i) => <path key={i} transform={`rotate(${i * 36})`} d="M-3.4-13L0-21L3.4-13Z" style={{ fill: i % 2 ? 'var(--mk-amber)' : 'var(--mk-orange)', stroke: i % 2 ? 'var(--mk-amber)' : 'var(--mk-orange)', strokeWidth: 2, strokeLinejoin: 'round' }} />)}
    <circle r="12.5" style={{ fill: 'var(--mk-amber)' }} />
    <circle r="10.5" style={{ fill: 'var(--mk-sun)' }} />
    <circle cx="-3.6" cy="-3.8" r="4.2" style={{ fill: 'var(--mk-butter)' }} />
  </g>;
  if (season === 2) return <g transform="rotate(-28)">
    <path d="M0 19L0 14" style={{ stroke: 'var(--mk-umber)', strokeWidth: 2.4, strokeLinecap: 'round' }} />
    <path d="M0 15C-6 15-12 11-13 5C-16 3-17-2-14-5C-14-11-9-16-4-16C-3-19 3-19 4-16C9-16 14-11 14-5C17-2 16 3 13 5C12 11 6 15 0 15Z" style={{ fill: 'var(--mk-orange)' }} />
    <path d="M0 15C6 15 12 11 13 5C16 3 17-2 14-5C14-11 9-16 4-16C3-19 0-19 0-19Z" style={{ fill: 'var(--mk-red)', opacity: 0.55 }} />
    <path d="M0 14L0-15M0 6L-8-2M0 6L8-2M0-3L-6-10M0-3L6-10" style={{ fill: 'none', stroke: 'var(--mk-butter)', strokeWidth: 1.5, strokeLinecap: 'round', opacity: 0.85 }} />
  </g>;
  return <g>
    {[0, 60, 120, 180, 240, 300].map(a => <g key={a} transform={`rotate(${a})`}>
      <path d="M0 0L0-18M0-8L-5-12.5M0-8L5-12.5M0-13L-3.4-16.4M0-13L3.4-16.4" style={{ fill: 'none', stroke: 'var(--mk-bluebell)', strokeWidth: 3.4, strokeLinecap: 'round' }} />
      <path d="M0 0L0-18M0-8L-5-12.5M0-8L5-12.5M0-13L-3.4-16.4M0-13L3.4-16.4" style={{ fill: 'none', stroke: 'var(--mk-white)', strokeWidth: 1.3, strokeLinecap: 'round' }} />
    </g>)}
    <circle r="3.4" style={{ fill: 'var(--mk-white)', stroke: 'var(--mk-bluebell)', strokeWidth: 1.4 }} />
  </g>;
}

function Face({ lit, glow }: { lit: number; glow: boolean }) {
  const id = useId().replace(/:/g, '');
  const ticks = [];
  for (let i = 0; i < 24; i++) {
    const deg = i * 15;
    if (deg % 90 === 45) continue; // the badges sit there
    const major = deg % 90 === 0;
    const [x1, y1] = polar(major ? 84 : 90, deg), [x2, y2] = polar(99, deg);
    ticks.push(<line key={i} x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} style={{ stroke: 'var(--mk-gold-deep)', strokeWidth: major ? 3 : 1.8, strokeLinecap: 'round', opacity: major ? 0.8 : 0.5 }} />);
  }
  return <g>
    <defs>
      <radialGradient id={`${id}glaze`} cx=".3" cy=".25" r=".9">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.55 }} />
        <stop offset=".45" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.16 }} />
      </radialGradient>
      <linearGradient id={`${id}bezel`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--mk-gold-light)' }} />
        <stop offset=".5" style={{ stopColor: 'var(--mk-brass)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-gold-deep)' }} />
      </linearGradient>
    </defs>
    <circle r="112" fill={`url(#${id}bezel)`} />
    <circle r="105.5" style={{ fill: 'var(--mk-gold-deep)' }} />
    {[0, 1, 2, 3].map(q => {
      const [x1, y1] = polar(104, q * 90), [x2, y2] = polar(104, q * 90 + 90);
      return <path key={q} d={`M0 0L${f1(x1)} ${f1(y1)}A104 104 0 0 1 ${f1(x2)} ${f1(y2)}Z`} style={{ fill: QUARTER_FILL[q] }} />;
    })}
    <path d="M0-104V104M-104 0H104" style={{ stroke: 'var(--mk-gold)', strokeWidth: 2, opacity: 0.7 }} />
    {ticks}
    {[0, 1, 2, 3].map(q => {
      const [x, y] = polar(56, q * 90 + 45);
      return <g key={q} transform={`translate(${f1(x)} ${f1(y)}) scale(.92)`}><SeasonArt season={q as Season} /></g>;
    })}
    {/* The four badges: dim enamel until the dial has rested in that season. */}
    {[0, 1, 2, 3].map(q => {
      const [x, y] = polar(90, q * 90 + 45), on = isLit(lit, q as Season);
      return <g key={q} transform={`translate(${f1(x)} ${f1(y)})`} className="sd-badge" data-lit={on} data-season={q}>
        {on && <circle r="16" className="sd-badge__glow" style={{ fill: 'var(--mk-gold-light)', opacity: glow ? 0.75 : 0.45 }} />}
        <circle r="10" style={{ fill: on ? 'var(--mk-gold)' : 'color-mix(in srgb, var(--mk-gold-deep), var(--mk-shadow) 30%)' }} />
        <circle r="7.4" style={{ fill: on ? QUARTER_DEEP[q] : 'color-mix(in srgb, var(--mk-paper-shade), var(--mk-shadow) 22%)' }} />
        {on ? <circle cx="-2.4" cy="-2.6" r="2.4" style={{ fill: 'var(--mk-white)', opacity: 0.75 }} />
          : <circle cx="1.2" cy="1.4" r="5.6" style={{ fill: 'var(--mk-shadow)', opacity: 0.12 }} />}
      </g>;
    })}
    <circle r="104" fill={`url(#${id}glaze)`} />
  </g>;
}
const DialFaceArt = memo(Face);

/** The turning parts: the knurled rim and the pointer, at `turns` (unwrapped). */
function Turning({ turns }: { turns: number }) {
  const id = useId().replace(/:/g, '');
  const angle = turnsToAngle(turns);
  return <>
    <defs>
      <linearGradient id={`${id}rim`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--mk-gold-light)' }} />
        <stop offset=".55" style={{ stopColor: 'var(--mk-gold)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-gold-deep)' }} />
      </linearGradient>
      <linearGradient id={`${id}needle`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" style={{ stopColor: 'var(--mk-gold-light)' }} />
        <stop offset=".5" style={{ stopColor: 'var(--mk-gold)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-gold-deep)' }} />
      </linearGradient>
      <radialGradient id={`${id}hub`} cx=".35" cy=".3" r=".8">
        <stop offset="0" style={{ stopColor: 'var(--mk-butter)' }} />
        <stop offset=".5" style={{ stopColor: 'var(--mk-gold)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-gold-deep)' }} />
      </radialGradient>
    </defs>
    {/* The rim: it turns with the pointer; its knurls show every bit of turn. The light stays top-left. */}
    <g transform={`rotate(${angle.toFixed(2)})`}>
      <path d="M0-128A128 128 0 1 1 0 128A128 128 0 1 1 0-128ZM0-113A113 113 0 1 0 0 113A113 113 0 1 0 0-113Z" style={{ fill: 'var(--mk-gold)' }} />
      {Array.from({ length: 64 }, (_, i) => <rect key={i} x="-2.1" y="-128" width="4.2" height="11" rx="2" transform={`rotate(${i * 5.625})`} style={{ fill: i % 2 ? 'var(--mk-gold-deep)' : 'var(--mk-gold-light)', opacity: i % 2 ? 0.55 : 0.6 }} />)}
    </g>
    <path d="M0-128A128 128 0 1 1 0 128A128 128 0 1 1 0-128ZM0-113A113 113 0 1 0 0 113A113 113 0 1 0 0-113Z" fill={`url(#${id}rim)`} style={{ opacity: 0.55, pointerEvents: 'none' }} />
    {/* The pointer's soft shadow falls down and to the right. */}
    <g transform={`translate(3 4) rotate(${angle.toFixed(2)})`} style={{ opacity: 0.22 }}>
      <path d="M-5.5 18L-3.2-80L0-100L3.2-80L5.5 18Z" style={{ fill: 'var(--mk-shadow)' }} />
      <circle cy="22" r="11" style={{ fill: 'var(--mk-shadow)' }} />
    </g>
    <g transform={`rotate(${angle.toFixed(2)})`}>
      <path d="M-5.5 18L-3.2-80L0-100L3.2-80L5.5 18Z" fill={`url(#${id}needle)`} />
      <path d="M0-98L0 14" style={{ stroke: 'var(--mk-gold-light)', strokeWidth: 1, opacity: 0.8 }} />
      <circle cy="-72" r="4.2" style={{ fill: 'var(--mk-red)' }} />
      <circle cx="-1.2" cy="-73.4" r="1.4" style={{ fill: 'var(--mk-white)', opacity: 0.6 }} />
      <circle cy="22" r="10" fill={`url(#${id}needle)`} />
      <circle cy="22" r="5" style={{ fill: 'var(--mk-gold-deep)' }} />
    </g>
    <circle r="17" fill={`url(#${id}hub)`} />
    <circle r="17" style={{ fill: 'none', stroke: 'var(--mk-gold-deep)', strokeWidth: 1.6 }} />
    <path d="M-7-7L7 7" transform={`rotate(${(angle * 0.5).toFixed(1)})`} style={{ stroke: 'var(--mk-gold-deep)', strokeWidth: 2.6, strokeLinecap: 'round' }} />
  </>;
}

/** The whole dial art, filling its box. */
export function DialArt({ turns, lit, glow }: { turns: number; lit: number; glow: boolean }) {
  return <svg className="sd-dial__art" viewBox="-140 -140 280 280" aria-hidden="true" focusable="false">
    <ellipse cx="8" cy="14" rx="130" ry="128" style={{ fill: 'var(--mk-shadow)', opacity: 0.18 }} />
    <ellipse cx="4" cy="7" rx="130" ry="129" style={{ fill: 'var(--mk-shadow)', opacity: 0.14 }} />
    <DialFaceArt lit={lit} glow={glow} />
    <Turning turns={turns} />
  </svg>;
}
