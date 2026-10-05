/** Presentation-only static art; IDs and destinations remain in their live consumers.
 * B-KID-70: every file comes from the kid theme manifest (lib/kidThemeManifest.ts);
 * this module only adapts a manifest entry to the <img> shape its callers use.
 * Storybook provenance/approval: docs/design/world-art-v2.json. */
import { KID_WORLD_TILE_IDS, kidArt, kidArtSrcSet, worldTileKey, type KidThemeId, type KidWorldTileId } from "../../lib/kidThemeManifest";
export interface WorldArtwork { src: string; srcSet: string; objectPosition: string; provenanceId: string }
const adapt=(theme:KidThemeId,id:KidWorldTileId):WorldArtwork|undefined=>{
 const art=kidArt(theme,worldTileKey(id));
 return art?{src:art.src480,srcSet:kidArtSrcSet(art),objectPosition:art.objectPosition,provenanceId:art.provenanceId}:undefined;
};
/** The storybook (painted v2) set, kept as the reviewed-bytes export. */
export const WORLD_ARTWORK:Record<KidWorldTileId,WorldArtwork>=Object.fromEntries(
 KID_WORLD_TILE_IDS.map(id=>[id,adapt("storybook",id)!]),
) as Record<KidWorldTileId,WorldArtwork>;
/** B-KID-70: the theme is required — a caller never gets another theme's art by omission. */
export function worldArtwork(worldId:string,theme:KidThemeId):WorldArtwork|undefined {
 return (KID_WORLD_TILE_IDS as readonly string[]).includes(worldId)?adapt(theme,worldId as KidWorldTileId):undefined;
}
