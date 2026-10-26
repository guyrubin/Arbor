import React, { useState } from "react";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { ArborMascot, type MascotMood } from "../../ui/ArborMascot";
import { kidSay, kidSfx } from "../audio/kidAudio";

const TAP_MOODS: readonly MascotMood[] = ["cheer", "think", "happy"];

/** 25 Oct input ("the flower doesn't respond"): Sprout answers every tap, on
 *  home and in every world — a hop (none under reduced motion), the tap sound,
 *  a new face, and the hint `onTap` returns, read aloud. */
export function StudioSprout({ size, rest = "wave", label, onTap }: { size: number; rest?: MascotMood; label: string; onTap: () => string }) {
  const { childProfile } = useArbor();
  const { uiLang } = useLanguage();
  const [taps, setTaps] = useState(0);
  const mood = taps === 0 ? rest : TAP_MOODS[(taps - 1) % TAP_MOODS.length];
  return <button type="button" className="studio-v2__sprout" aria-label={label} data-sprout-taps={taps} onClick={() => {
    kidSfx("tap");
    kidSay(childProfile.id, onTap(), uiLang === "he" ? "he" : "en");
    setTaps(n => n + 1);
  }}><span className="studio-v2__sprout-hop" key={taps}><ArborMascot size={size} mood={mood} animate={false} /></span></button>;
}
