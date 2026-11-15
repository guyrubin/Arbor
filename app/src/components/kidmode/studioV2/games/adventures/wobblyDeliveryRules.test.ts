import { describe, expect, it } from 'vitest';
import { ASK_CARD_MS, ASK_HOLD_MS, BLOOM_MS, CARRY_MS, CARRY_STEPS, CARRY_STEP_MS, DELIVERY_FRIENDS, DELIVERY_ITEMS, DELIVERY_ROUNDS, DELIVERY_TILES, OOPS_MS, SUPPORT_AFTER, THANKS_MS, askMs, cardsStayUp, deliveryPick, leadsFor, requestFor, requestLength, shelfFor, tileTone, type DeliveryItem } from './wobblyDeliveryRules';

const CHALLENGES = ['gentle', 'explore'] as const;
const ROUNDS = [0, 1, 2] as const;
type Level = typeof CHALLENGES[number];
/** The toy scale every Bop game plays from has six steps (`BOP_SCALE`). */
const SCALE_STEPS = 6;
/** Twelve even chances: enough to reach every option of two, three, four, five or six. */
const GRID = Array.from({ length: 12 }, (_, i) => (i + 0.5) / 12);
/** Every request the rule can make for a round: each choice it takes is tried
 * at every place on the grid, so no reachable request is left out. */
function everyRequest(challenge: Level, round: number): DeliveryItem[][] {
  const found = new Map<string, DeliveryItem[]>();
  const walk = (script: number[]) => {
    let calls = 0, short = false;
    const request = requestFor(challenge, round, () => { if (calls < script.length) return script[calls++]; short = true; return 0; });
    if (short) { for (const value of GRID) walk([...script, value]); return; }
    found.set(request.join('|'), request);
  };
  walk([]);
  return [...found.values()];
}
/** The child's best play: each thing in order. Returns what every tap meant. */
function deliverInOrder(request: readonly DeliveryItem[]) {
  const delivered: DeliveryItem[] = [], results: string[] = [];
  for (const item of request) { results.push(deliveryPick(request, delivered, item)); delivered.push(item); }
  return results;
}

describe('Wobbly Delivery rules', () => {
  it('names six things, three friends in their order and three tiles from the shipped art', () => {
    expect(DELIVERY_ITEMS).toEqual(['item-can', 'item-journal', 'item-band', 'item-lamp', 'item-cushion', 'item-disc']);
    expect(new Set(DELIVERY_ITEMS).size).toBe(6);
    expect(DELIVERY_FRIENDS).toEqual(['aya', 'pep', 'chock']); expect(DELIVERY_ROUNDS).toBe(3);
    expect(DELIVERY_TILES).toEqual(['tile-yellow', 'tile-blue', 'tile-pink']);
  });
  it('puts four things on the small shelf and six on the big one, in one drawing order', () => {
    for (const round of ROUNDS) {
      const small = shelfFor('gentle', round), big = shelfFor('explore', round);
      expect(small).toHaveLength(4); expect(new Set(small).size).toBe(4);
      expect(big).toEqual([...DELIVERY_ITEMS]);
      for (const shelf of [small, big]) expect(shelf).toEqual(DELIVERY_ITEMS.filter(item => shelf.includes(item)));
      for (const challenge of CHALLENGES) for (const lead of leadsFor(round)) expect(shelfFor(challenge, round)).toContain(lead);
    }
    // Across one sitting the small shelf still gives every toy a turn.
    expect(new Set(ROUNDS.flatMap(round => shelfFor('gentle', round)))).toEqual(new Set(DELIVERY_ITEMS));
    expect(shelfFor('gentle', 0)).toEqual(['item-can', 'item-journal', 'item-band', 'item-lamp']);
  });
  it('asks for two, two, three things when gentle and three, three, four when exploring', () => {
    expect(ROUNDS.map(round => requestLength('gentle', round))).toEqual([2, 2, 3]);
    expect(ROUNDS.map(round => requestLength('explore', round))).toEqual([3, 3, 4]);
    for (const challenge of CHALLENGES) for (const round of ROUNDS) expect(requestLength(challenge, round)).toBeLessThan(shelfFor(challenge, round).length);
  });
  it('gives every round two leads of its own, so no two rounds can begin alike', () => {
    const leads = ROUNDS.map(round => leadsFor(round));
    for (const pair of leads) expect(pair).toHaveLength(2);
    expect(new Set(leads.flat()).size).toBe(6);
  });
  it('makes only requests of different things from that round\'s shelf, for every chance it can take', () => {
    const counts: Record<Level, number[]> = { gentle: [6, 6, 12], explore: [40, 40, 120] };
    for (const challenge of CHALLENGES) for (const round of ROUNDS) {
      const all = everyRequest(challenge, round), shelf = shelfFor(challenge, round);
      // Every ordered pick of the right length that starts on a lead is reachable, and nothing else.
      expect(all, `${challenge} ${round}`).toHaveLength(counts[challenge][round]);
      for (const request of all) {
        expect(request).toHaveLength(requestLength(challenge, round));
        expect(new Set(request).size).toBe(request.length);
        for (const item of request) expect(shelf).toContain(item);
        expect(leadsFor(round)).toContain(request[0]);
      }
    }
  });
  it('never repeats the request of the round before', () => {
    for (const challenge of CHALLENGES) for (const round of [1, 2]) {
      const before = new Set(everyRequest(challenge, round - 1).map(request => request.join('|')));
      for (const request of everyRequest(challenge, round)) expect(before.has(request.join('|')), `${challenge} ${round} ${request.join('|')}`).toBe(false);
    }
  });
  it('can always be delivered: each thing in order, the last one completes', () => {
    for (const challenge of CHALLENGES) for (const round of ROUNDS) for (const request of everyRequest(challenge, round)) {
      const results = deliverInOrder(request);
      expect(results.slice(0, -1).every(result => result === 'next')).toBe(true);
      expect(results[results.length - 1]).toBe('complete');
      // From every point on the way, exactly one thing on the shelf moves the game on.
      for (let done = 0; done < request.length; done++) {
        const forward = shelfFor(challenge, round).filter(item => ['next', 'complete'].includes(deliveryPick(request, request.slice(0, done), item)));
        expect(forward).toEqual([request[done]]);
      }
    }
  });
  it('reads a tap as next, complete, repeat or other, and never moves on for the last two', () => {
    const request: DeliveryItem[] = ['item-lamp', 'item-can', 'item-disc'];
    expect(deliveryPick(request, [], 'item-lamp')).toBe('next');
    expect(deliveryPick(request, [], 'item-can')).toBe('other');
    expect(deliveryPick(request, [], 'item-disc')).toBe('other');
    expect(deliveryPick(request, [], 'item-band')).toBe('other');
    expect(deliveryPick(request, ['item-lamp'], 'item-lamp')).toBe('repeat');
    expect(deliveryPick(request, ['item-lamp'], 'item-can')).toBe('next');
    expect(deliveryPick(request, ['item-lamp'], 'item-disc')).toBe('other');
    expect(deliveryPick(request, ['item-lamp', 'item-can'], 'item-can')).toBe('repeat');
    expect(deliveryPick(request, ['item-lamp', 'item-can'], 'item-disc')).toBe('complete');
    // Once everything is on the rug, nothing on the shelf can move the game.
    expect(deliveryPick(request, request, 'item-disc')).toBe('repeat');
    expect(deliveryPick(request, request, 'item-band')).toBe('other');
    expect(deliveryPick(['item-can'], [], 'item-can')).toBe('complete');
    expect(deliveryPick([], [], 'item-can')).toBe('other');
    expect(deliveryPick(request, [], 'item-kite' as never)).toBe('other');
  });
  it('is the same request for the same chance, and stays valid at the edges of chance', () => {
    for (const challenge of CHALLENGES) for (const round of ROUNDS) for (const seed of [0, 0.31, 0.5, 0.74, 0.999, 1, -1, 2, Number.NaN]) {
      const request = requestFor(challenge, round, () => seed);
      expect(requestFor(challenge, round, () => seed)).toEqual(request);
      expect(request).toHaveLength(requestLength(challenge, round));
      expect(new Set(request).size).toBe(request.length);
      for (const item of request) expect(shelfFor(challenge, round)).toContain(item);
    }
    expect(requestFor('gentle', 0, () => 0)).toEqual(['item-can', 'item-journal']);
    expect(requestFor('explore', 2, () => 0.999)).toEqual(['item-disc', 'item-cushion', 'item-lamp', 'item-band']);
    // A scripted chance source is read once for each thing, in order.
    const script = [0.9, 0.1, 0.6]; let calls = 0;
    expect(requestFor('explore', 0, () => script[calls++])).toEqual(['item-journal', 'item-can', 'item-cushion']);
    expect(calls).toBe(3);
  });
  it('treats any round number as a round of the game', () => {
    for (const challenge of CHALLENGES) {
      for (const early of [-1, -0.5, Number.NaN, Number.NEGATIVE_INFINITY]) { expect(shelfFor(challenge, early)).toEqual(shelfFor(challenge, 0)); expect(requestLength(challenge, early)).toBe(requestLength(challenge, 0)); expect(requestFor(challenge, early, () => 0)).toEqual(requestFor(challenge, 0, () => 0)); }
      for (const late of [3, 9, Number.POSITIVE_INFINITY]) { expect(shelfFor(challenge, late)).toEqual(shelfFor(challenge, 2)); expect(requestLength(challenge, late)).toBe(requestLength(challenge, 2)); expect(requestFor(challenge, late, () => 0)).toEqual(requestFor(challenge, 2, () => 0)); }
      expect(requestFor(challenge, 1.7, () => 0.4)).toEqual(requestFor(challenge, 1, () => 0.4));
    }
    expect(leadsFor(-3)).toEqual(leadsFor(0)); expect(leadsFor(7)).toEqual(leadsFor(2));
  });
  it('works with the real chance source too', () => {
    for (const challenge of CHALLENGES) for (const round of ROUNDS) for (let turn = 0; turn < 25; turn++) {
      const request = requestFor(challenge, round);
      expect(deliverInOrder(request).pop()).toBe('complete');
      for (const item of request) expect(shelfFor(challenge, round)).toContain(item);
    }
  });
  it('keeps the cards up for one beat a card and a hold, and half as long again with sound off', () => {
    expect(ASK_CARD_MS).toBe(1100); expect(ASK_HOLD_MS).toBe(900);
    expect([2, 3, 4].map(count => askMs(count, false))).toEqual([3100, 4200, 5300]);
    for (const count of [1, 2, 3, 4]) expect(askMs(count, true)).toBe(askMs(count, false) * 1.5);
    expect(askMs(0, false)).toBe(askMs(1, false)); expect(askMs(Number.NaN, false)).toBe(askMs(1, false));
  });
  it('locks input for about 1.4 seconds a carry, keeps the other beats short and lets the flower take its time', () => {
    expect(CARRY_STEPS).toBe(DELIVERY_TILES.length + 2);
    expect(CARRY_MS).toBe(CARRY_STEP_MS * CARRY_STEPS); expect(CARRY_MS).toBe(1400);
    expect(THANKS_MS).toBe(1200); expect(BLOOM_MS).toBe(2600); expect(OOPS_MS).toBe(600);
    expect(BLOOM_MS).toBeGreaterThan(THANKS_MS);
  });
  it('plays one rising note a tile, always a real step of the toy scale', () => {
    for (let done = 0; done < 4; done++) {
      const notes = DELIVERY_TILES.map((_, tile) => tileTone(done, tile));
      expect(notes).toEqual([done, done + 1, done + 2]);
      for (const note of notes) { expect(Number.isInteger(note)).toBe(true); expect(note).toBeGreaterThanOrEqual(0); expect(note).toBeLessThan(SCALE_STEPS); }
    }
    for (const [done, tile] of [[9, 2], [-4, 0], [Number.NaN, 1], [1.8, 1.2]]) { const note = tileTone(done, tile); expect(Number.isInteger(note)).toBe(true); expect(note).toBeGreaterThanOrEqual(0); expect(note).toBeLessThan(SCALE_STEPS); }
  });
  it('turns the quiet support on after two other picks, not before', () => {
    expect(SUPPORT_AFTER).toBe(2);
    expect([0, 1, 2, 3].map(cardsStayUp)).toEqual([false, false, true, true]);
  });
});
