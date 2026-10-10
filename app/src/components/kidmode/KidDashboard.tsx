/**
 * KidDashboard — the personalized Kid Mode home (viral redesign P0 shell + P1
 * avatar-in-scene art, see docs/KID-MODE-VIRAL-REDESIGN-PLAN.md). Renders the
 * greeting header, then (B-KID-88) Tonight's book, the "My books" row and the
 * games grid. Every tile is a navigation entry that opens an EXISTING
 * surface unchanged — re-shell, never rewrite. KID-4: every game tile is named
 * after the real HeroArcade world it opens and pre-selects that world.
 *
 * Avatar-everywhere (P1): each tile + the banner use <WorldScene> — the same
 * production component HeroArcade ships — to generate a themed scene STARRING the
 * child's hero (the avatar is the consistency reference). Generation is lazy
 * (IntersectionObserver) + cached (sceneCache cost-guard).
 * DEFAULT: reviewed neutral illustrations from the shared worldArtwork map.
 * A custom avatar personalizes each tile via generation. The themed icon is the ultimate
 * fallback if the image fails. Never a blank or a blocked first paint.
 *
 * Still deferred: the unified theme registry (P2), the bounded daily quest +
 * per-game levels (P3), the parent-mediated share loop (P4). The quest banner
 * therefore shows no fabricated progress and tiles carry no fake level badges.
 *
 * KID-1: every visible string renders through the i18n seam (lib/i18n.ts,
 * `kid.*` namespace — kid register, never referenced from parent surfaces).
 * Hebrew values are reviewer-pending EN placeholders behind the native-voice
 * transcreation gate (never machine-translated); the reviewer worklist lives in
 * docs/KID-MODE-HE-TRANSCREATION-TODO-GD-6.md (GD-6).
 *
 * Firewall: the star reads a MONOTONIC field (lifetime sessions), never a
 * streak. Styling is token-only and RTL-safe (logical CSS properties).
 */
import React, { Suspense, lazy, useEffect, useMemo, useSyncExternalStore } from "react";
import { BookOpen, Brain, Footprints, Gamepad2, Heart, Map, Mic, Music, PersonStanding, Shapes, Smile, Sparkles, Star, ChevronRight, Type } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import type { AvatarStyle } from "../../lib/api";
import { useLanguage } from "../../context/LanguageContext";
import { useHeroAvatar, HeroAvatar } from "../ui/HeroAvatar";
import { HERO_NAME_FALLBACK } from "../../lib/heroNameFallback";
import { usePracticeData } from "../../practice/usePracticeData";
import WorldScene from "../practice/WorldScene";
import { useKidTheme } from "../../hooks/useKidTheme";
import { prefetchKidSurfaces } from "./kidPrefetch";
import { KID_THEME_TILE_SHAPE, kidArt, storyCoverKey, worldTileKey, type KidThemeId } from "../../lib/kidThemeManifest";
import { HoldExitButton } from "./HoldExitButton";
import { kidIsolate } from "./kidText";
import { greetingWorldNameKey, lastPlayedWorldYesterday } from "./kidGreeting";
import { chooseTonightsStory } from "./tonightsStory";
import { useChildCollection } from "../../hooks/useChildCollection";
import { aimVirtues, loadCharter } from "../../lib/becoming";
import { loadShowAllAges } from "../../lib/ageFilter";
import { ageMonthsFromProfile } from "../../lib/childAge";
import type { HeroJourneyRun } from "../../types";
import { HERO_STORIES, storyLanguage } from "../../lib/heroJourneys";
import { kidBooks, kidShelfFor } from "./kidBooks";
import { KID_WORLDS, KID_WORLD_NAME_KEY, SNEAK_FREEZE_WORLD, kidWorldByWorldId, sneakFreezeFlagOn, type KidWorldAccent } from "./kidWorlds";
import { KID_BOOK_EAGER_COUNT, KidBookCover } from "./KidBookCover";
import { useChildLibraryBooks } from "./useChildLibraryBooks";
import { LibraryBookCover } from "./LibraryBookCover";
import { KidStickerStrip } from "./rewards/KidSouvenir";
import { kidOfflineArtUrls, precacheKidArt, recentlyOpenedStoryIds } from "../../lib/kidOfflineArt";
import { useKidSouvenirs } from "./rewards/useKidSouvenirs";
import { kidsStoriesText } from "../../lib/i18nElevation/kidsStories";

// B-GAME-15b: the Sneak tile is the game's own first frame with the child's
// hero, loaded with the game's chunk (never the painted card of one child).
const SneakPoster = lazy(() => import("./games/sneakFreeze/SneakFreeze").then((m) => ({ default: m.SneakPoster })));

export type KidSurface = "journeys" | "arcade" | "feelings" | "comics";

type Accent = KidWorldAccent;
const ACCENT_BG: Record<Accent, string> = {
  green: "var(--arbor-green-soft)",
  clay: "var(--arbor-clay-soft)",
  lav: "var(--arbor-lav-soft)",
  peach: "var(--arbor-peach-soft)",
  sky: "var(--arbor-sky-soft)",
  pink: "var(--arbor-pink-soft)",
};
const ACCENT_INK: Record<Accent, string> = {
  green: "var(--arbor-green-ink)",
  // `clay` resolves to a LIGHT blue (#58a6ff) — white text/icons over it fail WCAG-AA.
  // Use the dark blue ink as its companion so titles, icons and scrims pass contrast.
  clay: "var(--arbor-sky-ink)",
  lav: "var(--arbor-lav-ink)",
  peach: "var(--arbor-peach-ink)",
  sky: "var(--arbor-sky-ink)",
  pink: "var(--arbor-pink-ink)",
};

// B-KID-88: the kid home is Tonight's book -> My books -> Play. The two
// "growth adventure" tiles (Playbank = the arcade picker, Hero Stories = the
// catalogue) are gone: every world has its own tile below and the catalogue is
// the "My books" row's See all. One tile, one place (kidDestinations).

// Games grid — KID-4 honest navigation. B-KID-68: the tiles ARE the ONE kid
// world registry (kidWorlds.ts: id, routing worldId = art key, the one name +
// sub keys, accent, slot order); this file keeps only its own presentation
// (the lucide glyph and the scene prompt per world). The tile passes its
// worldId through onOpenSurface so the arcade opens with the world selected.
const GAME_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  speech: Mic, feelings: Heart, memory: Brain, beat: Music, pose: PersonStanding,
  pattern: Shapes, adventures: Map, mimic: Smile, reading: Type,
};
const GAME_PROMPT: Record<string, string> = {
  speech: "a bright sound-and-music studio with a big microphone, floating letters and musical notes",
  feelings: "a friendly mountain landscape with cheerful emotion characters (happy, sad, calm) and a warm sky",
  memory: "opening a glowing memory vault full of colorful matching cards",
  beat: "a colorful music stage with drums, rhythm bars and bouncing musical notes",
  pose: "a joyful movement pose with sweeping motion lines",
  pattern: "a puzzle world of glowing shapes arranged in patterns",
  adventures: "an adventurous landscape with a treasure map and compass on a cliff",
  mimic: "a playful mirror studio copying silly happy poses, sparkles all around",
  reading: "a magical letter forge where glowing letters become words",
};
const GAMES = KID_WORLDS.map((w) => ({ ...w, Icon: GAME_ICON[w.worldId] ?? Gamepad2, imagePrompt: GAME_PROMPT[w.worldId] ?? "" }));
/** B-GAME-19 (ruling GD-6, Guy 8 Oct "go"): the nine worlds leave the kid home
 *  once game 1 ships - while Sneak & Freeze is on, it is the ONE game on the
 *  kid home (shown large, the hero on its tile). The nine stay reachable as
 *  grown-up-led practice on the parent side. A device that turns the game off
 *  (arbor.flags.sneakFreeze = "0") keeps the nine, so the section never empties. */
export function kidHomeGames(sneakOn: boolean = sneakFreezeFlagOn()): typeof GAMES {
  return sneakOn ? [] : GAMES;
}
/** B-KID-88: the home's game tiles with their name keys (tests read this). */
export const KID_HOME_GAMES: readonly { id: string; worldId: string; titleKey: string; subKey: string }[] = KID_WORLDS.map((w) => ({
  id: w.id,
  worldId: w.worldId,
  titleKey: w.nameKey,
  subKey: w.subKey,
}));
/** B-KID-53: the kid name key of the world a tile opens (worldId → the ONE
 *  kid name), so the in-world bar says the tile's own name. B-KID-68: read
 *  from the registry. */
export const KID_GAME_TITLE_KEY: Readonly<Record<string, string>> = KID_WORLD_NAME_KEY;

/** OBJ-KID-05: every tile on the kid home, with the destination it opens.
 *  `surface` plus `arg` IS the destination — the overlay renders a surface and
 *  passes the arg through (arcade world id, or tonight's story id). Exported so
 *  the guard can prove the map is injective: one tile, one place. */
export interface KidDestination {
  tile: string;
  surface: KidSurface;
  /** The second openSurface argument, or null when the surface has no argument. */
  arg: string | null;
}

/** The static half of the destination map: the banner's arg is tonight's story,
 *  which is a function of the day, so it is supplied by the caller. */
export function kidDestinations(bannerStoryId: string, bookIds: readonly string[] = []): KidDestination[] {
  return [
    { tile: "quest-banner", surface: "journeys", arg: bannerStoryId },
    // B-KID-88: each "My books" cover opens ITS book; See all opens the library.
    ...bookIds.map((id) => ({ tile: `book:${id}`, surface: "journeys" as KidSurface, arg: id })),
    // B-KID-85: the library also holds the saved comics ("Made before").
    { tile: "books-see-all", surface: "journeys", arg: null },
    ...kidHomeGames().map((g) => ({ tile: `game:${g.id}`, surface: "arcade" as KidSurface, arg: g.worldId })),
    ...(sneakFreezeFlagOn() ? [{ tile: `game:${SNEAK_FREEZE_WORLD.id}`, surface: "arcade" as KidSurface, arg: SNEAK_FREEZE_WORLD.worldId }] : []),
  ];
}

/** B-KID-88: the "My books" row - the child's books (kidBooks) minus tonight's
 *  (the banner is its one door), at most this many before See all. */
export const KID_HOME_BOOK_ROW_MAX = 10;
export function kidHomeBookRow<B extends { story: { id: string } }>(books: readonly B[], tonightsStoryId: string): B[] {
  return books.filter((b) => b.story.id !== tonightsStoryId).slice(0, KID_HOME_BOOK_ROW_MAX);
}

/* ── OBJ-KID-06: the fold ────────────────────────────────────────────────
   At 390 px the kid home put 0 of 8 game tiles above the fold — the first sat
   at 931 px, behind the greeting, the quest banner and three stacked 150 px
   adventure tiles, on 135x97 tiles whose 15 px titles were the PARENT type
   scale. Two changes, no new component: the games section moves directly under
   the quest banner, and each game tile grows to the arcade `world-tile`'s
   proportions (HeroArcade.tsx:227-250 — the bigger, richer tile the app already
   ships) with a display-scale title. The title size is an absolute clamp, not a
   rem token — see KID_HOME_GAME_TITLE_SIZE.

   These constants are the single source for the block sizes below AND for
   kidDashboard.fold.test.ts, which adds them up against the 844 px viewport —
   the repo has no jsdom, so the fold is proved arithmetically from the numbers
   the component actually renders with. */
/** Greeting header: the 56 px hero avatar sets the row height. */
export const KID_HOME_HEADER_BLOCK = 56;
/** Vertical gap between the home's top-level sections. */
export const KID_HOME_SECTION_GAP = 20;
/** "Today's adventure" banner. */
export const KID_HOME_BANNER_BLOCK = 190;
/** Section heading row — its "See all games" control carries the 44 px floor. */
export const KID_HOME_SECTION_HEAD_BLOCK = 44;
/** Gap under a section heading (marginBlockEnd below). */
export const KID_HOME_HEAD_GAP = 10;
/** Game tile, at the arcade world-tile's scale (was 97 px). */
export const KID_HOME_GAME_TILE_BLOCK = 200;
/** P2-3: the game tile's ART BOX, fixed.

 *  The row was `minmax(100px, 1fr)`, so the artwork absorbed whatever the title
 *  block did not need: a one-line title left 128 px of scene, a two-line title
 *  ("Mood Mountain") left 106 px, and two tiles side by side in the same row
 *  showed different-sized worlds. A constant art box makes the grid read as one
 *  rhythm. 110 px is chosen so the tallest title block still fits inside
 *  KID_HOME_GAME_TILE_BLOCK at 390 px, which keeps the fold arithmetic above
 *  exactly as it was — proved in kidDashboard.fold.test.ts. */
export const KID_HOME_GAME_TILE_IMAGE_BLOCK = 110;
/** The retired growth-adventure tile (B-KID-88 removed it); kept for the
 *  fold test's pre-fix negative control. */
export const KID_HOME_ADVENTURE_TILE_BLOCK = 150;
/** B-KID-88: the "My books" row - a 116 px wide 3:4 cover (155 px) + a
 *  two-line 15 px caption (36 px) + the 6 px gap between them. */
export const KID_HOME_BOOK_ROW_BLOCK = 197;
/** Grid gap between tiles. */
export const KID_HOME_TILE_GAP = 12;
/** R-2b: a portrait-theme card (film3d) is image-led at this aspect; 2 columns
 *  below 768 px, 3 at md, 4 at lg (grid classes below). */
export const KID_HOME_PORTRAIT_ASPECT = "3 / 4";
const PORTRAIT_GRID = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
/** Game tile title. OBJ-KID-06 fixup: `var(--t-xl)` was a rem step, and the
 *  floor it clears depends on a root font-size the product never pins — the
 *  rendered check at 390 px measured 15 px on this surface, the SAME number the
 *  --t-base body inherit produces, so the token was either not resolving on the
 *  overlay or the checker read the inherited size off a neighbouring node. A rem
 *  step cannot tell those two apart. An absolute clamp can: 5vw is 19.5 px at
 *  390, so the minimum pins the title at exactly the 20 px kid floor on the
 *  measured viewport and lets it grow to 24 px on a wide one. The tile's own
 *  block size is unchanged, so the fold (Sound Lab @524, Mood Mountain @736)
 *  does not move — the title block is absolutely positioned inside the tile.
 *  HeroArcade.tsx:309 sets its comic heading the same way. */
export const KID_HOME_GAME_TITLE_SIZE = "clamp(20px, 5vw, 24px)";
/** The 390 px floor the clamp guarantees, asserted by kidDashboard.fold.test.ts. */
export const KID_HOME_GAME_TITLE_MIN_PX = 20;


/** 10 Oct 2026 (Guy: "not every button is visible at every resolution"): at
 *  1366x768 the one game sat under the books with 90 px of it above the fold,
 *  and half of it at 1920x1080. From this width the books and the game sit
 *  side by side and the game's tile is landscape (its stage has a landscape
 *  plate), so both are on the first screen of a laptop or a tablet. */
export const KID_HOME_PAIR_MIN_PX = 900;
export const KID_HOME_WIDE_GAME_ASPECT = "16 / 10";
const pairQuery = `(min-width: ${KID_HOME_PAIR_MIN_PX}px)`;
function subscribePair(fn: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(pairQuery);
  mq.addEventListener?.("change", fn);
  return () => mq.removeEventListener?.("change", fn);
}
function pairNow(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(pairQuery).matches;
}
function useKidHomePair(): boolean {
  return useSyncExternalStore(subscribePair, pairNow, () => false);
}

/** A themed tile whose background is an avatar-in-scene render (WorldScene),
 *  degrading to a centered themed icon. A bottom ink scrim keeps the title
 *  legible over both the generated art and the icon fallback. */
function SceneTile({
  worldId,
  accent,
  Icon,
  title,
  sub,
  imagePrompt,
  heroUrl,
  heroStyle,
  theme,
  onClick,
  big,
  index,
  scene,
  aspect,
}: {
  worldId: string;
  accent: Accent;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
  imagePrompt: string;
  heroUrl?: string;
  heroStyle?: AvatarStyle;
  /** B-KID-70: the child's one kid look — every tile on the screen shares it. */
  theme: KidThemeId;
  onClick: () => void;
  big?: boolean;
  index: number;
  /** B-GAME-15b: a composed picture that replaces the WorldScene render. */
  scene?: React.ReactNode;
  /** A portrait-theme tile's aspect (default 3:4); the wide home sets the
   *  game landscape so it sits beside the books, above the fold. */
  aspect?: string;
}) {
  // R-2b: the theme decides the tile shape (KID_THEME_TILE_SHAPE), not this file.
  const portrait = KID_THEME_TILE_SHAPE[theme] === "portrait";
  return (
    <button
      className="world-tile play-pop-in"
      onClick={onClick}
      style={portrait ? {
        appearance: "none",
        position: "relative",
        display: "block",
        overflow: "hidden",
        textAlign: "start",
        cursor: "pointer",
        padding: 0,
        background: ACCENT_BG[accent],
        aspectRatio: aspect ?? KID_HOME_PORTRAIT_ASPECT,
        minBlockSize: 44,
        inlineSize: "100%",
        animationDelay: `${index * 40}ms`,
      } : {
        appearance: "none",
        position: "relative",
        display: "grid",
        gridTemplateRows: big ? "minmax(60px, 1fr) auto" : `${KID_HOME_GAME_TILE_IMAGE_BLOCK}px auto`,
        overflow: "hidden",
        textAlign: "start",
        cursor: "pointer",
        padding: 0,
        background: ACCENT_BG[accent],
        minBlockSize: big ? `${KID_HOME_ADVENTURE_TILE_BLOCK}px` : `${KID_HOME_GAME_TILE_BLOCK}px`,
        animationDelay: `${index * 40}ms`,
      }}
    >
      <div className={portrait ? "absolute inset-0" : "relative"} style={portrait ? undefined : { minBlockSize: big ? 60 : KID_HOME_GAME_TILE_IMAGE_BLOCK }}>
        {scene ?? (
          <WorldScene worldId={worldId} theme={theme} imagePrompt={imagePrompt} heroUrl={heroUrl} heroStyle={heroStyle} sizes={portrait ? "(max-width: 767px) 50vw, 25vw" : big ? "(max-width: 639px) 100vw, 33vw" : "(max-width: 359px) 100vw, (max-width: 639px) 50vw, 25vw"}>
            <span aria-hidden="true" className="grid h-full w-full place-items-center" style={{ color: ACCENT_INK[accent] }}><Icon className="w-10 h-10" /></span>
          </WorldScene>
        )}

      </div>
      {/* Title block. */}
      <span style={portrait
        ? { position: "absolute", insetInline: 0, insetBlockEnd: 0, zIndex: 1, padding: "28px 10px 10px", background: "linear-gradient(to top, var(--arbor-paper-elevated) 62%, transparent)" }
        : { padding: big ? "14px" : "11px", background: "var(--arbor-paper-elevated)" }}>
        {/* OBJ-KID-06 fixup: `data-kid-tile-title` names the node the >= 20 px
            acceptance is about, so a rendered check measures the title itself
            and never the section heading or the inherited button size beside
            it. It is a measurement hook, not a style hook. */}
        <span data-kid-tile-title="" style={{ display: portrait ? "-webkit-box" : "block", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: KID_HOME_GAME_TITLE_SIZE, color: "var(--arbor-ink)", lineHeight: 1.12, ...(portrait ? { WebkitBoxOrient: "vertical" as const, WebkitLineClamp: 2, overflow: "hidden" } : {}) }}>
          {title}
        </span>
        <span style={{ display: "block", fontSize: "var(--t-sm)", color: "var(--arbor-ink)", opacity: 0.88, marginBlockStart: "1px", ...(portrait ? { whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" } : {}) }}>{sub}</span>
      </span>
    </button>
  );
}

export default function KidDashboard({
  onOpenSurface,
  onExit,
  onOpenBook,
}: {
  /** KID-4: game tiles pass the HeroArcade worldId so the arcade opens with
   *  that world pre-selected — the tile's name appears verbatim on arrival. */
  onOpenSurface: (s: KidSurface, arcadeWorldId?: string) => void;
  onExit: () => void;
  /** B-BOOK release: opens a library book (lib/library) full screen. */
  onOpenBook?: (bookId: string) => void;
}) {
  const { childProfile } = useArbor();
  const { t, uiLang, aiLang } = useLanguage();
  const hero = useHeroAvatar();
  const kidTheme = useKidTheme();
  // B-KID-47: warm every world's code on idle so a tap never waits on a chunk.
  useEffect(() => { prefetchKidSurfaces(); }, []);
  const data = usePracticeData(childProfile.id);
  // RUN-03: every kid-register string renders through the bidi isolate so an
  // EN placeholder inside a Hebrew (RTL) shell keeps its own direction —
  // "Hi Dylan!" can never paint as "!Hi Dylan".
  const kt = (key: string, vars?: Record<string, string | number>) => kidIsolate(t(key, vars));
  // RUN-21: the sub-greeting is derived from REAL state — the world played
  // yesterday (named exactly as its tile) or the neutral invitation. Never
  // praise-for-nothing, never a score, never a missed day.
  const yesterdayWorld = useMemo(
    () => lastPlayedWorldYesterday({ speech: data.speech.items, mimic: data.mimic.items, adventures: data.adventures.items, events: data.events.items }, data.today),
    [data.speech.items, data.mimic.items, data.adventures.items, data.events.items, data.today],
  );
  // OBJ-KID-05 / KID-25: "Today's adventure" opens ONE story, chosen from the
  // local day so the banner and the surface it opens name the same one all day.
  // HeroJourneyTab still applies its own age view to the request (W0.7).
  // B-PLAY-16: the SAME inputs the Stories cover passes (read stories, the
  // charter's aims, the age view) so both name the same story; the reason line
  // is the parent's and is ignored here.
  const heroRunsCol = useChildCollection<HeroJourneyRun>(childProfile.id, "heroRuns");
  // B-KID-96: the souvenirs the child kept (the "My stickers" strip).
  const souvenirs = useKidSouvenirs(childProfile.id);
  const heroReadIds = useMemo(() => heroRunsCol.items.map((r) => r.storyId), [heroRunsCol.items]);
  // B-BOOK release: a library book made with THIS child's own hero (their
  // private book files are complete for it) is tonight's pick, the way a book
  // illustrated in the child's theme leads (R-4b); the rest lead My books.
  // A child without one: nothing here changes.
  const libraryBooks = useChildLibraryBooks(childProfile.id);
  // K2: one David book per child - the legacy story leaves the shelf and Tonight
  const kidShelf = useMemo(() => kidShelfFor(libraryBooks), [libraryBooks]);
  // B-GAME-19: one game on the kid home while Sneak & Freeze is on.
  const homeGames = kidHomeGames();
  const bookLang: "en" | "he" = storyLanguage(uiLang, aiLang) === "he" ? "he" : "en";
  const tonightLib = onOpenBook ? libraryBooks[0] ?? null : null;
  const moreLib = onOpenBook ? libraryBooks.slice(1) : [];
  const tonightsStoryId = useMemo(
    () => chooseTonightsStory(data.today, childProfile.id, {
      readIds: heroReadIds,
      aims: aimVirtues(loadCharter()),
      ageMonths: ageMonthsFromProfile(childProfile),
      showAllAges: loadShowAllAges("hero-journeys"),
      // R-4b: lead with stories illustrated in this child's theme.
      prefer: (s) => kidArt(kidTheme, storyCoverKey(s.id)) !== null,
      // B-KID-46: only stories that can be told in the child's language (FIRST).
      lang: storyLanguage(uiLang, aiLang),
      stories: kidShelf,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.today, childProfile.id, heroReadIds, kidTheme, uiLang, aiLang, kidShelf],
  );
  // B-KID-78: keep tonight's cover, the last 3 opened books and this theme's
  // tile art in the service worker's kid-art cache (books work offline).
  const offlineArtKey = useMemo(
    () => kidOfflineArtUrls(kidTheme, tonightsStoryId, recentlyOpenedStoryIds(heroRunsCol.items)).join("|"),
    [kidTheme, tonightsStoryId, heroRunsCol.items],
  );
  useEffect(() => { precacheKidArt(offlineArtKey ? offlineArtKey.split("|") : []); }, [offlineArtKey]);
  // B-KID-06: the banner names the one story it opens (HE title in Hebrew),
  // instead of "Start a hero story / Pick a world" on a door with no choice.
  const tonightsStory = HERO_STORIES.find((s) => s.id === tonightsStoryId);
  const tonightsTitle = tonightsStory ? (uiLang === "he" ? tonightsStory.titleHe : tonightsStory.title) : "";
  // B-KID-42 / KA-28: the banner wears tonight's story's OWN cover in the
  // child's theme (same art + scene key as its Stories card); a story with no
  // cover in this theme keeps the reviewed `kid-quest` tile.
  const tonightsArtId = tonightsStory && kidArt(kidTheme, storyCoverKey(tonightsStory.id)) ? `story-${tonightsStory.id}` : "kid-quest";
  // R-2b: no sticker portrait pasted over art that already shows a hero; a
  // portrait theme gives the banner a 3:4 side panel (the cover's own shape).
  const tonightsArtHasHero = Boolean(kidArt(kidTheme, tonightsArtId === "kid-quest" ? worldTileKey("kid-quest") : storyCoverKey(tonightsStory!.id))?.hasHero);
  const tilePortrait = KID_THEME_TILE_SHAPE[kidTheme] === "portrait";
  const tonightsArtPrompt = tonightsStory && tonightsArtId !== "kid-quest" ? `${tonightsStory.title} — ${tonightsStory.theme}` : "an epic castle scene on a hill with a glowing open magic book";
  // B-KID-88: "My books" - the child's books (language + age view, opened
  // first, illustrated first), tonight's book excluded (the banner opens it).
  const bookRow = useMemo(
    () => kidHomeBookRow(kidBooks({
      lang: storyLanguage(uiLang, aiLang),
      ageMonths: ageMonthsFromProfile(childProfile),
      showAllAges: loadShowAllAges("hero-journeys"),
      hasCover: (id) => kidArt(kidTheme, storyCoverKey(id)) !== null,
      runs: heroRunsCol.items,
      stories: kidShelf,
    }), tonightLib ? "" : tonightsStoryId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uiLang, aiLang, childProfile.id, kidTheme, heroRunsCol.items, tonightsStoryId, tonightLib, kidShelf],
  );
  // B-KID-68: the world is named by the registry's own key (Spell Forge too).
  const yesterdayNameKey = yesterdayWorld ? greetingWorldNameKey(yesterdayWorld) : undefined;
  const greetingSub = yesterdayNameKey
    ? kt("elev.kid.greeting.playedYesterday", { world: t(yesterdayNameKey) })
    : kt("elev.kid.greeting.ready");


  const pair = useKidHomePair();
  return (
    <div style={{ maxInlineSize: "1100px", marginInline: "auto", display: "flex", flexDirection: "column", gap: `${KID_HOME_SECTION_GAP}px` }}>
      {/* ── Greeting header ─────────────────────────────────────────────── */}
      <header style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <HeroAvatar size={KID_HOME_HEADER_BLOCK} mood="wave" ring decorative />
        <div style={{ minInlineSize: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "var(--t-2xl)", color: "var(--arbor-sky-ink)", lineHeight: 1.05 }}>
            {hero.name === HERO_NAME_FALLBACK ? kt("elev.kid.greeting.noName") : kt("kid.greeting", { name: hero.name })}
          </div>
          <div style={{ fontSize: "var(--t-sm)", color: "var(--arbor-muted)" }}>{greetingSub}</div>
        </div>
        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
          {/* B-BOOK-26 (T7): no count is shown to the child — the star meter is gone. */}
          <HoldExitButton onExit={onExit} idleLabel={t("kid.exit.backToParent")} ariaIdle={t("kid.exit.backToParentAria")} />
        </div>
      </header>

      {/* ── Today's adventure banner ────────────────────────────────────── */}
      {/* KID-20 / RUN-04: the three parent-reassurance chips (parent locked /
          private by default / stars, never streaks) now live on the parent-side
          Kid-Mode door in PracticeStudioTab — the kid home opens on the hero.
          P3 adds the bounded daily quest + real progress. Shell shows no
          fabricated progress numerals. */}
      <button
        className="world-tile play-pop-in"
        onClick={() => (tonightLib && onOpenBook ? onOpenBook(tonightLib.book.id) : onOpenSurface("journeys", tonightsStoryId))}
        data-kid-tonight-book={tonightLib ? tonightLib.book.id : undefined}
        style={{
          display: "flex",
          appearance: "none",
          position: "relative",
          overflow: "hidden",
          textAlign: "start",
          cursor: "pointer",
          padding: 0,
          background: "var(--arbor-clay-soft)",
          minBlockSize: `${KID_HOME_BANNER_BLOCK}px`,
        }}
      >
        <div className="relative flex-shrink-0" style={tilePortrait ? { inlineSize: Math.round(KID_HOME_BANNER_BLOCK * 3 / 4), minBlockSize: KID_HOME_BANNER_BLOCK } : { inlineSize: "45%", maxInlineSize: 300, minBlockSize: KID_HOME_BANNER_BLOCK }}>
          {tonightLib ? (
            <LibraryBookCover childId={childProfile.id} entry={tonightLib} />
          ) : (
          <WorldScene worldId={tonightsArtId} theme={kidTheme} imagePrompt={tonightsArtPrompt} heroUrl={hero.url ?? undefined} heroStyle={hero.style} sizes="(max-width: 639px) 45vw, 300px" priority>
            <Sparkles aria-hidden="true" className="w-10 h-10" style={{ color: "var(--arbor-sky-ink)" }} />
          </WorldScene>
          )}
          {!tonightLib && !tonightsArtHasHero && (
          <span className="absolute bottom-2 end-2 z-[2] rounded-2xl" style={{ background: "var(--arbor-paper-elevated)", border: "2px solid var(--comic-ink)", boxShadow: "2px 2px 0 var(--comic-ink)" }}>
            {/* F6 — the featured hero ANNOUNCES. The adjacent text is "Tonight's
                story: {title}", never the child's name, so the same argument that
                un-hid the world-header cameo applies here. The greeting
                portrait above keeps `decorative`: it really does sit next to
                "Hi {name}!". */}
            <HeroAvatar size={80} mood="cheer" />
          </span>
          )}
        </div>
        <span style={{ flex: 1, minInlineSize: 0, padding: 14, alignSelf: "center" }}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--arbor-sky-ink)" }}>{kt("kid.quest.eyebrow")}</span>
          <span style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(20px, 5vw, 26px)", color: "var(--arbor-ink)", lineHeight: 1.12 }}>{tonightLib ? kidIsolate(tonightLib.book.title[bookLang]) : tonightsTitle}</span>
          <span style={{ display: "block", fontSize: 13, color: "var(--arbor-ink)", marginBlockStart: 4 }}>{kt("kid.quest.sub")}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minBlockSize: 44, fontWeight: 800, color: "var(--arbor-sky-ink)" }}>{kt("kid.quest.cta")} <ChevronRight className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" /></span>
        </span>
      </button>

      <div data-kid-home-pair={pair ? "" : undefined} style={pair ? { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", alignItems: "start", gap: `${KID_HOME_SECTION_GAP}px` } : { display: "flex", flexDirection: "column", gap: `${KID_HOME_SECTION_GAP}px` }}>
      {/* ── My books ────────────────────────────────────────────────────── */}
      {/* B-KID-88: directly under Tonight's book - the child's own shelf, one
          tap per book; See all opens the library (the story surface, no arg).
          The row scrolls along the reading direction (flex follows dir, so a
          Hebrew shelf starts at the right). */}
      <section aria-label={t("kidBooks.title")} data-kid-home-books="">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBlockEnd: `${KID_HOME_HEAD_GAP}px` }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: KID_HOME_GAME_TITLE_SIZE, fontWeight: 900, color: "var(--arbor-ink)" }}>
            <BookOpen className="w-4 h-4" aria-hidden="true" style={{ color: "var(--arbor-peach-ink)" }} />
            {kt("kidBooks.title")}
          </h2>
          <button
            onClick={() => onOpenSurface("journeys")}
            style={{ appearance: "none", background: "transparent", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", minHeight: `${KID_HOME_SECTION_HEAD_BLOCK}px`, minWidth: 44, fontSize: "var(--t-sm)", fontWeight: 800, color: "var(--arbor-sky-ink)" }}
          >
            {kt("kidBooks.seeAll")} <ChevronRight className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />
          </button>
        </div>
        {(bookRow.length > 0 || moreLib.length > 0) && (
          <ul
            style={{ listStyle: "none", margin: 0, marginInline: -20, paddingInline: 20, paddingBlockEnd: 4, display: "flex", gap: `${KID_HOME_TILE_GAP}px`, overflowX: "auto", scrollSnapType: "x mandatory", scrollPaddingInline: 20 }}
          >
            {moreLib.map((e) => (
              <li key={`library:${e.book.id}`} style={{ scrollSnapAlign: "start", flexShrink: 0 }}>
                <button
                  type="button"
                  className="world-tile"
                  data-library-book={e.book.id}
                  onClick={() => onOpenBook?.(e.book.id)}
                  aria-label={e.book.title[bookLang]}
                  style={{ position: "relative", display: "block", inlineSize: 140, aspectRatio: "3 / 4", padding: 0, overflow: "hidden", cursor: "pointer", appearance: "none" }}
                >
                  <LibraryBookCover childId={childProfile.id} entry={e} />
                </button>
              </li>
            ))}
            {bookRow.map((b, i) => (
              <li key={b.story.id} style={{ scrollSnapAlign: "start", flexShrink: 0 }}>
                <KidBookCover
                  layout="row"
                  eager={i < KID_BOOK_EAGER_COUNT}
                  storyId={b.story.id}
                  title={kidIsolate(uiLang === "he" ? b.story.titleHe : b.story.title)}
                  pack={b.story.pack}
                  theme={kidTheme}
                  read={b.state === "finished"}
                  readLabel={t("kidBooks.readMark")}
                  onOpen={() => onOpenSurface("journeys", b.story.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Games ───────────────────────────────────────────────────────── */}
      {/* B-KID-88: every world has its own tile, so the "See all games" door to
          the arcade picker (the "Playbank" menu) is gone. */}
      <section aria-label={t("kid.games.title")}>
        <div style={{ display: "flex", alignItems: "center", marginBlockEnd: `${KID_HOME_HEAD_GAP}px`, minHeight: `${KID_HOME_SECTION_HEAD_BLOCK}px` }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: KID_HOME_GAME_TITLE_SIZE, fontWeight: 900, color: "var(--arbor-ink)" }}>
            <Gamepad2 className="w-4 h-4" aria-hidden="true" style={{ color: "var(--arbor-lav-ink)" }} />
            {kt("kid.games.title")}
          </h2>
        </div>
        {/* B-GAME-19: the one game is shown large (one column, up to 420 px). */}
        <div className={tilePortrait && homeGames.length ? PORTRAIT_GRID : undefined} style={!homeGames.length ? { display: "grid", gridTemplateColumns: pair ? "minmax(0, 1fr)" : "minmax(0, 420px)", gap: `${KID_HOME_TILE_GAP}px` } : tilePortrait ? { gap: `${KID_HOME_TILE_GAP}px` } : { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))", gap: `${KID_HOME_TILE_GAP}px` }}>
          {homeGames.map((g, i) => (
            <SceneTile key={g.id} worldId={g.worldId} accent={g.accent} Icon={g.Icon} title={kt(g.nameKey)} sub={kt(g.subKey)} imagePrompt={g.imagePrompt} heroUrl={hero.url ?? undefined} heroStyle={hero.style} theme={kidTheme} index={i} onClick={() => onOpenSurface("arcade", g.worldId)} />
          ))}
          {/* B-GAME-07b: the G0 proof game, only behind its device flag. No
              tile art yet (dev placeholder = the accent + glyph); no hero url,
              so no scene is generated. */}
          {sneakFreezeFlagOn() && (
            <SceneTile key={SNEAK_FREEZE_WORLD.id} worldId={SNEAK_FREEZE_WORLD.worldId} accent={SNEAK_FREEZE_WORLD.accent} Icon={Footprints} title={kt(SNEAK_FREEZE_WORLD.nameKey)} sub={kt(SNEAK_FREEZE_WORLD.subKey)} imagePrompt="" theme={kidTheme} index={homeGames.length} onClick={() => onOpenSurface("arcade", SNEAK_FREEZE_WORLD.worldId)}
              scene={<Suspense fallback={null}><SneakPoster /></Suspense>} aspect={pair ? KID_HOME_WIDE_GAME_ASPECT : undefined} />
          )}
        </div>
      </section>
      </div>
      {/* B-KID-96: "My stickers" — the souvenirs the child kept (hidden while none). */}
      <KidStickerStrip
        items={souvenirs.items}
        lang={uiLang === "he" ? "he" : "en"}
        nameOf={(s) => {
          if (s.kind === "world") { const w = kidWorldByWorldId(s.refId); return w ? t(w.nameKey) : ""; }
          const story = HERO_STORIES.find((x) => x.id === s.refId);
          return story ? (uiLang === "he" ? story.titleHe : story.title) : "";
        }}
        onOpen={(s) => onOpenSurface(s.kind === "world" ? "arcade" : "journeys", s.refId)}
        heading={
          <div style={{ display: "flex", alignItems: "center", marginBlockEnd: `${KID_HOME_HEAD_GAP}px`, minHeight: `${KID_HOME_SECTION_HEAD_BLOCK}px` }}>
            <h2 style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: KID_HOME_GAME_TITLE_SIZE, fontWeight: 900, color: "var(--arbor-ink)" }}>
              <Star className="w-4 h-4" aria-hidden="true" style={{ color: "var(--arbor-peach-ink)" }} />
              {kidIsolate(kidsStoriesText("kidReward.myStickers", uiLang === "he" ? "he" : "en"))}
            </h2>
          </div>
        }
      />
      {/* B-KID-85: no comics door — saved comics live in the library ("My
          books" › Made before), one shelf for every book the child has. */}

    </div>
  );
}
