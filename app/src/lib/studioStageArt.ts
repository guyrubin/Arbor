/** The four Studio worlds (studioCatalog StudioWorldId); lib keeps no component import. */
type StudioWorldId = "stories" | "playbank" | "feelings" | "studio";

/** B-KID-177: the Studio stage's art, kept with the kid art seam (kid components name no
 *  /visuals/ path; B-KID-70). Each world stands in its own room of the Season 01 film: the
 *  episode's clean plate (no person, no text). Hosts and the cheer are the kit's own
 *  finished crew renders, cut out; the child's hero stays the child's own and is never
 *  drawn here. Bebe and Gob Gob are not hosts. */
const ROOM = "/visuals/studio-v2/rooms";
export const STUDIO_WORLD_PLATES: Record<StudioWorldId, { src800: string; src1600: string; position: string }> = {
  stories: { src800: `${ROOM}/stories-800.webp`, src1600: `${ROOM}/stories-1600.webp`, position: "50% 46%" },
  playbank: { src800: `${ROOM}/playbank-800.webp`, src1600: `${ROOM}/playbank-1600.webp`, position: "50% 40%" },
  feelings: { src800: `${ROOM}/feelings-800.webp`, src1600: `${ROOM}/feelings-1600.webp`, position: "50% 58%" },
  studio: { src800: `${ROOM}/studio-800.webp`, src1600: `${ROOM}/studio-1600.webp`, position: "40% 56%" },
};

export type CrewId = "chock" | "pep" | "aya";
const KIT = "/visuals/studio-v2/makers";
/** One host per world: the same companion that stands in that world's door. */
export const STUDIO_WORLD_HOSTS: Record<StudioWorldId, { crew: CrewId; src: string; src480: string }> = {
  playbank: { crew: "pep", src: `${KIT}/kit-pep-front.webp`, src480: `${KIT}/kit-pep-front-480.webp` },
  stories: { crew: "aya", src: `${KIT}/kit-aya-front.webp`, src480: `${KIT}/kit-aya-front-480.webp` },
  studio: { crew: "chock", src: `${KIT}/kit-chock-mission-front.webp`, src480: `${KIT}/kit-chock-mission-front-480.webp` },
  feelings: { crew: "aya", src: `${KIT}/kit-aya-sitting.webp`, src480: `${KIT}/kit-aya-sitting-480.webp` },
};
export const STUDIO_CREW_CHEER: { crew: CrewId; src: string }[] = [
  { crew: "chock", src: "/visuals/studio-v2/bop/chock-happy.webp" },
  { crew: "aya", src: "/visuals/studio-v2/bop/aya-happy.webp" },
  { crew: "pep", src: "/visuals/studio-v2/bop/pep-happy.webp" },
];

