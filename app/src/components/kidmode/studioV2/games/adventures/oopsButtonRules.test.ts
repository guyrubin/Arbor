import { describe, expect, it } from 'vitest';
import type { Challenge } from './adventureRules';
import { BLOOM_MS, HOLD_MS, OOPS_ROUNDS, OPEN_MS, PETALS, PETAL_ART, SCRIPTED_JAM_ROUND, SETTLE_MS, UNDO_HINT_AFTER, WATCH_LEAD_MS, WOBBLE_MS, copyPress, orderFor, orderLength, toyJams, undoCheck, undoHint, watchMs, type PetalId } from './oopsButtonRules';

const CHALLENGES: readonly Challenge[] = ['gentle', 'explore'];
const ROUNDS = [0, 1, 2] as const;
const LENGTHS: Record<Challenge, readonly number[]> = { gentle: [2, 3, 3], explore: [3, 4, 5] };
const CASES = CHALLENGES.flatMap(challenge => ROUNDS.map(round => ({ challenge, round, length: LENGTHS[challenge][round] })));

/** A random source that plays back the given rolls, then zeros. */
function rolls(...values: number[]): () => number { let next = 0; return () => values[next++] ?? 0; }
/** Every way the shuffle of five petals can fall: one roll for each of its four swaps. */
function everyShuffle(): number[][] {
  const all: number[][] = [];
  for (let a = 0; a < 5; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 3; c++) for (let d = 0; d < 2; d++) all.push([(a + .5) / 5, (b + .5) / 4, (c + .5) / 3, (d + .5) / 2]);
  return all;
}
const SHUFFLES = everyShuffle();
const isOrder = (order: readonly number[], length: number) => order.length === length && new Set(order).size === length && order.every(petal => PETALS.includes(petal as PetalId));
/** How many different orders of `length` petals five petals allow. */
const arrangements = (length: number) => Array.from({ length }, (_, index) => 5 - index).reduce((total, value) => total * value, 1);

describe('Oops Button rules: the toy', () => {
  it('has five petals, each with its own drawing and its own tone step', () => {
    expect(PETALS).toEqual([0, 1, 2, 3, 4]);
    expect(PETAL_ART).toEqual(['petal-amber', 'petal-blue', 'petal-teal', 'petal-coral', 'petal-violet']);
    expect(new Set(PETAL_ART).size).toBe(PETALS.length);
    // The shared toy scale has six steps (0 to 5); every petal id is one of them.
    for (const petal of PETALS) expect(petal).toBeLessThan(6);
  });

  it('plays three rounds and keeps the timings the game is built on', () => {
    expect(OOPS_ROUNDS).toBe(3);
    expect(OPEN_MS).toBe(700);
    expect(BLOOM_MS).toBe(2400);
    for (const ms of [WATCH_LEAD_MS, HOLD_MS, SETTLE_MS, WOBBLE_MS]) expect(ms).toBeGreaterThan(0);
  });

  it('shows an order for as long as its petals take, then holds', () => {
    for (let length = 1; length <= 5; length++) expect(watchMs(length)).toBe(WATCH_LEAD_MS + (length - 1) * OPEN_MS + HOLD_MS);
    expect(watchMs(5)).toBeGreaterThan(watchMs(4));
    for (const odd of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(watchMs(odd)).toBe(watchMs(1));
    expect(watchMs(2.9)).toBe(watchMs(2));
  });
});

describe('Oops Button rules: the order', () => {
  it.each(CASES)('$challenge round $round opens $length petals', ({ challenge, round, length }) => {
    expect(orderLength(challenge, round)).toBe(length);
  });

  it.each(CHALLENGES)('%s plays an odd round number as the nearest real round', challenge => {
    expect(orderLength(challenge, -1)).toBe(LENGTHS[challenge][0]);
    expect(orderLength(challenge, Number.NEGATIVE_INFINITY)).toBe(LENGTHS[challenge][0]);
    expect(orderLength(challenge, Number.NaN)).toBe(LENGTHS[challenge][0]);
    expect(orderLength(challenge, 1.7)).toBe(LENGTHS[challenge][1]);
    expect(orderLength(challenge, 3)).toBe(LENGTHS[challenge][2]);
    expect(orderLength(challenge, Number.POSITIVE_INFINITY)).toBe(LENGTHS[challenge][2]);
  });

  it.each(CASES)('$challenge round $round: every shuffle gives distinct petals, and every order can come up', ({ challenge, round, length }) => {
    const seen = new Set<string>();
    for (const shuffle of SHUFFLES) {
      const order = orderFor(challenge, round, rolls(...shuffle));
      expect(isOrder(order, length), `${shuffle.join(',')} gave ${order.join('')}`).toBe(true);
      seen.add(order.join(''));
    }
    expect(SHUFFLES).toHaveLength(120);
    expect(seen.size).toBe(arrangements(length));
  });

  it.each(CASES)('$challenge round $round: the same rolls give the same order', ({ challenge, round }) => {
    for (const shuffle of SHUFFLES) expect(orderFor(challenge, round, rolls(...shuffle))).toEqual(orderFor(challenge, round, rolls(...shuffle)));
    let asked = 0;
    orderFor(challenge, round, () => { asked++; return .42; });
    expect(asked).toBe(4);
  });

  it.each(CASES)('$challenge round $round: an odd random source still gives a real order', ({ challenge, round, length }) => {
    for (const value of [0, .31, .5, .74, .999, 1, -1, 2, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(isOrder(orderFor(challenge, round, () => value), length), String(value)).toBe(true);
    }
    for (let run = 0; run < 40; run++) expect(isOrder(orderFor(challenge, round), length)).toBe(true);
  });

  it.each(CASES)('$challenge round $round: a new round never repeats the order just played', ({ challenge, round, length }) => {
    for (const shuffle of SHUFFLES) {
      const before = orderFor(challenge, round, rolls(...shuffle));
      const after = orderFor(challenge, round, rolls(...shuffle), before);
      expect(isOrder(after, length)).toBe(true);
      expect(after).not.toEqual(before);
      expect([...after].sort()).toEqual([...before].sort());
      // An order of another length, or another order, changes nothing.
      expect(orderFor(challenge, round, rolls(...shuffle), [...before, before[0]])).toEqual(before);
      expect(orderFor(challenge, round, rolls(...shuffle), after)).toEqual(before);
      expect(orderFor(challenge, round, rolls(...shuffle), [])).toEqual(before);
    }
  });
});

describe('Oops Button rules: the child copies', () => {
  it.each(CASES)('$challenge round $round: every order can be copied, petal by petal, to a bloom', ({ challenge, round, length }) => {
    for (const shuffle of SHUFFLES) {
      const order = orderFor(challenge, round, rolls(...shuffle));
      const opened: PetalId[] = [];
      order.forEach((petal, index) => {
        expect(copyPress(order, opened, petal)).toBe(index === length - 1 ? 'bloom' : 'open');
        opened.push(petal);
      });
      expect(opened).toEqual(order);
      // Once it has bloomed, no press does anything more.
      for (const petal of PETALS) expect(copyPress(order, opened, petal)).toBe('again');
    }
  });

  it.each(CASES)('$challenge round $round: at every step one petal is right, open ones do nothing, and any other jams', ({ challenge, round }) => {
    for (const shuffle of SHUFFLES) {
      const order = orderFor(challenge, round, rolls(...shuffle));
      for (let step = 0; step < order.length; step++) {
        const opened = order.slice(0, step);
        const right = PETALS.filter(petal => { const result = copyPress(order, opened, petal); return result === 'open' || result === 'bloom'; });
        expect(right).toEqual([order[step]]);
        for (const petal of PETALS) {
          if (petal === order[step]) continue;
          expect(copyPress(order, opened, petal)).toBe(opened.includes(petal) ? 'again' : 'jam');
        }
      }
    }
  });

  it('ignores a press that is not a petal', () => {
    const order: PetalId[] = [2, 0, 4];
    for (const odd of [-1, 5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(copyPress(order, [], odd)).toBe('again');
      expect(copyPress(order, [2], odd)).toBe('again');
    }
    expect(copyPress([], [], 0)).toBe('again');
  });

  it('lets the toy jam by itself only once, in round two, right after the first right press', () => {
    expect(SCRIPTED_JAM_ROUND).toBe(1);
    for (const round of ROUNDS) for (let count = 0; count <= 5; count++) for (const used of [false, true]) {
      expect(toyJams(round, count, used), `${round}:${count}:${used}`).toBe(round === SCRIPTED_JAM_ROUND && count === 1 && !used);
    }
    // Round two always has a petal left after the first, so the toy's jam always comes before the bloom.
    for (const challenge of CHALLENGES) expect(orderLength(challenge, SCRIPTED_JAM_ROUND)).toBeGreaterThan(1);
  });
});

describe('Oops Button rules: putting the petals back', () => {
  it.each(CASES)('$challenge round $round: after any jam the petals go back last one first, and only that way', ({ challenge, round }) => {
    for (const shuffle of SHUFFLES) {
      const order = orderFor(challenge, round, rolls(...shuffle));
      for (let step = 0; step < order.length; step++) {
        for (const wrong of PETALS) {
          if (copyPress(order, order.slice(0, step), wrong) !== 'jam') continue;
          // The petal that jammed is half open: it counts as the last one opened.
          let opened: PetalId[] = [...order.slice(0, step), wrong];
          let closes = 0;
          while (opened.length > 0) {
            const last = opened[opened.length - 1];
            for (const petal of PETALS) {
              expect(undoCheck(opened, petal)).toBe(petal === last ? 'close' : opened.includes(petal) ? 'wait' : 'closed');
            }
            opened = opened.slice(0, -1); closes++;
          }
          expect(closes).toBe(step + 1);
          // All back: nothing is open, so the same order can be shown and copied again.
          for (const petal of PETALS) expect(undoCheck(opened, petal)).toBe('closed');
          expect(copyPress(order, opened, order[0])).toBe(order.length === 1 ? 'bloom' : 'open');
        }
      }
    }
  });

  it('puts the one open petal back after the toy jams by itself', () => {
    for (const challenge of CHALLENGES) for (const shuffle of SHUFFLES) {
      const order = orderFor(challenge, SCRIPTED_JAM_ROUND, rolls(...shuffle));
      expect(copyPress(order, [], order[0])).toBe('open');
      expect(toyJams(SCRIPTED_JAM_ROUND, 1, false)).toBe(true);
      expect(undoCheck([order[0]], order[0])).toBe('close');
      expect(toyJams(SCRIPTED_JAM_ROUND, 1, true)).toBe(false);
    }
  });

  it('treats a press that is not a petal as nothing to put back', () => {
    for (const odd of [-1, 5, 1.5, Number.NaN]) expect(undoCheck([3, 1], odd)).toBe('closed');
    expect(undoCheck([], 0)).toBe('closed');
  });

  it('rings the petal to put back after one press on a petal that must wait', () => {
    expect(UNDO_HINT_AFTER).toBe(1);
    const opened: PetalId[] = [4, 1, 3];
    expect(undoHint(opened, 0)).toBeNull();
    expect(undoHint(opened, 1)).toBe(3);
    expect(undoHint(opened, 7)).toBe(3);
    expect(undoHint(opened.slice(0, 2), 1)).toBe(1);
    expect(undoHint(opened.slice(0, 1), 1)).toBe(4);
    expect(undoHint([], 1)).toBeNull();
    expect(undoHint([], 0)).toBeNull();
    // The hint is always the one petal that `undoCheck` will close.
    expect(undoCheck(opened, undoHint(opened, 1) ?? -1)).toBe('close');
  });
});
