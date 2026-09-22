import React, { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Download } from "lucide-react";
import { StoryIllustration } from "./StoryIllustration";
import { ComicPage } from "../ui/playkit";
import { SpeakButton } from "../ui/SpeakButton";
import { stopSpeaking } from "../../lib/tts";
import type { AvatarStyle } from "../../lib/api";
import { clearJourneyPageFailure, generateJourneyPage, hasJourneyPageFailed, journeyPageKey, type JourneyPageArgs } from "../../lib/heroComics";
import { runInstrumented } from "../../hooks/useAsyncAction";
import { ProvenanceBadge } from "../ui/ProvenanceBadge";
import { useLanguage } from "../../context/LanguageContext";
import { isolate } from "../../lib/i18n";
import { downloadHeroAvatarCanvas } from "../../lib/heroAvatarCanvas";
import { isKidModeActive } from "../../lib/kidModeGate";
import type { HeroSceneRender } from "../../types";
import { kidsStoriesText } from "../../lib/i18nElevation/kidsStories";

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
 * back to a seeded illustration (or the child's photo) plus narration and read-aloud.
 */
export function HeroScenePlayer({
  scene,
  seed,
  storyId,
  beatNumber,
  beatTotal,
  photoUrl,
  heroAvatarUrl,
  heroAvatarStyle,
  heroName,
  childIdentity,
  immersive = false,
  fallbackArtUrl,
  childId,
  onPageResolved,
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
  photoUrl?: string;
  /** A generated stylized avatar (data URL) used as the hero across scenes. */
  heroAvatarUrl?: string;
  heroAvatarStyle?: AvatarStyle;
  heroName?: string;
  /** Stable child partition; display names are not unique identities. */
  childIdentity?: string;
  immersive?: boolean;
  /** Authored local environment art; contains no child and never triggers generation. */
  fallbackArtUrl?: string;
  /** G2: enables the device-local page store so the story re-opens with its art. */
  childId?: string;
  /** G2: reports each resolved page key so the story can be saved as a book. */
  onPageResolved?: (page: { beatNumber: number; key: string }) => void;
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
  const pageArgs: JourneyPageArgs | undefined = heroAvatarUrl && scene.imagePrompt
    ? {
        storyId: storyId ?? seed,
        lang: aiLang,
        heroName: heroName ?? "",
        heroDataUrl: heroAvatarUrl,
        style: effectiveStyle,
        childId,
        childIdentity: childIdentity ?? heroName ?? seed,
        pageIndex: beatNumber,
        theme: scene.imagePrompt,
        dialogue: scene.dialogue,
        sfx: scene.sfx ?? [],
      }
    : undefined;
  const artRequestKey = pageArgs ? journeyPageKey(pageArgs) : undefined;
  const sceneArt = resolvedArt && resolvedArt.key === artRequestKey ? resolvedArt.url : undefined;

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

  return (
    <div className="flex flex-col items-center text-center gap-5">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest font-bold" style={{ color: "var(--arbor-green-ink)" }}>
        <span>
          {kidsStoriesText("journey.beat", aiLang, { current: beatNumber, total: beatTotal })}
        </span>
        {scene.narration && <SpeakButton text={scene.narration} lang={uiLang} className="touch-target" />}
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
            <Download className="w-3.5 h-3.5" /> {t("learn.save")}
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
            <img src={fallbackArtUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <StoryIllustration seed={seed} className="absolute inset-0 h-full w-full" />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--comic-ink) 8%, transparent), transparent 60%)" }} />
          {(heroAvatarUrl || photoUrl) && (
            <div
              className="absolute bottom-2 h-[48%] max-h-48 rounded-2xl p-1"
              style={{ insetInlineStart: "5%", background: "var(--arbor-paper-elevated)", outline: "2px solid var(--comic-ink)", boxShadow: "var(--comic-pop)" }}
            >
              <img
                src={heroAvatarUrl ?? photoUrl}
                alt={heroName
                  ? kidsStoriesText("journey.heroAlt", aiLang, { name: isolate(heroName, aiLang) })
                  : kidsStoriesText("journey.heroAltUnnamed", aiLang)}
                className="h-full w-auto rounded-xl object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* S4: label generated art as AI-made. The badge claims only that — Arbor
          does not verify any embedded watermark, so it must not imply one. */}
      {sceneArt && <ProvenanceBadge lang={uiLang === "he" ? "he" : "en"} className="-mt-2" />}

      <h3 className={`font-extrabold tracking-tight ${immersive ? "text-lg" : "text-base"}`} style={{ color: "var(--arbor-ink)" }}>
        {scene.title}
      </h3>

      <p
        dir="auto"
        className={`${textSize} font-medium max-w-2xl`}
        style={{ color: "var(--arbor-ink-soft)", ...(immersive ? { fontFamily: "var(--font-display), Georgia, serif" } : {}) }}
      >
        {scene.narration}
      </p>
    </div>
  );
}

export default HeroScenePlayer;
