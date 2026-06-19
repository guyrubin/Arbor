import React, { useState } from "react";
import { PersonStanding } from "lucide-react";
import { PlayHeader, MascotSay, ProgressPips, PlayButton, Celebrate } from "../ui/playkit";
import { HeroAvatar } from "../ui/HeroAvatar";
import { useArcadeLogger } from "../../practice/useArcadeLogger";
import { POSE_CARDS } from "../../practice/newGames";

/* Hero Pose — copy the hero's action pose. A gross-motor / body-imitation game:
   the hero shows a pose, the child strikes it, the grown-up confirms. Logs a
   "pose" event (domain: social — imitation/body awareness). On-device camera
   pose detection is a later enhancement; v1 is grown-up confirmed. */

export default function HeroPoseWorld() {
  const { first, log } = useArcadeLogger();
  const [idx, setIdx] = useState(0);
  const [cheer, setCheer] = useState(false);

  const done = idx >= POSE_CARDS.length;
  if (done) {
    return (
      <Celebrate title={`Super moves, ${first}!`} subtitle="You copied every hero pose. Strong body, strong hero." stars={3} starsTotal={3}>
        <PlayButton onClick={() => { setIdx(0); setCheer(false); }}>Pose again</PlayButton>
      </Celebrate>
    );
  }

  const pose = POSE_CARDS[idx];
  const didIt = () => {
    log("pose", "social", { correct: true, meta: pose.id });
    setCheer(true);
    window.setTimeout(() => { setCheer(false); setIdx((i) => i + 1); }, 1000);
  };

  return (
    <div className="space-y-6">
      <PlayHeader title="Hero Pose" say="I'll show a pose — can you copy it? Hold it while I count!" mood="cheer" />
      <ProgressPips total={POSE_CARDS.length} current={idx} tone="sky" />

      <div className="rounded-[var(--play-radius)] p-6 text-center comic-panel" style={{ background: "var(--arbor-sky-soft)" }}>
        <div className="flex items-center justify-center gap-4 mb-3">
          <HeroAvatar size={88} mood="cheer" />
          <span className="text-[4.5rem] leading-none" aria-hidden="true">{pose.emoji}</span>
        </div>
        <h2 className="font-black text-[1.7rem]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-sky-ink)" }}>{pose.name}</h2>
        <p className="text-[15px] font-bold mt-1" style={{ color: "var(--arbor-ink-soft)" }}>{pose.cue}</p>
      </div>

      {cheer ? (
        <MascotSay mood="proud" tone="clay">Amazing pose, {first}! High five! ✋</MascotSay>
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          <PlayButton onClick={didIt} tone="sky">We did it!</PlayButton>
          <PlayButton variant="ghost" onClick={() => setIdx((i) => i + 1)}>Skip</PlayButton>
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
        <PersonStanding className="w-3.5 h-3.5" aria-hidden="true" /> Big-body movement &amp; imitation
      </p>
    </div>
  );
}
