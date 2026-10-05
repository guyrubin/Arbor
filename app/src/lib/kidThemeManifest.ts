/**
 * kidThemeManifest.ts — B-KID-70 (v0, reuse-only): the ONE place kid art is
 * referenced. Every kid art slot is a typed KEY; a theme maps keys to files
 * that already exist under `public/visuals/` (Guy, 5 Oct: "use the current
 * images ... then map which new images need to be created"). No component
 * under components/kidmode or components/practice names a `/visuals/` path —
 * they ask `kidArt(theme, key)` (guard: kidThemeManifest.test.ts).
 *
 * Themes: `film3d` (glossy 3D, the DEFAULT; the hero shown in these cards is
 * the stylised hero Guy ruled stays) and `storybook` (the painted v2/v1 set
 * the app shipped until now). One theme per child (`ChildProfile.kidTheme`),
 * never mixed on one screen: a theme missing any GATING key is not selectable
 * and is never used, so there is no per-tile fallback across themes.
 *
 * Keys the theme does not cover are the reviewed list of images that still
 * need to be created: `KID_ART_GAPS` (kidArtGaps.ts), pinned by the test.
 */
import { HERO_STORIES } from "./heroJourneys";

export const KID_THEME_IDS = ["film3d", "storybook"] as const;
export type KidThemeId = (typeof KID_THEME_IDS)[number];
export const DEFAULT_KID_THEME: KidThemeId = "film3d";

export function isKidThemeId(v: unknown): v is KidThemeId {
  return typeof v === "string" && (KID_THEME_IDS as readonly string[]).includes(v);
}

/** World tiles rendered today (KidDashboard game + adventure tiles, the
 *  Tonight banner, HeroArcade's world picker) — ids = worldArtwork ids. */
export const KID_WORLD_TILE_IDS = [
  "speech", "feelings", "memory", "beat", "pose", "pattern", "adventures", "mimic", "reading",
  "kid-playbank", "kid-hero", "kid-quest",
] as const;
export type KidWorldTileId = (typeof KID_WORLD_TILE_IDS)[number];

export type KidArtKey = `world.${KidWorldTileId}.tile` | `story.${string}.cover` | "home.stage";
export const worldTileKey = (id: KidWorldTileId): KidArtKey => `world.${id}.tile`;
export const storyCoverKey = (storyId: string): KidArtKey => `story.${storyId}.cover`;

/** Every kid art slot that exists in the app today. */
export const KID_ART_KEYS: readonly KidArtKey[] = [
  ...KID_WORLD_TILE_IDS.map(worldTileKey),
  ...HERO_STORIES.map((s) => storyCoverKey(s.id)),
  "home.stage",
];

/** The slots the app renders with NO non-art fallback: a theme must cover all
 *  of them to be selectable. Story covers are optional (a story without a cover
 *  keeps today's rendering) and `home.stage` is not rendered yet, so both only
 *  appear in KID_ART_GAPS. */
export const GATING_KID_ART_KEYS: readonly KidArtKey[] = KID_WORLD_TILE_IDS.map(worldTileKey);

export interface KidArt {
  /** Largest web derivative. */
  src: string;
  /** 480 px-wide derivative (first paint, small tiles). */
  src480: string;
  /** Real pixel width of `src` (srcSet descriptor). */
  width: number;
  /** object-position for object-fit: cover crops (film3d portrait cards keep
   *  the hero's face in frame: focal point near the top). */
  objectPosition: string;
  /** i18n key of an alt text, or null = decorative (the adjacent title names it;
   *  every slot today renders aria-hidden). */
  altKey: string | null;
  provenanceId: string;
}

const FILM = "/visuals/cards/web/";
const film = (name: string, objectPosition = "50% 22%", width = 1024): KidArt => ({
  src: `${FILM}${name}-1024.webp`,
  src480: `${FILM}${name}-480.webp`,
  width,
  objectPosition,
  altKey: null,
  provenanceId: `film3d-card:${name}`,
});
const world = (name: string, objectPosition: string): KidArt => ({
  src: `/visuals/worlds/v2/${name}-v2.webp`,
  src480: `/visuals/worlds/v2/${name}-v2-480.webp`,
  width: 960,
  objectPosition,
  altKey: null,
  provenanceId: `world-art-v2:${name}`,
});
const plate = (name: string): KidArt => ({
  src: `/visuals/stories/v1/${name}-v1.webp`,
  src480: `/visuals/stories/v1/${name}-v1-480.webp`,
  width: 960,
  objectPosition: "50% 50%",
  altKey: null,
  provenanceId: `story-art-v1:${name}`,
});

const FILM3D_STORY_COVERS = [
  "david-and-goliath", "moses-and-pharaoh", "the-lion-who-was-afraid", "noahs-ark",
  "jonah-and-the-great-fish", "the-dragon-of-responsibility", "joseph-and-his-brothers",
  "jacob-wrestling-the-angel", "the-garden-of-forgotten-seeds", "king-solomons-choice",
] as const;

export const KID_THEME_MANIFEST: Record<KidThemeId, Partial<Record<KidArtKey, KidArt>>> = {
  film3d: {
    "world.speech.tile": film("game-speech"),
    "world.feelings.tile": film("game-feelings"),
    "world.memory.tile": film("game-memory"),
    "world.beat.tile": film("game-beat"),
    "world.pose.tile": film("game-pose"),
    "world.pattern.tile": film("game-pattern"),
    "world.adventures.tile": film("game-adventures"),
    "world.mimic.tile": film("game-mimic", "50% 22%", 941),
    "world.reading.tile": film("game-reading"),
    // Adventure tiles + Tonight banner: the unused film3d cards whose scene
    // matches the tile's job (play together / the hero's story map / a
    // bedtime reading nook).
    "world.kid-playbank.tile": film("game-truth-compass", "50% 30%"),
    "world.kid-hero.tile": film("game-aim-map", "50% 30%"),
    "world.kid-quest.tile": film("arbor-academy-play-hero-bg", "50% 62%", 941),
    ...Object.fromEntries(FILM3D_STORY_COVERS.map((id) => [storyCoverKey(id), film(`story-${id}`, "50% 30%")])),
    "home.stage": film("kid-discovery-garden-v2", "50% 50%"),
  },
  storybook: {
    "world.speech.tile": world("sound-lab", "48% 40%"),
    "world.feelings.tile": world("mood-mountain", "50% 40%"),
    "world.memory.tile": world("mind-vault", "45% 42%"),
    "world.beat.tile": world("beat-keeper", "50% 42%"),
    "world.pose.tile": world("hero-pose", "50% 40%"),
    "world.pattern.tile": world("pattern-power", "50% 38%"),
    "world.adventures.tile": world("story-quest", "50% 48%"),
    "world.mimic.tile": world("mimic-studio", "50% 38%"),
    "world.reading.tile": world("spell-forge", "50% 42%"),
    "world.kid-playbank.tile": world("play-together", "50% 35%"),
    "world.kid-hero.tile": world("hero-stories", "50% 38%"),
    "world.kid-quest.tile": world("tonight-story", "50% 30%"),
    "story.the-lantern-path.cover": plate("lantern-path"),
    "story.the-cloud-orchestra.cover": plate("cloud-orchestra"),
    "story.the-little-bridge-builders.cover": plate("little-bridge-builders"),
  },
};

/** The art for one slot in one theme, or null when the theme lacks it. Never
 *  falls back to another theme (no mixed themes on one screen). */
export function kidArt(theme: KidThemeId, key: KidArtKey): KidArt | null {
  return KID_THEME_MANIFEST[theme]?.[key] ?? null;
}

/** srcSet for an <img>: 480w + the large derivative. */
export function kidArtSrcSet(art: KidArt): string {
  return `${art.src480} 480w, ${art.src} ${art.width}w`;
}

export function themeCoverage(
  theme: KidThemeId,
  keys: readonly KidArtKey[] = KID_ART_KEYS,
): { covered: KidArtKey[]; missing: KidArtKey[] } {
  const covered: KidArtKey[] = [];
  const missing: KidArtKey[] = [];
  for (const k of keys) (kidArt(theme, k) ? covered : missing).push(k);
  return { covered, missing };
}

/** Themes a parent may pick: every GATING slot covered in that theme. */
export function selectableThemes(): KidThemeId[] {
  return KID_THEME_IDS.filter((t) => themeCoverage(t, GATING_KID_ART_KEYS).missing.length === 0);
}

/** The theme kid mode renders for a child: their stored pick when it is
 *  selectable, else the default. */
export function resolveKidTheme(stored: unknown): KidThemeId {
  return isKidThemeId(stored) && selectableThemes().includes(stored) ? stored : DEFAULT_KID_THEME;
}
