import React from "react";
import { HeroAvatar } from "../ui/HeroAvatar";
import { worldArtwork } from "../practice/worldArtwork";
import { useKidTheme } from "../../hooks/useKidTheme";

/**
 * B-KID-47 — what a child sees while a world's code arrives: the world's own
 * art in the child's theme (the same picture as the tile they tapped) + the
 * hero standing still. Never the parent grey TabSkeleton. Decorative and
 * transient (aria-hidden); the surface it stands in for announces itself.
 */
export function KidStageFallback({ worldId }: { worldId?: string }) {
  const theme = useKidTheme();
  const art = worldId ? worldArtwork(worldId, theme) : undefined;
  return (
    <div
      aria-hidden="true"
      data-testid="kid-stage-fallback"
      className="arbor-play relative grid place-items-center overflow-hidden"
      style={{ minBlockSize: 320, borderRadius: "var(--play-radius)", background: "var(--arbor-paper-deep)" }}
    >
      {art && (
        <img src={art.src} srcSet={art.srcSet} sizes="100vw" alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: art.objectPosition }} />
      )}
      {!art?.hasHero && (
        <span className="relative">
          <HeroAvatar size={120} mood="calm" animate={false} decorative />
        </span>
      )}
    </div>
  );
}
