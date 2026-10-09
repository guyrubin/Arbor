import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { StoryIllustration } from "./StoryIllustration";
import { ComicPage } from "../ui/playkit";
import { SpeakButton } from "../ui/SpeakButton";
import { Icon } from "../ui/Icon";
import { stopSpeaking } from "../../lib/tts";
import type { AvatarStyle } from "../../lib/api";
import { clearJourneyPageFailure, generateJourneyPage, hasJourneyPageFailed, journeyPageKey, type JourneyPageArgs } from "../../lib/heroComics";
import { runInstrumented } from "../../hooks/useAsyncAction";
import { ProvenanceBadge } from "../ui/ProvenanceBadge";
import { useLanguage } from "../../context/LanguageContext";
import { isolate } from "../../lib/i18n";
import { isolateNameIn, langDir } from "../../lib/bidi";
import { downloadHeroAvatarCanvas } from "../../lib/heroAvatarCanvas";
import { isKidModeActive } from "../../lib/kidModeGate";
import type { HeroSceneRender } from "../../types";
import { kidsStoriesText } from "../../lib/i18nElevation/kidsStories";
import { ArborMascot } from "../ui/ArborMascot";
import { setKidStage } from "../kidmode/kidChrome";

/** B-KID-70 (R-4b): where the cover is cropped on each beat (object-position),
 *  so a book read on one cover still turns eight different pages. */
export const BEAT_FOCUS = ["50% 22%", "30% 40%", "70% 35%", "50% 60%", "25% 25%", "75% 55%", "50% 45%", "50% 30%"] as const;

/** B-KID-76 (b): the Kid Mode picture-book page - the words at the kid type
 *  scale (>= 18 px), three lines in view on a phone, scrolling when longer.
 *  (The 55dvh full-width art block is gone: B-KID-128 below.) */

/** B-KID-128: book pages keep the picture's proportions on every screen. The
 *  covers are portrait 3:4; a full-width 55dvh block letterboxed them into a
 *  1920x408 slice on a desktop (the whale's mouth and the top of the child's
 *  hair). Below 640 px the art is full-bleed at 4:5 (at most ~6 % cropped off
 *  top + bottom, the per-beat focal point as before); from 640 px the reader
 *  is a two-column spread: the picture on the leading side at its own 3:4,
 *  as tall as the screen allows (never a fixed height that can letterbox), the
 *  words and Next/Back beside it, vertically centred at a reading measure.
 *  Logical grid columns, so Hebrew mirrors the spread. */
export const KID_BOOK_SPREAD_CLASS = "flex flex-col sm:grid sm:grid-cols-[auto_minmax(0,24rem)] sm:items-center sm:justify-center sm:gap-8 sm:px-6 sm:py-4";
export const KID_BOOK_ART_CLASS = "relative w-full overflow-hidden aspect-[4/5] sm:w-auto sm:aspect-[3/4] sm:h-[min(80vh,calc(100dvh_-_140px))] sm:rounded-[24px] sm:[border:var(--comic-line)]";
/** B-KID-133 (D-01): the words sit on a paper plate (`kid-page-plate`) —
 *  never directly on the Stage (the book's cover, blurred, fills the screen). */
export const KID_BOOK_SIDE_CLASS = "kid-page-plate flex min-w-0 flex-col sm:justify-center";
/** B-KID-128: on the wide spread every page shows the WHOLE picture; the
 *  per-beat variation is a gentle zoom toward that beat's focal point (max
 *  1.15), so the hero's face stays in frame. Literal classes (Tailwind scans). */
export const BEAT_SCALE_CLASS = ["sm:scale-100", "sm:scale-[1.06]", "sm:scale-[1.1]", "sm:scale-[1.04]", "sm:scale-[1.15]", "sm:scale-[1.08]", "sm:scale-[1.03]", "sm:scale-[1.12]"] as const;
export const KID_BOOK_TEXT_PX = 20;
export const KID_BOOK_TEXT_LINE = 1.5;

/**
 * AVA-3 / S3: scene-art cache. Generated scene images are large data URLs, so they
 * are cached via `lib/sceneCache` — a memory-only, quota-safe LRU with in-flight
 * dedupe and a MAX_CONCURRENT throttle — keyed by the shared `comicKey` helper so
 * Story-Journey panels and Comic Reader pages share hits. Cross-session persistence
 * is deferred to the Guy-gated Firebase Storage layer.
 */

/**
 * The cinematic scene card for one beat of a Hero Journey: a generated scene that
 * stars the child's own character (AVA-3) when a stylized avatar is available, falling
 * back to a seeded illustration plus narration and read-aloud.
 *
 * B-KID-01: the cameo on the fallback page is the generated hero
 * (`heroAvatarUrl`, else `cameoUrl` = `resolveHeroUrl(child)`) or Sprout. A real
 * photo is never the story cameo — there is no photo prop to pass one through.
 */
export function HeroScenePlayer({
  scene,
  seed,
  storyId,
  beatNumber,
  beatTotal,
  cameoUrl,
  heroAvatarUrl,
  heroAvatarStyle,
  heroName,
  childIdentity,
  immersive = false,
  fallbackArtUrl,
  fallbackArtHasHero = false,
  metaAction,
  childId,
  onPageResolved,
  layout = "card",
  textLang,
  aside,
}: {
  scene: HeroSceneRender;
  seed: string;
  /**
   * R3 (M3 critic, cross-module P0): the story's OWN id. `seed` is
   * `<storyId>-<beatId>-<childName>` — a per-beat illustration seed — and it
   * was being minted into `journeyPageKey` as the adventure id, so parts[6] of
   * every beat key read "the-two-gifts-call-Dylan" while the cover (minted in
   * HeroJourneyTab) carried the real story id. The shelf validator requires
   * parts[6] === adventureId, so every journey book failed to open. It also put
   * the child's display name into a cache key unhashed.
   * `seed` stays what it always was: the fallback illustration's seed.
   */
  storyId?: string;
  beatNumber: number;
  beatTotal: number;
  /** B-KID-01: the child's hero for the fallback cameo — `resolveHeroUrl(child)`
   *  (a generated character), never the raw uploaded photo. Absent → Sprout. */
  cameoUrl?: string;
  /** A generated stylized avatar (data URL) used as the hero across scenes. */
  heroAvatarUrl?: string;
  heroAvatarStyle?: AvatarStyle;
  heroName?: string;
  /** Stable child partition; display names are not unique identities. */
  childIdentity?: string;
  immersive?: boolean;
  /** Authored local environment art; contains no child and never triggers generation. */
  fallbackArtUrl?: string;
  /** B-KID-70 (R-4b): the fallback picture already shows a hero — no cameo box over it. */
  fallbackArtHasHero?: boolean;
  /** B-KID-53 polish: one extra control for the page's meta row (Kid Mode's full screen). */
  metaAction?: React.ReactNode;
  /** G2: enables the device-local page store so the story re-opens with its art. */
  childId?: string;
  /** G2: reports each resolved page key so the story can be saved as a book. */
  onPageResolved?: (page: { beatNumber: number; key: string }) => void;
  /** B-KID-76 (b): "book" = the Kid Mode picture-book page (full-bleed art,
   *  big words, no meta row, no smudged/Redraw state: a page whose art is not
   *  drawn shows the story's own cover crop). "card" = today's reader page. */
  layout?: "card" | "book";
  /** B-KID-120: the language the story's text is WRITTEN in (the render's
   *  language). The page text takes `lang` + `dir` from it - never `dir="auto"`,
   *  which let an English sentence opening with a Hebrew name run RTL. Absent →
   *  the AI language (the render's language before a run carried its own). */
  textLang?: "en" | "he";
  /** B-KID-128: the book page's controls (Decision choices, Back/Next) - drawn
   *  under the words, i.e. in the text column of the wide spread. */
  aside?: React.ReactNode;
}) {
  const [resolvedArt, setResolvedArt] = useState<{ key: string; url: string } | undefined>();
  const [artLoading, setArtLoading] = useState(false);
  // G2: a failed page stays a framed comic page with narration and a Redraw
  // control — never a silent swap back to generic art. `retryTick` re-arms
  // the effect; the scene cache never stores failures, so a retry regenerates.
  const [artError, setArtError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const { uiLang, aiLang, t } = useLanguage();
  const effectiveStyle = heroAvatarStyle ?? "comichero";
  // B-KID-120/121: the text's own language (the render's), never the UI's.
  const bookLang: "en" | "he" = textLang ?? (aiLang === "he" ? "he" : "en");
  // B-KID-124: read once per render, not a hook (the page is remounted per beat).
  const reducedMotion = typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  // B-KID-120: the text's own language and direction; the child's name inside
  // it is isolated at display time (a Hebrew name in an English sentence, a
  // Latin name in a Hebrew one), so it never reorders the words around it.
  const narration = isolateNameIn(scene.narration, heroName, bookLang);
  const beatTitle = isolateNameIn(scene.title, heroName, bookLang);
  const pageArgs: JourneyPageArgs | undefined = heroAvatarUrl && scene.imagePrompt
    ? {
        storyId: storyId ?? seed,
        lang: bookLang,
        heroName: heroName ?? "",
        heroDataUrl: heroAvatarUrl,
        style: effectiveStyle,
        childId,
        childIdentity: childIdentity ?? heroName ?? seed,
        pageIndex: beatNumber,
        theme: scene.imagePrompt,
        // B-KID-55 (KB-05): no lettered bubble on a story page — the narration
        // under the page carries the words (and the image model misspells them).
        sfx: scene.sfx ?? [],
      }
    : undefined;
  const artRequestKey = pageArgs ? journeyPageKey(pageArgs) : undefined;
  const sceneArt = resolvedArt && resolvedArt.key === artRequestKey ? resolvedArt.url : undefined;

  // B-KID-133 (D-01): in Kid Mode a book page names its story's cover as the
  // overlay's Stage (also when the book was opened from the library).
  useEffect(() => {
    if (layout !== "book" || !storyId || !isKidModeActive()) return;
    setKidStage({ kind: "story", storyId });
    return () => setKidStage(null);
  }, [layout, storyId]);

  // Stop speech whenever the scene changes or the card unmounts.
  useEffect(() => {
    stopSpeaking();
    return () => stopSpeaking();
  }, [scene.beatId]);

  // The story IS a comic: when the child has a stylized hero and the beat has an
  // illustrator prompt, render (or reuse a cached) COMIC PANEL that stars their
  // character — preserving the chosen outfit, with this beat's punchy SFX and a
  // short speech bubble. The narration below stays as the storyteller caption.
  useEffect(() => {
    setResolvedArt(undefined);
    setArtError(false);
    if (!pageArgs || !artRequestKey) {
      setArtLoading(false);
      return;
    }
    // R2: a page that already failed this session stays smudged on a remount.
    // Back/Next remount this component, and the effect used to re-request a key
    // that had just failed — the same page bought again on every page turn.
    // Only Redraw (below) clears the key and pays for another attempt.
    if (hasJourneyPageFailed(artRequestKey)) {
      setArtLoading(false);
      setArtError(true);
      return;
    }
    let active = true;
    setArtLoading(true);
    // G2: one page per beat through the shared comic pipeline — memory cache,
    // then the child's device store, then ONE deduped, throttled provider call
    // (cost guard: sceneCache MAX_CONCURRENT), written back to the device store
    // so the same story re-opens with its art. runInstrumented adds
    // start/success/error analytics ("scene_art_*").
    const key = artRequestKey;
    runInstrumented("scene_art", () => generateJourneyPage(pageArgs))
      .then(({ url }) => {
        if (!active) return;
        setResolvedArt({ key, url });
        onPageResolved?.({ beatNumber, key });
      })
      .catch(() => { if (active) setArtError(true); })
      .finally(() => { if (active) setArtLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artRequestKey, retryTick]);

  // AP-050: routes through the shared HeroAvatarCanvas module ("story" template)
  // so the scene save is tracked through one compositing path. Output is
  // byte-identical: story → renderShareCard("story", opts) → renderStoryCard.
  // KID-26: the save call itself lives inside the parent-only JSX branch below
  // (the kid-register scanner strips `!isKidModeActive() && (…)` blocks), so
  // no file download is reachable from inside Kid Mode.

  const textSize = immersive ? "text-2xl md:text-3xl leading-relaxed" : "text-sm md:text-base leading-relaxed";

  const cameo = (
    <div
      className="absolute bottom-2 h-[48%] max-h-48 rounded-2xl p-1"
      style={{ insetInlineStart: "5%", background: "var(--arbor-paper-elevated)", outline: "2px solid var(--comic-ink)", boxShadow: "var(--comic-pop)" }}
    >
      {(heroAvatarUrl ?? cameoUrl) ? (
        <img
          src={heroAvatarUrl ?? cameoUrl}
          alt={heroName
            ? kidsStoriesText("journey.heroAlt", aiLang, { name: isolate(heroName, aiLang) })
            : kidsStoriesText("journey.heroAltUnnamed", aiLang)}
          className="h-full w-auto rounded-xl object-contain"
        />
      ) : (
        // No generated hero yet: Sprout stars (role="img", keyed EN/HE
        // aria label). The story never blocks on a missing hero.
        <ArborMascot size={120} mood="wave" className="h-full w-auto" />
      )}
    </div>
  );

  if (layout === "book") {
    // B-KID-76 (b): one picture, then the words. Generated art when it exists
    // (a child with a hero and an allowance); otherwise the story's own cover,
    // cropped per beat; otherwise the seeded illustration. Never a smudged page
    // or a Redraw button in front of the child.
    return (
      <div className={KID_BOOK_SPREAD_CLASS} data-kid-book-page="">
        <span className="sr-only">{kidsStoriesText("journey.beat", aiLang, { current: beatNumber, total: beatTotal })}</span>
        <div className={KID_BOOK_ART_CLASS} data-kid-book-art="" style={{ background: "var(--arbor-paper-deep)" }}>
          {sceneArt ? (
            <img src={sceneArt} alt={kidsStoriesText("journey.pageAlt", aiLang, { number: beatNumber, title: scene.title })} className="absolute inset-0 h-full w-full object-cover" onError={() => { setResolvedArt(undefined); setArtError(true); }} />
          ) : fallbackArtUrl ? (
            <img src={fallbackArtUrl} alt="" aria-hidden="true" className={`absolute inset-0 h-full w-full object-cover ${BEAT_SCALE_CLASS[(beatNumber - 1) % BEAT_SCALE_CLASS.length]}`} style={{ objectPosition: BEAT_FOCUS[(beatNumber - 1) % BEAT_FOCUS.length], transformOrigin: BEAT_FOCUS[(beatNumber - 1) % BEAT_FOCUS.length] }} />
          ) : (
            <StoryIllustration seed={seed} className="absolute inset-0 h-full w-full" />
          )}
          {!sceneArt && !(fallbackArtUrl && fallbackArtHasHero) && cameo}
          {sceneArt && <ProvenanceBadge lang={uiLang === "he" ? "he" : "en"} className="absolute bottom-2 end-2" />}
        </div>
        <div className={KID_BOOK_SIDE_CLASS}>
        {/* B-KID-124: keyed by the words, so a personalised render that lands
            while the child is on this page fades in (reduced motion: a swap);
            the block is a fixed three lines, so nothing below it moves. */}
        <motion.p
          key={narration}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          lang={bookLang}
          dir={langDir(bookLang)}
          data-kid-book-text=""
          className="min-h-[calc(3*1.5em_+_16px)] max-h-[calc(3*1.5em_+_16px)] sm:max-h-[50vh] sm:max-w-[32ch]"
          // B-KID-133 (D-03): the book voice — Fraunces / Frank Ruhl 600 at
          // --kid-t-book (20 px at a phone, 26 px wide), line height 1.5 (HE 1.6).
          style={{ margin: 0, paddingInline: 20, paddingBlockStart: 16, fontSize: `max(${KID_BOOK_TEXT_PX}px, var(--kid-t-book))`, fontWeight: 600, lineHeight: "var(--kid-book-lh)", overflowY: "auto", color: "var(--arbor-ink)", fontFamily: "var(--font-display), Georgia, serif" }}
        >
          {narration}
        </motion.p>
        {aside}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center gap-5">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest font-bold" style={{ color: "var(--arbor-green-ink)" }}>
        {/* B-KID-53 polish: ONE visible page indicator — the reader's nav row
            ("1 / 8" between Back and Next); here only the accessible sentence
            "Page 1 of 8" (EN + HE). */}
        <span className="sr-only">{kidsStoriesText("journey.beat", aiLang, { current: beatNumber, total: beatTotal })}</span>
        {scene.narration && <SpeakButton text={scene.narration} lang={uiLang} className="touch-target" />}
        {metaAction}
        {/* KID-26: file downloads are a parent affordance — never reachable from inside Kid Mode. */}
        {sceneArt && !isKidModeActive() && (
          <button
            onClick={() =>
              void downloadHeroAvatarCanvas(
                "story",
                { imageUrl: sceneArt, name: heroName, title: scene.title },
                `${(heroName || "hero").toLowerCase()}-comic-page-${beatNumber}.png`,
              )
            } className="touch-target flex items-center gap-1 transition" style={{ color: "var(--arbor-muted)" }} aria-label={t("aria.saveComicPage")}>
            <Icon name="download" size={14} /> {t("learn.save")}
          </button>
        )}
      </div>

      {(sceneArt || artLoading || artError) ? (
        // The comic panel — full-width, bold comic-book frame, turning like a page
        // each beat. Shared ComicPage primitive (page-flip + reduced-motion fade).
        // A smudged page keeps the frame, the narration below and a Redraw control.
        <AnimatePresence mode="wait">
          <ComicPage
            key={scene.beatId}
            src={sceneArt}
            alt={kidsStoriesText("journey.pageAlt", aiLang, { number: beatNumber, title: scene.title })}
            pageNumber={beatNumber}
            loading={!sceneArt && artLoading}
            error={!sceneArt && !artLoading && artError}
            rtl={uiLang === "he"}
            contentFit="contain"
            onImageError={() => { setResolvedArt(undefined); setArtError(true); }}
            onRetry={() => { if (artRequestKey) clearJourneyPageFailure(artRequestKey); setArtError(false); setRetryTick((n) => n + 1); }}
            errorLabel={kidsStoriesText("page.smudged", aiLang)}
            retryLabel={kidsStoriesText("page.redraw", aiLang)}
            loadingLabel={kidsStoriesText("page.drawing", aiLang)}
          />
        </AnimatePresence>
      ) : (
        <div className="relative w-full max-w-3xl overflow-hidden rounded-[20px] shadow-2xl" style={{ aspectRatio: "3 / 2", outline: "3px solid var(--comic-ink)", background: "var(--arbor-paper-deep)" }}>
          {fallbackArtUrl ? (
            // R-4b: the story's cover is the page on every beat — cropped, with
            // the focal point moving per beat so no two pages are identical.
            <img src={fallbackArtUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: BEAT_FOCUS[(beatNumber - 1) % BEAT_FOCUS.length] }} />
          ) : (
            <StoryIllustration seed={seed} className="absolute inset-0 h-full w-full" />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--comic-ink) 8%, transparent), transparent 60%)" }} />
          {!(fallbackArtUrl && fallbackArtHasHero) && cameo}
        </div>
      )}

      {/* S4: label generated art as AI-made. The badge claims only that — Arbor
          does not verify any embedded watermark, so it must not imply one. */}
      {sceneArt && <ProvenanceBadge lang={uiLang === "he" ? "he" : "en"} className="-mt-2" />}

      <h3 lang={bookLang} dir={langDir(bookLang)} className={`font-extrabold tracking-tight ${immersive ? "text-lg" : "text-base"}`} style={{ color: "var(--arbor-ink)" }}>
        {beatTitle}
      </h3>

      <p
        lang={bookLang}
        dir={langDir(bookLang)}
        className={`${textSize} font-medium max-w-2xl`}
        style={{ color: "var(--arbor-ink-soft)", ...(immersive ? { fontFamily: "var(--font-display), Georgia, serif" } : {}) }}
      >
        {narration}
      </p>
    </div>
  );
}

export default HeroScenePlayer;
