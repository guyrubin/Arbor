/**
 * kidStage — B-KID-133 (D-01, KID-DESIGN-DIRECTION §2.4): which picture is
 * the lit "stage" behind the kid view on screen. No kid screen is white
 * paper: the home stands in the hero's room, a game in its own world card, a
 * book on its own cover, the library in the castle garden.
 *
 * Reads EXISTING manifest keys only (kidThemeManifest is not edited here):
 * - home, phone portrait = the tall reading-room card, which the manifest
 *   already carries as the `kid-quest` tile (arbor-academy-play-hero-bg, 9:16);
 * - home, >= 768 px and the library = `home.stage` (the garden + castle library);
 * - a game = `world.<id>.tile`; a book = `story.<id>.cover`.
 * One theme, never mixed: a slot the theme lacks falls back to the theme's
 * own home art, else to the flat token stage (never an empty dark box).
 */
import {
  KID_THEME_TILE_SHAPE,
  KID_WORLD_TILE_IDS,
  kidArt,
  storyCoverKey,
  worldTileKey,
  type KidArt,
  type KidThemeId,
  type KidWorldTileId,
} from "../../lib/kidThemeManifest";

export type KidStageScene =
  | { kind: "home" }
  | { kind: "library" }
  | { kind: "world"; worldId: string }
  | { kind: "story"; storyId: string };

/** §2.4: the room stays legible at home; the further into an activity, the softer. */
export const KID_STAGE_BLUR: Record<KidStageScene["kind"], number> = { home: 4, library: 10, world: 22, story: 26 };

export interface KidStageArt {
  /** The picture at >= 768 px (and the soft layer everywhere when no tall art). */
  wide: KidArt | null;
  /** The phone-portrait picture (< 768 px). */
  tall: KidArt | null;
  blur: number;
  /** Phone portrait: a crisp copy of the art at the top melting into the glow. */
  sharpTop: boolean;
  /** Stable id of the scene (data attribute, React key). */
  id: string;
}

const isWorldTileId = (id: string): id is KidWorldTileId => (KID_WORLD_TILE_IDS as readonly string[]).includes(id);

function homeArt(theme: KidThemeId): { wide: KidArt | null; tall: KidArt | null } {
  const garden = kidArt(theme, "home.stage");
  // The tall reading room only exists as a portrait card in a portrait theme.
  const room = KID_THEME_TILE_SHAPE[theme] === "portrait" ? kidArt(theme, worldTileKey("kid-quest")) : null;
  return { wide: garden ?? room, tall: room ?? garden };
}

/** The stage for one scene in one theme. */
export function kidStageArt(theme: KidThemeId, scene: KidStageScene): KidStageArt {
  const blur = KID_STAGE_BLUR[scene.kind];
  if (scene.kind === "home") {
    const { wide, tall } = homeArt(theme);
    return { wide, tall, blur, sharpTop: true, id: "home" };
  }
  if (scene.kind === "world" && isWorldTileId(scene.worldId)) {
    const art = kidArt(theme, worldTileKey(scene.worldId));
    if (art) return { wide: art, tall: art, blur, sharpTop: true, id: `world:${scene.worldId}` };
  }
  if (scene.kind === "story") {
    const art = kidArt(theme, storyCoverKey(scene.storyId));
    if (art) return { wide: art, tall: art, blur, sharpTop: false, id: `story:${scene.storyId}` };
  }
  // Library, and any scene whose own art the theme lacks: the theme's home art.
  const { wide } = homeArt(theme);
  return { wide, tall: wide, blur: KID_STAGE_BLUR.library, sharpTop: false, id: scene.kind === "library" ? "library" : `fallback:${scene.kind}` };
}

/** The overlay's default scene for a view (a mounted view may override it
 *  through kidChrome's setKidStage — a game names its world, a book page its
 *  story). `arg` is the overlay's world/story id channel. */
export function kidStageFor(view: string, arg: string | null): KidStageScene {
  if (view === "arcade") return arg ? { kind: "world", worldId: arg } : { kind: "home" };
  if (view === "journeys") return arg ? { kind: "story", storyId: arg } : { kind: "library" };
  if (view === "feelings") return { kind: "world", worldId: "feelings" };
  if (view === "comics") return { kind: "library" };
  return { kind: "home" };
}
