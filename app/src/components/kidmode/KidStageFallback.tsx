import React from "react";
import { motion } from "motion/react";
import { HeroAvatar } from "../ui/HeroAvatar";
import { usePrefersReducedMotion } from "../ui/playkit";
import { worldArtwork } from "../practice/worldArtwork";
import { useKidTheme } from "../../hooks/useKidTheme";
import { kidArt, kidArtSrcSet, storyCoverKey } from "../../lib/kidThemeManifest";

/**
 * B-KID-47 + B-KID-79 (KA-23) — the ONE kid loading state. What a child sees
 * while a surface's code arrives: the world's own art in the child's theme
 * (the same picture as the tile they tapped) or, for any other kid surface
 * (the library, a book, the comics shelf), the theme's home stage — with the
 * hero (Sprout when there is none) idling in front. Never the parent grey
 * TabSkeleton. The idle is a slow bob, still under prefers-reduced-motion.
 * Decorative and transient (aria-hidden); the surface announces itself.
 */
export function KidStageFallback({ worldId, storyId }: { worldId?: string; storyId?: string }) {
  const theme = useKidTheme();
  const reduced = usePrefersReducedMotion();
  const world = worldId ? worldArtwork(worldId, theme) : undefined;
  // B-KID-124: while the reader's chunk loads, a tapped book shows ITS cover.
  const cover = !world && storyId ? kidArt(theme, storyCoverKey(storyId)) : null;
  const stage = !world && !cover ? kidArt(theme, "home.stage") : null;
  const still = cover ?? stage;
  const art = world
    ? { src: world.src, srcSet: world.srcSet, objectPosition: world.objectPosition, hasHero: world.hasHero }
    : still ? { src: still.src, srcSet: kidArtSrcSet(still), objectPosition: still.objectPosition, hasHero: still.hasHero } : undefined;
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
        <motion.span
          className="relative"
          data-kid-idle=""
          animate={reduced ? undefined : { y: [0, -8, 0] }}
          transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <HeroAvatar size={120} mood="calm" animate={false} decorative />
        </motion.span>
      )}
    </div>
  );
}
