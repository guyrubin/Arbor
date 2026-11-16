import { useId } from 'react';
import { FRIEND_PICTURES, SEASON_VIEWS } from './seasonDialKit';

/** Weather Maker cover: Horizon Valley from the Sky Gardens terrace, seen
 * through the brass dial with its four quarters in the four seasons (spring
 * top right, summer bottom right, autumn bottom left, winter top left, as on
 * the dial). The four quarters are the kit's own terrace view at its four
 * seasons, laid pixel over pixel, so the valley runs unbroken across them.
 * Aya stands by the rim. Fills its box; one clear subject, so it reads at
 * 80px. Kept apart from the game code (its own chunk): it imports only the
 * picture constants. */
const view = (id: string, large: boolean) => { const v = SEASON_VIEWS.find(s => s.id === id) ?? SEASON_VIEWS[0]; return large ? v.picture.src : v.picture.src480 ?? v.picture.src; };
const QUARTERS = [
  { id: 'view-spring', x: 200, y: 0 }, { id: 'view-summer', x: 200, y: 150 }, { id: 'view-autumn', x: 0, y: 150 }, { id: 'view-winter', x: 0, y: 0 },
] as const;

export default function SeasonDialCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--mk-sky-pale)' }} />
        <stop offset=".62" style={{ stopColor: 'var(--mk-snow)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-chalk)' }} />
      </linearGradient>
      <linearGradient id={`${id}rim`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--mk-gold-light)' }} />
        <stop offset=".55" style={{ stopColor: 'var(--mk-gold)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-gold-deep)' }} />
      </linearGradient>
      <radialGradient id={`${id}glaze`} cx=".3" cy=".22" r=".85">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.3 }} />
        <stop offset=".5" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.16 }} />
      </radialGradient>
      <radialGradient id={`${id}shade`}>
        <stop offset=".7" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.34 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
      </radialGradient>
      <clipPath id={`${id}disc`}><circle cx="200" cy="150" r="118" /></clipPath>
      {QUARTERS.map(q => <clipPath key={q.id} id={`${id}${q.id}`}><rect x={q.x} y={q.y} width="200" height="150" /></clipPath>)}
    </defs>
    <rect width="400" height="300" fill={`url(#${id}bg)`} />
    <circle cx="207" cy="160" r="160" fill={`url(#${id}shade)`} />
    <circle cx="200" cy="150" r="142" fill={`url(#${id}rim)`} />
    {Array.from({ length: 60 }, (_, i) => <rect key={i} x="198.4" y="8" width="3.2" height="12" rx="1.6" transform={`rotate(${i * 6} 200 150)`} style={{ fill: i % 2 ? 'var(--mk-gold-deep)' : 'var(--mk-gold-light)', opacity: 0.58 }} />)}
    <circle cx="200" cy="150" r="123" style={{ fill: 'var(--mk-gold-deep)' }} />
    <g clipPath={`url(#${id}disc)`}>
      {QUARTERS.map(q => <g key={q.id} clipPath={`url(#${id}${q.id})`}><image href={view(q.id, size === 'card')} x="-150" y="-236" width="690" height="690" preserveAspectRatio="xMidYMid slice" /></g>)}
      {/* The quarter lines, as on the dial. */}
      <path d="M200 28V272M78 150H322" style={{ stroke: 'var(--mk-gold-light)', strokeWidth: 3.4 }} />
      <path d="M200 28V272M78 150H322" style={{ stroke: 'var(--mk-gold-deep)', strokeWidth: 1, opacity: 0.6 }} />
      <circle cx="200" cy="150" r="118" fill={`url(#${id}glaze)`} />
    </g>
    {/* The brass pointer, on spring. */}
    <g transform="rotate(45 200 150)">
      <path d="M194 168L197 62L200 40L203 62L206 168Z" style={{ fill: 'var(--mk-shadow)', opacity: 0.2 }} transform="translate(3 4)" />
      <path d="M194 168L197 62L200 40L203 62L206 168Z" fill={`url(#${id}rim)`} />
      <circle cx="200" cy="70" r="5" style={{ fill: 'var(--mk-red)' }} />
    </g>
    <circle cx="200" cy="150" r="13" fill={`url(#${id}rim)`} />
    <circle cx="200" cy="150" r="13" style={{ fill: 'none', stroke: 'var(--mk-gold-deep)', strokeWidth: 1.6 }} />
    <circle cx="196" cy="146" r="4" style={{ fill: 'var(--mk-white)', opacity: 0.5 }} />
    {/* Aya, who tends the tree, by the rim. */}
    <ellipse cx="78" cy="288" rx="38" ry="7" style={{ fill: 'var(--mk-shadow)', opacity: 0.2 }} />
    <image href={FRIEND_PICTURES.ayaIdle.src} x="18" y="170" width="120" height="120" />
  </svg>;
}
