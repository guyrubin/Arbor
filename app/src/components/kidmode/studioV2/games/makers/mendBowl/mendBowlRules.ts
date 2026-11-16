/** Mend the Bowl rules. Pure: no React, no timers, no randomness inside.
 * The saved creation is bounded toy choices only: a glaze, one of three
 * authored break patterns, and the order the gold seams were traced. */
export const BOWL_GLAZES = ['celadon', 'indigo', 'rose', 'cream'] as const;
export type BowlGlaze = typeof BOWL_GLAZES[number];
export type BowlPattern = 0 | 1 | 2;
/** Seams per authored break pattern (index = pattern). The builder may change the numbers. */
export const BOWL_SEAM_COUNTS: readonly [number, number, number] = [4, 5, 6];
export interface BowlCreation { kind: 'bowl'; glaze: BowlGlaze; pattern: BowlPattern; seams: number[] }

/** `seams` is a permutation of 0..n-1, n = that pattern's seam count. */
export function validBowl(value: unknown): value is BowlCreation {
  if (!value || typeof value !== 'object') return false;
  const v = value as BowlCreation;
  if (v.kind !== 'bowl' || !(BOWL_GLAZES as readonly string[]).includes(v.glaze) || ![0, 1, 2].includes(v.pattern) || !Array.isArray(v.seams)) return false;
  const n = BOWL_SEAM_COUNTS[v.pattern];
  return v.seams.length === n && v.seams.every(s => Number.isInteger(s) && s >= 0 && s < n) && new Set(v.seams).size === n;
}
