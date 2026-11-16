import type { StudioWorldId } from "./studioCatalog";
import "./studioStage.css";

/** B-KID-177: each Studio world stands in its own room of the Season 01 film, the
 *  episode's clean plate (no person, no text), with one of the crew as its host.
 *  The crew are the kit's own finished renders, cut out; the child's hero stays the
 *  child's own and is never drawn here. Bebe and Gob Gob are not hosts. */
const PLATE = "/visuals/studio-v2/plates";
export const STUDIO_WORLD_PLATES: Record<StudioWorldId, { src800: string; src1600: string; position: string }> = {
  stories: { src800: `${PLATE}/stories-800.webp`, src1600: `${PLATE}/stories-1600.webp`, position: "50% 46%" },
  playbank: { src800: `${PLATE}/playbank-800.webp`, src1600: `${PLATE}/playbank-1600.webp`, position: "50% 40%" },
  feelings: { src800: `${PLATE}/feelings-800.webp`, src1600: `${PLATE}/feelings-1600.webp`, position: "50% 58%" },
  studio: { src800: `${PLATE}/studio-800.webp`, src1600: `${PLATE}/studio-1600.webp`, position: "40% 56%" },
};

type CrewId = "chock" | "pep" | "aya";
const KIT = "/visuals/studio-v2/makers";
/** One host per world: the same companion that stands in that world's door. */
export const STUDIO_WORLD_HOSTS: Record<StudioWorldId, { crew: CrewId; src: string; src480: string }> = {
  playbank: { crew: "pep", src: `${KIT}/kit-pep-front.webp`, src480: `${KIT}/kit-pep-front-480.webp` },
  stories: { crew: "aya", src: `${KIT}/kit-aya-front.webp`, src480: `${KIT}/kit-aya-front-480.webp` },
  studio: { crew: "chock", src: `${KIT}/kit-chock-mission-front.webp`, src480: `${KIT}/kit-chock-mission-front-480.webp` },
  feelings: { crew: "aya", src: `${KIT}/kit-aya-sitting.webp`, src480: `${KIT}/kit-aya-sitting-480.webp` },
};
const CHEER: { crew: CrewId; src: string }[] = [
  { crew: "chock", src: "/visuals/studio-v2/bop/chock-happy.webp" },
  { crew: "aya", src: "/visuals/studio-v2/bop/aya-happy.webp" },
  { crew: "pep", src: "/visuals/studio-v2/bop/pep-happy.webp" },
];

export function StudioWorldPlate({ worldId, sizes = "100vw", className = "", priority = false }: { worldId: StudioWorldId; sizes?: string; className?: string; priority?: boolean }) {
  const plate = STUDIO_WORLD_PLATES[worldId];
  return <img className={`studio-stage__plate ${className}`} data-studio-plate={worldId} src={plate.src800} srcSet={`${plate.src800} 800w, ${plate.src1600} 1600w`} sizes={sizes}
    style={{ objectPosition: plate.position }} alt="" draggable={false} decoding="async" fetchPriority={priority ? "high" : undefined} />;
}

export function StudioCrewHost({ worldId, className = "" }: { worldId: StudioWorldId; className?: string }) {
  const host = STUDIO_WORLD_HOSTS[worldId];
  return <span className={`studio-stage__host ${className}`} data-studio-host={host.crew} aria-hidden="true">
    <img src={host.src480} srcSet={`${host.src480} 1x, ${host.src} 2x`} alt="" draggable={false} decoding="async" />
  </span>;
}

/** The finish: the three companions pop up and cheer, one after another. */
export function StudioCrewCheer({ className = "" }: { className?: string }) {
  return <span className={`studio-stage__cheer ${className}`} data-studio-cheer="" aria-hidden="true">
    {CHEER.map((c, i) => <img key={c.crew} data-crew={c.crew} src={c.src} style={{ animationDelay: `${120 + i * 140}ms` }} alt="" draggable={false} decoding="async" />)}
    <span className="studio-stage__confetti">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ ["--i" as string]: i }} />)}</span>
  </span>;
}
