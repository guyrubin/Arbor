import { STUDIO_BOP_ROOT, STUDIO_MAKERS_ROOT } from '../../../../../../lib/kidThemeManifest';
import { useId } from 'react';
import '../makerPalette.css';

/** Clay Theatre cover: the game's own picture, small. The felt cloth stands on
 * the round stage of the Mirror Quarter's glass rotunda (the shipped kit
 * room), a clay whale leaps over clay waves in front of it, and Bebe's
 * ProofLens on its tripod (cut from the kit) films it from the front. Fills
 * its box; one subject that reads at 80px. The whale's outline is the game's
 * own whale, bent as in a jump and baked here so the cover stays a tiny chunk
 * with no game code. */
const ROOM = `${STUDIO_BOP_ROOT}scene-band-480.webp`;
const LENS = `${STUDIO_MAKERS_ROOT}clay-theatre-prooflens-tripod-480.webp`;
const WHALE = 'M267 100.4C268.3 102.4 268.9 104 269.4 105.9C269.9 107.9 270.1 109.9 270 112C269.9 114 269.5 116.2 268.8 118.4C268.1 120.5 267.1 122.8 265.8 125C264.6 127.3 263 129.5 261.3 131.8C259.5 134.1 257.5 136.5 255.2 138.8C253 141.1 250.6 143.4 248 145.7C245.4 148 242.6 150.3 239.7 152.6C236.8 154.8 233.7 157.1 230.6 159.2C227.5 161.4 224.7 163.4 221 165.5C217.2 167.7 212.4 170.1 208 171.9C203.6 173.8 199 175.5 194.4 176.7C189.8 177.9 185 178.8 180.3 179.3C175.6 179.9 170.7 179.9 166.1 179.8C161.5 179.7 156.8 179.3 152.6 178.8C148.3 178.4 144.2 177.8 140.5 177.3C136.9 176.7 133.5 176.1 130.6 175.6C127.7 175.1 125.2 174.6 123.2 174.2C121.2 173.8 119.6 173.5 118.5 173.1C117.4 172.7 116.8 172.5 116.5 172C116.2 171.6 116.4 171.1 116.9 170.4C117.3 169.7 118.2 169 119.2 167.9C120.3 166.8 121.7 165.5 123.2 163.8C124.7 162.1 126.5 160.2 128.4 157.8C130.2 155.5 132.3 152.8 134.4 149.7C136.5 146.7 138.7 143.3 141 139.6C143.3 136 145.7 132 148.2 127.9C150.6 123.8 153.1 119.2 155.9 115C158.6 110.8 161.4 106.3 164.7 102.7C168 99 172.2 95.6 175.6 93C179.1 90.4 182.1 88.8 185.5 87.1C188.9 85.3 192.4 83.8 196 82.6C199.5 81.4 203.2 80.5 206.8 79.8C210.4 79.1 214.1 78.7 217.6 78.6C221.2 78.4 224.8 78.6 228.2 79C231.7 79.4 235.1 80 238.3 80.9C241.5 81.7 244.6 82.9 247.4 84.1C250.3 85.4 253 87 255.4 88.6C257.9 90.3 260.1 92.1 262 94.1C264 96.1 265.8 98.4 267 100.4Z';
const FLUKE = 'M119.9 167C119.3 165.7 117.7 161.4 116.2 159.6C114.8 157.7 113.1 156.6 111.3 155.8C109.5 154.9 107.5 154.5 105.5 154.3C103.4 154.2 101.2 154.3 99 154.7C96.7 155.1 93.1 156.5 91.9 156.9C90.7 157.2 91.2 155.9 91.9 156.9C92.6 157.9 94.5 161.3 96 163.1C97.4 164.9 99 166.3 100.7 167.5C102.4 168.7 104.2 169.6 106.1 170.1C108 170.6 110 170.9 112.3 170.4C114.6 169.8 118.6 167.5 119.9 167C121.1 166.4 120.5 168.2 119.9 167Z';
const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;
const BODY = mix('var(--mk-water)', 86, 'var(--mk-chalk)'), TRIM = mix('var(--mk-amber)', 86, 'var(--mk-chalk)');
/** A scalloped clay wave right across the cloth. */
const wave = (y: number, shift: number) => { let d = `M30 ${y}`; for (let x = 30 + shift; x < 380; x += 28) d += `Q${x - 14} ${y - 10} ${x} ${y}`; return `${d}L372 ${y}V246Q372 252 366 252H36Q30 252 30 246Z`; };

export default function ClayTheatreCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const u = (name: string) => `url(#${id}${name})`;
  const clay = (name: string, c: string, light = 50, dark = 68) => <radialGradient id={`${id}${name}`} cx=".66" cy=".26" r=".9" fx=".7" fy=".2">
    <stop offset="0" style={{ stopColor: mix(c, light, 'var(--mk-white)') }} /><stop offset=".46" style={{ stopColor: c }} /><stop offset="1" style={{ stopColor: mix(c, dark, 'var(--mk-shadow)') }} />
  </radialGradient>;
  const drops: [number, number, number][] = [[112, 150, 5], [98, 128, 3.5], [128, 120, 4], [290, 166, 4.5], [304, 146, 3.2]];
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      {clay('body', BODY)}{clay('trim', TRIM, 55)}{clay('sun', 'var(--mk-sun)', 45, 60)}
      <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--mk-sky)' }} /><stop offset="1" style={{ stopColor: 'var(--mk-sky-pale)' }} /></linearGradient>
      <linearGradient id={`${id}sea`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: mix('var(--mk-sea)', 70, 'var(--mk-white)') }} /><stop offset=".3" style={{ stopColor: 'var(--mk-sea)' }} /><stop offset="1" style={{ stopColor: 'var(--mk-teal-deep)' }} /></linearGradient>
      <linearGradient id={`${id}near`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: mix('var(--mk-teal)', 70, 'var(--mk-white)') }} /><stop offset=".3" style={{ stopColor: 'var(--mk-teal)' }} /><stop offset="1" style={{ stopColor: mix('var(--mk-teal-deep)', 80, 'var(--mk-shadow)') }} /></linearGradient>
      <clipPath id={`${id}whale`}><path d={WHALE} /></clipPath>
    </defs>
    {/* The room: the glass rotunda with its round stage. */}
    <image href={ROOM} x="-25" y="0" width="450" height="300" preserveAspectRatio="xMidYMid slice" />
    <ellipse cx="192" cy="254" rx="176" ry="12" style={{ fill: mix('var(--mk-shadow)', 28, 'transparent') }} />
    {/* The felt cloth, hemmed with a running stitch. */}
    <path d="M30 240V66Q30 30 66 30H336Q372 30 372 66V240Z" style={{ fill: u('sky') }} />
    <path d="M37 240V68Q37 37 68 37H334Q365 37 365 68V240" fill="none" strokeLinecap="round" strokeDasharray="6 5" style={{ stroke: mix('var(--mk-white)', 70, 'transparent'), strokeWidth: 1.6 }} />
    <circle cx="96" cy="76" r="19" style={{ fill: u('sun') }} />
    <path d={wave(204, 0)} style={{ fill: u('sea') }} />
    {/* The clay whale, mid-leap. */}
    <g transform="translate(22 18) scale(.9 .9)">
      <path d={FLUKE} style={{ fill: u('body') }} />
      <path d={WHALE} style={{ fill: u('body') }} />
      <ellipse cx="223.8" cy="156.3" rx="70" ry="20" transform="rotate(-32 223.8 156.3)" clipPath={`url(#${id}whale)`} style={{ fill: u('trim') }} />
      <circle cx="234.5" cy="100.4" r="7" style={{ fill: 'var(--mk-white)' }} /><circle cx="236" cy="100.2" r="3.8" style={{ fill: 'var(--mk-ink)' }} /><circle cx="237.2" cy="98.8" r="1.3" style={{ fill: 'var(--mk-white)' }} />
      <path d="M247.9 111.4Q259.4 110.8 264.8 102.1" fill="none" strokeLinecap="round" style={{ stroke: mix('var(--mk-ink)', 80, BODY), strokeWidth: 2.6 }} />
      <circle cx="258" cy="110" r="5" style={{ fill: mix('var(--mk-rose)', 50, 'transparent') }} />
      {/* A thumb's whorl and the waxy shine. */}
      <path d="M176 128a11 8 0 0 1 16-5M179 132a7 5 0 0 1 10-3M183 135a3 2 0 0 1 4-1" fill="none" strokeLinecap="round" style={{ stroke: mix('var(--mk-shadow)', 22, 'transparent'), strokeWidth: 1.2 }} />
      <ellipse cx="214" cy="92" rx="22" ry="7" transform="rotate(-24 214 92)" style={{ fill: mix('var(--mk-white)', 42, 'transparent') }} />
    </g>
    {drops.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} style={{ fill: mix('var(--mk-sea)', 55, 'var(--mk-white)') }} />)}
    <path d={wave(222, 14)} style={{ fill: u('near') }} />
    {/* The ProofLens that films it. */}
    <ellipse cx="322" cy="286" rx="46" ry="7" style={{ fill: mix('var(--mk-shadow)', 34, 'transparent') }} />
    <image href={LENS} x="270" y="172" width="104" height="122" preserveAspectRatio="xMidYMid meet" />
  </svg>;
}
