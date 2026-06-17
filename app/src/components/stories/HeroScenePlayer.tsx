import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Volume2, VolumeX, Download } from "lucide-react";
import { StoryIllustration } from "./StoryIllustration";
import { speak, stopSpeaking, ttsSupported } from "../../lib/tts";
import { api, type AvatarStyle } from "../../lib/api";
import type { HeroSceneRender } from "../../types";

/**
 * AVA-3: scene-art cache. Generated scene images are large data URLs, so we keep a
 * per-session in-memory cache (keyed by story-beat + avatar) plus an in-flight map to
 * dedupe concurrent requests when the parent flips between beats.
 */
const sceneArtCache = new Map<string, string>();
const sceneArtInFlight = new Map<string, Promise<string>>();

const shortHash = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

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
  const [speaking, setSpeaking] = useState(false);
  const [sceneArt, setSceneArt] = useState<string | undefined>();
  const [artLoading, setArtLoading] = useState(false);

  // Stop speech whenever the scene changes or the card unmounts.
  useEffect(() => {
    stopSpeaking();
    setSpeaking(false);
    return () => stopSpeaking();
  }, [scene.beatId]);

  // The story IS a comic: when the child has a stylized hero and the beat has an
  // illustrator prompt, render (or reuse a cached) COMIC PANEL that stars their
  // character. The narration below is the caption, so the panel carries no speech
  // bubble (dialogue omitted) — just art + comic SFX energy.
  useEffect(() => {
    setSceneArt(undefined);
    if (!heroAvatarUrl || !scene.imagePrompt) return;
    const key = `comic|${seed}|${shortHash(heroAvatarUrl)}`;
    const cached = sceneArtCache.get(key);
    if (cached) { setSceneArt(cached); return; }

    let active = true;
    setArtLoading(true);
    const run =
      sceneArtInFlight.get(key) ??
      api.generateComic({
        avatar: { dataUrl: heroAvatarUrl },
        heroName,
        theme: scene.imagePrompt,
        // dialogue omitted → no speech bubble; the narration caption carries the words
        style: (heroAvatarStyle ?? "comichero"),
      })
        .then((r) => { sceneArtCache.set(key, r.dataUrl); return r.dataUrl; })
        .finally(() => sceneArtInFlight.delete(key));
    sceneArtInFlight.set(key, run);
    run
      .then((url) => { if (active) setSceneArt(url); })
      .catch(() => { /* graceful: keep the fallback illustration */ })
      .finally(() => { if (active) setArtLoading(false); });
    return () => { active = false; };
  }, [seed, scene.imagePrompt, heroAvatarUrl, heroAvatarStyle, heroName]);

  const saveComicPage = () => {
    if (!sceneArt) return;
    const a = document.createElement("a");
    a.href = sceneArt;
    a.download = `${(heroName || "hero").toLowerCase()}-comic-page-${beatNumber}.png`;
    a.click();
  };

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else if (scene.narration) {
      speak(scene.narration, () => setSpeaking(false));
      setSpeaking(true);
    }
  };

  const artSize = immersive ? "w-40 h-40 md:w-48 md:h-48" : "w-28 h-28";
  const textSize = immersive ? "text-2xl md:text-3xl leading-relaxed" : "text-sm md:text-base leading-relaxed";

  return (
    <div className="flex flex-col items-center text-center gap-5">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest font-bold" style={{ color: "var(--arbor-green-ink)" }}>
        <span>
          Beat {beatNumber} of {beatTotal}
        </span>
        {ttsSupported() && (
          <button
            onClick={toggleSpeak}
            className="flex items-center gap-1 transition"
            style={{ color: speaking ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}
            aria-label={speaking ? "Stop reading" : "Read aloud"}
          >
            {speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            {speaking ? "Stop" : "Read"}
          </button>
        )}
        {sceneArt && (
          <button onClick={saveComicPage} className="flex items-center gap-1 transition" style={{ color: "var(--arbor-muted)" }} aria-label="Save this comic page">
            <Download className="w-3.5 h-3.5" /> Save
          </button>
        )}
      </div>

      {(sceneArt || artLoading) ? (
        // The comic panel — full-width, bold comic-book frame, turning like a page
        // each beat. This is the story rendered AS a comic, starring the child's hero.
        <div className="relative w-full max-w-3xl" style={{ perspective: 1600 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={scene.beatId}
              initial={{ opacity: 0, rotateY: -22, x: 36 }}
              animate={{ opacity: 1, rotateY: 0, x: 0 }}
              exit={{ opacity: 0, rotateY: 16, x: -28 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full rounded-[20px] overflow-hidden"
              style={{ aspectRatio: "3 / 2", border: "3px solid var(--arbor-ink)", boxShadow: "0 12px 36px rgba(41,51,63,0.22)", background: "var(--arbor-paper-deep)", transformOrigin: "left center" }}
            >
              {sceneArt ? (
                <img src={sceneArt} alt={scene.title} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 animate-pulse" style={{ background: "rgba(52,178,119,0.10)" }}>
                  <span className="text-3xl">✏️</span>
                  <span className="text-[12px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>Drawing the next page…</span>
                </div>
              )}
              {/* Comic page-number badge */}
              <span className="absolute bottom-2 right-2 grid place-items-center rounded-full text-white text-[12px] font-extrabold" style={{ width: 26, height: 26, background: "var(--arbor-ink)" }}>
                {beatNumber}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <div className={`relative ${artSize} rounded-3xl overflow-hidden shadow-2xl`} style={{ outline: "1px solid var(--arbor-rule)" }}>
          {photoUrl ? (
            <img src={photoUrl} alt="Hero" className="w-full h-full object-cover" />
          ) : (
            <StoryIllustration seed={seed} className="w-full h-full" />
          )}
        </div>
      )}

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
