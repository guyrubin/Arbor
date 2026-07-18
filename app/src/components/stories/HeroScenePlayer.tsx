import React, { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Download } from "lucide-react";
import { StoryIllustration } from "./StoryIllustration";
import { ComicPage } from "../ui/playkit";
import { SpeakButton } from "../ui/SpeakButton";
import { stopSpeaking } from "../../lib/tts";
import { api, type AvatarStyle } from "../../lib/api";
import { comicKey } from "../../lib/heroComics";
import { getScene, resolveScene } from "../../lib/sceneCache";
import { runInstrumented } from "../../hooks/useAsyncAction";
import { ProvenanceBadge } from "../ui/ProvenanceBadge";
import { useLanguage } from "../../context/LanguageContext";
import { downloadHeroAvatarCanvas } from "../../lib/heroAvatarCanvas";
import type { HeroSceneRender } from "../../types";

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
  immersive = false,
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
  immersive?: boolean;
}) {
  const [sceneArt, setSceneArt] = useState<string | undefined>();
  const [artLoading, setArtLoading] = useState(false);
  const { uiLang, aiLang, t } = useLanguage();

  // Stop speech whenever the scene changes or the card unmounts.
  useEffect(() => {
    stopSpeaking();
    return () => stopSpeaking();
  }, [scene.beatId]);

  // The story IS a comic: when the child has a stylized hero and the beat has an
  // illustrator prompt, render (or reuse a cached) COMIC PANEL that stars their
  // character — with the hero's name on the suit, this beat's punchy SFX, and a
  // short speech bubble. The narration below stays as the storyteller caption.
  useEffect(() => {
    setSceneArt(undefined);
    if (!heroAvatarUrl || !scene.imagePrompt) return;
    // Shared key format (comicKey) so Story-Journey beats and Comic Reader pages
    // reuse the same cached art; `seed` already encodes story+beat+child, and
    // aiLang (=== ComicLang) keys Hebrew beats to the Hebrew reader cache.
    const key = comicKey(heroAvatarUrl, seed, aiLang, beatNumber);
    const cached = getScene(key);
    if (cached) { setSceneArt(cached); return; }

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
          style: (heroAvatarStyle ?? "comichero"),
        }),
      ).then((r) => r.dataUrl),
    )
      .then((url) => { if (active) setSceneArt(url); })
      .catch(() => { /* graceful: keep the fallback illustration */ })
      .finally(() => { if (active) setArtLoading(false); });
    return () => { active = false; };
  }, [seed, scene.imagePrompt, heroAvatarUrl, heroAvatarStyle, heroName, aiLang]);

  // AP-050: routes through the shared HeroAvatarCanvas module ("story" template)
  // so the scene save is tracked through one compositing path. Output is
  // byte-identical: story → renderShareCard("story", opts) → renderStoryCard.
  const saveComicPage = () => {
    if (!sceneArt) return;
    void downloadHeroAvatarCanvas(
      "story",
      { imageUrl: sceneArt, name: heroName, title: scene.title },
      `${(heroName || "hero").toLowerCase()}-comic-page-${beatNumber}.png`,
    );
  };

  const artSize = immersive ? "w-40 h-40 md:w-48 md:h-48" : "w-28 h-28";
  const textSize = immersive ? "text-2xl md:text-3xl leading-relaxed" : "text-sm md:text-base leading-relaxed";

  return (
    <div className="flex flex-col items-center text-center gap-5">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest font-bold" style={{ color: "var(--arbor-green-ink)" }}>
        <span>
          Beat {beatNumber} of {beatTotal}
        </span>
        {scene.narration && <SpeakButton text={scene.narration} lang={uiLang} />}
        {sceneArt && (
          <button onClick={saveComicPage} className="flex items-center gap-1 transition" style={{ color: "var(--arbor-muted)" }} aria-label={t("aria.saveComicPage")}>
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
          />
        </AnimatePresence>
      ) : (
        <div className={`relative ${artSize} rounded-3xl overflow-hidden shadow-2xl`} style={{ outline: "1px solid var(--arbor-rule)" }}>
          {photoUrl ? (
            <img src={photoUrl} alt="Hero" className="w-full h-full object-cover" />
          ) : (
            <StoryIllustration seed={seed} className="w-full h-full" />
          )}
        </div>
      )}

      {/* S4: make the model's SynthID + C2PA provenance visible on generated art. */}
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
