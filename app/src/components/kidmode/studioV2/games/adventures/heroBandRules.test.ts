import { describe, expect, it } from 'vitest';
import { BAND_MOVES, DANCE_TEMPOS, LOOP_STEPS, defaultTempo, emptyLoop, filledSteps, movesFor, phraseFor, phraseMatches, placeMove, tapStep, validDance, validMove } from './heroBandRules';
import { HERO_POSES } from '../../../hero/heroSheet';

describe('Hero Band rules', () => {
  it('builds every move from an existing approved pose, each one different', () => {
    expect(BAND_MOVES.map(move => move.id)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const move of BAND_MOVES) expect(HERO_POSES).toContain(move.pose);
    expect(new Set(BAND_MOVES.map(move => move.pose)).size).toBe(BAND_MOVES.length);
    expect(new Set(BAND_MOVES.map(move => move.motion)).size).toBe(BAND_MOVES.length);
    // Idle is the rest between moves and cheer is the celebration.
    expect(BAND_MOVES.some(move => move.pose === 'idle' || move.pose === 'cheer')).toBe(false);
  });
  it('gives younger children four pads and a slower beat', () => {
    expect(movesFor('gentle')).toEqual([0, 1, 2, 3]); expect(movesFor('explore')).toHaveLength(6);
    expect(defaultTempo('gentle')).toBeGreaterThan(defaultTempo('explore'));
    expect(DANCE_TEMPOS).toContain(defaultTempo('gentle')); expect(DANCE_TEMPOS).toContain(defaultTempo('explore'));
  });
  it('grows the phrase to copy by one move a round, from allowed moves, never repeating in a row', () => {
    for (const challenge of ['gentle', 'explore'] as const) for (let round = 0; round < 4; round++) for (const seed of [0, 0.31, 0.74, 0.999, 1]) {
      const phrase = phraseFor(challenge, round, () => seed);
      expect(phrase).toHaveLength((challenge === 'gentle' ? 2 : 3) + Math.min(2, round));
      phrase.forEach((move, i) => { expect(movesFor(challenge)).toContain(move); if (i) expect(move).not.toBe(phrase[i - 1]); });
    }
    expect(phraseMatches([0, 1], [0, 1])).toBe(true); expect(phraseMatches([0, 1], [0])).toBe(false); expect(phraseMatches([0, 1], [1, 0])).toBe(false);
  });
  it('places and removes moves in an eight-step loop without touching the original', () => {
    const loop = emptyLoop(); expect(loop).toHaveLength(LOOP_STEPS); expect(filledSteps(loop)).toBe(0);
    const one = placeMove(loop, 3, 2); expect(one[3]).toBe(2); expect(loop[3]).toBeNull(); expect(filledSteps(one)).toBe(1);
    expect(placeMove(one, 3, null)[3]).toBeNull();
    expect(placeMove(one, 8, 1)).toEqual(one); expect(placeMove(one, -1, 1)).toEqual(one); expect(placeMove(one, 0, 9 as never)).toEqual(one);
  });
  it('keeps only a bounded dance', () => {
    const dance = placeMove(emptyLoop(), 0, 5);
    expect(validDance(dance, 500)).toBe(true);
    const bad: [unknown, unknown][] = [[emptyLoop(), 500], [dance, 501], [dance.slice(1), 500], [[...dance.slice(1), 7], 500], ['dance', 500], [null, 500]];
    for (const [moves, tempo] of bad) expect(validDance(moves, tempo)).toBe(false);
    expect(validMove(5)).toBe(true); expect(validMove(6)).toBe(false); expect(validMove(1.5)).toBe(false); expect(validMove('1')).toBe(false);
  });
  it('gives a tap to the step it was reaching for', () => {
    expect(tapStep(0, 500)).toEqual({ absolute: 0, step: 0, upcoming: false });
    expect(tapStep(240, 500)).toEqual({ absolute: 0, step: 0, upcoming: false });
    expect(tapStep(260, 500)).toEqual({ absolute: 1, step: 1, upcoming: true });
    expect(tapStep(3990, 500)).toEqual({ absolute: 8, step: 0, upcoming: true });
    expect(tapStep(-30, 500).absolute).toBe(0);
  });
});
