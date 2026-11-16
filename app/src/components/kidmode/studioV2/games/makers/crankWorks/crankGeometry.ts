import {
  CAM, LINKAGE, WAVE_LINK, WAVE_RODS, camAngle, camCentre, camLift, crankPin, pistonLift, waveAngle, waveLift,
  type Anchor, type Chapter, type Point, type Step,
} from './crankWorksRules';

/* Where everything stands. Pure: no canvas, no DOM.
 *
 * World units are the pixels of the TrailBench picture at half its stored
 * size (790 by 542): the bench never moves, and the machine is built on its
 * deck in the bench's own view (seen from the front, a little from above, so
 * a thing further back sits a little higher in the picture). A machine is
 * drawn in the linkage's own units, `UNIT` world units each, about its shaft. */
export const BENCH = { w: 790, h: 542 } as const;
export const UNIT = 0.74;
/** Where the machines' feet meet the pale-wood board. */
export const GROUND = 221;
/** The three shafts. */
export const S1: Point = { x: 236, y: GROUND - 84 * UNIT };
export const S2: Point = { x: 342, y: GROUND - 44 * UNIT };
export const S3: Point = { x: 392, y: GROUND - 30 * UNIT };
export const ROD_GAP = 24;
/** The brass flywheel stands a little in front of its housing. */
export const WHEEL = { x: S1.x, y: S1.y + 3, r: 73 * UNIT, grip: 56 * UNIT, grab: 73 * UNIT + 20 } as const;
/** The board the machine is built on (a plank lying on the deck), and the parts crate at its end. */
export const BOARD = { backL: 172, backR: 624, frontL: 136, frontR: 654, back: 199, front: 239, thick: 8 } as const;
export const CRATE = { x: 548, y: 197, w: 82, h: 29 } as const;
export type PartKind = 'flowerPart' | 'beadsPart' | 'bellPart';
export const PART_KINDS: readonly PartKind[] = ['flowerPart', 'beadsPart', 'bellPart'];
/** Where each part waits in the crate, and where it belongs on the machine. */
export const CRATE_SLOT: Readonly<Record<PartKind, Point>> = {
  flowerPart: { x: CRATE.x + 15, y: CRATE.y - 4 }, beadsPart: { x: CRATE.x + 41, y: CRATE.y - 3 }, bellPart: { x: CRATE.x + 66, y: CRATE.y - 6 },
};
/** The top of the flower's stem when the cam is at its lowest. */
export const STEM = 62;
export const stemTop = (theta: number): Point => ({ x: S2.x, y: S2.y - (camLift(camAngle(theta)) + STEM) * UNIT });
export const ROD_RISE = 26;
export const rodX = (i: number) => S3.x + i * ROD_GAP * UNIT;
export const beadAt = (i: number, theta: number): Point => ({ x: rodX(i), y: S3.y - (waveLift(i, theta) + ROD_RISE + 7) * UNIT });
/** The bell hangs over the last bead rod: the bead taps its lip at the top of its stroke. */
export const BELL: Point = { x: rodX(WAVE_RODS - 1) + 5 * UNIT, y: S3.y - (WAVE_LINK.l + WAVE_LINK.r + ROD_RISE + 42) * UNIT };
export const SOCKET: Readonly<Record<PartKind, Point>> = {
  flowerPart: { x: S2.x, y: S2.y - (CAM.R - CAM.e + STEM + 12) * UNIT },
  beadsPart: { x: (rodX(0) + rodX(WAVE_RODS - 1)) / 2, y: S3.y - (WAVE_LINK.l + ROD_RISE + 10) * UNIT },
  bellPart: { x: BELL.x + 4, y: BELL.y + 10 },
};
/** How near a dropped part must be to its place to go home (world units). */
export const SOCKET_REACH = 64;
/** The ProofLens puck and the PulsePod, in the bench's own trays. */
export const PUCK: Point = { x: 152, y: 252 };
export const POD: Point = { x: 339, y: 266 };
/** Chock stands on the floor at the bench's far end, looking along the machine. */
export const CHOCK = { x: 646, y: 92, w: 392, h: 307 } as const;

/** The big crank's pin and wrist pin, in world units. */
export const pinAt = (theta: number): Point => { const p = crankPin(theta); return { x: S1.x + p.x * UNIT, y: S1.y + p.y * UNIT }; };
export const wristAt = (theta: number): Point => ({ x: S1.x, y: S1.y - pistonLift(theta) * UNIT });
/** The brass knob on top of the piston's rod: all the outside shows of the stroke. */
export const KNOB_RISE = 92;
export const knobAt = (theta: number): Point => ({ x: S1.x, y: S1.y - (pistonLift(theta) + KNOB_RISE) * UNIT });
/** The wooden handle on the flywheel: it goes round with the crank pin. */
export const handleAt = (theta: number): Point => ({ x: WHEEL.x + WHEEL.grip * Math.sin(theta), y: WHEEL.y - WHEEL.grip * Math.cos(theta) });

/** Where the lens finds each hidden part right now (world units). */
export function anchorsAt(theta: number, built: { flower: boolean; beads: boolean }): Anchor[] {
  const pin = pinAt(theta), wrist = wristAt(theta), cam = camCentre(camAngle(theta));
  const out: Anchor[] = [
    { part: 'crankArm', x: (S1.x + pin.x) / 2, y: (S1.y + pin.y) / 2 + 4 },
    { part: 'rodBar', x: (pin.x + wrist.x) / 2, y: (pin.y + wrist.y) / 2 },
    { part: 'pistonHead', x: wrist.x, y: wrist.y - 6 },
  ];
  if (built.flower) out.push({ part: 'camDisc', x: S2.x + cam.x * UNIT, y: S2.y + cam.y * UNIT + 5 }, { part: 'follower', x: S2.x, y: S2.y - (camLift(camAngle(theta)) + 20) * UNIT });
  if (built.beads) for (let i = 0; i < WAVE_RODS; i++) { const p = crankPin(waveAngle(i, theta), WAVE_LINK); out.push({ part: 'smallCranks', x: rodX(i) + p.x * UNIT * 0.5, y: S3.y + p.y * UNIT * 0.5 }); }
  return out;
}
/** The joint AnchorCheck tests: the rod's big end, on the crank pin. */
export const jointAt = pinAt;
export const ROD_LENGTH = LINKAGE.l * UNIT;

/* ------------------------------------------------------------ the camera */
export interface View { readonly s: number; readonly ox: number; readonly oy: number }
export interface Rect { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }
export type Shot = 'wideShot' | 'pistonShot' | 'flowerShot' | 'waveShot' | 'buildShot' | 'bellShot';
export const SHOTS: Readonly<Record<Shot, Rect>> = {
  wideShot: { x0: 60, y0: -30, x1: 840, y1: 552 },
  pistonShot: { x0: 146, y0: -14, x1: 326, y1: 262 },
  flowerShot: { x0: 164, y0: -14, x1: 388, y1: 262 },
  waveShot: { x0: 164, y0: -14, x1: 524, y1: 262 },
  buildShot: { x0: 160, y0: -14, x1: 716, y1: 262 },
  bellShot: { x0: 330, y0: 30, x1: 720, y1: 262 },
};
/** A wide stage has room for the whole machine at full size, so it never needs to cut closer. */
export function shotFor(chapter: Chapter, step: Step, wideStage = false): Shot {
  if (wideStage || step === 'pickUp' || step === 'bigShow') return 'buildShot';
  return chapter === 'pistonCh' ? 'pistonShot' : chapter === 'flowerCh' ? 'flowerShot' : 'waveShot';
}
/** The view that shows a rectangle of the world as large as the stage allows,
 * clear of the HUD (coach above, dock below). Where the stage is taller than
 * the rectangle needs, most of the spare room goes above it (the pavilion's
 * arches) and the rest below (the bench's own body and wheels). `lift` keeps
 * that much of the stage's height clear at the bottom (the opening's title). */
export function frameView(rect: Rect, w: number, h: number, lift = 0, maxScale = 2.2): View {
  // On a wide stage the coach and the quest sit in the corners, clear of the machine: it may rise between them.
  const top = w > h * 1.15 ? Math.min(60, h * 0.1) : Math.min(104, h * 0.26), bottom = Math.max(Math.min(104, h * 0.24), h * lift), side = Math.min(28, w * 0.05);
  const rw = rect.x1 - rect.x0, rh = rect.y1 - rect.y0;
  const s = Math.max(0.3, Math.min(maxScale, (w - side * 2) / rw, (h - top - bottom) / rh));
  const spare = Math.max(0, h - top - bottom - rh * s);
  return { s, ox: w / 2 - (rect.x0 + rect.x1) / 2 * s, oy: h - bottom - spare * 0.3 - rect.y1 * s };
}
/** The pavilion behind: its floor's far edge stays level with the bench's deck,
 * and it is always large enough to fill the stage (never smaller than the
 * room would be in a wide view, so a close-up does not shrink the arches). */
export const HORIZON = 214;
const ROOM_FLOOR = 0.69, ROOM_MIN = 1150, ROOM_X = 395;
export function roomRect(view: View, w: number, h: number): { x: number; y: number; size: number } {
  const top = -view.oy / view.s, left = -view.ox / view.s, right = (w - view.ox) / view.s;
  // The floor below the picture's lower edge is drawn on by the painter, so only the top and sides set the size.
  const size = Math.max(ROOM_MIN, (HORIZON - top) / ROOM_FLOOR, (ROOM_X - left) * 2, (right - ROOM_X) * 2) * 1.02;
  return { x: ROOM_X - size / 2, y: HORIZON - size * ROOM_FLOOR, size };
}
export const toWorld = (view: View, x: number, y: number): Point => ({ x: (x - view.ox) / view.s, y: (y - view.oy) / view.s });
export const toScreen = (view: View, p: Point): Point => ({ x: p.x * view.s + view.ox, y: p.y * view.s + view.oy });
/** Ease one view toward another (k = 1 is a cut). */
export function easeView(from: View, to: View, k: number): View {
  if (k >= 1) return to;
  // Scale eases in its logarithm, so a pull-back and a push-in feel alike.
  const s = from.s * Math.pow(to.s / from.s, k);
  return { s, ox: from.ox + (to.ox - from.ox) * k, oy: from.oy + (to.oy - from.oy) * k };
}

/* ---------------------------------------------------------------- touch */
export type Hit = 'wheelHit' | 'puckHit' | 'podHit' | 'chockHit' | 'knobHit' | 'bloomHit' | 'bellHit' | PartKind | null;
/** What a finger at a world point is on. The wheel wins near its rim. */
export function hitAt(p: Point, theta: number, waiting: readonly PartKind[], built: { flower: boolean; bell: boolean }): Hit {
  const near = (q: Point, r: number) => Math.hypot(p.x - q.x, p.y - q.y) <= r;
  for (const kind of waiting) if (near(CRATE_SLOT[kind], 20)) return kind;
  if (near(WHEEL, WHEEL.grab)) return 'wheelHit';
  if (near(knobAt(theta), 16)) return 'knobHit';
  if (built.flower && near({ x: stemTop(theta).x, y: stemTop(theta).y - 12 }, 22)) return 'bloomHit';
  if (built.bell && near({ x: BELL.x, y: BELL.y + 12 }, 18)) return 'bellHit';
  if (near(PUCK, 30)) return 'puckHit';
  if (near(POD, 24)) return 'podHit';
  if (p.x > CHOCK.x + 6 && p.x < CHOCK.x + 170 && p.y > CHOCK.y && p.y < CHOCK.y + 150) return 'chockHit';
  return null;
}
