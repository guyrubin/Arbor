import { shuffled, type Challenge } from './adventureRules';

/** Oops Button rules. A toy flower opens its petals in an order and the child
 * copies it. A jam is never an ending: pause, put the petals back last one
 * first, restart, and the same order is shown again. Nothing here counts
 * mistakes; the only number the game keeps is how many times it bloomed. */
export type PetalId = 0 | 1 | 2 | 3 | 4;
/** Clockwise from the top of the toy. The index is also the petal's tone. */
export const PETALS: readonly PetalId[] = [0, 1, 2, 3, 4];
export const PETAL_ART = ['petal-amber', 'petal-blue', 'petal-teal', 'petal-coral', 'petal-violet'] as const;
export const OOPS_ROUNDS = 3;
/** Round two (counted from zero) holds the one jam that is the toy's doing. */
export const SCRIPTED_JAM_ROUND = 1;

/** A breath before the first petal, so the child is looking at the toy. */
export const WATCH_LEAD_MS = 800;
/** From one petal opening to the next while the toy shows its order. */
export const OPEN_MS = 700;
/** The whole order stays open this long before the petals close again. */
export const HOLD_MS = 900;
/** The petals have closed; the child's turn starts after this. */
export const SETTLE_MS = 450;
/** The open flower glows this long before the next round: long enough for a
 * small child to see what they made, short enough that the game keeps moving. */
export const BLOOM_MS = 2400;
/** One wobble of a petal. Decoration only: nothing waits for it. */
export const WOBBLE_MS = 460;

const LENGTHS: Readonly<Record<Challenge, readonly number[]>> = { gentle: [2, 3, 3], explore: [3, 4, 5] };

function isPetal(value: number): value is PetalId {
  return Number.isInteger(value) && value >= 0 && value < PETALS.length;
}

/** How many petals open in a round. An odd round number plays as the nearest real round. */
export function orderLength(challenge: Challenge, round: number): number {
  const steps = LENGTHS[challenge];
  const index = Number.isNaN(round) ? 0 : Math.min(steps.length - 1, Math.max(0, Math.trunc(round)));
  return steps[index];
}

/** The order for a round: distinct petals, so every round can be copied and
 * every petal put back. `previous` is the order just played; the next round
 * never repeats it exactly, so a new round always looks new. */
export function orderFor(challenge: Challenge, round: number, random: () => number = Math.random, previous: readonly PetalId[] = []): PetalId[] {
  const roll = () => { const value = random(); return Number.isFinite(value) ? value : 0; };
  const order = shuffled(PETALS, roll).slice(0, orderLength(challenge, round));
  const same = order.length === previous.length && order.every((petal, index) => petal === previous[index]);
  return same ? [...order.slice(1), order[0]] : order;
}

/** From the start of the showing until every petal has closed again. */
export function watchMs(length: number): number {
  const count = Number.isFinite(length) ? Math.max(1, Math.trunc(length)) : 1;
  return WATCH_LEAD_MS + (count - 1) * OPEN_MS + HOLD_MS;
}

/** What a petal press does on the child's turn. `opened` holds the petals
 * opened so far, in order. `again` changes nothing: the petal is open already. */
export type CopyPress = 'open' | 'bloom' | 'again' | 'jam';
export function copyPress(order: readonly PetalId[], opened: readonly PetalId[], pressed: number): CopyPress {
  if (!isPetal(pressed) || opened.includes(pressed) || opened.length >= order.length) return 'again';
  if (order[opened.length] !== pressed) return 'jam';
  return opened.length + 1 === order.length ? 'bloom' : 'open';
}

/** The toy jams by itself once a sitting: in round two, right after the first
 * right press. So every child practises the fix-it routine at least once. */
export function toyJams(round: number, openedCount: number, used: boolean): boolean {
  return !used && round === SCRIPTED_JAM_ROUND && openedCount === 1;
}

/** Putting the petals back, last one first. `close`: it is the last opened.
 * `wait`: open, but not the last. `closed`: already closed, nothing to do. */
export type UndoCheck = 'close' | 'wait' | 'closed';
export function undoCheck(opened: readonly PetalId[], pressed: number): UndoCheck {
  if (!isPetal(pressed) || !opened.includes(pressed)) return 'closed';
  return opened[opened.length - 1] === pressed ? 'close' : 'wait';
}

/** After this many presses on a petal that must wait, the right one is ringed. */
export const UNDO_HINT_AFTER = 1;
export function undoHint(opened: readonly PetalId[], waits: number): PetalId | null {
  return waits >= UNDO_HINT_AFTER && opened.length > 0 ? opened[opened.length - 1] : null;
}
