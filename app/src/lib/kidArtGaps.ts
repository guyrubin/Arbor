/**
 * kidArtGaps.ts — B-KID-70: the reviewed list of kid art that does NOT exist
 * yet, per theme ("then map which new images need to be created", Guy 5 Oct).
 * kidThemeManifest.test.ts asserts this equals `themeCoverage(theme).missing`,
 * so adding a file to the manifest (or a new slot) forces this list to be
 * re-reviewed in the same commit. A gap here never breaks a screen: story
 * covers fall back to today's rendering and `home.stage` is not rendered yet.
 */
import type { KidArtKey, KidThemeId } from "./kidThemeManifest";

export const KID_ART_GAPS: Record<KidThemeId, readonly KidArtKey[]> = {
  film3d: [
    // B-KID-131: every story now has its film3d cover (no story gaps left).
    // B-KID-94: the finish moment's stock hero (film3d: commit the dylan-hero-avatar-480/1024 web derivatives, then map it here)
    "hero.portrait",
  ],
  storybook: [
    "world.sneak.tile", // B-GAME-15a: the Sneak & Freeze tile exists in film-3D only (the game is film-3D only)
    "story.david-and-goliath.cover",
    "story.moses-and-pharaoh.cover",
    "story.the-lion-who-was-afraid.cover",
    "story.noahs-ark.cover",
    "story.jonah-and-the-great-fish.cover",
    "story.the-dragon-of-responsibility.cover",
    "story.joseph-and-his-brothers.cover",
    "story.jacob-wrestling-the-angel.cover",
    "story.the-garden-of-forgotten-seeds.cover",
    "story.king-solomons-choice.cover",
    "story.the-broken-music-box.cover",
    "story.the-found-acorn-crown.cover",
    "story.the-two-gifts.cover",
    "story.leave-the-tent.cover",
    "story.the-two-paths-through-the-meadow.cover",
    "story.the-two-mothers-and-the-quiet-judge.cover",
    "story.the-tyrant-and-the-town.cover",
    "story.the-friendly-monster.cover",
    "home.stage",
    // B-KID-94: the finish moment's stock hero (film3d: commit the dylan-hero-avatar-480/1024 web derivatives, then map it here)
    "hero.portrait",
  ],
};
