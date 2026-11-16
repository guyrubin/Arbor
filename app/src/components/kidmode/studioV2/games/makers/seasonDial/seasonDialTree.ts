import type { LeafSeed } from './seasonDialRules';

/** The old leaning apple tree, grown once from a fixed seed: the same tree all
 * year. Only what hangs on it (buds, blossom, leaves, apples, snow) changes,
 * and that is the rules' business. Pure data, in scene units (400 by 320,
 * light from the top left). */

/** A small, fixed pseudo-random sequence (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Segment { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; readonly w1: number; readonly w2: number; readonly depth: number }
export interface Leaf { readonly x: number; readonly y: number; readonly angle: number; readonly length: number; readonly shade: number; readonly seed: LeafSeed }
export interface Spot { readonly x: number; readonly y: number; readonly r: number; readonly seed: number; readonly shade: number }
/** A spray of leaves at a twig end. `spray` is one path of several leaves
 * fanned about the twig, in the clump's own units (0,0 at the twig, reaching
 * about `r`): the crown is made of leaves all the way down, not of blobs. */
export interface Clump { readonly x: number; readonly y: number; readonly r: number; readonly shade: number; readonly seed: LeafSeed; readonly spray: string }
export interface Tree {
  readonly segments: readonly Segment[];
  /** The bark, by stroke width (widest first). */
  readonly strokes: readonly { readonly width: number; readonly bark: string; readonly lit: string; readonly shade: string }[];
  readonly grain: string; readonly roots: string;
  readonly capsThick: string; readonly capsThin: string;
  readonly leaves: readonly Leaf[]; readonly clumps: readonly Clump[];
  readonly blossoms: readonly Spot[]; readonly buds: readonly Spot[]; readonly apples: readonly Spot[];
  /** The branch the birds sit on: a point and the branch's slope there. */
  readonly perch: { readonly x: number; readonly y: number; readonly angle: number };
  readonly base: { readonly x: number; readonly y: number };
  readonly crown: { readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number };
}

const r1 = (v: number) => Math.round(v * 10) / 10;
/** One apple leaf as a closed path: from its stalk at (x, y) out along
 * `angle` (radians), `length` long: broad below the middle, a drawn-out tip. */
export function leafShape(x: number, y: number, angle: number, length: number, width: number): string {
  const c = Math.cos(angle), s = Math.sin(angle);
  const at = (along: number, across: number) => `${r1(x + c * along * length - s * across * width)} ${r1(y + s * along * length + c * across * width)}`;
  return `M${at(0, 0)}C${at(0.12, 0.62)} ${at(0.62, 0.6)} ${at(1, 0)}C${at(0.6, -0.5)} ${at(0.14, -0.58)} ${at(0, 0)}Z`;
}
const LIGHT = { x: -0.7071, y: -0.7071 };

function grow(): Tree {
  const rand = seeded(1871);
  const segments: Segment[] = [];
  const twigs: { x: number; y: number; angle: number }[] = [];
  const base = { x: 252, y: 258 };

  /** A limb drawn as a few gnarled sub-segments, then split. Angles in
   * degrees, -90 straight up. */
  const limb = (x: number, y: number, angle: number, length: number, width: number, depth: number, maxDepth: number) => {
    const parts = depth < 2 ? 4 : 3;
    let a = angle, cx = x, cy = y, w = width;
    const end = width * (depth >= maxDepth ? 0.35 : 0.68);
    for (let i = 0; i < parts; i++) {
      a += (rand() - 0.5) * (depth < 1 ? 14 : 24);
      // Apple limbs spread rather than climb: the outer ones ease toward the level.
      if (depth >= 2) a += (a < -90 ? -1 : 1) * 4;
      const step = length / parts;
      const nx = cx + Math.cos((a * Math.PI) / 180) * step, ny = cy + Math.sin((a * Math.PI) / 180) * step;
      const nw = width + (end - width) * ((i + 1) / parts);
      segments.push({ x1: cx, y1: cy, x2: nx, y2: ny, w1: w, w2: nw, depth });
      if (depth >= maxDepth - 1 && i >= parts - 2) twigs.push({ x: nx, y: ny, angle: a });
      cx = nx; cy = ny; w = nw;
    }
    if (depth >= maxDepth) { twigs.push({ x: cx, y: cy, angle: a }); return; }
    const spread = 22 + rand() * 16;
    const kids = depth >= 1 && rand() < 0.35 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const side = kids === 2 ? (k === 0 ? -1 : 1) : k - 1;
      const childAngle = a + side * spread + (rand() - 0.5) * 10;
      limb(cx, cy, childAngle, length * (0.66 + rand() * 0.14), w * (kids === 3 && side === 0 ? 0.62 : 0.74), depth + 1, maxDepth);
    }
  };

  // The trunk: thick and low, leaning to the left from its foot, with a bend.
  const trunk = [
    { x: base.x, y: base.y, w: 34 }, { x: base.x - 5, y: base.y - 20, w: 27 }, { x: base.x - 14, y: base.y - 42, w: 24 },
    { x: base.x - 22, y: base.y - 62, w: 22 }, { x: base.x - 26, y: base.y - 80, w: 20 },
  ];
  for (let i = 0; i < trunk.length - 1; i++) {
    const p = trunk[i], q = trunk[i + 1];
    for (let k = 0; k < 3; k++) {
      const t0 = k / 3, t1 = (k + 1) / 3;
      segments.push({ x1: p.x + (q.x - p.x) * t0, y1: p.y + (q.y - p.y) * t0, x2: p.x + (q.x - p.x) * t1, y2: p.y + (q.y - p.y) * t1, w1: p.w + (q.w - p.w) * t0, w2: p.w + (q.w - p.w) * t1, depth: 0 });
    }
  }
  const fork = trunk[trunk.length - 1];
  // The forked crown: two great limbs and a small third between them.
  const leftLimb = segments.length;
  limb(fork.x + 2, fork.y + 2, -140, 58, 17, 1, 4);
  limb(fork.x + 4, fork.y, -52, 52, 15, 1, 4);
  limb(fork.x + 2, fork.y - 4, -94, 40, 9, 2, 4);
  // A low limb reaching out over the meadow, where the birds sit.
  const lowStart = segments.length;
  limb(base.x - 13, base.y - 50, -166, 54, 10, 2, 4);

  // Paths, grouped by width: each segment a round-capped stroke, so a limb
  // reads as one smooth tapering piece of paper. Lit and shaded edges ride
  // inside it, toward and away from the top-left light.
  const strokes = new Map<number, { bark: string[]; lit: string[]; shade: string[] }>();
  const capsThick: string[] = [], capsThin: string[] = [];
  for (const s of segments) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if (nx * LIGHT.x + ny * LIGHT.y < 0) { nx = -nx; ny = -ny; }
    const w = Math.max(1.2, Math.round(((s.w1 + s.w2) / 2) * 2) / 2);
    const group = strokes.get(w) ?? { bark: [], lit: [], shade: [] };
    strokes.set(w, group);
    const line = (k: number) => `M${r1(s.x1 + nx * w * k)} ${r1(s.y1 + ny * w * k)}L${r1(s.x2 + nx * w * k)} ${r1(s.y2 + ny * w * k)}`;
    group.bark.push(line(0)); group.lit.push(line(0.24)); group.shade.push(line(-0.27));
    // Snow settles on the upper side of limbs that are not too steep.
    const slope = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
    const level = Math.min(slope, 180 - slope);
    if (level < 50 && s.depth > 0) {
      let ux = -dy / len, uy = dx / len;
      if (uy > 0) { ux = -ux; uy = -uy; }
      const cap = `M${r1(s.x1 + ux * s.w1 * 0.45)} ${r1(s.y1 + uy * s.w1 * 0.45)}L${r1(s.x2 + ux * s.w2 * 0.45)} ${r1(s.y2 + uy * s.w2 * 0.45)}`;
      (s.w1 > 6 ? capsThick : capsThin).push(cap);
    }
  }
  const barkStrokes = [...strokes.entries()].sort((a, b) => b[0] - a[0]).map(([width, g]) => ({ width, bark: g.bark.join(''), lit: g.lit.join(''), shade: g.shade.join('') }));
  // Bark grain: long darker lines up the trunk, following its bend.
  const grain: string[] = [];
  for (const off of [-0.3, -0.08, 0.14, 0.32]) {
    const pts = trunk.map((p, i) => {
      const q = trunk[Math.min(trunk.length - 1, i + 1)], o = trunk[Math.max(0, i - 1)];
      const dx = q.x - o.x, dy = q.y - o.y, len = Math.hypot(dx, dy) || 1;
      return `${r1(p.x - (dy / len) * p.w * off)} ${r1(p.y + (dx / len) * p.w * off - (i === 0 ? -2 : 0))}`;
    });
    grain.push(`M${pts.slice(0, 4 + (off > 0 ? 1 : 0)).join('L')}`);
  }
  // Roots flaring into the knoll.
  const roots = `M${base.x - 30} ${base.y + 5}C${base.x - 20} ${base.y + 1} ${base.x - 15} ${base.y - 8} ${base.x - 13} ${base.y - 16}L${base.x + 12} ${base.y - 14}C${base.x + 14} ${base.y - 4} ${base.x + 24} ${base.y + 2} ${base.x + 34} ${base.y + 5}C${base.x + 12} ${base.y + 8} ${base.x - 10} ${base.y + 8} ${base.x - 30} ${base.y + 5}Z`;

  // The crown's extent, from the twig ends.
  const xs = twigs.map(t => t.x), ys = twigs.map(t => t.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const crown = { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: (maxX - minX) / 2 + 14, ry: (maxY - minY) / 2 + 14 };
  const shadeAt = (x: number, y: number) => Math.min(1, Math.max(0, 0.5 + 0.32 * (x - crown.cx) / crown.rx + 0.42 * (y - crown.cy) / crown.ry));
  const seedAt = (x: number, y: number): LeafSeed => {
    const ny = Math.min(1, Math.max(0, (y - minY) / (maxY - minY || 1)));
    const nx = Math.min(1, Math.max(0, (x - minX) / (maxX - minX || 1)));
    const nd = Math.min(1, Math.hypot((x - crown.cx) / crown.rx, (y - crown.cy) / crown.ry));
    const c = (v: number) => Math.min(0.999, Math.max(0, v));
    return {
      grow: c(0.45 * (1 - nd) + 0.55 * rand()),
      // The top of the crown turns first …
      turn: c(0.55 * ny + 0.45 * rand()),
      // … and the outer, windward (left) leaves let go first.
      fall: c(0.42 * (1 - nd) + 0.22 * nx + 0.36 * rand()),
      hue: rand(),
    };
  };

  // 180 leaves, spread over the twig ends and a little along them.
  const leaves: Leaf[] = [];
  for (let i = 0; i < 180; i++) {
    const t = twigs[(i * 5) % twigs.length];
    const back = rand() * 12, spread = (rand() - 0.5) * 22;
    const ta = (t.angle * Math.PI) / 180;
    const x = t.x - Math.cos(ta) * back + Math.cos(ta + Math.PI / 2) * spread * 0.6 + (rand() - 0.5) * 6;
    const y = t.y - Math.sin(ta) * back + Math.sin(ta + Math.PI / 2) * spread * 0.6 + (rand() - 0.5) * 6;
    // Leaves point outward and droop a little.
    let angle = t.angle + (rand() - 0.5) * 110;
    angle = angle + (90 - ((angle % 360) + 360) % 360 > 0 ? 8 : -8);
    leaves.push({ x: r1(x), y: r1(y), angle: Math.round(angle), length: r1(12 + rand() * 6), shade: r1(shadeAt(x, y)), seed: seedAt(x, y) });
  }
  // Spread the thresholds evenly over their windows (by rank), so the change
  // always sweeps the whole crown and never bunches into one flip.
  const rank = (key: 'turn' | 'fall') => {
    const out: number[] = [];
    leaves.map((l, i) => [l.seed[key], i] as const).sort((a, b) => a[0] - b[0]).forEach(([, i], r) => { out[i] = (r + 0.5) / leaves.length; });
    return out;
  };
  const turnRank = rank('turn'), fallRank = rank('fall');
  const ranked: Leaf[] = leaves.map((l, i) => ({ ...l, seed: { ...l.seed, turn: turnRank[i], fall: fallRank[i] } }));
  // The crown is leaves all the way down: at every twig end, and along the
  // outer limbs between them, a leafy shoot (a short stem with its leaves set
  // alternately, a last one at the tip), so the crown's edge is leaf tips and
  // its inside is full. Their own sequence, so the blossom and the apples
  // stay where they always were.
  const clumps: Clump[] = [];
  const fan = seeded(733);
  const shoot = (r: number, toward: number): string => {
    const count = 5 + Math.floor(fan() * 3), length = r * (1.25 + fan() * 0.5), bend = (fan() - 0.5) * 0.5;
    let d = '', x = 0, y = 0, a = toward;
    for (let k = 0; k < count; k++) {
      const along = (k + 0.4) / count;
      a = toward + bend * along;
      x = Math.cos(a) * length * along; y = Math.sin(a) * length * along;
      const side = k % 2 ? 1 : -1, last = k === count - 1;
      const leafLength = r * (0.9 - 0.25 * along + fan() * 0.2);
      d += leafShape(x, y, last ? a : a + side * (1.05 - 0.45 * along + (fan() - 0.5) * 0.3), leafLength, leafLength * (0.5 + fan() * 0.1));
    }
    return d;
  };
  const addClump = (cx: number, cy: number, toward: number, size: number) => {
    const x = cx + (rand() - 0.5) * 8, y = cy + 3 + (rand() - 0.5) * 8;
    const r = size * (10 + rand() * 6);
    clumps.push({ x: r1(x), y: r1(y), r: r1(r), shade: r1(shadeAt(x, y)), seed: seedAt(x, y), spray: shoot(r, toward) + shoot(r * 0.85, toward + (fan() < 0.5 ? 1 : -1) * (1.5 + fan() * 0.8)) });
  };
  for (const t of twigs) addClump(t.x, t.y, (t.angle * Math.PI) / 180 + (fan() - 0.5) * 0.5, 1);
  // Side shoots along the outer limbs: they fill the crown between the twig ends.
  let side = 0;
  for (const s of segments) {
    if (s.depth < 3 || side++ % 2) continue;
    const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    addClump((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2 - 3, a + (fan() < 0.5 ? 1 : -1) * (0.9 + fan() * 0.7), 0.92);
  }
  const spots = (count: number, jitter: number, rMin: number, rMax: number): Spot[] => Array.from({ length: count }, (_, i) => {
    const t = twigs[(i * 7 + 3) % twigs.length];
    const x = t.x + (rand() - 0.5) * jitter, y = t.y + (rand() - 0.5) * jitter;
    return { x: r1(x), y: r1(y), r: r1(rMin + rand() * (rMax - rMin)), seed: rand(), shade: r1(shadeAt(x, y)) };
  });
  const blossoms = spots(84, 20, 4.4, 6.4);
  const buds = spots(70, 12, 1.3, 2);
  // Apples hang under the middle of the crown, where a child would reach.
  const low = twigs.filter(t => t.y > crown.cy - 24).sort((a, b) => a.x - b.x);
  const apples: Spot[] = Array.from({ length: 9 }, (_, i) => low[Math.floor(((i + 0.5) / 9) * low.length)])
    .map(t => ({ x: r1(t.x + (rand() - 0.5) * 6), y: r1(t.y + 5 + rand() * 4), r: r1(4.8 + rand() * 1.6), seed: rand(), shade: r1(shadeAt(t.x, t.y)) }));

  // The low limb (the last one grown) carries the birds.
  const perchOn = segments[leftLimb + 3] ?? segments[lowStart + 2];
  const perch = { x: r1((perchOn.x1 + perchOn.x2) / 2), y: r1((perchOn.y1 + perchOn.y2) / 2 - perchOn.w1 / 2), angle: Math.round(Math.atan2(perchOn.y2 - perchOn.y1, perchOn.x2 - perchOn.x1) * 180 / Math.PI) };

  return {
    segments, strokes: barkStrokes, grain: grain.join(''), roots,
    capsThick: capsThick.join(''), capsThin: capsThin.join(''), leaves: ranked, clumps, blossoms, buds, apples, perch, base, crown,
  };
}

export const TREE: Tree = grow();
