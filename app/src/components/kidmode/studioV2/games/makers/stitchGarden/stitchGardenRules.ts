/** Stitch Garden rules. Pure: no React, no timers, no randomness inside.
 * The saved creation is bounded toy choices only: a cloth and up to eight
 * flowers, each on its own cell of a 4×3 grid with one of five threads. */
export const TEXTILE_CLOTHS = ['linen', 'indigo', 'sage'] as const;
export type TextileCloth = typeof TEXTILE_CLOTHS[number];
export const TEXTILE_FLOWERS = ['daisy', 'tulip', 'poppy', 'bluebell', 'sunflower'] as const;
export type TextileFlower = typeof TEXTILE_FLOWERS[number];
export const TEXTILE_COLUMNS = 4, TEXTILE_ROWS = 3, TEXTILE_CELLS = TEXTILE_COLUMNS * TEXTILE_ROWS;
export const TEXTILE_THREADS = 5;
export const TEXTILE_MAX_MOTIFS = 8;
export interface TextileMotif { flower: TextileFlower; cell: number; thread: number }
export interface TextileCreation { kind: 'textile'; cloth: TextileCloth; motifs: TextileMotif[] }

const inRange = (n: unknown, size: number) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < size;
/** 1–8 motifs, `cell` 0..11 and unique, `thread` 0..4. */
export function validTextile(value: unknown): value is TextileCreation {
  if (!value || typeof value !== 'object') return false;
  const v = value as TextileCreation;
  if (v.kind !== 'textile' || !(TEXTILE_CLOTHS as readonly string[]).includes(v.cloth) || !Array.isArray(v.motifs) || v.motifs.length < 1 || v.motifs.length > TEXTILE_MAX_MOTIFS) return false;
  return v.motifs.every(m => !!m && typeof m === 'object' && (TEXTILE_FLOWERS as readonly string[]).includes(m.flower) && inRange(m.cell, TEXTILE_CELLS) && inRange(m.thread, TEXTILE_THREADS))
    && new Set(v.motifs.map(m => m.cell)).size === v.motifs.length;
}
