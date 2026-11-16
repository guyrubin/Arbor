/** Stitch Garden rules. Pure: no React, no timers, no randomness inside.
 * The saved creation is bounded toy choices only: a cloth and up to eight
 * flowers, each on its own cell of a 4×3 grid with one of five threads.
 * The stitch generator lives in `stitchGardenStitches.ts`, so this file (which
 * the app bundles statically for validation) stays small. */
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

export const validFlower = (value: unknown): value is TextileFlower => (TEXTILE_FLOWERS as readonly unknown[]).includes(value);
export const validCloth = (value: unknown): value is TextileCloth => (TEXTILE_CLOTHS as readonly unknown[]).includes(value);

/** Plants one flower on a free cell. Returns the new list (the old one is not
 * touched), or null when the cell is taken, the hoop already holds eight, or
 * any choice is outside the toy's bounds. */
export function plant(motifs: readonly TextileMotif[], flower: TextileFlower, cell: number, thread: number): TextileMotif[] | null {
  if (!validFlower(flower) || !inRange(cell, TEXTILE_CELLS) || !inRange(thread, TEXTILE_THREADS)) return null;
  if (motifs.length >= TEXTILE_MAX_MOTIFS || motifs.some(m => m.cell === cell)) return null;
  return [...motifs, { flower, cell, thread }];
}

/** Takes out the last flower stitched. Nothing to take out leaves it empty. */
export function unpick(motifs: readonly TextileMotif[]): TextileMotif[] {
  return motifs.slice(0, -1);
}

/** The cells a new flower can still go on, in grid order. */
export function freeCells(motifs: readonly TextileMotif[]): number[] {
  if (motifs.length >= TEXTILE_MAX_MOTIFS) return [];
  const used = new Set(motifs.map(m => m.cell));
  return Array.from({ length: TEXTILE_CELLS }, (_, cell) => cell).filter(cell => !used.has(cell));
}

/** The poem has one line per flower, in the order they were stitched: the
 * hem shows `storyLines(n)` lines, the newest last. */
export function storyLines<T>(lines: readonly T[], count: number): T[] {
  return lines.slice(0, Math.max(0, Math.min(count, TEXTILE_MAX_MOTIFS, lines.length)));
}

/** What is kept when the child says they are finished; null for an empty hoop. */
export function textileOf(cloth: TextileCloth, motifs: readonly TextileMotif[]): TextileCreation | null {
  const made: TextileCreation = { kind: 'textile', cloth, motifs: motifs.map(({ flower, cell, thread }) => ({ flower, cell, thread })) };
  return validTextile(made) ? made : null;
}

/** A kept cloth opened again in a later sitting: a clean copy, or null. */
export function reopenTextile(value: unknown): TextileCreation | null {
  return validTextile(value) ? textileOf(value.cloth, value.motifs) : null;
}

/** Grid position of a cell, row by row from the top, columns in drawing
 * order (the cloth is the same way round in both reading directions). */
export const cellRow = (cell: number) => Math.floor(cell / TEXTILE_COLUMNS);
export const cellColumn = (cell: number) => cell % TEXTILE_COLUMNS;
