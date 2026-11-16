/** The one bowl drawing, shared by the play, the saved Preview and the Cover.
 * The bowl is seen from directly above, because it sits on the kit's round
 * workshop table, which is photographed from above. It is shaded in code to
 * belong to that picture: daylight from the upper left (the table's window),
 * so the near-left inside wall is in the rim's shade, the far-right inside
 * wall catches the light, the glaze pools darker in the well, and the shadow
 * falls to the lower right. Gold seams are ribbons of slightly uneven width
 * laid on the very polylines that divide the pieces. All colour comes from
 * the makers' palette through var() and color-mix(). */
import { memo } from 'react';
import { samplePolyline, type BowlGlaze, type BowlPattern, type Point } from './mendBowlRules';
import { BOWL_CENTRE, BOWL_PATTERNS, BOWL_R, LINEN_R, OUTLINE_D, polyD } from './mendBowlPatterns';
import { KIT_TABLE } from './mendKit';

const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, var(${a}) ${pct}%, ${b.startsWith('--') ? `var(${b})` : b})`;
export interface GlazeTone { light: string; base: string; deep: string; inLight: string; inDeep: string; speck: string; rim: string }
export const GLAZE_TONES: Record<BowlGlaze, GlazeTone> = {
  celadon: { light: mix('--mk-celadon', 55, '--mk-white'), base: 'var(--mk-celadon)', deep: mix('--mk-celadon-deep', 85, '--mk-indigo'), inLight: mix('--mk-celadon', 70, '--mk-white'), inDeep: mix('--mk-celadon-deep', 80, '--mk-teal-deep'), speck: 'var(--mk-umber)', rim: mix('--mk-celadon', 35, '--mk-white') },
  indigo: { light: mix('--mk-sky', 55, '--mk-bluebell'), base: mix('--mk-bluebell', 55, '--mk-indigo'), deep: 'var(--mk-indigo-deep)', inLight: mix('--mk-bluebell', 80, '--mk-sky'), inDeep: mix('--mk-indigo-deep', 70, '--mk-night'), speck: 'var(--mk-sky-pale)', rim: mix('--mk-bluebell', 45, '--mk-sky-pale') },
  rose: { light: mix('--mk-blossom', 80, '--mk-white'), base: 'var(--mk-rose)', deep: mix('--mk-rose-deep', 85, '--mk-plum'), inLight: 'var(--mk-blossom)', inDeep: mix('--mk-rose-deep', 75, '--mk-plum'), speck: 'var(--mk-plum)', rim: mix('--mk-blossom', 55, '--mk-white') },
  cream: { light: 'var(--mk-white)', base: 'var(--mk-cream)', deep: mix('--mk-sand', 80, '--mk-clay'), inLight: 'var(--mk-white)', inDeep: mix('--mk-sand', 85, '--mk-wood'), speck: 'var(--mk-umber)', rim: 'var(--mk-white)' },
};
const stop = (offset: number | string, color: string, opacity = 1) => <stop offset={offset} style={{ stopColor: color, stopOpacity: opacity }} />;
const C = BOWL_CENTRE, R = BOWL_R;
/** A point on a circle about the bowl's centre; 0° is to the right, angles run clockwise on screen. */
const on = (radius: number, deg: number): Point => ({ x: C.x + radius * Math.cos(deg * Math.PI / 180), y: C.y + radius * Math.sin(deg * Math.PI / 180) });
const arc = (radius: number, from: number, to: number) => { const a = on(radius, from), b = on(radius, to); return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}A${radius} ${radius} 0 ${Math.abs(to - from) > 180 ? 1 : 0} ${to > from ? 1 : 0} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`; };
/** The inside of the bowl starts here: the rim is a narrow lip. */
const INNER = R - 5.5, WELL = R * 0.34;

/** Fixed glaze speckles (iron spots), spread evenly over the inside. */
const SPECKS: readonly { x: number; y: number; r: number }[] = Array.from({ length: 46 }, (_, i) => {
  const h = (n: number) => { const s = Math.sin(n * 91.7 + i * 12.9898) * 43758.5453; return s - Math.floor(s); };
  const p = on(Math.sqrt(h(1)) * (INNER - 3), h(2) * 360);
  return { x: p.x, y: p.y, r: 0.45 + h(3) * 0.75 };
});

/** The bowl itself (no seams), in stage units. `uid` keeps gradient ids unique per drawing. */
export const BowlBody = memo(function BowlBody({ glaze, uid, shadow = true }: { glaze: BowlGlaze; uid: string; shadow?: boolean }) {
  const t = GLAZE_TONES[glaze], id = (s: string) => `${uid}-${s}`, url = (s: string) => `url(#${id(s)})`;
  const shade = `color-mix(in srgb, ${t.inDeep} 78%, var(--mk-shadow))`;
  return <g data-bowl-glaze={glaze}>
    <defs>
      {/* Inside wall: turned from the window on the near-left side, facing it on the far-right. */}
      <linearGradient id={id('wall')} gradientUnits="userSpaceOnUse" x1={C.x - 70} y1={C.y - 70} x2={C.x + 72} y2={C.y + 72}>{stop(0, t.inDeep)}{stop(0.26, t.deep)}{stop(0.52, t.base)}{stop(0.82, t.inLight)}{stop(1, t.light)}</linearGradient>
      {/* The rim's cast shadow: a deep crescent on the wall under the lip, away from the light. */}
      <radialGradient id={id('under')} gradientUnits="userSpaceOnUse" cx={C.x + 26} cy={C.y + 29} r={R + 26}>{stop(0, shade, 0)}{stop(0.6, shade, 0)}{stop(0.8, shade, 0.3)}{stop(0.93, shade, 0.66)}{stop(1, shade, 0.8)}</radialGradient>
      {/* The foot of the wall, where it turns into the flat well: soft shade all round. */}
      <radialGradient id={id('hollow')} gradientUnits="userSpaceOnUse" cx={C.x + 2} cy={C.y + 2} r={R * 0.62}>{stop(0, shade, 0)}{stop(0.52, shade, 0)}{stop(0.62, shade, 0.26)}{stop(1, shade, 0)}</radialGradient>
      <linearGradient id={id('well')} gradientUnits="userSpaceOnUse" x1={C.x - WELL} y1={C.y - WELL} x2={C.x + WELL} y2={C.y + WELL}>{stop(0, t.base)}{stop(1, t.inLight)}</linearGradient>
      <radialGradient id={id('glazePool')} gradientUnits="userSpaceOnUse" cx={C.x - 3} cy={C.y - 4} r={WELL}>{stop(0, t.inDeep, 0.3)}{stop(0.7, t.inDeep, 0.1)}{stop(1, t.inDeep, 0)}</radialGradient>
      <linearGradient id={id('rim')} gradientUnits="userSpaceOnUse" x1={C.x - 70} y1={C.y - 70} x2={C.x + 72} y2={C.y + 72}>{stop(0, 'var(--mk-white)')}{stop(0.3, t.rim)}{stop(0.7, t.base)}{stop(1, t.deep)}</linearGradient>
      <linearGradient id={id('glow')} gradientUnits="userSpaceOnUse" x1={C.x + 26} y1={C.y + 26} x2={C.x + 68} y2={C.y + 68}>{stop(0, 'var(--mk-white)', 0)}{stop(0.62, 'var(--mk-white)', 0.3)}{stop(1, 'var(--mk-white)', 0)}</linearGradient>
      <radialGradient id={id('contact')} gradientUnits="userSpaceOnUse" cx={C.x + 9} cy={C.y + 11} r={R + 16}>{stop(0, 'var(--mk-shadow)', 0.5)}{stop(0.8, 'var(--mk-shadow)', 0.44)}{stop(0.92, 'var(--mk-shadow)', 0.17)}{stop(1, 'var(--mk-shadow)', 0)}</radialGradient>
      <clipPath id={id('inner')}><circle cx={C.x} cy={C.y} r={INNER} /></clipPath>
    </defs>
    {shadow && <circle cx={C.x + 9} cy={C.y + 11} r={R + 16} fill={url('contact')} />}
    {/* The lip: a narrow ring where the glaze breaks thin and pale. */}
    <path d={OUTLINE_D} fill={url('rim')} />
    <g clipPath={url('inner')}>
      <circle cx={C.x} cy={C.y} r={INNER} fill={url('wall')} />
      <circle cx={C.x} cy={C.y} r={INNER} fill={url('under')} />
      <circle cx={C.x} cy={C.y} r={INNER} fill={url('hollow')} />
      {/* The well: the flat bottom, where the glaze pools. */}
      <circle cx={C.x + 2} cy={C.y + 2} r={WELL} fill={url('well')} />
      <circle cx={C.x + 2} cy={C.y + 2} r={WELL} fill={url('glazePool')} />
      <path d={arc(WELL, 170, 290)} fill="none" strokeWidth="1.6" strokeLinecap="round" opacity=".5" transform="translate(2 2)" style={{ stroke: shade }} />
      <path d={arc(WELL, 5, 95)} fill="none" strokeWidth="1.4" strokeLinecap="round" opacity=".6" transform="translate(2 2)" style={{ stroke: t.light }} />
      {/* Daylight on the far wall: one soft band, and the window caught as a crisp glint. */}
      <path d={arc(R * 0.69, 22, 70)} fill="none" strokeWidth="17" strokeLinecap="round" stroke={url('glow')} />
      <path d={arc(R * 0.8, 33, 52)} fill="none" strokeWidth="3.2" strokeLinecap="round" opacity=".78" style={{ stroke: 'var(--mk-white)' }} />
      <path d={arc(R * 0.8, 56, 61)} fill="none" strokeWidth="3" strokeLinecap="round" opacity=".6" style={{ stroke: 'var(--mk-white)' }} />
      {SPECKS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity=".3" style={{ fill: t.speck }} />)}
    </g>
    {/* The lip's edges: bright where it faces the window, a hairline of shade inside and opposite. */}
    <path d={arc(R - 1.1, 172, 292)} fill="none" strokeWidth="1.9" strokeLinecap="round" opacity=".95" style={{ stroke: 'var(--mk-white)' }} />
    <path d={arc(INNER, 140, 310)} fill="none" strokeWidth="1.2" opacity=".55" style={{ stroke: shade }} />
    <path d={arc(R - 0.6, -4, 100)} fill="none" strokeWidth="1.5" strokeLinecap="round" opacity=".42" style={{ stroke: t.deep }} />
  </g>;
});

/** A gold ribbon along a seam: tapered ends, a gently uneven width. */
export function ribbonD(points: readonly Point[], seed: number): string {
  const s = samplePolyline(points, 2.5), n = s.length, total = (n - 1) * 2.5, left: Point[] = [], right: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const along = i * 2.5, taper = Math.min(1, along / 9, (total - along) / 9) * 0.65 + 0.35;
    const w = 2.5 * taper * (1 + 0.32 * Math.sin(along * 0.19 + seed * 1.7) + 0.18 * Math.sin(along * 0.53 + seed * 3.1));
    left.push({ x: s[i].x - dy / len * w, y: s[i].y + dx / len * w }); right.push({ x: s[i].x + dy / len * w, y: s[i].y - dx / len * w });
  }
  return polyD([...left, ...right.reverse()], true);
}
/** The gold layer of one seam (no mask): lacquer, its shade and its highlight. */
export function GoldRibbon({ points, seed, uid }: { points: readonly Point[]; seed: number; uid: string }) {
  const d = polyD(points);
  return <g>
    <path d={d} fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" transform="translate(.9 1.1)" opacity=".4" style={{ stroke: 'var(--mk-gold-deep)' }} />
    <path d={ribbonD(points, seed)} fill={`url(#${uid}-gold)`} />
    <path d={d} fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" transform="translate(-.6 -.7)" opacity=".92" style={{ stroke: 'var(--mk-gold-light)' }} />
  </g>;
}
export function GoldDefs({ uid }: { uid: string }) {
  return <linearGradient id={`${uid}-gold`} gradientUnits="userSpaceOnUse" x1={C.x - R} y1={C.y - R} x2={C.x + R} y2={C.y + R}>{stop(0, 'var(--mk-gold-light)')}{stop(0.42, 'var(--mk-gold)')}{stop(0.7, mix('--mk-gold', 70, '--mk-gold-light'))}{stop(1, 'var(--mk-gold-deep)')}</linearGradient>;
}
/** The mended bowl: body and every seam in gold. The Preview and the Cover draw this. */
export function MendedBowl({ glaze, pattern, uid }: { glaze: BowlGlaze; pattern: BowlPattern; uid: string }) {
  return <g>
    <defs><GoldDefs uid={uid} /><clipPath id={`${uid}-gclip`}><path d={OUTLINE_D} /></clipPath></defs>
    <BowlBody glaze={glaze} uid={uid} />
    <g clipPath={`url(#${uid}-gclip)`}>{BOWL_PATTERNS[pattern].seams.map((seam, i) => <GoldRibbon key={i} points={seam.points} seed={i + pattern * 7} uid={uid} />)}</g>
  </g>;
}

/** The kit's workshop table (a shipped picture), placed so its linen top is
 * centred on the bowl. Stage units; the picture is square. */
export const TABLE_BOX = (() => {
  const scale = LINEN_R / KIT_TABLE.linen;
  return { x: C.x - KIT_TABLE.centre.x * scale, y: C.y - KIT_TABLE.centre.y * scale, w: KIT_TABLE.w * scale, h: KIT_TABLE.h * scale };
})();
export function KitTable({ small = false }: { small?: boolean }) {
  return <image href={small ? KIT_TABLE.small : KIT_TABLE.src} x={TABLE_BOX.x} y={TABLE_BOX.y} width={TABLE_BOX.w} height={TABLE_BOX.h} preserveAspectRatio="none" />;
}
