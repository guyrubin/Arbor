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
import { STUDIO_V2_GAME_WORLDS } from "../components/kidmode/studioGameWorlds";
import { KID_WORLDS, SNEAK_FREEZE_WORLD, type KidWorldId } from "../components/kidmode/kidWorlds";
import { studioNextFlagOn, type StudioNextHost } from "../components/kidmode/studioV2/studioNextFlag";
import { heroBandFlagOn } from "../components/kidmode/studioV2/heroBandFlag";

export const KID_THEME_IDS = ["film3d", "storybook"] as const;
export type KidThemeId = (typeof KID_THEME_IDS)[number];
export const DEFAULT_KID_THEME: KidThemeId = "film3d";

/** R-2b: the tile shape is a property of the THEME's art, never an `if` in a
 *  component. film3d cards are portrait (~3:4, a hero in every frame) → a
 *  portrait card grid; the storybook v2 tiles are landscape → today's wide tile. */
export type KidTileShape = "portrait" | "wide";
export const KID_THEME_TILE_SHAPE: Record<KidThemeId, KidTileShape> = { film3d: "portrait", storybook: "wide" };

export function isKidThemeId(v: unknown): v is KidThemeId {
  return typeof v === "string" && (KID_THEME_IDS as readonly string[]).includes(v);
}

/** Home-only tiles that are not kid worlds (the Tonight banner fallback and
 *  the retired adventure tiles' art). */
export const KID_HOME_TILE_IDS = ["kid-playbank", "kid-hero", "kid-quest"] as const;
/** World tiles rendered today (KidDashboard game tiles, the Tonight banner,
 *  HeroArcade's world picker) — ids = worldArtwork ids. B-KID-68: the kid
 *  worlds' ids come from the ONE registry (components/kidmode/kidWorlds.ts),
 *  in its slot order; only the home-only tiles are named here. */
export type KidWorldTileId = KidWorldId | (typeof KID_HOME_TILE_IDS)[number] | typeof SNEAK_FREEZE_WORLD.worldId;
export const KID_WORLD_TILE_IDS: readonly KidWorldTileId[] = [...KID_WORLDS.map((w) => w.worldId), ...KID_HOME_TILE_IDS];

export const STUDIO_PORTAL_IDS = ["playbank", "stories", "feelings", "studio"] as const;
/** Playbank tiles that get their own film cover instead of sharing the Playbank door. */
export const STUDIO_COVER_IDS = ["memory", "pattern", "puzzle", "sneak"] as const;
export type StudioCoverId = typeof STUDIO_COVER_IDS[number];
export function isStudioCoverId(id: string): id is StudioCoverId { return (STUDIO_COVER_IDS as readonly string[]).includes(id); }
export type StudioArtKey = "studio.sky" | `studio.portal.${typeof STUDIO_PORTAL_IDS[number]}` | `studio.cover.${StudioCoverId}` | "studio.room.calm";
export type KidArtKey = StudioArtKey | `world.${KidWorldTileId}.tile` | `story.${string}.cover` | "home.stage" | "hero.portrait";
export const worldTileKey = (id: KidWorldTileId): KidArtKey => `world.${id}.tile`;
export const storyCoverKey = (storyId: string): KidArtKey => `story.${storyId}.cover`;

/** Every kid art slot that exists in the app today. */
export const KID_ART_KEYS: readonly KidArtKey[] = [
  "studio.sky",
  ...STUDIO_PORTAL_IDS.map(id => `studio.portal.${id}` as const),
  ...STUDIO_COVER_IDS.map(id => `studio.cover.${id}` as const),
  "studio.room.calm",
  ...KID_WORLD_TILE_IDS.map(worldTileKey),
  ...STUDIO_V2_GAME_WORLDS.map(w => worldTileKey(w.worldId)),
  worldTileKey(SNEAK_FREEZE_WORLD.worldId), // B-GAME-15a: the Sneak & Freeze tile (not a gating slot)
  ...HERO_STORIES.map((s) => storyCoverKey(s.id)),
  "home.stage",
  // B-KID-94: the theme's stock hero for a finish moment when the child has
  // no generated hero (KidFinishHero; Sprout until a theme fills it).
  "hero.portrait",
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
  /** The picture itself already shows a hero (no sticker portrait over it). */
  hasHero: boolean;
}

const FILM = "/visuals/cards/web/";
const film = (name: string, objectPosition = "50% 22%", width = 1024, hasHero = true): KidArt => ({
  src: `${FILM}${name}-1024.webp`,
  src480: `${FILM}${name}-480.webp`,
  width,
  objectPosition,
  altKey: null,
  provenanceId: `film3d-card:${name}`,
  hasHero,
});
const world = (name: string, objectPosition: string): KidArt => ({
  src: `/visuals/worlds/v2/${name}-v2.webp`,
  src480: `/visuals/worlds/v2/${name}-v2-480.webp`,
  width: 960,
  objectPosition,
  altKey: null,
  provenanceId: `world-art-v2:${name}`,
  hasHero: false,
});
const plate = (name: string): KidArt => ({
  src: `/visuals/stories/v1/${name}-v1.webp`,
  src480: `/visuals/stories/v1/${name}-v1-480.webp`,
  width: 960,
  objectPosition: "50% 50%",
  altKey: null,
  provenanceId: `story-art-v1:${name}`,
  hasHero: false,
});

const FILM3D_STORY_COVERS = [
  "david-and-goliath", "moses-and-pharaoh", "the-lion-who-was-afraid", "noahs-ark",
  "jonah-and-the-great-fish", "the-dragon-of-responsibility", "joseph-and-his-brothers",
  "jacob-wrestling-the-angel", "the-garden-of-forgotten-seeds", "king-solomons-choice",
] as const;
/** B-KID-131: the eleven later covers. Their large derivative is 832×1248
 *  (2:3, a taller portrait than the first ten's 1024×1365 3:4), so the srcSet
 *  descriptor says 832w. In the 3:4 book frame an object-fit cover crop trims
 *  ~11% of the height; the 30% focal point keeps the hero's face in frame. */
const FILM3D_STORY_COVERS_2X3 = [
  "the-broken-music-box", "the-found-acorn-crown", "the-two-gifts", "leave-the-tent",
  "the-two-paths-through-the-meadow", "the-two-mothers-and-the-quiet-judge", "the-tyrant-and-the-town",
  "the-friendly-monster", "the-lantern-path", "the-cloud-orchestra", "the-little-bridge-builders",
] as const;

const adventureScene = (id: 'canal-world' | 'story-theater' | 'sound-orbit'): KidArt => ({
  src: `/visuals/studio-v2/adventures/${id}.webp`, src480: `/visuals/studio-v2/adventures/${id}-480.webp`, width: 1536,
  objectPosition: '50% 50%', altKey: null, provenanceId: `studio-original-world:${id}:2026-10-15`, hasHero: false,
});

/** v30 shell art (Horizon Valley, the art kit's register v30; generated
 *  16 Nov 2026). New file names, so no cached night-sky picture survives. The
 *  doors show the animal companions (Pep, Aya, Chock) or an empty place, never
 *  a child: the profile is the only child identity. */
const STUDIO_V30 = "/visuals/studio-v2/v30/";
/** The v30 valley and portal pictures, for kid components that compose their own scene from them. */
export const STUDIO_V30_ROOT = STUDIO_V30;
const studioPortal = (id: typeof STUDIO_PORTAL_IDS[number]): KidArt => ({
  src: `${STUDIO_V30}portal-${id}.webp`, src480: `${STUDIO_V30}portal-${id}-480.webp`, width: 1536,
  objectPosition: "50% 55%", altKey: null, provenanceId: `studio-v30-portal:${id}:2026-11-16`, hasHero: false,
});
/** The Studio's own film (16 Nov 2026): 3:2 crops of the episodes' stills and
 *  empty set plates, the same world, light and companions a child knows from
 *  the show. Chosen frame by frame with no child in them (except the `-crew`
 *  tile covers below); covers show the companions (Aya, Chock, Pep), rooms are
 *  empty so the child's hero stands in them. Builder and sources: ROS, Kids
 *  backlog B-KID-171. */
const STUDIO_FILM = "/visuals/studio-v2/film/";
const studioFilm = (name: string, objectPosition = "50% 50%", width = 1536): KidArt => ({
  src: `${STUDIO_FILM}${name}.webp`, src480: `${STUDIO_FILM}${name}-480.webp`, width,
  objectPosition, altKey: null, provenanceId: `studio-film:${name}:2026-11-16`, hasHero: false,
});
/** Studio game tiles with Bebe and GobGob, the show's two children
 *  (B-KID-171, 16 Nov 2026; B-KID-176 the same day): each cover shows its own
 *  game being played, so a child can tell the games apart before opening one:
 *  the game's own pieces in the film's world (a new scene, generated from the
 *  kit's props, set plates and piece art only, never from a picture of either
 *  child), with the two children added as cut-outs of the kit's own finished
 *  renders (cut only, never redrawn or regenerated) and, where the game has
 *  them, its companions in their places. Each file is named in
 *  lib/childLikenessFiles.named.ts under Guy's approval (BD-32, third
 *  permission, extended the same day to the covers). A tile shows the cover of
 *  the game it opens: with the Next Studio switch on, a host tile opens a Bop
 *  game and wears that game's cover. Tiles only: the game screen keeps the
 *  companion cover, because the child's own hero stands in that picture.
 *  The builder scripts live in the private operations tree, not here. */
const crew2 = (name: string, objectPosition = "50% 60%") => studioFilm(`cover-${name}-crew2`, objectPosition);
const STUDIO_CREW_COVERS: Readonly<Record<string, KidArt>> = {
  memory: crew2("memory"),
  pattern: crew2("pattern"),
  puzzle: crew2("puzzle"),
  sneak: studioFilm("cover-sneak-crew", "70% 60%"),
  "feelings-forest": crew2("feelings"),
  "calm-builder": crew2("calm"),
  "rhythm-garden": crew2("rhythm"),
  "river-rescue": crew2("canal"),
};
const STUDIO_NEXT_CREW_COVERS: Readonly<Record<StudioNextHost, KidArt>> = {
  memory: crew2("delivery"),
  pattern: crew2("sun"),
  puzzle: crew2("oops"),
  "river-rescue": crew2("rover"),
};
/** Hero Band on the rhythm-garden tile, under either switch that hosts it there. */
const HERO_BAND_CREW_COVER = crew2("band");
export function studioCrewCover(id: string): KidArt | null {
  if (id === "rhythm-garden" && (studioNextFlagOn() || heroBandFlagOn())) return HERO_BAND_CREW_COVER;
  if (Object.hasOwn(STUDIO_NEXT_CREW_COVERS, id) && studioNextFlagOn()) return STUDIO_NEXT_CREW_COVERS[id as StudioNextHost];
  return Object.hasOwn(STUDIO_CREW_COVERS, id) ? STUDIO_CREW_COVERS[id] : null;
}
/** The home valley for portrait tablets and phones (the wide one is "studio.sky"). */
export const STUDIO_VALLEY_TALL = { src: `${STUDIO_V30}valley-tall.webp`, src480: `${STUDIO_V30}valley-tall-480.webp`, width: 1024 } as const;
/** The Bop games' toy-world art: one shared folder of authored, shipped
 *  pictures (no likeness, nothing made at runtime). A stem is the full
 *  hyphenated file name without its extension, e.g. "aya-idle". */
export const STUDIO_BOP_ROOT = "/visuals/studio-v2/bop/";
export function studioBopArt(stem: string): string { return `${STUDIO_BOP_ROOT}${stem}.webp`; }

/** The makers' kit art (B-GAME-40): pictures cropped or cut out from the v30
 *  kit for the twelve maker activities, and the shared `kit-*` character,
 *  prop, tool and backdrop set. One folder, one naming rule: a full hyphenated
 *  file stem, e.g. "kit-aya-front"; each has a `-480` twin. Files that show
 *  Bebe or GobGob carry `bebe`, `gobgob` or `crew` in the stem and are named
 *  in lib/childLikenessFiles.named.ts. */
export const STUDIO_MAKERS_ROOT = "/visuals/studio-v2/makers/";
export function studioMakerArt(stem: string): string { return `${STUDIO_MAKERS_ROOT}${stem}.webp`; }

/** Host tile → the cover of the game it opens while the Next Studio switch is
 *  on. Shared pictures only: the child's hero is never part of a cover. */
const STUDIO_NEXT_COVERS: Record<StudioNextHost, string> = { memory: "card-delivery", pattern: "card-sun", puzzle: "card-oops", "river-rescue": "card-rover" };
export interface StudioNextCover { src: string; src480: string; srcSet: string }
export function studioNextCover(id: string): StudioNextCover | null {
  // Hero Band hosts the rhythm-garden tile under either switch (kidPrefetch).
  const stem = id === "rhythm-garden" ? (studioNextFlagOn() || heroBandFlagOn() ? "card-band" : null)
    : Object.hasOwn(STUDIO_NEXT_COVERS, id) && studioNextFlagOn() ? STUDIO_NEXT_COVERS[id as StudioNextHost] : null;
  if (!stem) return null;
  const src = studioBopArt(stem), src480 = studioBopArt(`${stem}-480`);
  return { src, src480, srcSet: `${src480} 480w, ${src} 1024w` };
}

/** The room each Next Studio game plays in (BopScene). Its intro fetches it
 *  while the cover shows, so the stage never paints an empty floor first
 *  (B-KID-175). Same files and sizes as BopScene, so the browser reuses it. */
const STUDIO_NEXT_SCENES: Record<StudioNextHost | "rhythm-garden", string> = { memory: "scene-delivery", pattern: "scene-sun", puzzle: "scene-table", "river-rescue": "scene-floor", "rhythm-garden": "scene-band" };
export const BOP_SCENE_SIZES = "(min-width: 700px) 620px, 100vw";
export function studioNextScene(id: string): StudioNextCover | null {
  if (!studioNextCover(id) || !Object.hasOwn(STUDIO_NEXT_SCENES, id)) return null;
  const stem = STUDIO_NEXT_SCENES[id as keyof typeof STUDIO_NEXT_SCENES];
  const src = studioBopArt(stem), src480 = studioBopArt(`${stem}-480`);
  return { src, src480, srcSet: `${src480} 480w, ${src} 1024w` };
}

/** A shared neutral V2 environment set; the profile is the sole child identity. */
const STUDIO_ART: Record<StudioArtKey, KidArt> = {
  "studio.sky": { src: `${STUDIO_V30}valley-wide.webp`, src480: `${STUDIO_V30}valley-wide-480.webp`, width: 1536, objectPosition: "50% 60%", altKey: null, provenanceId: "studio-v30-valley:2026-11-16", hasHero: false },
  "studio.portal.playbank": studioPortal("playbank"),
  "studio.portal.stories": studioPortal("stories"),
  "studio.portal.feelings": studioPortal("feelings"),
  "studio.portal.studio": studioPortal("studio"),
  "studio.cover.memory": studioFilm("cover-memory", "50% 60%"),
  "studio.cover.pattern": studioFilm("cover-pattern", "50% 40%"),
  "studio.cover.puzzle": studioFilm("cover-puzzle", "40% 55%"),
  "studio.cover.sneak": studioFilm("cover-sneak", "50% 55%"),
  "studio.room.calm": studioFilm("room-calm", "50% 60%"),
};
export const KID_THEME_MANIFEST: Record<KidThemeId, Partial<Record<KidArtKey, KidArt>>> = {
  film3d: {
    ...STUDIO_ART,
    "world.sound-explorer.tile": STUDIO_ART["studio.portal.studio"],
    // Calm Builder's tile is the glass room the child furnishes.
    "world.calm-builder.tile": STUDIO_ART["studio.room.calm"],
    // The October adventure worlds' rooms are now the film's empty sets: a canal
    // channel, the reflection terrace, the music-tile garden trail.
    "world.river-rescue.tile": studioFilm("room-canal", "50% 70%"),
    "world.feelings-forest.tile": studioFilm("room-reflection", "50% 65%"),
    "world.rhythm-garden.tile": studioFilm("room-music", "50% 70%"),
    "world.puzzle.tile": STUDIO_ART["studio.cover.puzzle"],
    "world.speech.tile": film("game-speech", "50% 22%", 1023),
    "world.feelings.tile": film("game-feelings"),
    "world.memory.tile": film("game-memory"),
    "world.beat.tile": film("game-beat"),
    "world.pose.tile": film("game-pose"),
    "world.pattern.tile": film("game-pattern"),
    "world.adventures.tile": film("game-adventures"),
    "world.mimic.tile": film("game-mimic", "50% 22%", 941),
    "world.reading.tile": film("game-reading"),
    // B-GAME-15a (6 Oct): Sneak & Freeze — Savta's courtyard, the cat covering its eyes, the hero sneaking.
    // Not in KID_WORLD_TILE_IDS (the painted worlds/v2 map and the gating list stay at the nine worlds); film-3D only.
    "world.sneak.tile": film("game-sneak", "50% 40%"),
    // Adventure tiles + Tonight banner: the unused film3d cards whose scene
    // matches the tile's job (play together / the hero's story map / a
    // bedtime reading nook).
    "world.kid-playbank.tile": film("game-truth-compass", "50% 30%"),
    "world.kid-hero.tile": film("game-aim-map", "50% 30%"),
    // The quest tile (9:16, also the phone home stage) and the wide stage behind
    // loading, reading and the arcade: the film's lantern arch and terrace.
    "world.kid-quest.tile": studioFilm("room-arch-tall", "50% 55%", 864),
    ...Object.fromEntries(FILM3D_STORY_COVERS.map((id) => [storyCoverKey(id), film(`story-${id}`, "50% 30%")])),
    ...Object.fromEntries(FILM3D_STORY_COVERS_2X3.map((id) => [storyCoverKey(id), film(`story-${id}`, "50% 30%", 832)])),
    "home.stage": studioFilm("room-terrace", "60% 55%"),
  },
  storybook: {
    ...STUDIO_ART,
    "world.sound-explorer.tile": STUDIO_ART["studio.portal.studio"],
    "world.calm-builder.tile": STUDIO_ART["studio.portal.feelings"],
    "world.river-rescue.tile": adventureScene("canal-world"),
    "world.feelings-forest.tile": adventureScene("story-theater"),
    "world.rhythm-garden.tile": adventureScene("sound-orbit"),
    "world.puzzle.tile": STUDIO_ART["studio.portal.playbank"],
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

/**
 * B-BOOK-31 / B-KID-143 — the SHARED art any account may be shown. A picture
 * that already paints a hero (`hasHero`: the 5 Oct glossy story covers and
 * game cards) paints the reference family's child; in a shared catalogue slot
 * it puts that child into every other child's books. Every shared story-cover
 * slot reads through here and gets null for such a picture, so the slot falls
 * back to its honest, complete hero-free state (the book's title card, the
 * theme's stage). A child's own hero reaches a cover only from that child's
 * own private prints (LibraryBookCover) and approved sheet. The files stay
 * where they are (Guy, 5 Oct); only the shared slots stop showing them.
 */
export function sharedKidArt(theme: KidThemeId, key: KidArtKey): KidArt | null {
  const art = kidArt(theme, key);
  return art && !art.hasHero ? art : null;
}

/** A story's cover in the child's theme, hero-free (sharedKidArt), or null. */
export function storyCoverArt(theme: KidThemeId, storyId: string): KidArt | null {
  return sharedKidArt(theme, storyCoverKey(storyId));
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
