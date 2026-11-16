/** Bottle Lab rules. Pure: no React, no timers, no randomness inside.
 * The saved creation is bounded toy choices only: a shape, a tint, a finish
 * and up to six stickers, each on its own slot of twelve. */
import { BASE_Y, ELLIPSE, PROFILES, WALL, radiusAt, type ShapeId } from './bottleGeometry';

export const BOTTLE_SHAPES = ['round', 'tall', 'flask'] as const;
export type BottleShape = typeof BOTTLE_SHAPES[number];
export const BOTTLE_TINTS = ['clear', 'sea', 'amber', 'rose'] as const;
export type BottleTint = typeof BOTTLE_TINTS[number];
export const BOTTLE_FINISHES = ['gloss', 'frost'] as const;
export type BottleFinish = typeof BOTTLE_FINISHES[number];
export const BOTTLE_STICKERS = ['star', 'leaf', 'wave', 'sun', 'moon', 'heart'] as const;
export type BottleSticker = typeof BOTTLE_STICKERS[number];
export const BOTTLE_SLOTS = 12;
export const BOTTLE_MAX_STICKERS = 6;
export interface BottleStickerPlacement { art: BottleSticker; slot: number }
export interface BottleCreation { kind: 'bottle'; shape: BottleShape; tint: BottleTint; finish: BottleFinish; stickers: BottleStickerPlacement[] }

/** 0–6 stickers, `slot` an integer 0..11 and unique. */
export function validBottle(value: unknown): value is BottleCreation {
  if (!value || typeof value !== 'object') return false;
  const v = value as BottleCreation;
  if (v.kind !== 'bottle' || !(BOTTLE_SHAPES as readonly string[]).includes(v.shape) || !(BOTTLE_TINTS as readonly string[]).includes(v.tint) || !(BOTTLE_FINISHES as readonly string[]).includes(v.finish) || !Array.isArray(v.stickers) || v.stickers.length > BOTTLE_MAX_STICKERS) return false;
  return v.stickers.every(s => !!s && typeof s === 'object' && (BOTTLE_STICKERS as readonly string[]).includes(s.art) && Number.isInteger(s.slot) && s.slot >= 0 && s.slot < BOTTLE_SLOTS)
    && new Set(v.stickers.map(s => s.slot)).size === v.stickers.length;
}

/** A new sitting starts from a plain clear bottle. */
export const freshBottle = (): BottleCreation => ({ kind: 'bottle', shape: 'round', tint: 'clear', finish: 'gloss', stickers: [] });

// ── Stickers ───────────────────────────────────────────────────────────────

/** The twelve slots: four columns around the bottle, three rows down. Slot
 * `s` is column `s % 4`, row `floor(s / 4)`. Column 0 faces the child when
 * the bottle is unturned; the others follow at quarter turns. */
export const SLOT_COLUMNS = 4;
export const SLOT_ROWS = 3;
const isSlot = (slot: number) => Number.isInteger(slot) && slot >= 0 && slot < BOTTLE_SLOTS;
const isArt = (art: string): art is BottleSticker => (BOTTLE_STICKERS as readonly string[]).includes(art);

export const slotTaken = (stickers: readonly BottleStickerPlacement[], slot: number) => stickers.some(s => s.slot === slot);
export const stickersFull = (stickers: readonly BottleStickerPlacement[]) => stickers.length >= BOTTLE_MAX_STICKERS;

/** Puts a sticker on a free slot. A taken slot, a seventh sticker or a
 * value from outside the set changes nothing: the same list comes back. */
export function placeSticker(stickers: readonly BottleStickerPlacement[], art: string, slot: number): readonly BottleStickerPlacement[] {
  if (!isArt(art) || !isSlot(slot) || slotTaken(stickers, slot) || stickersFull(stickers)) return stickers;
  return [...stickers, { art, slot }];
}

/** Peels the sticker off a slot; an empty slot changes nothing. */
export function peelSticker(stickers: readonly BottleStickerPlacement[], slot: number): readonly BottleStickerPlacement[] {
  return slotTaken(stickers, slot) ? stickers.filter(s => s.slot !== slot) : stickers;
}

/** Where a slot is when the bottle has turned `rotation` degrees (positive
 * turns the near side toward the right). `x` is the sine of its angle (-1 the
 * left edge, 1 the right), `scaleX` the cosine's size (its foreshortening),
 * `depth` the cosine itself, `front` whether it is on the near half. */
export interface SlotView { x: number; scaleX: number; depth: number; front: boolean; column: number; row: number; angle: number }
export function slotView(slot: number, rotation: number): SlotView {
  const s = isSlot(slot) ? slot : 0;
  const column = s % SLOT_COLUMNS, row = Math.floor(s / SLOT_COLUMNS);
  const turn = Number.isFinite(rotation) ? rotation : 0;
  const angle = ((column * 360 / SLOT_COLUMNS + turn) % 360 + 360) % 360;
  const rad = angle * Math.PI / 180, depth = Math.cos(rad);
  const clean = (n: number) => Math.abs(n) < 1e-9 ? 0 : n;
  return { x: clean(Math.sin(rad)), scaleX: clean(Math.abs(depth)), depth: clean(depth), front: depth > 1e-9, column, row, angle };
}

/** A slot can take a sticker by tap when it faces the child enough to aim at. */
export const SLOT_REACH = 0.5;
export function reachableSlots(rotation: number): number[] {
  return Array.from({ length: BOTTLE_SLOTS }, (_, slot) => slot).filter(slot => { const v = slotView(slot, rotation); return v.front && v.scaleX >= SLOT_REACH; });
}

/** Turning by buttons moves an eighth of a turn; a drag settles on the nearest eighth. */
export const TURN_STEP = 45;
export const snapRotation = (rotation: number) => Number.isFinite(rotation) ? Math.round(rotation / TURN_STEP) * TURN_STEP : 0;
/** Degrees of turn for a drag of `dx` across a bottle `width` wide: one width is about half a turn. */
export const dragTurn = (dx: number, width: number) => width > 0 && Number.isFinite(dx) ? dx / width * 180 : 0;

/** The still view for a kept bottle: the three-quarter turn that shows the
 * most of its stickers. Ties keep the earliest candidate, so a bottle always
 * reopens the same way. */
export const VIEW_TURNS = [-45, 45, -135, 135] as const;
export function bestViewRotation(stickers: readonly BottleStickerPlacement[]): number {
  let best: number = VIEW_TURNS[0], score = -1;
  for (const turn of VIEW_TURNS) {
    const seen = stickers.reduce((sum, s) => { const v = slotView(s.slot, turn); return sum + (v.front ? 1 + v.scaleX / 10 : 0); }, 0);
    if (seen > score + 1e-9) { best = turn; score = seen; }
  }
  return best;
}

// ── The lamp ───────────────────────────────────────────────────────────────

/** The lamp's angle from straight above the bottle, in degrees (negative is
 * the left). The arc stops before the lamp would dip behind the bottle. */
export const LAMP_MIN = -60;
export const LAMP_MAX = 60;
export const LAMP_STEP = 10;
export const LAMP_START = -35;
export const clampLamp = (angle: number) => Number.isFinite(angle) ? Math.min(LAMP_MAX, Math.max(LAMP_MIN, angle)) : LAMP_START;

/** The lamp's place on its arc, in scene units, and the way it points. */
export const LAMP_ARC = { cx: 180, cy: 214, rx: 150, ry: 168 } as const;
export function lampPosition(angle: number) {
  const a = clampLamp(angle) * 1.3 * Math.PI / 180;
  const x = LAMP_ARC.cx + LAMP_ARC.rx * Math.sin(a), y = LAMP_ARC.cy - LAMP_ARC.ry * Math.cos(a);
  /** The shade aims at the middle of the bottle. */
  const aim = Math.atan2(260 - y, 180 - x) * 180 / Math.PI;
  return { x, y, aim };
}
/** The angle a pointer at (x, y) asks the lamp for. */
export function lampAngleAt(x: number, y: number): number {
  const a = Math.atan2((x - LAMP_ARC.cx) / LAMP_ARC.rx, (LAMP_ARC.cy - y) / LAMP_ARC.ry);
  return clampLamp(a * 180 / Math.PI / 1.3);
}

/** What the lamp does to the glass and the table, all from its angle:
 * - the shine streak sits where the surface faces halfway between lamp and eye;
 * - a softer rim light lines the far edge;
 * - the table shadow points away from the lamp and grows as the lamp drops;
 * - the caustic (the light the full bottle focuses) sits inside the shadow.
 * With the lamp off, the room's soft light leaves a broad faint shine, a
 * short soft shadow and no caustic. Lengths are scene units. */
export interface LampEffects {
  streakU: number; streakWidth: number; streakOpacity: number;
  rimU: number; rimOpacity: number;
  shadowAngle: number; shadowLength: number; shadowOpacity: number; shadowSoftness: number;
  causticAt: number; causticSize: number; causticOpacity: number;
}
export function lampEffects(angle: number, on = true): LampEffects {
  if (!on) return { streakU: -0.5, streakWidth: 0.2, streakOpacity: 0.22, rimU: 0.9, rimOpacity: 0.12, shadowAngle: -90, shadowLength: 18, shadowOpacity: 0.16, shadowSoftness: 9, causticAt: 0.5, causticSize: 0, causticOpacity: 0 };
  const a = clampLamp(angle) * Math.PI / 180, side = Math.sin(a), lean = Math.abs(side) / Math.sin(LAMP_MAX * Math.PI / 180);
  // Lamp slightly in front of the bottle: light (sin a, cos a up, 0.45 toward the child).
  const streakU = Math.sin(Math.atan2(side, 1.45));
  const rimU = side >= 0 ? -0.9 : 0.9;
  // On the table the shadow runs away from the lamp and a little toward the
  // child (the lamp hangs just behind the bottle), so it is never hidden.
  const dx = -side, dy = 0.1 + 0.14 * Math.cos(a);
  return {
    streakU, streakWidth: 0.075, streakOpacity: 0.92,
    rimU, rimOpacity: 0.28 + 0.5 * lean,
    shadowAngle: Math.atan2(dy, dx) * 180 / Math.PI,
    shadowLength: 46 + 150 * lean, shadowOpacity: 0.34 - 0.08 * lean, shadowSoftness: 3 + 4 * lean,
    causticAt: 0.38, causticSize: 0.55 + 0.35 * lean, causticOpacity: 0.85,
  };
}

// ── Bubbles ────────────────────────────────────────────────────────────────

export const MAX_BUBBLES = 24;
export interface Bubble { id: number; x: number; y: number; r: number; speed: number; phase: number; drift: number }

/** Inside the water, how far a bubble of radius `r` at height `y` may sit from
 * the axis without touching the glass. Zero outside the water. */
export function bubbleHalfWidth(shape: ShapeId, y: number, r: number): number {
  const level = PROFILES[shape].water;
  if (!Number.isFinite(y) || y < level || y > BASE_Y) return 0;
  const inside = radiusAt(shape, y) * (1 - WALL) - r - 1.5;
  return Math.max(0, inside);
}
export const bubbleTop = (shape: ShapeId) => PROFILES[shape].water;
/** Bubbles start a little above the inside of the base ring. */
export const bubbleFloor = (shape: ShapeId) => BASE_Y - 6;
/** True when a bubble lies wholly inside the water of this shape. */
export function bubbleInside(shape: ShapeId, bubble: Pick<Bubble, 'x' | 'y' | 'r'>, axis = 180): boolean {
  const half = bubbleHalfWidth(shape, bubble.y, bubble.r);
  return half > 0 && Math.abs(bubble.x - axis) <= half + 1e-6 && bubble.y - bubble.r >= bubbleTop(shape) - 1e-6;
}

/** A new bubble from two or more numbers in [0, 1) the caller rolls. */
export function spawnBubble(shape: ShapeId, id: number, roll: () => number, axis = 180, burst = false): Bubble {
  const n = () => { const v = roll(); return Number.isFinite(v) ? Math.min(0.999, Math.max(0, v)) : 0.5; };
  const r = burst ? 2 + n() * 3.8 : 1.8 + n() * 2.6;
  const floor = bubbleFloor(shape), top = bubbleTop(shape);
  const y = burst ? top + (floor - top) * (0.45 + 0.5 * n()) : floor - n() * 10;
  const half = bubbleHalfWidth(shape, y, r);
  const x = axis + (n() * 2 - 1) * half * 0.85;
  return { id, x, y, r, speed: 16 + n() * 22 + r * 3, phase: n() * Math.PI * 2, drift: 2 + n() * 4 };
}

/** One step of rising: up by its speed, wobbling sideways, held inside the
 * glass. Null when it reaches the water line and pops. `t` is seconds since
 * the start, `dt` this step's seconds. */
export function riseBubble(shape: ShapeId, bubble: Bubble, t: number, dt: number, axis = 180): Bubble | null {
  const step = Number.isFinite(dt) ? Math.min(0.1, Math.max(0, dt)) : 0;
  const y = bubble.y - bubble.speed * step;
  if (y - bubble.r <= bubbleTop(shape) + ELLIPSE * 4) return null;
  const half = bubbleHalfWidth(shape, y, bubble.r);
  if (half <= 0) return null;
  const wobble = Math.sin(t * 5 + bubble.phase) * bubble.drift * step * 4;
  const x = Math.min(axis + half, Math.max(axis - half, bubble.x + wobble));
  return { ...bubble, x, y };
}

/** A shake lets out a handful, never past the cap. */
export const BURST = 12;
export const burstCount = (live: number) => Math.max(0, Math.min(BURST, MAX_BUBBLES - Math.max(0, Math.trunc(live))));
