/** Stitch Garden's small visitors, worked in thread like the flowers: a bee
 * (linen), a firefly (indigo), a butterfly (sage) and the ladybird that
 * walks the hoop. Each is a few layers of stitches in its own little frame:
 * origin at its middle, head towards +x, about sixteen units long. The wings
 * are a layer of their own so they can beat. Pure data, no randomness. */
import type { Stitch, StitchPart, StitchTone } from './stitchGardenStitches';

export type VisitorKind = 'honeyBee' | 'fireFly' | 'butterFly';
export type CritterKind = VisitorKind | 'ladyBird';
/** One run of stitches in one thread (the index into the five threads). */
export interface CritterLayer { thread: number; stitches: Stitch[] }
export interface Critter { body: CritterLayer[]; wings: CritterLayer[]; legs: CritterLayer[]; lamp: { x: number; y: number; r: number } | null }

const run = (x1: number, y1: number, x2: number, y2: number, w: number, tone: StitchTone, part: StitchPart = 'petal', cx?: number, cy?: number): Stitch =>
  cx === undefined || cy === undefined ? { x1, y1, x2, y2, w, tone, part } : { x1, y1, x2, y2, cx, cy, w, tone, part };
const knot = (x: number, y: number, d: number, tone: StitchTone): Stitch => ({ x1: x, y1: y, x2: x, y2: y, w: d, tone, part: 'centre', knot: true });
/** Satin strokes laid across an oval, one for each x given. */
const oval = (cx: number, cy: number, rx: number, ry: number, xs: readonly number[], w: number, tone: (x: number, i: number) => StitchTone): Stitch[] =>
  xs.map((x, i) => { const h = ry * Math.sqrt(Math.max(0.05, 1 - (x / rx) * (x / rx))); return run(cx + x - 0.5, cy - h, cx + x + 0.5, cy + h, w, tone(x, i)); });
/** A loop of thread out from a point and back, as a wing. */
const loop = (x: number, y: number, tx: number, ty: number, bulge: number, w: number, tone: StitchTone): Stitch[] => {
  const mx = (x + tx) / 2, my = (y + ty) / 2, len = Math.hypot(tx - x, ty - y) || 1, nx = -(ty - y) / len, ny = (tx - x) / len;
  return [run(x, y, tx, ty, w, tone, 'petal', mx + nx * bulge, my + ny * bulge), run(tx, ty, x, y, w, tone, 'petal', mx - nx * bulge, my - ny * bulge), run(x, y, tx - (tx - x) * 0.18, ty - (ty - y) * 0.18, w * 1.5, tone)];
};

const AMBER = 1, PINK = 2, CORAL = 0, WHITE = 4;

function honeyBee(): Critter {
  const stripes = new Set([1, 3, 5]);
  return {
    wings: [{ thread: WHITE, stitches: [...loop(-0.5, -3, -6, -13.5, 3, 1.3, 'thread'), ...loop(1.5, -3.2, 5.5, -13, 2.8, 1.3, 'thread')] }],
    body: [
      { thread: AMBER, stitches: [run(-7.6, 1, -10.4, 1.6, 1, 'ink'), ...oval(0, 1, 8, 5.3, [-6.4, -4.3, -2.2, -0.1, 2, 4.1, 6.1], 2.5, (_, i) => (stripes.has(i) ? 'ink' : 'thread')),
        run(10, -2.2, 12.2, -5.8, 0.65, 'ink'), run(10.6, -1.4, 13.6, -3.6, 0.65, 'ink'), knot(8.6, 0.6, 5.2, 'ink')] },
      { thread: WHITE, stitches: [knot(9.7, -0.4, 1.4, 'thread')] },
    ],
    legs: [], lamp: null,
  };
}

function fireFly(): Critter {
  return {
    wings: [{ thread: WHITE, stitches: [...loop(-0.5, -2.4, -6, -11, 2.4, 1.1, 'thread'), ...loop(1, -2.6, 4.5, -11, 2.2, 1.1, 'thread')] }],
    body: [
      { thread: AMBER, stitches: [...oval(0.5, 1, 6.6, 3.9, [-3.2, -1.1, 1, 3.1, 5], 2.4, () => 'umber'), run(8.4, -1.8, 10.6, -5, 0.6, 'ink'), run(9, -1, 12, -2.8, 0.6, 'ink'), knot(7.6, 0.6, 4.4, 'ink'),
        knot(-5.6, 1.2, 5.4, 'sun'), knot(-7.4, 1.4, 3.2, 'sun')] },
      { thread: WHITE, stitches: [knot(8.5, -0.2, 1.2, 'thread')] },
    ],
    legs: [], lamp: { x: -6.2, y: 1.3, r: 12 },
  };
}

function butterFly(): Critter {
  const ray = (x: number, side: number, deg: number, r: number, w: number, tone: StitchTone) => { const t = deg * Math.PI / 180; return run(x, side * 1.2, x + Math.cos(t) * r, side * (1.2 + Math.sin(t) * r), w, tone); };
  const wing = (side: number): Stitch[] => [
    ray(-1.5, side, 172, 6.5, 2.4, 'threadDeep'), ray(-1.5, side, 150, 8.6, 2.6, 'thread'), ray(-1.5, side, 126, 9, 2.6, 'threadDeep'),
    ray(1.5, side, 108, 10, 2.8, 'threadDeep'), ray(1.5, side, 84, 12, 3, 'thread'), ray(1.5, side, 60, 12, 3, 'thread'), ray(1.5, side, 36, 10.4, 2.8, 'threadDeep'),
  ];
  return {
    wings: [{ thread: PINK, stitches: [...wing(-1), ...wing(1)] }, { thread: WHITE, stitches: [knot(5.2, -8.6, 1.9, 'thread'), knot(5.2, 8.6, 1.9, 'thread'), knot(-6, -5.4, 1.5, 'thread'), knot(-6, 5.4, 1.5, 'thread')] }],
    body: [{ thread: AMBER, stitches: [run(-6.5, 0, -1, 0, 1.9, 'ink', 'stem'), run(-2, 0, 4, 0, 2.1, 'ink', 'stem'), run(5.6, -0.6, 9.8, -3.6, 0.6, 'ink'), run(5.6, 0.6, 9.8, 3.6, 0.6, 'ink'), knot(5.2, 0, 3, 'ink')] }],
    legs: [], lamp: null,
  };
}

function ladyBird(): Critter {
  return {
    legs: [{ thread: CORAL, stitches: [-3.4, -0.2, 3].flatMap(x => [run(x, -4, x + 1.2, -6.8, 0.75, 'ink'), run(x, 4, x + 1.2, 6.8, 0.75, 'ink')]) }],
    wings: [],
    body: [
      { thread: CORAL, stitches: [...oval(-0.6, 0, 5.8, 4.9, [-4.6, -3, -1.4, 0.2, 1.8, 3.4, 4.8], 2, () => 'thread'), run(-6, 0, 4.4, 0, 0.6, 'ink'),
        knot(-2.6, -2.3, 2, 'ink'), knot(-2.6, 2.3, 2, 'ink'), knot(1.4, -2.7, 1.8, 'ink'), knot(1.4, 2.7, 1.8, 'ink'), knot(-4.4, 0, 1.5, 'ink'), knot(6, 0, 4.6, 'ink')] },
      { thread: WHITE, stitches: [knot(7, -1.3, 1.1, 'thread'), knot(7, 1.3, 1.1, 'thread')] },
    ],
    lamp: null,
  };
}

const MAKE: Record<CritterKind, () => Critter> = { honeyBee, fireFly, butterFly, ladyBird };
const made = new Map<CritterKind, Critter>();
/** The stitches of one visitor (worked once, then kept). */
export function critterStitches(kind: CritterKind): Critter {
  let c = made.get(kind);
  if (!c) { c = MAKE[kind](); made.set(kind, c); }
  return c;
}
