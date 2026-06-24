import React, { useMemo, useState } from "react";
import { Footprints } from "lucide-react";
import { PlayHeader, MascotSay, ChoiceTile, ProgressPips, PlayButton, Celebrate } from "../ui/playkit";
import HeroWinActions from "./HeroWinActions";
import { MissionBridge, MissionStatGrid } from "./MissionStatus";
import GameScenePanel from "./GameScenePanel";
import { useArcadeLogger } from "../../practice/useArcadeLogger";
import { COURAGE_ROUNDS, gradeStars } from "../../practice/newGames";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function CourageStepsWorld() {
  const { first, log } = useArcadeLogger();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [scores, setScores] = useState<number[]>([]);

  const done = idx >= COURAGE_ROUNDS.length;
  const round = COURAGE_ROUNDS[idx] ?? COURAGE_ROUNDS[0];
  const choices = useMemo(() => shuffle(round.choices), [round.id]);
  const pickedChoice = picked ? round.choices.find((c) => c.id === picked) : null;
  const braveWins = scores.filter((s) => s >= 80).length;
  const couragePower = Math.round((braveWins / COURAGE_ROUNDS.length) * 100);
  const braveChoice = round.choices.find((c) => c.id === round.answer);

  if (done) {
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
    return (
      <Celebrate title={`Brave steps, ${first}!`} subtitle="You practiced making fear smaller by choosing one doable step." stars={gradeStars(avg)} starsTotal={3}>
        <HeroWinActions worldName="Courage Steps" winLine={`${first} took brave steps in Arbor and practiced making fear smaller.`} />
        <PlayButton onClick={() => { setIdx(0); setPicked(null); setScores([]); }}>Take brave steps again</PlayButton>
      </Celebrate>
    );
  }

  const choose = (id: string) => {
    if (picked) return;
    const correct = id === round.answer;
    const score = correct ? 100 : 45;
    setPicked(id);
    setScores((s) => [...s, score]);
    log("courage", "emotional", { correct, score, meta: round.id });
  };

  const next = () => {
    setPicked(null);
    setIdx((i) => i + 1);
  };

  return (
    <div className="space-y-6">
      <PlayHeader title="Courage Steps" say="Courage is not huge. It starts with one small, true step." mood="cheer" />
      <ProgressPips total={COURAGE_ROUNDS.length} current={idx} tone="peach" />
      <MissionStatGrid stats={[
        { label: "Courage power", value: `${couragePower}%`, tone: couragePower >= 70 ? "green" : "peach", hint: "small steps" },
        { label: "Body cue", value: "Breathe", tone: "sky", hint: "body first" },
        { label: "Step", value: `${idx + 1}/${COURAGE_ROUNDS.length}`, tone: "yellow", hint: "challenge path" },
      ]} />

      <GameScenePanel
        gameId="courage"
        foundationUrl="/visuals/cards/game-courage-steps.png"
        imagePrompt={`Courage Steps mission: ${round.challenge}. The child hero takes one glowing small step over a gentle bridge, breathing calmly with a supportive plush companion nearby.`}
        eyebrow="Bravery scene"
        title={round.challenge}
        prompt={round.bodyCue}
        tone="peach"
        sfx="STEP!"
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
          <MissionBridge title="Tiny brave action" tone={picked === round.answer ? "green" : "yellow"}>
            Try this in real life: {braveChoice?.label ?? "choose one small step that fear cannot argue with"}.
          </MissionBridge>
          <div className="flex justify-center">
            <PlayButton onClick={next}>{idx + 1 < COURAGE_ROUNDS.length ? "Next step" : "Finish"}</PlayButton>
          </div>
        </>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
        <Footprints className="w-3.5 h-3.5" aria-hidden="true" /> Emotional bravery &amp; frustration tolerance
      </p>
    </div>
  );
}
