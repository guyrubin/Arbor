import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { PlayHeader, MascotSay, ProgressPips, PlayButton, Celebrate, ChoiceTile, PlayPanel } from "../ui/playkit";
import { useArcadeLogger } from "../../practice/useArcadeLogger";
import { BEAT_SETS, scoreBeatTaps } from "../../practice/newGames";
import { SpeakButton } from "../ui/SpeakButton";
import { useLanguage } from "../../context/LanguageContext";
import { selectionHaptic } from "../../lib/native";
import { noteKidActivity } from "../../lib/kidModeGate";
import { beatClick, closeBeatAudio } from "../../practice/beatAudio";

/* Beat Keeper — tap on the beat. A rhythm/timing game (regulation): the drum
   flashes AND clicks on every beat at a steady tempo (B-KID-37: the first
   click IS beat 1), the child taps along. Tap timing is logged for the parent
   record only; the child hears one warm line whatever the timing. */

export default function BeatKeeperWorld() {
  const { first, log } = useArcadeLogger();
  const { t, uiLang } = useLanguage();
  const [roundIdx, setRoundIdx] = useState(0);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"ready" | "playing" | "scored">("ready");
  const [pulse, setPulse] = useState(-1);
  // B-KID-37: a 120 ms flash on EVERY beat (pulse alone only ever grew, so the
  // drum stayed enlarged after beat 1 — a muted child saw one bump, then nothing).
  const [flash, setFlash] = useState(false);
  const flashBeat = () => { setFlash(true); window.setTimeout(() => setFlash(false), 120); };
  const [scores, setScores] = useState<number[]>([]);

  const startRef = useRef(0);
  const tapsRef = useRef<number[]>([]);
  const expRef = useRef<number[]>([]);
  const timerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current);
    // KID-27: the AudioContext is created on the first START (a user gesture,
    // which is what browsers require) and released with the world.
    closeBeatAudio();
  }, []);

  const selectedSet = BEAT_SETS.find((set) => set.id === selectedSetId) ?? null;
  const rounds = selectedSet?.rounds ?? [];
  const setLabel = selectedSet ? selectedSet.label[uiLang === "he" ? "he" : "en"] : "";

  if (!selectedSet) {
    const emoji: Record<string, string> = { "gentle-rain": "🌧️", "walking-parade": "🥁", "star-signals": "✨" };
    return (
      <div className="space-y-6">
        <PlayHeader
          title={t("elev.play.beat.title")}
          say={t("elev.kids.beat.choose.say")}
          mood="happy"
          worldId="beat"
          eyebrow={t("elev.kids.beat.choose.title")}
        />
        <PlayPanel tone="clay">
          <div className="grid gap-3 sm:grid-cols-3">
            {BEAT_SETS.map((set) => {
              const label = set.label[uiLang === "he" ? "he" : "en"];
              return (
                <ChoiceTile
                  key={set.id}
                  emoji={emoji[set.id] ?? "🎵"}
                  label={t("elev.kids.beat.choose.cta", { name: label })}
                  onClick={() => {
                    setSelectedSetId(set.id);
                    setRoundIdx(0);
                    setScores([]);
                    setPhase("ready");
                    setPulse(-1);
                  }}
                />
              );
            })}
          </div>
        </PlayPanel>
      </div>
    );
  }

  const done = roundIdx >= rounds.length;
  if (done) {
    // B-KID-04 (law 3): finishing IS the achievement — flat full stars, never
    // a grade of how close the taps were to the beat.
    return (
      <Celebrate title={t("elev.play.beat.complete.title", { name: first })} subtitle={t("elev.play.beat.complete.sub")} stars={3} starsTotal={3}>
        <PlayButton onClick={() => { setSelectedSetId(null); setRoundIdx(0); setScores([]); setPhase("ready"); setPulse(-1); }}>{t("elev.kids.beat.choose.again")}</PlayButton>
      </Celebrate>
    );
  }

  const round = rounds[roundIdx];

  const finish = () => {
    const s = scoreBeatTaps(expRef.current, tapsRef.current);
    setScores((p) => [...p, s]);
    setPhase("scored");
    log("rhythm", "emotional", { correct: s >= 50, score: s, meta: `${selectedSet.id}:${round.beats}@${round.intervalMs}` });
    // N1-01-R5: one completed kid activity. A COUNT and nothing else —
    // a no-op outside Kid Mode, so a parent using this screen cannot inflate it.
    noteKidActivity();
  };

  const start = () => {
    tapsRef.current = [];
    // B-KID-37: beat 1 is at t = 0 — the first click counts (it used to be an
    // extra click the child's first tap was spent on).
    expRef.current = Array.from({ length: round.beats }, (_, i) => round.intervalMs * i);
    startRef.current = Date.now();
    setPhase("playing");
    let k = 0;
    // KID-27: the pulse was VISUAL ONLY — a rhythm game the child could not
    // hear. Every beat now makes a short click through the shared Web Audio
    // node, so a child looking away can still keep time.
    setPulse(0);
    flashBeat();
    beatClick();
    timerRef.current = window.setInterval(() => {
      k++;
      setPulse(k);
      flashBeat();
      beatClick();
      if (k >= round.beats - 1) {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        finishTimerRef.current = window.setTimeout(finish, round.intervalMs);
      }
    }, round.intervalMs);
  };

  const tap = () => {
    if (phase !== "playing") return;
    tapsRef.current.push(Date.now() - startRef.current);
    // KID-27: the tap answers back in the body as well as on screen.
    void selectionHaptic();
  };

  return (
    <div className="space-y-6">
      <PlayHeader
        title={t("elev.play.beat.title")}
        say={t("elev.play.beat.say")}
        mood="happy"
        worldId="beat"
        variant="compact"
        eyebrow={setLabel}
        action={<SpeakButton text={t("elev.play.beat.say")} lang={uiLang} label={t("elev.play.speak.label")} size="md" className="min-w-[44px] min-h-[44px] justify-center" />}
      />
      <ProgressPips total={rounds.length} current={roundIdx} tone="clay" />

      <div className="rounded-[var(--play-radius)] p-6 grid place-items-center comic-panel" style={{ background: "var(--arbor-green-soft)", minHeight: 220 }}>
        <button
          onClick={phase === "playing" ? tap : start}
          data-beat={phase === "playing" ? pulse : undefined}
          aria-label={phase === "playing" ? t("elev.play.beat.tapAria") : phase === "scored" ? t("elev.play.beat.scoredAria") : t("elev.play.beat.startAria")}
          className="play-pressable grid place-items-center rounded-full font-black text-white select-none"
          style={{
            width: 168, height: 168, border: "var(--comic-line)", fontFamily: "var(--font-display)", fontSize: 28,
            background: "var(--arbor-clay)",
            transform: phase === "playing" && flash ? "scale(1.12)" : "scale(1)",
            transition: "transform 120ms ease-out",
            boxShadow: phase === "playing" && flash ? "0 0 0 12px color-mix(in oklab, var(--arbor-clay) 35%, transparent)" : "var(--comic-pop)",
          }}
        >
          {phase === "playing" ? t("elev.play.beat.tap") : phase === "scored" ? "✔" : t("elev.play.beat.start")}
        </button>
      </div>

      {phase === "scored" && (
        <>
          <MascotSay mood="proud" tone="clay">
            {/* B-KID-37 (law 1): one warm line for every round — never a sentence
                that varies with the child's timing, never a "try again" with no retry. */}
            {t("elev.play.beat.feedback.nailed", { name: first })}
          </MascotSay>
          <div className="flex justify-center">
            <PlayButton onClick={() => { setPhase("ready"); setPulse(-1); setRoundIdx((i) => i + 1); }}>
              {roundIdx + 1 < rounds.length ? t("elev.play.beat.next") : t("elev.play.beat.finish")}
            </PlayButton>
          </div>
        </>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
        <Icon name="music_note" size={14} /> {t("elev.play.beat.support")}
      </p>
    </div>
  );
}
