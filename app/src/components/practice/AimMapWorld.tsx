import React, { useMemo, useState } from "react";
import { Target } from "lucide-react";
import { PlayHeader, MascotSay, ChoiceTile, ProgressPips, PlayButton, Celebrate } from "../ui/playkit";
import HeroWinActions from "./HeroWinActions";
import { MissionBridge, MissionStatGrid } from "./MissionStatus";
import GameScenePanel from "./GameScenePanel";
import { useArcadeLogger } from "../../practice/useArcadeLogger";
import { AIM_ROUNDS, gradeStars } from "../../practice/newGames";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function AimMapWorld() {
  const { first, log } = useArcadeLogger();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [scores, setScores] = useState<number[]>([]);

  const done = idx >= AIM_ROUNDS.length;
  const round = AIM_ROUNDS[idx] ?? AIM_ROUNDS[0];
  const choices = useMemo(() => shuffle(round.choices), [round.id]);
  const pickedChoice = picked ? round.choices.find((c) => c.id === picked) : null;
  const clearAims = scores.filter((s) => s >= 80).length;
  const aimPower = Math.round((clearAims / AIM_ROUNDS.length) * 100);
  const bestStep = round.choices.find((c) => c.id === round.answer);

  if (done) {
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
    return (
      <Celebrate title={`Aim set, ${first}!`} subtitle="You chose helpful goals and the small steps that make them real." stars={gradeStars(avg)} starsTotal={3}>
        <HeroWinActions worldName="Aim Map" winLine={`${first} mapped a helpful aim in Arbor and chose a real next step.`} />
        <PlayButton onClick={() => { setIdx(0); setPicked(null); setScores([]); }}>Map a new aim</PlayButton>
      </Celebrate>
    );
  }

  const choose = (id: string) => {
    if (picked) return;
    const correct = id === round.answer;
    const score = correct ? 100 : 45;
    setPicked(id);
    setScores((s) => [...s, score]);
    log("aim", "cognition", { correct, score, meta: round.id });
  };

  const next = () => {
    setPicked(null);
    setIdx((i) => i + 1);
  };

  return (
    <div className="space-y-6">
      <PlayHeader title="Aim Map" say="Pick the small action that points toward the best goal." mood="think" />
      <ProgressPips total={AIM_ROUNDS.length} current={idx} tone="lav" />
      <MissionStatGrid stats={[
        { label: "Aim clarity", value: `${aimPower}%`, tone: aimPower >= 70 ? "green" : "lav", hint: "goal to action" },
        { label: "Map stop", value: `${idx + 1}/${AIM_ROUNDS.length}`, tone: "yellow", hint: "choose path" },
        { label: "Tiny plan", value: "1 step", tone: "sky", hint: "make it real" },
      ]} />

      <GameScenePanel
        gameId="aim"
        foundationUrl="/visuals/cards/game-aim-map.png"
        imagePrompt={`Aim Map mission: ${round.goal}. ${round.prompt}. The child hero studies a glowing map where helpful goals become real paths and concrete next steps.`}
        eyebrow="Meaning map"
        title={round.goal}
        prompt={round.prompt}
        tone="lav"
        sfx="AIM!"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {choices.map((choice) => (
          <ChoiceTile
            key={choice.id}
            emoji={choice.emoji}
            label={choice.label}
            state={!picked ? "idle" : choice.id === round.answer ? "correct" : choice.id === picked ? "wrong" : "dim"}
            disabled={!!picked}
            onClick={() => choose(choice.id)}
          />
        ))}
      </div>

      {pickedChoice && (
        <>
          <MascotSay mood={picked === round.answer ? "proud" : "happy"} tone={picked === round.answer ? "clay" : "peach"}>{pickedChoice.feedback}</MascotSay>
          <MissionBridge title="Make the aim real" tone={picked === round.answer ? "green" : "yellow"}>
            Today&apos;s smallest useful step: {bestStep?.label ?? "choose one helpful action"}.
          </MissionBridge>
          <div className="flex justify-center">
            <PlayButton onClick={next}>{idx + 1 < AIM_ROUNDS.length ? "Next aim" : "Finish"}</PlayButton>
          </div>
        </>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
        <Target className="w-3.5 h-3.5" aria-hidden="true" /> Goal choice, planning &amp; meaning
      </p>
    </div>
  );
}
