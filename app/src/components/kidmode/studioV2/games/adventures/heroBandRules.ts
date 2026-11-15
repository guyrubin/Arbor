import type { HeroPoseId } from '../../../hero/heroSheet';
import type { Challenge } from './adventureRules';

/** Hero Band: every pad is one move of the child's own hero. A move is an
 * existing approved pose plus a motion; no new art, no model call, no score. */
export type MoveId = 0 | 1 | 2 | 3 | 4 | 5;
export type BandMotion = 'jump' | 'zoom' | 'snap' | 'wobble' | 'hop' | 'spin';
export interface BandMove { id: MoveId; pose: HeroPoseId; motion: BandMotion }
export const BAND_MOVES: readonly BandMove[] = [
  { id: 0, pose: 'hold-up', motion: 'jump' },
  { id: 1, pose: 'dash', motion: 'zoom' },
  { id: 2, pose: 'freeze-a', motion: 'snap' },
  { id: 3, pose: 'oops', motion: 'wobble' },
  { id: 4, pose: 'tiptoe', motion: 'hop' },
  { id: 5, pose: 'freeze-b', motion: 'spin' },
];
export const LOOP_STEPS = 8;
/** Milliseconds per step: slow, flowing, bouncy. */
export const DANCE_TEMPOS = [640, 500, 400] as const;
export type DanceTempo = typeof DANCE_TEMPOS[number];
export type DanceLoop = readonly (MoveId | null)[];

export function validMove(value: unknown): value is MoveId {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < BAND_MOVES.length;
}
export function validTempo(value: unknown): value is DanceTempo {
  return (DANCE_TEMPOS as readonly unknown[]).includes(value);
}
/** A kept dance is exactly eight steps with at least one move in it. */
export function validDance(moves: unknown, tempo: unknown): moves is DanceLoop {
  return Array.isArray(moves) && moves.length === LOOP_STEPS && moves.every(m => m === null || validMove(m)) && moves.some(m => m !== null) && validTempo(tempo);
}
export function movesFor(challenge: Challenge): readonly MoveId[] {
  return challenge === 'gentle' ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5];
}
export function defaultTempo(challenge: Challenge): DanceTempo {
  return challenge === 'gentle' ? 640 : 500;
}
/** A short phrase to copy. The same move never comes twice in a row, so each
 * step is a visible change of pose. */
export function phraseFor(challenge: Challenge, round: number, random = Math.random): MoveId[] {
  const pool = movesFor(challenge);
  const length = (challenge === 'gentle' ? 2 : 3) + Math.min(2, Math.max(0, Math.trunc(round)));
  const phrase: MoveId[] = [];
  while (phrase.length < length) {
    const options = pool.filter(move => move !== phrase[phrase.length - 1]);
    phrase.push(options[Math.min(options.length - 1, Math.max(0, Math.floor(random() * options.length)))]);
  }
  return phrase;
}
export function phraseMatches(target: readonly MoveId[], played: readonly MoveId[]): boolean {
  return target.length === played.length && target.every((move, i) => move === played[i]);
}
export function emptyLoop(): (MoveId | null)[] {
  return Array.from({ length: LOOP_STEPS }, () => null);
}
export function placeMove(loop: DanceLoop, step: number, move: MoveId | null): (MoveId | null)[] {
  const next = [...loop];
  if (Number.isInteger(step) && step >= 0 && step < LOOP_STEPS && (move === null || validMove(move))) next[step] = move;
  return next;
}
export function filledSteps(loop: DanceLoop): number {
  return loop.filter(move => move !== null).length;
}
/** The step a tap belongs to. A tap just before the light arrives counts for
 * the step it was reaching for, so a small child is never "late" or "early". */
export function tapStep(elapsedMs: number, tempo: number): { absolute: number; step: number; upcoming: boolean } {
  const absolute = Math.max(0, Math.round(elapsedMs / tempo));
  return { absolute, step: absolute % LOOP_STEPS, upcoming: absolute * tempo > elapsedMs };
}
