/** B-BOOK-83: one complete, reviewed, child-free art set for an existing
 * legacy story. This does not add a shelf title, change authored words, or
 * make a canonical Library book/pose sheet (B-BOOK-81 is a separate item).
 * Art is requested only as static first-party files; no runtime generation.
 * The release guard checks every file, its dimensions and reviewed digest.
 */
import type { HeroBeatId } from "../types";
import type { KidArt, KidThemeId } from "./kidThemeManifest";

export interface StoryPlateArt extends KidArt {
  readonly id: "cover" | HeroBeatId;
  readonly height: number;
  readonly hasHero: false;
  readonly childFree: true;
  readonly textFree: true;
  /** An existing approved portrait stays in a frame, never an invented pose.
   * This box is inside the reviewed central portrait window. Art is never
   * mirrored in Hebrew: physical coordinates belong to the illustration. */
  readonly heroSlot: { readonly centerX: number; readonly bottom: number; readonly height: number };
}

export const JOSEPH_STORY_ID = "joseph-and-his-brothers";
export const STORY_ART_BEATS = ["call", "challenge", "fear", "decision", "consequence", "growth", "victory", "reflection"] as const satisfies readonly HeroBeatId[];
const ROOT = `/visuals/stories/v2/${JOSEPH_STORY_ID}/`;

function plate(id: StoryPlateArt["id"], width: number, height: number, objectPosition = "50% 50%", centerX = .5): StoryPlateArt {
  return {
    id, src: `${ROOT}${id}.webp`, src480: `${ROOT}${id}-480.webp`, width, height,
    objectPosition, altKey: null, provenanceId: `story-art-v2:${JOSEPH_STORY_ID}:${id}`,
    hasHero: false, childFree: true, textFree: true,
    heroSlot: { centerX, bottom: .94, height: .26 },
  };
}

/** All eight authored beats are explicit. There is no cover-as-page fallback
 * within this set, and no partial-book rollout switch. */
export const JOSEPH_STORY_ART = {
  cover: plate("cover", 1023, 1364),
  pages: {
    call: plate("call", 1536, 1024),
    challenge: plate("challenge", 1536, 1024),
    fear: plate("fear", 1536, 1024),
    decision: plate("decision", 1536, 1024),
    consequence: plate("consequence", 1536, 1024, "35% 50%"),
    growth: plate("growth", 1536, 1024),
    victory: plate("victory", 1536, 1024, "35% 50%"),
    reflection: plate("reflection", 1536, 1024, "25% 50%", .62),
  } satisfies Record<HeroBeatId, StoryPlateArt>,
} as const;

/** A film set belongs to film3d. Missing/other themes retain their existing
 * authored fallback; no cross-theme or neighbouring-scene substitution. */
export function storyBookArt(theme: KidThemeId, storyId: string | undefined): typeof JOSEPH_STORY_ART | null {
  return theme === "film3d" && storyId === JOSEPH_STORY_ID ? JOSEPH_STORY_ART : null;
}

export function storyPageArt(theme: KidThemeId, storyId: string | undefined, beat: HeroBeatId): StoryPlateArt | null {
  const book = storyBookArt(theme, storyId);
  return book && Object.hasOwn(book.pages, beat) ? book.pages[beat] : null;
}

export function storyArtSrcSet(art: StoryPlateArt): string {
  return `${art.src480} 480w, ${art.src} ${art.width}w`;
}
