import { useId } from 'react';
import '../makerPalette.css';

/** Clay Theatre cover: the toy theatre on the round stage of the Mirror
 * Quarter's glass rotunda (the shipped kit room), the clay whale mid-breach
 * inside it, and three of the audience seen from behind (the kit's own
 * renders). Fills its box; one subject that reads at 80px. The whale's
 * outline is the game's own whale keyframe (bent, as in the jump), baked here
 * so the cover stays a tiny chunk with no game code. */
const ROOM = '/visuals/studio-v2/bop/scene-band-480.webp';
/** Shared library back views: href, x, y, width, full height, and how much of the height shows. */
const SEATS: readonly (readonly [string, number, number, number, number, number])[] = [
  ['/visuals/studio-v2/makers/kit-aya-back.webp', 14, 186, 88, 184, 0.62],
  ['/visuals/studio-v2/makers/kit-chock-back.webp', 258, 222, 84, 188, 0.42],
  ['/visuals/studio-v2/makers/kit-pep-back.webp', 328, 234, 62, 148, 0.45],
];
const WHALE = 'M267 100.4C268.3 102.4 268.9 104 269.4 105.9C269.9 107.9 270.1 109.9 270 112C269.9 114 269.5 116.2 268.8 118.4C268.1 120.5 267.1 122.8 265.8 125C264.6 127.3 263 129.5 261.3 131.8C259.5 134.1 257.5 136.5 255.2 138.8C253 141.1 250.6 143.4 248 145.7C245.4 148 242.6 150.3 239.7 152.6C236.8 154.8 233.7 157.1 230.6 159.2C227.5 161.4 224.7 163.4 221 165.5C217.2 167.7 212.4 170.1 208 171.9C203.6 173.8 199 175.5 194.4 176.7C189.8 177.9 185 178.8 180.3 179.3C175.6 179.9 170.7 179.9 166.1 179.8C161.5 179.7 156.8 179.3 152.6 178.8C148.3 178.4 144.2 177.8 140.5 177.3C136.9 176.7 133.5 176.1 130.6 175.6C127.7 175.1 125.2 174.6 123.2 174.2C121.2 173.8 119.6 173.5 118.5 173.1C117.4 172.7 116.8 172.5 116.5 172C116.2 171.6 116.4 171.1 116.9 170.4C117.3 169.7 118.2 169 119.2 167.9C120.3 166.8 121.7 165.5 123.2 163.8C124.7 162.1 126.5 160.2 128.4 157.8C130.2 155.5 132.3 152.8 134.4 149.7C136.5 146.7 138.7 143.3 141 139.6C143.3 136 145.7 132 148.2 127.9C150.6 123.8 153.1 119.2 155.9 115C158.6 110.8 161.4 106.3 164.7 102.7C168 99 172.2 95.6 175.6 93C179.1 90.4 182.1 88.8 185.5 87.1C188.9 85.3 192.4 83.8 196 82.6C199.5 81.4 203.2 80.5 206.8 79.8C210.4 79.1 214.1 78.7 217.6 78.6C221.2 78.4 224.8 78.6 228.2 79C231.7 79.4 235.1 80 238.3 80.9C241.5 81.7 244.6 82.9 247.4 84.1C250.3 85.4 253 87 255.4 88.6C257.9 90.3 260.1 92.1 262 94.1C264 96.1 265.8 98.4 267 100.4Z';
const FLUKE = 'M119.9 167C119.3 165.7 117.7 161.4 116.2 159.6C114.8 157.7 113.1 156.6 111.3 155.8C109.5 154.9 107.5 154.5 105.5 154.3C103.4 154.2 101.2 154.3 99 154.7C96.7 155.1 93.1 156.5 91.9 156.9C90.7 157.2 91.2 155.9 91.9 156.9C92.6 157.9 94.5 161.3 96 163.1C97.4 164.9 99 166.3 100.7 167.5C102.4 168.7 104.2 169.6 106.1 170.1C108 170.6 110 170.9 112.3 170.4C114.6 169.8 118.6 167.5 119.9 167C121.1 166.4 120.5 168.2 119.9 167Z';
const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;
const BODY = mix('var(--mk-water)', 86, 'var(--mk-chalk)'), TRIM = mix('var(--mk-amber)', 86, 'var(--mk-chalk)');
const FELT = mix('var(--mk-teal)', 80, 'var(--mk-sea)'), FELT_DEEP = mix('var(--mk-teal-deep)', 62, 'var(--mk-teal)');

export default function ClayTheatreCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const u = (name: string) => `url(#${id}${name})`;
  const clay = (name: string, c: string, light = 50, dark = 68) => <radialGradient id={`${id}${name}`} cx=".34" cy=".28" r=".86" fx=".3" fy=".22">
    <stop offset="0" style={{ stopColor: mix(c, light, 'var(--mk-white)') }} /><stop offset=".46" style={{ stopColor: c }} /><stop offset="1" style={{ stopColor: mix(c, dark, 'var(--mk-shadow)') }} />
  </radialGradient>;
  const drops: [number, number, number][] = [[96, 132, 5], [84, 112, 3.5], [112, 104, 4], [140, 160, 3.4], [292, 150, 4.5], [304, 128, 3.2], [280, 168, 3]];
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      {clay('body', BODY)}{clay('trim', TRIM, 55)}{clay('sun', 'var(--mk-sun)', 45, 60)}
      <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--mk-sky)' }} /><stop offset="1" style={{ stopColor: 'var(--mk-sky-pale)' }} /></linearGradient>
      <linearGradient id={`${id}sea`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--mk-sea)' }} /><stop offset="1" style={{ stopColor: 'var(--mk-teal-deep)' }} /></linearGradient>
      <linearGradient id={`${id}glaze`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: 'var(--mk-white)' }} /><stop offset=".6" style={{ stopColor: 'var(--mk-snow)' }} /><stop offset="1" style={{ stopColor: mix('var(--mk-snow-shade)', 55, 'var(--mk-snow)') }} /></linearGradient>
      <linearGradient id={`${id}wood`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: mix('var(--mk-wood-light)', 58, 'var(--mk-white)') }} /><stop offset="1" style={{ stopColor: mix('var(--mk-wood-light)', 88, 'var(--mk-wood)') }} /></linearGradient>
      <clipPath id={`${id}win`}><rect x="62" y="52" width="276" height="158" rx="7" /></clipPath>
      <clipPath id={`${id}whale`}><path d={WHALE} /></clipPath>
    </defs>
    {/* The room: the glass rotunda with its round stage. */}
    <image href={ROOM} x="-25" y="0" width="450" height="300" preserveAspectRatio="xMidYMid slice" />
    <ellipse cx="200" cy="262" rx="150" ry="12" style={{ fill: mix('var(--mk-shadow)', 26, 'transparent') }} />
    {/* The toy theatre: a white ceramic frame on a pale-wood plinth. */}
    <rect x="44" y="34" width="312" height="190" rx="18" style={{ fill: u('glaze') }} />
    <rect x="50" y="40" width="300" height="180" rx="13" fill="none" style={{ stroke: mix('var(--mk-teal)', 60, 'transparent'), strokeWidth: 1.6 }} />
    <g clipPath={`url(#${id}win)`}>
      <g transform="translate(34 36) scale(.83 .84)">
        <rect x="30" y="14" width="340" height="230" style={{ fill: u('sky') }} />
        <circle cx="320" cy="68" r="17" style={{ fill: u('sun') }} />
        <path d="M58 92C52 84 62 76 70 80C74 70 90 70 94 80C102 76 112 84 106 92Z" style={{ fill: 'var(--mk-snow)' }} />
        <path d={FLUKE} style={{ fill: u('body') }} />
        <path d={WHALE} style={{ fill: u('body') }} />
        <ellipse cx="223.8" cy="156.3" rx="70" ry="20" transform="rotate(-32 223.8 156.3)" clipPath={`url(#${id}whale)`} style={{ fill: u('trim') }} />
        <circle cx="234.5" cy="100.4" r="4.6" style={{ fill: 'var(--mk-ink)' }} /><circle cx="233" cy="98.8" r="1.4" style={{ fill: 'var(--mk-white)' }} />
        <path d="M247.9 111.4Q259.4 110.8 264.8 102.1" fill="none" strokeLinecap="round" style={{ stroke: mix('var(--mk-ink)', 80, BODY), strokeWidth: 2.4 }} />
        <circle cx="262" cy="108" r="4" style={{ fill: mix('var(--mk-rose)', 45, 'transparent') }} />
        <path d="M150 96A12 9 0 0 1 166 92M153 100A8 6 0 0 1 163 97" fill="none" strokeLinecap="round" style={{ stroke: mix('var(--mk-white)', 30, 'transparent'), strokeWidth: 1.4 }} />
        {/* The sea in ridged clay bands, the splash crown where the whale breaks through. */}
        <path d="M20 176Q50 168 80 176T140 176T200 176T260 176T320 176T380 176V250H20Z" style={{ fill: u('sea') }} />
        <path d="M20 176Q50 168 80 176T140 176T200 176T260 176T320 176T380 176" fill="none" style={{ stroke: mix('var(--mk-white)', 55, 'transparent'), strokeWidth: 2.4 }} />
        <path d="M20 196Q56 189 92 196T164 196T236 196T308 196T380 196V250H20Z" style={{ fill: mix('var(--mk-teal)', 80, 'var(--mk-water)') }} />
        <path d="M120 178C116 162 124 150 130 146C130 158 138 166 150 172C160 160 168 158 176 162C170 168 172 176 176 180Z" style={{ fill: mix('var(--mk-sea)', 50, 'var(--mk-white)') }} />
        <ellipse cx="160" cy="180" rx="62" ry="7" fill="none" style={{ stroke: 'var(--mk-snow)', strokeWidth: 3 }} />
        {drops.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} style={{ fill: mix('var(--mk-sea)', 60, 'var(--mk-white)') }} />)}
      </g>
      {/* The felt curtain: a scalloped valance and two gathered drapes. */}
      <path d="M62 52H338V62Q326 72 314 62T290 62T266 62T242 62T218 62T194 62T170 62T146 62T122 62T98 62T74 62L62 62Z" style={{ fill: FELT }} />
      <path d="M62 52H76C80 100 72 160 78 210H62Z M338 52H324C320 100 328 160 322 210H338Z" style={{ fill: FELT_DEEP }} />
    </g>
    <rect x="62" y="52" width="276" height="158" rx="7" fill="none" style={{ stroke: mix('var(--mk-shadow)', 22, 'transparent'), strokeWidth: 2 }} />
    {/* The plinth and the film strip running through its gate. */}
    <rect x="44" y="222" width="312" height="42" rx="6" style={{ fill: u('wood') }} />
    <rect x="54" y="229" width="292" height="28" rx="3" style={{ fill: mix('var(--mk-shadow)', 80, 'var(--mk-umber)') }} />
    {Array.from({ length: 7 }, (_, i) => <g key={i}>
      <rect x={58 + i * 41} y="234" width="38" height="18" rx="2" style={{ fill: i === 3 ? 'var(--mk-sky-pale)' : mix('var(--mk-sky)', 70, 'var(--mk-indigo)') }} />
      <rect x={58 + i * 41} y="245" width="38" height="7" style={{ fill: mix('var(--mk-sea)', 75, 'var(--mk-teal)'), opacity: 0.9 }} />
      <ellipse cx={77 + i * 41} cy={244 - (i === 3 ? 4 : 0)} rx="7" ry="3.4" style={{ fill: BODY }} />
    </g>)}
    <rect x="188" y="225" width="24" height="36" rx="5" fill="none" style={{ stroke: 'var(--mk-white)', strokeWidth: 3 }} />
    {/* The audience, from behind. */}
    {SEATS.map(([href, x, y, w, h]) => <image key={href} href={href} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMin meet" />)}
  </svg>;
}
