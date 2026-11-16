import { useId, type CSSProperties } from 'react';
import { VIEW_H, VIEW_W, normDeg, toRad, type Pt } from './phageGeometry';
import PhageArt from './PhageArt';
import type { TinyBuildersWords } from './tinyBuildersCopy';

/** The scenery around the model: the night-slate stage, the museum stand
 * it turns on, the bacterium's surface it lands on, and the scale picture.
 * Drawing units are the 400 x 440 box of phageGeometry. No text in the SVG:
 * the tags are HTML, so both reading directions lay out properly. */

const mix = (a: string, share: number, b: string) => `color-mix(in srgb, ${a} ${share}%, ${b})`;
const fill = (value: string): CSSProperties => ({ fill: value });
const stroke = (value: string): CSSProperties => ({ stroke: value });

/** The stage: a deep slate-blue room with a soft light from the top-left, a
 * little paper grain, and (while building) the blueprint's faint grid. */
export function StageBackdrop({ grid }: { grid: boolean }) {
  const id = useId();
  return <g className="tiny-backdrop">
    <defs>
      <radialGradient id={`${id}room`} cx=".3" cy=".18" r="1.05">
        <stop offset="0" style={{ stopColor: mix('var(--mk-slate)', 82, 'var(--mk-indigo)') }} />
        <stop offset=".55" style={{ stopColor: mix('var(--mk-indigo-deep)', 70, 'var(--mk-slate)') }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-night)' }} />
      </radialGradient>
      <radialGradient id={`${id}spot`} cx=".34" cy=".22" r=".55">
        <stop offset="0" style={{ stopColor: mix('var(--mk-sky-pale)', 16, 'transparent') }} />
        <stop offset="1" style={{ stopColor: mix('var(--mk-sky-pale)', 0, 'transparent') }} />
      </radialGradient>
      <filter id={`${id}grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" />
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0" />
      </filter>
    </defs>
    <rect x={-40} y={-40} width={VIEW_W + 80} height={VIEW_H + 120} style={fill(`url(#${id}room)`)} />
    <rect x={-40} y={-40} width={VIEW_W + 80} height={VIEW_H + 120} style={fill(`url(#${id}spot)`)} />
    {grid && <g className="tiny-grid" strokeWidth={0.6}>
      {Array.from({ length: 21 }, (_, i) => <path key={`v${i}`} d={`M${i * 20} 0V${VIEW_H}`} style={stroke(mix('var(--mk-sky)', i % 5 === 0 ? 17 : 8, 'transparent'))} />)}
      {Array.from({ length: 23 }, (_, i) => <path key={`h${i}`} d={`M0 ${i * 20}H${VIEW_W}`} style={stroke(mix('var(--mk-sky)', i % 5 === 0 ? 17 : 8, 'transparent'))} />)}
    </g>}
    <rect width={VIEW_W} height={VIEW_H} filter={`url(#${id}grain)`} opacity={0.6} />
  </g>;
}

/** The museum stand: a matte slate turntable the fibre tips stand on. Its
 * rim marks turn with the model, and each tip leaves a soft contact shadow. */
export function Stand({ rotation, tilt, tips, opacity = 1, faint = false }: { rotation: number; tilt: number; tips: (Pt & { near: number })[]; opacity?: number; faint?: boolean }) {
  const id = useId();
  const cy = 338, rx = 150, ry = Math.max(1, rx * tilt), side = 18;
  return <g className="tiny-stand" opacity={opacity} data-faint={faint || undefined}>
    <defs>
      <linearGradient id={`${id}side`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" style={{ stopColor: mix('var(--mk-slate)', 70, 'var(--mk-storm)') }} />
        <stop offset=".55" style={{ stopColor: 'var(--mk-slate)' }} />
        <stop offset="1" style={{ stopColor: mix('var(--mk-night)', 70, 'var(--mk-slate)') }} />
      </linearGradient>
      <radialGradient id={`${id}top`} cx=".36" cy=".3" r=".85">
        <stop offset="0" style={{ stopColor: mix('var(--mk-storm)', 70, 'var(--mk-chalk)') }} />
        <stop offset=".6" style={{ stopColor: mix('var(--mk-storm)', 80, 'var(--mk-slate)') }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-slate)' }} />
      </radialGradient>
      <radialGradient id={`${id}ao`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: mix('var(--mk-night)', 50, 'transparent') }} />
        <stop offset="1" style={{ stopColor: mix('var(--mk-night)', 0, 'transparent') }} />
      </radialGradient>
    </defs>
    <ellipse cx={200} cy={cy + side + ry * 0.4} rx={rx + 22} ry={ry + 12} style={fill(`url(#${id}ao)`)} />
    <path d={`M${200 - rx} ${cy}V${cy + side}A${rx} ${ry} 0 0 0 ${200 + rx} ${cy + side}V${cy}Z`} style={fill(`url(#${id}side)`)} />
    <ellipse cx={200} cy={cy} rx={rx} ry={ry} style={fill(`url(#${id}top)`)} />
    <ellipse cx={200} cy={cy} rx={rx - 10} ry={Math.max(0.5, ry - 10 * tilt)} fill="none" strokeWidth={1} style={stroke(mix('var(--mk-chalk)', 22, 'transparent'))} />
    {Array.from({ length: 24 }, (_, k) => {
      const a = toRad(normDeg(k * 15 + rotation)), near = Math.sin(a);
      if (near < 0.05) return null;
      const x = 200 + rx * Math.cos(a), y = cy + ry * near;
      return <path key={k} d={`M${x.toFixed(1)} ${(y + 3).toFixed(1)}v${(k % 2 ? 5 : 9).toFixed(0)}`} strokeWidth={1.4} strokeLinecap="round" style={stroke(mix('var(--mk-chalk)', 30 + near * 30, 'transparent'))} />;
    })}
    <ellipse cx={200} cy={cy + 2} rx={56} ry={Math.max(2, 56 * tilt)} style={fill(`url(#${id}ao)`)} />
    {tips.map((t, i) => <ellipse key={i} cx={t.x + 3} cy={t.y + 1} rx={9} ry={2.6} style={fill(mix('var(--mk-night)', 46, 'transparent'))} />)}
  </g>;
}

/** Where the cell's outer surface meets the fibre tips during landing. */
export const SURFACE_Y = 392;
const ENVELOPE = { outer: [392, 402], wall: [403, 421], inner: [422, 432] } as const;
/** Fixed spots for the cell's ribosomes (no randomness at render). */
const RIBOSOMES: readonly [number, number, number][] = [[34, 452, 3.2], [70, 471, 2.6], [112, 446, 2.8], [150, 488, 3], [258, 458, 2.6], [292, 482, 3.1], [330, 450, 2.7], [366, 474, 3], [22, 495, 2.4], [384, 500, 2.6], [96, 505, 2.9], [312, 508, 2.5], [180, 520, 2.6], [236, 516, 2.8]];

/** The bacterium seen up close as a cut-through: its envelope (outer
 * membrane, wall, inner membrane) and the living inside of the cell. */
export function CellSurface({ opacity }: { opacity: number }) {
  const id = useId();
  // So close up, the huge cell's envelope is all but flat.
  const arc = (y: number) => `M-40 ${y}H440`;
  const band = (a: number, b: number) => `M-40 ${a}H440V${b}H-40Z`;
  return <g className="tiny-cell" opacity={opacity}>
    <defs>
      <linearGradient id={`${id}cyto`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" style={{ stopColor: mix('var(--mk-spring)', 62, 'var(--mk-leaf)') }} />
        <stop offset="1" style={{ stopColor: mix('var(--mk-leaf-deep)', 76, 'var(--mk-night)') }} />
      </linearGradient>
      <pattern id={`${id}lipid`} width="7" height="10" patternUnits="userSpaceOnUse" x="0" y={ENVELOPE.outer[0]}>
        <circle cx="3.5" cy="2" r="2" style={fill(mix('var(--mk-spring)', 80, 'var(--mk-white)'))} />
        <circle cx="3.5" cy="8" r="2" style={fill(mix('var(--mk-spring)', 80, 'var(--mk-white)'))} />
        <path d="M3.5 3.6v2.8" strokeWidth=".8" style={stroke(mix('var(--mk-leaf)', 60, 'transparent'))} />
      </pattern>
      <pattern id={`${id}mesh`} width="9" height="7" patternUnits="userSpaceOnUse">
        <path d="M0 3.5h9M2 0v7M6.5 0v7" strokeWidth="1" style={stroke(mix('var(--mk-moss)', 70, 'var(--mk-sage)'))} />
      </pattern>
      <filter id={`${id}soft`} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="9" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .16 0" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
    </defs>
    <path d={`${band(ENVELOPE.inner[1], 560)}`} style={fill(`url(#${id}cyto)`)} opacity={0.94} />
    <path d={`${band(ENVELOPE.inner[1], 560)}`} filter={`url(#${id}soft)`} style={fill('var(--mk-white)')} />
    {RIBOSOMES.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} style={fill(mix('var(--mk-leaf-deep)', 55, 'transparent'))} />)}
    <path d="M16 532c30-18 60 6 92-6s48-28 84-14" fill="none" strokeWidth={1.6} strokeLinecap="round" style={stroke(mix('var(--mk-spring)', 40, 'transparent'))} />
    <path d={band(ENVELOPE.inner[0], ENVELOPE.inner[1])} style={fill(mix('var(--mk-celadon)', 70, 'var(--mk-leaf)'))} />
    <path d={band(ENVELOPE.inner[0], ENVELOPE.inner[1])} style={fill(`url(#${id}lipid)`)} opacity={0.85} />
    <path d={band(ENVELOPE.wall[0], ENVELOPE.wall[1])} style={fill(mix('var(--mk-sage)', 60, 'var(--mk-leaf-deep)'))} />
    <path d={band(ENVELOPE.wall[0], ENVELOPE.wall[1])} style={fill(`url(#${id}mesh)`)} opacity={0.75} />
    <path d={band(ENVELOPE.outer[0], ENVELOPE.outer[1])} style={fill(mix('var(--mk-celadon)', 70, 'var(--mk-spring)'))} />
    <path d={band(ENVELOPE.outer[0], ENVELOPE.outer[1])} style={fill(`url(#${id}lipid)`)} opacity={0.9} />
    <path d={arc(ENVELOPE.outer[0])} fill="none" strokeWidth={1.6} style={stroke(mix('var(--mk-white)', 55, 'transparent'))} />
  </g>;
}

/** The scale picture: a rod-shaped bacterium drawn large, a living cell with
 * its own insides, and the finished phage standing small on it, about a
 * tenth of the cell's length (T4 about 0.2 micrometres, E. coli about 2). */
export function ScaleScene({ words }: { words: TinyBuildersWords }) {
  const id = useId();
  const left = 38, right = 362, top = 206, bottom = 334, r = (bottom - top) / 2;
  const capsule = `M${left + r} ${top}H${right - r}A${r} ${r} 0 0 1 ${right - r} ${bottom}H${left + r}A${r} ${r} 0 0 1 ${left + r} ${top}Z`;
  const inner = `M${left + r} ${top + 9}H${right - r}A${r - 9} ${r - 9} 0 0 1 ${right - r} ${bottom - 9}H${left + r}A${r - 9} ${r - 9} 0 0 1 ${left + r} ${top + 9}Z`;
  const scale = 0.104, phageX = 252;
  const dots: [number, number][] = [[96, 250], [118, 296], [140, 236], [172, 312], [206, 248], [236, 300], [262, 236], [290, 288], [318, 250], [330, 302], [86, 284], [150, 270], [276, 318], [226, 226], [190, 290], [304, 230]];
  return <div className="tiny-scale" aria-hidden="true">
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" dir="ltr" focusable="false">
      <StageBackdrop grid={false} />
      <defs>
        <linearGradient id={`${id}cell`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: mix('var(--mk-spring)', 80, 'var(--mk-white)') }} />
          <stop offset=".5" style={{ stopColor: mix('var(--mk-spring)', 60, 'var(--mk-leaf)') }} />
          <stop offset="1" style={{ stopColor: mix('var(--mk-leaf-deep)', 80, 'var(--mk-night)') }} />
        </linearGradient>
        <radialGradient id={`${id}glow`} cx=".32" cy=".26" r=".8">
          <stop offset="0" style={{ stopColor: mix('var(--mk-white)', 40, 'transparent') }} />
          <stop offset="1" style={{ stopColor: mix('var(--mk-white)', 0, 'transparent') }} />
        </radialGradient>
        <clipPath id={`${id}clip`}><path d={capsule} /></clipPath>
        <filter id={`${id}skin`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="3" seed="2" />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .22 0" />
        </filter>
        <radialGradient id={`${id}shadow`} cx=".5" cy=".5" r=".5">
          <stop offset="0" style={{ stopColor: mix('var(--mk-night)', 60, 'transparent') }} />
          <stop offset="1" style={{ stopColor: mix('var(--mk-night)', 0, 'transparent') }} />
        </radialGradient>
      </defs>
      <ellipse cx={200} cy={bottom + 22} rx={170} ry={16} style={fill(`url(#${id}shadow)`)} />
      {/* Flagella: the cell's own long whips, trailing from one end. */}
      {[0, 1, 2].map(k => <path key={k} d={`M${left + 8} ${258 + k * 16}c-14 ${-8 + k * 6} -16 ${18 - k * 4} -30 ${10 + k * 5}s-14 ${20 - k * 8} -26 ${12 + k * 4}`} fill="none" strokeWidth={1.6} strokeLinecap="round" style={stroke(mix('var(--mk-spring)', 55, 'transparent'))} />)}
      <path d={capsule} style={fill(`url(#${id}cell)`)} opacity={0.9} />
      <g clipPath={`url(#${id}clip)`}>
        <rect x={left} y={top} width={right - left} height={bottom - top} filter={`url(#${id}skin)`} />
        <path d={inner} style={fill(mix('var(--mk-spring)', 30, 'transparent'))} />
        {/* The cell's own DNA, loosely gathered in the middle. */}
        <path d="M150 268c18-26 52-20 60 0s-30 34-46 18 10-40 42-36 52 14 44 34-38 18-46 2 18-26 40-18" fill="none" strokeWidth={2} strokeLinecap="round" style={stroke(mix('var(--mk-leaf-deep)', 55, 'transparent'))} />
        {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.4} style={fill(mix('var(--mk-leaf-deep)', 50, 'transparent'))} />)}
        <path d={capsule} style={fill(`url(#${id}glow)`)} />
      </g>
      <path d={capsule} fill="none" strokeWidth={3} style={stroke(mix('var(--mk-celadon)', 80, 'var(--mk-white)'))} />
      <path d={inner} fill="none" strokeWidth={1.2} style={stroke(mix('var(--mk-white)', 35, 'transparent'))} />
      {/* The phage, about a tenth of the cell's length, standing on its fibres. */}
      <circle className="tiny-scale__ring" cx={phageX} cy={top - 16} r={28} fill="none" strokeWidth={1.6} strokeDasharray="4 4" style={stroke(mix('var(--mk-sun)', 80, 'transparent'))} />
      <g transform={`translate(${phageX - 200 * scale} ${top - 338 * scale}) scale(${scale})`}><PhageArt rotation={15} tilt={0.12} /></g>
      <path d={`M112 166L134 ${top + 8}`} strokeWidth={1.4} strokeLinecap="round" style={stroke(mix('var(--mk-paper)', 70, 'transparent'))} />
      <path d={`M300 132L${phageX + 18} ${top - 30}`} strokeWidth={1.4} strokeLinecap="round" style={stroke(mix('var(--mk-paper)', 70, 'transparent'))} />
    </svg>
    <span className="tiny-tag tiny-tag--cell" style={{ left: `${112 / VIEW_W * 100}%`, top: `${166 / VIEW_H * 100}%` }}><strong>{words.cellTag}</strong>{words.cellNote}</span>
    <span className="tiny-tag tiny-tag--phage" style={{ left: `${300 / VIEW_W * 100}%`, top: `${132 / VIEW_H * 100}%` }}><strong>{words.phageTag}</strong>{words.phageNote}</span>
  </div>;
}
