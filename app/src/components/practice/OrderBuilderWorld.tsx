import React, { useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import { PlayHeader, MascotSay, ChoiceTile, ProgressPips, PlayButton, Celebrate } from "../ui/playkit";
import HeroWinActions from "./HeroWinActions";
import { MissionBridge, MissionStatGrid } from "./MissionStatus";
import GameScenePanel from "./GameScenePanel";
import { useArcadeLogger } from "../../practice/useArcadeLogger";
import { ORDER_ROUNDS, gradeStars, type GameOption } from "../../practice/newGames";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function OrderBuilderWorld() {
  const { first, log } = useArcadeLogger();
  const [idx, setIdx] = useState(0);
  const [placed, setPlaced] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [scores, setScores] = useState<number[]>([]);

  const done = idx >= ORDER_ROUNDS.length;
  const round = ORDER_ROUNDS[idx];
  const options = useMemo<GameOption[]>(() => round ? shuffle([...round.steps, ...round.decoys]) : [], [round?.id]);

  if (done) {
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
    return (
      <Celebrate title={`Order restored, ${first}!`} subtitle="You turned a messy scene into a clear next step." stars={gradeStars(avg)} starsTotal={3}>
        <HeroWinActions worldName="Order Builder" winLine={`${first} restored order in Arbor and practiced the next-right-step habit.`} />
        <PlayButton onClick={() => { setIdx(0); setPlaced([]); setMistakes(0); setCombo(0); setFeedback(null); setScores([]); }}>Build order again</PlayButton>
      </Celebrate>
    );
  }

  const nextStep = round.steps[placed.length];
  const choose = (opt: GameOption) => {
    if (!nextStep || placed.includes(opt.id)) return;
    if (opt.id !== nextStep.id) {
      setMistakes((m) => m + 1);
      setCombo(0);
      setFeedback(`Try the next right step: ${nextStep.label}.`);
      return;
    }

    const nextPlaced = [...placed, opt.id];
    setPlaced(nextPlaced);
    setCombo((c) => c + 1);
    setFeedback(nextPlaced.length === round.steps.length ? "The scene is back in order!" : "Good. What comes next?");

    if (nextPlaced.length === round.steps.length) {
      const score = Math.max(55, Math.min(100, 90 - mistakes * 12 + nextPlaced.length * 4));
      log("order", "cognition", { correct: mistakes === 0, score, meta: round.id });
      setScores((s) => [...s, score]);
      window.setTimeout(() => {
        setIdx((i) => i + 1);
        setPlaced([]);
        setMistakes(0);
        setCombo(0);
        setFeedback(null);
      }, 1100);
    }
  };

  return (
    <div className="space-y-6">
      <PlayHeader title="Order Builder" say="Find the next right step and turn chaos into a calm plan." mood="think" />
      <ProgressPips total={ORDER_ROUNDS.length} current={idx} tone="yellow" />
      <MissionStatGrid stats={[
        { label: "Next step", value: nextStep?.emoji ?? "✓", tone: "yellow", hint: nextStep?.label ?? "round clear" },
        { label: "Combo", value: `${combo}x`, tone: combo >= 2 ? "green" : "sky", hint: "right order" },
        { label: "Repairs", value: mistakes, tone: mistakes ? "peach" : "green", hint: mistakes ? "try again" : "clean run" },
      ]} />

      <GameScenePanel
        gameId="order"
        foundationUrl="/visuals/cards/game-order-builder.png"
        imagePrompt={`Order Builder mission: ${round.scene}. ${round.mission}. The child hero restores order in a cozy room by choosing the next-right-step cards.`}
        eyebrow="Order mission"
        title={round.mission}
        prompt={round.scene}
        tone="yellow"
        sfx="ORDER!"
      >
        <div className="grid gap-2 sm:grid-cols-3 mt-5">
          {round.steps.map((step, i) => {
            const isFilled = placed.includes(step.id);
            const isNext = i === placed.length;
            return (
              <div key={step.id} className="rounded-2xl px-3 py-3 text-center font-extrabold"
                style={{ background: isFilled ? "var(--arbor-green-soft)" : "#fff", border: isNext ? "3px dashed var(--arbor-yellow-ink)" : "2px solid rgba(41,51,63,.12)", color: "var(--arbor-ink)" }}>
                <span className="block text-3xl mb-1" aria-hidden="true">{isFilled ? step.emoji : "?"}</span>
                {isFilled ? step.label : isNext ? "Next step" : "Waiting"}
              </div>
            );
          })}
        </div>
      </GameScenePanel>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {options.map((opt) => (
          <ChoiceTile
            key={opt.id}
            emoji={opt.emoji}
            label={opt.label}
            state={placed.includes(opt.id) ? "correct" : "idle"}
            disabled={placed.includes(opt.id)}
            onClick={() => choose(opt)}
          />
        ))}
      </div>

      {feedback && <MascotSay mood={feedback.includes("Try") ? "happy" : "proud"} tone={feedback.includes("Try") ? "peach" : "clay"}>{feedback}</MascotSay>}

      {feedback && (
        <MissionBridge title="Real-world bridge" tone={feedback.includes("Try") ? "yellow" : "green"}>
          Name the next right step before moving: first this, then this, then this.
        </MissionBridge>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
        <ListChecks className="w-3.5 h-3.5" aria-hidden="true" /> Planning, sequencing &amp; responsibility
      </p>
    </div>
  );
}
