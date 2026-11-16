import { forwardRef, memo, useCallback, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { TextileCloth, TextileFlower, TextileMotif } from './stitchGardenRules';
import { ART_H, ART_W, CLOTH_R, HOOP_CX, HOOP_CY, cellCentre, motifStitches, stitchesFor, type Stitch, type StitchTone } from './stitchGardenStitches';
import { PARKED_NEEDLE, type NeedlePose } from './stitchGardenMotion';
import { critterStitches, type CritterKind } from './stitchGardenCritters';
import { TABLE, type KitPicture } from './stitchGardenKit';
import '../makerPalette.css';

/** Stitch Garden's shared drawing. The cloth is the kit's own linen (the round
 * table in the Sky Gardens, photographed from above); the pale-wood hoop that
 * holds it, the needle and every thread are drawn live and shaded for the
 * same daylight (from the top left). One set of pieces for the game, the kept
 * hoop (Preview) and the cover, so what was stitched is what is kept.
 * All colour comes from the makers' palette through var() and color-mix(). */

/** Five threads in the kit's own colours: the coral of its knit flowers,
 * amber, petal pink, Aya's blue and white. Each is laid over its own darker
 * under-stroke, so even the pale ones stand out on linen. */
export const THREAD_COLOURS = [
  'color-mix(in srgb, var(--mk-poppy) 72%, var(--mk-rose))',
  'var(--mk-amber)',
  'color-mix(in srgb, var(--mk-rose) 68%, var(--mk-rose-deep))',
  'color-mix(in srgb, var(--mk-water) 58%, var(--mk-bluebell))',
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

/** The three cloths are one linen: undyed, or dyed (the dye multiplies over
 * the photographed weave, so the cloth keeps its threads and its daylight).
 * `chalk` is the colour of the tailor's crosses, `hem` of the story's thread. */
export const CLOTH_TONES: Record<TextileCloth, { dye: string | null; chalk: string; hem: string }> = {
  linen: { dye: null, chalk: 'color-mix(in srgb, var(--mk-water) 62%, var(--mk-chalk))', hem: 'var(--mk-teal-deep)' },
  indigo: { dye: 'color-mix(in srgb, var(--mk-indigo) 84%, var(--mk-bluebell))', chalk: 'color-mix(in srgb, var(--mk-chalk) 86%, var(--mk-indigo))', hem: 'var(--mk-butter)' },
  sage: { dye: 'color-mix(in srgb, var(--mk-sage) 84%, var(--mk-white))', chalk: 'var(--mk-white)', hem: 'var(--mk-plum)' },
};
export function clothStyle(cloth: TextileCloth): CSSProperties {
  const t = CLOTH_TONES[cloth];
  return { '--sg-hem': t.hem, '--sg-chalk': t.chalk } as CSSProperties;
}

const pathOf = (s: Stitch) => s.cx !== undefined ? `M${s.x1} ${s.y1}Q${s.cx} ${s.cy} ${s.x2} ${s.y2}` : `M${s.x1} ${s.y1}L${s.x2} ${s.y2}`;
const under = (c: string) => `color-mix(in srgb, ${c} 48%, var(--mk-shadow))`;
const shine = (c: string) => `color-mix(in srgb, ${c} 42%, var(--mk-white))`;
const veil = (token: string, pct: number) => `color-mix(in srgb, var(${token}) ${pct}%, transparent)`;

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

/** Light running down a flower's threads, in the order they were stitched. */
const Shimmer = memo(function Shimmer({ stitches, delay }: { stitches: readonly Stitch[]; delay: number }) {
  const lit = useMemo(() => { const lines = stitches.filter(s => !s.knot), step = Math.max(1, Math.floor(lines.length / 11)); return lines.filter((_, i) => i % step === 0).slice(0, 12); }, [stitches]);
  return <g className="sg-shimmer" fill="none" strokeLinecap="round" pointerEvents="none">
    {lit.map((s, i) => <path key={i} d={pathOf(s)} transform="translate(-.3 -.5)" style={{ stroke: 'var(--mk-white)', strokeWidth: Math.max(1, s.w * 0.55), animationDelay: `${delay + i * 42}ms` }} />)}
  </g>;
});

/* ── the needle ─────────────────────────────────────────────────────────── */

const NEEDLE_LONG = 40;
const NEEDLE_BODY = 'M0 0L-11 -1.25L-43.5 -1.45Q-47 0 -43.5 1.45L-11 1.25Z';
export interface NeedleHandle { set(pose: NeedlePose): void }

/** The needle and the thread it carries. The game's frame loop moves it by
 * calling `set`; React only draws its parts. Dipped, it shortens towards its
 * point and dimples the cloth; drawn back, it lifts off its shadow and pulls
 * the thread straight from the last stitch to its eye. */
const Needle = forwardRef<NeedleHandle, { thread: number; gradient: string; away: boolean }>(function Needle({ thread, gradient, away }, ref) {
  const colour = THREAD_COLOURS[thread] ?? THREAD_COLOURS[0];
  const root = useRef<SVGGElement>(null), body = useRef<SVGGElement>(null), shade = useRef<SVGPathElement>(null), dimple = useRef<SVGEllipseElement>(null);
  const lead = useRef<SVGPathElement>(null), leadUnder = useRef<SVGPathElement>(null), loose = useRef<SVGGElement>(null);
  const apply = useCallback((pose: NeedlePose) => {
    const a = pose.angle * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const lift = Math.max(0, pose.z), dip = Math.max(0, -pose.z);
    const back = lift * 13, long = 1 - 0.42 * dip;
    const tx = pose.x - cos * back - lift * 1.2, ty = pose.y - sin * back - lift * 4;
    const ex = tx - cos * NEEDLE_LONG * long, ey = ty - sin * NEEDLE_LONG * long;
    const turn = `rotate(${pose.angle.toFixed(2)}deg) scale(${long.toFixed(3)}, 1)`;
    if (body.current) body.current.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) ${turn}`;
    if (shade.current) { shade.current.style.transform = `translate(${(tx + 1.4 + lift * 4.5).toFixed(2)}px, ${(ty + 2.2 + lift * 7).toFixed(2)}px) ${turn}`; shade.current.style.opacity = String(0.3 - Math.min(1, lift) * 0.12); }
    if (dimple.current) { dimple.current.style.transform = `translate(${pose.x.toFixed(2)}px, ${pose.y.toFixed(2)}px)`; dimple.current.style.opacity = String(Math.min(1, dip * 1.4)); }
    let d = '';
    if (pose.anchor) {
      const dx = ex - pose.anchor.x, dy = ey - pose.anchor.y, len = Math.hypot(dx, dy) || 1, bow = 2 + pose.slack * Math.min(16, len * 0.5);
      const nx = -dy / len * bow, ny = dx / len * bow + pose.slack * 5;
      d = `M${pose.anchor.x.toFixed(1)} ${pose.anchor.y.toFixed(1)}C${(pose.anchor.x + dx * 0.3 + nx).toFixed(1)} ${(pose.anchor.y + dy * 0.3 + ny).toFixed(1)} ${(pose.anchor.x + dx * 0.72 + nx).toFixed(1)} ${(pose.anchor.y + dy * 0.72 + ny).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    }
    lead.current?.setAttribute('d', d); leadUnder.current?.setAttribute('d', d);
    if (loose.current) {
      const k = pose.anchor ? 0.45 : 0.55 + 0.45 * pose.slack;
      loose.current.style.transform = `translate(${ex.toFixed(2)}px, ${ey.toFixed(2)}px) scale(${k.toFixed(3)})`;
    }
    if (root.current) root.current.dataset.resting = String(pose === PARKED_NEEDLE);
  }, []);
  useImperativeHandle(ref, () => ({ set: apply }), [apply]);
  useLayoutEffect(() => { apply(PARKED_NEEDLE); }, [apply]);
  const strand = { stroke: colour, strokeWidth: 1.5 }, strandUnder = { stroke: under(colour), strokeWidth: 1.9 };
  return <g className="sg-needle" ref={root} data-away={away} data-resting="true" pointerEvents="none">
    <ellipse ref={dimple} className="sg-needle__dimple" rx="3.4" ry="2.2" style={{ fill: veil('--mk-shadow', 30), opacity: 0 }} />
    <g fill="none" strokeLinecap="round">
      <path ref={leadUnder} transform="translate(.6 1)" style={strandUnder} />
      <path ref={lead} style={strand} />
      <g ref={loose}><g className="sg-needle__loose">
        <path d="M0 0C5 11 -15 13 -9 27C-7 32 -1 31 -2 26" transform="translate(.6 1)" style={strandUnder} />
        <path d="M0 0C5 11 -15 13 -9 27C-7 32 -1 31 -2 26" style={strand} />
        <path d="M0 0C3 5 8 8 6 15" transform="translate(.6 1)" style={strandUnder} />
        <path d="M0 0C3 5 8 8 6 15" style={strand} />
      </g></g>
    </g>
    <path ref={shade} d={NEEDLE_BODY} style={{ fill: 'var(--mk-shadow)', opacity: 0.3 }} />
    <g ref={body}>
      <path d={NEEDLE_BODY} fill={`url(#${gradient})`} />
      <path d="M-4 -.5L-41 -.75" style={{ stroke: veil('--mk-white', 85), strokeWidth: 0.55 }} strokeLinecap="round" />
      <ellipse cx="-40" cy="0" rx="3" ry=".55" style={{ fill: veil('--mk-graphite', 80) }} />
    </g>
  </g>;
});

/* ── the hoop ───────────────────────────────────────────────────────────── */

/** Pale maple, to match the table's rim: light where the window catches it,
 * greyer on the side away from the light. */
const WOOD_LIGHT = 'color-mix(in srgb, var(--mk-wood-light) 48%, var(--mk-white))';
const WOOD = 'color-mix(in srgb, var(--mk-wood-light) 62%, var(--mk-steel-light))';
const WOOD_SHADE = 'color-mix(in srgb, var(--mk-wood) 58%, var(--mk-steel-dark))';
const SCREW_X = HOOP_CX + 33, SCREW_Y = 14;

function HoopWood({ wood, woodIn, brass, brassHead, screw }: { wood: string; woodIn: string; brass: string; brassHead: string; screw: number }) {
  const ring = (r: number, style: CSSProperties, stroke?: string, dash?: string, offset?: number) => <circle cx={HOOP_CX} cy={HOOP_CY} r={r} fill="none" style={style} stroke={stroke} strokeDasharray={dash} strokeDashoffset={offset} />;
  return <g className="sg-hoop">
    {ring(CLOTH_R + 1.5, { stroke: veil('--mk-shadow', 22), strokeWidth: 3 })}
    {ring(CLOTH_R - 1, { strokeWidth: 6.5 }, `url(#${woodIn})`)}
    {ring(CLOTH_R + 12, { strokeWidth: 16 }, `url(#${wood})`)}
    {ring(CLOTH_R + 20, { stroke: `color-mix(in srgb, ${WOOD_SHADE} 55%, transparent)`, strokeWidth: 0.9 })}
    {ring(CLOTH_R + 4.2, { stroke: `color-mix(in srgb, ${WOOD_SHADE} 60%, transparent)`, strokeWidth: 0.9 })}
    <g style={{ stroke: `color-mix(in srgb, ${WOOD_SHADE} 26%, transparent)`, strokeWidth: 0.8 }}>
      {ring(CLOTH_R + 8.5, {}, undefined, '46 14 90 22 30 40')}
      {ring(CLOTH_R + 12.5, {}, undefined, '70 30 24 18 110 12', 40)}
      {ring(CLOTH_R + 16, {}, undefined, '28 22 60 34 84 16', 15)}
    </g>
    <path d={`M${HOOP_CX - 196} ${HOOP_CY - 30}A${CLOTH_R + 16} ${CLOTH_R + 16} 0 0 1 ${HOOP_CX - 40} ${HOOP_CY - 204}`} style={{ fill: 'none', stroke: veil('--mk-white', 55), strokeWidth: 2.6 }} strokeLinecap="round" />
    {/* The tension clasp at the top: two wooden lugs and a brass screw that turns. */}
    <ellipse cx={HOOP_CX + 5} cy="31" rx="36" ry="6" style={{ fill: veil('--mk-shadow', 16) }} />
    <rect x={HOOP_CX - 14} y="4" width="11" height="26" rx="3" fill={`url(#${wood})`} />
    <rect x={HOOP_CX + 3} y="4" width="11" height="26" rx="3" fill={`url(#${wood})`} />
    <rect x={HOOP_CX - 14} y="4" width="11" height="3" rx="1.5" style={{ fill: veil('--mk-white', 34) }} />
    <rect x={HOOP_CX - 27} y="10" width="56" height="8" rx="4" fill={`url(#${brass})`} />
    <g style={{ stroke: veil('--mk-gold-deep', 60), strokeWidth: 0.7 }}>
      {[-22, -19, 6, 9, 12, 15, 18, 21].map(x => <path key={x} d={`M${HOOP_CX + x} 10.6v6.8`} />)}
    </g>
    <rect x={HOOP_CX - 31} y="7.5" width="6" height="13" rx="1.6" fill={`url(#${brass})`} />
    <g className="sg-screw" style={{ transformOrigin: `${SCREW_X}px ${SCREW_Y}px`, transform: `rotate(${screw * 60}deg)` }}>
      <circle cx={SCREW_X} cy={SCREW_Y} r="9" fill={`url(#${brassHead})`} />
      <path d={`M${SCREW_X - 5} ${SCREW_Y - 3}l10 6`} style={{ stroke: 'var(--mk-gold-deep)', strokeWidth: 1.8 }} strokeLinecap="round" />
    </g>
    <circle cx={SCREW_X - 3} cy={SCREW_Y - 3.5} r="2" style={{ fill: veil('--mk-white', 55) }} />
  </g>;
}

/* ── the scene ──────────────────────────────────────────────────────────── */

const TABLE_SCALE = TABLE.ringAt / TABLE.r;
/** Where the table picture sits in the drawing: its teal ring `ringAt` out from the hoop's centre. */
const TABLE_BOX = { x: HOOP_CX - TABLE.cx * TABLE_SCALE, y: HOOP_CY - TABLE.cy * TABLE_SCALE, width: TABLE.width * TABLE_SCALE, height: TABLE.height * TABLE_SCALE };

const RIM_R = 170, RIM_SPAN = 50;
const RIM_PATH = (() => {
  const a = RIM_SPAN * Math.PI / 180;
  const x0 = HOOP_CX - Math.sin(a) * RIM_R, x1 = HOOP_CX + Math.sin(a) * RIM_R, y = HOOP_CY + Math.cos(a) * RIM_R;
  return `M${x0.toFixed(1)} ${y.toFixed(1)}A${RIM_R} ${RIM_R} 0 0 0 ${x1.toFixed(1)} ${y.toFixed(1)}`;
})();

export interface SceneMotif { motif: TextileMotif; count?: number; leaving?: boolean }
export interface StoryRim { text: string; key: string; leaving?: boolean }
/** A flower's small moment: `bloom` when its last stitch is tied, `sway` in the wind or under a finger, `nod` to a neighbour. `n` restarts it. */
export interface FlowerFx { kind: 'bloom' | 'sway' | 'nod'; n: number; delay?: number }
export interface SceneFx {
  flowers?: Readonly<Record<number, FlowerFx>>;
  /** Cells whose threads catch the light now. */
  shimmer?: Readonly<Record<number, { n: number; delay: number }>>;
  /** A band of sunlight crossing the cloth (a new number sends another). */
  beam?: number;
  /** Drops of water on the leaves. */
  dew?: { n: number; drops: readonly { x: number; y: number; delay: number }[] } | null;
  /** The flower the showing hand is about to plant, as a faint promise. */
  ghost?: TextileMotif | null;
  /** Turns of the brass screw. */
  screw?: number;
}
export interface TextileSceneProps {
  cloth: TextileCloth;
  motifs: readonly SceneMotif[];
  /** `table`: the hoop lying on Aya's table (the game). `keep`: the hoop by itself (the kept piece, the cover). */
  view: 'table' | 'keep';
  /** The finish: 0 at work, 1 held up to the light, 2 set down again, finished. */
  held?: 0 | 1 | 2;
  /** The hem lines sewn along the lower rim (the newest, plus one fading out). */
  story?: readonly StoryRim[];
  lang: 'en' | 'he';
  /** Faint chalk crosses on the cells still free. */
  crosses?: readonly number[];
  /** The cell a dragged flower is over, and the cell a finger is pressing. */
  aim?: number | null;
  needle?: Ref<NeedleHandle>;
  needleThread?: number;
  needleAway?: boolean;
  fx?: SceneFx;
  /** The small picture is enough (tiles, the tray). */
  small?: boolean;
  className?: string;
  /** Things that stand on the table around the hoop, under the needle. */
  children?: ReactNode;
}

const NO_FX: SceneFx = {};

/** The whole textile: the table, the hoop's shadow, the cloth and its dye, the flowers, the hem, the wood, the needle. */
export function TextileScene({ cloth, motifs, view, held = 0, story = [], lang, crosses = [], aim = null, needle, needleThread = 0, needleAway = false, fx = NO_FX, small = false, className, children }: TextileSceneProps) {
  const raw = useId(), id = raw.replace(/:/g, '');
  const ids = { vignette: `${id}v`, wood: `${id}d`, woodIn: `${id}i`, brass: `${id}b`, brassHead: `${id}h`, steel: `${id}s`, rim: `${id}r`, clip: `${id}c`, shadow: `${id}o`, beam: `${id}m`, light: `${id}l` };
  const tones = CLOTH_TONES[cloth];
  const picture = small && TABLE.src480 ? TABLE.src480 : TABLE.src;
  return <svg className={['sg-scene', className].filter(Boolean).join(' ')} viewBox={`0 0 ${ART_W} ${ART_H}`} data-cloth={cloth} data-view={view} data-held={held} style={clothStyle(cloth)} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={ids.vignette} cx=".5" cy=".5" r=".5">
        <stop offset=".8" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.16 }} />
      </radialGradient>
      <radialGradient id={ids.light} cx=".36" cy=".3" r=".7">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.9 }} />
        <stop offset=".55" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0.35 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} />
      </radialGradient>
      <linearGradient id={ids.wood} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: WOOD_LIGHT }} />
        <stop offset=".55" style={{ stopColor: WOOD }} />
        <stop offset="1" style={{ stopColor: WOOD_SHADE }} />
      </linearGradient>
      <linearGradient id={ids.woodIn} x1="1" y1="1" x2="0" y2="0">
        <stop offset="0" style={{ stopColor: WOOD_LIGHT }} />
        <stop offset="1" style={{ stopColor: WOOD_SHADE }} />
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
        <stop offset=".78" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.3 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
      </radialGradient>
      <linearGradient id={ids.beam} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} />
        <stop offset=".5" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0.55 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} />
      </linearGradient>
      <clipPath id={ids.clip}><circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 2} /></clipPath>
      <path id={ids.rim} d={RIM_PATH} />
    </defs>

    {view === 'table' && <image className="sg-table" href={picture} {...TABLE_BOX} preserveAspectRatio="none" />}
    {/* The hoop's shadow on the table falls down and to the right, like the window's. */}
    <ellipse className="sg-hoop-shadow" cx={HOOP_CX + 5} cy={HOOP_CY + 8} rx="222" ry="220" fill={`url(#${ids.shadow})`} opacity={view === 'table' ? 1 : 0.5} />

    <g className="sg-work">
      <g clipPath={`url(#${ids.clip})`}>
        <image href={picture} {...TABLE_BOX} preserveAspectRatio="none" />
        {tones.dye && <circle className="sg-dye" cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 3} style={{ fill: tones.dye, mixBlendMode: 'multiply' }} />}
        {/* Stretched in the hoop the cloth is a touch brighter than the table, and the ring shades its near edge. */}
        <circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 3} style={{ fill: veil('--mk-white', tones.dye ? 5 : 16) }} />
        <circle cx={HOOP_CX + 3} cy={HOOP_CY + 4} r={CLOTH_R + 2} style={{ fill: 'none', stroke: veil('--mk-shadow', 15), strokeWidth: 9 }} />
        <circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 2} fill={`url(#${ids.vignette})`} />
        <circle className="sg-backlight" cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 2} fill={`url(#${ids.light})`} />
      </g>

      <g className="sg-crosses" fill="none" strokeLinecap="round">
        {crosses.map(cell => { const c = cellCentre(cell); const y = c.y - 2;
          return <g key={cell} data-cross={cell} data-aim={aim === cell} style={{ stroke: 'var(--sg-chalk)', strokeWidth: 2.6, strokeDasharray: '3 2.4', transformOrigin: `${c.x}px ${y}px` }}>
            <path d={`M${c.x - 7} ${y - 7}L${c.x + 7} ${y + 7}M${c.x + 7} ${y - 7}L${c.x - 7} ${y + 7}`} />
            {aim === cell && <circle cx={c.x} cy={y} r="22" style={{ strokeWidth: 2.4, strokeDasharray: '4 3' }} />}
          </g>; })}
      </g>

      <g clipPath={`url(#${ids.clip})`}>
        {fx.ghost && <g className="sg-promise"><SceneFlower motif={fx.ghost} /></g>}
        {motifs.map(({ motif, count, leaving }) => { const f = leaving ? undefined : fx.flowers?.[motif.cell], lit = leaving ? undefined : fx.shimmer?.[motif.cell], c = cellCentre(motif.cell);
          return <g key={`${motif.cell}:${motif.flower}:${motif.thread}${leaving ? ':out' : ''}`} className="sg-flower" data-fx={f ? `${f.kind}-${f.n % 2}` : undefined} style={{ transformOrigin: `${c.x}px ${c.y + 39}px`, animationDelay: f?.delay ? `${f.delay}ms` : undefined }}>
            <SceneFlower motif={motif} count={count} />
            {lit && <SceneShimmer key={lit.n} motif={motif} delay={lit.delay} />}
          </g>; })}
        {fx.dew && <g key={fx.dew.n} className="sg-dew" pointerEvents="none">
          {fx.dew.drops.map((d, i) => <g key={i} style={{ transformOrigin: `${d.x}px ${d.y}px`, animationDelay: `${d.delay}ms` }}>
            <ellipse cx={d.x + 0.5} cy={d.y + 0.7} rx="2.3" ry="2.6" style={{ fill: veil('--mk-shadow', 22) }} />
            <ellipse cx={d.x} cy={d.y} rx="2.1" ry="2.5" style={{ fill: veil('--mk-sky-pale', 78) }} />
            <circle cx={d.x - 0.7} cy={d.y - 0.9} r=".8" style={{ fill: 'var(--mk-white)' }} />
          </g>)}
        </g>}
        {!!fx.beam && <rect key={fx.beam} className="sg-beam" x="-150" y="0" width="150" height={ART_H} fill={`url(#${ids.beam})`} />}
      </g>

      <g className="sg-hem" style={{ font: `900 ${lang === 'he' ? 18 : 17}px var(--studio-font, Nunito, Heebo, sans-serif)` }}>
        {story.map(line => <text key={line.key} className="sg-hem__line" data-leaving={!!line.leaving} direction={lang === 'he' ? 'rtl' : 'ltr'} style={{ fill: 'color-mix(in srgb, var(--sg-hem) 24%, transparent)', stroke: 'var(--sg-hem)', strokeWidth: 0.95, strokeDasharray: '2.3 1.5', strokeLinecap: 'round', strokeLinejoin: 'round', fontSize: line.text.length > 26 ? (lang === 'he' ? 16 : 15) : undefined }}>
          <textPath href={`#${ids.rim}`} startOffset="50%" textAnchor="middle">{line.text}</textPath>
        </text>)}
      </g>

      <HoopWood wood={ids.wood} woodIn={ids.woodIn} brass={ids.brass} brassHead={ids.brassHead} screw={fx.screw ?? 0} />
    </g>

    {children}
    {needle && <Needle ref={needle} thread={needleThread} gradient={ids.steel} away={needleAway} />}
  </svg>;
}

function SceneFlower({ motif, count }: { motif: TextileMotif; count?: number }) {
  const stitches = useMemo(() => stitchesFor(motif.flower, motif.cell), [motif.flower, motif.cell]);
  return <MotifThreads stitches={stitches} thread={motif.thread} count={count ?? stitches.length} flower={motif.flower} cell={motif.cell} />;
}
function SceneShimmer({ motif, delay }: { motif: TextileMotif; delay: number }) {
  const stitches = useMemo(() => stitchesFor(motif.flower, motif.cell), [motif.flower, motif.cell]);
  return <Shimmer stitches={stitches} delay={delay} />;
}

/* ── things on the table ────────────────────────────────────────────────── */

/** A kit picture placed in the drawing: `x`,`y` its top-left, `width` across (height follows its shape). */
export function KitProp({ picture, x, y, width, className, children }: { picture: KitPicture; x: number; y: number; width: number; className?: string; children?: ReactNode }) {
  const height = width * picture.height / picture.width;
  return <g className={className} style={{ transformOrigin: `${x + width / 2}px ${y + height}px` }} pointerEvents="none">
    <ellipse cx={x + width / 2 + 2} cy={y + height - 1} rx={width * 0.36} ry={Math.max(2, width * 0.06)} style={{ fill: veil('--mk-shadow', 22) }} />
    <image href={picture.src} x={x} y={y} width={width} height={height} />
    {children}
  </g>;
}

/** A visitor worked in thread, in its own frame (head towards +x). */
export const CritterArt = memo(function CritterArt({ kind }: { kind: CritterKind }) {
  const c = critterStitches(kind);
  const layer = (group: typeof c.body, name: string) => group.length > 0 && <g className={name}>
    {group.map((l, i) => <g key={i}>{l.stitches.map((s, j) => <Thread key={j} s={s} thread={l.thread} />)}</g>)}
  </g>;
  return <g className="sg-critter__art" data-critter={kind} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="1.5" cy="7.5" rx="8" ry="2.6" style={{ fill: veil('--mk-shadow', 16) }} />
    {c.lamp && <g className="sg-critter__lamp"><circle cx={c.lamp.x} cy={c.lamp.y} r={c.lamp.r} style={{ fill: veil('--mk-butter', 26) }} /><circle cx={c.lamp.x} cy={c.lamp.y} r={c.lamp.r * 0.55} style={{ fill: veil('--mk-sun', 34) }} /></g>}
    {layer(c.legs, 'sg-critter__legs')}
    {layer(c.wings, 'sg-critter__wings')}
    {layer(c.body, 'sg-critter__body')}
  </g>;
});

/* ── the sewing box: pattern cards, threads, cloths ─────────────────────── */

/** A round of the real linen, dyed like the chosen cloth, centred on 0,0. */
function LinenRound({ id, cloth, r, cy = 0 }: { id: string; cloth: TextileCloth; r: number; cy?: number }) {
  const dye = CLOTH_TONES[cloth].dye, w = TABLE.width * TABLE_SCALE, h = TABLE.height * TABLE_SCALE;
  return <>
    <defs><clipPath id={id}><circle cx="0" cy={cy} r={r} /></clipPath></defs>
    <circle cx="1" cy={cy + 1.6} r={r} style={{ fill: veil('--mk-shadow', 16) }} />
    <g clipPath={`url(#${id})`}>
      <image href={TABLE.src480 ?? TABLE.src} x={-TABLE.cx * TABLE_SCALE - 60} y={cy - TABLE.cy * TABLE_SCALE - 40} width={w} height={h} preserveAspectRatio="none" />
      {dye && <circle cx="0" cy={cy} r={r + 1} style={{ fill: dye, mixBlendMode: 'multiply' }} />}
      <circle cx="0" cy={cy} r={r + 1} style={{ fill: veil('--mk-white', dye ? 5 : 18) }} />
    </g>
    <circle cx="0" cy={cy} r={r - 0.5} style={{ fill: 'none', stroke: veil('--mk-shadow', 12), strokeWidth: 1 }} />
  </>;
}

/** A pattern card: one flower stitched small on a round of the chosen cloth. */
export function FlowerSwatch({ flower, thread, cloth, size = 'tray' }: { flower: TextileFlower; thread: number; cloth: TextileCloth; size?: 'tray' | 'ghost' }) {
  const stitches = useMemo(() => motifStitches(flower, 5), [flower]);
  const raw = useId(), id = raw.replace(/:/g, '');
  return <svg className="sg-swatch" data-size={size} viewBox="-45 -54 90 94" style={clothStyle(cloth)} aria-hidden="true" focusable="false">
    <LinenRound id={`${id}c`} cloth={cloth} r={44} cy={-7} />
    <MotifThreads stitches={stitches} thread={thread} count={stitches.length} flower={flower} cell={5} />
  </svg>;
}

/** A thread to choose: a button of satin stitch in that thread on a scrap of linen, its loose end curling away. */
const DOT_STITCHES: readonly Stitch[] = [-9, -6, -3, 0, 3, 6, 9].map((x, i) => { const h = Math.sqrt(Math.max(4, 121 - x * x)) * 0.92; return { x1: x - 0.6, y1: -h + (i % 2) * 0.6, x2: x + 0.6, y2: h - (i % 2) * 0.5, w: 3.5, tone: 'thread', part: 'petal' } as Stitch; });
const DOT_TAIL: Stitch = { x1: 9, y1: 7, x2: 17, y2: 15, cx: 18, cy: 6, w: 1.5, tone: 'thread', part: 'petal' };
export function ThreadDot({ thread }: { thread: number }) {
  const raw = useId(), id = raw.replace(/:/g, '');
  return <svg className="sg-dot" viewBox="-24 -24 48 48" aria-hidden="true" focusable="false">
    <LinenRound id={`${id}c`} cloth="linen" r={21} />
    <g fill="none" strokeLinecap="round"><Thread s={DOT_TAIL} thread={thread} />{DOT_STITCHES.map((s, i) => <Thread key={i} s={s} thread={thread} />)}</g>
  </svg>;
}

/** A small round of one cloth, for the cloth choices: the linen, dyed, with a running stitch round its edge. */
export function ClothPatch({ cloth }: { cloth: TextileCloth }) {
  const raw = useId(), id = raw.replace(/:/g, '');
  return <svg className="sg-patch" viewBox="-20 -20 40 40" style={clothStyle(cloth)} aria-hidden="true" focusable="false">
    <LinenRound id={`${id}c`} cloth={cloth} r={18} />
    <circle cx="0" cy="0" r="14" style={{ fill: 'none', stroke: 'var(--sg-chalk)', strokeWidth: 1.3, strokeDasharray: '2.6 2.2' }} strokeLinecap="round" opacity=".85" />
  </svg>;
}
