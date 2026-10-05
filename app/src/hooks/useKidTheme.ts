/**
 * useKidTheme — B-KID-70: the ONE reader of the active child's kid-mode look.
 * Returns a selectable theme id (the child's stored `kidTheme`, else the
 * default `film3d`). Kid surfaces pass it to `kidArt(theme, key)`; nothing
 * else reads `ChildProfile.kidTheme`. Reads live: changing the look in parent
 * Settings re-renders kid mode on the next profile update.
 */
import { useArborOptional } from "../context/ArborContext";
import { resolveKidTheme, type KidThemeId } from "../lib/kidThemeManifest";

export function useKidTheme(): KidThemeId {
  const arbor = useArborOptional();
  return resolveKidTheme(arbor?.childProfile?.kidTheme);
}
