import { forwardRef, memo, useCallback, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { TextileCloth, TextileFlower, TextileMotif } from './stitchGardenRules';
import { ART_H, ART_W, CLOTH_R, HOOP_CX, HOOP_CY, cellCentre, motifStitches, stitchesFor, type Stitch, type StitchTone } from './stitchGardenStitches';
import { PARKED_NEEDLE, type NeedlePose } from './stitchGardenMotion';
import { critterStitches, type CritterKind } from './stitchGardenCritters';
import type { KitPicture } from './stitchGardenKit';
import type { Want } from './stitchGardenPlay';
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
const ply = (c: string) => `color-mix(in srgb, color-mix(in srgb, ${c} 66%, var(--mk-shadow)) 38%, transparent)`;
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
  // Two plies twisted together: short darker bands along the strand, under a thin line of sheen on its lit side.
  return <g data-part={s.part}>
    <path d={d} transform="translate(.7 1)" style={{ stroke: under(colour), strokeWidth: s.w + 0.6 }} opacity=".85" />
    <path d={d} style={{ stroke: colour, strokeWidth: s.w }} />
    {s.w >= 1.9 && <path className="sg-ply" d={d} strokeLinecap="butt" style={{ stroke: ply(colour), strokeWidth: s.w * 0.86, strokeDasharray: `${(s.w * 0.34).toFixed(2)} ${(s.w * 0.62).toFixed(2)}` }} />}
    <path d={d} transform="translate(-.3 -.4)" style={{ stroke: shine(colour), strokeWidth: Math.max(0.35, s.w * 0.28) }} opacity=".85" />
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

/** The needle is drawn large for a small screen: a child's blunt tapestry needle, not a sharp. */
const NEEDLE_BIG = 1.55, NEEDLE_LONG = 40 * NEEDLE_BIG;
const NEEDLE_BODY = 'M0 0L-11 -1.25L-43.5 -1.45Q-47 0 -43.5 1.45L-11 1.25Z';
export interface NeedleHandle { set(pose: NeedlePose): void }

/** The needle and the thread it carries. The game's frame loop moves it by
 * calling `set`; React only draws its parts. Dipped, it shortens towards its
 * point and dimples the cloth; drawn back, it lifts off its shadow and pulls
 * the thread straight from the last stitch to its eye. */
const Needle = forwardRef<NeedleHandle, { thread: number; gradient: string; away: boolean; home: NeedlePose; waiting: boolean }>(function Needle({ thread, gradient, away, home, waiting }, ref) {
  const colour = THREAD_COLOURS[thread] ?? THREAD_COLOURS[0];
  const root = useRef<SVGGElement>(null), body = useRef<SVGGElement>(null), shade = useRef<SVGPathElement>(null), dimple = useRef<SVGEllipseElement>(null);
  const lead = useRef<SVGPathElement>(null), leadUnder = useRef<SVGPathElement>(null), loose = useRef<SVGGElement>(null);
  const apply = useCallback((pose: NeedlePose) => {
    const a = pose.angle * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const lift = Math.max(0, pose.z), dip = Math.max(0, -pose.z);
    const back = lift * 16, long = 1 - 0.42 * dip;
    const tx = pose.x - cos * back - lift * 1.2, ty = pose.y - sin * back - lift * 4;
    const ex = tx - cos * NEEDLE_LONG * long, ey = ty - sin * NEEDLE_LONG * long;
    const turn = `rotate(${pose.angle.toFixed(2)}deg) scale(${(long * NEEDLE_BIG).toFixed(3)}, ${NEEDLE_BIG})`;
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
      const k = pose.anchor ? 0.5 : 0.7 + 0.5 * pose.slack;
      loose.current.style.transform = `translate(${ex.toFixed(2)}px, ${ey.toFixed(2)}px) scale(${k.toFixed(3)})`;
    }
    if (root.current) root.current.dataset.resting = String(pose === home);
  }, [home]);
  useImperativeHandle(ref, () => ({ set: apply }), [apply]);
  useLayoutEffect(() => { apply(home); }, [apply, home]);
  const strand = { stroke: colour, strokeWidth: 2 }, strandUnder = { stroke: under(colour), strokeWidth: 2.5 };
  return <g className="sg-needle" ref={root} data-away={away} data-resting="true" data-waiting={waiting} pointerEvents="none">
    <ellipse ref={dimple} className="sg-needle__dimple" rx="4.6" ry="3" style={{ fill: veil('--mk-shadow', 30), opacity: 0 }} />
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
      <path d={NEEDLE_BODY} fill={`url(#${gradient})`} style={{ stroke: veil('--mk-steel-dark', 85), strokeWidth: 0.4 }} />
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
  /** `table`: the hoop lying on Aya's table, the table drawn with it. `keptHoop`: the hoop by itself (the kept piece, the cover). `play`: the hoop alone, laid on the game's own full-bleed table. */
  view: 'table' | 'keptHoop' | 'play';
  /** The finish: 0 at work, 1 held up to the light, 2 set down again, finished. */
  held?: 0 | 1 | 2;
  /** The hem lines sewn along the lower rim (the newest, plus one fading out). */
  story?: readonly StoryRim[];
  lang: 'en' | 'he';
  /** Faint chalk crosses on the cells still free. */
  crosses?: readonly number[];
  /** The cell a dragged flower is over, and the cell a finger is pressing. */
  aim?: number | null;
  press?: number | null;
  needle?: Ref<NeedleHandle>;
  needleThread?: number;
  needleAway?: boolean;
  /** Where the needle rests, in the drawing's units (its pincushion). */
  needleHome?: NeedlePose;
  /** The needle is held over a half-sewn flower, waiting for the next pull. */
  needleWaiting?: boolean;
  /** Chapter two: what the LeafLab reads at each spot of the planted row. `open` while nothing is planted there. */
  spots?: readonly { cell: number; want: Want; open: boolean; calling?: boolean }[];
  /** The set-piece: these flowers have bloomed up off the cloth. */
  lifted?: readonly number[];
  /** A pull of the thread tugs the cloth towards this point (a new `n` tugs again). */
  tug?: { x: number; y: number; n: number } | null;
  fx?: SceneFx;
  /** The small picture is enough (tiles, the tray). */
  small?: boolean;
  className?: string;
  /** Things that stand on the table around the hoop, under the needle. */
  children?: ReactNode;
}

/** Undyed linen: warm, pale, a little creamier than the mat it lies over. */
const LINEN = 'color-mix(in srgb, var(--mk-linen) 34%, var(--mk-white))';
const NO_FX: SceneFx = {};
const NO_SPOTS: NonNullable<TextileSceneProps['spots']> = [], NO_CELLS: readonly number[] = [];

/** The whole textile: the table, the hoop's shadow, the cloth and its dye, the flowers, the hem, the wood, the needle. */
export function TextileScene({ cloth, motifs, view, held = 0, story = [], lang, crosses = [], aim = null, press = null, needle, needleThread = 0, needleAway = false, needleHome = PARKED_NEEDLE, needleWaiting = false, spots = NO_SPOTS, lifted = NO_CELLS, tug = null, fx = NO_FX, className, children }: TextileSceneProps) {
  const raw = useId(), id = raw.replace(/:/g, '');
  const ids = { sheen: `${id}e`, weave: `${id}w`, sun: `${id}u`, vignette: `${id}v`, wood: `${id}d`, woodIn: `${id}i`, brass: `${id}b`, brassHead: `${id}h`, steel: `${id}s`, rim: `${id}r`, clip: `${id}c`, shadow: `${id}o`, beam: `${id}m`, light: `${id}l` };
  const tones = CLOTH_TONES[cloth];
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
        <stop offset=".5" style={{ stopColor: 'color-mix(in srgb, var(--mk-butter) 60%, var(--mk-white))', stopOpacity: 0.85 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} />
      </linearGradient>
      {/* Plain weave, thread over thread: laid over the photographed linen so the cloth stays woven when the camera comes close. */}
      <pattern id={ids.weave} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect x=".3" y=".5" width="2.7" height="2" rx=".9" style={{ fill: veil('--mk-white', 46) }} /><rect x="3.3" y="3.5" width="2.7" height="2" rx=".9" style={{ fill: veil('--mk-white', 46) }} />
        <rect x="3.5" y=".3" width="2" height="2.7" rx=".9" style={{ fill: veil('--mk-white', 20) }} /><rect x=".5" y="3.3" width="2" height="2.7" rx=".9" style={{ fill: veil('--mk-white', 20) }} />
        <path d="M0 2.75h6M0 5.75h6M3.1 0v6M.1 0v6" style={{ stroke: veil('--mk-umber', 17), strokeWidth: 0.7 }} />
      </pattern>
      <radialGradient id={ids.sheen} cx=".3" cy=".22" r=".95">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: tones.dye ? 0.2 : 0.5 }} />
        <stop offset=".5" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.13 }} />
      </radialGradient>
      <radialGradient id={ids.sun} cx=".5" cy=".5" r=".5">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.95 }} />
        <stop offset=".5" style={{ stopColor: 'var(--mk-butter)', stopOpacity: 0.6 }} />
        <stop offset="1" style={{ stopColor: 'var(--mk-sun)', stopOpacity: 0 }} />
      </radialGradient>
      <clipPath id={ids.clip}><circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 2} /></clipPath>
      <path id={ids.rim} d={RIM_PATH} />
    </defs>

    {/* The hoop's shadow on the table falls down and to the right, like the window's. */}
    <ellipse className="sg-hoop-shadow" cx={HOOP_CX + 5} cy={HOOP_CY + 8} rx="222" ry="220" fill={`url(#${ids.shadow})`} opacity={view === 'play' ? 1 : 0.5} />

    <g className="sg-work">
      <g className="sg-tug" data-tug={tug ? tug.n % 2 : undefined} style={tug ? { transformOrigin: `${tug.x}px ${tug.y}px` } : undefined}>
      <g clipPath={`url(#${ids.clip})`}>
        {/* The cloth: its own colour, woven thread over thread, lit from the window and shaded by the ring on its near edge. */}
        <circle className="sg-dye" cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 3} style={{ fill: tones.dye ?? LINEN }} />
        <circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 3} fill={`url(#${ids.sheen})`} />
        <circle className="sg-weave" cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 3} fill={`url(#${ids.weave})`} />
        {view === 'play' && <circle key={cloth} className="sg-clothflash" cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 3} style={{ fill: 'var(--mk-white)' }} />}
        <circle cx={HOOP_CX + 3} cy={HOOP_CY + 4} r={CLOTH_R + 2} style={{ fill: 'none', stroke: veil('--mk-shadow', 15), strokeWidth: 9 }} />
        {spots.map(spot => <SpotPatch key={spot.cell} cell={spot.cell} want={spot.want} open={spot.open} calling={!!spot.calling} sun={ids.sun} />)}
        <circle cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 2} fill={`url(#${ids.vignette})`} />
        <circle className="sg-backlight" cx={HOOP_CX} cy={HOOP_CY} r={CLOTH_R + 2} fill={`url(#${ids.light})`} />
      </g>

      <g className="sg-crosses" fill="none" strokeLinecap="round">
        {crosses.map(cell => { const c = cellCentre(cell); const y = c.y - 2;
          return <g key={cell} data-cross={cell} data-aim={aim === cell} data-press={press === cell} style={{ stroke: 'var(--sg-chalk)', strokeWidth: 2.6, strokeDasharray: '3 2.4', transformOrigin: `${c.x}px ${y}px` }}>
            <circle className="sg-crosses__ring" cx={c.x} cy={y} r="15" style={{ strokeWidth: 1.6, strokeDasharray: '2 3.2' }} />
            <path d={`M${c.x - 7} ${y - 7}L${c.x + 7} ${y + 7}M${c.x + 7} ${y - 7}L${c.x - 7} ${y + 7}`} />
            {aim === cell && <circle cx={c.x} cy={y} r="22" style={{ strokeWidth: 2.4, strokeDasharray: '4 3' }} />}
          </g>; })}
      </g>

      <g clipPath={`url(#${ids.clip})`}>
        {fx.ghost && <g className="sg-promise"><SceneFlower motif={fx.ghost} /></g>}
        {motifs.map(({ motif, count, leaving }) => { const f = leaving ? undefined : fx.flowers?.[motif.cell], lit = leaving ? undefined : fx.shimmer?.[motif.cell], c = cellCentre(motif.cell);
          const up = lifted.includes(motif.cell);
          return <g key={`${motif.cell}:${motif.flower}:${motif.thread}${leaving ? ':out' : ''}`} className="sg-flower" data-fx={f ? `${f.kind}-${f.n % 2}` : undefined} data-lifted={up} style={{ transformOrigin: `${c.x}px ${c.y + 39}px`, animationDelay: f?.delay ? `${f.delay}ms` : undefined }}>
            {up && <g className="sg-flower__cast" style={{ transformOrigin: `${c.x}px ${c.y + 10}px` }}><SceneFlower motif={motif} cast /></g>}
            <g className="sg-flower__body" style={{ transformOrigin: `${c.x}px ${c.y + 10}px` }}><SceneFlower motif={motif} count={count} /></g>
            {lit && <SceneShimmer key={`lit${lit.n}`} motif={motif} delay={lit.delay} />}
          </g>; })}
        {fx.dew && <g key={`dew${fx.dew.n}`} className="sg-dew" pointerEvents="none">
          {fx.dew.drops.map((d, i) => <g key={i} style={{ transformOrigin: `${d.x}px ${d.y}px`, animationDelay: `${d.delay}ms` }}>
            <ellipse cx={d.x + 0.5} cy={d.y + 0.7} rx="2.3" ry="2.6" style={{ fill: veil('--mk-shadow', 22) }} />
            <ellipse cx={d.x} cy={d.y} rx="2.1" ry="2.5" style={{ fill: veil('--mk-sky-pale', 78) }} />
            <circle cx={d.x - 0.7} cy={d.y - 0.9} r=".8" style={{ fill: 'var(--mk-white)' }} />
          </g>)}
        </g>}
        {!!fx.beam && <rect key={`beam${fx.beam}`} className="sg-beam" x="-210" y="0" width="210" height={ART_H} fill={`url(#${ids.beam})`} />}
      </g>
      </g>

      <g className="sg-hem" style={{ font: `900 ${lang === 'he' ? 18 : 17}px var(--studio-font, Nunito, Heebo, sans-serif)` }}>
        {story.map(line => <text key={line.key} className="sg-hem__line" data-leaving={!!line.leaving} direction={lang === 'he' ? 'rtl' : 'ltr'} style={{ fill: 'color-mix(in srgb, var(--sg-hem) 24%, transparent)', stroke: 'var(--sg-hem)', strokeWidth: 0.95, strokeDasharray: '2.3 1.5', strokeLinecap: 'round', strokeLinejoin: 'round', fontSize: line.text.length > 26 ? (lang === 'he' ? 16 : 15) : undefined }}>
          <textPath href={`#${ids.rim}`} startOffset="50%" textAnchor="middle">{line.text}</textPath>
        </text>)}
      </g>

      <HoopWood wood={ids.wood} woodIn={ids.woodIn} brass={ids.brass} brassHead={ids.brassHead} screw={fx.screw ?? 0} />
    </g>

    {children}
    {needle && <Needle ref={needle} thread={needleThread} gradient={ids.steel} away={needleAway} home={needleHome} waiting={needleWaiting} />}
  </svg>;
}

function SceneFlower({ motif, count, cast = false }: { motif: TextileMotif; count?: number; cast?: boolean }) {
  const stitches = useMemo(() => stitchesFor(motif.flower, motif.cell), [motif.flower, motif.cell]);
  // The shadow a risen flower throws on the cloth: its own outline, in shade.
  if (cast) return <g fill="none" strokeLinecap="round" style={{ stroke: 'var(--mk-shadow)' }}>{stitches.filter((_, i) => i % 2 === 0).map((s, i) => s.knot ? <circle key={i} cx={s.x1} cy={s.y1} r={s.w / 2} style={{ fill: 'var(--mk-shadow)', stroke: 'none' }} /> : <path key={i} d={pathOf(s)} style={{ strokeWidth: s.w + 1.4 }} />)}</g>;
  return <MotifThreads stitches={stitches} thread={motif.thread} count={count ?? stitches.length} flower={motif.flower} cell={motif.cell} />;
}
function SceneShimmer({ motif, delay }: { motif: TextileMotif; delay: number }) {
  const stitches = useMemo(() => stitchesFor(motif.flower, motif.cell), [motif.flower, motif.cell]);
  return <Shimmer stitches={stitches} delay={delay} />;
}

/* ── the planted row: light, water and shade on the cloth ───────────────── */

/** The picture for what a spot offers and a flower likes: a sun, a drop, a fern leaf. Centred on 0,0, about 20 units across. The same three are printed on the seed packets. */
export function WantToken({ want }: { want: Want }) {
  if (want === 'sunSpot') return <g className="sg-token" data-want={want}>
    <g style={{ stroke: 'var(--mk-amber)', strokeWidth: 2.2 }} strokeLinecap="round">{[0, 45, 90, 135, 180, 225, 270, 315].map(a => <path key={a} d="M0 -8.4V-10.6" transform={`rotate(${a})`} />)}</g>
    <circle r="6" style={{ fill: 'var(--mk-sun)', stroke: 'var(--mk-amber)', strokeWidth: 1.4 }} /><circle cx="-1.8" cy="-2" r="1.8" style={{ fill: veil('--mk-white', 80) }} />
  </g>;
  if (want === 'dewSpot') return <g className="sg-token" data-want={want}>
    <path d="M0 -10C4.6 -4.2 7.2 -.6 7.2 3.2A7.2 7.2 0 0 1 -7.2 3.2C-7.2 -.6 -4.6 -4.2 0 -10Z" style={{ fill: 'var(--mk-sea)', stroke: 'var(--mk-water)', strokeWidth: 1.4 }} strokeLinejoin="round" />
    <path d="M-3.4 3.4a3.6 3.6 0 0 0 2.4 3" style={{ fill: 'none', stroke: veil('--mk-white', 85), strokeWidth: 1.5 }} strokeLinecap="round" />
  </g>;
  return <g className="sg-token" data-want={want}>
    <path d="M-8.6 7.6C-8 -3 -1 -9.4 9 -9C9.6 1 3.4 8.4 -8.6 7.6Z" style={{ fill: 'var(--mk-leaf)', stroke: 'var(--mk-leaf-deep)', strokeWidth: 1.4 }} strokeLinejoin="round" />
    <path d="M-7.6 6.8C-2.4 2.4 2.6 -2.4 6.6 -6.6M-2.6 2.2l.4 -4.4M1.4 -1.6l3.6 .5" style={{ fill: 'none', stroke: 'var(--mk-leaf-deep)', strokeWidth: 1.1 }} strokeLinecap="round" />
  </g>;
}

const FROND: readonly (readonly [number, number, number])[] = [[-16, -7, -38], [-7, -14, -64], [4, -16, -98], [13, -9, -132], [-11, 5, -12], [12, 4, -168]];
/** What the LeafLab reads at one spot, shown on the cloth itself: a pool of window light, a damp patch with beads of water, or the fern's shadow. */
const SpotPatch = memo(function SpotPatch({ cell, want, open, calling, sun }: { cell: number; want: Want; open: boolean; calling: boolean; sun: string }) {
  const c = cellCentre(cell), y = c.y - 2;
  return <g className="sg-patch-spot" data-want={want} data-open={open} data-calling={calling} style={{ transformOrigin: `${c.x}px ${y}px` }}>
    {want === 'sunSpot' && <>
      <circle className="sg-patch-spot__glow" cx={c.x} cy={y} r="31" fill={`url(#${sun})`} style={{ transformOrigin: `${c.x}px ${y}px` }} />
      <g style={{ stroke: veil('--mk-white', 70), strokeWidth: 4.4 }} strokeLinecap="round" opacity=".5">{[-11, 0, 11].map(dx => <path key={dx} d={`M${c.x + dx - 7} ${y + 18}L${c.x + dx + 7} ${y - 18}`} />)}</g>
    </>}
    {want === 'dewSpot' && <>
      <ellipse cx={c.x} cy={y} rx="28" ry="27" style={{ fill: veil('--mk-water', 16) }} /><ellipse cx={c.x + 2} cy={y + 2} rx="21" ry="20" style={{ fill: veil('--mk-indigo', 9) }} />
      {[[-15, -10, 2.6], [12, -15, 2.1], [18, 7, 2.9], [-7, 16, 2.3], [-20, 6, 1.8], [4, -20, 1.7]].map(([dx, dy, r], i) => <g key={i} className="sg-patch-spot__bead" style={{ animationDelay: `${i * 260}ms` }}>
        <ellipse cx={c.x + dx + 0.6} cy={y + dy + 0.9} rx={r} ry={r * 1.12} style={{ fill: veil('--mk-shadow', 26) }} />
        <ellipse cx={c.x + dx} cy={y + dy} rx={r} ry={r * 1.12} style={{ fill: veil('--mk-sky-pale', 82) }} /><circle cx={c.x + dx - r * 0.3} cy={y + dy - r * 0.4} r={r * 0.36} style={{ fill: 'var(--mk-white)' }} />
      </g>)}
    </>}
    {want === 'fernShade' && <g className="sg-patch-spot__fronds" style={{ transformOrigin: `${c.x + 26}px ${y - 30}px` }}>
      <ellipse cx={c.x} cy={y} rx="28" ry="26" style={{ fill: veil('--mk-shadow', 9) }} />
      {FROND.map(([dx, dy, a], i) => <ellipse key={i} cx={c.x + dx} cy={y + dy} rx="11" ry="3.8" transform={`rotate(${a} ${c.x + dx} ${y + dy})`} style={{ fill: veil('--mk-leaf-deep', 30) }} />)}
    </g>}
    {open && <g transform={`translate(${c.x + 21} ${y - 21}) scale(.82)`}><circle r="12.5" style={{ fill: veil('--mk-white', 88), stroke: veil('--mk-shadow', 14), strokeWidth: 1 }} /><WantToken want={want} /></g>}
  </g>;
});

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

/** A round of cloth in the chosen colour, centred on 0,0. */
function LinenRound({ id, cloth, r, cy = 0 }: { id: string; cloth: TextileCloth; r: number; cy?: number }) {
  const dye = CLOTH_TONES[cloth].dye;
  return <>
    <defs>
      <clipPath id={id}><circle cx="0" cy={cy} r={r} /></clipPath>
      <pattern id={`${id}w`} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect x=".2" y=".3" width="1.8" height="1.4" rx=".6" style={{ fill: veil('--mk-white', 40) }} /><rect x="2.2" y="2.3" width="1.8" height="1.4" rx=".6" style={{ fill: veil('--mk-white', 40) }} />
        <path d="M0 1.900h4M0 3.900h4M2.100 0v4M.100 0v4" style={{ stroke: veil('--mk-umber', 22), strokeWidth: 0.4 }} />
      </pattern>
    </defs>
    <circle cx="1" cy={cy + 1.6} r={r} style={{ fill: veil('--mk-shadow', 16) }} />
    <g clipPath={`url(#${id})`}>
      <circle cx="0" cy={cy} r={r + 1} style={{ fill: dye ?? LINEN }} />
      <circle cx="0" cy={cy} r={r + 1} fill={`url(#${id}w)`} opacity=".55" />
      <circle cx={-r * 0.3} cy={cy - r * 0.35} r={r * 0.9} style={{ fill: veil('--mk-white', dye ? 8 : 26) }} />
    </g>
    <circle cx="0" cy={cy} r={r - 0.5} style={{ fill: 'none', stroke: veil('--mk-shadow', 12), strokeWidth: 1 }} />
  </>;
}

/** A pattern card: one flower stitched small on a round of the chosen cloth. */
export const FlowerSwatch = memo(function FlowerSwatch({ flower, thread, cloth, size = 'tray' }: { flower: TextileFlower; thread: number; cloth: TextileCloth; size?: 'tray' | 'ghost' }) {
  const stitches = useMemo(() => motifStitches(flower, 5), [flower]);
  const raw = useId(), id = raw.replace(/:/g, '');
  return <svg className="sg-swatch" data-size={size} viewBox="-45 -54 90 94" style={clothStyle(cloth)} aria-hidden="true" focusable="false">
    <LinenRound id={`${id}c`} cloth={cloth} r={44} cy={-7} />
    <MotifThreads stitches={stitches} thread={thread} count={stitches.length} flower={flower} cell={5} />
  </svg>;
});

/** A thread to choose: a button of satin stitch in that thread on a scrap of linen, its loose end curling away. */
const DOT_STITCHES: readonly Stitch[] = [-9.6, -7.2, -4.8, -2.4, 0, 2.4, 4.8, 7.2, 9.6].map((x, i) => { const h = Math.sqrt(Math.max(1, 132 - x * x)) - 1.2; return { x1: x - 0.5, y1: -h + (i % 2) * 0.5, x2: x + 0.5, y2: h - (i % 2) * 0.4, w: 2.9, tone: i === 0 || i === 8 ? 'threadDeep' : 'thread', part: 'petal' } as Stitch; });
const DOT_TAIL: Stitch = { x1: 8, y1: 8, x2: 18, y2: 14, cx: 18, cy: 5, w: 1.6, tone: 'thread', part: 'petal' };
export const ThreadDot = memo(function ThreadDot({ thread }: { thread: number }) {
  const raw = useId(), id = raw.replace(/:/g, '');
  return <svg className="sg-dot" viewBox="-24 -24 48 48" aria-hidden="true" focusable="false">
    <LinenRound id={`${id}c`} cloth="linen" r={21} />
    <g fill="none" strokeLinecap="round"><Thread s={DOT_TAIL} thread={thread} />{DOT_STITCHES.map((s, i) => <Thread key={i} s={s} thread={thread} />)}</g>
  </svg>;
});

/** A small round of one cloth, for the cloth choices: the linen, dyed, with a running stitch round its edge. */
export const ClothPatch = memo(function ClothPatch({ cloth }: { cloth: TextileCloth }) {
  const raw = useId(), id = raw.replace(/:/g, '');
  return <svg className="sg-patch" viewBox="-20 -20 40 40" style={clothStyle(cloth)} aria-hidden="true" focusable="false">
    <LinenRound id={`${id}c`} cloth={cloth} r={18} />
    <circle cx="0" cy="0" r="14" style={{ fill: 'none', stroke: 'var(--sg-chalk)', strokeWidth: 1.3, strokeDasharray: '2.6 2.2' }} strokeLinecap="round" opacity=".85" />
  </svg>;
});
