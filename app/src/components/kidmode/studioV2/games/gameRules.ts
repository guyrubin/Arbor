export const CORNER_OBJECTS = ["cushion", "plant", "books", "lamp", "blanket", "panda", "flowers", "basket"] as const;
export type CornerObject = typeof CORNER_OBJECTS[number];
export type CornerLayout = readonly (CornerObject | null)[];
export const emptyCorner = (): CornerLayout => Array.from({ length: 6 }, () => null);

/** A movable object has one location. Replacing another returns it to the tray. */
export function placeCornerObject(layout: CornerLayout, object: CornerObject, target: number): CornerLayout {
  if (!CORNER_OBJECTS.includes(object) || !Number.isInteger(target) || target < 0 || target >= layout.length) return layout;
  return layout.map((item, index) => index === target ? object : item === object ? null : item);
}

export function shuffledPieces(size: 2 | 3, random: () => number = Math.random): number[] {
  const pieces = Array.from({ length: size * size }, (_, index) => index);
  for (let index = pieces.length - 1; index > 0; index--) {
    const target = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [pieces[index], pieces[target]] = [pieces[target], pieces[index]];
  }
  if (pieces.every((piece, index) => piece === index)) pieces.push(pieces.shift()!);
  return pieces;
}

/** Incorrect, repeated and malformed placements cannot progress the puzzle. */
export function placePuzzlePiece(placed: readonly number[], piece: number | null, target: number, size: 2 | 3): readonly number[] {
  if (piece === null || !Number.isInteger(piece) || piece < 0 || piece >= size * size || piece !== target || placed.includes(piece)) return placed;
  return [...placed, piece];
}

export const EXPLORER_SOUNDS = ["steps", "bell", "landing"] as const;
export type ExplorerSound = typeof EXPLORER_SOUNDS[number];
/** Already shipped authored foley: tiptoe, real bell and soft tumble, as named
 * in sneakFreeze/sounds.ts. These are not environmental/animal recordings. */
export const EXPLORER_CLIPS: Record<ExplorerSound, string> = {
  steps: "/audio/kid/sneak/foley/step1.m4a",
  bell: "/audio/kid/sneak/foley/prize.m4a",
  landing: "/audio/kid/sneak/foley/plop.m4a",
};
