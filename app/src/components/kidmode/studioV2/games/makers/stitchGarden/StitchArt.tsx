import { memo, useId, useMemo, type CSSProperties } from 'react';
import type { TextileCloth, TextileFlower, TextileMotif } from './stitchGardenRules';
import { ART_H, ART_W, CLOTH_R, HOOP_CX, HOOP_CY, cellCentre, motifStitches, stitchesFor, type Stitch, type StitchTone } from './stitchGardenStitches';
import '../makerPalette.css';

/** Stitch Garden's shared drawing: the cloth, the wooden hoop, the needle,
 * the threads and the stitched hem. One set of pieces for the game, the kept
 * cloth (Preview) and the cover, so what was stitched is what is kept.
 * All colour comes from the makers' palette through var() and color-mix(). */

/** Five threads chosen to read on all three cloths: each is laid over its own
 * darker under-stroke, so even the pale ones stand out on linen. */
export const THREAD_COLOURS = [
  'var(--mk-poppy)',
  'var(--mk-amber)',
  'var(--mk-rose-deep)',
  'color-mix(in srgb, var(--mk-bluebell) 72%, var(--mk-sky))',
  'var(--mk-white)',
] as const;
const FIXED: Record<Exclude<StitchTone, 'thread' | 'threadDeep'>, string> = {
  leaf: 'var(--mk-leaf)', leafDeep: 'var(--mk-leaf-deep)', moss: 'var(--mk-moss)', sun: 'var(--mk-sun)', umber: 'var(--mk-umber)', ink: 'var(--mk-graphite)',
};
export function toneColour(tone: StitchTone, thread: number): string {
  const own = THREAD_COLOURS[thread] ?? THREAD_COLOURS[0];
  if (tone === 'thread') return own;
  if (tone === 'threadDeep') return `color-mix(in srgb, ${own} 76%, var(--mk-shadow))`;
  return FIXED[tone];
}

/** Each cloth is three tones of one weave: the ground, the weft that catches
 * the light and the warp in shade; `hem` is the thread its story is sewn in. */
export const CLOTH_TONES: Record<TextileCloth, { chalk: string; ground: string; weft: string; warp: string; hem: string; edge: string }> = {
  linen: { chalk: 'color-mix(in srgb, var(--mk-bluebell) 55%, var(--mk-chalk))', ground: 'var(--mk-linen)', weft: 'color-mix(in srgb, var(--mk-linen) 50%, var(--mk-white))', warp: 'color-mix(in srgb, var(--mk-linen-shade) 85%, var(--mk-linen))', hem: 'var(--mk-rust)', edge: 'var(--mk-linen-shade)' },
  indigo: { chalk: 'color-mix(in srgb, var(--mk-chalk) 80%, var(--mk-indigo))', ground: 'var(--mk-indigo)', weft: 'color-mix(in srgb, var(--mk-indigo) 78%, var(--mk-sky))', warp: 'color-mix(in srgb, var(--mk-indigo-deep) 85%, var(--mk-indigo))', hem: 'var(--mk-butter)', edge: 'var(--mk-indigo-deep)' },
  sage: { chalk: 'color-mix(in srgb, var(--mk-white) 85%, var(--mk-sage))', ground: 'var(--mk-sage)', weft: 'color-mix(in srgb, var(--mk-sage) 62%, var(--mk-white))', warp: 'color-mix(in srgb, var(--mk-sage) 72%, var(--mk-leaf-deep))', hem: 'var(--mk-plum)', edge: 'color-mix(in srgb, var(--mk-sage) 70%, var(--mk-leaf-deep))' },
};
export function clothStyle(cloth: TextileCloth): CSSProperties {
  const t = CLOTH_TONES[cloth];
  return { '--sg-ground': t.ground, '--sg-weft': t.weft, '--sg-warp': t.warp, '--sg-hem': t.hem, '--sg-edge': t.edge, '--sg-chalk': t.chalk } as CSSProperties;
}

const pathOf = (s: Stitch) => s.cx !== undefined ? `M${s.x1} ${s.y1}Q${s.cx} ${s.cy} ${s.x2} ${s.y2}` : `M${s.x1} ${s.y1}L${s.x2} ${s.y2}`;
const under = (c: string) => `color-mix(in srgb, ${c} 48%, var(--mk-shadow))`;
const shine = (c: string) => `color-mix(in srgb, ${c} 42%, var(--mk-white))`;

/** One length of thread: a shadow below and to the right (the light is top
 * left), the thread itself with round ends, and a thin gloss along its top. */
function Thread({ s, thread }: { s: Stitch; thread: number }) {
  const colour = toneColour(s.tone, thread);
  if (s.knot) {
    const r = s.w / 2;
    return <g data-part={s.part}>
      <circle cx={s.x1 + 0.6} cy={s.y1 + 0.8} r={r + 0.25} style={{ fill: under(colour) }} />
      <circle cx={s.x1} cy={s.y1} r={r} style={{ fill: colour }} />
      <circle cx={s.x1 - r * 0.32} cy={s.y1 - r * 0.34} r={r * 0.34} style={{ fill: shine(colour) }} opacity=".9" />
    </g>;
  }
  const d = pathOf(s);
  return <g data-part={s.part}>
    <path d={d} transform="translate(.6 .8)" style={{ stroke: under(colour), strokeWidth: s.w + 0.5 }} />
    <path d={d} style={{ stroke: colour, strokeWidth: s.w }} />
    <path d={d} transform="translate(-.3 -.4)" style={{ stroke: shine(colour), strokeWidth: Math.max(0.35, s.w * 0.3) }} opacity=".8" />
  </g>;
}

/** The first `count` stitches of one flower. Finished flowers never redraw
 * while the needle works on another. */
export const MotifThreads = memo(function MotifThreads({ stitches, thread, count, flower, cell }: { stitches: readonly Stitch[]; thread: number; count: number; flower: TextileFlower; cell: number }) {
  const shown = Math.max(0, Math.min(count, stitches.length));
  return <g className="sg-motif" data-flower={flower} data-cell={cell} data-thread={thread} data-stitches={shown} fill="none" strokeLinecap="round" strokeLinejoin="round">
    {stitches.slice(0, shown).map((s, i) => <Thread key={i} s={s} thread={thread} />)}
  </g>;
});

/** The needle in its own frame: the point at 0,0, the eye 40 units back. */
function NeedleShape({ gradient, raised }: { gradient: string; raised: boolean }) {
  const body = 'M0 0L-11 -1.25L-43.5 -1.45Q-47 0 -43.5 1.45L-11 1.25Z';
  return <>
    <path d={body} transform={raised ? 'translate(3 5)' : 'translate(1.2 2)'} style={{ fill: 'color-mix(in srgb, var(--mk-shadow) 28%, transparent)' }} />
    <path d={body} fill={`url(#${gradient})`} />
    <path d="M-4 -.5L-41 -.75" style={{ stroke: 'color-mix(in srgb, var(--mk-white) 85%, transparent)', strokeWidth: 0.55 }} strokeLinecap="round" />
    <ellipse cx="-40" cy="0" rx="3" ry=".55" style={{ fill: 'color-mix(in srgb, var(--mk-graphite) 80%, transparent)' }} />
  </>;
}
export interface NeedlePose { x: number; y: number; angle: number; working: boolean }
/** The needle and the length of thread it carries. Working, its point sits
 * on the newest stitch and the thread runs from that stitch to the eye. */
function Needle({ pose, thread, gradient }: { pose: NeedlePose; thread: number; gradient: string }) {
  const colour = THREAD_COLOURS[thread] ?? THREAD_COLOURS[0];
  const a = pose.angle * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
  const eye = { x: pose.x - 40 * cos, y: pose.y - 40 * sin };
  const bow = pose.working ? 16 : 10;
  const lead = pose.working
    ? `M${pose.x} ${pose.y}C${pose.x - sin * bow} ${pose.y + cos * bow} ${eye.x - sin * bow * 1.4} ${eye.y + cos * bow * 1.4} ${eye.x} ${eye.y}`
    : `M${eye.x} ${eye.y}C${eye.x - 14 * cos + 6} ${eye.y + 18} ${eye.x - 20} ${eye.y + 4} ${eye.x - 30} ${eye.y + 14}`;
  const tail = `M${eye.x} ${eye.y}c${-cos * 6 + 3} ${-sin * 6 + 8} ${-cos * 10 - 4} ${-sin * 10 + 14} ${-cos * 8 - 9} ${-sin * 8 + 21}`;
  return <g className="sg-needle" data-working={pose.working} pointerEvents="none">
    <g fill="none" strokeLinecap="round">
      <path d={lead} transform="translate(.6 1)" style={{ stroke: under(colour), strokeWidth: 1.9 }} />
      <path d={lead} style={{ stroke: colour, strokeWidth: 1.5 }} />
      <path d={tail} transform="translate(.6 1)" style={{ stroke: under(colour), strokeWidth: 1.9 }} />
      <path d={tail} style={{ stroke: colour, strokeWidth: 1.5 }} />
    </g>
    <g className="sg-needle__body" style={{ transform: `translate(${pose.x}px, ${pose.y}px) rotate(${pose.angle}deg)` }}><NeedleShape gradient={gradient} raised={pose.working} /></g>
  </g>;
}
/** Where the needle rests between flowers: laid across the cloth's corner. */
export const PARKED_NEEDLE: NeedlePose = { x: 352, y: 428, angle: 166, working: false };

/** A slightly uneven square of cloth with a pinked edge, bigger than the
 * hoop, so its corners show beyond the wood. */
const CLOTH_EDGE = (() => {
  const pts: string[] = [];
  const x0 = 18, y0 = 26, x1 = 422, y1 = 430, step = 12;
  const wob = (i: number) => (((i * 7919) % 13) / 13 - 0.5) * 2.2;
  let i = 0;
  for (let x = x0; x < x1; x += step) pts.push(`${x} ${y0 + wob(i++)}`);
  for (let y = y0; y < y1; y += step) pts.push(`${x1 + wob(i++)} ${y}`);
  for (let x = x1; x > x0; x -= step) pts.push(`${x} ${y1 + wob(i++)}`);
  for (let y = y1; y > y0; y -= step) pts.push(`${x0 + wob(i++)} ${y}`);
  return `M${pts.join('L')}Z`;
})();

const RIM_R = 170, RIM_SPAN = 50;
const RIM_PATH = (() => {
  const a = RIM_SPAN * Math.PI / 180;
  const x0 = HOOP_CX - Math.sin(a) * RIM_R, x1 = HOOP_CX + Math.sin(a) * RIM_R, y = HOOP_CY + Math.cos(a) * RIM_R;
  return `M${x0.toFixed(1)} ${y.toFixed(1)}A${RIM_R} ${RIM_R} 0 0 0 ${x1.toFixed(1)} ${y.toFixed(1)}`;
})();

export interface SceneMotif { motif: TextileMotif; count?: number; leaving?: boolean }
export interface StoryRim { text: string; key: string; leaving?: boolean }
export interface TextileSceneProps {
  cloth: TextileCloth;
  motifs: readonly SceneMotif[];
  /** `on`: in the hoop; `lifting`: the hoop rises away; `off`: the kept cloth. */
  hoop: 'on' | 'lifting' | 'off';
  /** The hem lines sewn along the lower rim (the newest, plus one fading out). */
  story?: readonly StoryRim[];
  lang: 'en' | 'he';
  /** Faint chalk crosses on the cells still free. */
  crosses?: readonly number[];
  needle?: NeedlePose | null;
  needleThread?: number;
  /** The cell a dragged flower is over. */
  aim?: number | null;
  className?: string;
}

/** The whole textile on the cream stage: shadow, cloth, flowers, hem, hoop, needle. */
export function TextileScene({ cloth, motifs, hoop, story = [], lang, crosses = [], needle = null, needleThread = 0, aim = null, className }: TextileSceneProps) {
  const raw = useId(), id = raw.replace(/:/g, '');
  const ids = { weave: `${id}w`, vignette: `${id}v`, light: `${id}l`, wood: `${id}d`, woodIn: `${id}i`, brass: `${id}b`, brassHead: `${id}h`, steel: `${id}s`, rim: `${id}r`, clip: `${id}c`, shadow: `${id}o` };
  const inHoop = hoop !== 'off';
  return <svg className={['sg-scene', className].filter(Boolean).join(' ')} viewBox={`0 0 ${ART_W} ${ART_H}`} data-cloth={cloth} data-hoop={hoop} style={clothStyle(cloth)} aria-hidden="true" focusable="false">
    <defs>
      <pattern id={ids.weave} width="4.4" height="4.4" patternUnits="userSpaceOnUse">
        <rect width="4.4" height="4.4" style={{ fill: 'var(--sg-ground)' }} />
        <rect y=".3" width="4.4" height="1.6" rx=".8" style={{ fill: 'var(--sg-weft)' }} opacity=".5" />
        <rect x="2.5" width="1.5" height="4.4" rx=".75" style={{ fill: 'var(--sg-warp)' }} opacity=".45" />
        <rect y="2.6" width="2.3" height="1.3" rx=".65" style={{ fill: 'var(--sg-weft)' }} opacity=".3" />
      </pattern>
      <radialGradient id={ids.vignette} cx=".5" cy=".5" r=".5">
        <stop offset=".72" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.2 }} />
      </radialGradient>
      <radialGradient id={ids.light} cx=".3" cy=".22" r=".75">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.2 }} />
        <stop offset=".6" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.1 }} />
      </radialGradient>
      <linearGradient id={ids.wood} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--mk-wood-light)' }} />
        <stop offset=".55" style={{ stopColor: 'var(--mk-wood)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--mk-wood-dark) 80%, var(--mk-wood))' }} />
      </linearGradient>
      <linearGradient id={ids.woodIn} x1="1" y1="1" x2="0" y2="0">
        <stop offset="0" style={{ stopColor: 'var(--mk-wood-light)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-wood-dark)' }} />
      </linearGradient>
      <linearGradient id={ids.brass} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--mk-gold-light)' }} />
        <stop offset=".5" style={{ stopColor: 'var(--mk-brass)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-gold-deep)' }} />
      </linearGradient>
      <radialGradient id={ids.brassHead} cx=".35" cy=".3" r=".8">
        <stop offset="0" style={{ stopColor: 'var(--mk-gold-light)' }} />
        <stop offset=".6" style={{ stopColor: 'var(--mk-brass)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-gold-deep)' }} />
      </radialGradient>
      <linearGradient id={ids.steel} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--mk-steel-light)' }} />
        <stop offset=".55" style={{ stopColor: 'var(--mk-steel)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-steel-dark)' }} />
      </linearGradient>
      <radialGradient id={ids.shadow} cx=".5" cy=".5" r=".5">
        <stop offset=".8" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.24 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
      </radialGradient>
      <clipPath id={ids.clip}><circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R} /></clipPath>
      <path id={ids.rim} d={RIM_PATH} />
    </defs>

    {/* The cloth lies on the table; its shadow falls down and to the right. */}
    <path d={CLOTH_EDGE} transform="translate(4 6)" style={{ fill: 'color-mix(in srgb, var(--mk-shadow) 14%, transparent)' }} />
    <ellipse className="sg-hoop-shadow" cx={HOOP_CX + 6} cy={HOOP_CY + 9} rx="226" ry="224" fill={`url(#${ids.shadow})`} />
    <path d={CLOTH_EDGE} fill={`url(#${ids.weave})`} />
    <path d={CLOTH_EDGE} style={{ fill: 'none', stroke: 'var(--sg-edge)', strokeWidth: 1.4, strokeDasharray: '1.4 2.2' }} opacity=".7" />
    <path d={CLOTH_EDGE} fill={`url(#${ids.light})`} />
    {/* Where the hoop held it, the cloth keeps a soft ring. */}
    <circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 4} style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-shadow) 10%, transparent)', strokeWidth: 3 }} />
    <circle cx={HOOP_CX - 1} cy={HOOP_CY - 1} r={CLOTH_R + 7} style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-white) 14%, transparent)', strokeWidth: 1.6 }} />
    {inHoop && <circle className="sg-vignette" cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R} fill={`url(#${ids.vignette})`} />}

    <g className="sg-crosses" fill="none" strokeLinecap="round">
      {crosses.map(cell => { const c = cellCentre(cell); const y = c.y - 2;
        return <g key={cell} data-cross={cell} data-aim={aim === cell} style={{ stroke: 'var(--sg-chalk)', strokeWidth: 2.4, strokeDasharray: '3 2.4' }}>
          <path d={`M${c.x - 7} ${y - 7}L${c.x + 7} ${y + 7}M${c.x + 7} ${y - 7}L${c.x - 7} ${y + 7}`} />
          {aim === cell && <circle cx={c.x} cy={y} r="22" style={{ strokeWidth: 2.4, strokeDasharray: '4 3' }} />}
        </g>; })}
    </g>

    <g clipPath={inHoop ? `url(#${ids.clip})` : undefined}>
      {motifs.map(({ motif, count, leaving }) => <SceneFlower key={`${motif.cell}:${motif.flower}:${motif.thread}${leaving ? ':out' : ''}`} motif={motif} count={count} />)}
    </g>

    <g className="sg-hem" style={{ font: `900 ${lang === 'he' ? 18 : 17}px var(--studio-font, Nunito, Heebo, sans-serif)` }}>
      {story.map(line => <text key={line.key} className="sg-hem__line" data-leaving={!!line.leaving} direction={lang === 'he' ? 'rtl' : 'ltr'} style={{ fill: 'color-mix(in srgb, var(--sg-hem) 24%, transparent)', stroke: 'var(--sg-hem)', strokeWidth: 0.95, strokeDasharray: '2.3 1.5', strokeLinecap: 'round', strokeLinejoin: 'round', fontSize: line.text.length > 26 ? (lang === 'he' ? 16 : 15) : undefined }}>
        <textPath href={`#${ids.rim}`} startOffset="50%" textAnchor="middle">{line.text}</textPath>
      </text>)}
    </g>

    {inHoop && <g className="sg-hoop" data-lifting={hoop === 'lifting'}>
      <circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 1.5} style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-shadow) 26%, transparent)', strokeWidth: 3 }} />
      <circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R - 1} style={{ fill: 'none', strokeWidth: 6.5 }} stroke={`url(#${ids.woodIn})`} />
      <circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 12} style={{ fill: 'none', strokeWidth: 16 }} stroke={`url(#${ids.wood})`} />
      <circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 20} style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-wood-dark) 55%, transparent)', strokeWidth: 0.9 }} />
      <circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 4.2} style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-wood-dark) 60%, transparent)', strokeWidth: 0.9 }} />
      <g fill="none" style={{ stroke: 'color-mix(in srgb, var(--mk-wood-dark) 30%, transparent)', strokeWidth: 0.8 }}>
        <circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 8.5} strokeDasharray="46 14 90 22 30 40" />
        <circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 12.5} strokeDasharray="70 30 24 18 110 12" strokeDashoffset="40" />
        <circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 16} strokeDasharray="28 22 60 34 84 16" strokeDashoffset="15" />
      </g>
      <path d={`M${HOOP_CX - 196} ${HOOP_CY - 30}A${CLOTH_R + 16} ${CLOTH_R + 16} 0 0 1 ${HOOP_CX - 40} ${HOOP_CY - 204}`} style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-white) 38%, transparent)', strokeWidth: 2.4 }} strokeLinecap="round" />
      {/* The tension clasp at the top: two wooden lugs and a brass screw. */}
      <ellipse cx={HOOP_CX + 4} cy="30" rx="34" ry="6" style={{ fill: 'color-mix(in srgb, var(--mk-shadow) 18%, transparent)' }} />
      <rect x={HOOP_CX - 14} y="4" width="11" height="26" rx="3" fill={`url(#${ids.wood})`} />
      <rect x={HOOP_CX + 3} y="4" width="11" height="26" rx="3" fill={`url(#${ids.wood})`} />
      <rect x={HOOP_CX - 14} y="4" width="11" height="3" rx="1.5" style={{ fill: 'color-mix(in srgb, var(--mk-white) 30%, transparent)' }} />
      <rect x={HOOP_CX - 27} y="10" width="56" height="8" rx="4" fill={`url(#${ids.brass})`} />
      <g style={{ stroke: 'color-mix(in srgb, var(--mk-gold-deep) 60%, transparent)', strokeWidth: 0.7 }}>
        {[-22, -19, 6, 9, 12, 15, 18, 21].map(x => <path key={x} d={`M${HOOP_CX + x} 10.6v6.8`} />)}
      </g>
      <rect x={HOOP_CX - 31} y="7.5" width="6" height="13" rx="1.6" fill={`url(#${ids.brass})`} />
      <circle cx={HOOP_CX + 33} cy="14" r="9" fill={`url(#${ids.brassHead})`} />
      <path d={`M${HOOP_CX + 28} 11l10 6`} style={{ stroke: 'var(--mk-gold-deep)', strokeWidth: 1.8 }} strokeLinecap="round" />
      <circle cx={HOOP_CX + 30} cy="10.5" r="2" style={{ fill: 'color-mix(in srgb, var(--mk-white) 55%, transparent)' }} />
    </g>}

    {needle && <Needle pose={needle} thread={needleThread} gradient={ids.steel} />}
  </svg>;
}

function SceneFlower({ motif, count }: { motif: TextileMotif; count?: number }) {
  const stitches = useMemo(() => stitchesFor(motif.flower, motif.cell), [motif.flower, motif.cell]);
  return <MotifThreads stitches={stitches} thread={motif.thread} count={count ?? stitches.length} flower={motif.flower} cell={motif.cell} />;
}

/** A pattern card: one flower stitched small, for the tray and the cover. */
export function FlowerSwatch({ flower, thread, cloth, size = 'tray' }: { flower: TextileFlower; thread: number; cloth: TextileCloth; size?: 'tray' | 'ghost' }) {
  const stitches = useMemo(() => motifStitches(flower, 5), [flower]);
  const raw = useId(), id = raw.replace(/:/g, '');
  return <svg className="sg-swatch" data-size={size} viewBox="-45 -54 90 94" style={clothStyle(cloth)} aria-hidden="true" focusable="false">
    <defs>
      <pattern id={`${id}w`} width="4.4" height="4.4" patternUnits="userSpaceOnUse">
        <rect width="4.4" height="4.4" style={{ fill: 'var(--sg-ground)' }} />
        <rect y=".3" width="4.4" height="1.6" rx=".8" style={{ fill: 'var(--sg-weft)' }} opacity=".5" />
        <rect x="2.5" width="1.5" height="4.4" rx=".75" style={{ fill: 'var(--sg-warp)' }} opacity=".45" />
      </pattern>
    </defs>
    <circle cx="0" cy="-7" r="44" fill={`url(#${id}w)`} />
    <circle cx="0" cy="-7" r="43" style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-shadow) 14%, transparent)', strokeWidth: 2 }} />
    <MotifThreads stitches={stitches} thread={thread} count={stitches.length} flower={flower} cell={5} />
  </svg>;
}

/** A wooden spool wound with one thread. */
export function Spool({ thread }: { thread: number }) {
  const raw = useId(), id = raw.replace(/:/g, '');
  const colour = THREAD_COLOURS[thread] ?? THREAD_COLOURS[0];
  return <svg className="sg-spool" viewBox="0 0 48 56" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${colour} 70%, var(--mk-white))` }} />
        <stop offset=".45" style={{ stopColor: colour }} />
        <stop offset="1" style={{ stopColor: `color-mix(in srgb, ${colour} 60%, var(--mk-shadow))` }} />
      </linearGradient>
      <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--mk-wood-light)' }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-wood)' }} />
      </linearGradient>
    </defs>
    <ellipse cx="25" cy="52" rx="17" ry="3" style={{ fill: 'color-mix(in srgb, var(--mk-shadow) 22%, transparent)' }} />
    <rect x="11" y="9" width="26" height="38" rx="3" fill={`url(#${id}t)`} />
    <g style={{ stroke: `color-mix(in srgb, ${colour} 55%, var(--mk-shadow))`, strokeWidth: 0.6 }} opacity=".55">
      {[13, 16, 19, 22, 25, 28, 31, 34, 37, 40, 43].map(y => <path key={y} d={`M11.5 ${y}q12.5 1.4 25 -.6`} fill="none" />)}
    </g>
    <path d="M14 11v34" style={{ stroke: 'color-mix(in srgb, var(--mk-white) 45%, transparent)', strokeWidth: 1.6 }} strokeLinecap="round" />
    <rect x="6" y="3" width="36" height="7.5" rx="3.5" fill={`url(#${id}w)`} />
    <rect x="6" y="45.5" width="36" height="7.5" rx="3.5" fill={`url(#${id}w)`} />
    <ellipse cx="24" cy="6.7" rx="4" ry="1.6" style={{ fill: 'var(--mk-wood-dark)' }} opacity=".6" />
    <path d="M37 30c5 2 6 8 3 12" fill="none" style={{ stroke: colour, strokeWidth: 1.4 }} strokeLinecap="round" />
  </svg>;
}

/** A small round patch of a cloth, for the cloth choices. */
export function ClothPatch({ cloth }: { cloth: TextileCloth }) {
  const raw = useId(), id = raw.replace(/:/g, '');
  return <svg className="sg-patch" viewBox="0 0 40 40" style={clothStyle(cloth)} aria-hidden="true" focusable="false">
    <defs>
      <pattern id={`${id}w`} width="3.4" height="3.4" patternUnits="userSpaceOnUse">
        <rect width="3.4" height="3.4" style={{ fill: 'var(--sg-ground)' }} />
        <rect y=".2" width="3.4" height="1.3" rx=".6" style={{ fill: 'var(--sg-weft)' }} opacity=".6" />
        <rect x="1.9" width="1.2" height="3.4" rx=".6" style={{ fill: 'var(--sg-warp)' }} opacity=".5" />
      </pattern>
      <radialGradient id={`${id}l`} cx=".3" cy=".25" r=".8">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.3 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.16 }} />
      </radialGradient>
    </defs>
    <path d="M5 8l4-3 6 2 5-2 6 2 5-2 4 3-1 6 2 6-2 6 1 6-4 3-5-2-6 2-6-2-5 2-4-3 1-6-2-6 2-6z" fill={`url(#${id}w)`} />
    <path d="M5 8l4-3 6 2 5-2 6 2 5-2 4 3-1 6 2 6-2 6 1 6-4 3-5-2-6 2-6-2-5 2-4-3 1-6-2-6 2-6z" fill={`url(#${id}l)`} />
  </svg>;
}
