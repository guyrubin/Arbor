import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { PlayHeader, MascotSay, ProgressPips, PlayButton, Celebrate, ChoiceTile, PlayPanel } from "../ui/playkit";
import { useArcadeLogger } from "../../practice/useArcadeLogger";
import { BEAT_SETS, scoreBeatTaps, gradeStars } from "../../practice/newGames";
import { SpeakButton } from "../ui/SpeakButton";
import { useLanguage } from "../../context/LanguageContext";
import { selectionHaptic } from "../../lib/native";
import { noteKidActivity } from "../../lib/kidModeGate";
import { beatClick, closeBeatAudio } from "../../practice/beatAudio";

/* Beat Keeper — tap on the beat. A rhythm/timing game (regulation): a pulse
   flashes at a steady tempo, the child taps along, and tap timing is scored
   against the beat. Logs a "rhythm" event (domain: emotional/regulation).
   Visual-only pulse — no audio dependency. */

export default function BeatKeeperWorld() {
  const { first, log } = useArcadeLogger();
  const { t, uiLang } = useLanguage();
  const [roundIdx, setRoundIdx] = useState(0);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"ready" | "playing" | "scored">("ready");
  const [pulse, setPulse] = useState(-1);
  const [score, setScore] = useState(0);
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
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return (
      <Celebrate title={t("elev.play.beat.complete.title", { name: first })} subtitle={t("elev.play.beat.complete.sub")} stars={gradeStars(avg)} starsTotal={3}>
        <PlayButton onClick={() => { setSelectedSetId(null); setRoundIdx(0); setScores([]); setPhase("ready"); setPulse(-1); }}>{t("elev.kids.beat.choose.again")}</PlayButton>
      </Celebrate>
    );
  }

  const round = rounds[roundIdx];

  const finish = () => {
    const s = scoreBeatTaps(expRef.current, tapsRef.current);
    setScore(s);
    setScores((p) => [...p, s]);
    setPhase("scored");
    log("rhythm", "emotional", { correct: s >= 50, score: s, meta: `${selectedSet.id}:${round.beats}@${round.intervalMs}` });
    // N1-01-R5: one completed kid activity. A COUNT and nothing else —
    // a no-op outside Kid Mode, so a parent using this screen cannot inflate it.
    noteKidActivity();
  };

  const start = () => {
    tapsRef.current = [];
    expRef.current = Array.from({ length: round.beats }, (_, i) => round.intervalMs * (i + 1));
    startRef.current = Date.now();
    setPhase("playing");
    setPulse(-1);
    let k = 0;
    // KID-27: the pulse was VISUAL ONLY — a rhythm game the child could not
    // hear. Every beat now makes a short click through the shared Web Audio
    // node, so a child looking away can still keep time.
    beatClick();
    timerRef.current = window.setInterval(() => {
      k++;
      setPulse(k - 1);
      beatClick();
      if (k >= round.beats) {
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
          aria-label={phase === "playing" ? t("elev.play.beat.tapAria") : phase === "scored" ? t("elev.play.beat.scoredAria") : t("elev.play.beat.startAria")}
          className="play-pressable grid place-items-center rounded-full font-black text-white select-none"
          style={{
            width: 168, height: 168, border: "var(--comic-line)", fontFamily: "var(--font-display)", fontSize: 28,
            background: "var(--arbor-clay)",
            transform: phase === "playing" && pulse >= 0 ? "scale(1.12)" : "scale(1)",
            transition: "transform 120ms ease-out",
            boxShadow: phase === "playing" && pulse >= 0 ? "0 0 0 12px color-mix(in oklab, var(--arbor-clay) 35%, transparent)" : "var(--comic-pop)",
          }}
        >
          {phase === "playing" ? t("elev.play.beat.tap") : phase === "scored" ? "✔" : t("elev.play.beat.start")}
        </button>
      </div>

      {phase === "scored" && (
        <>
          <MascotSay mood="proud" tone="clay">
            {/* KID-27 / kid register: the child hears the beat verdict as words + stars, never a percentage. */}
            {score >= 80 ? t("elev.play.beat.feedback.nailed", { name: first }) : score >= 50 ? t("elev.play.beat.feedback.next") : t("elev.play.beat.feedback.keep")}
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
