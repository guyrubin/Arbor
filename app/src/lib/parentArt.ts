import type { DomainId } from "./domains/registry";
import type { ShelfId } from "./shelves/registry";

/**
 * Parent-register illustrations (P7-DESIGN art, 9 Oct 2026): abstract emblems
 * in the visual language of the Arbor mark (`public/brand/arbor-mark-transparent.png`,
 * `ui/ArborMark.tsx`) — only its leaf, arch and circle, its four gradients
 * (mint→teal→sky, lavender→periwinkle, navy→sapphire, peach→coral) and its
 * translucent overlaps, on white. Generated with Google `gemini-3-pro-image`
 * (Guy, 9 Oct: "abstract, colorful, modern"), chosen one by one by eye.
 * Provenance and prompts: `docs/design/parent-art-v1.json`.
 *
 * RULES: decorative only; abstract shapes, never a child, a face or a family's
 * own activity, so a picture can never read as evidence; no text in any image,
 * so one set serves EN and HE. A family's own photo always wins over a picture.
 * Every path is held on disk by `parentArt.guard.test.ts`.
 */
export interface ParentArt {
  src: string;
  srcSet: string;
  width: number;
  height: number;
}

const BASE = "/visuals/parent/v1";

const square = (name: string): ParentArt => ({
  src: `${BASE}/${name}-480.webp`,
  srcSet: `${BASE}/${name}-480.webp 1x, ${BASE}/${name}-960.webp 2x`,
  width: 480,
  height: 480,
});

const wide = (name: string): ParentArt => ({
  src: `${BASE}/${name}-480.webp`,
  srcSet: `${BASE}/${name}-480.webp 1x, ${BASE}/${name}-960.webp 2x`,
  width: 480,
  height: 320,
});

/** One picture per parent shelf (lib/shelves/registry.ts). */
export const SHELF_ART: Readonly<Record<ShelfId, ParentArt>> = {
  sleep: square("area-sleep"),
  food: square("area-food"),
  words: square("area-words"),
  feelings: square("area-feelings"),
  play: square("area-play"),
  moving: square("area-moving"),
  hands: square("area-hands"),
  school: square("area-school"),
  family: square("area-family"),
};

/** A domain borrows its shelf's picture; `body` (sleep + food) takes food. */
export const DOMAIN_ART: Readonly<Record<DomainId, ParentArt>> = {
  talking: SHELF_ART.words,
  moving: SHELF_ART.moving,
  hands: SHELF_ART.hands,
  thinking: SHELF_ART.school,
  playing: SHELF_ART.play,
  feelings: SHELF_ART.feelings,
  body: SHELF_ART.food,
  family: SHELF_ART.family,
};

/** Wide pictures for the few empty screens that teach the first step. */
export const EMPTY_ART = {
  journal: wide("empty-journal"),
  plans: wide("empty-plans"),
  learn: wide("empty-learn"),
  weekly: wide("empty-weekly"),
  portrait: wide("empty-portrait"),
} as const satisfies Record<string, ParentArt>;

export type EmptyArtId = keyof typeof EMPTY_ART;

/** A written moment with no area yet (unfiled): the journal emblem. */
export const MOMENT_ART: ParentArt = EMPTY_ART.journal;

/** Parent and child under one sun: the Now door, the Together hero and the family-ritual door. */
export const TOGETHER_ART: ParentArt = wide("together");

/** Every art file the app may request, for the on-disk guard. */
export function allParentArtFiles(): string[] {
  const all = [...Object.values(SHELF_ART), ...Object.values(EMPTY_ART), TOGETHER_ART];
  return [...new Set(all.flatMap((a) => a.srcSet.split(",").map((part) => part.trim().split(" ")[0])))];
}
