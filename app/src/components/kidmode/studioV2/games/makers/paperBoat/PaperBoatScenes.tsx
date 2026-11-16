import { memo, type CSSProperties, type ReactNode } from 'react';
import {
  HARBOUR_LAMPS, LANE_Y, PAGE_D, PAGE_W, QUAY_X, RIVER_BOAT_X, RIVER_COURSE, SPREAD_W,
  boatYaw, edgeProgress, foldAngles, riverItemX, type HarbourState, type Lane, type RiverState, type SpreadIndex,
} from './paperBoatRules';
import { BoatArt, Cut, Lobes, Reeds, Ripple, fade, mix, mk } from './PaperBoatArt';

/** The four spreads of the pop-up book. Each spread is drawn once across both
 * pages (500 × 290, book-local px) and cut at the spine: the printed page art
 * is one SVG per half (its viewBox picks the half), and every pop-up layer is
 * a card hinged on the half its anchor falls in. A card's angle comes only from
 * the spread's fold progress, through `foldAngles`; its cast shadow on the page
 * grows with that angle. Hebrew mirrors the whole book (the parent does it), so
 * nothing here knows the reading direction except where a shadow must keep
 * falling away from the top-left light. */

export type Side = 'left' | 'right';
export interface BoatControl {
  label: string;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}
/** Everything that moves. Read by the spreads; owned by the game. */
export interface Live {
  time: number;
  reduced: boolean;
  mirror: boolean;
  boat0: { x: number; y: number; afloat: boolean; hint: boolean };
  boatControl: BoatControl | null;
  river: RiverState;
  steer1: Lane;
  /** Reed arches the boat has gone through (id → the time it went through). */
  arches: Readonly<Record<string, number>>;
  /** The arch the river is waiting at (the boat should line up with it), if any. */
  waiting: string | null;
  calm: number;
  wheel2: number;
  harbour: HarbourState;
  steer3: Lane;
  /** The mooring rope dropping over the bollard, 0 … 1. */
  rope: number;
  waitingQuay: boolean;
}
interface Layer {
  key: string;
  /** Spread x of the card's centre (or the spine, for a V-fold wing). */
  x: number;
  /** Page depth of the hinge line. */
  y: number;
  w: number;
  h: number;
  kind?: 'stand' | 'vfold-l' | 'vfold-r';
  /** A card's own progress when it is less than the spread's (rising in at the page edge). */
  p?: number;
  /** Extra lean on top of the fold angle (waves rock). */
  lean?: number;
  yaw?: number;
  cast?: number;
  className?: string;
  style?: CSSProperties;
  art: ReactNode;
  /** A button or anything that must sit in the card's plane. */
  extra?: ReactNode;
}

const laneY = (pos: number) => LANE_Y[0] + (LANE_Y[2] - LANE_Y[0]) * (pos / 2);
const svgBox = (w: number, h: number, children: ReactNode, viewBox = `0 0 ${w} ${h}`) =>
  <svg className="pb-art" viewBox={viewBox} width={w} height={h} preserveAspectRatio="none" aria-hidden="true" focusable="false">{children}</svg>;
const halfBox = (side: Side, w: number, h: number) => side === 'left' ? `0 0 ${w} ${h}` : `${w} 0 ${w} ${h}`;

/* ── the card machinery ───────────────────────────────────────────────────── */
function Card({ layer, progress, offset, mirror }: { layer: Layer; progress: number; offset: number; mirror: boolean }) {
  const p = Math.min(progress, layer.p ?? 1);
  const fold = foldAngles(p);
  const kind = layer.kind ?? 'stand';
  const angle = (kind === 'stand' ? fold.stand : fold.vfold.rise) + (layer.lean ?? 0) * p;
  const yaw = kind === 'vfold-l' ? fold.vfold.yaw : kind === 'vfold-r' ? -fold.vfold.yaw : (layer.yaw ?? 0);
  const left = kind === 'vfold-l' ? layer.x - layer.w : kind === 'vfold-r' ? layer.x : layer.x - layer.w / 2;
  const origin = kind === 'vfold-l' ? '100% 100%' : kind === 'vfold-r' ? '0 100%' : '50% 100%';
  const rise = Math.sin((Math.max(0, angle) * Math.PI) / 180);
  const reach = layer.h * 0.5 * rise * (layer.cast ?? 1);
  return <>
    {(layer.cast ?? 1) > 0 && rise > 0.02 && <span className="pb-cast" style={{ left: left - offset + layer.w * 0.06, top: layer.y - reach, width: layer.w * 0.88, height: reach + 3, opacity: 0.55 * fold.shadow, transform: `translateZ(.4px) skewX(${mirror ? 26 : -26}deg)` }} />}
    <div className={`pb-pop${layer.className ? ` ${layer.className}` : ''}`} style={{ left: left - offset, top: layer.y - layer.h, width: layer.w, height: layer.h, transformOrigin: origin, transform: `translateZ(1px) rotateX(${-angle}deg) rotateY(${yaw}deg)`, ...layer.style }}>
      {layer.art}{layer.extra}
    </div>
  </>;
}

/** One half of one spread, as it lies on a page or a leaf face. */
export function SpreadHalf({ spread, side, progress, live, uid }: { spread: SpreadIndex; side: Side; progress: number; live: Live; uid: string }) {
  const id = `${uid}-${spread}-${side}`;
  const layers = (spread === 0 ? streamLayers : spread === 1 ? riverLayers : spread === 2 ? stormLayers : harbourLayers)(live, side);
  const offset = side === 'left' ? 0 : PAGE_W;
  const mine = layers.filter(layer => layer.kind === 'vfold-l' ? side === 'left' : layer.kind === 'vfold-r' ? side === 'right' : (layer.x < PAGE_W) === (side === 'left')).sort((a, b) => a.y - b.y);
  const Print = PRINTS[spread];
  return <div className="pb-half" data-spread={spread} data-side={side}>
    <div className="pb-print" aria-hidden="true">
      <Print side={side} id={id} />
      <svg className="pb-print__live" viewBox={halfBox(side, PAGE_W, PAGE_D)} width={PAGE_W} height={PAGE_D} aria-hidden="true" focusable="false">{livePrint(spread, live)}</svg>
      <span className="pb-gutter" />
      <span className="pb-grain" />
    </div>
    {mine.map(layer => <Card key={layer.key} layer={layer} progress={progress} offset={offset} mirror={live.mirror} />)}
  </div>;
}

function Grad({ id, stops, vertical = true }: { id: string; stops: readonly (readonly [number, string])[]; vertical?: boolean }) {
  return <linearGradient id={id} x1="0" y1="0" x2={vertical ? 0 : 1} y2={vertical ? 1 : 0}>{stops.map(([at, colour]) => <stop key={at} offset={at} style={{ stopColor: colour }} />)}</linearGradient>;
}

/* ── the boat card, shared by every spread ────────────────────────────────── */
function boatLayer({ key, x, y, yaw = 0, roll = 0, bob = 0, afloat = true, glow = false, control, w = 84, h = 64 }: { key: string; x: number; y: number; yaw?: number; roll?: number; bob?: number; afloat?: boolean; glow?: boolean; control?: BoatControl | null; w?: number; h?: number }): Layer {
  return {
    key, x, y, w, h, yaw, className: 'pb-boat-card',
    art: <span className={`pb-boat${afloat ? ' pb-boat--afloat' : ''}`} style={{ transform: `translateY(${bob.toFixed(2)}px) rotate(${roll.toFixed(2)}deg)` }}>
      <svg viewBox="0 0 80 60" aria-hidden="true" focusable="false"><BoatArt glow={glow} /></svg>
    </span>,
    extra: control ? <button type="button" className="pb-boat-button" data-pb-boat-button="" aria-label={control.label} onPointerDown={control.onPointerDown} onClick={control.onClick} /> : undefined,
  };
}

/* ── spread 1: the stream (morning greens) ────────────────────────────────── */
const StreamPrint = memo(function StreamPrint({ side, id }: { side: Side; id: string }) {
  return <svg viewBox={halfBox(side, PAGE_W, PAGE_D)} width={PAGE_W} height={PAGE_D} aria-hidden="true" focusable="false">
    <defs>
      <Grad id={`${id}-sky`} stops={[[0, mk('sky')], [0.6, mk('sky-pale')], [1, mk('paper')]]} />
      <Grad id={`${id}-meadow`} stops={[[0, mix('spring', 80, 'sage')], [1, mix('spring', 70, 'leaf')]]} />
      <Grad id={`${id}-water`} stops={[[0, mk('sea')], [1, mix('water', 80, 'teal')]]} />
    </defs>
    <rect width={SPREAD_W} height={PAGE_D} style={{ fill: mk('paper') }} />
    <rect width={SPREAD_W} height="84" fill={`url(#${id}-sky)`} />
    <circle cx="66" cy="30" r="22" style={{ fill: fade('butter', 70) }} /><circle cx="66" cy="30" r="15" style={{ fill: mk('sun') }} />
    <Cut d="M0 72 C 70 50 150 58 230 68 C 310 80 390 46 500 62 L500 112 L0 112 Z" fill={mk('sage')} />
    <Cut d="M0 90 C 120 76 220 92 300 84 C 380 76 440 90 500 82 L500 290 L0 290 Z" fill={`url(#${id}-meadow)`} edge={mix('spring', 50, 'white')} />
    {/* the stream: from under the bridge on the left page, round to the right page's edge */}
    <path d="M96 92 C 98 150 34 182 138 202 C 230 222 330 188 402 194 C 442 197 472 202 500 204 L500 244 C 470 242 440 238 400 236 C 330 230 240 266 136 250 C 30 232 84 160 124 92 Z" style={{ fill: mix('sand', 80, 'moss') }} />
    <path d="M100 92 C 102 150 42 184 140 205 C 232 224 330 192 402 198 C 442 201 472 206 500 208 L500 240 C 470 238 440 234 400 232 C 330 226 240 262 138 246 C 38 228 90 160 120 92 Z" fill={`url(#${id}-water)`} />
    {[[150, 222, 26], [236, 228, 22], [330, 214, 30], [430, 220, 24], [90, 196, 16], [106, 140, 10]].map(([x, y, l], i) => <path key={i} d={`M${x} ${y} q ${l / 2} -4 ${l} 0`} style={{ fill: 'none', stroke: fade('sky-pale', 85), strokeWidth: 2, strokeLinecap: 'round' }} />)}
    {/* stepping stones and the meadow's printed flowers */}
    {[[262, 270, 9], [290, 262, 7], [44, 132, 8]].map(([x, y, r], i) => <ellipse key={`st${i}`} cx={x} cy={y} rx={r} ry={r * 0.55} style={{ fill: mix('steel-light', 70, 'sand') }} />)}
    {[[30, 120], [210, 132], [250, 150], [320, 260], [470, 130], [400, 270], [180, 276], [60, 280], [360, 108], [140, 120]].map(([x, y], i) => <g key={`f${i}`}><circle cx={x} cy={y} r="3" style={{ fill: i % 3 === 0 ? mk('blossom') : i % 3 === 1 ? mk('butter') : mk('white') }} /><circle cx={x} cy={y} r="1.1" style={{ fill: mk('amber') }} /></g>)}
    {[[20, 160], [80, 260], [230, 110], [300, 150], [380, 140], [480, 260], [200, 285]].map(([x, y], i) => <path key={`g${i}`} d={`M${x} ${y} l3 -8 l2 8 l3 -6 l1 6`} style={{ fill: 'none', stroke: mk('leaf'), strokeWidth: 1.4, strokeLinecap: 'round' }} />)}
  </svg>;
});
const HedgeArt = memo(() => svgBox(124, 62, <Lobes lobes={[[16, 44, 16], [38, 34, 20], [64, 30, 22], [90, 36, 20], [110, 46, 14]]} fill={mk('leaf')} shade={mk('leaf-deep')} light={mix('spring', 70, 'leaf')} />));
const BridgeArt = memo(() => svgBox(128, 66, <g>
  {/* rail */}
  <path d="M8 40 Q64 0 120 40" style={{ fill: 'none', stroke: mk('wood-dark'), strokeWidth: 4, strokeLinecap: 'round' }} />
  <path d="M8 38.5 Q64 -1.5 120 38.5" style={{ fill: 'none', stroke: mk('wood-light'), strokeWidth: 2, strokeLinecap: 'round' }} />
  {[16, 32, 48, 64, 80, 96, 112].map(x => { const top = 40 - 40 * (1 - ((x - 64) / 56) ** 2) * 0.52; return <rect key={x} x={x - 1.6} y={top} width="3.2" height={20} rx="1.2" style={{ fill: mk('wood-dark') }} />; })}
  {/* arched deck */}
  <Cut d="M0 66 L0 52 Q64 12 128 52 L128 66 L114 66 Q64 30 14 66 Z" fill={mk('wood')} edge={mk('wood-light')} />
  {[22, 40, 58, 76, 94, 110].map(x => <path key={x} d={`M${x} ${57 - 20 * (1 - ((x - 64) / 64) ** 2)} l0 7`} style={{ stroke: mk('wood-dark'), strokeWidth: 1, opacity: 0.6 }} />)}
</g>));
const WillowArt = memo(({ side }: { side: Side }) => svgBox(100, 160, <g>
  <Cut d="M92 160 C 94 120 90 96 96 70 L104 70 C 110 96 106 120 108 160 Z" fill={mk('umber')} edge={mk('fur')} />
  <path d="M100 96 C 80 84 70 80 58 84" style={{ fill: 'none', stroke: mk('umber'), strokeWidth: 5, strokeLinecap: 'round' }} />
  <path d="M100 90 C 122 80 132 78 146 82" style={{ fill: 'none', stroke: mk('umber'), strokeWidth: 5, strokeLinecap: 'round' }} />
  <Lobes lobes={[[44, 62, 30], [76, 40, 34], [100, 30, 36], [126, 40, 34], [156, 62, 30], [100, 70, 26], [62, 84, 22], [138, 84, 22]]} fill={mk('sage')} shade={mk('celadon-deep')} light={mix('spring', 60, 'sage')} />
  {[24, 36, 50, 64, 136, 150, 164, 176].map((x, i) => <path key={x} d={`M${x} ${70 + (i % 3) * 6} q ${i % 2 ? 3 : -3} 30 0 ${46 + (i % 4) * 8}`} style={{ fill: 'none', stroke: mix('celadon', 80, 'sage'), strokeWidth: 3.2, strokeLinecap: 'round' }} />)}
</g>, halfBox(side, 100, 160)));
const AppleTreeArt = memo(() => svgBox(96, 150, <g>
  <Cut d="M43 150 C 45 120 44 100 46 82 L52 82 C 54 100 53 120 55 150 Z" fill={mk('umber')} edge={mk('fur')} />
  <Lobes lobes={[[30, 58, 24], [50, 40, 28], [70, 58, 24], [48, 72, 22]]} fill={mk('leaf')} shade={mk('leaf-deep')} light={mix('spring', 70, 'leaf')} />
  {[[30, 50], [58, 34], [70, 62], [44, 70], [52, 52]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.4" style={{ fill: i % 2 ? mk('rose') : mk('poppy') }} />)}
</g>));
const FenceArt = memo(() => svgBox(124, 36, <g>
  <rect x="0" y="12" width="124" height="5" rx="2" style={{ fill: mk('wood') }} /><rect x="0" y="24" width="124" height="5" rx="2" style={{ fill: mk('wood') }} />
  {Array.from({ length: 9 }, (_, i) => <Cut key={i} d={`M${4 + i * 14} 36 L${4 + i * 14} 6 L${9 + i * 14} 0 L${14 + i * 14} 6 L${14 + i * 14} 36 Z`} fill={mk('wood-light')} edge={mk('butter')} />)}
</g>));
const ReedArt = memo(({ w, h, blades, tone }: { w: number; h: number; blades: number; tone?: string }) => svgBox(w, h, <Reeds w={w} h={h} blades={blades} tone={tone} />));
const FlowersArt = memo(() => svgBox(66, 38, <g>
  {[[8, 18], [20, 10], [32, 16], [44, 8], [56, 18]].map(([x, top], i) => <path key={`s${i}`} d={`M${x} 38 Q ${x + 2} ${top + 10} ${x} ${top}`} style={{ fill: 'none', stroke: mk('leaf-deep'), strokeWidth: 2 }} />)}
  {[[8, 18, 'poppy'], [20, 10, 'white'], [32, 16, 'poppy'], [44, 8, 'white'], [56, 18, 'rose']].map(([x, y, c], i) => <g key={`b${i}`}>{[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx={Number(x)} cy={Number(y) - 4.5} rx="2.6" ry="4.4" transform={`rotate(${a} ${x} ${y})`} style={{ fill: mk(String(c)) }} />)}<circle cx={Number(x)} cy={Number(y)} r="2.4" style={{ fill: mk('amber') }} /></g>)}
</g>));
const DuckArt = memo(() => svgBox(40, 30, <g>
  <Cut d="M4 22 C 4 14 14 12 24 16 C 26 8 36 8 36 16 C 36 20 32 22 30 22 C 32 26 26 30 16 30 C 8 30 4 27 4 22 Z" fill={mk('butter')} edge={mk('white')} />
  <path d="M8 22 C 12 18 20 18 24 22" style={{ fill: 'none', stroke: mk('amber'), strokeWidth: 2 }} />
  <path d="M36 14 L42 16 L36 18 Z" style={{ fill: mk('orange') }} />
  <circle cx="32" cy="13" r="1.4" style={{ fill: mk('ink') }} />
</g>));

/** The waiting boat's little wiggle (every few seconds), computed from the clock:
 * CSS animations inside a 3D card would be lifted out of the book's depth order. */
export function wiggle(time: number): number {
  const k = (time % 2.6) / 2.6;
  if (k < 0.72) return 0;
  const f = (k - 0.72) / 0.28;
  return Math.sin(f * Math.PI * 3) * 6 * (1 - f);
}
function streamLayers(live: Live): Layer[] {
  const t = live.time, still = live.reduced;
  const bob = still || !live.boat0.afloat ? 0 : Math.sin(t * 2.3) * 1.6;
  const roll = still || !live.boat0.hint ? 0 : wiggle(t);
  return [
    { key: 'hedge', x: 58, y: 84, w: 124, h: 62, art: <HedgeArt /> },
    { key: 'willow-l', x: PAGE_W, y: 76, w: 100, h: 160, kind: 'vfold-l', art: <WillowArt side="left" /> },
    { key: 'willow-r', x: PAGE_W, y: 76, w: 100, h: 160, kind: 'vfold-r', art: <WillowArt side="right" /> },
    { key: 'bridge', x: 112, y: 104, w: 128, h: 66, art: <BridgeArt /> },
    { key: 'tree', x: 444, y: 100, w: 96, h: 150, art: <AppleTreeArt /> },
    { key: 'fence', x: 352, y: 152, w: 124, h: 36, art: <FenceArt /> },
    { key: 'duck', x: 424, y: 222, w: 40, h: 30, cast: 0.4, lean: still ? 0 : Math.sin(t * 1.6) * 5, art: <DuckArt /> },
    { key: 'reeds-r', x: 304, y: 250, w: 58, h: 74, art: <ReedArt w={58} h={74} blades={7} /> },
    { key: 'reeds-l', x: 34, y: 262, w: 52, h: 66, art: <ReedArt w={52} h={66} blades={6} tone="moss" /> },
    { key: 'flowers', x: 452, y: 284, w: 66, h: 38, art: <FlowersArt /> },
    { ...boatLayer({ key: 'boat', x: live.boat0.x, y: live.boat0.y, bob, roll, afloat: live.boat0.afloat, glow: live.boat0.hint, control: live.boatControl, w: 120, h: 96 }), className: `pb-boat-card pb-boat-card--launch${live.boat0.hint ? ' pb-boat-card--hint' : ''}` },
  ];
}

/* ── spread 2: the wheel and the river (river blues) ──────────────────────── */
const RiverPrint = memo(function RiverPrint({ side, id }: { side: Side; id: string }) {
  return <svg viewBox={halfBox(side, PAGE_W, PAGE_D)} width={PAGE_W} height={PAGE_D} aria-hidden="true" focusable="false">
    <defs>
      <Grad id={`${id}-bank`} stops={[[0, mix('sky-pale', 70, 'paper')], [0.45, mk('sage')], [1, mix('moss', 70, 'sage')]]} />
      <Grad id={`${id}-river`} stops={[[0, mk('teal')], [0.45, mk('water')], [1, mix('sea', 80, 'sky')]]} />
    </defs>
    <rect width={SPREAD_W} height={PAGE_D} style={{ fill: mk('paper') }} />
    <rect width={SPREAD_W} height="96" fill={`url(#${id}-bank)`} />
    {[30, 70, 118, 170, 212, 300, 350, 396, 440, 480].map((x, i) => <ellipse key={x} cx={x} cy={44 + (i % 3) * 6} rx={14 + (i % 2) * 6} ry={22 + (i % 3) * 5} style={{ fill: i % 2 ? mix('celadon-deep', 60, 'sage') : mix('celadon-deep', 80, 'teal-deep') }} />)}
    <Cut d="M0 84 C 80 78 160 90 250 84 C 340 78 420 90 500 84 L500 266 C 420 272 340 260 250 266 C 160 272 80 262 0 268 Z" fill={`url(#${id}-river)`} edge={mix('sky-pale', 60, 'sea')} />
    <path d="M0 268 C 80 262 160 272 250 266 C 340 260 420 272 500 266 L500 290 L0 290 Z" style={{ fill: mix('sand', 80, 'paper') }} />
    <path d="M0 268 C 80 262 160 272 250 266 C 340 260 420 272 500 266" style={{ fill: 'none', stroke: mix('sand', 70, 'wood'), strokeWidth: 2 }} />
  </svg>;
});
const FarReedsArt = memo(() => svgBox(250, 42, <Reeds w={250} h={42} blades={26} tone="celadon-deep" />));
const NearGrassArt = memo(() => svgBox(250, 26, <g>
  <Reeds w={250} h={26} blades={22} tone="moss" heads={false} />
  {[[40, 22, 7], [120, 23, 5], [190, 22, 8]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.6} style={{ fill: mix('steel-light', 70, 'sand') }} />)}
</g>));
const PoplarArt = memo(({ side }: { side: Side }) => svgBox(110, 120, <g>
  {[[64, 120, 24, 58], [156, 120, 22, 52], [110, 120, 28, 70]].map(([x, base, rx, ry], i) => <g key={i}>
    <rect x={x - 2.5} y={base - 26} width="5" height="26" style={{ fill: mk('umber') }} />
    <ellipse cx={x + 2} cy={base - 22 - ry} rx={rx} ry={ry} style={{ fill: mk('leaf-deep') }} />
    <ellipse cx={x} cy={base - 24 - ry} rx={rx * 0.94} ry={ry * 0.96} style={{ fill: i === 2 ? mk('celadon-deep') : mix('celadon-deep', 70, 'leaf') }} />
    <ellipse cx={x - rx * 0.35} cy={base - 30 - ry * 1.2} rx={rx * 0.38} ry={ry * 0.5} style={{ fill: fade('celadon', 70) }} />
  </g>)}
</g>, halfBox(side, 110, 120)));
const ArchArt = memo(({ lit }: { lit: boolean }) => svgBox(96, 88, <g>
  {lit && <ellipse cx="48" cy="40" rx="46" ry="40" style={{ fill: fade('sun', 38) }} />}
  {/* two bulrush bundles bending over to meet */}
  {[0, 1, 2].map(i => <g key={i}>
    <path d={`M${8 + i * 5} 88 C ${6 + i * 4} 50 ${22 + i * 4} 16 ${46 - i} ${10 + i * 3}`} style={{ fill: 'none', stroke: i === 1 ? mk('leaf') : mk('leaf-deep'), strokeWidth: 5 - i, strokeLinecap: 'round' }} />
    <path d={`M${88 - i * 5} 88 C ${90 - i * 4} 50 ${74 - i * 4} 16 ${50 + i} ${10 + i * 3}`} style={{ fill: 'none', stroke: i === 1 ? mk('leaf') : mk('leaf-deep'), strokeWidth: 5 - i, strokeLinecap: 'round' }} />
  </g>)}
  <path d="M10 88 C 8 52 24 18 46 11" style={{ fill: 'none', stroke: mk('spring'), strokeWidth: 2 }} />
  <path d="M86 88 C 88 52 72 18 50 11" style={{ fill: 'none', stroke: mk('spring'), strokeWidth: 2 }} />
  {[[16, 46], [26, 26], [70, 26], [80, 46], [12, 66], [84, 66]].map(([x, y], i) => <g key={`fl${i}`}>{[0, 90, 180, 270].map(a => <circle key={a} cx={x + 2.6 * Math.cos((a * Math.PI) / 180)} cy={y + 2.6 * Math.sin((a * Math.PI) / 180)} r="2.3" style={{ fill: i % 2 ? mk('blossom') : mk('butter') }} />)}<circle cx={x} cy={y} r="1.6" style={{ fill: mk('amber') }} /></g>)}
  {/* the paper ribbon where they are tied */}
  <path d="M40 6 L56 6 L52 14 L44 14 Z" style={{ fill: lit ? mk('sun') : mk('gold-light') }} />
  <path d="M44 14 L40 24 L46 18 Z M52 14 L56 24 L50 18 Z" style={{ fill: lit ? mk('amber') : mk('gold') }} />
  {[[14, 30], [82, 30], [8, 52], [88, 52]].map(([x, y], i) => <rect key={i} x={x - 3} y={y} width="6" height="14" rx="3" style={{ fill: mk('umber') }} />)}
</g>));
const ArchFrontArt = memo(() => svgBox(104, 34, <g>
  <g transform="translate(0 0)"><Reeds w={26} h={34} blades={4} heads={false} /></g>
  <g transform="translate(78 0)"><Reeds w={26} h={34} blades={4} heads={false} /></g>
</g>));
const RockArt = memo(({ variant }: { variant: number }) => svgBox(54, 34, <g>
  <Cut d={variant ? 'M2 34 C 2 18 12 8 26 9 C 40 10 52 20 52 34 Z' : 'M4 34 C 4 22 10 12 22 12 C 30 4 46 10 50 22 C 52 26 52 30 52 34 Z'} fill={mix('steel', 70, 'slate')} edge={mk('steel-light')} />
  <path d="M10 34 C 12 26 18 20 26 19" style={{ fill: 'none', stroke: fade('steel-light', 80), strokeWidth: 2, strokeLinecap: 'round' }} />
  <Cut d="M30 34 C 30 28 36 24 42 26 C 48 28 50 31 50 34 Z" fill={mk('steel-dark')} edge={mk('steel')} />
</g>));
const LotusArt = memo(() => svgBox(26, 18, <g>
  {[-36, -14, 14, 36].map(a => <ellipse key={a} cx="13" cy="11" rx="3.6" ry="7" transform={`rotate(${a} 13 17)`} style={{ fill: mk('blossom') }} />)}
  <ellipse cx="13" cy="10" rx="3.4" ry="7.4" style={{ fill: mk('rose') }} />
</g>));

function riverLayers(live: Live): Layer[] {
  const river = live.river, layers: Layer[] = [
    { key: 'far-reeds-l', x: 125, y: 92, w: 250, h: 42, cast: 0.6, art: <FarReedsArt /> },
    { key: 'far-reeds-r', x: 375, y: 92, w: 250, h: 42, cast: 0.6, art: <FarReedsArt /> },
    { key: 'poplar-l', x: PAGE_W, y: 66, w: 110, h: 120, kind: 'vfold-l', art: <PoplarArt side="left" /> },
    { key: 'poplar-r', x: PAGE_W, y: 66, w: 110, h: 120, kind: 'vfold-r', art: <PoplarArt side="right" /> },
    { key: 'near-l', x: 125, y: 290, w: 250, h: 26, cast: 0.5, art: <NearGrassArt /> },
    { key: 'near-r', x: 375, y: 290, w: 250, h: 26, cast: 0.5, art: <NearGrassArt /> },
  ];
  for (const item of RIVER_COURSE) {
    const x = riverItemX(item, river.d);
    if (x < -40 || x > SPREAD_W + 40) continue;
    const p = edgeProgress(x), y = LANE_Y[item.lane];
    if (p <= 0) continue;
    if (item.kind === 'gate') {
      const passedAt = live.arches[item.id], waiting = live.waiting === item.id;
      const since = passedAt === undefined ? -1 : live.time - passedAt;
      const sway = since < 0 || live.reduced ? 0 : Math.sin(since * 9) * 7 * Math.exp(-since * 2.4);
      layers.push({ key: item.id, x, y: y - 9, w: 96, h: 88, p, lean: sway, art: <ArchArt lit={passedAt !== undefined || waiting} /> });
      layers.push({ key: `${item.id}-front`, x, y: y + 12, w: 104, h: 34, p, cast: 0.5, art: <ArchFrontArt /> });
    } else if (item.kind === 'rock') {
      layers.push({ key: item.id, x, y: y + 4, w: 54, h: 34, p, art: <RockArt variant={item.lane % 2} /> });
    } else {
      layers.push({ key: item.id, x: x + 4, y: y + 2, w: 26, h: 18, p, cast: 0.3, art: <LotusArt /> });
    }
  }
  const steering = river.bumpLane !== null && river.d < river.bumpUntil ? river.bumpLane : live.steer1;
  const bob = live.reduced ? 0 : Math.sin(live.time * 2.6) * 1.4;
  // After a rock's nudge the boat spins softly once, by how far the river has run since.
  const since = river.bumpLane !== null ? (river.d - (river.bumpUntil - 60)) / 60 : 1;
  const spin = since >= 0 && since < 1 && !live.reduced ? Math.sin(since * Math.PI * 2) * 16 * (1 - since) : 0;
  layers.push(boatLayer({ key: 'boat', x: RIVER_BOAT_X, y: laneY(river.pos) + 6, yaw: boatYaw(river.pos, steering) + spin * 1.4, roll: spin, bob, w: 80, h: 60 }));
  return layers;
}

/* ── spread 3: the storm (storm slate, one warm lighthouse yellow) ────────── */
const StormPrint = memo(function StormPrint({ side, id }: { side: Side; id: string }) {
  return <svg viewBox={halfBox(side, PAGE_W, PAGE_D)} width={PAGE_W} height={PAGE_D} aria-hidden="true" focusable="false">
    <defs>
      <Grad id={`${id}-sky`} stops={[[0, mk('slate')], [1, mk('storm')]]} />
      <Grad id={`${id}-sea`} stops={[[0, mk('indigo')], [0.5, mix('indigo', 60, 'teal-deep')], [1, mk('teal-deep')]]} />
    </defs>
    <rect width={SPREAD_W} height={PAGE_D} style={{ fill: mk('paper') }} />
    <rect width={SPREAD_W} height="100" fill={`url(#${id}-sky)`} />
    <Cut d="M0 92 C 120 86 240 96 360 88 C 420 84 460 90 500 88 L500 290 L0 290 Z" fill={`url(#${id}-sea)`} edge={mix('storm', 50, 'chalk')} />
    {[[40, 130], [150, 118], [260, 136], [370, 124], [460, 140], [90, 176], [330, 170], [200, 250], [420, 236], [40, 236]].map(([x, y], i) => <path key={i} d={`M${x} ${y} q 10 -7 20 0 q 10 7 20 0`} style={{ fill: 'none', stroke: fade('chalk', 30), strokeWidth: 2, strokeLinecap: 'round' }} />)}
  </svg>;
});
const LighthouseArt = memo(({ lit = true, tall = false }: { lit?: boolean; tall?: boolean }) => {
  const h = tall ? 176 : 160, top = 30;
  return svgBox(50, h, <g>
    <Cut d={`M14 ${h} L19 ${top + 14} L31 ${top + 14} L36 ${h} Z`} fill={mk('snow')} edge={mk('white')} />
    {[0.25, 0.55, 0.82].map(f => { const y = top + 14 + (h - top - 14) * f; return <path key={f} d={`M${14 + 5 * (1 - f) - 0.6} ${y} L${36 - 5 * (1 - f) + 0.6} ${y} L${36 - 5 * (1 - f) + 1.6} ${y + 14} L${14 + 5 * (1 - f) - 1.6} ${y + 14} Z`} style={{ fill: mk('red') }} />; })}
    <path d={`M25 ${top + 14} L31 ${top + 14} L36 ${h} L25 ${h} Z`} style={{ fill: fade('snow-shade', 45) }} />
    <rect x="12" y={top + 10} width="26" height="5" rx="1.5" style={{ fill: mk('graphite') }} />
    <rect x="17" y={top - 4} width="16" height="14" rx="2" style={{ fill: lit ? mk('sun') : mk('steel-light') }} />
    <path d={`M15 ${top - 4} L25 ${top - 16} L35 ${top - 4} Z`} style={{ fill: mk('red') }} />
    {lit && <circle cx="25" cy={top + 3} r="16" style={{ fill: fade('sun', 42) }} />}
  </g>);
});
function BeamArt({ sweep, strength }: { sweep: number; strength: number }) {
  return svgBox(440, 160, <g transform={`rotate(${sweep} 415 34)`} style={{ opacity: strength }}>
    <path d="M415 34 L40 4 Q 20 40 40 84 Z" style={{ fill: fade('butter', 20) }} />
    <path d="M415 34 L60 24 Q 48 44 60 62 Z" style={{ fill: fade('sun', 30) }} />
  </g>);
}
function CloudArt({ w, h, lift, rain, calm, seed }: { w: number; h: number; lift: number; rain: number; calm: number; seed: number }) {
  const stalk = h - 60, top = (1 - lift) * stalk;
  const dark = mix('slate', 100 - 50 * calm, 'chalk'), mid = mix('storm', 100 - 40 * calm, 'snow'), light = mix('steel', 100 - 40 * calm, 'white');
  const strips = Math.round(9 * rain);
  return svgBox(w, h, <g>
    <rect x={w / 2 - 3} y={top + 34} width="6" height={h - top - 34} rx="2" style={{ fill: mix('paper-shade', 80, 'steel') }} />
    <rect x={w / 2 - 3} y={top + 34} width="2" height={h - top - 34} style={{ fill: mk('paper') }} />
    <g transform={`translate(0 ${top})`}>
      {Array.from({ length: strips }, (_, i) => <rect key={i} x={10 + ((i * 41 + seed * 17) % (w - 30))} y={44 + (i % 3) * 7} width="4" height={22 + (i % 2) * 12} rx="2" transform={`skewX(-18)`} style={{ fill: fade('sky-pale', 75 * rain + 10), opacity: rain }} />)}
      <Lobes lobes={[[w * 0.22, 36, w * 0.17], [w * 0.45, 26, w * 0.22], [w * 0.7, 30, w * 0.19], [w * 0.86, 40, w * 0.12]]} fill={mid} shade={dark} light={light} />
      <rect x={w * 0.08} y="38" width={w * 0.84} height="14" rx="7" style={{ fill: mid }} />
    </g>
  </g>);
}
function WaveArt({ side, h, crest, fill, foam }: { side: Side; h: number; crest: number; fill: string; foam: string }) {
  let d = `M-20 ${h} L-20 ${crest}`;
  for (let x = -20; x < SPREAD_W + 20; x += 50) d += ` Q ${x + 12} ${crest - 16} ${x + 30} ${crest - 6} Q ${x + 40} ${crest + 2} ${x + 50} ${crest}`;
  d += ` L${SPREAD_W + 20} ${h} Z`;
  let caps = '';
  for (let x = -20; x < SPREAD_W + 20; x += 50) caps += ` M${x + 14} ${crest - 9} Q ${x + 22} ${crest - 15} ${x + 30} ${crest - 6}`;
  return svgBox(PAGE_W, h, <g>
    <Cut d={d} fill={fill} edge={foam} lift={2} />
    <path d={caps} style={{ fill: 'none', stroke: foam, strokeWidth: 3, strokeLinecap: 'round' }} />
  </g>, halfBox(side, PAGE_W, h));
}
const BuoyArt = memo(() => svgBox(28, 42, <g>
  <rect x="12.5" y="2" width="3" height="16" style={{ fill: mk('graphite') }} />
  <circle cx="14" cy="6" r="3" style={{ fill: mk('sun') }} />
  <Cut d="M4 42 L8 16 L20 16 L24 42 Z" fill={mk('red')} edge={mk('rose')} />
  <rect x="6.6" y="25" width="14.8" height="6" style={{ fill: mk('snow') }} />
</g>));

function stormLayers(live: Live): Layer[] {
  const calm = live.calm, t = live.time, still = live.reduced;
  const rock = (phase: number) => (still ? 0 : Math.sin(t * 1.7 + phase) * 9 * (1 - 0.85 * calm));
  const sway = (phase: number) => (still ? 0 : Math.sin(t * 1.7 + phase + 0.6) * 2.5 * (1 - 0.8 * calm));
  const lift = 1 - 0.62 * calm, rain = Math.max(0, 1 - calm * 1.15);
  const sweep = still ? -4 : Math.sin(t * 0.7) * 10 - 4;
  const waves: [string, number, number, string, string, number][] = [
    ['w1', 150, 44, mix('slate', 100 - 45 * calm, 'water'), mix('storm', 70, 'chalk'), 0],
    ['w2', 206, 40, mix('indigo', 100 - 40 * calm, 'sea'), mix('steel-light', 80, 'white'), 2.1],
    ['w3', 280, 34, mix('teal-deep', 100 - 35 * calm, 'sea'), mk('white'), 4.2],
  ];
  const layers: Layer[] = [
    { key: 'beam', x: 468 - 207, y: 88, w: 440, h: 160, cast: 0, className: 'pb-beam', art: <BeamArt sweep={sweep} strength={0.85 - 0.35 * calm} /> },
    { key: 'lighthouse', x: 468, y: 90, w: 50, h: 160, art: <LighthouseArt /> },
    { key: 'cloud-1', x: 82, y: 74, w: 126, h: 150, cast: 0.35, art: <CloudArt w={126} h={150} lift={lift} rain={rain} calm={calm} seed={1} /> },
    { key: 'cloud-2', x: 236, y: 60, w: 138, h: 176, cast: 0.35, art: <CloudArt w={138} h={176} lift={lift} rain={rain} calm={calm} seed={2} /> },
    { key: 'cloud-3', x: 372, y: 78, w: 118, h: 140, cast: 0.35, art: <CloudArt w={118} h={140} lift={lift} rain={rain} calm={calm} seed={3} /> },
    { key: 'buoy', x: 336, y: 196, w: 28, h: 42, cast: 0.5, lean: rock(1.2) * 0.6, art: <BuoyArt /> },
  ];
  for (const [key, y, h, fill, foam, phase] of waves) for (const side of ['left', 'right'] as const) {
    layers.push({ key: `${key}-${side}`, x: side === 'left' ? PAGE_W / 2 : PAGE_W * 1.5, y, w: PAGE_W, h, lean: rock(phase), cast: 0.8, style: { translate: `${sway(phase)}px 0` }, className: 'pb-wave', art: <WaveArt side={side} h={h} crest={16} fill={fill} foam={foam} /> });
  }
  const roll = still ? 0 : Math.sin(t * 1.9) * 13 * (1 - 0.8 * calm), bob = still ? 0 : Math.sin(t * 1.7 + 3) * 4 * (1 - 0.6 * calm);
  layers.push(boatLayer({ key: 'boat', x: 196, y: 236, yaw: (live.mirror ? 1 : -1) * live.wheel2 * 0.4, roll, bob: bob - 8, w: 84, h: 64 }));
  return layers;
}

/* ── spread 4: the harbour (evening amber and rose) ───────────────────────── */
const HarbourPrint = memo(function HarbourPrint({ side, id }: { side: Side; id: string }) {
  return <svg viewBox={halfBox(side, PAGE_W, PAGE_D)} width={PAGE_W} height={PAGE_D} aria-hidden="true" focusable="false">
    <defs>
      <Grad id={`${id}-sky`} stops={[[0, mix('rose-deep', 70, 'plum')], [0.45, mk('rose')], [0.8, mk('amber')], [1, mk('butter')]]} />
      <Grad id={`${id}-sea`} stops={[[0, mix('indigo', 70, 'plum')], [0.5, mk('teal-deep')], [1, mix('indigo', 80, 'teal-deep')]]} />
    </defs>
    <rect width={SPREAD_W} height={PAGE_D} style={{ fill: mk('paper') }} />
    <rect width={SPREAD_W} height="104" fill={`url(#${id}-sky)`} />
    {[[40, 16], [120, 30], [200, 12], [330, 22], [420, 10], [470, 34]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.6 : 2.2} style={{ fill: mk('butter') }} />)}
    <circle cx="300" cy="96" r="26" style={{ fill: fade('sun', 60) }} /><circle cx="300" cy="96" r="18" style={{ fill: mk('sun') }} />
    <rect y="98" width={SPREAD_W} height="12" style={{ fill: mix('clay', 60, 'umber') }} />
    <Cut d="M0 108 L500 108 L500 290 L0 290 Z" fill={`url(#${id}-sea)`} edge={mix('amber', 60, 'rose')} />
    {[[300, 134, 40], [300, 160, 28], [300, 190, 18], [300, 222, 12]].map(([x, y, l], i) => <rect key={i} x={x - l / 2} y={y} width={l} height="3" rx="1.5" style={{ fill: fade('sun', 70 - i * 12) }} />)}
    {[[60, 160], [180, 200], [420, 180], [120, 262], [380, 270]].map(([x, y], i) => <path key={`w${i}`} d={`M${x} ${y} q 8 -5 16 0 q 8 5 16 0`} style={{ fill: 'none', stroke: fade('rose', 45), strokeWidth: 2, strokeLinecap: 'round' }} />)}
  </svg>;
});
const HOUSES = [
  { key: 'h1', x: 40, w: 66, h: 94, roof: 'rust', wall: 'butter' },
  { key: 'h2', x: 106, w: 62, h: 116, roof: 'clay', wall: 'blossom' },
  { key: 'h3', x: 176, w: 70, h: 86, roof: 'rose-deep', wall: 'clay-pale' },
  { key: 'h4', x: 300, w: 64, h: 98, roof: 'plum', wall: 'sand' },
  { key: 'h5', x: 372, w: 68, h: 82, roof: 'rust', wall: 'blossom' },
] as const;
const HouseArt = memo(({ w, h, roof, wall, glow }: { w: number; h: number; roof: string; wall: string; glow: number }) => {
  const eave = h * 0.36, win = glow > 0 ? mk('sun') : mix('amber', 70, 'clay');
  return svgBox(w, h, <g>
    <Cut d={`M4 ${h} L4 ${eave} L${w - 4} ${eave} L${w - 4} ${h} Z`} fill={mk(wall)} />
    <path d={`M${w * 0.62} ${eave} L${w - 4} ${eave} L${w - 4} ${h} L${w * 0.62} ${h} Z`} style={{ fill: fade('umber', 14) }} />
    <Cut d={`M0 ${eave + 2} L${w / 2} 2 L${w} ${eave + 2} Z`} fill={mk(roof)} />
    <rect x={w * 0.66} y={eave * 0.3} width="7" height={eave * 0.5} style={{ fill: mix(roof, 70, 'umber') }} />
    {[0.3, 0.7].map(fx => [0.55, 0.78].map(fy => <rect key={`${fx}${fy}`} x={w * fx - 6} y={h * fy - 8} width="12" height="14" rx="2" style={{ fill: win }} />))}
    {glow > 0 && <circle cx={w * 0.5} cy={h * 0.66} r={w * 0.5} style={{ fill: fade('sun', 16) }} />}
    <rect x={w / 2 - 6} y={h - 18} width="12" height="18" rx="6" style={{ fill: mix(roof, 60, 'umber') }} />
  </g>);
});
const TownhouseArt = memo(({ side, glow }: { side: Side; glow: number }) => svgBox(72, 132, <g>
  <Cut d="M30 132 L30 46 L72 16 L114 46 L114 132 Z" fill={mk('clay-light')} />
  <path d="M72 16 L114 46 L114 132 L72 132 Z" style={{ fill: fade('umber', 12) }} />
  <Cut d="M24 50 L72 12 L120 50 L114 50 L72 20 L30 50 Z" fill={mk('rust')} />
  <circle cx="72" cy="46" r="11" style={{ fill: mk('butter') }} /><circle cx="72" cy="46" r="8" style={{ fill: mk('paper') }} />
  <path d="M72 46 L72 40 M72 46 L76 48" style={{ stroke: mk('ink'), strokeWidth: 1.6, strokeLinecap: 'round' }} />
  {[54, 90].map(x => [76, 102].map(y => <rect key={`${x}${y}`} x={x - 7} y={y} width="14" height="16" rx="2" style={{ fill: glow > 0 ? mk('sun') : mix('amber', 70, 'clay') }} />))}
</g>, halfBox(side, 72, 132)));
const QuayArt = memo(() => svgBox(236, 42, <g>
  <Cut d="M0 42 L0 6 L236 6 L236 42 Z" fill={mix('steel', 55, 'clay-pale')} edge={mix('sand', 60, 'white')} />
  {[0, 1, 2].map(row => Array.from({ length: 9 }, (_, i) => <rect key={`${row}-${i}`} x={(row % 2 ? -13 : 0) + i * 28 + 1} y={10 + row * 11} width="25" height="9" rx="2" style={{ fill: row === 2 ? mix('steel-dark', 40, 'clay') : mix('steel-light', 60, 'blossom') }} />))}
  <rect x="0" y="0" width="236" height="7" rx="2" style={{ fill: mix('sand', 70, 'steel-light') }} />
</g>));
const LampArt = memo(({ lit }: { lit: boolean }) => svgBox(26, 64, <g>
  {lit && <circle cx="13" cy="12" r="13" style={{ fill: fade('sun', 50) }} />}
  <rect x="11.5" y="18" width="3" height="46" style={{ fill: mk('graphite') }} />
  <rect x="8" y="60" width="10" height="4" rx="1" style={{ fill: mk('graphite') }} />
  <path d="M7 18 L19 18 L17 6 L9 6 Z" style={{ fill: lit ? mk('sun') : mix('steel-light', 70, 'sand') }} />
  <path d="M6 7 L13 1 L20 7 Z" style={{ fill: mk('graphite') }} />
</g>));
const BollardArt = memo(({ rope }: { rope: number }) => svgBox(48, 70, <g>
  <Cut d="M18 30 L18 18 C 18 12 30 12 30 18 L30 30 Z" fill={mk('graphite')} edge={mk('steel-dark')} />
  <rect x="15" y="15" width="18" height="5" rx="2.5" style={{ fill: mk('steel-dark') }} />
  <g transform={`translate(0 ${(-26 * (1 - rope)).toFixed(1)})`} style={{ opacity: rope }}>
    <ellipse cx="24" cy="23" rx="8" ry="3.4" style={{ fill: 'none', stroke: mk('wood-light'), strokeWidth: 3 }} />
    <path d="M17 24 C 10 40 6 54 2 70" style={{ fill: 'none', stroke: mk('wood-light'), strokeWidth: 3, strokeLinecap: 'round' }} />
    <path d="M17 24 C 10 40 6 54 2 70" style={{ fill: 'none', stroke: mk('wood'), strokeWidth: 1, strokeDasharray: '3 3' }} />
  </g>
</g>));
const MooredArt = memo(({ hull }: { hull: string }) => svgBox(54, 46, <g>
  <rect x="25" y="2" width="2.6" height="30" style={{ fill: mk('umber') }} />
  <Cut d="M28 6 L46 28 L28 28 Z" fill={mk('snow')} edge={mk('white')} />
  <Cut d="M2 30 L52 30 L44 44 L10 44 Z" fill={mk(hull)} />
  <rect x="6" y="33" width="42" height="3" style={{ fill: fade('white', 45) }} />
</g>));

export const LAMP_X = [300, 338, 436, 474, 230] as const;
const BOLLARD_X = QUAY_X + 30;
function harbourLayers(live: Live): Layer[] {
  const harbour = live.harbour, lamps = harbour.lamps, t = live.time, still = live.reduced;
  const windows = lamps >= HARBOUR_LAMPS ? 1 : lamps >= 3 ? 0.5 : 0;
  const rock = (phase: number) => (still ? 0 : Math.sin(t * 1.4 + phase) * 4);
  const layers: Layer[] = [
    ...HOUSES.map(house => ({ key: house.key, x: house.x, y: 104, w: house.w, h: house.h, art: <HouseArt w={house.w} h={house.h} roof={house.roof} wall={house.wall} glow={windows} /> })),
    { key: 'town-l', x: PAGE_W, y: 100, w: 72, h: 132, kind: 'vfold-l', art: <TownhouseArt side="left" glow={windows} /> },
    { key: 'town-r', x: PAGE_W, y: 100, w: 72, h: 132, kind: 'vfold-r', art: <TownhouseArt side="right" glow={windows} /> },
    { key: 'quay', x: 382, y: 114, w: 236, h: 42, art: <QuayArt /> },
    { key: 'lighthouse', x: 474, y: 108, w: 50, h: 176, art: <LighthouseArt tall lit={lamps >= HARBOUR_LAMPS} /> },
    ...LAMP_X.slice(0, 4).map((x, i) => ({ key: `lamp-${i}`, x, y: 117, w: 26, h: 64, cast: 0.6, art: <LampArt lit={lamps > i} /> })),
    { key: 'lamp-4', x: LAMP_X[4], y: 106, w: 26, h: 64, cast: 0.6, art: <LampArt lit={lamps > 4} /> },
    { key: 'bollard', x: BOLLARD_X, y: 118, w: 48, h: 70, cast: 0.4, art: <BollardArt rope={live.rope} /> },
    { key: 'moored-1', x: 112, y: 234, w: 54, h: 46, lean: rock(0), art: <MooredArt hull="rose-deep" /> },
    { key: 'moored-2', x: 440, y: 246, w: 54, h: 46, lean: rock(1.7), art: <MooredArt hull="amber" /> },
  ];
  const bob = still || harbour.docked ? 0 : Math.sin(t * 2.4) * 1.4;
  layers.push(boatLayer({ key: 'boat', x: harbour.x, y: laneY(harbour.pos) + 6, yaw: harbour.docked ? 0 : boatYaw(harbour.pos, live.steer3), bob, glow: live.waitingQuay, w: 80, h: 60 }));
  return layers;
}

/* ── what moves on the printed page ───────────────────────────────────────── */
const pulse = (live: Live) => (live.reduced ? 1 : 1 + 0.08 * Math.sin(live.time * 3.4));
function livePrint(spread: SpreadIndex, live: Live): ReactNode {
  if (spread === 0) {
    const { x, y, afloat, hint } = live.boat0;
    return <g>
      {afloat && <Ripple cx={x} cy={y + 2} rx={44} ry={9} opacity={0.85} />}
      {hint && <ellipse cx={x} cy={y + 1} rx={46 * pulse(live)} ry={12 * pulse(live)} style={{ fill: 'none', stroke: mk('gold-light'), strokeWidth: 3, opacity: 1.4 - pulse(live) * 0.6 }} />}
    </g>;
  }
  if (spread === 1) {
    const d = live.river.d, marks: ReactNode[] = [];
    for (let i = 0; i < 9; i++) for (let lane = 0; lane < 3; lane++) {
      const x = (((i * 64 + lane * 23 - d * 0.9) % 576) + 576) % 576 - 40;
      marks.push(<path key={`${i}-${lane}`} d={`M${x} ${LANE_Y[lane] + 14 + (i % 2) * 5} q 9 -4 18 0`} style={{ fill: 'none', stroke: fade('sky-pale', 60), strokeWidth: 2, strokeLinecap: 'round' }} />);
    }
    const pads = RIVER_COURSE.filter(item => item.kind === 'pad').map(item => {
      const x = riverItemX(item, d), y = LANE_Y[item.lane] + 6;
      return x < -30 || x > SPREAD_W + 30 ? null : <g key={item.id}><ellipse cx={x} cy={y} rx="17" ry="7" style={{ fill: mk('leaf-deep') }} /><path d={`M${x - 17} ${y - 1} A17 7 0 1 1 ${x} ${y} Z`} style={{ fill: mk('leaf') }} /><ellipse cx={x - 2} cy={y - 1.6} rx="11" ry="3.6" style={{ fill: fade('spring', 55) }} /></g>;
    });
    const wait = live.waiting ? RIVER_COURSE.find(item => item.id === live.waiting) : undefined;
    return <g>
      {marks}{pads}
      {wait && <ellipse cx={riverItemX(wait, d)} cy={LANE_Y[wait.lane] + 6} rx={40 * pulse(live)} ry={11 * pulse(live)} style={{ fill: fade('sun', 22), stroke: mk('gold-light'), strokeWidth: 2.5 }} />}
      <Ripple cx={RIVER_BOAT_X} cy={laneY(live.river.pos) + 8} rx={40} ry={8} opacity={0.8} />
    </g>;
  }
  if (spread === 2) {
    const calm = live.calm;
    return <g>
      <rect width={SPREAD_W} height="100" style={{ fill: fade('sky', 70 * calm) }} />
      <Ripple cx={196} cy={246} rx={44} ry={9} colour="chalk" opacity={0.6} />
    </g>;
  }
  const h = live.harbour, lamps = h.lamps;
  return <g>
    {LAMP_X.map((x, i) => lamps > i ? <rect key={i} x={x - 3} y={i === 4 ? 112 : 124} width="6" height={46 - i * 2} rx="3" style={{ fill: fade('sun', 46) }} /> : null)}
    {live.waitingQuay && <ellipse cx={QUAY_X} cy={LANE_Y[0] + 8} rx={42 * pulse(live)} ry={11 * pulse(live)} style={{ fill: fade('sun', 22), stroke: mk('gold-light'), strokeWidth: 2.5 }} />}
    <Ripple cx={h.x} cy={laneY(h.pos) + 8} rx={40} ry={8} colour="blossom" opacity={0.7} />
  </g>;
}

const PRINTS = [StreamPrint, RiverPrint, StormPrint, HarbourPrint] as const;
