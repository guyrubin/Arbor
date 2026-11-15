import type { Challenge } from './adventureRules';

/** Wobbly Delivery rules. Pure: no clock and no storage, and chance is always
 * injected, so every round can be replayed exactly in a test. */
export const DELIVERY_ITEMS = ['item-can', 'item-journal', 'item-band', 'item-lamp', 'item-cushion', 'item-disc'] as const;
export type DeliveryItem = typeof DELIVERY_ITEMS[number];
/** One friend waits on the rug each round, in this order. */
export const DELIVERY_FRIENDS = ['aya', 'pep', 'chock'] as const;
export type DeliveryFriend = typeof DELIVERY_FRIENDS[number];
/** The musical tiles between the shelf and the rug, in the order the hero hops them. */
export const DELIVERY_TILES = ['tile-yellow', 'tile-blue', 'tile-pink'] as const;
export const DELIVERY_ROUNDS = DELIVERY_FRIENDS.length;

const SHELF_SIZE: Record<Challenge, number> = { gentle: 4, explore: 6 };
const REQUEST_LENGTHS: Record<Challenge, readonly number[]> = { gentle: [2, 2, 3], explore: [3, 3, 4] };
/** Any number becomes a real round: whole, and inside the game. */
function roundIndex(round: number): number {
  return Math.min(DELIVERY_ROUNDS - 1, Math.max(0, Math.trunc(round) || 0));
}
/** A fair pick that stays inside the options whatever the chance source returns. */
function choose<T>(options: readonly T[], random: () => number): T {
  const at = Math.floor(random() * options.length);
  return options[at >= options.length ? options.length - 1 : at > 0 ? at : 0];
}

/** The things on the shelf this round, always in the same drawing order. The
 * small shelf moves two things along each round, so every toy gets a turn. */
export function shelfFor(challenge: Challenge, round: number): DeliveryItem[] {
  const first = roundIndex(round) * 2, count = DELIVERY_ITEMS.length;
  return DELIVERY_ITEMS.filter((_, index) => (index - first + count) % count < SHELF_SIZE[challenge]);
}
export function requestLength(challenge: Challenge, round: number): number {
  return REQUEST_LENGTHS[challenge][roundIndex(round)];
}
/** The two things a round's request may begin with. No two rounds share one,
 * so a request can never be the same as the request of the round before. */
export function leadsFor(round: number): DeliveryItem[] {
  const first = roundIndex(round) * 2;
  return DELIVERY_ITEMS.slice(first, first + 2);
}
/** What the friend needs, in order: different things, all on this round's shelf. */
export function requestFor(challenge: Challenge, round: number, random: () => number = Math.random): DeliveryItem[] {
  const shelf = shelfFor(challenge, round), length = requestLength(challenge, round);
  const request: DeliveryItem[] = [choose(leadsFor(round), random)];
  while (request.length < length) request.push(choose(shelf.filter(item => !request.includes(item)), random));
  return request;
}

export type DeliveryPick = 'next' | 'complete' | 'repeat' | 'other';
/** What a tap on the shelf means. Only `next` and `complete` move the game on;
 * `repeat` and `other` change nothing, so there is no wrong state to recover. */
export function deliveryPick(request: readonly DeliveryItem[], delivered: readonly DeliveryItem[], picked: DeliveryItem): DeliveryPick {
  if (delivered.includes(picked)) return 'repeat';
  if (delivered.length >= request.length || request[delivered.length] !== picked) return 'other';
  return delivered.length + 1 === request.length ? 'complete' : 'next';
}

/** One request card turns up every `ASK_CARD_MS`; all stay up `ASK_HOLD_MS` more. */
export const ASK_CARD_MS = 1100;
export const ASK_HOLD_MS = 900;
/** How long the request cards stay face up. With sound off the cards carry the
 * whole request, so they stay half as long again. */
export function askMs(count: number, muted: boolean): number {
  const base = ASK_CARD_MS * Math.max(1, Math.trunc(count) || 0) + ASK_HOLD_MS;
  return muted ? base * 1.5 : base;
}
/** A carry is five even steps: lift, three tiles, the rug. Then the thing lands. */
export const CARRY_STEP_MS = 280;
export const CARRY_STEPS = DELIVERY_TILES.length + 2;
export const CARRY_MS = CARRY_STEP_MS * CARRY_STEPS;
export const THANKS_MS = 1200;
/** The flower opening is the one beat that takes its time: long enough to enjoy. */
export const BLOOM_MS = 2600;
export const OOPS_MS = 600;
/** After this many `other` picks in a round the cards stay face up. */
export const SUPPORT_AFTER = 2;
export function cardsStayUp(others: number): boolean {
  return others >= SUPPORT_AFTER;
}
/** The step of the toy scale for a tile: one note up a tile, and each later
 * thing in a request starts one note higher. Always a whole step from 0 to 5. */
export function tileTone(deliveredCount: number, tile: number): number {
  const base = Math.max(0, Math.trunc(deliveredCount) || 0), rise = Math.max(0, Math.trunc(tile) || 0);
  return Math.min(5, base + rise);
}
