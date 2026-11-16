import { memo, type CSSProperties, type ReactNode } from 'react';
import {
  BANK_Y, BOAT_STREAM, HARBOUR_LAMPS, LANE_Y, PAGE_D, PAGE_W, QUAY_X, SPREAD_W,
  boatYaw, courseX, foldAngles, hopArc, peek, riverBoat, riverItems, riverLanterns, settleRise, shake,
  type HarbourState, type Lane, type RiverState, type SpreadIndex,
} from './paperBoatRules';
import { LanternArt, RainbowArt, WaveArt, fade, mix, mk } from './PaperBoatArt';
import { KIT_CLOUDS, KIT_CREW, KIT_MEADOW, KIT_PROPS, KIT_ROCKS, KIT_SCOUT_VIEW, KIT_SLICES, type CrewId, type KitArt } from './paperBoatKit';

/** The four spreads of the pop-up book. A spread is one kit picture standing
 * up in slices, far to near, each hinged on its page; in front of them the
 * page is printed with water (drawn, so it is crisp at any size), a paper
 * boat folded in real 3D sails across both pages past stones, water flowers
 * and paper lanterns that stand where they are printed, and the spread's
 * words are printed on the near bank. A card's angle comes only from the
 * spread's fold progress, through `foldAngles`; when its page lands it rises
 * the last of the way a beat later (`settleRise`). Hebrew mirrors the whole
 * book (the parent does it), so nothing here knows the reading direction
 * except the printed words, which are turned back. Nothing inside the book
 * animates in CSS: every motion is computed from the game's clock. */

export type Side = 'left' | 'right';
/** Everything that moves. Read by the spreads; owned by the game. */
export interface Live {
  time: number;
  reduced: boolean;
  mirror: boolean;
  uid: string;
  lang: 'en' | 'he';
  /** The two printed lines of each spread: one on each page. */
  words: readonly (readonly [string, string])[];
  /** Things that were poked: id → when, and id → how many times. */
  pokes: Readonly<Record<string, number>>;
  taps: Readonly<Record<string, number>>;
  /** Taps on the bare page. */
  ripples: readonly { x: number; y: number; at: number }[];
  /** The boat on the first spread's bank, before it floats. */
  boat0: { x: number; y: number; lift: number; afloat: boolean; hint: boolean };
  launchedAt: number | null;
  stream: RiverState;
  river: RiverState;
  steer0: Lane;
  steer1: Lane;
  /** Things the boat has met (`s0-rock-1`, `s1-gate-2` → when). */
  marks: Readonly<Record<string, number>>;
  /** The lantern the boat is waiting at, if any. */
  waiting: string | null;
  /** The RouteScope's dotted line to the next lantern is showing. */
  route: boolean;
  calm: number;
  calmAt: number | null;
  wheel2: number;
  /** Every cloud was tapped and the storm is over: the paper rainbow stands. */
  rainbowAt: number | null;
  harbour: HarbourState;
  steer3: Lane;
  waitingQuay: boolean;
  dockAt: number | null;
  /** Seconds into the homecoming (-1 before it). */
  home: number;
  /** Which reading this is (lays the floating lanterns and the meadow out anew). */
  variant: number;
}
interface Layer {
  key: string;
  /** Spread x of the card's centre. */
  x: number;
  /** Page depth of the hinge line. */
  y: number;
  w: number;
  h: number;
  /** A card's own progress when it is less than the spread's. */
  p?: number;
  /** Extra lean on top of the fold angle. */
  lean?: number;
  yaw?: number;
  cast?: number;
  className?: string;
  style?: CSSProperties;
  art?: ReactNode;
  /** A button or anything that must sit in the card's plane. */
  extra?: ReactNode;
  /** Something built in the page's own 3D space instead of a card (the boat). */
  solid?: (offset: number, progress: number) => ReactNode;
}
/** Something on a spread that answers a tap. Its spot is on the page at
 * (x, y), `z` up off it. `kind` picks its name and its sound. */
export interface Toy { id: string; kind: ToyKind; x: number; y: number; z: number; wobble?: string; note?: number }
export type ToyKind = 'aya' | 'pep' | 'chock' | 'bebe' | 'gobgob' | 'dome' | 'bell' | 'fountain' | 'bridge' | 'echo' | 'boat'
  | 'stone' | 'lily' | 'skybridge' | 'glasshouse' | 'lamp' | 'cloud' | 'lantern' | 'buggy' | 'meadow';

/** Where the far bank meets the water: at the stone bridge's foot, along a grassy
 * bank the crew stand on, and at the quay itself on the last spread. */
export const WATER_TOP = 126;
const WATER_TOPS: readonly number[] = [126, 126, 126, 102];
const step = (value: number, steps: number) => Math.round(value * steps) / steps;
const laneY = (pos: number) => LANE_Y[0] + (LANE_Y[2] - LANE_Y[0]) * (pos / 2);
const since = (live: Live, id: string) => live.time - (live.pokes[id] ?? -99);
const met = (live: Live, id: string) => (live.marks[id] === undefined ? -1 : live.time - live.marks[id]);
const cutEdge = `drop-shadow(0 -1px 0 ${fade('white', 92)}) drop-shadow(0 1.5px 1.5px ${fade('shadow', 34)})`;

/* ── the card machinery ───────────────────────────────────────────────────── */
function Card({ layer, progress, offset, mirror, rise }: { layer: Layer; progress: number; offset: number; mirror: boolean; rise: { p: number; lean: number } | null }) {
  if (layer.solid) return <>{layer.solid(offset, progress)}</>;
  const p = Math.min(progress * (rise ? rise.p : 1), layer.p ?? 1);
  const fold = foldAngles(p);
  const angle = fold.stand + ((layer.lean ?? 0) + (rise ? rise.lean : 0)) * p;
  const left = layer.x - layer.w / 2;
  const up = Math.sin((Math.max(0, angle) * Math.PI) / 180), cast = layer.cast ?? 1;
  // The window is to the reader's left: a standing card throws its shadow back and to the right.
  const reach = Math.min(64, layer.h * 0.42) * up * cast;
  return <>
    {cast > 0 && up > 0.02 && <span className="pb-cast" style={{ left: left - offset + layer.w * 0.02, top: layer.y - reach, width: layer.w * 0.96, height: reach + 2, opacity: 0.62 * fold.shadow, transform: `translateZ(.4px) skewX(${mirror ? 26 : -26}deg)` }} />}
    {cast > 0 && up > 0.02 && <span className="pb-foot" style={{ left: left - offset, top: layer.y - 1, width: layer.w, opacity: 0.7 * fold.shadow * cast }} />}
    <div className={`pb-pop${layer.className ? ` ${layer.className}` : ''}`} style={{ left: left - offset, top: layer.y - layer.h, width: layer.w, height: layer.h, transform: `translateZ(1px) rotateX(${(-angle).toFixed(2)}deg) rotateY(${layer.yaw ?? 0}deg)`, ...layer.style }}>
      {layer.art}{layer.extra}
    </div>
  </>;
}

/** One half of one spread, as it lies on a page or a leaf face. `settle` is
 * the seconds since this spread's page landed (-1: not landing). */
export function SpreadHalf({ spread, side, progress, settle, live }: { spread: SpreadIndex; side: Side; progress: number; settle: number; live: Live }) {
  const layers = (spread === 0 ? streamLayers : spread === 1 ? riverLayers : spread === 2 ? stormLayers : harbourLayers)(live);
  const offset = side === 'left' ? 0 : PAGE_W;
  const mine = layers.filter(layer => (layer.x < PAGE_W) === (side === 'left')).sort((a, b) => a.y - b.y);
  const slices = KIT_SLICES[spread], near = slices[slices.length - 1], look = printLook(spread, live);
  const flow = live.reduced ? 0 : live.time * (spread === 2 ? 5 + 16 * (1 - live.calm) : 9);
  const line = live.words[spread]?.[side === 'left' ? 0 : 1] ?? '', waterTop = WATER_TOPS[spread];
  return <div className="pb-half" data-spread={spread} data-side={side}>
    <div className="pb-print" aria-hidden="true" data-spread={spread}>
      <span className="pb-farbank" style={{ height: waterTop + 2 }} />
      <span className="pb-water" style={{ top: waterTop, filter: look }} />
      <ReflectArt src={near.art.src} side={side} top={waterTop} height={Math.min(150, near.h * 1.1)} look={look} />
      <span className="pb-ripple pb-ripple--deep" style={{ top: waterTop, transform: `translateX(${(-((flow * 0.6 + offset) % 360)).toFixed(2)}px)` }} />
      <span className="pb-ripple pb-ripple--light" style={{ top: waterTop, transform: `translateX(${(-((flow + offset + 130) % 360)).toFixed(2)}px)` }} />
      <svg className="pb-print__live" viewBox={`${offset} 0 ${PAGE_W} ${PAGE_D}`} width={PAGE_W} height={PAGE_D} aria-hidden="true" focusable="false">{livePrint(spread, live)}</svg>
      <span className="pb-bank" style={{ top: BANK_Y - 7 }} />
      <p className="pb-words" lang={live.lang} dir={live.lang === 'he' ? 'rtl' : 'ltr'} data-side={side} style={{ top: BANK_Y + 7, transform: live.mirror ? 'scaleX(-1)' : undefined }}>{line}</p>
      <span className="pb-sun" style={{ left: -offset - 300 }} />
      <span className="pb-gutter" />
      <span className="pb-grain" />
    </div>
    {mine.map((layer, index) => <Card key={layer.key} layer={layer} progress={progress} offset={offset} mirror={live.mirror} rise={settle >= 0 && !live.reduced ? settleRise(settle, index) : null} />)}
  </div>;
}

const half = (side: Side) => (side === 'left' ? '0 0' : '100% 0');
const SliceArt = memo(function SliceArt({ src, side, look }: { src: string; side: Side; look?: string }) {
  return <span className="pb-slice" style={{ backgroundImage: `url(${src})`, backgroundPosition: half(side), filter: `${look ? `${look} ` : ''}${cutEdge}` }} />;
});
/** The nearest slice, mirrored in the water under it. */
const ReflectArt = memo(function ReflectArt({ src, side, top, height, look }: { src: string; side: Side; top: number; height: number; look?: string }) {
  return <span className="pb-reflect" style={{ top, height, backgroundImage: `url(${src})`, backgroundPosition: side === 'left' ? '0 100%' : '100% 100%', filter: `${look ? `${look} ` : ''}blur(1.3px)` }} />;
});
/** A spread's standing slices, both halves of each. A poked slice wobbles. */
function sliceLayers(spread: SpreadIndex, live: Live, look?: string, extras?: Readonly<Record<string, ReactNode>>): Layer[] {
  const slices = KIT_SLICES[spread];
  return slices.flatMap((item, index) => (['left', 'right'] as const).map((side): Layer => {
    const front = slices[index + 1];
    return {
      key: `${item.id}-${side}`, x: side === 'left' ? PAGE_W / 2 : PAGE_W * 1.5, y: item.y, w: PAGE_W, h: item.h, cast: 0.6,
      lean: live.reduced ? 0 : shake(since(live, item.id), 5, 12, 3.2),
      art: <SliceArt src={item.art.src} side={side} look={look} />,
      extra: <>{front && <ShadeArt src={front.art.src} side={side} height={Math.min(front.h, item.h)} full={front.h} />}{extras?.[`${item.id}-${side}`]}</>,
    };
  }));
}
/** The shadow the slice in front throws on this one: its own outline, a little along from the window's light. */
const ShadeArt = memo(function ShadeArt({ src, side, height, full }: { src: string; side: Side; height: number; full: number }) {
  const mask = `url(${src})`, size = `200% ${full}px`, at = side === 'left' ? '0 100%' : '100% 100%';
  return <span className="pb-shade" style={{ height, WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: size, maskSize: size, WebkitMaskPosition: at, maskPosition: at }} />;
});

/* ── the meadow along the near bank: it sways, and bends as the boat goes by ── */
const MEADOW_PIECES = 10, MEADOW_W = SPREAD_W / MEADOW_PIECES;
const MeadowArt = memo(function MeadowArt({ at }: { at: number }) {
  return <span className="pb-meadow" style={{ backgroundImage: `url(${KIT_MEADOW.src})`, backgroundPosition: `${-at}px 0` }} />;
});
function meadowLayers(live: Live, spread: number, boatX: number, boatY: number): Layer[] {
  const near = Math.max(0, 1 - Math.abs(boatY - LANE_Y[2]) / 60);
  return Array.from({ length: MEADOW_PIECES }, (_, i): Layer => {
    const x = (i + 0.5) * MEADOW_W, away = (x - boatX) / 46;
    const bend = live.reduced ? 0 : -15 * near * Math.exp(-away * away);
    const sway = live.reduced ? 0 : Math.sin(live.time * 1.3 + i * 1.9 + spread) * 2.6 + shake(since(live, `meadow-${i}`), 16, 10, 3);
    return { key: `meadow-${i}`, x, y: BANK_Y + 3, w: MEADOW_W, h: 22, cast: 0, lean: bend + sway, art: <MeadowArt at={((i * 3 + spread * 4 + live.variant) % MEADOW_PIECES) * MEADOW_W} /> };
  });
}

/* ── stand-up figures: the crew ───────────────────────────────────────────── */
const FigureArt = memo(function FigureArt({ src, h, hop, stretch, lift, flip = false }: { src: string; h: number; hop: number; stretch: number; lift: number; flip?: boolean }) {
  return <img className="pb-figure" src={src} alt="" draggable={false} decoding="async" style={{ blockSize: h, bottom: lift, transform: `translate(-50%, ${(-hop).toFixed(1)}px) scale(${((flip ? -1 : 1) * (2 - stretch)).toFixed(3)}, ${stretch.toFixed(3)})` }} />;
});
/** One hop with a little squash before and after it. */
function hopOf(s: number, span = 0.46): { hop: number; stretch: number } {
  if (!(s > 0) || s > span + 0.16) return { hop: 0, stretch: 1 };
  if (s < 0.07) return { hop: 0, stretch: 1 - 0.1 * (s / 0.07) };
  if (s <= span) { const k = hopArc(s - 0.07, span - 0.07); return { hop: k, stretch: 0.9 + 0.2 * Math.min(1, k * 2.2) }; }
  return { hop: 0, stretch: 1 - 0.08 * Math.sin((Math.PI * (s - span)) / 0.16) };
}
/** A crew member standing on the page: they breathe, hop when poked, and hop
 * twice from `cheerAt`. `look`: side on, looking that way across the page. */
function figure(live: Live, id: string, who: CrewId, x: number, y: number, h: number, options: { cheerAt?: number | null; lift?: number; look?: 'left' | 'right' } = {}): Layer[] {
  const art = KIT_CREW[who];
  const s = since(live, id), cheer = options.cheerAt == null ? -1 : live.time - options.cheerAt;
  const a = hopOf(s), b = hopOf(cheer), c = hopOf(cheer - 0.56, 0.4);
  const breath = live.reduced ? 1 : 1 + 0.012 * Math.sin(live.time * 1.8 + x * 0.05);
  const hops = [a, b, c], still = { hop: 0, stretch: breath };
  const best = live.reduced ? still : hops.find(item => item.hop > 0) ?? hops.find(item => item.stretch !== 1) ?? still;
  const pic = options.look ? art.side : art.front, lift = options.lift ?? 0;
  return [{ key: id, x, y, w: Math.max(30, (h * pic.w) / pic.h), h: h + lift, cast: lift ? 0 : 0.5, className: 'pb-figure-card', lean: live.reduced ? 0 : shake(s, 3, 14, 4), art: <FigureArt src={pic.src} h={h} hop={best.hop * h * 0.22} stretch={best.stretch} lift={lift} flip={!!options.look && options.look !== art.faces} /> }];
}
/** A shipped prop standing on the page. */
function prop(key: string, art: KitArt, x: number, y: number, h: number, extra: Partial<Layer> = {}): Layer {
  return { key, x, y, w: (h * art.w) / art.h, h, cast: 0.45, className: 'pb-figure-card', art: <FigureArt src={art.src} h={h} hop={0} stretch={1} lift={0} />, ...extra };
}

/* ── the paper boat, folded in 3D: two hull sides, a floor, and the sail ──── */
interface BoatPose { key: string; x: number; y: number; yaw?: number; roll?: number; pitch?: number; lift?: number; size?: number; stripe?: string; shade?: number }
function boatLayer(live: Live, pose: BoatPose): Layer {
  const { key, x, y, yaw = 0, roll = 0, pitch = 0, lift = 0, size = 1.28, stripe = 'teal', shade = 1 } = pose;
  const jump = live.reduced ? { hop: 0, stretch: 1 } : hopOf(since(live, key), 0.42);
  return {
    key, x, y, w: 0, h: 0,
    solid: (offset, progress) => {
      const fold = Math.max(0.02, progress);
      const style = { left: x - offset, top: y, ['--pb-stripe' as string]: mk(stripe), transform: `translateZ(${(1.6 + lift + jump.hop * 15).toFixed(2)}px) rotateZ(${(-yaw).toFixed(2)}deg) rotateX(${roll.toFixed(2)}deg) rotateY(${pitch.toFixed(2)}deg) scale3d(${(size * (2 - jump.stretch)).toFixed(3)}, ${size}, ${(size * jump.stretch).toFixed(3)})` } as CSSProperties;
      return <div className="pb-b3" data-pb-boat={key} style={style}>
        <i className="pb-b3__shade" style={{ opacity: 0.5 * shade * fold }} />
        <i className="pb-b3__floor" />
        <i className="pb-b3__side pb-b3__side--far" style={{ transform: `rotateX(${(-70 * fold).toFixed(1)}deg)` }} />
        <i className="pb-b3__sail pb-b3__sail--cross" style={{ transform: `rotateZ(90deg) rotateX(${(-90 * fold).toFixed(1)}deg)` }} />
        <i className="pb-b3__sail" style={{ transform: `rotateX(${(-90 * fold).toFixed(1)}deg)` }} />
        <i className="pb-b3__side pb-b3__side--near" style={{ transform: `rotateX(${(-108 * fold).toFixed(1)}deg)` }} />
      </div>;
    },
  };
}

/* ── small effects that sit in a slice's own plane ────────────────────────── */
/** A glint on glass: a four-point sparkle that opens and closes. */
function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  const k = peek(s, 0.5); if (k <= 0) return null;
  return <svg className="pb-fx" style={{ left: x - 26, top: y - 26 }} viewBox="-26 -26 52 52" width="52" height="52" aria-hidden="true" focusable="false">
    <g transform={`scale(${k.toFixed(3)}) rotate(${(s * 80).toFixed(1)})`}>
      <path d="M0 -22 Q 3 -3 22 0 Q 3 3 0 22 Q -3 3 -22 0 Q -3 -3 0 -22 Z" style={{ fill: mk('white') }} />
      <path d="M13 -15 Q 14 -10 19 -9 Q 14 -8 13 -3 Q 12 -8 7 -9 Q 12 -10 13 -15 Z" style={{ fill: fade('white', 85) }} />
    </g>
  </svg>;
}
/** The fountain answers: its jets leap. */
function Jets({ x, y, s }: { x: number; y: number; s: number }) {
  const k = hopArc(s, 0.9); if (k <= 0) return null;
  return <svg className="pb-fx" style={{ left: x - 30, top: y - 56 }} viewBox="-30 -56 60 60" width="60" height="60" aria-hidden="true" focusable="false">
    {[-18, -9, 0, 9, 18].map((dx, i) => <path key={dx} d={`M${dx * 0.3} 0 Q ${dx * 0.7} ${-(30 + (i % 2) * 14) * k} ${dx} ${-(18 + (i % 2) * 10) * k * 0.4}`} style={{ fill: 'none', stroke: fade('white', 90), strokeWidth: 2.6, strokeLinecap: 'round' }} />)}
    {[-12, 6, 15].map((dx, i) => <circle key={dx} cx={dx} cy={-(40 + i * 5) * k} r={1.8} style={{ fill: mk('white') }} />)}
  </svg>;
}
/** A warm light coming on in the picture. */
function Glow({ x, y, r, on }: { x: number; y: number; r: number; on: number }) {
  return on <= 0 ? null : <span className="pb-glow" style={{ left: x - r, top: y - r, width: r * 2, height: r * 2, opacity: on }} />;
}

/* ── what stands along a course: stones, water flowers, paper lanterns ────── */
function courseLayers(live: Live, river: RiverState, prefix: string): Layer[] {
  const still = live.reduced, layers: Layer[] = [];
  riverItems(river).forEach((item, index) => {
    const x = courseX(item.at), y = LANE_Y[item.lane], id = `${prefix}${item.id}`;
    if (item.kind === 'rock') {
      const art = KIT_ROCKS[index % 2], w = index % 2 ? 46 : 54, h = (w * art.h) / art.w;
      const knock = still ? 0 : shake(met(live, id), 16, 12, 3.2) + shake(since(live, id), 9, 11, 3);
      layers.push({ key: id, x, y: y + 9, w, h, cast: 0.55, lean: knock, art: <img className="pb-rock" src={art.src} alt="" draggable={false} decoding="async" style={{ transform: index % 3 === 2 ? 'scaleX(-1)' : undefined }} /> });
    } else if (item.kind === 'pad') {
      const open = (live.taps[id] ?? 0) % 2 === 1, bloom = open ? KIT_PROPS.bloomOpen : KIT_PROPS.bloomFolded, h = open ? 22 : 15;
      const pop = still ? 0 : hopArc(since(live, id), 0.36);
      layers.push(prop(id, bloom, x + 2, y + 11, h * (1 + 0.16 * pop), { cast: 0.2 }));
    } else {
      const rung = met(live, id), lit = rung >= 0, waiting = live.waiting === id;
      const swing = still ? 0 : shake(rung, 26, 8, 1.7) + shake(since(live, id), 18, 9, 2.2) + Math.sin(live.time * 1.5 + index * 2) * 2.4;
      const glow = lit ? (still ? 1 : Math.min(1, rung / 0.25)) : waiting ? 0.3 : 0;
      layers.push({
        key: id, x: x + 2, y: y - 12, w: 54, h: 72, cast: 0.3, lean: still ? 0 : shake(rung, 5, 9, 2.4),
        art: <><Glow x={25} y={38} r={30} on={glow * 0.9} /><LanternArt uid={`${live.uid}-${id}`} mode="onCrook" lit={lit ? 1 : 0} swing={swing} /></>,
      });
    }
  });
  return layers;
}

/* ── spread 1: a stream in the Sky Gardens ────────────────────────────────── */
function streamLayers(live: Live): Layer[] {
  const t = live.time, still = live.reduced, river = live.stream;
  const afloat = live.launchedAt !== null, at = afloat ? riverBoat(river) : live.boat0;
  const steering = river.bumpLane !== null && river.d < river.bumpUntil ? river.bumpLane : live.steer0;
  const after = river.bumpLane !== null ? (river.d - (river.bumpUntil - 60)) / 60 : 1;
  const spin = afloat && after >= 0 && after < 1 && !still ? Math.sin(after * Math.PI * 2) * 20 * (1 - after) : 0;
  const bob = still || !(afloat || live.boat0.afloat) ? 0 : Math.sin(t * 2.3) * 0.9;
  return [
    ...sliceLayers(0, live, undefined, {
      'hills-right': <Sparkle x={208} y={14} s={since(live, 'dome')} />,
      'village-right': <Jets x={96} y={106} s={since(live, 'fountain')} />,
    }),
    ...figure(live, 'aya', 'aya', 58, WATER_TOP + 4, 46, { cheerAt: live.launchedAt, look: 'right' }),
    ...courseLayers(live, river, 's0-'),
    ...meadowLayers(live, 0, at.x, at.y),
    boatLayer(live, { key: 'boat', x: at.x, y: at.y, yaw: afloat ? boatYaw(river.pos, steering) + spin * 1.3 : live.boat0.afloat ? 0 : 24, roll: still ? spin * 0.4 : spin * 0.5 + Math.sin(t * 1.9) * (afloat ? 3 : 0), pitch: still || !afloat ? (afloat ? 0 : -live.boat0.lift * 0.9) : Math.sin(t * 2.3 + 1) * 2.4, lift: bob + (afloat ? 0 : live.boat0.lift), shade: afloat || live.boat0.afloat ? 1 : 0.6 }),
  ];
}

/* ── spread 2: the river through Glass Grove, under the skybridge ─────────── */
function riverLayers(live: Live): Layer[] {
  const river = live.river, still = live.reduced, t = live.time;
  const pepPoke = since(live, 'pep'), lanterns = riverLanterns(river);
  const lastRung = river.gates > 0 ? live.marks[`s1-${lanterns[river.gates - 1].id}`] ?? null : null;
  const at = riverBoat(river);
  const steering = river.bumpLane !== null && river.d < river.bumpUntil ? river.bumpLane : live.steer1;
  const after = river.bumpLane !== null ? (river.d - (river.bumpUntil - 60)) / 60 : 1;
  const spin = after >= 0 && after < 1 && !still ? Math.sin(after * Math.PI * 2) * 20 * (1 - after) : 0;
  return [
    ...sliceLayers(1, live, undefined, { 'skybridge-right': <Sparkle x={196} y={62} s={since(live, 'glasshouse')} /> }),
    ...figure(live, 'pep', 'pep', 92, 102, 42, { look: 'right', cheerAt: lastRung }),
    ...figure(live, 'bebe', 'bebe', 404, 106, 70, { look: 'left', cheerAt: river.gates >= lanterns.length ? lastRung : null }),
    // What Pep's ScoutCam sees from under the skybridge pops up on a paper arm.
    { key: 'scoutView', x: 140, y: 98, w: 70, h: 118, p: still ? (pepPoke >= 0 && pepPoke < 2.6 ? 1 : 0) : peek(pepPoke, 2.2), cast: 0.3, art: <span className="pb-view"><i /><img src={KIT_SCOUT_VIEW.src} alt="" draggable={false} decoding="async" /></span> },
    ...courseLayers(live, river, 's1-'),
    ...meadowLayers(live, 1, at.x, at.y),
    boatLayer(live, { key: 'boat', x: at.x, y: at.y, yaw: boatYaw(river.pos, steering) + spin * 1.3, roll: (still ? 0 : Math.sin(t * 1.9) * 3) + spin * 0.5, pitch: still ? 0 : Math.sin(t * 2.3 + 1) * 2.4, lift: still ? 0 : Math.sin(t * 2.6) * 0.9 }),
  ];
}

/* ── spread 3: rain over Reflection Basin ─────────────────────────────────── */
const CLOUDS = [
  { id: 'cloud-1', x: 84, y: 80, w: 118, h: 150, art: 0 },
  { id: 'cloud-2', x: 236, y: 70, w: 132, h: 172, art: 1 },
  { id: 'cloud-3', x: 392, y: 82, w: 110, h: 142, art: 0 },
] as const;
function CloudArt({ art, w, h, lift, rain, calm, squash, seed, fall }: { art: KitArt; w: number; h: number; lift: number; rain: number; calm: number; squash: number; seed: number; fall: number }) {
  const body = (w * art.h) / art.w, top = (1 - lift) * (h - body - 8);
  const strips = Math.round(11 * rain);
  return <span className="pb-cloud">
    <i className="pb-cloud__stalk" style={{ top: top + body * 0.6 }} />
    {Array.from({ length: strips }, (_, i) => { const run = (fall * (0.9 + (i % 3) * 0.2) + i * 0.37) % 1; return <i key={i} className="pb-cloud__rain" style={{ left: 8 + ((i * 41 + seed * 17) % Math.max(1, w - 24)), top: top + body * 0.7 + run * (h - top - body * 0.7 - 24), height: 16 + (i % 2) * 10, opacity: (0.3 + 0.6 * rain) * Math.sin(Math.PI * run) }} />; })}
    <img src={art.src} alt="" draggable={false} decoding="async" style={{ top, transform: `scale(${(1 + squash * 0.1).toFixed(3)}, ${(1 - squash * 0.14).toFixed(3)})`, filter: `brightness(${(0.5 + 0.5 * calm).toFixed(2)}) saturate(${(0.6 + 0.4 * calm).toFixed(2)})` }} />
  </span>;
}
/** How the basin's boat lies: where it is, and how far the wind and the waves tip it. */
export function stormBoat(live: Live): { x: number; y: number; roll: number; lift: number } {
  const t = live.time, loose = 1 - 0.85 * live.calm;
  const wave = live.reduced ? 0 : Math.sin(t * 1.9) * 15 * loose;
  return { x: 112 + 280 * live.calm, y: LANE_Y[1] + 4, roll: wave + live.wheel2 * 0.42 * (live.calmAt === null ? 1 : 0.3), lift: live.reduced ? 2 : 2 + Math.sin(t * 1.7 + 3) * 3 * loose };
}
function stormLayers(live: Live): Layer[] {
  const calm = live.calm, t = live.time, still = live.reduced;
  const rock = (phase: number) => (still ? 0 : Math.sin(t * 1.7 + phase) * 11 * (1 - 0.85 * calm));
  const sway = (phase: number) => (still ? 0 : Math.sin(t * 1.7 + phase + 0.6) * 3 * (1 - 0.8 * calm));
  const lift = 1 - 0.62 * calm, rain = Math.max(0, 1 - calm * 1.15);
  const flash = still ? 0 : hopArc(since(live, 'lamp'), 1.1);
  const sweep = still ? -4 : Math.sin(t * 0.7) * 10 - 4 + flash * 8;
  // The slices' look moves in steps, so the big pictures are repainted a few times, not every frame.
  const shown = step(calm, 16);
  const look = `saturate(${(0.46 + 0.54 * shown).toFixed(2)}) brightness(${(0.6 + 0.4 * shown).toFixed(2)})`;
  const cheerAt = live.calmAt, boat = stormBoat(live);
  const bow = live.rainbowAt === null ? 0 : still ? 1 : Math.min(1, peek(live.time - live.rainbowAt, 999));
  const layers: Layer[] = [
    ...sliceLayers(2, live, look),
    { key: 'beam', x: 458 - 207, y: 108, w: 440, h: 150, cast: 0, className: 'pb-beam', art: <span className="pb-beam__ray" style={{ opacity: 0.7 - 0.5 * calm + flash * 0.4, transform: `rotate(${sweep.toFixed(2)}deg)` }} /> },
    ...figure(live, 'gobgob', 'gobgob', 372, 110, 54, { cheerAt }),
    ...figure(live, 'chock', 'chock', 416, 112, 52, { cheerAt }),
    prop('lamp', KIT_PROPS.lamp, 466, 112, 46, { lean: still ? 0 : shake(since(live, 'lamp'), 7, 13, 3.4) }),
    // the secret: every cloud tapped, and a paper rainbow stands over the valley once the rain is done
    { key: 'rainbow-left', x: 200, y: 62, w: 100, h: 100, p: bow, cast: 0.2, style: { overflow: 'hidden' }, art: <span className="pb-bow" style={{ left: 0 }}><RainbowArt /></span> },
    { key: 'rainbow-right', x: 300, y: 62, w: 100, h: 100, p: bow, cast: 0.2, style: { overflow: 'hidden' }, art: <span className="pb-bow" style={{ left: -100 }}><RainbowArt /></span> },
  ];
  for (const cloud of CLOUDS) {
    const s = since(live, cloud.id), burst = still ? 0 : hopArc(s, 0.9);
    layers.push({ key: cloud.id, x: cloud.x, y: cloud.y, w: cloud.w, h: cloud.h, cast: 0.3, lean: still ? 0 : shake(s, 6, 10, 3) + Math.sin(t * 0.8 + cloud.x) * 1.6 * (1 - calm), art: <CloudArt art={KIT_CLOUDS[cloud.art]} w={cloud.w} h={cloud.h} lift={lift} rain={Math.min(1, rain + burst * 0.8)} calm={calm} squash={still ? 0 : hopArc(s, 0.3)} seed={cloud.art + cloud.x} fall={still ? 0.5 : t * 1.5} /> });
  }
  // Three rows of paper waves: they rock out of step, and lie down as the wheel is held steady.
  const waves: [string, number, number, number, number][] = [['w1', 172, 22, 0.35, 0], ['w2', 216, 22, 0.5, 2.1], ['w3', 258, 20, 0.7, 4.2]];
  for (const [key, y, h, shade, phase] of waves) for (const side of ['left', 'right'] as const) {
    layers.push({ key: `${key}-${side}`, x: side === 'left' ? PAGE_W / 2 : PAGE_W * 1.5, y, w: PAGE_W, h, p: 1 - 0.78 * calm, lean: rock(phase), cast: 0.5, style: { translate: `${sway(phase).toFixed(2)}px 0` }, art: <WaveArt uid={`${live.uid}-${key}-${side}`} shade={shade + 0.3 * calm} phase={phase / 6 + (side === 'right' ? 0 : 0)} /> });
  }
  layers.push(...meadowLayers(live, 2, boat.x, boat.y));
  layers.push(boatLayer(live, { key: 'boat', x: boat.x, y: boat.y, yaw: live.wheel2 * 0.3, roll: boat.roll, pitch: still ? 0 : Math.sin(t * 1.7 + 1) * 7 * (1 - 0.8 * calm), lift: boat.lift }));
  return layers;
}

/* ── spread 4: home to the quay as the lanterns come on across the water ──── */
/** The valley's own lights, on the hub slice: x across the spread, and how far below the slice's top. */
export const HUB_LIGHTS: readonly { x: number; top: number; r: number }[] = [{ x: 48, top: 32, r: 26 }, { x: 95, top: 55, r: 24 }, { x: 177, top: 36, r: 26 }, { x: 242, top: 98, r: 40 }, { x: 433, top: 130, r: 26 }];
/** The seven paper lanterns afloat on the basin, in the order they come on. Two layouts. */
const FLOATS: readonly (readonly (readonly [number, number])[])[] = [
  [[40, 240], [104, 216], [170, 246], [232, 220], [296, 248], [398, 222], [462, 244]],
  [[52, 220], [112, 246], [182, 218], [240, 248], [310, 224], [392, 246], [458, 220]],
];
export const floatSpots = (variant: number) => FLOATS[((Math.trunc(variant) % FLOATS.length) + FLOATS.length) % FLOATS.length];
const QUAY_CREW: readonly [CrewId, number, number][] = [['bebe', 300, 74], ['gobgob', 334, 56], ['aya', 366, 44], ['chock', 402, 54], ['pep', 440, 44]];
/** Where the harbour's boat lies: sailing in, then drawn up to the quay by its rope. */
export function harbourBoat(live: Live): { x: number; y: number; drawn: number } {
  const h = live.harbour, drawn = !h.docked ? 0 : live.dockAt === null || live.reduced ? 1 : Math.min(1, Math.max(0, (live.time - live.dockAt - 0.25) / 0.9));
  const ease = 1 - (1 - drawn) ** 3;
  return { x: h.x + 6 * ease, y: laneY(h.pos) + 4 - 16 * ease, drawn: ease };
}
function harbourLayers(live: Live): Layer[] {
  const harbour = live.harbour, t = live.time, still = live.reduced;
  const lit = harbour.lamps / HARBOUR_LAMPS, home = live.home >= 0 ? step(Math.min(1, live.home / 0.8), 8) : 0;
  const warmth = 0.6 * lit + 0.4 * home;
  const look = `saturate(${(0.74 + 0.34 * warmth).toFixed(2)}) brightness(${(0.6 + 0.3 * warmth).toFixed(2)})`;
  const valley = (i: number) => (live.home < 0 ? 0 : still ? 1 : Math.min(1, Math.max(0, (live.home - i * 0.14) / 0.3)));
  const glows: Record<string, ReactNode> = {
    'hub-left': <>{HUB_LIGHTS.map((lamp, i) => lamp.x < PAGE_W ? <Glow key={i} x={lamp.x} y={lamp.top} r={lamp.r} on={valley(i)} /> : null)}</>,
    'hub-right': <>{HUB_LIGHTS.map((lamp, i) => lamp.x >= PAGE_W ? <Glow key={i} x={lamp.x - PAGE_W} y={lamp.top} r={lamp.r} on={valley(i)} /> : null)}</>,
  };
  const layers: Layer[] = [...sliceLayers(3, live, look, glows)];
  QUAY_CREW.forEach(([who, x, h], i) => {
    const cheerAt = live.home >= 0 ? t - live.home + 0.2 + i * 0.16 : live.dockAt === null ? null : live.dockAt + 0.3 + i * 0.1;
    layers.push(...figure(live, who, who, x, 98, h, { cheerAt, lift: 24 }));
  });
  floatSpots(live.variant).forEach(([x, y], i) => {
    const id = `float-${i}`, on = harbour.lamps > i;
    const bob = still ? 0 : Math.sin(t * 1.6 + i * 1.3) * 3 + shake(since(live, id), 14, 9, 2.6);
    layers.push({ key: id, x, y, w: 24, h: 29, cast: 0.25, lean: bob, art: <><Glow x={12} y={15} r={22} on={on ? 0.95 : 0} /><LanternArt uid={`${live.uid}-${id}`} mode="afloat" lit={on ? 1 : 0} /></> });
  });
  const boat = harbourBoat(live);
  layers.push(...meadowLayers(live, 3, boat.x, boat.y));
  layers.push(boatLayer(live, { key: 'boat', x: boat.x, y: boat.y, yaw: harbour.docked ? 0 : boatYaw(harbour.pos, live.steer3), roll: still || harbour.docked ? 0 : Math.sin(t * 1.9) * 3, pitch: still || harbour.docked ? 0 : Math.sin(t * 2.3 + 1) * 2.4, lift: still || harbour.docked ? 0 : Math.sin(t * 2.4) * 0.9 }));
  return layers;
}

/* ── the page's own look, and what moves on the printed page ──────────────── */
function printLook(spread: SpreadIndex, live: Live): string | undefined {
  if (spread === 2) { const calm = step(live.calm, 16); return `saturate(${(0.5 + 0.5 * calm).toFixed(2)}) brightness(${(0.66 + 0.34 * calm).toFixed(2)})`; }
  if (spread === 3) { const warmth = 0.6 * (live.harbour.lamps / HARBOUR_LAMPS) + 0.4 * (live.home >= 0 ? step(Math.min(1, live.home / 0.8), 8) : 0); return `saturate(${(0.8 + 0.2 * warmth).toFixed(2)}) brightness(${(0.7 + 0.16 * warmth).toFixed(2)})`; }
  return undefined;
}
const pulse = (live: Live) => (live.reduced ? 1 : 1 + 0.08 * Math.sin(live.time * 3.4));
/** What a floating boat does to the water: a shadowed ring under it, and a wake that fans out behind. */
function Wake({ x, y, live, moving = 1 }: { x: number; y: number; live: Live; moving?: number }) {
  const t = live.reduced ? 0 : live.time, run = (t * 0.9) % 1;
  return <g>
    <ellipse cx={x + 3} cy={y + 2} rx={40} ry={9} style={{ fill: fade('shadow', 18) }} />
    <ellipse cx={x} cy={y + 1} rx={42} ry={8.5} style={{ fill: 'none', stroke: fade('white', 62), strokeWidth: 1.4 }} />
    {moving > 0.05 && [0, 1, 2].map(i => { const k = (run + i / 3) % 1, back = 26 + 44 * k, wide = 5 + 13 * k; return <g key={i} style={{ opacity: (1 - k) * 0.75 * moving }}>
      <path d={`M${x - back + 12} ${y - wide} q -8 ${wide * 0.2} -14 ${-wide * 0.1}`} style={{ fill: 'none', stroke: fade('white', 90), strokeWidth: 1.5, strokeLinecap: 'round' }} />
      <path d={`M${x - back + 12} ${y + wide + 2} q -8 ${-wide * 0.2} -14 ${wide * 0.1}`} style={{ fill: 'none', stroke: fade('white', 90), strokeWidth: 1.5, strokeLinecap: 'round' }} />
    </g>; })}
  </g>;
}
/** The cue for "here next": a ring that marks the place and never fills it. */
function Cue({ cx, cy, rx, ry, live }: { cx: number; cy: number; rx: number; ry: number; live: Live }) {
  const k = pulse(live);
  return <g>
    <ellipse cx={cx} cy={cy} rx={rx * k} ry={ry * k} style={{ fill: 'none', stroke: mk('white'), strokeWidth: 5, opacity: 0.85 }} />
    <ellipse cx={cx} cy={cy} rx={rx * k} ry={ry * k} style={{ fill: 'none', stroke: 'var(--studio-signal)', strokeWidth: 2.6 }} />
  </g>;
}
/** A lit lantern on the water: a broken column of warm dashes that shimmer. */
function Shine({ x, y, live, seed, on = 1 }: { x: number; y: number; live: Live; seed: number; on?: number }) {
  const t = live.reduced ? 0 : live.time;
  return <g style={{ opacity: on }}>{[0, 1, 2, 3, 4, 5].map(i => <ellipse key={i} cx={x + Math.sin(t * 2.6 + i * 1.7 + seed) * 1.6} cy={y + 5 + i * 5.6} rx={Math.max(1.6, 9 - i * 1.3 + Math.sin(t * 3.1 + i + seed) * 1.2)} ry={1.5} style={{ fill: i < 2 ? fade('sun', 82) : fade('amber', 64 - i * 8) }} />)}</g>;
}
function courseFlat(live: Live, river: RiverState, prefix: string): ReactNode {
  return riverItems(river).map(item => {
    const x = courseX(item.at), y = LANE_Y[item.lane] + 8, id = `${prefix}${item.id}`;
    if (item.kind === 'reedGate') return met(live, id) >= 0 ? <Shine key={id} x={x} y={y - 2} live={live} seed={item.at} /> : null;
    if (item.kind === 'rock') return <g key={id}>
      <ellipse cx={x + 4} cy={y + 4} rx={27} ry={7} style={{ fill: fade('shadow', 30) }} />
      <ellipse cx={x} cy={y + 2} rx={28} ry={6.5} style={{ fill: 'none', stroke: fade('white', 58), strokeWidth: 1.3 }} />
    </g>;
    const bump = live.reduced ? 0 : hopArc(since(live, id), 0.3), k = 1 + 0.1 * bump;
    return <g key={id} transform={`translate(${x} ${y})`}>
      <ellipse cx={3} cy={3.4} rx={19} ry={8} style={{ fill: fade('shadow', 30) }} />
      <path d="M0 0 L17.4 -3.2 A18 7.6 0 1 0 17.4 3.2 Z" transform={`scale(${k.toFixed(3)})`} style={{ fill: mix('leaf', 62, 'spring'), stroke: mix('spring', 70, 'white'), strokeWidth: 1.1 }} />
      <path d="M0 0 L-15 -2 M0 0 L-9 -5.6 M0 0 L-9 5.6 M0 0 L4 -6.6 M0 0 L4 6.6" style={{ fill: 'none', stroke: fade('white', 34), strokeWidth: 0.8 }} />
      <path d="M-14 3.2 A18 7.6 0 0 0 12 6.2" style={{ fill: 'none', stroke: fade('leaf-deep', 50), strokeWidth: 1.4, strokeLinecap: 'round' }} />
    </g>;
  });
}
function livePrint(spread: SpreadIndex, live: Live): ReactNode {
  const rings = live.ripples.map((ring, i) => {
    const s = live.time - ring.at, k = live.reduced ? 0.6 : s / 0.7;
    return s < 0 || s > 0.7 ? null : <g key={`r${i}`} style={{ opacity: 1 - k }}>
      <ellipse cx={ring.x} cy={ring.y} rx={6 + 24 * k} ry={(6 + 24 * k) * 0.42} style={{ fill: 'none', stroke: fade('white', 90), strokeWidth: 2.2 }} />
      <ellipse cx={ring.x} cy={ring.y} rx={3 + 13 * k} ry={(3 + 13 * k) * 0.42} style={{ fill: 'none', stroke: fade('white', 60), strokeWidth: 1.4 }} />
    </g>;
  });
  const top = WATER_TOPS[spread];
  const foam = <g>
    <path d={`M0 ${top + 1.5} H${SPREAD_W}`} style={{ fill: 'none', stroke: fade('white', 60), strokeWidth: 2.4, strokeDasharray: '14 5 7 9 22 6', strokeDashoffset: live.reduced ? 0 : live.time * 3 }} />
    {Array.from({ length: 21 }, (_, i) => { const x = 8 + i * 24.4 + (i % 3) * 3, h = 7 + (i % 4) * 2; return top < WATER_TOP ? null : <path key={i} d={`M${x} ${top} l -3 ${-h} M${x + 2} ${top} l 0 ${-h - 3} M${x + 4} ${top} l 3.4 ${-h + 1}`} style={{ fill: 'none', stroke: i % 2 ? mix('moss', 70, 'leaf-deep') : mix('leaf', 60, 'sage'), strokeWidth: 1.5, strokeLinecap: 'round' }} />; })}
  </g>;
  if (spread === 0 || spread === 1) {
    const river = spread === 0 ? live.stream : live.river, prefix = spread === 0 ? 's0-' : 's1-';
    const afloat = spread === 1 || live.launchedAt !== null, boat = riverBoat(river);
    const lanterns = riverLanterns(river), next = lanterns[river.gates];
    const wait = live.waiting ? lanterns.find(item => `${prefix}${item.id}` === live.waiting) : undefined;
    return <g>
      {foam}
      {courseFlat(live, river, prefix)}
      {spread === 0 && live.boat0.hint && <Cue cx={BOAT_STREAM.x} cy={BOAT_STREAM.y + 2} rx={44} ry={11} live={live} />}
      {spread === 1 && next && live.route && courseX(next.at) > boat.x + 30 && <path d={`M${boat.x + 34} ${boat.y} C ${boat.x + 70} ${boat.y} ${courseX(next.at) - 50} ${LANE_Y[next.lane] + 4} ${courseX(next.at) - 12} ${LANE_Y[next.lane] + 4}`} style={{ fill: 'none', stroke: 'var(--studio-signal)', strokeWidth: 3, strokeLinecap: 'round', strokeDasharray: '2 9', strokeDashoffset: live.reduced ? 0 : -live.time * 22 }} />}
      {wait && <Cue cx={courseX(wait.at)} cy={LANE_Y[wait.lane] + 4} rx={36} ry={10} live={live} />}
      {afloat ? <Wake x={boat.x} y={boat.y} live={live} moving={river.d >= 1239 ? 0.2 : 1} /> : live.boat0.afloat ? <Wake x={live.boat0.x} y={live.boat0.y} live={live} moving={0} /> : null}
      {rings}
    </g>;
  }
  if (spread === 2) { const boat = stormBoat(live); return <g>{foam}<Wake x={boat.x} y={boat.y} live={live} moving={0.5} />{rings}</g>; }
  const h = live.harbour, boat = harbourBoat(live), quayY = LANE_Y[0] + 6;
  return <g>
    {foam}
    {floatSpots(live.variant).map(([x, y], i) => h.lamps > i ? <Shine key={i} x={x} y={y} live={live} seed={i * 3} /> : <ellipse key={i} cx={x + 2} cy={y + 2} rx={12} ry={3.4} style={{ fill: fade('shadow', 26) }} />)}
    {live.home >= 0 && HUB_LIGHTS.map((lamp, i) => <Shine key={`v${i}`} x={lamp.x} y={top + 2} live={live} seed={i * 5 + 1} on={0.7 * Math.min(1, Math.max(0, (live.home - i * 0.14) / 0.3))} />)}
    <ellipse cx={QUAY_X} cy={quayY} rx={38} ry={10} style={{ fill: 'none', stroke: mk('white'), strokeWidth: 2, strokeDasharray: '5 5', opacity: h.docked ? 0 : 0.6 }} />
    {live.waitingQuay && <Cue cx={QUAY_X} cy={quayY} rx={42} ry={11} live={live} />}
    {h.docked && boat.drawn < 1 && <path d={`M${boat.x + 30} ${boat.y - 4} Q ${boat.x + 44} ${boat.y - 20} ${QUAY_X + 44} ${top + 2}`} style={{ fill: 'none', stroke: mk('linen'), strokeWidth: 1.8, strokeLinecap: 'round' }} />}
    <Wake x={boat.x} y={boat.y} live={live} moving={h.docked ? 0 : 1} />
    {rings}
  </g>;
}

/* ── what answers a tap on each spread ────────────────────────────────────── */
function courseToys(river: RiverState, prefix: string): Toy[] {
  const lanterns = riverLanterns(river);
  return riverItems(river).map((item): Toy => {
    const x = courseX(item.at), y = LANE_Y[item.lane], id = `${prefix}${item.id}`;
    if (item.kind === 'reedGate') return { id, kind: 'lantern', x, y: y - 12, z: 40, note: lanterns.indexOf(item) };
    return { id, kind: item.kind === 'rock' ? 'stone' : 'lily', x, y: y + 8, z: 6, note: item.at % 5 };
  });
}
const meadowToys = (): Toy[] => Array.from({ length: MEADOW_PIECES / 2 }, (_, i): Toy => ({ id: `meadow-${i * 2}`, kind: 'meadow', x: (i * 2 + 1) * MEADOW_W, y: BANK_Y + 3, z: 10, wobble: `meadow-${i * 2 + 1}`, note: i }));
export function toyTargets(spread: SpreadIndex, live: Live): Toy[] {
  const crew = (id: CrewId, x: number, y: number, z: number): Toy[] => [{ id, kind: id, x, y, z }];
  if (spread === 0) {
    const boat = live.launchedAt !== null ? riverBoat(live.stream) : null;
    return [
      { id: 'sky', kind: 'echo', x: 167, y: 30, z: 132, wobble: 'sky' },
      { id: 'dome', kind: 'dome', x: 458, y: 58, z: 166, wobble: 'hills' },
      { id: 'belltower', kind: 'bell', x: 331, y: 92, z: 112, wobble: 'village' },
      { id: 'fountain', kind: 'fountain', x: 346, y: 92, z: 30, wobble: 'village' },
      { id: 'bridge', kind: 'bridge', x: 193, y: 126, z: 34, wobble: 'bridge' },
      ...crew('aya', 58, WATER_TOP + 4, 24), ...meadowToys(),
      ...(boat ? [...courseToys(live.stream, 's0-'), { id: 'boat', kind: 'boat', x: boat.x, y: boat.y, z: 14 } as Toy] : []),
    ];
  }
  if (spread === 1) {
    const boat = riverBoat(live.river);
    return [
      { id: 'village', kind: 'bell', x: 85, y: 44, z: 112, wobble: 'valley' },
      { id: 'skybridge', kind: 'skybridge', x: 240, y: 72, z: 44, wobble: 'skybridge' },
      { id: 'glasshouse', kind: 'glasshouse', x: 446, y: 72, z: 124, wobble: 'skybridge' },
      ...crew('pep', 92, 102, 20), ...crew('bebe', 404, 106, 30), ...meadowToys(),
      ...courseToys(live.river, 's1-'),
      { id: 'boat', kind: 'boat', x: boat.x, y: boat.y, z: 14 },
    ];
  }
  if (spread === 2) {
    const boat = stormBoat(live);
    return [
      { id: 'mountain', kind: 'echo', x: 150, y: 26, z: 110, wobble: 'sky' },
      { id: 'hamlet', kind: 'bell', x: 320, y: 58, z: 76, wobble: 'hills' },
      ...CLOUDS.map((cloud, i): Toy => ({ id: cloud.id, kind: 'cloud', x: cloud.x, y: cloud.y, z: (cloud.h - 40) * (1 - 0.62 * live.calm) + 6, note: i })),
      ...crew('gobgob', 372, 110, 22), ...crew('chock', 416, 112, 26), ...meadowToys(),
      { id: 'lamp', kind: 'lamp', x: 466, y: 112, z: 22 },
      { id: 'boat', kind: 'boat', x: boat.x, y: boat.y, z: 14 },
    ];
  }
  const boat = harbourBoat(live);
  return [
    { id: 'treeLights', kind: 'lantern', x: 95, y: 62, z: 104, wobble: 'hub', note: 5 },
    { id: 'buggy', kind: 'buggy', x: 258, y: 62, z: 22, wobble: 'hub' },
    ...QUAY_CREW.flatMap(([who, x, h]) => crew(who, x, 98, 24 + h * 0.5)), ...meadowToys(),
    ...floatSpots(live.variant).map(([x, y], i): Toy => ({ id: `float-${i}`, kind: 'lantern', x, y, z: 12, note: i })),
    { id: 'boat', kind: 'boat', x: boat.x, y: boat.y, z: 14 },
  ];
}
