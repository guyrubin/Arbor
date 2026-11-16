/** Bottle Lab rules. Pure: no React, no timers, no randomness inside.
 * The saved creation is bounded toy choices only: a shape, a tint, a finish
 * and up to six stickers, each on its own slot of twelve. */
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
