/** The glassworks: Bottle Lab's play rules for the Game Cut. Pure numbers: no
 * React, no canvas, no timers, no randomness inside (a sitting is dealt from
 * a seed the caller rolls). The saved creation and its validator live in
 * bottleLabRules; nothing here changes their shape.
 *
 * One ground truth for the picture: the pavilion room and the bench top share
 * one camera (`PLATE`), and every ring of the bottle, every disc on the bench
 * and Aya take their foreshortening and size from it. */
import { BASE_Y, PROFILES, radiusAt, topY, type ShapeId } from './bottleGeometry';
import { BOTTLE_SHAPES, BOTTLE_SLOTS, BOTTLE_STICKERS, BOTTLE_TINTS, SLOT_COLUMNS, slotTaken, slotView, stickersFull, type BottleFinish, type BottleSticker, type BottleStickerPlacement, type BottleTint } from './bottleLabRules';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
const smooth = (t: number) => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };

// ── The picture's camera ───────────────────────────────────────────────────

/** Plate space: the room picture is 2048 by 1024 with the valley's horizon
 * on row 490; the bench top is laid into the same pinhole view (focal 1000).
 * The bottle stands on the bench at (`cx`, `baseY`). */
export const PLATE = { width: 2048, roomHeight: 1024, height: 1420, horizon: 490, focal: 1000, cx: 1024, baseY: 865, benchFar: 705, benchTop: 640, benchHeight: 780 } as const;

/** How round a level ring looks at a row of the plate: its height over its
 * width. Zero on the horizon, negative above it (seen from below). */
export const ringRatio = (plateY: number) => (plateY - PLATE.horizon) / PLATE.focal;
/** How large a thing on the bench is at a plate row, against the same thing at the bottle's foot. */
export const benchScale = (plateY: number) => Math.max(0.05, (plateY - PLATE.horizon) / (PLATE.baseY - PLATE.horizon));

/** The tallest the glass gets (the tall bottle), in bottle units. */
export const TALLEST = BASE_Y - topY('tall');
export const AYA_UNITS = 150;

export interface Spot { x: number; y: number }
export interface StageLayout {
  portrait: boolean; width: number; height: number;
  /** Stage px per plate px, and the plate point at the stage's top-left. */
  k: number; x0: number; y0: number;
  /** The bottle's foot on the stage, and stage px per bottle unit. */
  base: Spot; unit: number;
  /** Where the four colour discs lie (their centres) and how wide one is. */
  discs: readonly Spot[]; discWidth: number;
  /** The sticker card: its box, and each sticker's centre and size. */
  card: { x: number; y: number; width: number; height: number; stickers: readonly Spot[]; size: number };
  /** Aya's feet and her height in px, watching from beside the glass. */
  aya: Spot & { height: number };
  /** The three arched windows, as stage boxes (toys). */
  arches: readonly { x: number; y: number; width: number; height: number }[];
}

/** Lays the picture out for a stage. Wide stages put the discs and the
 * sticker card on the bench beside the bottle (on the side Aya is not on);
 * tall ones lay both in a row in front of it. `lift` (0..1) raises the whole
 * picture for the finale on a tall stage, so the bench in front of the bottle
 * is clear for its light. The plate is never stretched: only moved and scaled. */
export function stageLayout(width: number, height: number, ayaLeft = true, lift = 0): StageLayout {
  const W = Math.max(200, Number.isFinite(width) ? width : 390), H = Math.max(160, Number.isFinite(height) ? height : 700);
  const portrait = H > W, side = ayaLeft ? 1 : -1;
  let k: number, y0: number, unit: number;
  if (portrait) {
    k = H / 1229; y0 = clamp(lift, 0, 1) * 0.085 * 1229;
    unit = Math.min(0.44 * H / TALLEST, 0.64 * W / 180);
  } else {
    const rows = Math.min(883, 2000 * H / W);
    k = H / rows; y0 = PLATE.baseY - 0.775 * rows;
    unit = Math.min((W / H > 2 ? 0.7 : 0.655) * H / TALLEST, 0.36 * W / 180);
  }
  const x0 = PLATE.cx - W / (2 * k);
  const toStage = (px: number, py: number): Spot => ({ x: (px - x0) * k, y: (py - y0) * k });
  const base = toStage(PLATE.cx, PLATE.baseY);
  let discs: Spot[], discWidth: number, card: StageLayout['card'], aya: StageLayout['aya'];
  if (portrait) {
    const rowY = Math.min(base.y + 0.118 * H, H - 124);
    discWidth = Math.min(92, (W - 28) / 4.25);
    const gap = (W - 28 - discWidth * 4) / 3;
    discs = [0, 1, 2, 3].map(i => ({ x: 14 + discWidth * 0.46 + i * (discWidth + gap), y: rowY }));
    const size = Math.min(58, (W - 36) / 6.2), pitch = (W - 36 - size) / 5;
    const cardH = size + 18, cardY = Math.min(rowY - cardH * 0.55, H - 96 - cardH);
    card = { x: 10, y: cardY, width: W - 20, height: cardH, size, stickers: [0, 1, 2, 3, 4, 5].map(i => ({ x: 18 + size / 2 + i * pitch, y: cardY + cardH / 2 })) };
    const tall = AYA_UNITS * unit * 0.9;
    aya = { x: clamp(base.x - side * Math.max(0.36 * W, 96 * unit), tall * 0.36, W - tall * 0.36), y: base.y - 0.012 * H, height: tall };
  } else {
    // Two rows of two discs on the bench: the near pair lower and larger, as the bench's own perspective makes them.
    discWidth = Math.max(60, Math.min(150, 0.105 * W, 0.24 * H));
    const near = Math.min(base.y + 0.13 * H, H - 0.08 * H), far = base.y + 0.025 * H, from = base.x + side * (104 * unit + discWidth * 0.75);
    discs = [0, 1, 2, 3].map(i => ({ x: from + side * (Math.floor(i / 2) * discWidth * 1.16 + (i % 2 ? discWidth * 0.36 : 0)), y: i % 2 ? near : far }));
    const size = Math.max(40, Math.min(92, 0.125 * H, 0.066 * W)), pad = size * 0.2;
    const cardW = size * 3 + pad * 4, cardH = size * 2 + pad * 3;
    const cx = clamp(base.x + side * (104 * unit + cardW / 2 + (H < 440 ? 0.11 : 0.03) * W), cardW / 2 + 14, W - cardW / 2 - 14), cardY = Math.min(base.y + 0.075 * H, H - 22) - cardH;
    card = { x: cx - cardW / 2, y: cardY, width: cardW, height: cardH, size, stickers: [0, 1, 2, 3, 4, 5].map(i => ({ x: cx - cardW / 2 + pad + size / 2 + (i % 3) * (size + pad), y: cardY + pad + size / 2 + Math.floor(i / 3) * (size + pad) })) };
    aya = { x: base.x - side * Math.max(0.2 * W, 128 * unit), y: base.y - 0.02 * H, height: AYA_UNITS * unit };
  }
  // The room's three arches: plate boxes of the kit picture, moved to the stage.
  const arches = [-1, 0, 1].map(i => { const a = toStage(PLATE.cx + i * 262 - 90, 262), b = toStage(PLATE.cx + i * 262 + 90, 640); return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y }; });
  return { portrait, width: W, height: H, k, x0, y0, base, unit, discs, discWidth, card, aya, arches };
}
/** The plate row under a stage row, and the ring ratio and bench scale there. */
export const plateRow = (layout: Pick<StageLayout, 'k' | 'y0'>, stageY: number) => layout.y0 + stageY / layout.k;

// ── Chapter one: the hot glass takes a shape ───────────────────────────────

/** How much of each of the three shapes the soft glass is. The weights sum to one. */
export type Weights = Readonly<Record<ShapeId, number>>;
export const oneShape = (shape: ShapeId): Weights => ({ round: shape === 'round' ? 1 : 0, tall: shape === 'tall' ? 1 : 0, flask: shape === 'flask' ? 1 : 0 });
const normal = (w: Weights): Weights => { const sum = w.round + w.tall + w.flask; return sum > 1e-6 ? { round: w.round / sum, tall: w.tall / sum, flask: w.flask / sum } : oneShape('round'); };
export const mixWeights = (a: Weights, b: Weights, t: number): Weights => { const p = clamp(t, 0, 1); return normal({ round: a.round + (b.round - a.round) * p, tall: a.tall + (b.tall - a.tall) * p, flask: a.flask + (b.flask - a.flask) * p }); };

/** A finger on the hot glass: `dx` and `dy` are how far it has dragged, in
 * bottle heights (up is negative). Up stretches it tall, down presses it
 * round, sideways tilts it out into a flask. The further the drag, the more
 * of that shape, on top of what the glass was when the finger came down. */
export const PULL_FULL = 0.42;
export function pullShape(from: Weights, dx: number, dy: number): Weights {
  const x = Number.isFinite(dx) ? dx : 0, y = Number.isFinite(dy) ? dy : 0;
  const tall = clamp(-y / PULL_FULL, 0, 1), round = clamp(y / PULL_FULL, 0, 1), flask = clamp((Math.abs(x) - 0.06) / PULL_FULL, 0, 1);
  const most = Math.max(tall, round, flask);
  if (most <= 0) return normal(from);
  const sum = tall + round + flask, keep = 1 - most;
  return normal({ round: from.round * keep + most * round / sum, tall: from.tall * keep + most * tall / sum, flask: from.flask * keep + most * flask / sum });
}
/** Let go, the glass settles on the shape it is most of (ties: the order round, tall, flask). */
export function settleShape(w: Weights): ShapeId {
  let best: ShapeId = 'round';
  for (const s of BOTTLE_SHAPES) if (w[s] > w[best] + 1e-9) best = s;
  return best;
}
/** A tap on the hot glass puffs it into the next shape: the tap-only and keyboard way. */
export const nextShape = (shape: ShapeId): ShapeId => BOTTLE_SHAPES[(BOTTLE_SHAPES.indexOf(shape) + 1) % BOTTLE_SHAPES.length];
/** The glass follows the finger a little beyond its new shape: taller while pulled up, squatter while pressed. */
export const pullStretch = (dy: number) => clamp(1 - (Number.isFinite(dy) ? dy : 0) * 0.42, 0.84, 1.22);
/** And it leans after a sideways finger, in degrees. */
export const pullLean = (dx: number) => clamp((Number.isFinite(dx) ? dx : 0) * 26, -13, 13);

export interface BlendedProfile { height: number; rows: number; radius: Float32Array; stickerRows: readonly [number, number, number]; sticker: number }
/** The glass as it is now: `rows` radii from the lip (row 0) to the foot,
 * each shape's own profile read at the same share of its height and mixed by
 * weight. Heights and radii are bottle units. */
export function blendedProfile(w: Weights, rows = 96): BlendedProfile {
  const n = Math.max(8, Math.round(rows)), radius = new Float32Array(n), ws = normal(w);
  let height = 0, sticker = 0; const stickerRows: [number, number, number] = [0, 0, 0];
  for (const s of BOTTLE_SHAPES) {
    const part = ws[s]; if (part <= 0) continue;
    const top = topY(s), h = BASE_Y - top;
    height += part * h; sticker += part * PROFILES[s].sticker;
    for (let r = 0; r < 3; r++) stickerRows[r] += part * (PROFILES[s].rows[r] - top) / h;
    for (let i = 0; i < n; i++) radius[i] += part * radiusAt(s, top + h * i / (n - 1));
  }
  return { height, rows: n, radius, stickerRows, sticker };
}
/** The radius at a share `v` of the height (0 the lip, 1 the foot). */
export function profileRadius(p: BlendedProfile, v: number): number {
  const f = clamp(v, 0, 1) * (p.rows - 1), i = Math.min(p.rows - 2, Math.floor(f)), t = f - i;
  return p.radius[i] + (p.radius[i + 1] - p.radius[i]) * t;
}

// ── Chapter two: colour and finish ─────────────────────────────────────────

/** A disc under the bottle: the light pad's colour climbs the glass. `t` is
 * the share of the soak done; the front it returns is the share of the height
 * the new colour has reached (0 the foot, 1 over the lip), easing out. */
export const SOAK_MS = 1250;
export const soakFront = (t: number) => { const p = clamp(t, 0, 1); return 1.08 * (1 - (1 - p) ** 2.4); };
/** The four discs keep the order of the saved tints unless a sitting deals them otherwise. */
export const DISC_TINTS: readonly BottleTint[] = BOTTLE_TINTS;

/** Rubbing the glass changes its finish: shiny glass frosts over, frosted
 * glass is polished clear. `need` bottle-widths of scrubbing do it; a rub
 * that stops early fades away again (a soft return, nothing is lost). */
export const RUB_NEED = 2.6;
export function rubStep(progress: number, distance: number, width: number): number {
  if (!(width > 0) || !Number.isFinite(distance)) return clamp(progress, 0, 1);
  return clamp(clamp(progress, 0, 1) + Math.abs(distance) / (width * RUB_NEED), 0, 1);
}
export const rubFade = (progress: number, dt: number) => clamp(clamp(progress, 0, 1) - clamp(dt, 0, 0.1) * 0.55, 0, 1);
export const otherFinish = (finish: BottleFinish): BottleFinish => finish === 'frost' ? 'gloss' : 'frost';
/** How frosted the glass looks: its finish, moved toward the other one by the rub in progress. */
export const frostShown = (finish: BottleFinish, rub: number) => finish === 'frost' ? 1 - clamp(rub, 0, 1) : clamp(rub, 0, 1);

// ── Chapter three: stickers ────────────────────────────────────────────────

/** A tapped sticker flies to the free place that faces the child most: the
 * column turned nearest the front, top row first. Null when six are on or
 * nothing free faces the front. */
export function nextFreeSlot(stickers: readonly BottleStickerPlacement[], rotation: number): number | null {
  if (stickersFull(stickers)) return null;
  let best: number | null = null, score = -Infinity;
  for (let slot = 0; slot < BOTTLE_SLOTS; slot++) {
    if (slotTaken(stickers, slot)) continue;
    const v = slotView(slot, rotation);
    if (!v.front) continue;
    const s = v.depth * 10 - v.row * 0.5 - (v.row === 1 ? -0.8 : 0);
    if (s > score + 1e-9) { score = s; best = slot; }
  }
  return best;
}
/** A dropped sticker takes the free, front-facing place nearest the drop:
 * `u` is how far across the glass it fell (-1 the left edge, 1 the right),
 * `row` which of the three bands. Null when it missed every free place. */
export function dropSlot(stickers: readonly BottleStickerPlacement[], rotation: number, u: number, row: number): number | null {
  if (stickersFull(stickers) || !Number.isFinite(u) || Math.abs(u) > 1.15) return null;
  const r = clamp(Math.round(row), 0, 2);
  let best: number | null = null, gap = Infinity;
  for (let column = 0; column < SLOT_COLUMNS; column++) {
    const slot = r * SLOT_COLUMNS + column;
    if (slotTaken(stickers, slot)) continue;
    const v = slotView(slot, rotation);
    if (!v.front || v.scaleX < 0.3) continue;
    const d = Math.abs(v.x - clamp(u, -1, 1));
    if (d < gap - 1e-9) { gap = d; best = slot; }
  }
  return gap <= 0.75 ? best : null;
}
/** The turn that brings a free column to face the child, for when the front is full. */
export function turnToFree(stickers: readonly BottleStickerPlacement[], rotation: number): number | null {
  if (stickersFull(stickers)) return null;
  for (const step of [90, -90, 180]) if (nextFreeSlot(stickers, rotation + step) !== null) return rotation + step;
  return null;
}

// ── The arc ────────────────────────────────────────────────────────────────

export const CHAPTERS = ['shape', 'colour', 'dress'] as const;
export type Chapter = typeof CHAPTERS[number];
export type Act = 'opening' | Chapter | 'finale' | 'done';
/** What the child has done in the chapter in play. Things done, never how well. */
export interface Deeds { shaped: number; coloured: number; rubbed: number; stuck: number; turned: number }
export const noDeeds = (): Deeds => ({ shaped: 0, coloured: 0, rubbed: 0, stuck: 0, turned: 0 });
/** A chapter's one action shows once its thing has been tried, or after a
 * patient wait (so a child who likes the glass as it is can still go on). */
export const CHAPTER_WAIT_MS = 9000;
export function chapterReady(chapter: Chapter, deeds: Deeds, waitedMs = 0): boolean {
  const did = chapter === 'shape' ? deeds.shaped > 0 : chapter === 'colour' ? deeds.coloured + deeds.rubbed > 0 : deeds.stuck > 0;
  return did || waitedMs >= CHAPTER_WAIT_MS;
}
export const nextAct = (act: Act): Act => act === 'opening' ? 'shape' : act === 'shape' ? 'colour' : act === 'colour' ? 'dress' : act === 'dress' ? 'finale' : 'done';

/** One sitting's deal: a different lump of glass, a different light, the
 * discs and the sticker card in a different order, Aya on the other side. */
export type Daylight = 'day' | 'warm' | 'cool';
export interface Sitting { seed: number; lump: Weights; light: Daylight; discs: readonly BottleTint[]; card: readonly BottleSticker[]; ayaLeft: boolean; sunSide: -1 | 1; motes: number }
export function dealSitting(seed: number, sittings = 0): Sitting {
  let state = (Math.floor(Number.isFinite(seed) ? seed : 1) >>> 0) || 1;
  const roll = () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const shuffle = <T,>(list: readonly T[]) => { const out = list.slice(); for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(roll() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };
  const n = Math.max(0, Math.floor(sittings));
  // The lump is never one finished shape: it leans toward one and holds some of another.
  const lean = BOTTLE_SHAPES[n % 3], other = BOTTLE_SHAPES[(n + 1 + Math.floor(roll() * 2)) % 3], part = 0.22 + roll() * 0.2;
  const lump = normal({ round: 0.12, tall: 0, flask: 0, [lean]: 1 - part, [other]: part } as Weights);
  const light: Daylight = (['day', 'warm', 'cool'] as const)[(n + Math.floor(roll() * 3)) % 3];
  // The clear disc always lies first: it is the way back to plain glass.
  const discs: BottleTint[] = ['clear', ...shuffle(BOTTLE_TINTS.filter(t => t !== 'clear'))];
  return { seed: state, lump, light, discs, card: shuffle(BOTTLE_STICKERS), ayaLeft: n % 2 === 0 ? roll() < 0.8 : roll() < 0.2, sunSide: roll() < 0.5 ? -1 : 1, motes: 10 + Math.floor(roll() * 8) };
}

// ── The set-piece ──────────────────────────────────────────────────────────

/** The finale, in seconds from its start. Aya's can fills the bottle (the
 * water turns the room inside it over); the valley sun comes through the arch
 * behind and the glass throws its colour over the bench and the walls; the
 * bottle turns once; Aya hops behind it and is seen through the water, large
 * and the wrong way round. From `FINALE.free` on the light is the child's to
 * move and the bottle may be kept. */
export const FINALE = { pourFrom: 0.5, pourTo: 3.2, sunFrom: 2.7, sunTo: 4.6, ayaFrom: 4.4, ayaTo: 5.6, turnFrom: 3.4, turnTo: 8.2, free: 6.4, reducedFree: 1.2 } as const;
export interface FinalePose { can: number; tip: number; flow: boolean; water: number; sun: number; dim: number; turn: number; behind: number; free: boolean }
export function finalePose(t: number, reduced = false): FinalePose {
  const s = Number.isFinite(t) ? Math.max(0, t) : 0;
  if (reduced) return { can: 0, tip: 0, flow: false, water: 1, sun: 1, dim: 1, turn: 0, behind: 1, free: s >= FINALE.reducedFree };
  const span = (from: number, to: number) => clamp((s - from) / (to - from), 0, 1);
  const pour = span(FINALE.pourFrom, FINALE.pourTo);
  const can = pour <= 0 ? smooth(s / FINALE.pourFrom) : pour < 0.9 ? 1 : smooth((1 - pour) / 0.1);
  const tip = smooth(span(FINALE.pourFrom, FINALE.pourFrom + 0.45)) * (pour < 0.86 ? 1 : smooth((0.96 - pour) / 0.1));
  return {
    can, tip, flow: pour > 0.12 && pour < 0.84,
    water: smooth(clamp((pour - 0.14) / 0.74, 0, 1)),
    sun: smooth(span(FINALE.sunFrom, FINALE.sunTo)), dim: smooth(span(FINALE.sunFrom - 0.4, FINALE.sunTo)),
    turn: 360 * smooth(span(FINALE.turnFrom, FINALE.turnTo)),
    behind: smooth(span(FINALE.ayaFrom, FINALE.ayaTo)), free: s >= FINALE.free,
  };
}
/** The level the finale fills the bottle to: a share of its height from the foot. */
export const FINALE_FILL = 0.7;

// ── Light through glass ────────────────────────────────────────────────────

/** Where the eye's ray lands behind the glass, as a sideways shift in radii,
 * for a point `u` across the bottle (-1 the left edge, 1 the right).
 * Empty, the two walls make a weak diverging lens: the middle of the view is
 * smaller (about five sixths) and the edges reach far out to the sides. */
export const lensAir = (u: number) => { const c = clamp(u, -1, 1), a = Math.abs(c); return c * (0.2 + 0.56 * a * a * a * a); };
/** Full of water the bottle is a strong lens: the view is turned left for
 * right and made larger in the middle, squeezed toward the edges. The value
 * is where the ray lands, in radii from the axis (so minus `u` is a plain flip). */
export const lensWet = (u: number) => { const c = clamp(u, -1, 1); return -(0.5 * c + 0.72 * c * c * c); };
/** Red bends least and blue most: each colour's shift is the green one scaled. */
export const DISPERSION = { red: 0.93, green: 1, blue: 1.08 } as const;
/** How much of the light a wall of tinted glass lets through, for a ray
 * crossing it at `nz` (1 straight through the middle, 0 grazing the edge):
 * the edge of a tinted bottle is darker because the ray runs through more glass. */
export const glassPath = (nz: number) => 1 / Math.max(0.16, clamp(nz, 0, 1));

// ── Sound ──────────────────────────────────────────────────────────────────

/** The step of the activity's scale a tapped glass rings on: a tall bottle
 * rings highest, a wide flask lowest, and water lowers it. */
export function ringStep(w: Weights, water = 0): number {
  const ws = normal(w);
  return Math.round(ws.round * 9 + ws.tall * 12 + ws.flask * 7 - clamp(water, 0, 1) * 3);
}
/** The three arches ring three notes; all three (in any order, nothing else
 * between) wake the rainbow. */
export const ARCH_STEPS = [5, 7, 9] as const;
export function archSecret(rung: readonly number[]): boolean {
  if (rung.length < 3) return false;
  const last = rung.slice(-3);
  return new Set(last).size === 3 && last.every(i => i === 0 || i === 1 || i === 2);
}

// ── Hints ──────────────────────────────────────────────────────────────────

/** The one gesture the ghost hand shows in a chapter, until the child has done it. */
export type HintId = 'pull' | 'disc' | 'rub' | 'stickOn' | 'turn';
export function hintFor(act: Act, deeds: Deeds): HintId | null {
  if (act === 'shape') return deeds.shaped > 0 ? null : 'pull';
  if (act === 'colour') return deeds.coloured === 0 ? 'disc' : deeds.rubbed === 0 ? 'rub' : null;
  if (act === 'dress') return deeds.stuck === 0 ? 'stickOn' : deeds.turned === 0 ? 'turn' : null;
  return null;
}
export const HINT_FIRST_MS = 1600;
export const HINT_AGAIN_MS = 6000;
