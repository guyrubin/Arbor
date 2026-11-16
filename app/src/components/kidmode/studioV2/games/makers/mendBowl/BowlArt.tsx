/** The one bowl drawing, shared by the play, the saved Preview and the Cover.
 * Matte glaze in 3/4 view, one light from the top-left: a two-stop body, a
 * soft specular band, a darker inside where the glaze pools, a thin lighter
 * rim and an unglazed clay foot. Gold seams are ribbons of slightly uneven
 * width laid on the very polylines that divide the pieces. All colour comes
 * from the makers' palette through var() and color-mix(). */
import { memo } from 'react';
import { pointInPolygon, samplePolyline, type BowlGlaze, type BowlPattern, type Point } from './mendBowlRules';
import { BOWL_PATTERNS, FOOT, OUTLINE_D, OUTLINE_POINTS, RIM, STAGE, polyD } from './mendBowlPatterns';

const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, var(${a}) ${pct}%, ${b.startsWith('--') ? `var(${b})` : b})`;
export interface GlazeTone { light: string; base: string; deep: string; inLight: string; inDeep: string; speck: string; rim: string }
export const GLAZE_TONES: Record<BowlGlaze, GlazeTone> = {
  celadon: { light: mix('--mk-celadon', 55, '--mk-white'), base: 'var(--mk-celadon)', deep: mix('--mk-celadon-deep', 85, '--mk-indigo'), inLight: mix('--mk-celadon', 70, '--mk-white'), inDeep: mix('--mk-celadon-deep', 80, '--mk-teal-deep'), speck: 'var(--mk-umber)', rim: mix('--mk-celadon', 35, '--mk-white') },
  indigo: { light: mix('--mk-sky', 55, '--mk-bluebell'), base: mix('--mk-bluebell', 55, '--mk-indigo'), deep: 'var(--mk-indigo-deep)', inLight: mix('--mk-bluebell', 80, '--mk-sky'), inDeep: mix('--mk-indigo-deep', 70, '--mk-night'), speck: 'var(--mk-sky-pale)', rim: mix('--mk-bluebell', 45, '--mk-sky-pale') },
  rose: { light: mix('--mk-blossom', 80, '--mk-white'), base: 'var(--mk-rose)', deep: mix('--mk-rose-deep', 85, '--mk-plum'), inLight: 'var(--mk-blossom)', inDeep: mix('--mk-rose-deep', 75, '--mk-plum'), speck: 'var(--mk-plum)', rim: mix('--mk-blossom', 55, '--mk-white') },
  cream: { light: 'var(--mk-white)', base: 'var(--mk-cream)', deep: mix('--mk-sand', 80, '--mk-clay'), inLight: 'var(--mk-white)', inDeep: mix('--mk-sand', 85, '--mk-wood'), speck: 'var(--mk-umber)', rim: 'var(--mk-white)' },
};
const stop = (offset: number | string, color: string, opacity = 1) => <stop offset={offset} style={{ stopColor: color, stopOpacity: opacity }} />;

/** Fixed glaze speckles (iron spots), inside the silhouette only. */
const SPECKS: readonly { x: number; y: number; r: number }[] = (() => {
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; out.length < 34 && i < 400; i++) {
    const h = (n: number) => { const s = Math.sin(n * 91.7 + i * 12.9898) * 43758.5453; return s - Math.floor(s); };
    const p = { x: 92 + h(1) * 256, y: 86 + h(2) * 186 };
    if (pointInPolygon(p, OUTLINE_POINTS)) out.push({ ...p, r: 0.5 + h(3) * 0.8 });
  }
  return out;
})();

/** The bowl itself (no seams), in stage units. `uid` keeps gradient ids unique per drawing. */
export const BowlBody = memo(function BowlBody({ glaze, uid, shadow = true }: { glaze: BowlGlaze; uid: string; shadow?: boolean }) {
  const t = GLAZE_TONES[glaze], id = (s: string) => `${uid}-${s}`, url = (s: string) => `url(#${id(s)})`;
  const inner = { rx: RIM.rx - 6, ry: RIM.ry - 4 };
  return <g data-bowl-glaze={glaze}>
    <defs>
      <linearGradient id={id('body')} gradientUnits="userSpaceOnUse" x1="96" y1="112" x2="330" y2="270">{stop(0, t.light)}{stop(0.38, t.base)}{stop(1, t.deep)}</linearGradient>
      <radialGradient id={id('core')} gradientUnits="userSpaceOnUse" cx="170" cy="150" r="200">{stop(0, t.deep, 0)}{stop(0.55, t.deep, 0)}{stop(1, t.deep, 0.75)}</radialGradient>
      <linearGradient id={id('spec')} x1="0" y1="0" x2="0" y2="1">{stop(0, 'var(--mk-white)', 0.7)}{stop(1, 'var(--mk-white)', 0)}</linearGradient>
      <radialGradient id={id('inside')} gradientUnits="userSpaceOnUse" cx="262" cy="112" r="150">{stop(0, t.inLight)}{stop(0.5, t.base)}{stop(1, t.inDeep)}</radialGradient>
      <radialGradient id={id('innerPool')} gradientUnits="userSpaceOnUse" cx="226" cy="138" r="64" gradientTransform="translate(226 138) scale(1 .3) translate(-226 -138)">{stop(0, t.inDeep, 0.55)}{stop(1, t.inDeep, 0)}</radialGradient>
      <linearGradient id={id('rim')} gradientUnits="userSpaceOnUse" x1="82" y1="80" x2="358" y2="160">{stop(0, t.rim)}{stop(0.6, t.light)}{stop(1, t.base)}</linearGradient>
      <linearGradient id={id('foot')} gradientUnits="userSpaceOnUse" x1="168" y1="256" x2="272" y2="279">{stop(0, 'var(--mk-clay-pale)')}{stop(0.45, 'var(--mk-clay-light)')}{stop(1, 'var(--mk-clay)')}</linearGradient>
      <radialGradient id={id('contact')} gradientUnits="userSpaceOnUse" cx="230" cy="276" r="110" gradientTransform="translate(230 276) scale(1 .2) translate(-230 -276)">{stop(0, 'var(--mk-shadow)', 0.55)}{stop(0.5, 'var(--mk-shadow)', 0.22)}{stop(1, 'var(--mk-shadow)', 0)}</radialGradient>
      <clipPath id={id('clip')}><path d={OUTLINE_D} /></clipPath>
      <clipPath id={id('inner')}><ellipse cx={RIM.cx} cy={RIM.cy + 1} rx={inner.rx} ry={inner.ry} /></clipPath>
    </defs>
    {shadow && <ellipse cx="232" cy="276" rx="118" ry="24" fill={url('contact')} />}
    <path d={OUTLINE_D} fill={url('body')} />
    <g clipPath={url('clip')}>
      <path d={OUTLINE_D} fill={url('core')} />
      {/* Bounce light from the cloth along the lower right edge. */}
      <path d="M336 192C320 228 296 248 268 256" fill="none" strokeWidth="7" strokeLinecap="round" opacity=".18" style={{ stroke: t.light }} />
      {/* The soft specular band on the lit side, and one crisp glint. */}
      <path d="M98 140C100 182 118 214 150 238C134 212 120 182 116 142Z" fill={url('spec')} opacity=".75" />
      <path d="M100 136C102 152 106 164 112 174" fill="none" strokeWidth="3.4" strokeLinecap="round" opacity=".7" style={{ stroke: 'var(--mk-white)' }} />
      {SPECKS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity=".32" style={{ fill: t.speck }} />)}
    </g>
    {/* The rim: a lighter lip, then the inside where the glaze pools darker. */}
    <ellipse cx={RIM.cx} cy={RIM.cy} rx={RIM.rx} ry={RIM.ry} fill={url('rim')} />
    <ellipse cx={RIM.cx} cy={RIM.cy + 1} rx={inner.rx} ry={inner.ry} fill={url('inside')} />
    {/* The rim's own shadow on the inside wall, away from the light. */}
    <g clipPath={url('inner')}><path fillRule="evenodd" d={`M${RIM.cx - inner.rx} ${RIM.cy + 1}a${inner.rx} ${inner.ry} 0 1 0 ${inner.rx * 2} 0a${inner.rx} ${inner.ry} 0 1 0 ${-inner.rx * 2} 0ZM${RIM.cx - inner.rx + 20} ${RIM.cy + 9}a${inner.rx} ${inner.ry} 0 1 0 ${inner.rx * 2} 0a${inner.rx} ${inner.ry} 0 1 0 ${-inner.rx * 2} 0Z`} opacity=".3" style={{ fill: t.inDeep }} /></g>
    <ellipse cx="226" cy="138" rx="64" ry="18" fill={url('innerPool')} />
    {SPECKS.filter((_, i) => i % 3 === 0).map((s, i) => <circle key={i} cx={RIM.cx + (s.x - RIM.cx) * 0.8} cy={RIM.cy + 4 + (s.y - 178) * 0.12} r={s.r * 0.8} opacity=".24" style={{ fill: t.speck }} />)}
    <path d={`M${RIM.cx - RIM.rx + 1} ${RIM.cy}A${RIM.rx - 1} ${RIM.ry - 1} 0 0 0 ${RIM.cx + RIM.rx - 1} ${RIM.cy}`} fill="none" strokeWidth="1.6" opacity=".55" style={{ stroke: t.rim }} />
    <path d={`M${RIM.cx - RIM.rx + 3} ${RIM.cy - 3}A${RIM.rx} ${RIM.ry} 0 0 1 ${RIM.cx - 30} ${RIM.cy - RIM.ry + 0.6}`} fill="none" strokeWidth="1.8" strokeLinecap="round" opacity=".8" style={{ stroke: 'var(--mk-white)' }} />
    {/* The unglazed foot ring, and the rolled edge where the glaze stops. */}
    <path d={`M170 ${FOOT.topY}L168 ${FOOT.y}A${FOOT.rx} ${FOOT.ry} 0 0 0 272 ${FOOT.y}L270 ${FOOT.topY}A${FOOT.topRx} ${FOOT.topRy} 0 0 1 170 ${FOOT.topY}Z`} fill={url('foot')} />
    <path d={`M169 ${FOOT.y + 1}A${FOOT.rx} ${FOOT.ry} 0 0 0 271 ${FOOT.y + 1}`} fill="none" strokeWidth="1.4" opacity=".35" style={{ stroke: 'var(--mk-umber)' }} />
    <path d={`M170 ${FOOT.topY}A${FOOT.topRx} ${FOOT.topRy} 0 0 0 270 ${FOOT.topY}`} fill="none" strokeWidth="2.6" opacity=".75" style={{ stroke: t.deep }} />
  </g>;
});

/** A gold ribbon along a seam: tapered ends, a gently uneven width. */
export function ribbonD(points: readonly Point[], seed: number): string {
  const s = samplePolyline(points, 2.5), n = s.length, total = (n - 1) * 2.5, left: Point[] = [], right: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const along = i * 2.5, taper = Math.min(1, along / 9, (total - along) / 9) * 0.65 + 0.35;
    const w = 1.85 * taper * (1 + 0.32 * Math.sin(along * 0.19 + seed * 1.7) + 0.18 * Math.sin(along * 0.53 + seed * 3.1));
    left.push({ x: s[i].x - dy / len * w, y: s[i].y + dx / len * w }); right.push({ x: s[i].x + dy / len * w, y: s[i].y - dx / len * w });
  }
  return polyD([...left, ...right.reverse()], true);
}
/** The gold layer of one seam (no mask): lacquer, its shade and its highlight. */
export function GoldRibbon({ points, seed, uid }: { points: readonly Point[]; seed: number; uid: string }) {
  const d = polyD(points);
  return <g>
    <path d={d} fill="none" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" transform="translate(.7 1)" opacity=".45" style={{ stroke: 'var(--mk-gold-deep)' }} />
    <path d={ribbonD(points, seed)} fill={`url(#${uid}-gold)`} />
    <path d={d} fill="none" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round" transform="translate(-.5 -.6)" opacity=".9" style={{ stroke: 'var(--mk-gold-light)' }} />
  </g>;
}
export function GoldDefs({ uid }: { uid: string }) {
  return <linearGradient id={`${uid}-gold`} gradientUnits="userSpaceOnUse" x1="110" y1="80" x2="330" y2="280">{stop(0, 'var(--mk-gold-light)')}{stop(0.42, 'var(--mk-gold)')}{stop(0.7, mix('--mk-gold', 70, '--mk-gold-light'))}{stop(1, 'var(--mk-gold-deep)')}</linearGradient>;
}
/** The mended bowl: body and every seam in gold. The Preview and the Cover draw this. */
export function MendedBowl({ glaze, pattern, uid }: { glaze: BowlGlaze; pattern: BowlPattern; uid: string }) {
  return <g>
    <defs><GoldDefs uid={uid} /><clipPath id={`${uid}-gclip`}><path d={OUTLINE_D} /></clipPath></defs>
    <BowlBody glaze={glaze} uid={uid} />
    <g clipPath={`url(#${uid}-gclip)`}>{BOWL_PATTERNS[pattern].seams.map((seam, i) => <GoldRibbon key={i} points={seam.points} seed={i + pattern * 7} uid={uid} />)}</g>
  </g>;
}

/** Muted indigo linen: a visible low-contrast weave, stitched hem, soft drape light. */
export function LinenCloth({ uid, shape = 'stage' }: { uid: string; shape?: 'stage' | 'full' }) {
  const id = (s: string) => `${uid}-${s}`;
  const d = shape === 'full' ? `M-20 -20H${STAGE.w + 20}V${STAGE.h + 20}H-20Z` : 'M52 34Q220 26 388 34Q400 35 402 48L428 362Q429 378 412 379Q220 386 28 379Q11 378 12 362L38 48Q40 35 52 34Z';
  return <g>
    <defs>
      <pattern id={id('weave')} width="5" height="5" patternUnits="userSpaceOnUse">
        <rect width="5" height="1.4" opacity=".1" style={{ fill: 'var(--mk-chalk)' }} />
        <rect x="2.5" width="1.3" height="5" opacity=".1" style={{ fill: 'var(--mk-chalk)' }} />
        <rect y="3" width="5" height="1" opacity=".1" style={{ fill: 'var(--mk-night)' }} />
        <rect x="0.4" width="1" height="5" opacity=".08" style={{ fill: 'var(--mk-night)' }} />
      </pattern>
      <linearGradient id={id('linen')} x1="0" y1="0" x2=".7" y2="1">{stop(0, mix('--mk-slate', 62, '--mk-storm-grey'))}{stop(0.5, mix('--mk-indigo', 50, '--mk-slate'))}{stop(1, mix('--mk-indigo-deep', 70, '--mk-slate'))}</linearGradient>
      <linearGradient id={id('drape')} x1="0" y1="0" x2="1" y2=".4">{stop(0, 'var(--mk-sky-pale)', 0)}{stop(0.45, 'var(--mk-sky-pale)', 0.1)}{stop(0.6, 'var(--mk-sky-pale)', 0)}</linearGradient>
    </defs>
    {shape === 'stage' && <path d={d} transform="translate(5 8)" opacity=".2" style={{ fill: 'var(--mk-shadow)' }} />}
    <path d={d} fill={`url(#${id('linen')})`} />
    <path d={d} fill={`url(#${id('weave')})`} />
    <path d={d} fill={`url(#${id('drape')})`} />
    {shape === 'stage' && <path d="M60 48Q220 41 380 48L404 356Q220 364 36 356Z" fill="none" strokeWidth="1.6" strokeDasharray="5 4" opacity=".4" style={{ stroke: 'var(--mk-linen)' }} />}
  </g>;
}
