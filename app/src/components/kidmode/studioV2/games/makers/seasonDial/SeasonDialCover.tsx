import { useId } from 'react';

/** Weather Maker cover: the old apple tree inside the brass dial, its four
 * quarters in the four seasons (spring top right, summer bottom right, autumn
 * bottom left, winter top left, as on the dial). Fills its box; one clear
 * subject so it reads at 80px. Kept apart from the game code (its own chunk). */
const LIMBS = 'M198 224C196 206 190 192 184 178M184 178C176 164 160 152 140 146M184 178C190 160 206 146 228 138M140 146C130 134 126 120 128 104M140 146C124 146 110 140 98 128M228 138C240 126 246 110 244 96M228 138C246 138 262 132 276 120M184 178C184 160 182 140 186 116M186 116C178 104 170 96 160 90M186 116C196 104 206 96 216 92';
const TWIGS = 'M128 104L118 92M128 104L134 88M98 128L84 122M98 128L92 112M244 96L252 82M244 96L232 84M276 120L292 116M276 120L284 104M160 90L150 78M216 92L228 80M160 90L166 76';
const CROWN = [[128, 102, 26], [100, 126, 22], [150, 84, 24], [186, 74, 26], [220, 84, 26], [246, 98, 24], [276, 118, 22], [160, 120, 26], [210, 120, 28], [124, 140, 20], [262, 140, 20]] as const;
const HILL = 'M60 256C120 244 170 242 200 248C240 242 300 246 344 258L344 300L60 300Z';
const quarter = (q: number) => ({ x: q === 1 || q === 0 ? 200 : 0, y: q === 1 || q === 2 ? 150 : 0 });

export default function SeasonDialCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId().replace(/:/g, '');
  const clip = (q: number) => `url(#${id}q${q})`;
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${id}bg`} cx=".5" cy=".45" r=".75">
        <stop offset="0" style={{ stopColor: 'var(--mk-indigo)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-night)' }} />
      </radialGradient>
      <linearGradient id={`${id}rim`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--mk-gold-light)' }} />
        <stop offset=".55" style={{ stopColor: 'var(--mk-gold)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-gold-deep)' }} />
      </linearGradient>
      <radialGradient id={`${id}glaze`} cx=".3" cy=".22" r=".85">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.35 }} />
        <stop offset=".5" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.2 }} />
      </radialGradient>
      <clipPath id={`${id}disc`}><circle cx="200" cy="150" r="118" /></clipPath>
      {[0, 1, 2, 3].map(q => { const p = quarter(q); return <clipPath key={q} id={`${id}q${q}`}><rect x={p.x} y={p.y} width="200" height="150" /></clipPath>; })}
    </defs>
    <rect width="400" height="300" fill={`url(#${id}bg)`} />
    {[[52, 40], [340, 58], [362, 236], [36, 250], [86, 150], [318, 150]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.6 : 2.2} style={{ fill: 'var(--mk-butter)', opacity: 0.55 }} />)}
    <ellipse cx="210" cy="160" rx="146" ry="146" style={{ fill: 'var(--mk-shadow)', opacity: 0.45 }} />
    <circle cx="200" cy="150" r="142" fill={`url(#${id}rim)`} />
    {Array.from({ length: 48 }, (_, i) => <rect key={i} x="198" y="8" width="4" height="12" rx="2" transform={`rotate(${i * 7.5} 200 150)`} style={{ fill: i % 2 ? 'var(--mk-gold-deep)' : 'var(--mk-gold-light)', opacity: 0.55 }} />)}
    <circle cx="200" cy="150" r="122" style={{ fill: 'var(--mk-gold-deep)' }} />

    <g clipPath={`url(#${id}disc)`}>
      {/* The four skies. */}
      <rect x="200" y="0" width="200" height="150" style={{ fill: 'color-mix(in srgb, var(--mk-sky), var(--mk-blossom) 25%)' }} />
      <rect x="200" y="150" width="200" height="150" style={{ fill: 'var(--mk-sky)' }} />
      <rect x="0" y="150" width="200" height="150" style={{ fill: 'color-mix(in srgb, var(--mk-amber), var(--mk-butter) 35%)' }} />
      <rect x="0" y="0" width="200" height="150" style={{ fill: 'color-mix(in srgb, var(--mk-snow-shade), var(--mk-lilac) 30%)' }} />
      <circle cx="300" cy="62" r="16" style={{ fill: 'var(--mk-butter)', opacity: 0.9 }} clipPath={clip(0)} />
      <circle cx="104" cy="214" r="20" style={{ fill: 'var(--mk-sun)', opacity: 0.8 }} clipPath={clip(2)} />
      {/* The hill, in each quarter's season. */}
      <path d={HILL} style={{ fill: 'var(--mk-spring)' }} clipPath={clip(1)} />
      <path d={HILL} style={{ fill: 'color-mix(in srgb, var(--mk-snow), var(--mk-snow-shade) 40%)' }} clipPath={clip(3)} />
      <path d={HILL} style={{ fill: 'color-mix(in srgb, var(--mk-spring), var(--mk-sage) 40%)' }} clipPath={clip(0)} />
      <path d={HILL} style={{ fill: 'color-mix(in srgb, var(--mk-sand), var(--mk-wood) 35%)' }} clipPath={clip(2)} />
      
      {/* The tree, the same in all four quarters, its crown on the dial's centre. */}
      <g transform="translate(0 40)">
      <path d="M186 232C190 214 190 196 184 178L200 176C204 196 208 214 216 232Z" style={{ fill: 'var(--mk-fur)' }} />
      <path d="M201 178C204 196 208 214 214 232L208 232C204 214 200 196 197 178Z" style={{ fill: 'var(--mk-fur-dark)', opacity: 0.5 }} />
      <path d={LIMBS} style={{ fill: 'none', stroke: 'var(--mk-fur)', strokeWidth: 9, strokeLinecap: 'round' }} />
      <path d={TWIGS} style={{ fill: 'none', stroke: 'var(--mk-fur)', strokeWidth: 4, strokeLinecap: 'round' }} />
      </g>

      {/* Summer (bottom right): a full green crown with apples. */}
      <g clipPath={clip(1)}><g transform="translate(0 40)">
        {CROWN.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} style={{ fill: 'color-mix(in srgb, var(--mk-leaf), var(--mk-leaf-deep) 40%)' }} />)}
        {CROWN.map(([x, y, r], i) => <circle key={i} cx={x - r * 0.25} cy={y - r * 0.3} r={r * 0.68} style={{ fill: 'var(--mk-leaf)' }} />)}
        {[[226, 156], [252, 150], [240, 170]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5.6" style={{ fill: 'var(--mk-red)' }} />)}
      </g></g>
      {/* Autumn (bottom left): the crown turned, leaves falling. */}
      <g clipPath={clip(2)}><g transform="translate(0 40)">
        {CROWN.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r * 0.9} style={{ fill: i % 3 ? 'var(--mk-orange)' : 'var(--mk-red)' }} />)}
        {CROWN.map(([x, y, r], i) => <circle key={i} cx={x - r * 0.25} cy={y - r * 0.3} r={r * 0.6} style={{ fill: 'var(--mk-amber)' }} />)}
        {[[120, 196, 20], [150, 222, -30], [98, 214, 60], [172, 244, 10]].map(([x, y, a], i) => <ellipse key={i} cx={x} cy={y} rx="6" ry="3.4" transform={`rotate(${a} ${x} ${y})`} style={{ fill: i % 2 ? 'var(--mk-red)' : 'var(--mk-orange)' }} />)}
      </g></g>
      {/* Spring (top right): blossom on the twigs. */}
      <g clipPath={clip(0)}><g transform="translate(0 40)">
        {[[228, 138], [244, 96], [252, 82], [232, 84], [276, 120], [292, 116], [284, 104], [216, 92], [228, 80], [262, 128], [238, 112], [206, 104], [260, 100]].map(([x, y], i) => <g key={i} transform={`translate(${x} ${y})`}>
          {[0, 72, 144, 216, 288].map(a => <circle key={a} cx={4.4 * Math.sin((a * Math.PI) / 180)} cy={-4.4 * Math.cos((a * Math.PI) / 180)} r="4" style={{ fill: 'var(--mk-blossom)' }} />)}
          <circle r="2.2" style={{ fill: 'var(--mk-rose)' }} />
        </g>)}
      </g></g>
      {/* Winter (top left): bare branches under snow, and falling flakes. */}
      <g clipPath={clip(3)}><g transform="translate(0 40)">
        <path d="M140 146C124 146 110 140 98 128M128 104L118 92M160 90L150 78M98 128L84 122" transform="translate(0 -4)" style={{ fill: 'none', stroke: 'var(--mk-snow)', strokeWidth: 4.5, strokeLinecap: 'round' }} />
        {[[110, 60], [150, 40], [92, 96], [170, 118], [130, 128], [72, 70], [186, 62]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 3 : 4} style={{ fill: 'var(--mk-snow)' }} />)}
      </g></g>
      {/* The quarter lines, as on the dial. */}
      <path d="M200 28V272M78 150H322" style={{ stroke: 'var(--mk-gold)', strokeWidth: 3, opacity: 0.75 }} />
      <circle cx="200" cy="150" r="118" fill={`url(#${id}glaze)`} />
    </g>
    {/* The brass pointer's tip at the rim, on spring. */}
    <path d="M286 64L304 46L296 70Z" style={{ fill: 'var(--mk-gold-light)' }} />
    <circle cx="300" cy="50" r="5" style={{ fill: 'var(--mk-red)' }} />
  </svg>;
}
