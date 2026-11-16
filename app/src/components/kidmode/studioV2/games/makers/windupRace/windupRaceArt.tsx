import type { Ref } from 'react';
import { TILT, mk, mx } from './windupCar';
import { BALL_ART, BLOOM_ART, CAN_ART, CUSHION_ART, FLOOR_ART, FLOWER_FOLDED_ART, FLOWER_OPEN_ART, LAMP_ART, PAD_ARTS, PEP_HAPPY_ART, PEP_IDLE_ART, PEP_SIDE_ART, PETAL_ARTS, RUG_ART, SIGN_ART, TILE_ARTS, WALL_ART, WALL_SHARE } from './windupKit';
import { pointAt, shapeOf, type Track, type TrackId } from './windupRaceRules';

/** Wind-up Racer scenery: a Wonderworks pavilion gallery in Horizon Valley,
 * seen side-on from a little above. The wall and the floor are the kit's own
 * pictures; the toys, Pep, the flower and the cushion are kit sprites; the
 * blocks and ramps the trail climbs, the arches, the key and the chalk are
 * drawn here in pale wood, knit and brass, lit from the upper left like the
 * kit, with contact shadows.
 *
 * World space is SVG space: x to the right along the trail, y DOWN, y = 0 the
 * line the wheels roll on (heights are drawn as -y). The floor runs away from
 * the camera upward: a thing `d` deep behind the lane is drawn TILT * d higher. */

/** Half the lane's depth, and how far that reaches up and down the picture. */
export const LANE = 46;
export const EDGE = LANE * TILT;
/** The floor's far edge (where the wall stands), above the lane line. */
export const FLOOR_TOP = -124;
export const FLOOR_TILE = 944;
export const FLOOR_DEEP = 372;
export const WALL_TILE = 500;
export const WALL_HIGH = WALL_TILE * WALL_SHARE;
/** Where the two picture layers begin (world x), so the camera never runs off them. */
export const BACKDROP_X0 = -1300;

const fill = (colour: string) => ({ style: { fill: colour } });

/* ---------- the room: two layers of kit pictures behind the drawing ---------- */

/** The wall and the floor, as plain pictures the camera slides and scales.
 * `width` is the world width to cover. Every other picture is mirrored so
 * they meet without a seam. */
export function Backdrop({ width, wallRef, floorRef }: { width: number; wallRef: Ref<HTMLDivElement>; floorRef: Ref<HTMLDivElement> }) {
  const walls = Math.ceil((width - BACKDROP_X0 + 1300) / WALL_TILE), floors = Math.ceil((width - BACKDROP_X0 + 1300) / FLOOR_TILE);
  return <>
    <div className="wr-wall" ref={wallRef} style={{ inlineSize: walls * WALL_TILE, blockSize: WALL_HIGH }} aria-hidden="true">
      {Array.from({ length: walls }, (_, i) => <img key={i} src={WALL_ART} alt="" draggable={false} decoding="async" data-flip={i % 2 === 1} style={{ insetInlineStart: i * WALL_TILE - .5, inlineSize: WALL_TILE + 1, blockSize: WALL_TILE }} />)}
    </div>
    <div className="wr-floor" ref={floorRef} style={{ inlineSize: floors * FLOOR_TILE, blockSize: FLOOR_DEEP }} aria-hidden="true">
      {Array.from({ length: floors }, (_, i) => <img key={i} src={FLOOR_ART} alt="" draggable={false} decoding="async" data-flip={i % 2 === 1} style={{ insetInlineStart: i * FLOOR_TILE - .5, inlineSize: FLOOR_TILE + 1, blockSize: FLOOR_DEEP }} />)}
    </div>
  </>;
}

/** Every gradient the drawn things use, once per scene. */
export function SceneDefs({ id }: { id: string }) {
  const stop = (offset: string, colour: string) => <stop offset={offset} style={{ stopColor: colour }} />;
  return <defs>
    <linearGradient id={`${id}deck`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('wood-light', 'white', 30))}{stop('1', mx('wood-light', 'paper', 46))}</linearGradient>
    <linearGradient id={`${id}face`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('wood-light', 'paper', 48))}{stop('.6', mx('wood-light', 'paper', 72))}{stop('1', mx('wood-light', 'wood', 86))}</linearGradient>
    <linearGradient id={`${id}knit`} x1="0" y1="0" x2="0" y2="1">{stop('0', mk('white'))}{stop('.6', mk('paper'))}{stop('1', mx('linen', 'paper', 60))}</linearGradient>
    <linearGradient id={`${id}roll`} x1="0" y1="0" x2="0" y2="1">{stop('0', mx('clay-light', 'white', 70))}{stop('.5', mx('poppy', 'clay-light', 55))}{stop('1', mx('rust', 'poppy', 50))}</linearGradient>
    <linearGradient id={`${id}arch`} x1="0" y1="0" x2="1" y2="0">{stop('0', mx('linen', 'white', 45))}{stop('.45', mk('cream'))}{stop('1', mx('linen-shade', 'cream', 60))}</linearGradient>
    <linearGradient id={`${id}cuff`} x1="0" y1="0" x2="1" y2="0">{stop('0', mk('sun'))}{stop('1', mx('amber', 'gold', 60))}</linearGradient>
    <radialGradient id={`${id}shade`} cx=".5" cy=".5" r=".5">{stop('0', mx('shadow', 'transparent', 34))}{stop('.6', mx('shadow', 'transparent', 18))}{stop('1', mx('shadow', 'transparent', 0))}</radialGradient>
    <radialGradient id={`${id}pool`} cx=".5" cy=".5" r=".5">{stop('0', mx('sun', 'transparent', 62))}{stop('1', mx('sun', 'transparent', 0))}</radialGradient>
    <linearGradient id={`${id}coil`} x1="0" y1="0" x2="1" y2="0">{stop('0', mk('steel-dark'))}{stop('.45', mk('steel-light'))}{stop('1', mk('steel'))}</linearGradient>
  </defs>;
}

/** A soft contact shadow on the floor. */
function Shade({ x = 0, y = 0, rx, ry, id }: { x?: number; y?: number; rx: number; ry: number; id: string }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} style={{ fill: `url(#${id}shade)` }} />;
}

/* ---------- the trail: blocks, ramps and planks of pale wood with a knit runner ---------- */

/** The pieces of the rolling line that stand above the floor, with the line run on past both ends. */
function raised(track: Track): { x0: number; h0: number; x1: number; h1: number }[] {
  const pts = track.points, parts: { x0: number; h0: number; x1: number; h1: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, h0] = pts[i - 1], [x1, h1] = pts[i];
    // The little hump of a knit roll is not a block: it is drawn as the roll.
    if (x1 - x0 < .5 || Math.max(h0, h1) < 8) continue;
    parts.push({ x0: i === 1 ? x0 - 1400 : x0, h0, x1: i === pts.length - 1 ? x1 + 1400 : x1, h1 });
  }
  return parts;
}
export function Terrain({ track, id }: { track: Track; id: string }) {
  const parts = raised(track);
  const runner = EDGE * .58;
  return <g>
    {/* What the blocks hide of the light: one soft shadow thrown forward and to the right. */}
    <path d={parts.map(p => `M${p.x0} ${EDGE}L${p.x1} ${EDGE}L${p.x1 + 16 + p.h1 * .18} ${EDGE + 9 + p.h1 * .1}L${p.x0 + 16 + p.h0 * .18} ${EDGE + 9 + p.h0 * .1}Z`).join('')} {...fill(mx('shadow', 'transparent', 13))} />
    {parts.map((p, i) => {
      const rising = p.h1 - p.h0;
      const top = `M${p.x0} ${-p.h0 - EDGE}L${p.x1} ${-p.h1 - EDGE}L${p.x1} ${-p.h1 + EDGE}L${p.x0} ${-p.h0 + EDGE}Z`;
      return <g key={i}>
        {/* The near face of the block, down to the floor. */}
        <path d={`M${p.x0} ${-p.h0 + EDGE}L${p.x1} ${-p.h1 + EDGE}L${p.x1} ${EDGE}L${p.x0} ${EDGE}Z`} style={{ fill: `url(#${id}face)` }} />
        <path d={`M${p.x0} ${EDGE - 5}H${p.x1}V${EDGE}H${p.x0}Z`} {...fill(mx('wood-dark', 'transparent', 16))} />
        {/* The plies of the wood, along the top edge. */}
        <path d={`M${p.x0} ${-p.h0 + EDGE + 4}L${p.x1} ${-p.h1 + EDGE + 4}`} style={{ fill: 'none', stroke: mx('wood', 'transparent', 42), strokeWidth: 1.2 }} />
        <path d={`M${p.x0} ${-p.h0 + EDGE + 7.5}L${p.x1} ${-p.h1 + EDGE + 7.5}`} style={{ fill: 'none', stroke: mx('white', 'transparent', 40), strokeWidth: 1 }} />
        {/* The top, in the light; a slope that faces the window is brighter, one that faces away is in a little shade. */}
        <path d={top} style={{ fill: `url(#${id}deck)` }} />
        {rising !== 0 && <path d={top} {...fill(rising > 0 ? mx('white', 'transparent', 26) : mx('wood-dark', 'transparent', 10))} />}
        {/* The knit runner the wheels roll on. */}
        <path d={`M${p.x0} ${-p.h0 - runner}L${p.x1} ${-p.h1 - runner}L${p.x1} ${-p.h1 + runner}L${p.x0} ${-p.h0 + runner}Z`} style={{ fill: `url(#${id}knit)` }} />
        <path d={`M${p.x0} ${-p.h0}L${p.x1} ${-p.h1}`} style={{ fill: 'none', stroke: mx('linen-shade', 'transparent', 55), strokeWidth: runner * 1.7, strokeDasharray: '1.6 4.4' }} />
        {[-1, 1].map(side => <path key={side} d={`M${p.x0} ${-p.h0 + side * runner}L${p.x1} ${-p.h1 + side * runner}`} style={{ fill: 'none', stroke: mx('teal', 'sea', 60), strokeWidth: 2.2 }} />)}
        <path d={`M${p.x0} ${-p.h0 + EDGE}L${p.x1} ${-p.h1 + EDGE}`} style={{ fill: 'none', stroke: mx('white', 'transparent', 85), strokeWidth: 1.6 }} />
        {/* Where two blocks meet. */}
        {i > 0 && <path d={`M${p.x0} ${-p.h0 + EDGE}V${EDGE}`} style={{ fill: 'none', stroke: mx('wood-dark', 'transparent', 34), strokeWidth: 1.2 }} />}
      </g>;
    })}
  </g>;
}

/** The dashed lane line on the floor (as on the kit's Rover floor), where the trail is on the ground. */
export function LaneMarks({ track }: { track: Track }) {
  const pts = track.points, total = shapeOf(track).total, runs: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) if (pts[i - 1][1] < .01 && pts[i][1] < .01 && pts[i][0] - pts[i - 1][0] > 1) runs.push([i === 1 ? -1400 : pts[i - 1][0], i === pts.length - 1 ? total + 1400 : pts[i][0]]);
  return <g>{runs.map(([from, to], i) => <g key={i}>
    <path d={`M${from} ${EDGE + 11.5}H${to}`} style={{ fill: 'none', stroke: mx('steel', 'transparent', 26), strokeWidth: 5, strokeDasharray: '34 22' }} />
    <path d={`M${from} ${EDGE + 10}H${to}`} style={{ fill: 'none', stroke: mx('white', 'transparent', 96), strokeWidth: 5, strokeDasharray: '34 22' }} />
  </g>)}</g>;
}

/** The start: the kit's arrow sign lying on the floor behind Rover, pointing the way. */
export function StartSign({ track, id }: { track: Track; id: string }) {
  const p = pointAt(track, track.start - 92);
  return <g transform={`translate(${p.x} ${-p.y})`}>
    <Shade x={4} y={3} rx={62} ry={24} id={id} />
    <g transform={`scale(1 ${TILT}) rotate(90)`}><image href={SIGN_ART} x="-56" y="-56" width="112" height="112" /></g>
  </g>;
}

/** The finish: a stitched line across the lane, and the knit flower that opens when Rover reaches it. */
export function Finish({ x, y, id, wrapRef, foldedRef, openRef, onPoke }: { x: number; y: number; id: string; wrapRef?: Ref<SVGGElement>; foldedRef?: Ref<SVGImageElement>; openRef?: Ref<SVGImageElement>; onPoke?: () => void }) {
  return <g transform={`translate(${x} ${y})`}>
    <path d={`M-4 ${-EDGE}L4 ${-EDGE}L10 ${EDGE}L2 ${EDGE}Z`} {...fill(mx('white', 'transparent', 92))} />
    <path d={`M0 ${-EDGE}L6 ${EDGE}`} style={{ fill: 'none', stroke: mk('teal'), strokeWidth: 2.6, strokeDasharray: '5 4' }} />
    <g transform={`translate(-6 ${-EDGE - 12})`}>
      <Shade x={2} y={0} rx={34} ry={9} id={id} />
      <g ref={wrapRef} className="wr-toy" onPointerDown={onPoke}>
        <g className="wr-nod">
          <image ref={foldedRef} href={FLOWER_FOLDED_ART} x="-50" y="-148" width="100" height="150" />
          <image ref={openRef} href={FLOWER_OPEN_ART} x="-50" y="-148" width="100" height="150" style={{ opacity: 0 }} />
        </g>
        <rect x="-44" y="-150" width="88" height="154" style={{ fill: 'none', pointerEvents: 'all' }} />
      </g>
    </g>
  </g>;
}

/** The knit cushion that catches an overshoot; `squashRef` presses it from its near face. */
export function Catcher({ x, y, id, squashRef, onPoke }: { x: number; y: number; id: string; squashRef?: Ref<SVGGElement>; onPoke?: () => void }) {
  return <g transform={`translate(${x} ${y})`}>
    <Shade x={78} y={EDGE - 2} rx={86} ry={20} id={id} />
    <g ref={squashRef} className="wr-toy" onPointerDown={onPoke}>
      <image href={CUSHION_ART} x="0" y={EDGE + 10 - 82} width="152" height="82" preserveAspectRatio="none" />
    </g>
  </g>;
}

/** A glass petal standing on its stem; the game tips it about its foot. */
export function PetalPin({ index, pinRef, id }: { index: number; pinRef?: Ref<SVGGElement>; id: string }) {
  return <g>
    <g ref={pinRef}>
      <Shade x={3} y={0} rx={11} ry={3.4} id={id} />
      <image href={PETAL_ARTS[index % PETAL_ARTS.length]} x="-13" y="-43" width="26" height="43.5" />
    </g>
  </g>;
}

/** The knit ball. */
export function KnitBall({ ballRef, spinRef, id }: { ballRef?: Ref<SVGGElement>; spinRef?: Ref<SVGGElement>; id: string }) {
  return <g ref={ballRef}>
    <Shade x={3} y={1} rx={24} ry={6.5} id={id} />
    <g transform="translate(0 -21)"><g ref={spinRef}><image href={BALL_ART} x="-22" y="-21.5" width="44" height="43" /></g></g>
  </g>;
}

/** A rolled knit rug lying across the lane: the bump. */
export function KnitRoll({ x, id }: { x: number; id: string }) {
  return <g transform={`translate(${x} 0)`}>
    <Shade x={5} y={EDGE - 1} rx={26} ry={7} id={id} />
    <path d={`M-13 ${-EDGE - 7}C-13 ${-EDGE - 13} 13 ${-EDGE - 13} 13 ${-EDGE - 7}L17 ${EDGE - 6}C17 ${EDGE + 3} -9 ${EDGE + 3} -9 ${EDGE - 6}Z`} style={{ fill: `url(#${id}roll)` }} />
    {[-.72, -.36, 0, .36, .72].map(f => <path key={f} d={`M${-11 + (f + 1) * 2} ${f * EDGE - 8}C-4 ${f * EDGE - 13} 6 ${f * EDGE - 13} ${13 + (f + 1) * 2} ${f * EDGE - 8}`} style={{ fill: 'none', stroke: mx('white', 'transparent', 55), strokeWidth: 1.3, strokeLinecap: 'round' }} />)}
    <ellipse cx="4" cy={EDGE - 5} rx="13" ry="7.6" {...fill(mx('poppy', 'rust', 55))} />
    <ellipse cx="4" cy={EDGE - 5} rx="8.6" ry="4.9" style={{ fill: 'none', stroke: mk('cream'), strokeWidth: 2 }} />
    <ellipse cx="4" cy={EDGE - 5} rx="3.6" ry="2" {...fill(mk('cream'))} />
  </g>;
}

/** The arches Rover runs under: three knit hoops with mustard cuffs, like the
 * kit's own. The far leg of each stands behind the lane, the near leg in front. */
const hoopsAt = (from: number, to: number) => [from + 26, (from + to) / 2, to - 26];
const HOOP_HIGH = 114;
function hoopHalf(x: number, near: boolean) {
  return near
    ? `M${x} ${-HOOP_HIGH}C${x + 15} ${-HOOP_HIGH} ${x + 23} ${-68} ${x + 23} ${EDGE + 6}`
    : `M${x - 23} ${-EDGE - 4}C${x - 23} ${-74} ${x - 15} ${-HOOP_HIGH} ${x} ${-HOOP_HIGH}`;
}
function Hoop({ x, near, id }: { x: number; near: boolean; id: string }) {
  const d = hoopHalf(x, near), footX = near ? x + 23 : x - 23, footY = near ? EDGE + 6 : -EDGE - 4;
  return <g>
    {near && <Shade x={footX + 4} y={footY + 1} rx={15} ry={4.5} id={id} />}
    <path d={d} style={{ fill: 'none', stroke: `url(#${id}arch)`, strokeWidth: 21, strokeLinecap: 'butt' }} />
    <path d={d} style={{ fill: 'none', stroke: mx('linen-shade', 'transparent', 60), strokeWidth: 21, strokeDasharray: '1.4 3.6' }} />
    <path d={d} transform="translate(-5 0)" style={{ fill: 'none', stroke: mx('white', 'transparent', 62), strokeWidth: 3, strokeLinecap: 'round' }} />
    <path d={`M${footX} ${footY - 17}V${footY}`} style={{ fill: 'none', stroke: `url(#${id}cuff)`, strokeWidth: 25, strokeLinecap: 'butt' }} />
    <path d={`M${footX} ${footY - 17}V${footY}`} style={{ fill: 'none', stroke: mx('gold', 'transparent', 60), strokeWidth: 25, strokeDasharray: '1.4 3.2' }} />
    <ellipse cx={footX} cy={footY} rx="12.5" ry="3.6" {...fill(mx('amber', 'gold', 55))} />
  </g>;
}
export function Hoops({ from, to, near, id, hoopRef }: { from: number; to: number; near: boolean; id: string; hoopRef?: (i: number) => (node: SVGGElement | null) => void }) {
  return <g>{hoopsAt(from, to).map((x, i) => <g key={x} ref={hoopRef?.(i)}><Hoop x={x} near={near} id={id} /></g>)}</g>;
}

/** Chalk marks where earlier runs reached; the newest is the strongest. */
export function ChalkMarks({ track, marks }: { track: Track; marks: readonly number[] }) {
  return <g>{marks.map((reach, i) => {
    const p = pointAt(track, Math.min(reach, shapeOf(track).total));
    const fresh = i === marks.length - 1;
    return <g key={`${i}:${reach}`} transform={`translate(${p.x} ${-p.y})`} style={{ opacity: fresh ? 1 : .3 + i * .16 }}><g className="wr-chalk" data-fresh={fresh}>
      <path d={`M-5 ${-EDGE + 2}L4 ${EDGE + 6}`} style={{ fill: 'none', stroke: mx('teal-deep', 'transparent', 22), strokeWidth: 8, strokeLinecap: 'round' }} />
      <path d={`M-6 ${-EDGE}L3 ${EDGE + 4}`} style={{ fill: 'none', stroke: mx('teal', 'sea', 55), strokeWidth: 5, strokeLinecap: 'round' }} />
      <path d={`M-4 ${-EDGE + 2}L4.5 ${EDGE + 2}`} style={{ fill: 'none', stroke: mx('white', 'transparent', 80), strokeWidth: 1.5, strokeLinecap: 'round', strokeDasharray: '6 3' }} />
      <path d={`M-12 ${EDGE - 4}L11 ${EDGE - 7}`} style={{ fill: 'none', stroke: mx('teal', 'transparent', 70), strokeWidth: 3.4, strokeLinecap: 'round' }} />
    </g></g>;
  })}</g>;
}

/* ---------- toys along the gallery (kit sprites, behind the lane) ---------- */

export type ToyKind = 'pad' | 'musicTile' | 'waterCan' | 'deskLamp' | 'restRug';
export interface Toy { kind: ToyKind; x: number; /** Up the picture from the lane line (it stands this far behind). */ back: number; pick: number }
const pads = (x: number, back: number, count: number, first = 0): Toy[] => Array.from({ length: count }, (_, i) => ({ kind: 'pad' as const, x: x + i * 74, back: back + (i % 2) * 7, pick: first + i }));
const tiles = (x: number, back: number): Toy[] => [0, 1, 2].map(i => ({ kind: 'musicTile' as const, x: x + i * 82, back, pick: i }));
/** What stands along each trail. Nothing here changes a run: these are for curious fingers. */
export const TRACK_TOYS: Readonly<Record<TrackId, readonly Toy[]>> = {
  shelf: [{ kind: 'restRug', x: 250, back: 112, pick: 0 }, ...pads(390, 76, 5), { kind: 'deskLamp', x: 800, back: 96, pick: 0 }, { kind: 'waterCan', x: 940, back: 84, pick: 0 }],
  ramp: [{ kind: 'waterCan', x: 150, back: 92, pick: 0 }, ...tiles(1010, 66), { kind: 'deskLamp', x: 1330, back: 104, pick: 0 }, { kind: 'restRug', x: 1500, back: 118, pick: 0 }],
  table: [{ kind: 'restRug', x: 250, back: 116, pick: 0 }, ...pads(470, 84, 4, 2), { kind: 'deskLamp', x: 790, back: 108, pick: 0 }, ...tiles(880, 118), { kind: 'waterCan', x: 1130, back: 78, pick: 0 }],
  blockBridge: [...tiles(60, 98), { kind: 'deskLamp', x: 960, back: 100, pick: 0 }, ...pads(1040, 70, 3, 1), { kind: 'waterCan', x: 1290, back: 96, pick: 0 }],
  bookSlide: [...pads(540, 74, 4), { kind: 'waterCan', x: 850, back: 110, pick: 0 }, { kind: 'restRug', x: 700, back: 128, pick: 0 }],
  grandTour: [{ kind: 'restRug', x: 240, back: 118, pick: 0 }, ...tiles(420, 122), { kind: 'deskLamp', x: 660, back: 112, pick: 0 }, ...pads(900, 78, 4, 1), { kind: 'waterCan', x: 1180, back: 92, pick: 0 }],
};
/** Toy places are authored on a deeper floor than the camera shows: this brings them in. */
export const BACK = .78;
const TOY_BOX: Record<ToyKind, { w: number; h: number; shade: number }> = {
  pad: { w: 62, h: 54, shade: 34 }, musicTile: { w: 72, h: 47, shade: 38 }, waterCan: { w: 98, h: 72, shade: 44 }, deskLamp: { w: 74, h: 90, shade: 30 }, restRug: { w: 168, h: 77, shade: 0 },
};
const toyArt = (toy: Toy) => toy.kind === 'pad' ? PAD_ARTS[toy.pick % PAD_ARTS.length] : toy.kind === 'musicTile' ? TILE_ARTS[toy.pick % TILE_ARTS.length] : toy.kind === 'waterCan' ? CAN_ART : toy.kind === 'deskLamp' ? LAMP_ART : RUG_ART;

export function Toys({ track, id, toyRef, glowRef, onPoke }: { track: Track; id: string; toyRef: (i: number) => (node: SVGGElement | null) => void; glowRef: (i: number) => (node: SVGEllipseElement | null) => void; onPoke: (i: number) => void }) {
  const toys = TRACK_TOYS[track.id];
  // Further back first, so nearer toys overlap the ones behind them.
  const order = toys.map((toy, i) => ({ toy, i })).sort((a, b) => b.toy.back - a.toy.back);
  return <g>{order.map(({ toy, i }) => {
    const box = TOY_BOX[toy.kind];
    return <g key={i} transform={`translate(${toy.x} ${-toy.back * BACK})`}>
      {box.shade > 0 && <Shade x={4} y={-2} rx={box.shade} ry={box.shade * .3} id={id} />}
      {toy.kind === 'deskLamp' && <ellipse ref={glowRef(i)} cx="34" cy="6" rx="62" ry="20" style={{ fill: `url(#${id}pool)`, opacity: 0 }} />}
      <g ref={toyRef(i)} className={toy.kind === 'restRug' ? undefined : 'wr-toy'} onPointerDown={toy.kind === 'restRug' ? undefined : () => onPoke(i)}>
        <image href={toyArt(toy)} x={-box.w / 2} y={-box.h} width={box.w} height={box.h} preserveAspectRatio="none" />
        {toy.kind !== 'restRug' && <rect x={-box.w / 2 - 6} y={-box.h - 6} width={box.w + 12} height={box.h + 12} style={{ fill: 'none', pointerEvents: 'all' }} />}
      </g>
    </g>;
  })}</g>;
}

/* ---------- Pep, the scout ---------- */

export interface PepParts { root?: Ref<SVGGElement>; flip?: Ref<SVGGElement>; bob?: Ref<SVGGElement>; sit?: Ref<SVGImageElement>; side?: Ref<SVGImageElement>; glad?: Ref<SVGImageElement>; shade?: Ref<SVGEllipseElement> }
/** How far behind the lane Pep runs (up the picture), and how tall he stands. */
export const PEP_BACK = 36;
export const PEP_TALL = 122;
export function Pep({ parts, id, onPoke }: { parts: PepParts; id: string; onPoke: () => void }) {
  return <g ref={parts.root}>
    <ellipse ref={parts.shade} cx="0" cy="-2" rx="46" ry="11" style={{ fill: `url(#${id}shade)` }} />
    <g ref={parts.flip}>
      <g ref={parts.bob} className="wr-toy" onPointerDown={onPoke}>
        <g className="wr-breathe">
          <image ref={parts.sit} href={PEP_IDLE_ART} x={-PEP_TALL / 2} y={-PEP_TALL} width={PEP_TALL} height={PEP_TALL} />
          <image ref={parts.side} href={PEP_SIDE_ART} x={-PEP_TALL * .48} y={-PEP_TALL * 1.005} width={PEP_TALL * .96} height={PEP_TALL * 1.005} preserveAspectRatio="none" style={{ opacity: 0 }} />
          <image ref={parts.glad} href={PEP_HAPPY_ART} x={-PEP_TALL / 2} y={-PEP_TALL} width={PEP_TALL} height={PEP_TALL} style={{ opacity: 0 }} />
        </g>
        <rect x={-PEP_TALL * .4} y={-PEP_TALL} width={PEP_TALL * .8} height={PEP_TALL} style={{ fill: 'none', pointerEvents: 'all' }} />
      </g>
    </g>
  </g>;
}

/* ---------- the celebration: knit blooms on coiled springs ---------- */

export const POPPER_HIGH = 92;
export const POPPERS = [{ dx: -128, back: 30 }, { dx: 62, back: 40 }, { dx: -58, back: 70 }, { dx: 128, back: 64 }] as const;
const SPRING = (() => { let d = 'M0 0'; for (let i = 1; i <= 14; i++) d += `L${i % 2 ? 7 : -7} ${-(i - .5) * (POPPER_HIGH / 14)}`; return `${d}L0 ${-POPPER_HIGH}`; })();
export function Poppers({ x, y, id, coilRef, bloomRef }: { x: number; y: number; id: string; coilRef: (i: number) => (node: SVGGElement | null) => void; bloomRef: (i: number) => (node: SVGGElement | null) => void }) {
  return <g>{POPPERS.map((p, i) => <g key={i} transform={`translate(${x + p.dx} ${y - EDGE - p.back})`}>
    <g ref={coilRef(i)} style={{ opacity: 0 }}>
      <Shade x={2} y={0} rx={20} ry={5} id={id} />
      <path d={SPRING} vectorEffect="non-scaling-stroke" style={{ fill: 'none', stroke: `url(#${id}coil)`, strokeWidth: 2.6, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
    </g>
    <g ref={bloomRef(i)} style={{ opacity: 0 }}><image href={BLOOM_ART} x="-27" y="-25" width="54" height="49" /></g>
  </g>)}</g>;
}

/** Small soft puffs (dust at the wheels, drops from the watering can): a fixed pool the game moves. */
export const PUFFS = 12;
export function Puffs({ puffRef }: { puffRef: (i: number) => (node: SVGCircleElement | null) => void }) {
  return <g>{Array.from({ length: PUFFS }, (_, i) => <circle key={i} ref={puffRef(i)} r="6" style={{ fill: mx('white', 'steel-light', 70), opacity: 0 }} />)}</g>;
}

/** The rolling line, for the little map. */
export function trackLine(track: Track): string {
  return track.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${-y}`).join('');
}
