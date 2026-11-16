/** The woolly mammoth, authored in world units (about 1000 by 700, ground at
 * y 615). The side view faces left: a high domed crown, a dip at the neck, the
 * shoulder hump as the top of the back, the back sloping down to low hips,
 * small ears, a long trunk and long tusks that sweep forward, down and up.
 * The turned three-quarter view is the same regions warped (nearer parts
 * larger, the far end smaller and higher) and mirrored to face right: one fur
 * system, two region sets. Pure data and maths: no DOM. */
import { polygonBounds, smoothClosed, type Bounds, type DiscoveryId, type FlowKind, type FurRegion, type PartId, type Vec } from './iceAgeFriendRules';

export type ViewId = 'side' | 'turned';

/* ── authored outlines (side view, facing left) ───────────────────────── */

const BODY: Vec[] = [[440, 238], [520, 190], [602, 204], [690, 250], [770, 298], [834, 344], [866, 404], [858, 466], [792, 506], [650, 524], [512, 518], [426, 482], [394, 410], [400, 330], [420, 274]];
const HEAD: Vec[] = [[454, 266], [448, 220], [410, 184], [364, 166], [322, 173], [296, 199], [282, 240], [279, 290], [290, 338], [322, 372], [372, 394], [430, 386], [458, 332]];
/** The mane along the hump and the top of the back. */
const RIDGE: Vec[] = [[436, 252], [470, 214], [520, 194], [602, 208], [690, 254], [744, 290], [722, 300], [660, 270], [600, 236], [522, 222], [476, 236], [452, 270]];
/** The long skirt that hangs from the belly and flanks. */
const SKIRT: Vec[] = [[424, 452], [500, 494], [650, 504], [790, 486], [852, 446], [858, 476], [794, 512], [650, 530], [510, 524], [420, 488]];
const CROWN: Vec[] = [[324, 180], [350, 164], [384, 166], [410, 184], [392, 196], [356, 190]];
const EAR: Vec[] = [[396, 262], [416, 272], [420, 300], [408, 324], [388, 330], [374, 312], [374, 284]];
const SHEATH: Vec[] = [[284, 330], [302, 322], [326, 334], [332, 352], [314, 360], [292, 352]];
const TAIL: Vec[] = [[848, 362], [866, 358], [884, 418], [902, 452], [896, 480], [874, 478], [870, 446], [856, 410]];
const leg = (x0: number, x1: number, top: number, foot: number): Vec[] => {
  const mid = (x0 + x1) / 2, w = x1 - x0;
  return [[x0, top], [mid, top - 10], [x1, top], [x1 - w * 0.04, top + (foot - top) * 0.55], [x1 + w * 0.03, foot - 14], [x1 - w * 0.02, foot], [x0 + w * 0.02, foot], [x0 - w * 0.03, foot - 14], [x0 + w * 0.04, top + (foot - top) * 0.55]];
};
const LEGS: Record<'legFarHind' | 'legFarFront' | 'legHind' | 'legFront', { poly: Vec[]; foot: number; x0: number; x1: number }> = {
  legFarHind: { poly: leg(652, 726, 452, 598), foot: 598, x0: 652, x1: 726 },
  legFarFront: { poly: leg(470, 548, 444, 600), foot: 600, x0: 470, x1: 548 },
  legHind: { poly: leg(706, 794, 440, 614), foot: 614, x0: 706, x1: 794 },
  legFront: { poly: leg(410, 500, 430, 616), foot: 616, x0: 410, x1: 500 },
};

/** A tusk as two cubic Béziers from its root: forward and down, then up and in. */
export type Bezier = readonly [Vec, Vec, Vec, Vec];
const TUSK_NEAR: readonly Bezier[] = [
  [[306, 342], [302, 448], [176, 500], [120, 454]],
  [[120, 454], [80, 420], [76, 350], [112, 314]],
];
const TUSK_FAR_SHIFT: Vec = [22, -6];

export const EYE: Vec = [318, 258];
export const TRUNK_BASE: Vec = [300, 294];
export const TRUNK_LENGTH = 300;
export const GROUND_Y = 615;

/** Pivots the idle motion turns about (side view). */
export const PIVOTS = { neck: [446, 300] as Vec, ear: [400, 268] as Vec, tail: [858, 366] as Vec };

/** Where each discovery's glowing ring sits (side view). The trunk's follows the tip. */
const HOTSPOTS: Record<Exclude<DiscoveryId, 'trunk'>, Vec> = {
  coats: [604, 404], ears: [396, 296], tusks: [146, 476], hump: [528, 214],
};

/* ── the turned view ──────────────────────────────────────────────────── */

const DEPTH_FROM = 300, DEPTH_SPAN = 560, ANCHOR: Vec = [300, 380];
/** How far back along the animal a point is (0 at the face, 1 at the rump). */
export const depthAt = (x: number) => Math.max(-0.45, Math.min(1.1, (x - DEPTH_FROM) / DEPTH_SPAN));
/** Size at depth: the face comes nearer, the rump goes further away. */
export const scaleAt = (x: number) => 1.1 - 0.36 * depthAt(x);
/** Warps a side-view point into the turned view (mirrored to face right). */
export function turnPoint([x, y]: Vec): Vec {
  const k = scaleAt(x);
  return [900 - (ANCHOR[0] + (x - ANCHOR[0]) * k), ANCHOR[1] + (y - ANCHOR[1]) * k];
}
/** The inverse of `turnPoint` (the warp only ever grows toward the face, so bisection finds it). */
export function unturnPoint([x, y]: Vec): Vec {
  let lo = -600, hi = 1400;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (turnPoint([mid, 0])[0] > x) lo = mid; else hi = mid; }
  const sx = (lo + hi) / 2, k = scaleAt(sx);
  return [sx, ANCHOR[1] + (y - ANCHOR[1]) / k];
}
export function placePoint(view: ViewId, p: Vec): Vec {
  return view === 'side' ? p : turnPoint(p);
}

/* ── regions ──────────────────────────────────────────────────────────── */

interface RegionDef { id: string; part: PartId; kind: FlowKind; points: Vec[]; share: number; guard: number; under: [number, number]; long: [number, number]; depth: number; fringe: number; samples?: number }
const DEFS: RegionDef[] = [
  { id: 'legFarHind', part: 'legFarHind', kind: 'leg', points: LEGS.legFarHind.poly, share: 0.022, guard: 0.6, under: [8, 13], long: [22, 38], depth: 0.9, fringe: 0.18, samples: 5 },
  { id: 'legFarFront', part: 'legFarFront', kind: 'leg', points: LEGS.legFarFront.poly, share: 0.024, guard: 0.6, under: [8, 13], long: [22, 38], depth: 0.85, fringe: 0.18, samples: 5 },
  { id: 'legHind', part: 'legHind', kind: 'leg', points: LEGS.legHind.poly, share: 0.034, guard: 0.62, under: [8, 14], long: [24, 42], depth: 0.12, fringe: 0.2, samples: 5 },
  { id: 'legFront', part: 'legFront', kind: 'leg', points: LEGS.legFront.poly, share: 0.036, guard: 0.62, under: [8, 14], long: [24, 42], depth: 0.05, fringe: 0.2, samples: 5 },
  { id: 'tail', part: 'tail', kind: 'tail', points: TAIL, share: 0.012, guard: 0.85, under: [6, 10], long: [16, 34], depth: 0.25, fringe: 0.3, samples: 5 },
  { id: 'body', part: 'body', kind: 'flank', points: BODY, share: 0.4, guard: 0.6, under: [9, 15], long: [30, 52], depth: 0, fringe: 0.1 },
  { id: 'ridge', part: 'body', kind: 'ridge', points: RIDGE, share: 0.07, guard: 0.85, under: [10, 16], long: [40, 64], depth: 0, fringe: 0.12 },
  { id: 'skirt', part: 'body', kind: 'skirt', points: SKIRT, share: 0.13, guard: 0.9, under: [14, 22], long: [54, 92], depth: 0.04, fringe: 0.08 },
  { id: 'head', part: 'head', kind: 'head', points: HEAD, share: 0.17, guard: 0.45, under: [6, 10], long: [12, 22], depth: 0, fringe: 0.26 },
  { id: 'crownTuft', part: 'head', kind: 'crownTuft', points: CROWN, share: 0.016, guard: 0.95, under: [8, 12], long: [20, 34], depth: 0, fringe: 0.25, samples: 5 },
  { id: 'ear', part: 'ear', kind: 'ear', points: EAR, share: 0.014, guard: 0.5, under: [5, 8], long: [10, 18], depth: 0, fringe: 0.3, samples: 5 },
  { id: 'trunk', part: 'trunk', kind: 'head', points: [], share: 0.07, guard: 0.3, under: [5, 9], long: [9, 15], depth: 0, fringe: 0 },
  { id: 'sheath', part: 'sheath', kind: 'sheath', points: SHEATH, share: 0.01, guard: 0.6, under: [5, 8], long: [10, 16], depth: 0, fringe: 0.35, samples: 5 },
];

export interface MammothView {
  view: ViewId;
  mirror: boolean;
  regions: FurRegion[];
  /** Base shapes (smoothed outlines) by name, in world units. */
  shapes: Record<'body' | 'head' | 'ear' | 'tail' | 'sheath' | 'legFarHind' | 'legFarFront' | 'legHind' | 'legFront', Vec[]>;
  feet: Record<'legFarHind' | 'legFarFront' | 'legHind' | 'legFront', { x0: number; x1: number; y: number }>;
  tusks: { near: Bezier[]; far: Bezier[] };
  eye: Vec;
  trunkBase: Vec;
  /** Size of the trunk here relative to the side view. */
  trunkScale: number;
  pivots: { neck: Vec; ear: Vec; tail: Vec };
  hotspots: Record<Exclude<DiscoveryId, 'trunk'>, Vec>;
  /** Everything the camera may show (the animal, its tusks, its shadow). */
  bounds: Bounds;
  /** Light and fur colours are computed against the animal's own box. */
  furBounds: Bounds;
  groundY: number;
}

const memo = new Map<ViewId, MammothView>();
export function mammothView(view: ViewId): MammothView {
  const cached = memo.get(view); if (cached) return cached;
  const place = (p: Vec) => placePoint(view, p);
  const smoothPlace = (points: Vec[], samples = 8) => smoothClosed(points, samples).map(place);
  const regions: FurRegion[] = DEFS.map(def => ({
    id: def.id, part: def.part, kind: def.kind, poly: def.points.length ? smoothPlace(def.points, def.samples ?? 8) : [],
    share: def.share, guard: def.guard, under: def.under, long: def.long, depth: def.depth, fringe: def.fringe, trunk: def.id === 'trunk',
  }));
  const bez = (b: Bezier, shift: Vec = [0, 0], k = 1): Bezier => b.map(([x, y]) => {
    const root = TUSK_NEAR[0][0];
    return place([root[0] + (x - root[0]) * k + shift[0], root[1] + (y - root[1]) * k + shift[1]]);
  }) as unknown as Bezier;
  const shapes = {
    body: smoothPlace(BODY), head: smoothPlace(HEAD), ear: smoothPlace(EAR, 6), tail: smoothPlace(TAIL, 5), sheath: smoothPlace(SHEATH, 5),
    legFarHind: smoothPlace(LEGS.legFarHind.poly, 5), legFarFront: smoothPlace(LEGS.legFarFront.poly, 5), legHind: smoothPlace(LEGS.legHind.poly, 5), legFront: smoothPlace(LEGS.legFront.poly, 5),
  };
  const foot = (id: keyof typeof LEGS) => { const l = LEGS[id]; const a = place([l.x0, l.foot]), b = place([l.x1, l.foot]); return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y: a[1] }; };
  const all = [...shapes.body, ...shapes.head, ...shapes.tail, ...shapes.legFront, ...shapes.legHind, ...shapes.legFarFront, ...shapes.legFarHind];
  const tuskNear = TUSK_NEAR.map(b => bez(b));
  // Turned toward us, the far tusk swings out to the far side and shows more.
  const tuskFar = TUSK_NEAR.map(b => bez(b, view === 'side' ? TUSK_FAR_SHIFT : [56, -26], view === 'side' ? 0.96 : 0.9));
  const tuskPoints = tuskNear.flat().concat(tuskFar.flat());
  const body = polygonBounds(all), tusk = polygonBounds(tuskPoints);
  const furBounds = body;
  const groundY = place([600, GROUND_Y])[1];
  const bounds: Bounds = { minX: Math.min(body.minX, tusk.minX) - 10, minY: body.minY - 20, maxX: Math.max(body.maxX, tusk.maxX) + 10, maxY: Math.max(body.maxY, groundY) + 18 };
  const result: MammothView = {
    view, mirror: view !== 'side', regions, shapes,
    feet: { legFarHind: foot('legFarHind'), legFarFront: foot('legFarFront'), legHind: foot('legHind'), legFront: foot('legFront') },
    tusks: { near: tuskNear, far: tuskFar }, eye: place(EYE), trunkBase: place(TRUNK_BASE), trunkScale: view === 'side' ? 1 : scaleAt(TRUNK_BASE[0]),
    pivots: { neck: place(PIVOTS.neck), ear: place(PIVOTS.ear), tail: place(PIVOTS.tail) },
    hotspots: { coats: place(HOTSPOTS.coats), ears: place(HOTSPOTS.ears), tusks: place(HOTSPOTS.tusks), hump: place(HOTSPOTS.hump) },
    bounds, furBounds, groundY,
  };
  memo.set(view, result);
  return result;
}

/** Hit test: is this world point on the animal's coat (so a drag strokes it)? */
export function onCoat(view: MammothView, x: number, y: number, inside: (x: number, y: number, poly: readonly Vec[]) => boolean): boolean {
  const s = view.shapes;
  return [s.body, s.head, s.ear, s.tail, s.legFront, s.legHind, s.legFarFront, s.legFarHind].some(poly => inside(x, y, poly));
}

/** Samples a Bézier at t. */
export function bezierAt(b: Bezier, t: number): Vec {
  const u = 1 - t;
  const x = u * u * u * b[0][0] + 3 * u * u * t * b[1][0] + 3 * u * t * t * b[2][0] + t * t * t * b[3][0];
  const y = u * u * u * b[0][1] + 3 * u * u * t * b[1][1] + 3 * u * t * t * b[2][1] + t * t * t * b[3][1];
  return [x, y];
}
