import { memo, useId, type CSSProperties, type ReactNode } from 'react';
import { CX, FIBRE, VIEW_H, VIEW_W, normDeg, toRad, type Pt } from './phageGeometry';

/** The cover's turntable (SVG): the white model stand on the TrailBench.
 * Drawing units are the 400 x 440 box of phageGeometry. The game itself is
 * painted on a canvas (tinyBench.ts); this is only for the cover picture. */

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
