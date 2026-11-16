import { useId } from 'react';

/** The Paper Boat cover: the harbour spread of the pop-up book, slightly open,
 * its houses and lighthouse standing up in the evening light, and the white
 * paper boat big in front. Fills its box (the box sets the size); one clear
 * subject, the boat, so it reads at 80px. No text. */
const v = (name: string) => `var(--mk-${name})`;
const mixed = (a: string, pct: number, b: string) => `color-mix(in srgb, ${v(a)} ${pct}%, ${v(b)})`;
const faded = (a: string, pct: number) => `color-mix(in srgb, ${v(a)} ${pct}%, transparent)`;

export default function PaperBoatCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const g = (name: string) => `url(#${id}${name})`;
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: v('indigo-deep') }} /><stop offset=".55" style={{ stopColor: mixed('plum', 70, 'rose-deep') }} /><stop offset="1" style={{ stopColor: v('rose') }} /></linearGradient>
      <linearGradient id={`${id}pageL`} x1="1" y1="0" x2="0" y2="0"><stop offset="0" style={{ stopColor: v('paper-shade') }} /><stop offset=".25" style={{ stopColor: v('paper') }} /><stop offset="1" style={{ stopColor: v('cream') }} /></linearGradient>
      <linearGradient id={`${id}pageR`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={{ stopColor: v('paper-shade') }} /><stop offset=".25" style={{ stopColor: v('paper') }} /><stop offset="1" style={{ stopColor: v('cream') }} /></linearGradient>
      <linearGradient id={`${id}sea`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: v('teal-deep') }} /><stop offset="1" style={{ stopColor: v('indigo') }} /></linearGradient>
      <radialGradient id={`${id}glow`} cx=".5" cy=".5" r=".5"><stop offset="0" style={{ stopColor: v('sun') }} /><stop offset="1" style={{ stopColor: faded('sun', 0) }} /></radialGradient>
    </defs>
    <rect width="400" height="300" fill={g('sky')} />
    {[[40, 30], [96, 58], [330, 26], [362, 70], [250, 18], [150, 22]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.6 : 2.4} style={{ fill: v('butter') }} />)}
    {/* the table and the open book */}
    <g transform="translate(0 -26)">
    <rect y="214" width="400" height="140" style={{ fill: mixed('wood-dark', 70, 'plum') }} />
    <ellipse cx="200" cy="258" rx="190" ry="26" style={{ fill: faded('shadow', 45) }} />
    <path d="M18 248 L200 262 L382 248 L360 170 L200 182 L40 170 Z" style={{ fill: v('indigo') }} />
    <path d="M30 240 L200 252 L200 176 L52 166 Z" fill={g('pageL')} />
    <path d="M370 240 L200 252 L200 176 L348 166 Z" fill={g('pageR')} />
    {/* printed harbour water across both pages */}
    <path d="M42 210 L200 220 L200 252 L30 240 Z" fill={g('sea')} />
    <path d="M358 210 L200 220 L200 252 L370 240 Z" fill={g('sea')} />
    <path d="M200 176 L200 252" style={{ stroke: mixed('paper-shade', 70, 'umber'), strokeWidth: 2 }} />
    {/* pop-ups standing off the pages: houses, a lighthouse, lamps */}
    <g>
      <path d="M70 206 L70 150 L96 128 L122 150 L122 208 Z" style={{ fill: v('butter') }} /><path d="M64 152 L96 124 L128 152 Z" style={{ fill: v('rust') }} />
      <rect x="80" y="166" width="12" height="14" rx="2" style={{ fill: v('sun') }} /><rect x="100" y="166" width="12" height="14" rx="2" style={{ fill: v('sun') }} />
      <path d="M128 210 L128 138 L152 116 L176 138 L176 212 Z" style={{ fill: v('blossom') }} /><path d="M122 140 L152 112 L182 140 Z" style={{ fill: v('clay') }} />
      <rect x="138" y="154" width="11" height="14" rx="2" style={{ fill: v('sun') }} /><rect x="156" y="154" width="11" height="14" rx="2" style={{ fill: v('sun') }} />
      <path d="M224 212 L224 146 L250 126 L276 146 L276 210 Z" style={{ fill: v('clay-pale') }} /><path d="M218 148 L250 120 L282 148 Z" style={{ fill: v('rose-deep') }} />
      <rect x="234" y="162" width="12" height="14" rx="2" style={{ fill: v('sun') }} /><rect x="254" y="162" width="12" height="14" rx="2" style={{ fill: v('sun') }} />
      <circle cx="322" cy="88" r="40" fill={g('glow')} />
      <path d="M306 208 L313 96 L331 96 L338 208 Z" style={{ fill: v('snow') }} />
      <path d="M309.5 150 L334.5 150 L336 168 L308 168 Z M311.5 116 L332.5 116 L333.6 132 L310.4 132 Z" style={{ fill: v('red') }} />
      <rect x="304" y="90" width="36" height="7" rx="2" style={{ fill: v('graphite') }} />
      <rect x="312" y="72" width="20" height="18" rx="3" style={{ fill: v('sun') }} />
      <path d="M309 72 L322 58 L335 72 Z" style={{ fill: v('red') }} />
    </g>
    <path d="M200 220 L200 176" style={{ stroke: faded('shadow', 35), strokeWidth: 6 }} />
    </g>
    {/* the paper boat, big, in front */}
    <ellipse cx="200" cy="232" rx="86" ry="11" style={{ fill: faded('shadow', 40) }} />
    <g transform="translate(116 118) scale(2.1)">
      <path d="M40 4 L24 35 L40 35 Z" style={{ fill: v('white') }} />
      <path d="M40 4 L56 35 L40 35 Z" style={{ fill: mixed('white', 72, 'sky-pale') }} />
      <path d="M3 33 L77 33 L63 52 L17 52 Z" style={{ fill: v('white') }} />
      <path d="M10 42 L70 42 L63 52 L17 52 Z" style={{ fill: mixed('snow', 70, 'snow-shade') }} />
      <path d="M24 33 L40 46 L56 33 Z" style={{ fill: mixed('white', 72, 'sky-pale') }} />
      <path d="M77 33 L63 52 L61 52 L72 33 Z" style={{ fill: mixed('snow-shade', 70, 'sky') }} />
    </g>
    <path d="M100 236 q 20 -8 40 0 M260 238 q 20 -8 40 0" style={{ fill: 'none', stroke: faded('sky-pale', 70), strokeWidth: 4, strokeLinecap: 'round' }} />
  </svg>;
}
