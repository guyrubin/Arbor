/**
 * KidDashboard — the personalized Kid Mode home (viral redesign P0 shell + P1
 * avatar-in-scene art, see docs/KID-MODE-VIRAL-REDESIGN-PLAN.md). Renders the
 * greeting header, the Today's-adventure banner, the growth-adventure tiles
 * and the games grid. Every tile is a navigation entry that opens an EXISTING
 * surface unchanged — re-shell, never rewrite. KID-4: every game tile is named
 * after the real HeroArcade world it opens and pre-selects that world.
 *
 * Avatar-everywhere (P1): each tile + the banner use <WorldScene> — the same
 * production component HeroArcade ships — to generate a themed scene STARRING the
 * child's hero (the avatar is the consistency reference). Generation is lazy
 * (IntersectionObserver) + cached (sceneCache cost-guard).
 * DEFAULT (no custom avatar): the tile shows the pre-made comic-hero art from the
 * image repository (public/visuals/cards, served as ~70KB WebP thumbnails in
 * /sm/) — so the grid is rich comic art out of the box. A custom avatar then
 * personalizes each tile via generation. The themed icon is the ultimate
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
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Brain, Gamepad2, Heart, HeartPulse, Map, Mic, Music, PersonStanding, Shapes, Smile, Sparkles, Star, ChevronRight } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useHeroAvatar, HeroAvatar } from "../ui/HeroAvatar";
import { usePracticeData } from "../../practice/usePracticeData";
import WorldScene from "../practice/WorldScene";
import { HoldExitButton } from "./HoldExitButton";
import { kidIsolate } from "./kidText";
import { lastPlayedWorldYesterday } from "./kidGreeting";
import { chooseTonightsStory } from "./tonightsStory";

export type KidSurface = "journeys" | "arcade" | "feelings";

type Accent = "green" | "clay" | "lav" | "peach" | "sky" | "pink";
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

// `art` = the pre-made comic-hero card image (the existing image repository in
// public/visuals/cards). It is the DEFAULT tile art shown when the child has no
// custom avatar yet — so the grid is rich comic art out of the box. A custom
// avatar then personalizes each tile via WorldScene generation. KID-7: art files
// are UNIQUE per visible tile — a tile with no distinct asset omits `art` and
// shows its accent icon fallback instead of a wrong recycled image.
// KID-1: tile copy lives in lib/i18n.ts under `kid.adv.<id>.*` / `kid.game.<id>.*`
// — the defs here carry only ids, art and routing. kidMode.test.ts asserts every
// id below has its title/sub key pair in BOTH language maps.
interface AdventureDef {
  id: string;
  worldId: string;
  accent: Accent;
  imagePrompt: string;
  art?: string;
  Icon: React.ComponentType<{ className?: string }>;
  surface: KidSurface;
}

// The growth adventures. `surface` routes into an existing tab. KID-4: the old
// "Studio" tile was dropped — it had no live counterpart of its own (Mimic
// Studio is a named game tile below; a distinct creative studio stays gated on
// the games↔worlds decision, plan §9.5).
const ADVENTURES: AdventureDef[] = [
  { id: "playbank", worldId: "kid-playbank", accent: "green", Icon: Gamepad2, surface: "arcade", art: "/visuals/cards/sm/game-order-builder.webp", imagePrompt: "a joyful playroom full of colorful building blocks, learning toys and a friendly little dinosaur" },
  { id: "hero", worldId: "kid-hero", accent: "clay", Icon: BookOpen, surface: "journeys", art: "/visuals/cards/sm/game-adventures.webp", imagePrompt: "an epic storybook castle on a hill with a glowing open magic book and a brave flowing cape" },
]; // OBJ-KID-05: the "Feelings" adventure tile opened the SAME FeelingsLabTab as
   // the "Mood Mountain" game tile below (the arcade world `feelings` is that
   // component). Two tiles, one destination, and the child pays for the
   // duplicate twice: once choosing, once discovering they are in the same
   // place. The game tile keeps the door; the adventure tile is gone.

// Games grid — KID-4 honest navigation. Every tile is named EXACTLY after the
// live HeroArcade world it opens (`worldId` = the arcade world id) and reuses
// that world's color + scene prompt, so tile and destination are visually the
// same object. The tile passes its worldId through onOpenSurface so the arcade
// opens with the world pre-selected — honoring the existing mapping only; the
// per-game deep-link redesign stays a Guy-gated decision (plan §9.5).
interface GameDef {
  id: string;
  /** The HeroArcade world this tile opens — also the WorldScene cache key, so a
   *  generated tile scene is the SAME scene the arcade card shows. */
  worldId: string;
  accent: Accent;
  Icon: React.ComponentType<{ className?: string }>;
  imagePrompt: string;
  art?: string;
}
const GAMES: GameDef[] = [
  { id: "sound-lab", worldId: "speech", accent: "sky", Icon: Mic, art: "/visuals/cards/sm/game-speech.webp", imagePrompt: "a bright sound-and-music studio with a big microphone, floating letters and musical notes" },
  { id: "mood-mountain", worldId: "feelings", accent: "lav", Icon: Heart, imagePrompt: "a friendly mountain landscape with cheerful emotion characters (happy, sad, calm) and a warm sky" },
  { id: "mind-vault", worldId: "memory", accent: "pink", Icon: Brain, art: "/visuals/cards/sm/game-memory.webp", imagePrompt: "opening a glowing memory vault full of colorful matching cards" },
  { id: "beat-keeper", worldId: "beat", accent: "clay", Icon: Music, art: "/visuals/cards/sm/game-beat.webp", imagePrompt: "a colorful music stage with drums, rhythm bars and bouncing musical notes" },
  { id: "hero-pose", worldId: "pose", accent: "sky", Icon: PersonStanding, imagePrompt: "a dynamic superhero action pose with bold motion lines" },
  { id: "pattern-power", worldId: "pattern", accent: "lav", Icon: Shapes, imagePrompt: "a puzzle world of glowing shapes arranged in patterns" },
  { id: "story-quest", worldId: "adventures", accent: "peach", Icon: Map, imagePrompt: "an adventurous storybook landscape, holding a treasure map with a compass on a cliff" },
  { id: "mimic-studio", worldId: "mimic", accent: "clay", Icon: Smile, art: "/visuals/cards/sm/game-mimic.webp", imagePrompt: "a playful mirror studio copying silly happy poses, sparkles all around" },
];

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
export function kidDestinations(bannerStoryId: string): KidDestination[] {
  return [
    { tile: "quest-banner", surface: "journeys", arg: bannerStoryId },
    ...ADVENTURES.map((a) => ({ tile: `adv:${a.id}`, surface: a.surface, arg: null })),
    ...GAMES.map((g) => ({ tile: `game:${g.id}`, surface: "arcade" as KidSurface, arg: g.worldId })),
  ];
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
/** Growth-adventure tile (unchanged). */
export const KID_HOME_ADVENTURE_TILE_BLOCK = 150;
/** Grid gap between tiles. */
export const KID_HOME_TILE_GAP = 12;
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

/** A calm, one-shot count-up of an already-earned number. Reveals on mount only —
 *  never a live ticker. Respects prefers-reduced-motion (snaps to the total). */
function StarMeter({ value }: { value: number }) {
  const { t } = useLanguage();
  // Start at 0 so the count-up never flashes the final total for one frame on mount.
  const [shown, setShown] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value <= 0) {
      setShown(value);
      return;
    }
    const start = Date.now();
    const DURATION = 600;
    setShown(0);
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / DURATION);
      setShown(Math.round(p * value));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return (
    <span
      aria-label={t("kid.stars.aria", { count: value })}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        paddingInline: "12px",
        paddingBlock: "6px",
        borderRadius: "999px",
        background: "var(--arbor-peach-soft)",
        color: "var(--arbor-peach-ink)",
        fontWeight: 800,
        fontSize: "var(--t-sm)",
        whiteSpace: "nowrap",
      }}
    >
      <Star className="w-4 h-4" aria-hidden="true" />
      {shown}
    </span>
  );
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
  art,
  heroUrl,
  onClick,
  big,
  index,
}: {
  worldId: string;
  accent: Accent;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
  imagePrompt: string;
  /** KID-7: omitted when no distinct asset exists — the accent icon fallback
   *  renders instead of a recycled image from another tile. */
  art?: string;
  heroUrl?: string;
  onClick: () => void;
  big?: boolean;
  index: number;
}) {
  return (
    <button
      className="world-tile play-pop-in"
      onClick={onClick}
      style={{
        appearance: "none",
        position: "relative",
        overflow: "hidden",
        textAlign: "start",
        cursor: "pointer",
        padding: 0,
        background: ACCENT_BG[accent],
        minBlockSize: big ? `${KID_HOME_ADVENTURE_TILE_BLOCK}px` : `${KID_HOME_GAME_TILE_BLOCK}px`,
        animationDelay: `${index * 40}ms`,
      }}
    >
      {/* Default = the pre-made comic-hero art (image repository). It shows when
          there's no custom avatar, and as the loading/fallback under a generated
          avatar scene. The themed icon sits behind it as the ultimate fallback if
          the image fails to load. */}
      <WorldScene worldId={worldId} imagePrompt={imagePrompt} heroUrl={heroUrl}>
        <span className="relative block w-full h-full">
          <span aria-hidden="true" className="absolute inset-0 grid place-items-center" style={{ color: ACCENT_INK[accent], opacity: 0.9 }}>
            <Icon className="w-10 h-10" />
          </span>
          {art && <img src={art} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
        </span>
      </WorldScene>
      {/* Legibility scrim — dark at the bottom so white text reads over art OR icon. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to top, color-mix(in oklab, ${ACCENT_INK[accent]} 90%, transparent), color-mix(in oklab, ${ACCENT_INK[accent]} 30%, transparent) 38%, transparent 64%)`,
        }}
      />
      {/* Title block. */}
      <span style={{ position: "absolute", insetInline: 0, insetBlockEnd: 0, padding: big ? "14px" : "11px" }}>
        {/* OBJ-KID-06 fixup: `data-kid-tile-title` names the node the >= 20 px
            acceptance is about, so a rendered check measures the title itself
            and never the section heading or the inherited button size beside
            it. It is a measurement hook, not a style hook. */}
        <span data-kid-tile-title="" style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: big ? "var(--t-lg)" : KID_HOME_GAME_TITLE_SIZE, color: "var(--arbor-on-accent)", lineHeight: 1.12 }}>
          {title}
        </span>
        <span style={{ display: "block", fontSize: "var(--t-sm)", color: "var(--arbor-on-accent)", opacity: 0.88, marginBlockStart: "1px" }}>{sub}</span>
      </span>
    </button>
  );
}

export default function KidDashboard({
  onOpenSurface,
  onExit,
}: {
  /** KID-4: game tiles pass the HeroArcade worldId so the arcade opens with
   *  that world pre-selected — the tile's name appears verbatim on arrival. */
  onOpenSurface: (s: KidSurface, arcadeWorldId?: string) => void;
  onExit: () => void;
}) {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const hero = useHeroAvatar();
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
  const tonightsStoryId = useMemo(
    () => chooseTonightsStory(data.today, childProfile.id),
    [data.today, childProfile.id],
  );
  const greetingSub = yesterdayWorld
    ? kt("elev.kid.greeting.playedYesterday", { world: t(`kid.game.${yesterdayWorld}.title`) })
    : kt("elev.kid.greeting.ready");

  // Monotonic star total — lifetime sessions across modules. Never a streak.
  const stars = useMemo(
    () =>
      data.speech.items.length +
      data.mimic.items.length +
      data.adventures.items.length +
      data.events.items.length +
      data.missions.items.filter((m) => m.completed).length,
    [data.speech.items, data.mimic.items, data.adventures.items, data.events.items, data.missions.items],
  );

  return (
    <div style={{ maxInlineSize: "1100px", marginInline: "auto", display: "flex", flexDirection: "column", gap: `${KID_HOME_SECTION_GAP}px` }}>
      {/* ── Greeting header ─────────────────────────────────────────────── */}
      <header style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <HeroAvatar size={KID_HOME_HEADER_BLOCK} mood="wave" ring decorative />
        <div style={{ minInlineSize: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "var(--t-2xl)", color: "var(--arbor-sky-ink)", lineHeight: 1.05 }}>
            {kt("kid.greeting", { name: hero.name })}
          </div>
          <div style={{ fontSize: "var(--t-sm)", color: "var(--arbor-muted)" }}>{greetingSub}</div>
        </div>
        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
          <StarMeter value={stars} />
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
        onClick={() => onOpenSurface("journeys", tonightsStoryId)}
        style={{
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
        {/* KID-7: banner copy ("Start a hero story") + prompt + art depict the
            SAME scene — an epic storybook hero moment, never a recycled tile. */}
        <WorldScene worldId="kid-quest" imagePrompt="an epic storybook hero scene — a castle on a hill, a glowing open magic book and a brave cape mid-adventure" heroUrl={hero.url ?? undefined}>
          <span className="relative block w-full h-full">
            <span aria-hidden="true" className="absolute inset-0 grid place-items-center" style={{ color: "var(--arbor-sky-ink)", opacity: 0.9 }}>
              <Sparkles className="w-10 h-10" />
            </span>
            <img src="/visuals/cards/sm/game-courage-steps.webp" alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
          </span>
        </WorldScene>
        <span
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, color-mix(in oklab, var(--arbor-sky-ink) 92%, transparent), color-mix(in oklab, var(--arbor-sky-ink) 35%, transparent) 42%, transparent 70%)" }}
        />
        <span style={{ position: "absolute", insetInline: 0, insetBlockEnd: 0, padding: "18px", display: "flex", alignItems: "flex-end", gap: "14px" }}>
          <span style={{ flex: 1, minInlineSize: 0 }}>
            {/* Uppercase via CSS (a no-op in Hebrew) so the key stays sentence-case. */}
            <span style={{ display: "block", fontSize: "var(--t-xs)", letterSpacing: "0.08em", fontWeight: 800, color: "var(--arbor-on-accent)", opacity: 0.9, textTransform: "uppercase" }}>{kt("kid.quest.eyebrow")}</span>
            <span style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "var(--t-2xl)", color: "var(--arbor-on-accent)", lineHeight: 1.08 }}>{kt("kid.quest.title")}</span>
            <span style={{ display: "block", fontSize: "var(--t-sm)", color: "var(--arbor-on-accent)", opacity: 0.88 }}>{kt("kid.quest.sub")}</span>
          </span>
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", paddingInline: "16px", paddingBlock: "10px", borderRadius: "999px", background: "var(--arbor-peach)", color: "var(--arbor-on-accent)", fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {kt("kid.quest.cta")} <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </span>
        </span>
      </button>

      {/* ── Games ───────────────────────────────────────────────────────── */}
      <section aria-label={t("kid.games.title")}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBlockEnd: `${KID_HOME_HEAD_GAP}px` }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--t-base)", fontWeight: 900, color: "var(--arbor-ink)" }}>
            <Gamepad2 className="w-4 h-4" aria-hidden="true" style={{ color: "var(--arbor-lav-ink)" }} />
            {kt("kid.games.title")}
          </h2>
          <button
            onClick={() => onOpenSurface("arcade")}
            style={{ appearance: "none", background: "transparent", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", minHeight: `${KID_HOME_SECTION_HEAD_BLOCK}px`, fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--arbor-muted)" }}
          >
            {kt("kid.games.seeAll")} <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: `${KID_HOME_TILE_GAP}px` }}>
          {GAMES.map((g, i) => (
            <SceneTile key={g.id} worldId={g.worldId} accent={g.accent} Icon={g.Icon} title={kt(`kid.game.${g.id}.title`)} sub={kt(`kid.game.${g.id}.sub`)} imagePrompt={g.imagePrompt} art={g.art} heroUrl={hero.url ?? undefined} index={i} onClick={() => onOpenSurface("arcade", g.worldId)} />
          ))}
        </div>
      </section>
      {/* ── My growth adventures ────────────────────────────────────────── */}
      <section aria-label={t("kid.adventures.title")}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--t-base)", fontWeight: 900, color: "var(--arbor-ink)", marginBlockEnd: `${KID_HOME_HEAD_GAP}px` }}>
          <Sparkles className="w-4 h-4" aria-hidden="true" style={{ color: "var(--arbor-green-ink)" }} />
          {kt("kid.adventures.title")}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: `${KID_HOME_TILE_GAP}px` }}>
          {ADVENTURES.map((a, i) => (
            <SceneTile key={a.id} worldId={a.worldId} accent={a.accent} Icon={a.Icon} title={kt(`kid.adv.${a.id}.title`)} sub={kt(`kid.adv.${a.id}.sub`)} imagePrompt={a.imagePrompt} art={a.art} heroUrl={hero.url ?? undefined} big index={i} onClick={() => onOpenSurface(a.surface)} />
          ))}
        </div>
      </section>

    </div>
  );
}
