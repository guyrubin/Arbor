/** Five-Friend Sun rules, checked over both challenges and every place on the path. */
import { describe, expect, it, vi } from 'vitest';
import type { Challenge } from './adventureRules';
import { CHOCK_SEAT, FRIEND_TOTAL, HERO_SEAT, HOP_MS, JOIN_MS, PADS, PATH_END, SEAT_PADS, SUN_MS, SUN_SEATS, WOBBLE_MS, countOn, friendsJoined, hintAfter, hintShown, hopCheck, nextArrival, padCell, spinFor, spinMax, wheelTurn, type Arrival } from './fiveFriendSunRules';

const CHALLENGES: readonly Challenge[] = ['gentle', 'explore'];
const POSITIONS: readonly number[] = Array.from({ length: PATH_END + 1 }, (_, index) => index);
const ROLLS: readonly number[] = [0, 0.0001, 0.2, 0.31, 0.34, 0.49, 0.5, 0.66, 0.67, 0.74, 0.9, 0.999999];
const OFF_PATH: readonly number[] = [-1, PATH_END + 1, 2.5, Number.NaN, Number.POSITIVE_INFINITY];
/** A small seeded generator, so a whole game can be replayed exactly. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
/** Plays one whole game by the rules alone and reports what happened. */
function playGame(challenge: Challenge, random: () => number) {
  let position = 0, seated = 0, turns = 0;
  const arrivals: Arrival[] = [], stops: number[] = [], spins: number[] = [];
  while (position < PATH_END && turns < 50) {
    const spin = spinFor(challenge, position, random);
    if (spin < 1) break;
    turns++; spins.push(spin); position += spin; stops.push(position);
    for (let next = nextArrival(position, seated); next !== 'none'; next = nextArrival(position, seated)) { arrivals.push(next); seated++; }
  }
  return { position, seated, turns, arrivals, stops, spins };
}

describe('Five-Friend Sun: the path and the circle', () => {
  it('has ten pads after the start mat and five seats in petal order', () => {
    expect(PATH_END).toBe(10); expect(FRIEND_TOTAL).toBe(5);
    expect(PADS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(SUN_SEATS).toEqual(['sprout', 'aya', 'pep', 'chock', 'hero']);
    expect(SEAT_PADS).toEqual(['pad-amber', 'pad-blue', 'pad-teal', 'pad-white', 'pad-navy']);
    expect(SUN_SEATS).toHaveLength(FRIEND_TOTAL); expect(SEAT_PADS).toHaveLength(FRIEND_TOTAL);
    expect(SUN_SEATS.indexOf('chock')).toBe(CHOCK_SEAT); expect(SEAT_PADS[CHOCK_SEAT]).toBe('pad-white');
    expect(SUN_SEATS.indexOf('hero')).toBe(HERO_SEAT); expect(HERO_SEAT).toBe(FRIEND_TOTAL - 1); expect(SEAT_PADS[HERO_SEAT]).toBe('pad-navy');
  });
  it('lays the path as two rows of five that run out and back', () => {
    const cells = POSITIONS.map(padCell);
    expect(new Set(cells.map(cell => `${cell.column}:${cell.row}`)).size).toBe(PATH_END + 1);
    expect(cells[0]).toEqual({ column: 0, row: 0 });
    expect([1, 2, 3, 4, 5].map(pad => padCell(pad))).toEqual([1, 2, 3, 4, 5].map(column => ({ column, row: 0 })));
    expect([6, 7, 8, 9, 10].map(pad => padCell(pad))).toEqual([5, 4, 3, 2, 1].map(column => ({ column, row: 1 })));
    for (let at = 1; at <= PATH_END; at++) {
      const from = cells[at - 1], to = cells[at];
      // Every hop is one pad along a row, or the one step up at the turn.
      expect(Math.abs(to.column - from.column) + Math.abs(to.row - from.row), `pad ${at}`).toBe(1);
      expect(to.column).toBeGreaterThanOrEqual(1); expect(to.column).toBeLessThanOrEqual(5);
    }
    expect(padCell(5).column).toBe(padCell(6).column);
    expect(padCell(-4)).toEqual(padCell(0)); expect(padCell(99)).toEqual(padCell(PATH_END));
    expect(padCell(Number.NaN)).toEqual(padCell(0)); expect(padCell(3.9)).toEqual(padCell(3));
  });
  it('keeps every beat short, and the finished sun long enough to take in', () => {
    expect(HOP_MS).toBe(380); expect(SUN_MS).toBe(2600); expect(SUN_MS).toBeGreaterThan(JOIN_MS);
    expect(JOIN_MS).toBeGreaterThanOrEqual(HOP_MS); expect(JOIN_MS).toBeLessThanOrEqual(2000);
    expect(WOBBLE_MS).toBeGreaterThan(0); expect(WOBBLE_MS).toBeLessThan(2 * HOP_MS);
  });
});

describe.each(CHALLENGES)('Five-Friend Sun: the spinner (%s)', challenge => {
  const most = spinMax(challenge);
  it('asks for a small whole hop that never passes the last pad', () => {
    expect(most).toBe(challenge === 'gentle' ? 2 : 3);
    for (const position of POSITIONS) for (const roll of ROLLS) {
      const spin = spinFor(challenge, position, () => roll);
      if (position === PATH_END) { expect(spin).toBe(0); continue; }
      expect(Number.isInteger(spin), `${position} @ ${roll}`).toBe(true);
      expect(spin).toBeGreaterThanOrEqual(1); expect(spin).toBeLessThanOrEqual(most);
      expect(position + spin).toBeLessThanOrEqual(PATH_END);
    }
  });
  it('can show every face that fits, and only those', () => {
    for (const position of POSITIONS.slice(0, PATH_END)) {
      const room = Math.min(most, PATH_END - position);
      const faces = new Set(ROLLS.map(roll => spinFor(challenge, position, () => roll)));
      expect([...faces].sort((a, b) => a - b), `from ${position}`).toEqual(Array.from({ length: room }, (_, index) => index + 1));
    }
    expect(spinFor(challenge, PATH_END - 1, () => 0.999999)).toBe(1);
    expect(spinFor(challenge, PATH_END - 2, () => 0.999999)).toBe(2);
  });
  it('gives the same hop for the same roll, and reads the roll once', () => {
    for (const position of POSITIONS) for (const roll of ROLLS) {
      const random = vi.fn(() => roll);
      expect(spinFor(challenge, position, random)).toBe(spinFor(challenge, position, () => roll));
      expect(random.mock.calls.length).toBeLessThanOrEqual(1);
    }
    const first = seeded(7), second = seeded(7);
    expect(POSITIONS.map(position => spinFor(challenge, position, first))).toEqual(POSITIONS.map(position => spinFor(challenge, position, second)));
    const roll = vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    try { expect(spinFor(challenge, 0)).toBe(most); expect(roll).toHaveBeenCalledTimes(1); } finally { roll.mockRestore(); }
  });
  it('stays in range when the roll misbehaves, and gives no hop off the path', () => {
    for (const position of POSITIONS.slice(0, PATH_END)) for (const roll of [1, 1.7, 42, -0.3, -5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const spin = spinFor(challenge, position, () => roll);
      expect(Number.isInteger(spin), `${position} @ ${roll}`).toBe(true);
      expect(spin).toBeGreaterThanOrEqual(1); expect(position + spin).toBeLessThanOrEqual(PATH_END); expect(spin).toBeLessThanOrEqual(most);
    }
    for (const position of OFF_PATH) expect(spinFor(challenge, position, () => 0.5), String(position)).toBe(0);
  });
  it('always has exactly one landing pad, and it is a real pad', () => {
    for (const position of POSITIONS.slice(0, PATH_END)) for (const roll of ROLLS) {
      const spin = spinFor(challenge, position, () => roll);
      const landing = PADS.filter(pad => hopCheck(position, spin, pad) === 'land');
      expect(landing, `${position} + ${spin}`).toEqual([position + spin]);
      expect(countOn(position, spin)).toHaveLength(spin); expect(countOn(position, spin).at(-1)).toBe(position + spin);
    }
  });
  it('ends every game on the last pad with all five seated, in order', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const game = playGame(challenge, seeded(seed));
      expect(game.position, `seed ${seed}`).toBe(PATH_END); expect(game.seated).toBe(FRIEND_TOTAL);
      expect(game.arrivals).toEqual(['friend', 'friend', 'friend', 'make-room', 'sun']);
      expect(game.turns).toBeGreaterThanOrEqual(Math.ceil(PATH_END / most)); expect(game.turns).toBeLessThanOrEqual(PATH_END);
      expect(game.stops).toEqual([...game.stops].sort((a, b) => a - b)); expect(new Set(game.stops).size).toBe(game.stops.length);
      expect(game.spins.every(spin => spin >= 1 && spin <= most)).toBe(true);
    }
    expect(playGame(challenge, seeded(11))).toEqual(playGame(challenge, seeded(11)));
    // The slowest and the quickest game both finish.
    expect(playGame(challenge, () => 0).turns).toBe(PATH_END);
    expect(playGame(challenge, () => 0.999999).stops.at(-1)).toBe(PATH_END);
  });
  it('points out the landing pad after the right number of other taps', () => {
    const after = hintAfter(challenge);
    expect(after).toBe(challenge === 'gentle' ? 1 : 2);
    for (let misses = 0; misses <= 6; misses++) expect(hintShown(challenge, misses), `${misses} taps`).toBe(misses >= after);
  });
});

describe('Five-Friend Sun: counting on', () => {
  it('sorts every pad into the landing pad, short of it, past it or behind the hero', () => {
    for (const position of POSITIONS.slice(0, PATH_END)) for (let spin = 1; spin <= Math.min(3, PATH_END - position); spin++) for (const pad of PADS) {
      const expected = pad <= position ? 'back' : pad < position + spin ? 'short' : pad === position + spin ? 'land' : 'far';
      expect(hopCheck(position, spin, pad), `${position} + ${spin}, tapped ${pad}`).toBe(expected);
    }
    expect(hopCheck(3, 2, 5)).toBe('land'); expect(hopCheck(3, 2, 4)).toBe('short'); expect(hopCheck(3, 2, 6)).toBe('far');
    expect(hopCheck(3, 2, 3)).toBe('back'); expect(hopCheck(3, 2, 1)).toBe('back'); expect(hopCheck(0, 1, 1)).toBe('land');
  });
  it('lands nowhere until the spinner has shown a hop', () => {
    for (const position of POSITIONS) for (const pad of PADS) expect(hopCheck(position, 0, pad), `${position}, tapped ${pad}`).not.toBe('land');
  });
  it('counts each pad after the hero, up to the landing pad', () => {
    for (const position of POSITIONS) for (let spin = 0; spin <= 3; spin++) {
      const count = countOn(position, spin), length = Math.min(spin, PATH_END - position);
      expect(count, `${position} + ${spin}`).toEqual(Array.from({ length }, (_, index) => position + 1 + index));
      expect(count.every(pad => PADS.includes(pad))).toBe(true);
    }
    expect(countOn(3, 2)).toEqual([4, 5]); expect(countOn(0, 3)).toEqual([1, 2, 3]); expect(countOn(9, 3)).toEqual([10]);
    expect(countOn(4, -2)).toEqual([]); expect(countOn(4, 1.5)).toEqual([]);
    for (const position of OFF_PATH) expect(countOn(position, 2), String(position)).toEqual([]);
  });
});

describe('Five-Friend Sun: who is in the circle', () => {
  it('brings one more friend at 2, 4, 6, 8 and 10', () => {
    expect(POSITIONS.map(friendsJoined)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
    expect(friendsJoined(PATH_END)).toBe(FRIEND_TOTAL);
    expect(friendsJoined(-3)).toBe(0); expect(friendsJoined(99)).toBe(FRIEND_TOTAL); expect(friendsJoined(Number.NaN)).toBe(0);
  });
  it('fills one seat at a time: three friends, then a place for Chock, then the child', () => {
    for (const position of POSITIONS) for (let seated = 0; seated <= FRIEND_TOTAL; seated++) {
      const expected: Arrival = seated >= friendsJoined(position) ? 'none' : seated < CHOCK_SEAT ? 'friend' : seated === CHOCK_SEAT ? 'make-room' : 'sun';
      expect(nextArrival(position, seated), `on ${position} with ${seated} seated`).toBe(expected);
    }
    expect(nextArrival(1, 0)).toBe('none'); expect(nextArrival(2, 0)).toBe('friend'); expect(nextArrival(2, 1)).toBe('none');
    expect(nextArrival(7, 3)).toBe('none'); expect(nextArrival(8, 3)).toBe('make-room'); expect(nextArrival(8, 4)).toBe('none');
    expect(nextArrival(9, 4)).toBe('none'); expect(nextArrival(10, 4)).toBe('sun'); expect(nextArrival(10, 5)).toBe('none');
  });
  it('still seats everyone, in order, when one hop passes two friends', () => {
    // 1 to 4 passes Sprout and Aya; 7 to 10 passes Chock and the child's own seat.
    expect([nextArrival(4, 0), nextArrival(4, 1), nextArrival(4, 2)]).toEqual(['friend', 'friend', 'none']);
    expect([nextArrival(10, 3), nextArrival(10, 4), nextArrival(10, 5)]).toEqual(['make-room', 'sun', 'none']);
    const game = playGame('explore', (() => { const rolls = [0, 0.999999, 0.999999, 0.999999]; let turn = 0; return () => rolls[Math.min(turn++, rolls.length - 1)]; })());
    expect(game.stops).toEqual([1, 4, 7, 10]); expect(game.arrivals).toEqual(['friend', 'friend', 'friend', 'make-room', 'sun']);
  });
});

describe('the spinner wheel (B-GAME-43)', () => {
  it("stops with each hop's own wedge under the pointer, always turning forward at least twice", () => {
    for (const faces of [2, 3]) {
      let at = 0;
      for (const spin of [1, faces, 1, 2, faces, 1].filter(value => value <= faces)) {
        const next = wheelTurn(at, spin, faces);
        expect(next - at, `${faces} faces, hop ${spin}`).toBeGreaterThanOrEqual(720);
        // The wheel turned clockwise by `next`, so the wedge centred at c from the top now sits at c + next.
        const centre = (spin - .5) * 360 / faces;
        expect(((centre + next) % 360 + 360) % 360).toBeCloseTo(0);
        at = next;
      }
    }
    expect(wheelTurn(Number.NaN, 9, 3)).toBe(780);
  });
});
