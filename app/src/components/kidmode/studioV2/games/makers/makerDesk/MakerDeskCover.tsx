import { useId } from 'react';

/** Maker Desk cover: the desk at evening, the cream-and-teal computer glowing
 * in the middle, the shelf of made things beside it. One clear subject (the
 * glowing screen) so it reads at 80px; it fills its box and slices to any
 * shape (tile, book row, card window, round sticker). Maker palette only. */
const v = (name: string) => ({ fill: `var(--mk-${name})` });
const stop = (name: string, opacity = 1) => ({ stopColor: `var(--mk-${name})`, stopOpacity: opacity });

export default function MakerDeskCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId();
  const u = (name: string) => `url(#${id}${name})`;
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}wall`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('indigo-deep')} /><stop offset="1" style={stop('indigo')} /></linearGradient>
      <radialGradient id={`${id}warm`} cx=".46" cy=".5" r=".6"><stop offset="0" style={stop('sea', 0.55)} /><stop offset=".55" style={stop('teal', 0.16)} /><stop offset="1" style={stop('teal', 0)} /></radialGradient>
      <radialGradient id={`${id}lamp`} cx=".5" cy=".5" r=".5"><stop offset="0" style={stop('butter', 0.75)} /><stop offset="1" style={stop('butter', 0)} /></radialGradient>
      <linearGradient id={`${id}deskWood`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={stop('wood-light')} /><stop offset=".22" style={stop('wood')} /><stop offset="1" style={stop('wood-dark')} /></linearGradient>
      <linearGradient id={`${id}plastic`} x1="0" y1="0" x2=".6" y2="1"><stop offset="0" style={stop('white')} /><stop offset=".5" style={stop('cream')} /><stop offset="1" style={stop('paper-shade')} /></linearGradient>
      <radialGradient id={`${id}screen`} cx=".45" cy=".4" r=".8"><stop offset="0" style={stop('sea')} /><stop offset=".55" style={stop('teal')} /><stop offset="1" style={stop('teal-deep')} /></radialGradient>
      <linearGradient id={`${id}shade`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={stop('celadon')} /><stop offset="1" style={stop('teal-deep')} /></linearGradient>
      <filter id={`${id}blur`} x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="5" /></filter>
    </defs>
    <rect width="400" height="300" fill={u('wall')} />
    {/* The window behind: a slice of evening sky with two stars. */}
    <rect x="22" y="28" width="92" height="104" rx="8" style={v('wood')} opacity=".7" />
    <rect x="30" y="36" width="76" height="88" rx="4" style={v('violet')} opacity=".7" />
    <rect x="30" y="96" width="76" height="28" style={v('amber')} opacity=".55" />
    <rect x="66" y="36" width="4" height="88" style={v('wood')} opacity=".7" />
    <circle cx="48" cy="56" r="2" style={v('butter')} /><circle cx="90" cy="70" r="1.6" style={v('butter')} />
    {/* The shelf with things on it. */}
    <rect x="286" y="96" width="102" height="8" rx="3" style={v('wood-light')} />
    <path d="M298 104v10l8-10zM368 104l8 10v-10z" style={v('brass')} />
    <path d="M298 96c0-14 8-22 18-22s18 8 18 22z" style={v('celadon-deep')} /><path d="M301 86c5 2 26 2 30 0" fill="none" strokeWidth="2.5" strokeLinecap="round" style={{ stroke: 'var(--mk-gold-light)' }} />
    <path d="M346 96v-24c0-4 3-6 6-8v-6h8v6c3 2 6 4 6 8v24z" style={v('sea')} opacity=".9" /><rect x="349" y="74" width="4" height="18" rx="2" style={v('white')} opacity=".35" />
    <rect x="286" y="158" width="102" height="8" rx="3" style={v('wood-light')} />
    <rect x="300" y="128" width="30" height="30" rx="3" style={v('rose')} /><path d="M304 136c4 3 8 3 11 0s8-3 11 0M304 146c4 3 8 3 11 0s8-3 11 0" fill="none" strokeWidth="2" style={{ stroke: 'var(--mk-blossom)' }} />
    <ellipse cx="360" cy="152" rx="15" ry="5" style={v('violet')} /><ellipse cx="360" cy="149" rx="15" ry="5" style={v('lilac')} />
    {/* The glow of the screen fills the room. */}
    <ellipse cx="186" cy="150" rx="190" ry="130" fill={u('warm')} />
    {/* The desk. */}
    <rect x="0" y="222" width="400" height="78" fill={u('deskWood')} />
    <rect x="0" y="222" width="400" height="4" style={v('white')} opacity=".3" />
    <ellipse cx="74" cy="226" rx="70" ry="12" fill={u('lamp')} />
    {/* The lamp. */}
    <path d="M44 222c0-6 8-9 18-9s18 3 18 9z" fill={u('shade')} />
    <path d="M62 214l-8-50 30-24" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--mk-teal-deep)' }} />
    <g transform="rotate(28 92 146)"><path d="M74 146c0-12 8-21 18-21s18 9 18 21z" fill={u('shade')} /><ellipse cx="92" cy="146" rx="18" ry="4" style={v('butter')} /></g>
    {/* The computer. */}
    <ellipse cx="190" cy="226" rx="86" ry="8" style={v('shadow')} opacity=".35" filter={u('blur')} />
    <path d="M168 210h44l7 14h-58z" style={v('paper-shade')} />
    <rect x="110" y="88" width="160" height="128" rx="22" fill={u('plastic')} />
    <rect x="124" y="100" width="132" height="90" rx="16" style={v('linen-shade')} />
    <rect x="131" y="106" width="118" height="78" rx="13" fill={u('screen')} />
    <rect x="131" y="106" width="118" height="10" rx="5" style={v('teal-deep')} opacity=".8" />
    {[146, 178, 210].map((x, i) => <g key={x}><rect x={x} y="128" width="22" height="22" rx="3" style={v('indigo-deep')} /><rect x={x + 6} y="134" width="10" height="10" style={v(['amber', 'rose', 'spring'][i])} /></g>)}
    <path d="M131 170l14-5 14 3 16-6 18 4 16-5 18 4 22-3v18H131z" style={v('teal-deep')} opacity=".8" />
    <path d="M138 112c24-5 56-5 74-2l-70 52c-6-16-7-34-4-50z" style={v('white')} opacity=".14" />
    <rect x="128" y="198" width="52" height="6" rx="3" style={v('teal')} />
    <circle cx="250" cy="201" r="4" style={v('spring')} /><circle cx="250" cy="201" r="9" style={v('spring')} opacity=".3" />
    <path d="M124 236l8-8h116l8 8v6a3 3 0 0 1-3 3H127a3 3 0 0 1-3-3z" fill={u('plastic')} />
    {Array.from({ length: 11 }, (_, i) => <rect key={i} x={136 + i * 11} y="232" width="8" height="5" rx="1.5" style={i % 4 === 0 ? v('teal') : v('paper-shade')} />)}
  </svg>;
}
