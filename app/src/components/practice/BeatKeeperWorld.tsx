import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { PlayHeader, MascotSay, ProgressPips, PlayButton, Celebrate } from "../ui/playkit";
import { useArcadeLogger } from "../../practice/useArcadeLogger";
import { BEAT_ROUNDS, scoreBeatTaps, gradeStars } from "../../practice/newGames";

/* Beat Keeper — tap on the beat. A rhythm/timing game (regulation): a pulse
   flashes at a steady tempo, the child taps along, and tap timing is scored
   against the beat. Logs a "rhythm" event (domain: emotional/regulation).
   Visual-only pulse — no audio dependency. */

export default function BeatKeeperWorld() {
  const { first, log } = useArcadeLogger();
  const [roundIdx, setRoundIdx] = useState(0);
  const [phase, setPhase] = useState<"ready" | "playing" | "scored">("ready");
  const [pulse, setPulse] = useState(-1);
  const [score, setScore] = useState(0);
  const [scores, setScores] = useState<number[]>([]);

  const startRef = useRef(0);
  const tapsRef = useRef<number[]>([]);
  const expRef = useRef<number[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); }, []);

  const done = roundIdx >= BEAT_ROUNDS.length;
  if (done) {
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return (
      <Celebrate title={`Right on beat, ${first}!`} subtitle="Steady taps build focus and self-control." stars={gradeStars(avg)} starsTotal={3}>
        <PlayButton onClick={() => { setRoundIdx(0); setScores([]); setPhase("ready"); setPulse(-1); }}>Play again</PlayButton>
      </Celebrate>
    );
  }

  const round = BEAT_ROUNDS[roundIdx];

  const finish = () => {
    const s = scoreBeatTaps(expRef.current, tapsRef.current);
    setScore(s);
    setScores((p) => [...p, s]);
    setPhase("scored");
    log("rhythm", "emotional", { correct: s >= 50, score: s, meta: `${round.beats}@${round.intervalMs}` });
  };

  const start = () => {
    tapsRef.current = [];
    expRef.current = Array.from({ length: round.beats }, (_, i) => round.intervalMs * (i + 1));
    startRef.current = Date.now();
    setPhase("playing");
    setPulse(-1);
    let k = 0;
    timerRef.current = window.setInterval(() => {
      k++;
      setPulse(k - 1);
      if (k >= round.beats) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        window.setTimeout(finish, round.intervalMs);
      }
    }, round.intervalMs);
  };

  const tap = () => {
    if (phase !== "playing") return;
    tapsRef.current.push(Date.now() - startRef.current);
  };

  return (
    <div className="space-y-6">
      <PlayHeader title="Beat Keeper" say="Watch the pulse, then tap the big button right on the beat!" mood="happy" />
      <ProgressPips total={BEAT_ROUNDS.length} current={roundIdx} tone="clay" />

      <div className="rounded-[var(--play-radius)] p-6 grid place-items-center comic-panel" style={{ background: "var(--arbor-green-soft)", minHeight: 220 }}>
        <button
          onClick={phase === "playing" ? tap : start}
          aria-label={phase === "playing" ? "Tap on the beat" : "Start the beat"}
          className="play-pressable grid place-items-center rounded-full font-black text-white select-none"
          style={{
            width: 168, height: 168, border: "var(--comic-line)", fontFamily: "var(--font-display)", fontSize: 28,
            background: "var(--arbor-primary)",
            transform: phase === "playing" && pulse >= 0 ? "scale(1.12)" : "scale(1)",
            transition: "transform 120ms ease-out",
            boxShadow: phase === "playing" && pulse >= 0 ? "0 0 0 12px color-mix(in oklab, var(--arbor-primary) 35%, transparent)" : "var(--comic-pop)",
          }}
        >
          {phase === "playing" ? "TAP!" : phase === "scored" ? "✔" : "START"}
        </button>
      </div>

      {phase === "scored" && (
        <>
          <MascotSay mood="proud" tone="clay">
            {score >= 80 ? `Wow, ${first}, you nailed the beat!` : score >= 50 ? "Nice rhythm! Try the next tempo." : "Keep feeling the beat — you've got this!"} ({score}%)
          </MascotSay>
          <div className="flex justify-center">
            <PlayButton onClick={() => { setPhase("ready"); setPulse(-1); setRoundIdx((i) => i + 1); }}>
              {roundIdx + 1 < BEAT_ROUNDS.length ? "Next tempo" : "Finish"}
            </PlayButton>
          </div>
        </>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
        <Icon name="music_note" size={14} /> Timing, focus &amp; self-regulation
      </p>
    </div>
  );
}
