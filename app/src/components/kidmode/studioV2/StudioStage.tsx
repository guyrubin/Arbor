import { STUDIO_CREW_CHEER, STUDIO_WORLD_HOSTS, STUDIO_WORLD_PLATES } from "../../../lib/studioStageArt";
import type { StudioWorldId } from "./studioCatalog";
import "./studioStage.css";

/** B-KID-177: the film's rooms and crew on the Studio stage; the art lives in lib/studioStageArt. */
export function StudioWorldPlate({ worldId, sizes = "100vw", className = "", priority = false }: { worldId: StudioWorldId; sizes?: string; className?: string; priority?: boolean }) {
  const plate = STUDIO_WORLD_PLATES[worldId];
  return <img className={`studio-stage__plate ${className}`} data-studio-plate={worldId} src={plate.src800} srcSet={`${plate.src800} 800w, ${plate.srcLarge} ${plate.largeWidth}w`} sizes={sizes}
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
    {STUDIO_CREW_CHEER.map((c, i) => <img key={c.crew} data-crew={c.crew} src={c.src} style={{ animationDelay: `${120 + i * 140}ms` }} alt="" draggable={false} decoding="async" />)}
    <span className="studio-stage__confetti">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ ["--i" as string]: i }} />)}</span>
  </span>;
}
