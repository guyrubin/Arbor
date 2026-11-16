import { useId } from 'react';
import { FOX_REST, FoxFigure, type FoxPose } from './foxArt';

/** Fox Trail cover: the fox mid-run through bending grass toward the glowing
 * moon-mirror stone, at dusk. Fills its box; one clear subject at 80px. */
const RUN: FoxPose = {
  ...FOX_REST, bob: -3, lean: 0.08,
  frontNear: [-0.95, 0.5], frontFar: [-0.55, 0.9], rearNear: [0.85, -0.1], rearFar: [0.55, 0.05],
  head: -0.06, earNear: -0.32, earFar: -0.3, tailBase: 0.08, tailTip: 0.16,
};
const blades = Array.from({ length: 34 }, (_, i) => {
  const x = -10 + i * 13 + ((i * 37) % 9), h = 26 + ((i * 53) % 30), lean = (x - 166) / 520 + 0.22 * Math.sign(x - 166) * Math.max(0, 1 - Math.abs(x - 166) / 90);
  return { x, h, lean };
});

export default function FoxTrailCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const id = useId().replace(/:/g, '');
  const p = (k: string) => `${id}${k}`;
  return <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={p('sky')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--mk-plum) 72%, var(--mk-indigo-deep))' }} />
        <stop offset=".5" style={{ stopColor: 'color-mix(in srgb, var(--mk-rose-deep) 58%, var(--mk-plum))' }} />
        <stop offset=".9" style={{ stopColor: 'color-mix(in srgb, var(--mk-amber) 70%, var(--mk-orange))' }} />
      </linearGradient>
      <radialGradient id={p('sun')}><stop offset="0" style={{ stopColor: 'var(--mk-sun)', stopOpacity: 0.9 }} /><stop offset="1" style={{ stopColor: 'var(--mk-sun)', stopOpacity: 0 }} /></radialGradient>
      <radialGradient id={p('moon')}><stop offset="0" style={{ stopColor: 'var(--mk-white)' }} /><stop offset=".6" style={{ stopColor: 'color-mix(in srgb, var(--mk-snow) 80%, var(--mk-sky))' }} /><stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-steel-light) 70%, var(--mk-bluebell))' }} /></radialGradient>
      <radialGradient id={p('halo')}><stop offset="0" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0.85 }} /><stop offset=".45" style={{ stopColor: 'var(--mk-sun)', stopOpacity: 0.3 }} /><stop offset="1" style={{ stopColor: 'var(--mk-sun)', stopOpacity: 0 }} /></radialGradient>
      <radialGradient id={p('stone')} cx=".3" cy=".2" r="1"><stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--mk-rose) 50%, var(--mk-sand))' }} /><stop offset=".5" style={{ stopColor: 'color-mix(in srgb, var(--mk-slate) 55%, var(--mk-rose))' }} /><stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-slate) 65%, var(--mk-plum))' }} /></radialGradient>
    </defs>
    <rect width="400" height="300" style={{ fill: `url(#${p('sky')})` }} />
    <circle cx="90" cy="214" r="120" style={{ fill: `url(#${p('sun')})` }} />
    <path d="M-10 196 C 60 170, 120 184, 180 174 C 250 162, 320 178, 410 166 L410 300 L-10 300 Z" style={{ fill: 'color-mix(in srgb, var(--mk-rose) 52%, var(--mk-plum))' }} />
    <path d="M-10 214 C 70 200, 150 212, 230 200 C 300 190, 360 204, 410 196 L410 300 L-10 300 Z" style={{ fill: 'color-mix(in srgb, var(--mk-plum) 78%, var(--mk-umber))' }} />
    {/* birch trunks */}
    {[[30, 12], [58, 9], [368, 11]].map(([x, wd], i) => <g key={i}>
      <path d={`M${x - wd / 2} 236 L${x - wd / 3} -4 L${x + wd / 3} -4 L${x + wd / 2} 236 Z`} style={{ fill: 'color-mix(in srgb, var(--mk-paper-shade) 72%, var(--mk-rose))' }} />
      <path d={`M${x + 1} 236 L${x + 1} -4 L${x + wd / 3} -4 L${x + wd / 2} 236 Z`} style={{ fill: 'color-mix(in srgb, var(--mk-rose-deep) 45%, var(--mk-plum))' }} opacity=".5" />
      {[30, 70, 120, 170].map(y => <path key={y} d={`M${x - wd / 3} ${y + i * 6} q ${wd / 3} -3 ${wd / 1.6} 0 q ${-wd / 3} 2 ${-wd / 1.6} 0 Z`} style={{ fill: 'color-mix(in srgb, var(--mk-plum) 70%, var(--mk-shadow))' }} />)}
    </g>)}
    {/* the stone and its waking mirror */}
    <circle cx="294" cy="150" r="80" style={{ fill: `url(#${p('halo')})` }} />
    <path d="M262 246 C 256 200, 260 130, 282 112 C 298 100, 318 110, 326 134 C 334 170, 332 214, 330 246 Z" style={{ fill: `url(#${p('stone')})` }} />
    <path d="M268 122 C 278 100, 306 98, 320 120 C 306 114, 292 116, 282 124 C 278 136, 270 140, 268 150 Z" style={{ fill: 'color-mix(in srgb, var(--mk-moss) 82%, var(--mk-umber))' }} />
    <circle cx="296" cy="152" r="19" style={{ fill: 'color-mix(in srgb, var(--mk-rose) 50%, var(--mk-sand))' }} />
    <circle cx="296" cy="152" r="15" style={{ fill: `url(#${p('moon')})` }} />
    {/* the trail */}
    <path d="M-10 238 C 80 228, 160 240, 240 234 C 300 230, 360 238, 410 234 L410 300 L-10 300 Z" style={{ fill: 'color-mix(in srgb, var(--mk-umber) 78%, var(--mk-plum))' }} />
    <path d="M-10 238 C 80 228, 160 240, 240 234 C 300 230, 360 238, 410 234 L410 246 C 360 250, 300 242, 240 246 C 160 252, 80 240, -10 250 Z" style={{ fill: 'color-mix(in srgb, var(--mk-clay) 50%, var(--mk-umber))' }} />
    <path d="M-10 238 C 80 228, 160 240, 240 234 C 300 230, 360 238, 410 234" style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-amber) 55%, var(--mk-clay))', strokeWidth: 2.5 }} />
    {/* the fox, leaping */}
    <ellipse cx="160" cy="244" rx="46" ry="5" style={{ fill: 'color-mix(in srgb, var(--mk-shadow) 35%, transparent)' }} />
    <g transform="translate(166 218) scale(1.1)"><FoxFigure pose={RUN} carried={2} /></g>
    {/* the grass bends away from it */}
    <g>
      {blades.map((b, i) => <path key={i} d={`M${b.x - 3} 302 Q ${b.x + Math.sin(b.lean * 0.5) * b.h * 0.6} ${302 - b.h * 0.55} ${b.x + Math.sin(b.lean) * b.h * 1.6} ${302 - Math.cos(b.lean) * b.h * 1.6} Q ${b.x + 3 + Math.sin(b.lean * 0.5) * b.h * 0.6} ${302 - b.h * 0.55} ${b.x + 3} 302 Z`} style={{ fill: i % 3 === 0 ? 'color-mix(in srgb, var(--mk-amber) 48%, var(--mk-moss))' : i % 3 === 1 ? 'color-mix(in srgb, var(--mk-moss) 70%, var(--mk-umber))' : 'color-mix(in srgb, var(--mk-plum) 60%, var(--mk-leaf-deep))' }} />)}
    </g>
    {/* a lantern-seed glowing in the grass */}
    <circle cx="96" cy="262" r="22" style={{ fill: `url(#${p('halo')})` }} />
    <path d="M96 252 C 102 253, 104 258, 103 263 C 102 267, 99 269, 96 269 C 93 269, 90 267, 89 263 C 88 258, 90 253, 96 252 Z" style={{ fill: 'var(--mk-butter)' }} />
  </svg>;
}
