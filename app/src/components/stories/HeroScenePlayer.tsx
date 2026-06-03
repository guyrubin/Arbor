import React, { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { StoryIllustration } from "./StoryIllustration";
import { speak, stopSpeaking, ttsSupported } from "../../lib/tts";
import type { HeroSceneRender } from "../../types";

/**
 * The cinematic scene card for one beat of a Hero Journey: a seeded illustration
 * (or the child's photo as the hero avatar) plus the personalized narration and a
 * read-aloud control. Used both inline and in the immersive fullscreen overlay.
 */
export function HeroScenePlayer({
  scene,
  seed,
  beatNumber,
  beatTotal,
  photoUrl,
  immersive = false,
}: {
  scene: HeroSceneRender;
  seed: string;
  beatNumber: number;
  beatTotal: number;
  photoUrl?: string;
  immersive?: boolean;
}) {
  const [speaking, setSpeaking] = useState(false);

  // Stop speech whenever the scene changes or the card unmounts.
  useEffect(() => {
    stopSpeaking();
    setSpeaking(false);
    return () => stopSpeaking();
  }, [scene.beatId]);

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
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-[#f4d991] font-bold">
        <span>
          Beat {beatNumber} of {beatTotal}
        </span>
        {ttsSupported() && (
          <button
            onClick={toggleSpeak}
            className={`flex items-center gap-1 transition ${speaking ? "text-[#f4d991]" : "text-[#a8a093] hover:text-white"}`}
            aria-label={speaking ? "Stop reading" : "Read aloud"}
          >
            {speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            {speaking ? "Stop" : "Read"}
          </button>
        )}
      </div>

      <div className={`${artSize} rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10`}>
        {photoUrl ? (
          <img src={photoUrl} alt="Hero" className="w-full h-full object-cover" />
        ) : (
          <StoryIllustration seed={seed} className="w-full h-full" />
        )}
      </div>

      <h3 className={`font-extrabold tracking-tight text-[#f7f1e7] ${immersive ? "text-lg" : "text-base"}`}>
        {scene.title}
      </h3>

      <p
        dir="auto"
        className={`${textSize} text-gray-200 font-medium max-w-2xl`}
        style={immersive ? { fontFamily: "var(--font-display, Georgia), serif" } : undefined}
      >
        {scene.narration}
      </p>
    </div>
  );
}

export default HeroScenePlayer;
