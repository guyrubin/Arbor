import React, { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Download } from "lucide-react";
import { StoryIllustration } from "./StoryIllustration";
import { ComicPage } from "../ui/playkit";
import { SpeakButton } from "../ui/SpeakButton";
import { stopSpeaking } from "../../lib/tts";
import { api, type AvatarStyle } from "../../lib/api";
import { comicGenerationKey } from "../../lib/heroComics";
import { getScene, resolveScene } from "../../lib/sceneCache";
import { runInstrumented } from "../../hooks/useAsyncAction";
import { ProvenanceBadge } from "../ui/ProvenanceBadge";
import { useLanguage } from "../../context/LanguageContext";
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
  beatNumber,
  beatTotal,
  photoUrl,
  heroAvatarUrl,
  heroAvatarStyle,
  heroName,
  childIdentity,
  immersive = false,
  fallbackArtUrl,
}: {
  scene: HeroSceneRender;
  seed: string;
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
}) {
  const [resolvedArt, setResolvedArt] = useState<{ key: string; url: string } | undefined>();
  const [artLoading, setArtLoading] = useState(false);
  const { uiLang, aiLang, t } = useLanguage();
  const effectiveStyle = heroAvatarStyle ?? "comichero";
  const artRequestKey = heroAvatarUrl && scene.imagePrompt
    ? comicGenerationKey({
        avatarOrHash: heroAvatarUrl,
        adventureId: seed,
        lang: aiLang,
        pageIndex: beatNumber,
         requestKind: "journey",
         style: effectiveStyle,
        childIdentity: childIdentity ?? heroName ?? seed,
         heroName: heroName ?? "",
         promptIdentity: JSON.stringify({
           theme: scene.imagePrompt,
           dialogue: scene.dialogue ?? null,
           sfx: scene.sfx ?? [],
         }),
       })
    : undefined;
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
    if (!heroAvatarUrl || !scene.imagePrompt || !artRequestKey) {
      setArtLoading(false);
      return;
    }
    // Shared key format (comicKey) so Story-Journey beats and Comic Reader pages
    // reuse the same cached art; `seed` already encodes story+beat+child, and
    // aiLang (=== ComicLang) keys Hebrew beats to the Hebrew reader cache.
    const key = artRequestKey;
    const cached = getScene(key);
    if (cached) { setResolvedArt({ key, url: cached }); setArtLoading(false); return; }

    let active = true;
    setArtLoading(true);
    // M4: scene art is generated lazily and degrades gracefully (the catch below
    // keeps the fallback illustration). runInstrumented adds start/success/error
    // analytics ("scene_art_*") so silent generation failures are observable.
    // resolveScene dedupes concurrent identical requests and throttles to
    // MAX_CONCURRENT parallel generations (cost guard).
    resolveScene(key, () =>
      runInstrumented("scene_art", () =>
        api.generateComic({
          avatar: { dataUrl: heroAvatarUrl },
          heroName,
          theme: scene.imagePrompt,
          sfx: scene.sfx,
          // the hero's own short line for this beat → comic speech bubble
          dialogue: scene.dialogue,
          style: effectiveStyle,
        }),
      ).then((r) => r.dataUrl),
    )
      .then((url) => { if (active) setResolvedArt({ key, url }); })
      .catch(() => { /* graceful: keep the fallback illustration */ })
      .finally(() => { if (active) setArtLoading(false); });
    return () => { active = false; };
  }, [artRequestKey]);

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
            <Download className="w-3.5 h-3.5" /> Save
          </button>
        )}
      </div>

      {(sceneArt || artLoading) ? (
        // The comic panel — full-width, bold comic-book frame, turning like a page
        // each beat. Shared ComicPage primitive (page-flip + reduced-motion fade).
        <AnimatePresence mode="wait">
          <ComicPage
            key={scene.beatId}
            src={sceneArt}
            alt={`Page ${beatNumber}: ${scene.title}`}
            pageNumber={beatNumber}
            loading={!sceneArt && artLoading}
            contentFit="contain"
            onImageError={() => setResolvedArt(undefined)}
          />
        </AnimatePresence>
      ) : (
        <div className="relative w-full max-w-3xl overflow-hidden rounded-[20px] shadow-2xl" style={{ aspectRatio: "3 / 2", outline: "3px solid var(--comic-ink)", background: "var(--arbor-paper-deep)" }}>
          {fallbackArtUrl ? (
            <img src={fallbackArtUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <StoryIllustration seed={seed} className="absolute inset-0 h-full w-full" />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(21,25,31,.08), transparent 60%)" }} />
          {(heroAvatarUrl || photoUrl) && (
            <div
              className="absolute bottom-2 h-[48%] max-h-48 rounded-2xl p-1"
              style={{ insetInlineStart: "5%", background: "var(--arbor-paper-elevated)", outline: "2px solid var(--comic-ink)", boxShadow: "3px 5px 0 rgba(23,27,34,.25)" }}
            >
              <img
                src={heroAvatarUrl ?? photoUrl}
                alt={heroName ? `${heroName}, the story hero` : "Story hero"}
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
