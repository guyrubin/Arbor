import type { Challenge } from './adventureRules';

/** Five-Friend Sun rules: a path of ten numbered pads, a small spinner and a
 * circle of five seats around the sun flower. Pure functions only; the
 * component owns the clock, the pictures and the words. */
export const PATH_END = 10;
export const FRIEND_TOTAL = 5;
/** The ten pads in counting order. Position 0 is the start mat, never a pad. */
export const PADS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Who sits where, clockwise from the petal that points straight up. The
 * last seat is the child's own. */
export const SUN_SEATS = ['sprout', 'aya', 'pep', 'chock', 'hero'] as const;
export type SunSeat = typeof SUN_SEATS[number];
/** Each seat's pad, in the same order as the petals: amber, blue, teal, white, navy. */
export const SEAT_PADS = ['pad-amber', 'pad-blue', 'pad-teal', 'pad-white', 'pad-navy'] as const;
/** Chock's pad starts far from the circle; the child brings it in. */
export const CHOCK_SEAT = 3;
export const HERO_SEAT = 4;

/** One pad of a hop, a friend's moment in the circle, the finished sun (long
 * enough for a small child to take it in), and the wobble of a pad that was
 * not the landing pad. */
export const HOP_MS = 380;
export const JOIN_MS = 1500;
export const SUN_MS = 4200;
/** How long the spinner wheel turns (its CSS rotate transition); the hop is named once it stops. */
export const TURN_MS = 1050;
export const WOBBLE_MS = 460;

const onPath = (position: number) => Number.isInteger(position) && position >= 0 && position <= PATH_END;

/** The largest hop a spin can ask for. */
export function spinMax(challenge: Challenge): number { return challenge === 'gentle' ? 2 : 3; }

/** How many pads the next hop covers: 1 or 2 (gentle), 1 to 3 (explore), and
 * never past the last pad. 0 only when no hop is left to make. */
export function spinFor(challenge: Challenge, position: number, random: () => number = Math.random): number {
  if (!onPath(position)) return 0;
  const most = Math.min(spinMax(challenge), PATH_END - position);
  if (most <= 0) return 0;
  const roll = Math.floor(random() * most);
  return 1 + (Number.isFinite(roll) ? Math.min(most - 1, Math.max(0, roll)) : 0);
}

export type HopCheck = 'land' | 'short' | 'far' | 'back';
/** Where a tapped pad is against the hop: the landing pad, not far enough,
 * too far, or not ahead of the hero at all. Without a spin nothing lands. */
export function hopCheck(position: number, spin: number, tapped: number): HopCheck {
  if (tapped <= position) return 'back';
  const target = position + spin;
  return tapped === target ? 'land' : tapped < target ? 'short' : 'far';
}

/** The numbers said while counting on: every pad after the hero's, up to the
 * landing pad. */
export function countOn(position: number, spin: number): number[] {
  if (!onPath(position) || !Number.isInteger(spin)) return [];
  return Array.from({ length: Math.max(0, Math.min(spin, PATH_END - position)) }, (_, index) => position + 1 + index);
}

/** How many of the five belong in the circle once the hero stands on `position`. */
export function friendsJoined(position: number): number {
  if (!Number.isFinite(position)) return 0;
  return Math.min(FRIEND_TOTAL, Math.max(0, Math.floor(position / 2)));
}

export type Arrival = 'none' | 'friend' | 'make-room' | 'sun';
/** What the circle needs next after a landing: nothing, the next friend, a
 * place for Chock, or the child's own seat. Seats fill one at a time, in order. */
export function nextArrival(position: number, seated: number): Arrival {
  if (seated >= friendsJoined(position)) return 'none';
  return seated === CHOCK_SEAT ? 'make-room' : seated === HERO_SEAT ? 'sun' : 'friend';
}

/** Wrong taps before the landing pad is pointed out. */
export function hintAfter(challenge: Challenge): number { return challenge === 'gentle' ? 1 : 2; }
export function hintShown(challenge: Challenge, misses: number): boolean { return misses >= hintAfter(challenge); }

export interface PadCell { column: number; row: 0 | 1 }
/** Where a position sits on the board. Column 0 is the start mat. Pads 1 to 5
 * run along the lower row in reading order and 6 to 10 come back along the
 * upper row, so the path climbs toward the sun. */
export function padCell(position: number): PadCell {
  const at = Number.isFinite(position) ? Math.min(PATH_END, Math.max(0, Math.trunc(position))) : 0;
  return at <= 5 ? { column: at, row: 0 } : { column: PATH_END + 1 - at, row: 1 };
}

/** Where the spinner wheel stops for a hop of `spin`: at least two full turns
 * on from where it rests, with the middle of that hop's wedge under the
 * pointer at the top. Wedges run clockwise from the top, 1 first. The wheel
 * only ever turns forward, so every spin reads as one. */
export function wheelTurn(from: number, spin: number, faces: number): number {
  const wedges = Math.max(1, Math.trunc(faces));
  const face = Math.min(wedges, Math.max(1, Math.trunc(spin)));
  const rest = Number.isFinite(from) ? from : 0;
  const centre = (face - .5) * 360 / wedges;
  return Math.ceil((rest + 720 + centre) / 360) * 360 - centre;
}
