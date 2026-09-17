/** Presentation-only static art; IDs and destinations remain in their live consumers.
 * Actual image provenance/approval: docs/design/world-art-v2.json. */
export interface WorldArtwork { src: string; srcSet: string; objectPosition: string; provenanceId: string }
const scene=(name:string,objectPosition:string):WorldArtwork=>({
 src: `/visuals/worlds/v2/${name}-v2-480.webp`,
 srcSet: `/visuals/worlds/v2/${name}-v2-480.webp 480w, /visuals/worlds/v2/${name}-v2.webp 960w`,
 objectPosition,provenanceId:`world-art-v2:${name}`,
});
export const WORLD_ARTWORK = {
 "speech":scene("sound-lab","48% 40%"),
 "feelings":scene("mood-mountain","50% 40%"),
 "memory":scene("mind-vault","45% 42%"),
 "beat":scene("beat-keeper","50% 42%"),
 "pose":scene("hero-pose","50% 40%"),
 "pattern":scene("pattern-power","50% 38%"),
 "adventures":scene("story-quest","50% 48%"),
 "mimic":scene("mimic-studio","50% 38%"),
 "reading":scene("spell-forge","50% 42%"),
 "kid-playbank":scene("play-together","50% 35%"),
 "kid-hero":scene("hero-stories","50% 38%"),
 "kid-quest":scene("tonight-story","50% 30%"),
} as const satisfies Record<string,WorldArtwork>;
export function worldArtwork(worldId:string):WorldArtwork|undefined {
 return (WORLD_ARTWORK as Record<string,WorldArtwork>)[worldId];
}
