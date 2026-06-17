import React, { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
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

  // AVA-3: when the child has a stylized character and the beat has an illustrator
  // prompt, generate (or reuse a cached) scene that stars their character.
  useEffect(() => {
    setSceneArt(undefined);
    if (!heroAvatarUrl || !scene.imagePrompt) return;
    const key = `${seed}|${shortHash(heroAvatarUrl)}`;
    const cached = sceneArtCache.get(key);
    if (cached) { setSceneArt(cached); return; }

    let active = true;
    setArtLoading(true);
    const run =
      sceneArtInFlight.get(key) ??
      api.generateScene({ imagePrompt: scene.imagePrompt, avatar: { dataUrl: heroAvatarUrl }, style: heroAvatarStyle })
        .then((r) => { sceneArtCache.set(key, r.dataUrl); return r.dataUrl; })
        .finally(() => sceneArtInFlight.delete(key));
    sceneArtInFlight.set(key, run);
    run
      .then((url) => { if (active) setSceneArt(url); })
      .catch(() => { /* graceful: keep the fallback illustration */ })
      .finally(() => { if (active) setArtLoading(false); });
    return () => { active = false; };
  }, [seed, scene.imagePrompt, heroAvatarUrl, heroAvatarStyle]);

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
      </div>

      <div className={`relative ${artSize} rounded-3xl overflow-hidden shadow-2xl`} style={{ outline: "1px solid var(--arbor-rule)" }}>
        {sceneArt ? (
          <img src={sceneArt} alt={scene.title} className="w-full h-full object-cover" />
        ) : photoUrl ? (
          <img src={photoUrl} alt="Hero" className="w-full h-full object-cover" />
        ) : (
          <StoryIllustration seed={seed} className="w-full h-full" />
        )}
        {artLoading && !sceneArt && (
          <div className="absolute inset-0 animate-pulse" style={{ background: "rgba(52,178,119,0.12)" }} aria-hidden="true" />
        )}
      </div>

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
