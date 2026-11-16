import { memo, useId, type CSSProperties, type ReactNode } from 'react';
import { CX, FIBRE, VIEW_H, VIEW_W, normDeg, toRad, type Pt } from './phageGeometry';
import PhageArt from './PhageArt';
import { SCALE_STOPS } from './tinyScale';
import { ART_FERN, ART_LEAFLAB } from './tinyKitArt';

/** What the game draws on top of the kit pictures: the white model turntable
 * on Aya's bench, and the living things her lens finds in a drop of pond
 * water (a paramecium, a bacterium, the cell's surface a phage lands on).
 * Drawing units are the 400 x 440 box of phageGeometry. No text in the SVG:
 * the tags are HTML, so both reading directions lay out properly. Nothing here
 * mirrors: the pictures are the same way round in English and Hebrew. */

const mix = (a: string, share: number, b: string) => `color-mix(in srgb, ${a} ${share}%, ${b})`;
const fill = (value: string): CSSProperties => ({ fill: value });
const stroke = (value: string): CSSProperties => ({ stroke: value });
const clear = (a: string, share: number) => mix(a, share, 'transparent');

/* ---------- the bench: the model's turntable ---------- */
export const TABLE = { cy: FIBRE.tip.y, rx: 130, wood: 7, top: 8 } as const;

/** A white ceramic turntable on a pale-wood foot, with a teal ring let into
 * its top (the kit's own table, small). Its rim marks turn with the model,
 * each wire foot leaves a soft contact shadow, and the ring lights for a beat
 * when the model is whole. */
export const Turntable = memo(function Turntable({ rotation, tilt, tips, faint = false, cheer = false }: { rotation: number; tilt: number; tips: (Pt & { near: number })[]; faint?: boolean; cheer?: boolean }) {
  const id = useId();
  const { cy, rx, wood, top } = TABLE, ry = Math.max(1, rx * tilt);
  const disc = (y: number, r: number) => `M${CX - r} ${y}A${r} ${r * tilt} 0 0 0 ${CX + r} ${y}`;
  const side = (y: number, r: number, h: number) => `M${CX - r} ${y}V${y + h}A${r} ${Math.max(1, r * tilt)} 0 0 0 ${CX + r} ${y + h}V${y}Z`;
  return <g className="tiny-table" data-cheer={cheer || undefined}>
    <defs>
      <radialGradient id={`${id}floor`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: clear('var(--mk-shadow)', 34) }} />
        <stop offset=".6" style={{ stopColor: clear('var(--mk-shadow)', 14) }} />
        <stop offset="1" style={{ stopColor: clear('var(--mk-shadow)', 0) }} />
      </radialGradient>
      <linearGradient id={`${id}wood`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" style={{ stopColor: mix('var(--mk-white)', 30, 'var(--mk-wood-light)') }} />
        <stop offset=".4" style={{ stopColor: 'var(--mk-wood-light)' }} />
        <stop offset="1" style={{ stopColor: mix('var(--mk-wood)', 70, 'var(--mk-wood-light)') }} />
      </linearGradient>
      <linearGradient id={`${id}rim`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)' }} />
        <stop offset=".45" style={{ stopColor: 'var(--mk-snow)' }} />
        <stop offset="1" style={{ stopColor: mix('var(--mk-snow-shade)', 70, 'var(--mk-steel-light)') }} />
      </linearGradient>
      <radialGradient id={`${id}top`} cx=".34" cy=".26" r=".9">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)' }} />
        <stop offset=".7" style={{ stopColor: mix('var(--mk-snow)', 70, 'var(--mk-white)') }} />
        <stop offset="1" style={{ stopColor: mix('var(--mk-snow-shade)', 44, 'var(--mk-snow)') }} />
      </radialGradient>
      <radialGradient id={`${id}ao`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: clear('var(--mk-shadow)', 26) }} />
        <stop offset="1" style={{ stopColor: clear('var(--mk-shadow)', 0) }} />
      </radialGradient>
    </defs>
    {/* The soft shadow the stand throws on the bench, away from the window. */}
    <ellipse cx={CX + 14} cy={cy + top + wood + ry * 0.55} rx={rx + 34} ry={ry + 16} style={fill(`url(#${id}floor)`)} />
    <path d={side(cy + top, rx - 8, wood)} style={fill(`url(#${id}wood)`)} />
    <path d={disc(cy + top + wood, rx - 8)} fill="none" strokeWidth={1.2} style={stroke(clear('var(--mk-wood-dark)', 40))} />
    <path d={side(cy, rx, top)} style={fill(`url(#${id}rim)`)} />
    <ellipse cx={CX} cy={cy} rx={rx} ry={ry} style={fill(`url(#${id}top)`)} />
    <ellipse cx={CX} cy={cy} rx={rx} ry={ry} fill="none" strokeWidth={1} style={stroke(clear('var(--mk-white)', 90))} />
    <ellipse className="tiny-table__ring" cx={CX} cy={cy} rx={rx - 15} ry={Math.max(0.5, (rx - 15) * tilt)} fill="none" strokeWidth={3.2} style={stroke(faint ? clear('var(--studio-teal)', 55) : 'var(--studio-teal)')} />
    {/* Fine marks on the ceramic rim: they turn with the model. */}
    {Array.from({ length: 24 }, (_, k) => {
      const a = toRad(normDeg(k * 15 + rotation)), near = Math.sin(a);
      if (near < 0.08) return null;
      const x = CX + rx * Math.cos(a), y = cy + ry * near;
      return <path key={k} d={`M${x.toFixed(1)} ${(y + 2).toFixed(1)}v${k % 6 === 0 ? 5 : 3}`} strokeWidth={k % 6 === 0 ? 1.6 : 1.1} strokeLinecap="round" style={stroke(clear(k % 6 === 0 ? 'var(--studio-teal-ink)' : 'var(--mk-steel-dark)', 34 + near * 40))} />;
    })}
    <ellipse cx={CX + 4} cy={cy + 2} rx={58} ry={Math.max(2, 58 * tilt)} style={fill(`url(#${id}ao)`)} />
    {tips.map((t, i) => <ellipse key={i} cx={t.x + 3.5} cy={t.y + 1.2} rx={10} ry={2.8} style={fill(clear('var(--mk-shadow)', 24))} />)}
  </g>;
});

/* ---------- the lens: a cell's surface, up close ---------- */
/** Where the cell's outer surface meets the fibre tips during landing. */
export const SURFACE_Y = 392;
/** How far the surface reaches towards and away from the eye (it shows as a band whose height follows the view's tilt). */
export const SURFACE_DEPTH = 132;
const LAYERS = { outer: 10, wall: 19, inner: 10, gap: 1 } as const;
/** Fixed spots for the cell's ribosomes (no randomness at render), below the envelope. */
const RIBOSOMES: readonly [number, number, number][] = [[34, 20, 3.2], [70, 39, 2.6], [112, 14, 2.8], [150, 56, 3], [258, 26, 2.6], [292, 50, 3.1], [330, 18, 2.7], [366, 42, 3], [22, 63, 2.4], [384, 68, 2.6], [96, 73, 2.9], [312, 76, 2.5], [180, 88, 2.6], [236, 84, 2.8]];

/** The bacterium seen very close, as a block cut out of its surface: the top
 * of the cell stretching away, and on the cut face its envelope (outer
 * membrane, wall, inner membrane) over the living inside of the cell. */
export const CellSurface = memo(function CellSurface({ tilt, arrived = 0 }: { tilt: number; arrived?: number }) {
  const id = useId();
  const lip = SURFACE_DEPTH * tilt, far = SURFACE_Y - lip, face = SURFACE_Y + lip;
  const band = (a: number, b: number) => `M-40 ${a.toFixed(1)}H440V${b.toFixed(1)}H-40Z`;
  const outer = face, wall = outer + LAYERS.outer + LAYERS.gap, inner = wall + LAYERS.wall + LAYERS.gap, cyto = inner + LAYERS.inner;
  return <g className="tiny-cell">
    <defs>
      <linearGradient id={`${id}top`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" style={{ stopColor: mix('var(--mk-white)', 46, 'var(--mk-spring)') }} />
        <stop offset="1" style={{ stopColor: mix('var(--mk-celadon)', 60, 'var(--mk-spring)') }} />
      </linearGradient>
      <linearGradient id={`${id}cyto`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" style={{ stopColor: mix('var(--mk-spring)', 70, 'var(--mk-leaf)') }} />
        <stop offset="1" style={{ stopColor: mix('var(--mk-leaf)', 76, 'var(--mk-leaf-deep)') }} />
      </linearGradient>
      <radialGradient id={`${id}bloom`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: clear('var(--mk-white)', 70) }} />
        <stop offset="1" style={{ stopColor: clear('var(--mk-white)', 0) }} />
      </radialGradient>
      <pattern id={`${id}lipid`} width="7" height="10" patternUnits="userSpaceOnUse" x="0" y={outer}>
        <circle cx="3.5" cy="2" r="2" style={fill(mix('var(--mk-white)', 50, 'var(--mk-spring)'))} />
        <circle cx="3.5" cy="8" r="2" style={fill(mix('var(--mk-white)', 50, 'var(--mk-spring)'))} />
        <path d="M3.5 3.6v2.8" strokeWidth=".8" style={stroke(clear('var(--mk-leaf)', 60))} />
      </pattern>
      <pattern id={`${id}mesh`} width="9" height="7" patternUnits="userSpaceOnUse">
        <path d="M0 3.5h9M2 0v7M6.5 0v7" strokeWidth="1" style={stroke(mix('var(--mk-moss)', 60, 'var(--mk-sage)'))} />
      </pattern>
      <pattern id={`${id}dots`} width="14" height="6" patternUnits="userSpaceOnUse">
        <ellipse cx="4" cy="2" rx="2.4" ry=".9" style={fill(clear('var(--mk-white)', 55))} />
        <ellipse cx="11" cy="5" rx="2.4" ry=".9" style={fill(clear('var(--mk-leaf)', 22))} />
      </pattern>
    </defs>
    {/* The top of the cell, seen a little from above. */}
    <path d={band(far, face)} style={fill(`url(#${id}top)`)} />
    <path d={band(far, face)} style={fill(`url(#${id}dots)`)} />
    <path d={`M-40 ${far.toFixed(1)}H440`} fill="none" strokeWidth={1.4} style={stroke(clear('var(--mk-white)', 80))} />
    {/* The cut face: the living inside, then the three layers of the envelope. */}
    <path d={band(cyto, 600)} style={fill(`url(#${id}cyto)`)} />
    {RIBOSOMES.map(([x, y, r], i) => <circle key={i} cx={x} cy={cyto + y} r={r} style={fill(clear('var(--mk-leaf-deep)', 42))} />)}
    <path d={`M16 ${cyto + 100}c30-18 60 6 92-6s48-28 84-14`} fill="none" strokeWidth={1.6} strokeLinecap="round" style={stroke(clear('var(--mk-leaf-deep)', 30))} />
    {/* Where the thread arrives the cell brightens a little: the instructions are in. */}
    {arrived > 0 && <ellipse cx={CX} cy={cyto + 34} rx={74} ry={36} opacity={arrived} style={fill(`url(#${id}bloom)`)} />}
    <path d={band(inner, cyto)} style={fill(mix('var(--mk-celadon)', 70, 'var(--mk-leaf)'))} />
    <path d={band(inner, cyto)} style={fill(`url(#${id}lipid)`)} opacity={0.85} />
    <path d={band(wall, inner - LAYERS.gap)} style={fill(mix('var(--mk-sage)', 66, 'var(--mk-leaf)'))} />
    <path d={band(wall, inner - LAYERS.gap)} style={fill(`url(#${id}mesh)`)} opacity={0.75} />
    <path d={band(outer, wall - LAYERS.gap)} style={fill(mix('var(--mk-celadon)', 60, 'var(--mk-spring)'))} />
    <path d={band(outer, wall - LAYERS.gap)} style={fill(`url(#${id}lipid)`)} opacity={0.9} />
    <path d={`M-40 ${face.toFixed(1)}H440`} fill="none" strokeWidth={1.8} style={stroke(clear('var(--mk-white)', 85))} />
  </g>;
});
/** The near part of the cell's top, drawn over the tube so the tube is seen going down into the cell. */
export function SurfaceLip({ tilt }: { tilt: number }) {
  const lip = SURFACE_DEPTH * tilt;
  return <g className="tiny-cell__lip">
    <path d={`M-40 ${SURFACE_Y}H440V${(SURFACE_Y + lip).toFixed(1)}H-40Z`} style={fill(clear(mix('var(--mk-celadon)', 60, 'var(--mk-spring)'), 62))} />
    <ellipse cx={CX} cy={SURFACE_Y + 0.5} rx={9} ry={Math.max(1, 9 * tilt)} style={fill(clear('var(--mk-leaf-deep)', 50))} />
  </g>;
}
/** Soft rings where the six feet touch the cell. */
export function TouchRings({ tips, nonce }: { tips: Pt[]; nonce: number }) {
  return <g key={nonce} className="tiny-touch">{tips.map((t, i) => <ellipse key={i} cx={t.x} cy={t.y} rx={9} ry={3} fill="none" strokeWidth={1.6} style={{ ...stroke(clear('var(--mk-white)', 90)), animationDelay: `${i * 40}ms` }} />)}</g>;
}

/* ---------- the lens: the stops of the zoom ---------- */
const stop = (id: string) => SCALE_STOPS.find(s => s.id === id)!;
function Ring({ at }: { at: { x: number; y: number; r: number } | null }) {
  return at ? <circle className="tiny-zoom__ring" cx={at.x} cy={at.y} r={at.r} fill="none" strokeWidth={2.4} strokeDasharray="5 5" strokeLinecap="round" style={stroke('var(--studio-signal)')} /> : null;
}
function Scene({ children, tags }: { children: ReactNode; tags?: ReactNode }) {
  return <>
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice" style={{ direction: 'ltr' }} aria-hidden="true" focusable="false">{children}</svg>
    {tags}
  </>;
}
export function Tag({ x, y, name, note, side = 'above' }: { x: number; y: number; name: string; note?: string; side?: 'above' | 'below' }) {
  return <span className="tiny-tag" data-side={side} style={{ left: `${x / VIEW_W * 100}%`, top: `${y / VIEW_H * 100}%` }}><strong>{name}</strong>{note}</span>;
}

/** Stop 1, what the ProofLens records: Aya's LeafLab among the fern, with one
 * drop of pond water on its lid. The pictures are the kit's; this adds the
 * drop and the ring. */
export const LeafScene = memo(function LeafScene({ dropName, dropNote }: { dropName: string; dropNote: string }) {
  const id = useId(), at = stop('leaf').ring!, r = stop('leaf').bigUnits / 2;
  return <Scene tags={<Tag x={at.x} y={at.y - at.r - 8} name={dropName} note={dropNote} />}>
    <defs>
      <radialGradient id={`${id}drop`} cx=".36" cy=".3" r=".8">
        <stop offset="0" style={{ stopColor: clear('var(--mk-white)', 92) }} />
        <stop offset=".45" style={{ stopColor: clear('var(--mk-sky-pale)', 62) }} />
        <stop offset="1" style={{ stopColor: clear('var(--mk-sea)', 58) }} />
      </radialGradient>
    </defs>
    <image href={ART_FERN.src} x={-90} y={-40} width={580} height={520} preserveAspectRatio="xMidYMid slice" />
    <image href={ART_LEAFLAB.src} x={at.x - 100} y={at.y - 84} width={200} height={178} />
    <ellipse cx={at.x + 2.5} cy={at.y + r * 0.8} rx={r * 1.05} ry={r * 0.42} style={fill(clear('var(--mk-shadow)', 36))} />
    <circle cx={at.x} cy={at.y} r={r} style={fill(`url(#${id}drop)`)} />
    <circle cx={at.x} cy={at.y} r={r} fill="none" strokeWidth={1.1} style={stroke(clear('var(--mk-white)', 85))} />
    <ellipse cx={at.x - r * 0.36} cy={at.y - r * 0.42} rx={r * 0.26} ry={r * 0.16} transform={`rotate(-32 ${at.x - r * 0.36} ${at.y - r * 0.42})`} style={fill('var(--mk-white)')} />
    <path d={`M${at.x + r * 0.2} ${at.y + r * 0.62}a${r * 0.7} ${r * 0.7} 0 0 0 ${r * 0.5} ${-r * 0.5}`} fill="none" strokeWidth={1.2} strokeLinecap="round" style={stroke(clear('var(--mk-white)', 70))} />
    <Ring at={at} />
  </Scene>;
});

/** Stop 2, inside the drop: a paramecium, one living cell that swims with its
 * coat of tiny hairs, and beside it bacteria: specks a hundred times shorter. */
export const SwimmerScene = memo(function SwimmerScene({ swimmerName, swimmerNote, cellName }: { swimmerName: string; swimmerNote: string; cellName: string }) {
  const id = useId(), s = stop('swimmer'), half = s.bigUnits / 2, wide = 39;
  const body = `M${-half} 2C${-half} -27 ${-half * 0.52} ${-wide} 0 ${-wide + 1}C${half * 0.5} ${-wide + 3} ${half * 0.9} -25 ${half} -3C${half + 3} 8 ${half * 0.92} 22 ${half * 0.5} 33C0 ${wide + 4} ${-half * 0.66} ${wide} ${-half * 0.92} 22C${-half * 0.98} 15 ${-half} 9 ${-half} 2Z`;
  // The coat of cilia: short hairs all round, leaning back as it swims.
  const cilia = Array.from({ length: 64 }, (_, i) => {
    const a = i / 64 * Math.PI * 2, c = Math.cos(a), n = Math.sin(a);
    const x = (half + 1) * c, y = (wide + (c > 0 ? -3 : 1) * Math.abs(c) * 6) * n + (c > 0.7 ? -2 : 0);
    return `M${x.toFixed(1)} ${y.toFixed(1)}l${(c * 5 + 3.4).toFixed(1)} ${(n * 6.5).toFixed(1)}`;
  }).join('');
  const speck = (x: number, y: number, turn: number, key: number) => <ellipse key={key} cx={x} cy={y} rx={s.smallUnits / 2} ry={s.smallUnits / 5} transform={`rotate(${turn} ${x} ${y})`} style={fill(mix('var(--mk-leaf)', 70, 'var(--mk-leaf-deep)'))} />;
  const specks: [number, number, number][] = [[92, 114, 20], [100, 122, -40], [88, 124, 70], [42, 196, 10], [330, 96, -20], [352, 302, 50], [300, 372, 0], [64, 348, 35], [182, 70, -60], [364, 180, 15], [30, 60, 80], [228, 400, -30], [130, 396, 25]];
  const vacuole = (x: number, y: number) => <g>
    {Array.from({ length: 7 }, (_, k) => { const a = k / 7 * Math.PI * 2; return <path key={k} d={`M${x + Math.cos(a) * 8} ${y + Math.sin(a) * 8}L${x + Math.cos(a) * 16} ${y + Math.sin(a) * 15}`} strokeWidth={1.6} strokeLinecap="round" style={stroke(clear('var(--mk-white)', 70))} />; })}
    <circle cx={x} cy={y} r={7.5} style={fill(clear('var(--mk-white)', 78))} />
    <circle cx={x} cy={y} r={7.5} fill="none" strokeWidth={1} style={stroke(clear('var(--mk-celadon-deep)', 60))} />
  </g>;
  return <Scene tags={<>
    <Tag x={236} y={356} name={swimmerName} note={swimmerNote} side="below" />
    <Tag x={s.ring!.x + 26} y={s.ring!.y - s.ring!.r - 6} name={cellName} />
  </>}>
    <defs>
      <radialGradient id={`${id}body`} cx=".38" cy=".3" r=".85">
        <stop offset="0" style={{ stopColor: clear('var(--mk-white)', 78) }} />
        <stop offset=".5" style={{ stopColor: clear(mix('var(--mk-spring)', 50, 'var(--mk-celadon)'), 76) }} />
        <stop offset="1" style={{ stopColor: clear('var(--mk-celadon-deep)', 80) }} />
      </radialGradient>
      <radialGradient id={`${id}shade`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: clear('var(--mk-teal-deep)', 26) }} />
        <stop offset="1" style={{ stopColor: clear('var(--mk-teal-deep)', 0) }} />
      </radialGradient>
    </defs>
    {specks.map(([x, y, t], i) => speck(x, y, t, i))}
    <g className="tiny-swimmer" data-toy="swimmer">
      <g transform="translate(214 246) rotate(-27)">
        <ellipse cx={14} cy={30} rx={half * 0.96} ry={wide * 0.9} style={fill(`url(#${id}shade)`)} />
        <path className="tiny-swimmer__cilia" d={cilia} fill="none" strokeWidth={1.3} strokeLinecap="round" style={stroke(clear('var(--mk-celadon-deep)', 70))} />
        <path d={body} style={fill(`url(#${id}body)`)} />
        {/* The groove food is swept along, to the mouth. */}
        <path d={`M${-half * 0.62} -14C${-half * 0.3} 0 ${-half * 0.12} 8 ${half * 0.02} 13`} fill="none" strokeWidth={9} strokeLinecap="round" style={stroke(clear('var(--mk-celadon-deep)', 34))} />
        <circle cx={half * 0.05} cy={16} r={5.5} style={fill(clear('var(--mk-leaf-deep)', 36))} />
        {/* The big nucleus and the small one beside it. */}
        <ellipse cx={half * 0.22} cy={-9} rx={21} ry={11} transform={`rotate(14 ${half * 0.22} -9)`} style={fill(clear('var(--mk-leaf-deep)', 46))} />
        <circle cx={half * 0.04} cy={-16} r={4} style={fill(clear('var(--mk-leaf-deep)', 62))} />
        {vacuole(-half * 0.66, 6)}{vacuole(half * 0.66, 3)}
        {[[-half * 0.34, 20, 5], [-half * 0.2, -22, 4.2], [half * 0.4, 17, 5.4], [half * 0.5, -14, 3.8], [-half * 0.02, 28, 4]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} style={fill(clear('var(--mk-moss)', 52))} />)}
        <path d={body} fill="none" strokeWidth={2} style={stroke(clear('var(--mk-white)', 85))} />
        <path d={`M${-half * 0.84} -16C${-half * 0.5} ${-wide + 6} ${half * 0.2} ${-wide + 7} ${half * 0.62} -24`} fill="none" strokeWidth={3.4} strokeLinecap="round" style={stroke(clear('var(--mk-white)', 70))} />
      </g>
    </g>
    <Ring at={s.ring} />
  </Scene>;
});

/** Stop 3: one bacterium, a living cell with its own insides, and standing on
 * it, about a tenth of its length, a phage. Below, ten phages laid end to end
 * measure the cell. */
export const CellScene = memo(function CellScene({ cellName, cellNote, phageName, phageNote }: { cellName: string; cellNote: string; phageName: string; phageNote: string }) {
  const id = useId(), s = stop('cell');
  const left = 38, right = left + s.bigUnits, top = 206, bottom = 334, r = (bottom - top) / 2;
  const capsule = `M${left + r} ${top}H${right - r}A${r} ${r} 0 0 1 ${right - r} ${bottom}H${left + r}A${r} ${r} 0 0 1 ${left + r} ${top}Z`;
  const inner = `M${left + r} ${top + 9}H${right - r}A${r - 9} ${r - 9} 0 0 1 ${right - r} ${bottom - 9}H${left + r}A${r - 9} ${r - 9} 0 0 1 ${left + r} ${top + 9}Z`;
  // The phage stands 298 units tall in its own drawing: a tenth of the cell here.
  const scale = s.smallUnits / 298, phageX = s.ring!.x;
  const dots: [number, number][] = [[96, 250], [118, 296], [140, 236], [172, 312], [206, 248], [236, 300], [262, 236], [290, 288], [318, 250], [330, 302], [86, 284], [150, 270], [276, 318], [226, 226], [190, 290], [304, 230]];
  const step = s.bigUnits / 10;
  return <Scene tags={<>
    <Tag x={120} y={top - 26} name={cellName} note={cellNote} />
    <Tag x={phageX + 44} y={s.ring!.y - s.ring!.r - 8} name={phageName} note={phageNote} />
  </>}>
    <defs>
      <linearGradient id={`${id}cell`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" style={{ stopColor: mix('var(--mk-white)', 40, 'var(--mk-spring)') }} />
        <stop offset=".5" style={{ stopColor: mix('var(--mk-spring)', 60, 'var(--mk-leaf)') }} />
        <stop offset="1" style={{ stopColor: mix('var(--mk-leaf)', 70, 'var(--mk-leaf-deep)') }} />
      </linearGradient>
      <radialGradient id={`${id}glow`} cx=".3" cy=".2" r=".8">
        <stop offset="0" style={{ stopColor: clear('var(--mk-white)', 62) }} />
        <stop offset="1" style={{ stopColor: clear('var(--mk-white)', 0) }} />
      </radialGradient>
      <radialGradient id={`${id}shadow`} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: clear('var(--mk-teal-deep)', 30) }} />
        <stop offset="1" style={{ stopColor: clear('var(--mk-teal-deep)', 0) }} />
      </radialGradient>
      <clipPath id={`${id}clip`}><path d={capsule} /></clipPath>
      <g id={`${id}one`}><g transform={`scale(${scale})`}><PhageArt rotation={15} tilt={0.12} paint="real" /></g></g>
    </defs>
    <ellipse cx={212} cy={bottom + 20} rx={176} ry={18} style={fill(`url(#${id}shadow)`)} />
    {/* Flagella: the cell's own long whips, trailing from one end. */}
    <g className="tiny-whips">{[0, 1, 2].map(k => <path key={k} d={`M${left + 8} ${258 + k * 16}c-14 ${-8 + k * 6} -16 ${18 - k * 4} -30 ${10 + k * 5}s-14 ${20 - k * 8} -26 ${12 + k * 4}`} fill="none" strokeWidth={1.8} strokeLinecap="round" style={stroke(clear('var(--mk-leaf)', 70))} />)}</g>
    <path d={capsule} style={fill(`url(#${id}cell)`)} opacity={0.92} />
    <g clipPath={`url(#${id}clip)`}>
      <path d={inner} style={fill(clear('var(--mk-spring)', 34))} />
      {/* The cell's own DNA, loosely gathered in the middle. */}
      <path d="M150 268c18-26 52-20 60 0s-30 34-46 18 10-40 42-36 52 14 44 34-38 18-46 2 18-26 40-18" fill="none" strokeWidth={2.2} strokeLinecap="round" style={stroke(clear('var(--mk-leaf-deep)', 52))} />
      {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} style={fill(clear('var(--mk-leaf-deep)', 46))} />)}
      <path d={capsule} style={fill(`url(#${id}glow)`)} />
    </g>
    <path d={capsule} fill="none" strokeWidth={3} style={stroke(mix('var(--mk-white)', 50, 'var(--mk-celadon)'))} />
    <path d={inner} fill="none" strokeWidth={1.2} style={stroke(clear('var(--mk-white)', 55))} />
    {/* The phage, about a tenth of the cell's length, standing on its fibres. */}
    <ellipse cx={phageX + 1.5} cy={top + 0.8} rx={13} ry={2.2} style={fill(clear('var(--mk-leaf-deep)', 40))} />
    <use href={`#${id}one`} transform={`translate(${phageX - CX * scale} ${top - FIBRE.tip.y * scale})`} />
    {/* Ten phages, end to end, are about as long as the cell. */}
    <g className="tiny-ruler" opacity={0.62}>
      <path d={`M${left} ${bottom + 40}H${right}`} strokeWidth={1.2} strokeLinecap="round" style={stroke(clear('var(--studio-graphite)', 45))} />
      {Array.from({ length: 11 }, (_, k) => <path key={k} d={`M${left + k * step} ${bottom + 36}v8`} strokeWidth={1.2} strokeLinecap="round" style={stroke(clear('var(--studio-graphite)', 45))} />)}
      {Array.from({ length: 10 }, (_, k) => <use key={k} href={`#${id}one`} transform={`translate(${left + k * step + 0.6} ${bottom + 70}) rotate(-90) translate(${-CX * scale} ${-40 * scale})`} />)}
    </g>
    <Ring at={s.ring} />
  </Scene>;
});
