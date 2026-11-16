/** Stitch Garden, the Game Cut: the round's plan, the sewing passes, what
 * each spot of the planted row asks for, and where everything lies on the
 * table. Pure: a seed and a stage size in, plain data out, so a round can be
 * pinned in a test and replayed. Nothing here is saved or reported. */
import { TEXTILE_CLOTHS, TEXTILE_COLUMNS, TEXTILE_FLOWERS, TEXTILE_ROWS, TEXTILE_THREADS, type TextileCloth, type TextileFlower, type TextileMotif } from './stitchGardenRules';
import { ART_H, ART_W, CLOTH_R, HOOP_CX, HOOP_CY, type Stitch } from './stitchGardenStitches';

/* ── the three chapters ─────────────────────────────────────────────────── */

export const CHAPTERS = ['firstFlower', 'plantedRow', 'freeBorder'] as const;
export type ChapterId = typeof CHAPTERS[number];
/** What Aya's LeafLab reads at a spot of the planted row: window light, a damp patch, the fern's shade. */
export const WANTS = ['sunSpot', 'dewSpot', 'fernShade'] as const;
export type Want = typeof WANTS[number];
/** What each flower is happiest with. Any flower grows anywhere; a match only adds a flourish. */
export const FLOWER_LIKES: Readonly<Record<TextileFlower, Want>> = { daisy: 'sunSpot', sunflower: 'sunSpot', tulip: 'dewSpot', poppy: 'dewSpot', bluebell: 'fernShade' };
export interface RowSpot { cell: number; want: Want }
export interface RoundPlan {
  seed: number;
  cloth: TextileCloth;
  /** The packet and the spool that lie ready when the table is first seen. */
  flower: TextileFlower;
  thread: number;
  /** Chapter one: the one spot in the middle of the cloth. */
  firstCell: number;
  /** Chapter two: three spots in one row, each with what the LeafLab reads there. */
  row: readonly RowSpot[];
  /** How the five packets and the cloth pile are turned on the table, in degrees. */
  packetTurns: readonly number[];
  /** Which corner the fern stands at: 1 the far (top) corner, -1 the near one. */
  fernSide: 1 | -1;
}

function mulberry(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = <T,>(random: () => number, list: readonly T[]): T[] => {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

/** One round, from its seed and how many times the hoop has been taken up
 * this visit (so the cloth, the first flower and the thread come round in
 * turn while the layout is drawn from the seed). */
export function planRound(seed: number, sitting = 0): RoundPlan {
  const random = mulberry(seed);
  const turn = Math.max(0, Math.floor(sitting));
  const firstCell = random() < 0.5 ? 5 : 6;
  // The planted row is the top or the bottom row: three of its four spots, in grid order.
  const rowIndex = random() < 0.5 ? 0 : TEXTILE_ROWS - 1;
  const skip = Math.floor(random() * TEXTILE_COLUMNS);
  const cells = Array.from({ length: TEXTILE_COLUMNS }, (_, column) => rowIndex * TEXTILE_COLUMNS + column).filter((_, column) => column !== skip);
  const wants = shuffle(random, WANTS);
  return {
    seed, firstCell,
    cloth: TEXTILE_CLOTHS[turn % TEXTILE_CLOTHS.length],
    flower: TEXTILE_FLOWERS[(turn * 2 + Math.floor(random() * TEXTILE_FLOWERS.length)) % TEXTILE_FLOWERS.length],
    thread: (turn * 3 + Math.floor(random() * TEXTILE_THREADS)) % TEXTILE_THREADS,
    row: cells.map((cell, i) => ({ cell, want: wants[i] })),
    packetTurns: Array.from({ length: TEXTILE_FLOWERS.length + 1 }, () => Math.round((random() * 2 - 1) * 7)),
    fernSide: random() < 0.5 ? 1 : -1,
  };
}

/** Where a flower may go now. Chapter one: its one spot. Chapter two: the row
 * spots still empty. Chapter three: anywhere free. */
export function openCells(plan: RoundPlan, chapter: number, free: readonly number[]): number[] {
  if (chapter <= 0) return free.includes(plan.firstCell) ? [plan.firstCell] : free.slice(0, 1);
  if (chapter === 1) { const row = plan.row.map(s => s.cell).filter(cell => free.includes(cell)); return row.length ? row : free.slice(); }
  return free.slice();
}
/** The chapter the garden has reached: it only ever moves on (unpicking a flower does not send the child back). */
export function chapterAfter(plan: RoundPlan, chapter: number, motifs: readonly TextileMotif[]): number {
  const used = new Set(motifs.map(m => m.cell));
  let next = Math.max(0, Math.min(CHAPTERS.length - 1, Math.floor(chapter)));
  if (next === 0 && motifs.length >= 1) next = 1;
  if (next === 1 && plan.row.every(spot => used.has(spot.cell))) next = 2;
  return next;
}
export const wantAt = (plan: RoundPlan, cell: number): Want | null => plan.row.find(s => s.cell === cell)?.want ?? null;
/** True when this flower is the one the spot was hoping for. Never a verdict: the other answer is simply no flourish. */
export const suits = (plan: RoundPlan, flower: TextileFlower, cell: number): boolean => wantAt(plan, cell) === FLOWER_LIKES[flower];

/* ── sewing: four pulls of the thread ───────────────────────────────────── */

/** Pulls of the thread to a flower: one for each light of GobGob's WaitRing. */
export const PULLS = 4;
/** A flower is sewn in four pulls of the thread. Returns how many stitches lie
 * on the cloth after each pull (always rising, the last the whole flower).
 * Each pull ends where the needlework changes (stem to leaf, leaf to petal,
 * petal to heart) when such a change lies near that quarter of the work, and
 * otherwise at the quarter itself, so no pull is much longer than another. */
export function passEnds(stitches: readonly Pick<Stitch, 'part'>[]): number[] {
  const n = stitches.length;
  if (n <= PULLS) return Array.from({ length: n }, (_, i) => i + 1);
  const changes: number[] = [];
  for (let i = 1; i < n; i++) if (stitches[i].part !== stitches[i - 1].part) changes.push(i);
  const ends: number[] = [];
  for (let k = 1; k < PULLS; k++) {
    const quarter = n * k / PULLS;
    let best = Math.round(quarter), near = n * 0.14;
    for (const change of changes) { const off = Math.abs(change - quarter); if (off < near) { best = change; near = off; } }
    ends.push(Math.max((ends[ends.length - 1] ?? 0) + 1, Math.min(n - (PULLS - k), best)));
  }
  ends.push(n);
  return ends;
}
/** GobGob's WaitRing has four lights: how many are on after `done` of `total` passes. */
export const ringLights = (done: number, total: number): number => total <= 0 ? 0 : Math.max(0, Math.min(4, Math.floor(done / total * 4)));

/* ── the table: where everything lies, for any stage ────────────────────── */

export interface Box { x: number; y: number; w: number; h: number }
export interface Lying extends Box { turn: number }
export interface StageLayout {
  w: number; h: number;
  tall: boolean;
  /** The hoop drawing's box (ART_W × ART_H units scaled by `k`). */
  hoop: Box; k: number;
  /** The round linen sewing mat the hoop lies on (the kit's table top): its centre and the radius of its teal edge, in stage px. */
  table: { cx: number; cy: number; ring: number };
  packets: readonly Lying[];
  basket: Box;
  spools: readonly Box[];
  cloths: Lying;
}
export const MIN_TOUCH = 56;
/** How much bigger than the hoop the linen mat under it is. */
export const MAT_OVER_HOOP = 1.15;
const clampTo = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Lays the table out for a stage of `w` × `h` px. A tall stage (a phone held
 * upright) has the hoop above and the sewing things in two rows below; a wide
 * one has the hoop to one side and the things beside it. The top and bottom
 * bands are left for the HUD. Every picker is at least `MIN_TOUCH` across. */
export function layoutStage(w: number, h: number, turns: readonly number[] = []): StageLayout {
  const W = Math.max(280, w), H = Math.max(240, h), tall = H > W * 1.08;
  const top = tall ? 84 : H < 460 ? 62 : 104, bottom = tall ? 86 : H < 460 ? 12 : 30, pad = Math.max(10, Math.min(W, H) * 0.03);
  const outer = (CLOTH_R + 22) * 2;
  let hoop: Box, zone: Box;
  if (tall) {
    const rows = clampTo((H - top - bottom) * 0.3, 2 * MIN_TOUCH + 34, 230);
    const size = clampTo(Math.min(W * 0.97, H - top - bottom - rows), 150, 760);
    const k = size / outer;
    hoop = { x: W / 2 - HOOP_CX * k, y: top + size / 2 - HOOP_CY * k, w: ART_W * k, h: ART_H * k };
    const y0 = top + size + 6;
    zone = { x: pad, y: y0, w: W - pad * 2, h: Math.max(2 * MIN_TOUCH + 12, H - bottom - y0) };
  } else {
    const zoneMin = 5 * MIN_TOUCH + 34;
    const size = clampTo(Math.min(H - top - bottom, W - zoneMin - pad * 3, W * 0.5), 150, 900);
    const k = size / outer;
    const left = Math.max(pad, Math.min(W * 0.06, (W - size - zoneMin - pad * 3) * 0.4));
    hoop = { x: left + size / 2 - HOOP_CX * k, y: top + (H - top - bottom) / 2 - HOOP_CY * k, w: ART_W * k, h: ART_H * k };
    const x0 = left + size + pad * 1.4, dock = H < 460 ? 64 : 84;
    zone = { x: x0, y: top - 8, w: W - pad - x0, h: H - dock - top + 8 };
  }
  const k = hoop.w / ART_W;
  // Five packets (one row, or three and two where the stage beside the hoop is tall and narrow), five spools in their basket with the cloth pile beside it.
  const gap = clampTo(zone.w * 0.018, 4, 14);
  const stacked = !tall && zone.h > 470 && zone.w < 660;
  const pile = clampTo(zone.w * 0.17, MIN_TOUCH, 112);
  const sw = clampTo((zone.w - pile - gap * 2 - 20) / 5, MIN_TOUCH * 0.92, 100), sh = clampTo(sw * 1.3, MIN_TOUCH, Math.max(MIN_TOUCH, zone.h * 0.44 - 8));
  const perRow = stacked ? 3 : 5, packetRows = stacked ? 2 : 1;
  const pw = clampTo((zone.w - gap * (perRow - 1)) / (stacked ? 3.25 : 5), MIN_TOUCH, stacked ? 150 : 112);
  const ph = clampTo(pw * 1.3, MIN_TOUCH, Math.max(MIN_TOUCH, ((stacked ? zone.h - sh - 44 : zone.h * 0.5) - 8) / packetRows));
  const pwFit = Math.min(pw, ph / 1.3 > MIN_TOUCH ? ph / 1.3 : pw);
  const between = clampTo((zone.h - ph * packetRows - sh - 16) * 0.3, 8, 40), rowGap = stacked ? Math.max(ph * 0.08, clampTo(between * 0.5, 6, 18)) : 0;
  const blockH = ph * packetRows + rowGap + between + sh + 16, y0 = zone.y + Math.max(0, (zone.h - blockH) / 2);
  const packets = Array.from({ length: 5 }, (_, i): Lying => {
    const row = Math.floor(i / perRow), inRow = Math.min(perRow, 5 - row * perRow), col = i - row * perRow;
    const rowW = pwFit * inRow + gap * (inRow - 1), x0 = zone.x + (zone.w - rowW) / 2;
    return { x: x0 + col * (pwFit + gap), y: y0 + row * (ph + rowGap) + (col % 2 ? ph * 0.04 : 0), w: pwFit, h: ph, turn: turns[i] ?? 0 };
  });
  const basketW = sw * 5 + 20, lineW = basketW + gap * 2 + pile, bx0 = zone.x + (zone.w - lineW) / 2, by = y0 + ph * packetRows + rowGap + between + (stacked ? ph * 0.04 : 0);
  const basket: Box = { x: bx0, y: by, w: basketW, h: sh + 16 };
  const spools = Array.from({ length: 5 }, (_, i): Box => ({ x: bx0 + 10 + i * sw, y: by + 8, w: sw, h: sh }));
  const cloths: Lying = { x: bx0 + basketW + gap * 2, y: by + (sh + 16 - pile) / 2, w: pile, h: pile, turn: turns[5] ?? 0 };
  // The mat is a little bigger than the hoop, so its teal edge shows all round the wood.
  const table = { cx: hoop.x + HOOP_CX * k, cy: hoop.y + HOOP_CY * k, ring: (CLOTH_R + 22) * k * MAT_OVER_HOOP };
  return { w: W, h: H, tall, hoop, k, table, packets, basket, spools, cloths };
}
/** A point of the hoop drawing (ART units) as a stage fraction 0..1, for the camera and the particles. */
export function stagePoint(layout: StageLayout, x: number, y: number): { x: number; y: number } {
  return { x: (layout.hoop.x + x * layout.k) / layout.w, y: (layout.hoop.y + y * layout.k) / layout.h };
}
export const hoopCentre = (layout: StageLayout) => stagePoint(layout, HOOP_CX, HOOP_CY);
