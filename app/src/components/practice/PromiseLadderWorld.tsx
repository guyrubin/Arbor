import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PlayHeader, MascotSay, ProgressPips, PlayButton, Celebrate } from "../ui/playkit";
import HeroWinActions from "./HeroWinActions";
import { MissionBridge, MissionStatGrid } from "./MissionStatus";
import GameScenePanel from "./GameScenePanel";
import { useArcadeLogger } from "../../practice/useArcadeLogger";
import { RESPONSIBILITY_TASKS } from "../../practice/newGames";

export default function PromiseLadderWorld() {
  const { first, log } = useArcadeLogger();
  const [idx, setIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [complete, setComplete] = useState(false);

  const done = idx >= RESPONSIBILITY_TASKS.length;
  const task = RESPONSIBILITY_TASKS[idx];

  if (done) {
    return (
      <Celebrate title={`Promise kept, ${first}!`} subtitle="You practiced becoming someone others can count on." stars={3} starsTotal={3}>
        <HeroWinActions worldName="Promise Ladder" winLine={`${first} climbed the Promise Ladder in Arbor and practiced follow-through.`} />
        <PlayButton onClick={() => { setIdx(0); setStepIdx(0); setComplete(false); }}>Climb again</PlayButton>
      </Celebrate>
    );
  }

  const currentStep = task.steps[stepIdx];
  const doneSteps = complete ? task.steps.length : stepIdx;
  const ladderPower = Math.round((doneSteps / task.steps.length) * 100);

  const didStep = () => {
    if (complete) return;
    if (stepIdx + 1 >= task.steps.length) {
      log("responsibility", "social", { correct: true, score: 100, meta: task.id });
      setComplete(true);
      return;
    }
    setStepIdx((i) => i + 1);
  };

  const nextTask = () => {
    setIdx((i) => i + 1);
    setStepIdx(0);
    setComplete(false);
  };

  return (
    <div className="space-y-6">
      <PlayHeader title="Promise Ladder" say="Climb one small promise at a time. A grown-up can tap when the step is done." mood="cheer" />
      <ProgressPips total={RESPONSIBILITY_TASKS.length} current={idx} tone="clay" />
      <MissionStatGrid stats={[
        { label: "Ladder power", value: `${ladderPower}%`, tone: ladderPower >= 70 ? "green" : "clay", hint: "follow-through" },
        { label: "Promise", value: `${idx + 1}/${RESPONSIBILITY_TASKS.length}`, tone: "yellow", hint: "helper path" },
        { label: "Step", value: `${Math.min(doneSteps + 1, task.steps.length)}/${task.steps.length}`, tone: "sky", hint: currentStep?.label ?? "complete" },
      ]} />

      <GameScenePanel
        gameId="promise"
        foundationUrl="/visuals/cards/game-promise-ladder.png"
        imagePrompt={`Promise Ladder mission: ${task.promise}. ${task.why}. The child hero climbs glowing promise badges and completes a small trusted helper job.`}
        eyebrow="Promise mission"
        title={task.promise}
        prompt={task.why}
        tone="green"
        sfx="KEEP!"
      >
        <div className="mt-5 grid gap-2">
          {task.steps.map((step, i) => {
            const isDone = i < stepIdx || complete;
            const isCurrent = i === stepIdx && !complete;
            return (
              <div key={step.id} className="flex items-center gap-3 rounded-2xl px-4 py-3 font-extrabold"
                style={{ background: isDone ? "#fff" : "rgba(255,255,255,.72)", border: isCurrent ? "3px dashed var(--arbor-green-ink)" : "2px solid rgba(41,51,63,.12)", color: "var(--arbor-ink)" }}>
                <span className="grid place-items-center rounded-full text-2xl" style={{ width: 46, height: 46, background: isDone ? "var(--arbor-green-soft)" : "var(--arbor-paper-elevated)" }} aria-hidden="true">
                  {isDone ? "✓" : step.emoji}
                </span>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      </GameScenePanel>

      {complete ? (
        <>
          <MascotSay mood="proud" tone="clay">That promise has a finish line - and you crossed it.</MascotSay>
          <MissionBridge title="Witness moment" tone="green">
            Ask a grown-up to say exactly what they noticed: "I saw you finish what you promised."
          </MissionBridge>
          <div className="flex justify-center">
            <PlayButton onClick={nextTask}>{idx + 1 < RESPONSIBILITY_TASKS.length ? "Next promise" : "Finish"}</PlayButton>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-3xl px-5 py-4 text-center font-black" style={{ background: "#fff", border: "var(--comic-line)", boxShadow: "var(--comic-pop)", color: "var(--arbor-ink)" }}>
            <span className="block text-4xl mb-1" aria-hidden="true">{currentStep.emoji}</span>
            Next: {currentStep.label}
          </div>
          <PlayButton tone="clay" onClick={didStep}>I did this step</PlayButton>
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--arbor-muted)" }}>
        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Follow-through, helping &amp; self-trust
      </p>
    </div>
  );
}
