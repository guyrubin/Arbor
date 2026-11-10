import type { DomainId } from "./domains/registry";
import type { ShelfId } from "./shelves/registry";

/**
 * Living Forms v2: satin sculpted leaf ribbons in Arbor's shared palette.
 * Generated with built-in image generation; provenance and prompts live in
 * docs/design/parent-art-v2.json and docs/design/living-forms-v2/.
 * Decorative only: never evidence about a child. Family photos take priority.
 * Small controls keep readable symbols; these forms belong in visual areas.
 */
export interface ParentArt {
  src: string;
  srcSet: string;
  width: number;
  height: number;
}

const BASE = "/visuals/parent/v2";

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

/** Eight domains; Body has a neutral form distinct from Sleep and Food. */
export const DOMAIN_ART: Readonly<Record<DomainId, ParentArt>> = {
  talking: SHELF_ART.words,
  moving: SHELF_ART.moving,
  hands: SHELF_ART.hands,
  thinking: SHELF_ART.school,
  playing: SHELF_ART.play,
  feelings: SHELF_ART.feelings,
  body: square("domain-body"),
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

/** Interlocking forms: the Now door, Together hero and family-ritual door. */
export const TOGETHER_ART: ParentArt = wide("together");

/** Wide abstract shelter, also reused by the marketing parenting introduction. */
export const GUIDANCE_ART: ParentArt = { ...wide("guidance"), height: 270 };

/** Every art file the app may request, for the on-disk guard. */
export function allParentArtFiles(): string[] {
  const all = [...Object.values(SHELF_ART), ...Object.values(DOMAIN_ART), ...Object.values(EMPTY_ART), TOGETHER_ART, GUIDANCE_ART];
  return [...new Set(all.flatMap((a) => a.srcSet.split(",").map((part) => part.trim().split(" ")[0])))];
}
