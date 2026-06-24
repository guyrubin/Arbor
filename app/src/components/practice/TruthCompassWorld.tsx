import React, { useMemo, useState } from "react";
import { Compass } from "lucide-react";
import { PlayHeader, MascotSay, ChoiceTile, ProgressPips, PlayButton, Celebrate } from "../ui/playkit";
import HeroWinActions from "./HeroWinActions";
import { MissionBridge, MissionStatGrid } from "./MissionStatus";
import GameScenePanel from "./GameScenePanel";
import { useArcadeLogger } from "../../practice/useArcadeLogger";
import { TRUTH_SCENARIOS, gradeStars } from "../../practice/newGames";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TruthCompassWorld() {
  const { first, log } = useArcadeLogger();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [scores, setScores] = useState<number[]>([]);

  const done = idx >= TRUTH_SCENARIOS.length;
  const scenario = TRUTH_SCENARIOS[idx];
  const choices = useMemo(() => scenario ? shuffle(scenario.choices) : [], [scenario?.id]);
  const pickedChoice = picked ? scenario.choices.find((c) => c.id === picked) : null;
  const correctChoice = scenario?.choices.find((c) => c.id === scenario.answer);
  const trustWins = scores.filter((s) => s >= 80).length;
  const trustPower = Math.round((trustWins / TRUTH_SCENARIOS.length) * 100);

  if (done) {
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
    return (
      <Celebrate title={`Clear compass, ${first}!`} subtitle="You practiced honest words that also protect friendship." stars={gradeStars(avg)} starsTotal={3}>
        <HeroWinActions worldName="Truth Compass" winLine={`${first} practiced honest and kind words in Arbor's Truth Compass.`} />
        <PlayButton onClick={() => { setIdx(0); setPicked(null); setScores([]); }}>Use the compass again</PlayButton>
      </Celebrate>
    );
  }

  const choose = (id: string) => {
    if (picked) return;
    const correct = id === scenario.answer;
    const score = correct ? 100 : 45;
    setPicked(id);
    setScores((s) => [...s, score]);
    log("truth", "social", { correct, score, meta: scenario.id });
  };

  const next = () => {
    setPicked(null);
    setIdx((i) => i + 1);
  };

  return (
    <div className="space-y-6">
      <PlayHeader title="Truth Compass" say="Find the words that are true and kind at the same time." mood="happy" />
      <ProgressPips total={TRUTH_SCENARIOS.length} current={idx} tone="sky" />
      <MissionStatGrid stats={[
        { label: "Trust power", value: `${trustPower}%`, tone: trustPower >= 70 ? "green" : "sky", hint: "truth + kindness" },
        { label: "Scenario", value: `${idx + 1}/${TRUTH_SCENARIOS.length}`, tone: "lav", hint: "social puzzle" },
        { label: "Hero line", value: "Say it", tone: "yellow", hint: "practice out loud" },
      ]} />

      <GameScenePanel
        gameId="truth"
        foundationUrl="/visuals/cards/game-truth-compass.png"
        imagePrompt={`Truth Compass mission: ${scenario.scene}. ${scenario.prompt}. The child hero holds a glowing compass and chooses honest words that protect friendship.`}
        eyebrow="Trust scene"
        title={scenario.scene}
        prompt={scenario.prompt}
        tone="sky"
        sfx="TRUTH!"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {choices.map((choice) => (
          <ChoiceTile
            key={choice.id}
            emoji={choice.emoji}
            label={choice.label}
            state={!picked ? "idle" : choice.id === scenario.answer ? "correct" : choice.id === picked ? "wrong" : "dim"}
            disabled={!!picked}
            onClick={() => choose(choice.id)}
          />
        ))}
      </div>

      {pickedChoice && (
        <>
          <MascotSay mood={picked === scenario.answer ? "proud" : "happy"} tone={picked === scenario.answer ? "clay" : "peach"}>{pickedChoice.feedback}</MascotSay>
          <MissionBridge title="Practice sentence" tone={picked === scenario.answer ? "green" : "yellow"}>
            {correctChoice?.label ?? "Tell the true thing kindly, then offer a repair."}
          </MissionBridge>
          <div className="flex justify-center">
            <PlayButton onClick={next}>{idx + 1 < TRUTH_SCENARIOS.length ? "Next scene" : "Finish"}</PlayButton>
          </div>
        </>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
        <Compass className="w-3.5 h-3.5" aria-hidden="true" /> Honest words, kindness &amp; trust
      </p>
    </div>
  );
}
