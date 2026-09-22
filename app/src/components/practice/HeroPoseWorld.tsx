import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { PlayHeader, MascotSay, ProgressPips, PlayButton, Celebrate } from "../ui/playkit";
import { useArcadeLogger } from "../../practice/useArcadeLogger";
import { selectPoseSession } from "../../practice/newGames";
import { dayKey } from "../../practice/signals";
import { SpeakButton } from "../ui/SpeakButton";
import { useLanguage } from "../../context/LanguageContext";
import { noteKidActivity } from "../../lib/kidModeGate";

/* Hero Pose — copy the hero's action pose. A gross-motor / body-imitation game:
   the hero shows a pose, the child strikes it, the grown-up confirms. Logs a
   "pose" event (domain: social — imitation/body awareness). On-device camera
   pose detection is a later enhancement; v1 is grown-up confirmed. */

export default function HeroPoseWorld() {
  const { first, log } = useArcadeLogger();
  const { t, uiLang } = useLanguage();
  const [idx, setIdx] = useState(0);
  const [cheer, setCheer] = useState(false);
  const [sessionSeed, setSessionSeed] = useState(0);
  const advanceTimerRef = useRef<number | null>(null);
  const poses = useMemo(
    () => selectPoseSession(`${dayKey(new Date())}:${first}:${sessionSeed}`),
    [first, sessionSeed],
  );

  useEffect(() => () => {
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
  }, []);

  const done = idx >= poses.length;
  if (done) {
    return (
      <Celebrate title={t("elev.kids.pose.done.title", { name: first })} subtitle={t("elev.kids.pose.done.sub")} stars={3} starsTotal={3}>
        <PlayButton onClick={() => { setSessionSeed((seed) => seed + 1); setIdx(0); setCheer(false); }}>{t("elev.kids.pose.again")}</PlayButton>
      </Celebrate>
    );
  }

  const pose = poses[idx];
  const isHebrew = uiLang === "he";
  const poseName = isHebrew ? pose.nameHe : pose.name;
  const poseCue = isHebrew ? pose.cueHe : pose.cue;
  const adaptedCue = isHebrew ? pose.adaptedCueHe : pose.adaptedCue;
  // KID-09: the read-aloud control speaks the invitation AND this pose's cue,
  // so a pre-reader can play without a grown-up reading the card out.
  const poseSay = t("elev.kids.pose.say");
  const didIt = () => {
    log("pose", "social", { correct: true, meta: pose.id });
    // N1-01-R5: one completed kid activity. A COUNT and nothing else —
    // a no-op outside Kid Mode, so a parent using this screen cannot inflate it.
    noteKidActivity();
    setCheer(true);
    advanceTimerRef.current = window.setTimeout(() => { setCheer(false); setIdx((i) => i + 1); }, 1000);
  };

  return (
    <div className="space-y-6">
      <PlayHeader
        title={t("elev.kids.pose.title")}
        say={poseSay}
        mood="cheer"
        worldId="pose"
        variant="compact"
        action={<SpeakButton text={`${poseSay} ${poseCue} ${adaptedCue}`} lang={uiLang} label={t("elev.play.speak.label")} size="md" className="min-w-[44px] min-h-[44px] justify-center" />}
      />
      <ProgressPips total={poses.length} current={idx} tone="sky" />

      <div className="rounded-[var(--play-radius)] p-6 text-center comic-panel" style={{ background: "var(--arbor-sky-soft)" }}>
        <span className="text-[4.5rem] leading-none" aria-hidden="true">{pose.emoji}</span>
        <h2 className="font-black text-[1.7rem] mt-3" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-sky-ink)" }}>{poseName}</h2>
        <p className="text-[15px] font-bold mt-1" style={{ color: "var(--arbor-ink-soft)" }}>{poseCue}</p>
        <p className="play-story-caption text-[13px] font-semibold mt-3">{adaptedCue}</p>
      </div>

      {cheer ? (
        <MascotSay mood="proud" tone="clay">{t("elev.kids.pose.cheer", { name: first })} ✋</MascotSay>
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          <PlayButton onClick={didIt} tone="sky">{t("elev.kids.pose.didIt")}</PlayButton>
          <PlayButton variant="ghost" onClick={() => setIdx((i) => i + 1)}>{t("elev.kids.pose.skip")}</PlayButton>
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
        <Icon name="accessibility_new" size={14} /> {t("elev.kids.pose.support")}
      </p>
    </div>
  );
}
