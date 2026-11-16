import { memo, type CSSProperties, type ReactNode } from 'react';
import {
  BOAT_STREAM, HARBOUR_LAMPS, LANE_Y, PAGE_D, PAGE_W, QUAY_X, RIVER_BOAT_X, SPREAD_W,
  boatYaw, edgeProgress, foldAngles, hopArc, peek, riverCourse, riverGates, riverItemX, settleRise, shake,
  type HarbourState, type Lane, type RiverState, type SpreadIndex,
} from './paperBoatRules';
import { BoatArt, fade, mk } from './PaperBoatArt';
import { KIT_CLOUDS, KIT_CREW, KIT_GATE, KIT_PAGES, KIT_PROPS, KIT_SCOUT_VIEW, KIT_SLICES, KIT_WAVE, type CrewId, type KitArt } from './paperBoatKit';

/** The four spreads of the pop-up book. A spread is one kit picture: its
 * ground (or the water that mirrors it) is printed across both pages, and the
 * picture itself stands up in slices, far to near, each hinged on its page.
 * The crew, the gates, the clouds and the boat are stand-up cards among them.
 * A card's angle comes only from the spread's fold progress, through
 * `foldAngles`; when its page lands it rises the last of the way a beat later
 * (`settleRise`). Hebrew mirrors the whole book (the parent does it), so
 * nothing here knows the reading direction. Nothing inside the book animates
 * in CSS: every motion is computed from the game's clock. */

export type Side = 'left' | 'right';
/** Everything that moves. Read by the spreads; owned by the game. */
export interface Live {
  time: number;
  reduced: boolean;
  mirror: boolean;
  uid: string;
  /** Things that were poked: id → when, and id → how many times. */
  pokes: Readonly<Record<string, number>>;
  taps: Readonly<Record<string, number>>;
  /** Taps on the bare page. */
  ripples: readonly { x: number; y: number; at: number }[];
  boat0: { x: number; y: number; afloat: boolean; hint: boolean };
  launchedAt: number | null;
  river: RiverState;
  steer1: Lane;
  /** Gates the boat has gone through (id → when). */
  arches: Readonly<Record<string, number>>;
  /** The gate the river is waiting at, if any. */
  waiting: string | null;
  /** The RouteScope's dotted line to the next gate is showing. */
  route: boolean;
  calm: number;
  calmAt: number | null;
  wheel2: number;
  harbour: HarbourState;
  steer3: Lane;
  rope: number;
  waitingQuay: boolean;
  dockAt: number | null;
  /** Seconds into the homecoming (-1 before it). */
  home: number;
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
  art: ReactNode;
  /** A button or anything that must sit in the card's plane. */
  extra?: ReactNode;
}
/** Something on a spread that answers a tap. Its spot is on the page at
 * (x, y), `z` up off it. `kind` picks its name and its sound. */
export interface Toy { id: string; kind: ToyKind; x: number; y: number; z: number; wobble?: string; note?: number }
export type ToyKind = 'aya' | 'pep' | 'chock' | 'bebe' | 'gobgob' | 'dome' | 'bell' | 'fountain' | 'bridge' | 'cascade' | 'echo' | 'boat'
  | 'knitArch' | 'stone' | 'lily' | 'skybridge' | 'glasshouse' | 'lamp' | 'cloud' | 'lantern' | 'buggy' | 'moored';

const laneY = (pos: number) => LANE_Y[0] + (LANE_Y[2] - LANE_Y[0]) * (pos / 2);
const since = (live: Live, id: string) => live.time - (live.pokes[id] ?? -99);
const url = (art: KitArt) => `url(${art.src})`;

/* ── the card machinery ───────────────────────────────────────────────────── */
function Card({ layer, progress, offset, mirror, rise }: { layer: Layer; progress: number; offset: number; mirror: boolean; rise: { p: number; lean: number } | null }) {
  const p = Math.min(progress * (rise ? rise.p : 1), layer.p ?? 1);
  const fold = foldAngles(p);
  const angle = fold.stand + ((layer.lean ?? 0) + (rise ? rise.lean : 0)) * p;
  const left = layer.x - layer.w / 2;
  const up = Math.sin((Math.max(0, angle) * Math.PI) / 180);
  const reach = Math.min(46, layer.h * 0.34) * up * (layer.cast ?? 1);
  return <>
    {(layer.cast ?? 1) > 0 && up > 0.02 && <span className="pb-cast" style={{ left: left - offset + layer.w * 0.03, top: layer.y - reach, width: layer.w * 0.94, height: reach + 2, opacity: 0.5 * fold.shadow, transform: `translateZ(.4px) skewX(${mirror ? 20 : -20}deg)` }} />}
    {(layer.cast ?? 1) > 0 && up > 0.02 && <span className="pb-foot" style={{ left: left - offset, top: layer.y - 1, width: layer.w, opacity: 0.6 * fold.shadow * (layer.cast ?? 1) }} />}
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
  return <div className="pb-half" data-spread={spread} data-side={side}>
    <div className="pb-print" aria-hidden="true">
      <PrintArt src={KIT_PAGES[spread].src} side={side} look={printLook(spread, live)} />
      <svg className="pb-print__live" viewBox={`${offset} 0 ${PAGE_W} ${PAGE_D}`} width={PAGE_W} height={PAGE_D} aria-hidden="true" focusable="false">{livePrint(spread, live)}</svg>
      <span className="pb-gutter" />
      <span className="pb-grain" />
    </div>
    {mine.map((layer, index) => <Card key={layer.key} layer={layer} progress={progress} offset={offset} mirror={live.mirror} rise={settle >= 0 && !live.reduced ? settleRise(settle, index) : null} />)}
  </div>;
}

const half = (side: Side) => (side === 'left' ? '0 0' : '100% 0');
const PrintArt = memo(function PrintArt({ src, side, look }: { src: string; side: Side; look?: string }) {
  return <span className="pb-print__art" style={{ backgroundImage: `url(${src})`, backgroundPosition: half(side), filter: look }} />;
});
const SliceArt = memo(function SliceArt({ src, side, look }: { src: string; side: Side; look?: string }) {
  return <span className="pb-slice" style={{ backgroundImage: `url(${src})`, backgroundPosition: half(side), filter: look }} />;
});
/** A spread's standing slices, both halves of each. A poked slice wobbles. */
function sliceLayers(spread: SpreadIndex, live: Live, look?: string, extras?: Readonly<Record<string, ReactNode>>): Layer[] {
  return KIT_SLICES[spread].flatMap(item => (['left', 'right'] as const).map((side): Layer => ({
    key: `${item.id}-${side}`, x: side === 'left' ? PAGE_W / 2 : PAGE_W * 1.5, y: item.y, w: PAGE_W, h: item.h, cast: 0.5,
    lean: live.reduced ? 0 : shake(since(live, item.id), 5, 12, 3.2),
    art: <SliceArt src={item.art.src} side={side} look={look} />, extra: extras?.[`${item.id}-${side}`],
  })));
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
/** A crew member standing on the page. `cheerAt`: a clock time they start two glad hops at.
 * `look`: side on, looking that way across the page (the stored view is flipped if it must be). */
function figure(live: Live, id: string, who: CrewId, x: number, y: number, h: number, options: { cheerAt?: number | null; lift?: number; look?: 'left' | 'right' } = {}): Layer[] {
  const art = KIT_CREW[who];
  const s = since(live, id), cheer = options.cheerAt == null ? -1 : live.time - options.cheerAt;
  const a = hopOf(s), b = hopOf(cheer), c = hopOf(cheer - 0.56, 0.4);
  const hops = [a, b, c], still = { hop: 0, stretch: 1 };
  const best = live.reduced ? still : hops.find(item => item.hop > 0) ?? hops.find(item => item.stretch !== 1) ?? still;
  const pic = options.look ? art.side : art.front, lift = options.lift ?? 0;
  return [{ key: id, x, y, w: Math.max(30, (h * pic.w) / pic.h), h: h + lift, cast: lift ? 0 : 0.5, className: 'pb-figure-card', lean: live.reduced ? 0 : shake(s, 3, 14, 4), art: <FigureArt src={pic.src} h={h} hop={best.hop * h * 0.22} stretch={best.stretch} lift={lift} flip={!!options.look && options.look !== art.faces} /> }];
}
/** A shipped prop standing on the page. */
function prop(key: string, art: KitArt, x: number, y: number, h: number, extra: Partial<Layer> = {}): Layer {
  return { key, x, y, w: (h * art.w) / art.h, h, cast: 0.45, className: 'pb-figure-card', art: <FigureArt src={art.src} h={h} hop={0} stretch={1} lift={0} />, ...extra };
}

/* ── the boat card, shared by every spread ────────────────────────────────── */
function boatLayer(live: Live, { key, x, y, yaw = 0, roll = 0, bob = 0, w = 84, h = 64, stripe, size = 76 }: { key: string; x: number; y: number; yaw?: number; roll?: number; bob?: number; w?: number; h?: number; stripe?: string; size?: number }): Layer {
  const jump = live.reduced ? { hop: 0, stretch: 1 } : hopOf(since(live, key), 0.42);
  return {
    key, x, y, w, h, yaw, cast: 0, className: 'pb-boat-card',
    art: <span className="pb-boat" style={{ transform: `translateY(${(bob - jump.hop * 13).toFixed(2)}px) rotate(${roll.toFixed(2)}deg) scale(${(2 - jump.stretch).toFixed(3)}, ${jump.stretch.toFixed(3)})` }}>
      <svg viewBox="0 0 80 60" style={{ inlineSize: size, blockSize: size * 0.75 }} aria-hidden="true" focusable="false"><BoatArt uid={`${live.uid}-${key}`} stripe={stripe} /></svg>
    </span>,
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

/* ── spread 1: a stream in the Sky Gardens ────────────────────────────────── */
function streamLayers(live: Live): Layer[] {
  const t = live.time, still = live.reduced;
  const bob = still || !live.boat0.afloat ? 0 : Math.sin(t * 2.3) * 1.6;
  return [
    ...sliceLayers(0, live, undefined, {
      'hills-right': <Sparkle x={208} y={14} s={since(live, 'dome')} />,
      'village-right': <Jets x={96} y={106} s={since(live, 'fountain')} />,
    }),
    ...figure(live, 'aya', 'aya', 40, 244, 58, { cheerAt: live.launchedAt, look: 'right' }),
    boatLayer(live, { key: 'boat', x: live.boat0.x, y: live.boat0.y, bob, w: 124, h: 100, size: 96 }),
  ];
}

/* ── spread 2: the river through Glass Grove, under the skybridge ─────────── */
const GateArt = memo(function GateArt({ lit }: { lit: boolean }) {
  return <img className="pb-gate" data-lit={lit} src={KIT_GATE.src} alt="" draggable={false} decoding="async" />;
});
function riverLayers(live: Live): Layer[] {
  const river = live.river, still = live.reduced;
  const pepPoke = since(live, 'pep');
  const layers: Layer[] = [
    ...sliceLayers(1, live, undefined, { 'skybridge-right': <Sparkle x={196} y={62} s={since(live, 'glasshouse')} /> }),
    ...figure(live, 'pep', 'pep', 92, 84, 44, { look: 'right', cheerAt: river.gates > 0 ? live.arches[riverGates(river.course)[river.gates - 1].id] : null }),
    ...figure(live, 'bebe', 'bebe', 398, 84, 74, { look: 'left', cheerAt: river.gates >= 3 ? live.arches['gate-3'] : null }),
    // What Pep's ScoutCam sees from under the skybridge pops up on a paper arm.
    { key: 'scoutView', x: 138, y: 80, w: 70, h: 118, p: still ? (pepPoke >= 0 && pepPoke < 2.6 ? 1 : 0) : peek(pepPoke, 2.2), cast: 0.3, art: <span className="pb-view"><i /><img src={KIT_SCOUT_VIEW.src} alt="" draggable={false} decoding="async" /></span> },
  ];
  for (const item of riverCourse(river.course)) {
    const x = riverItemX(item, river.d);
    if (x < -40 || x > SPREAD_W + 40) continue;
    const p = edgeProgress(x), y = LANE_Y[item.lane];
    if (p <= 0) continue;
    if (item.kind === 'reedGate') {
      const passedAt = live.arches[item.id], through = passedAt === undefined ? -1 : live.time - passedAt;
      const sway = still ? 0 : shake(through, 9, 9, 2.4) + shake(since(live, item.id), 7, 11, 3);
      layers.push({ key: item.id, x, y: y - 6, w: 104, h: 62, p, lean: sway, cast: 0.5, art: <GateArt lit={passedAt !== undefined || live.waiting === item.id} />, extra: <Sparkle x={52} y={6} s={through} /> });
    } else if (item.kind === 'pad') {
      const open = (live.taps[item.id] ?? 0) % 2 === 1, bloom = open ? KIT_PROPS.bloomOpen : KIT_PROPS.bloomFolded, h = open ? 26 : 17;
      const pop = still ? 0 : hopArc(since(live, item.id), 0.36);
      layers.push(prop(item.id, bloom, x + 2, y + 10, h * (1 + 0.16 * pop), { p, cast: 0.2 }));
    }
  }
  const steering = river.bumpLane !== null && river.d < river.bumpUntil ? river.bumpLane : live.steer1;
  const bob = still ? 0 : Math.sin(live.time * 2.6) * 1.4;
  // After a stone's nudge the boat spins softly once, by how far the river has run since.
  const after = river.bumpLane !== null ? (river.d - (river.bumpUntil - 60)) / 60 : 1;
  const spin = after >= 0 && after < 1 && !still ? Math.sin(after * Math.PI * 2) * 16 * (1 - after) : 0;
  layers.push(boatLayer(live, { key: 'boat', x: RIVER_BOAT_X, y: laneY(river.pos) + 6, yaw: boatYaw(river.pos, steering) + spin * 1.4, roll: spin, bob, w: 90, h: 68, size: 86 }));
  return layers;
}

/* ── spread 3: a gentle storm over Reflection Basin ───────────────────────── */
const CLOUDS = [
  { id: 'cloud-1', x: 84, y: 78, w: 118, h: 150, art: 0 },
  { id: 'cloud-2', x: 236, y: 66, w: 132, h: 172, art: 1 },
  { id: 'cloud-3', x: 384, y: 80, w: 110, h: 142, art: 0 },
] as const;
function CloudArt({ art, w, h, lift, rain, calm, squash, seed }: { art: KitArt; w: number; h: number; lift: number; rain: number; calm: number; squash: number; seed: number }) {
  const body = (w * art.h) / art.w, top = (1 - lift) * (h - body - 8);
  const strips = Math.round(9 * rain);
  return <span className="pb-cloud">
    <i className="pb-cloud__stalk" style={{ top: top + body * 0.6 }} />
    {Array.from({ length: strips }, (_, i) => <i key={i} className="pb-cloud__rain" style={{ left: 8 + ((i * 41 + seed * 17) % Math.max(1, w - 24)), top: top + body * 0.72 + (i % 3) * 7, height: 20 + (i % 2) * 12, opacity: 0.25 + 0.6 * rain }} />)}
    <img src={art.src} alt="" draggable={false} decoding="async" style={{ top, transform: `scale(${(1 + squash * 0.1).toFixed(3)}, ${(1 - squash * 0.14).toFixed(3)})`, filter: `brightness(${(0.56 + 0.44 * calm).toFixed(2)})` }} />
  </span>;
}
const WaveArt = memo(function WaveArt({ side, shade }: { side: Side; shade: number }) {
  return <span className="pb-slice" style={{ backgroundImage: url(KIT_WAVE), backgroundPosition: half(side), filter: `brightness(${shade})` }} />;
});
function stormLayers(live: Live): Layer[] {
  const calm = live.calm, t = live.time, still = live.reduced;
  const rock = (phase: number) => (still ? 0 : Math.sin(t * 1.7 + phase) * 9 * (1 - 0.85 * calm));
  const sway = (phase: number) => (still ? 0 : Math.sin(t * 1.7 + phase + 0.6) * 2.5 * (1 - 0.8 * calm));
  const lift = 1 - 0.62 * calm, rain = Math.max(0, 1 - calm * 1.15);
  const flash = still ? 0 : hopArc(since(live, 'lamp'), 1.1);
  const sweep = still ? -4 : Math.sin(t * 0.7) * 10 - 4 + flash * 8;
  const look = `saturate(${(0.5 + 0.5 * calm).toFixed(2)}) brightness(${(0.78 + 0.22 * calm).toFixed(2)})`;
  const cheerAt = live.calmAt;
  const layers: Layer[] = [
    ...sliceLayers(2, live, look, { 'shore-right': <Sparkle x={152} y={16} s={since(live, 'glasshouse')} /> }),
    { key: 'beam', x: 458 - 207, y: 84, w: 440, h: 150, cast: 0, className: 'pb-beam', art: <span className="pb-beam__ray" style={{ opacity: 0.8 - 0.4 * calm + flash * 0.4, transform: `rotate(${sweep.toFixed(2)}deg)` }} /> },
    ...figure(live, 'gobgob', 'gobgob', 376, 86, 56, { cheerAt }),
    ...figure(live, 'chock', 'chock', 418, 87, 54, { cheerAt }),
    prop('lamp', KIT_PROPS.lamp, 466, 88, 50, { lean: still ? 0 : shake(since(live, 'lamp'), 7, 13, 3.4) }),
  ];
  for (const cloud of CLOUDS) {
    const s = since(live, cloud.id), burst = still ? 0 : hopArc(s, 0.9);
    layers.push({ key: cloud.id, x: cloud.x, y: cloud.y, w: cloud.w, h: cloud.h, cast: 0.3, lean: still ? 0 : shake(s, 6, 10, 3), art: <CloudArt art={KIT_CLOUDS[cloud.art]} w={cloud.w} h={cloud.h} lift={lift} rain={Math.min(1, rain + burst * 0.8)} calm={calm} squash={still ? 0 : hopArc(s, 0.3)} seed={cloud.art + cloud.x} /> });
  }
  const waves: [string, number, number, number, number][] = [['w1', 150, 44, 0.78, 0], ['w2', 206, 40, 0.9, 2.1], ['w3', 280, 34, 1.04, 4.2]];
  for (const [key, y, h, shade, phase] of waves) for (const side of ['left', 'right'] as const) {
    layers.push({ key: `${key}-${side}`, x: side === 'left' ? PAGE_W / 2 : PAGE_W * 1.5, y, w: PAGE_W, h, lean: rock(phase), cast: 0.4, style: { translate: `${sway(phase).toFixed(2)}px 0` }, art: <WaveArt side={side} shade={shade + 0.16 * calm} /> });
  }
  const roll = still ? 0 : Math.sin(t * 1.9) * 13 * (1 - 0.8 * calm), bob = still ? 0 : Math.sin(t * 1.7 + 3) * 4 * (1 - 0.6 * calm);
  layers.push(boatLayer(live, { key: 'boat', x: 196, y: 236, yaw: (live.mirror ? 1 : -1) * live.wheel2 * 0.4, roll, bob: bob - 8, w: 90, h: 68, size: 86 }));
  return layers;
}

/* ── spread 4: home to the quay as the valley lights come on ──────────────── */
/** The five lights, on the hub slice: x across the spread, and how far below the slice's top. */
export const LAMPS: readonly { x: number; top: number; r: number }[] = [{ x: 48, top: 32, r: 26 }, { x: 95, top: 55, r: 24 }, { x: 177, top: 36, r: 26 }, { x: 242, top: 98, r: 40 }, { x: 433, top: 130, r: 26 }];
export const LAMP_X = LAMPS.map(lamp => lamp.x);
const QUAY_CREW: readonly [CrewId, number, number][] = [['bebe', 300, 74], ['gobgob', 334, 56], ['aya', 366, 44], ['chock', 402, 54], ['pep', 440, 44]];
function harbourLayers(live: Live): Layer[] {
  const harbour = live.harbour, t = live.time, still = live.reduced;
  const lit = harbour.lamps / HARBOUR_LAMPS, home = live.home >= 0 ? Math.min(1, live.home / 0.8) : 0;
  const warmth = 0.55 * lit + 0.45 * home;
  const look = `saturate(${(0.62 + 0.38 * warmth).toFixed(2)}) brightness(${(0.66 + 0.34 * warmth).toFixed(2)})`;
  const rock = (phase: number) => (still ? 0 : Math.sin(t * 1.4 + phase) * 4);
  const glows: Record<string, ReactNode> = {
    'hub-left': <>{LAMPS.filter(lamp => lamp.x < PAGE_W).map((lamp, i) => <Glow key={i} x={lamp.x} y={lamp.top} r={lamp.r} on={harbour.lamps > LAMPS.indexOf(lamp) ? 1 : 0} />)}</>,
    'hub-right': <>{LAMPS.filter(lamp => lamp.x >= PAGE_W).map((lamp, i) => <Glow key={i} x={lamp.x - PAGE_W} y={lamp.top} r={lamp.r} on={harbour.lamps > LAMPS.indexOf(lamp) ? 1 : 0} />)}</>,
  };
  const layers: Layer[] = [...sliceLayers(3, live, look, glows)];
  QUAY_CREW.forEach(([who, x, h], i) => {
    const cheerAt = live.home >= 0 ? t - live.home + 0.2 + i * 0.16 : live.dockAt === null ? null : live.dockAt + 0.3 + i * 0.1;
    layers.push(...figure(live, who, who, x, 98, h, { cheerAt, lift: 24 }));
  });
  for (const [key, x, y, stripe, phase] of [['moored-1', 104, 232, 'rose', 0], ['moored-2', 446, 250, 'amber', 1.7]] as const) {
    layers.push({ ...boatLayer(live, { key, x, y, roll: rock(phase) + (still ? 0 : shake(since(live, key), 12, 9, 2.6)), stripe, w: 60, h: 46, size: 52 }), lean: rock(phase) });
  }
  const bob = still || harbour.docked ? 0 : Math.sin(t * 2.4) * 1.4;
  layers.push(boatLayer(live, { key: 'boat', x: harbour.x, y: laneY(harbour.pos) + 6, yaw: harbour.docked ? 0 : boatYaw(harbour.pos, live.steer3), bob, w: 90, h: 68, size: 86 }));
  return layers;
}

/* ── the page's own look, and what moves on the printed page ──────────────── */
function printLook(spread: SpreadIndex, live: Live): string | undefined {
  if (spread === 2) return `saturate(${(0.5 + 0.5 * live.calm).toFixed(2)}) brightness(${(0.72 + 0.28 * live.calm).toFixed(2)})`;
  if (spread === 3) { const warmth = 0.55 * (live.harbour.lamps / HARBOUR_LAMPS) + 0.45 * (live.home >= 0 ? Math.min(1, live.home / 0.8) : 0); return `saturate(${(0.7 + 0.3 * warmth).toFixed(2)}) brightness(${(0.7 + 0.3 * warmth).toFixed(2)})`; }
  return undefined;
}
const pulse = (live: Live) => (live.reduced ? 1 : 1 + 0.08 * Math.sin(live.time * 3.4));
/** The ring a floating boat makes. */
function Wake({ cx, cy, rx, ry, opacity = 0.7 }: { cx: number; cy: number; rx: number; ry: number; opacity?: number }) {
  return <g style={{ opacity }}>
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} style={{ fill: fade('shadow', 16), stroke: fade('white', 70), strokeWidth: 1.6 }} />
    <ellipse cx={cx} cy={cy} rx={rx * 0.62} ry={ry * 0.6} style={{ fill: 'none', stroke: fade('white', 45), strokeWidth: 1.2 }} />
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
function livePrint(spread: SpreadIndex, live: Live): ReactNode {
  const rings = live.ripples.map((ring, i) => {
    const s = live.time - ring.at, k = live.reduced ? 0.6 : s / 0.7;
    return s < 0 || s > 0.7 ? null : <g key={`r${i}`} style={{ opacity: 1 - k }}>
      <ellipse cx={ring.x} cy={ring.y} rx={6 + 24 * k} ry={(6 + 24 * k) * 0.42} style={{ fill: 'none', stroke: fade('white', 90), strokeWidth: 2.2 }} />
      <ellipse cx={ring.x} cy={ring.y} rx={3 + 13 * k} ry={(3 + 13 * k) * 0.42} style={{ fill: 'none', stroke: fade('white', 60), strokeWidth: 1.4 }} />
    </g>;
  });
  if (spread === 0) {
    const { x, y, afloat, hint } = live.boat0, splash = hopArc(since(live, 'cascade'), 0.8);
    return <g>
      {afloat && <Wake cx={x} cy={y + 2} rx={44} ry={9} opacity={0.85} />}
      {hint && <Cue cx={BOAT_STREAM.x} cy={BOAT_STREAM.y + 2} rx={44} ry={11} live={live} />}
      {splash > 0 && [-16, -6, 5, 15].map((dx, i) => <circle key={dx} cx={203 + dx} cy={174 - (10 + (i % 2) * 8) * splash} r={2.2} style={{ fill: fade('white', 90) }} />)}
      {rings}
    </g>;
  }
  if (spread === 1) {
    const river = live.river, d = river.d, marks: ReactNode[] = [];
    for (let i = 0; i < 9; i++) for (let lane = 0; lane < 3; lane++) {
      const x = (((i * 64 + lane * 23 - d * 0.9) % 576) + 576) % 576 - 40;
      marks.push(<path key={`${i}-${lane}`} d={`M${x} ${LANE_Y[lane] + 14 + (i % 2) * 5} q 9 -4 18 0`} style={{ fill: 'none', stroke: fade('white', 46), strokeWidth: 2, strokeLinecap: 'round' }} />);
    }
    const flat = riverCourse(river.course).map(item => {
      if (item.kind === 'reedGate') return null;
      const x = riverItemX(item, d), y = LANE_Y[item.lane] + 6;
      if (x < -40 || x > SPREAD_W + 40) return null;
      const art = item.kind === 'rock' ? KIT_PROPS.stone : KIT_PROPS.lily, w = item.kind === 'rock' ? 50 : 38, h = (w * art.h) / art.w;
      const bump = live.reduced ? 0 : hopArc(since(live, item.id), 0.3);
      return <g key={item.id}>
        <ellipse cx={x + 2} cy={y + 5} rx={w * 0.5} ry={h * 0.3} style={{ fill: fade('shadow', 26) }} />
        <image href={art.src} x={x - w / 2} y={y - h * (0.62 - 0.1 * bump)} width={w} height={h * (1 - 0.16 * bump)} preserveAspectRatio="none" />
      </g>;
    });
    const gates = riverGates(river.course), next = gates[river.gates];
    const wait = live.waiting ? gates.find(item => item.id === live.waiting) : undefined;
    const boatY = laneY(river.pos) + 8;
    return <g>
      {marks}{flat}
      {next && live.route && riverItemX(next, d) > RIVER_BOAT_X + 30 && <path d={`M${RIVER_BOAT_X + 34} ${boatY} C ${RIVER_BOAT_X + 90} ${boatY} ${riverItemX(next, d) - 80} ${LANE_Y[next.lane] + 8} ${riverItemX(next, d) - 20} ${LANE_Y[next.lane] + 8}`} style={{ fill: 'none', stroke: 'var(--studio-signal)', strokeWidth: 3, strokeLinecap: 'round', strokeDasharray: '2 9', strokeDashoffset: live.reduced ? 0 : -live.time * 22 }} />}
      {wait && <Cue cx={riverItemX(wait, d)} cy={LANE_Y[wait.lane] + 6} rx={40} ry={11} live={live} />}
      <Wake cx={RIVER_BOAT_X} cy={boatY} rx={40} ry={8} opacity={0.8} />
      {rings}
    </g>;
  }
  if (spread === 2) return <g><Wake cx={196} cy={246} rx={44} ry={9} opacity={0.6} />{rings}</g>;
  const h = live.harbour, lamps = h.lamps;
  return <g>
    <g style={{ filter: 'blur(2.6px)' }}>{LAMP_X.map((x, i) => lamps > i ? <rect key={i} x={x - 5} y={108} width="10" height={84 - i * 5} rx="5" style={{ fill: fade('sun', 46) }} /> : null)}</g>
    <ellipse cx={QUAY_X} cy={LANE_Y[0] + 8} rx={38} ry={10} style={{ fill: 'none', stroke: mk('sea'), strokeWidth: 2.4, opacity: h.docked ? 0.9 : 0.5 }} />
    {live.waitingQuay && <Cue cx={QUAY_X} cy={LANE_Y[0] + 8} rx={42} ry={11} live={live} />}
    <Wake cx={h.x} cy={laneY(h.pos) + 8} rx={40} ry={8} opacity={0.7} />
    {rings}
  </g>;
}

/* ── what answers a tap on each spread ────────────────────────────────────── */
export function toyTargets(spread: SpreadIndex, live: Live): Toy[] {
  const crew = (id: CrewId, x: number, y: number, z: number): Toy[] => [{ id, kind: id, x, y, z }];
  if (spread === 0) return [
    { id: 'sky', kind: 'echo', x: 167, y: 30, z: 132, wobble: 'sky' },
    { id: 'dome', kind: 'dome', x: 458, y: 58, z: 166, wobble: 'hills' },
    { id: 'belltower', kind: 'bell', x: 331, y: 92, z: 112, wobble: 'village' },
    { id: 'fountain', kind: 'fountain', x: 346, y: 92, z: 30, wobble: 'village' },
    { id: 'bridge', kind: 'bridge', x: 193, y: 126, z: 34, wobble: 'bridge' },
    { id: 'cascade', kind: 'cascade', x: 203, y: 176, z: 0 },
    ...crew('aya', 40, 244, 28),
    ...(live.launchedAt !== null ? [{ id: 'boat', kind: 'boat', x: BOAT_STREAM.x, y: BOAT_STREAM.y, z: 22 } as Toy] : []),
  ];
  if (spread === 1) {
    const river = live.river, gates = riverGates(river.course), toys: Toy[] = [
      { id: 'village', kind: 'bell', x: 85, y: 44, z: 112, wobble: 'valley' },
      { id: 'skybridge', kind: 'skybridge', x: 240, y: 72, z: 44, wobble: 'skybridge' },
      { id: 'glasshouse', kind: 'glasshouse', x: 446, y: 72, z: 124, wobble: 'skybridge' },
      ...crew('pep', 92, 84, 20), ...crew('bebe', 398, 84, 30),
    ];
    for (const item of riverCourse(river.course)) {
      const x = riverItemX(item, river.d);
      if (x < 16 || x > SPREAD_W - 16) continue;
      const y = LANE_Y[item.lane];
      if (item.kind === 'reedGate') toys.push({ id: item.id, kind: 'knitArch', x, y: y - 6, z: 44, note: gates.indexOf(item) });
      else toys.push({ id: item.id, kind: item.kind === 'rock' ? 'stone' : 'lily', x, y: y + 8, z: 6, note: item.at % 5 });
    }
    toys.push({ id: 'boat', kind: 'boat', x: RIVER_BOAT_X, y: laneY(river.pos) + 6, z: 22 });
    return toys;
  }
  if (spread === 2) return [
    { id: 'mountain', kind: 'echo', x: 251, y: 28, z: 40, wobble: 'lake' },
    { id: 'glasshouse', kind: 'glasshouse', x: 402, y: 60, z: 100, wobble: 'shore' },
    ...CLOUDS.map((cloud, i): Toy => ({ id: cloud.id, kind: 'cloud', x: cloud.x, y: cloud.y, z: (cloud.h - 40) * (1 - 0.62 * live.calm) + 6, note: i })),
    ...crew('gobgob', 382, 86, 22), ...crew('chock', 420, 87, 28),
    { id: 'lamp', kind: 'lamp', x: 464, y: 88, z: 24 },
    { id: 'boat', kind: 'boat', x: 196, y: 236, z: 22 },
  ];
  return [
    { id: 'lantern', kind: 'lantern', x: 95, y: 62, z: 104, wobble: 'hub' },
    { id: 'buggy', kind: 'buggy', x: 258, y: 62, z: 22, wobble: 'hub' },
    ...QUAY_CREW.flatMap(([who, x, h]) => crew(who, x, 98, 24 + h * 0.5)),
    { id: 'moored-1', kind: 'moored', x: 104, y: 232, z: 16, note: 0 },
    { id: 'moored-2', kind: 'moored', x: 446, y: 250, z: 16, note: 2 },
    { id: 'boat', kind: 'boat', x: live.harbour.x, y: laneY(live.harbour.pos) + 6, z: 22 },
  ];
}
