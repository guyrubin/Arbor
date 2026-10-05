/** Presentation-only static art; IDs and destinations remain in their live consumers.
 * B-KID-70: every file comes from the kid theme manifest (lib/kidThemeManifest.ts);
 * this module only adapts a manifest entry to the <img> shape its callers use.
 * Storybook provenance/approval: docs/design/world-art-v2.json. */
import { KID_WORLD_TILE_IDS, kidArt, kidArtSrcSet, storyCoverKey, worldTileKey, type KidArt, type KidThemeId, type KidWorldTileId } from "../../lib/kidThemeManifest";
export interface WorldArtwork { src: string; srcSet: string; objectPosition: string; provenanceId: string }
const toArtwork=(art:KidArt|null):WorldArtwork|undefined=>art?{src:art.src480,srcSet:kidArtSrcSet(art),objectPosition:art.objectPosition,provenanceId:art.provenanceId}:undefined;
const adapt=(theme:KidThemeId,id:KidWorldTileId)=>toArtwork(kidArt(theme,worldTileKey(id)));
/** The storybook (painted v2) set, kept as the reviewed-bytes export. */
export const WORLD_ARTWORK:Record<KidWorldTileId,WorldArtwork>=Object.fromEntries(
 KID_WORLD_TILE_IDS.map(id=>[id,adapt("storybook",id)!]),
) as Record<KidWorldTileId,WorldArtwork>;
/** B-KID-70: the theme is required — a caller never gets another theme's art by omission. */
export function worldArtwork(worldId:string,theme:KidThemeId):WorldArtwork|undefined {
 // B-KID-42/KA-28: `story-<id>` (the Tonight banner, the story cards) = that
 // story's own cover in this theme, or nothing (callers keep today's art).
 if(worldId.startsWith("story-"))return toArtwork(kidArt(theme,storyCoverKey(worldId.slice("story-".length))));
 return (KID_WORLD_TILE_IDS as readonly string[]).includes(worldId)?adapt(theme,worldId as KidWorldTileId):undefined;
}
