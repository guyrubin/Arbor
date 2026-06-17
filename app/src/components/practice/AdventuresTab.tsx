import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Compass, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { fillTemplate, scenariosForAge, type AdventureScenario } from "../../practice/content";
import { usePracticeData } from "../../practice/usePracticeData";
import MemoryMatch from "./MemoryMatch";
import type { AdventureResult } from "../../types";
import { api } from "../../lib/api";
import { track } from "../../lib/analytics";
import { PlayShell, PlayHeader, PlayButton, PlayPanel, ChoiceTile, ProgressPips, MascotSay, Celebrate } from "../ui/playkit";

const SKILL_LABEL: Record<string, string> = {
  vocabulary: "Vocabulary",
  logic: "Logic",
  sequencing: "Sequencing",
  instructions: "Following instructions",
  abstract: "Abstract thinking",
};

/**
 * Cognitive Adventures — MITA-style comprehension play wrapped in stories.
 * The child only ever experiences a story with choices; under the hood each
 * choice quietly logs an instruction/logic/sequencing/vocabulary signal.
 * Wrong answers get warm scaffolding and a retry — there is no "fail" state.
 */
export default function AdventuresTab() {
  const { childProfile, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const data = usePracticeData(childProfile.id);
  const first = childProfile.name.split(" ")[0];
  const vars = { name: first, age: childProfile.age };

  const ageScenarios = useMemo(() => scenariosForAge(childProfile.age), [childProfile.age]);
  // Generated adventures (this session) sit alongside the curated ones.
  const [generated, setGenerated] = useState<AdventureScenario[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const scenarios = useMemo(() => [...generated, ...ageScenarios], [generated, ageScenarios]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const scenario: AdventureScenario | null = scenarios.find((s) => s.id === activeId) ?? null;

  const createAdventure = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const adv = await api.generateAdventure({ childProfile });
      setGenerated((prev) => [adv, ...prev]);
      track("adventure_generated", { id: adv.id });
      openScenario(adv.id);
    } catch (e: any) {
      setGenError(e?.message || "Couldn't create a new adventure — please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const [sceneIdx, setSceneIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  const openScenario = (id: string) => {
    setActiveId(id);
    setSceneIdx(0);
    setPicked(null);
    setFinished(false);
    setSessionCorrect(0);
    track("adventure_start", { scenario: id });
  };

  const scene = scenario?.scenes[sceneIdx] ?? null;
  const pickedChoice = scene?.choices.find((c) => c.id === picked) ?? null;

  const choose = (choiceId: string) => {
    if (!scenario || !scene || picked === choiceId) return;
    const choice = scene.choices.find((c) => c.id === choiceId);
    if (!choice) return;
    setPicked(choiceId);
    // First pick per scene is the recorded signal; retries are just play.
    if (picked === null) {
      const result: AdventureResult = {
        id: `adv-${Date.now()}`,
        scenarioId: scenario.id,
        sceneId: scene.id,
        skill: scene.skill,
        correct: choice.correct,
        timestamp: new Date().toISOString(),
      };
      void data.adventures.upsert(result);
      if (choice.correct) setSessionCorrect((n) => n + 1);
    }
  };

  const next = () => {
    if (!scenario) return;
    if (sceneIdx < scenario.scenes.length - 1) {
      setSceneIdx((i) => i + 1);
      setPicked(null);
    } else {
      setFinished(true);
      track("adventure_done", { scenario: scenario.id, correct: sessionCorrect, scenes: scenario.scenes.length });
    }
  };

  const playedCount = (s: AdventureScenario) =>
    new Set(data.adventures.items.filter((r) => r.scenarioId === s.id).map((r) => r.sceneId)).size;

  return (
    <PlayShell>
      <PlayHeader
        title={t("prac.adventures.title")}
        say={t("prac.adventures.sub", { name: first })}
        mood="wave"
      />

      {/* Make-a-new-adventure CTA */}
      {!scenario && (
        <PlayPanel tone="lav" className="flex flex-wrap items-center gap-4">
          <span className="grid place-items-center w-14 h-14 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
            <Wand2 className="w-7 h-7" />
          </span>
          <div className="flex-1 min-w-[200px]">
            <p className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Make a brand-new adventure</p>
            <p className="text-[13px] font-semibold" style={{ color: "var(--arbor-muted)" }}>A fresh comprehension story, made just for {first}.</p>
          </div>
          <PlayButton onClick={createAdventure} disabled={generating} tone="lav">
            <Sparkles className="w-4 h-4" /> {generating ? "Creating…" : "Create"}
          </PlayButton>
          {genError && <p className="w-full text-[13px] font-semibold" style={{ color: "var(--arbor-pink-ink)" }}>{genError}</p>}
        </PlayPanel>
      )}

      {/* Scenario picker */}
      {!scenario && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {scenarios.map((s) => {
            const played = playedCount(s) > 0;
            return (
              <button
                key={s.id}
                onClick={() => openScenario(s.id)}
                className="play-pressable rounded-[var(--play-radius-lg)] p-5 text-left bg-white shadow-[0_4px_20px_rgba(41,51,63,0.06)] flex items-start gap-4"
              >
                <span className="grid place-items-center w-16 h-16 rounded-2xl text-4xl flex-shrink-0" style={{ background: "var(--arbor-lav-soft)" }}>{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{s.title}</p>
                  <p className="text-[13px] mt-1 leading-relaxed font-medium" style={{ color: "var(--arbor-muted)" }}>{fillTemplate(s.intro, vars)}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <PlayPill tone="sky">Ages {s.ageBand[0]}–{s.ageBand[1]}</PlayPill>
                    <PlayPill tone="lav">{s.scenes.length} choices</PlayPill>
                    {played && <PlayPill tone="clay">Played ✓</PlayPill>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!scenario && <MemoryMatch data={data} childAge={childProfile.age} />}

      {/* Active scene */}
      {scenario && !finished && scene && (
        <PlayPanel>
          <div className="flex items-center justify-between mb-5 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-3xl">{scenario.emoji}</span>
              <p className="text-lg font-extrabold truncate" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{scenario.title}</p>
            </div>
            <button onClick={() => setActiveId(null)} className="text-[13px] font-bold flex-shrink-0" style={{ color: "var(--arbor-muted)" }}>← All</button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <ProgressPips total={scenario.scenes.length} current={sceneIdx} tone="lav" />
            <span className="text-[12px] font-extrabold" style={{ color: "var(--arbor-lav-ink)" }}>{SKILL_LABEL[scene.skill]}</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={scene.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
              <p className="text-[1.4rem] font-extrabold leading-snug mb-5 max-w-2xl" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                {fillTemplate(scene.prompt, vars)}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {scene.choices.map((c) => {
                  const isPicked = picked === c.id;
                  const reveal = picked !== null;
                  const tileState = isPicked ? (c.correct ? "correct" : "wrong") : reveal && pickedChoice?.correct ? "dim" : "idle";
                  return (
                    <ChoiceTile
                      key={c.id}
                      emoji={c.emoji}
                      label={c.text}
                      onClick={() => choose(c.id)}
                      disabled={pickedChoice?.correct === true}
                      state={tileState}
                    />
                  );
                })}
              </div>

              {pickedChoice && (
                <div className="mt-5">
                  <MascotSay mood={pickedChoice.correct ? "proud" : "think"} tone={pickedChoice.correct ? "clay" : "yellow"}>
                    {fillTemplate(pickedChoice.feedback, vars)}
                  </MascotSay>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {pickedChoice.correct ? (
                      <PlayButton onClick={next} tone="clay">
                        {sceneIdx < scenario.scenes.length - 1 ? "Keep going →" : "Finish the adventure 🎉"}
                      </PlayButton>
                    ) : (
                      <span className="text-[13px] font-bold" style={{ color: "var(--arbor-yellow-ink)" }}>Try another one — thinking out loud together is the whole game.</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </PlayPanel>
      )}

      {/* Finished */}
      {scenario && finished && (
        <PlayPanel>
          <Celebrate
            title={`${first} finished “${scenario.title}”!`}
            stars={sessionCorrect}
            starsTotal={scenario.scenes.length}
            subtitle={`${sessionCorrect} of ${scenario.scenes.length} first-try answers — and every answer taught us something for ${first}'s development picture.`}
          >
            <PlayButton variant="soft" tone="lav" onClick={() => openScenario(scenario.id)}>
              <RotateCcw className="w-4 h-4" /> Play again
            </PlayButton>
            <PlayButton variant="soft" tone="clay" onClick={() => setActiveId(null)}>
              <Compass className="w-4 h-4" /> More adventures
            </PlayButton>
            <PlayButton tone="lav" onClick={() => setActiveTab("comics")}>
              <Sparkles className="w-4 h-4" /> Make a hero comic
            </PlayButton>
          </Celebrate>
        </PlayPanel>
      )}
    </PlayShell>
  );
}

/** Small rounded label used on scenario cards. */
function PlayPill({ tone, children }: { tone: "sky" | "lav" | "clay"; children: React.ReactNode }) {
  const map = {
    sky: ["var(--arbor-sky-soft)", "var(--arbor-sky-ink)"],
    lav: ["var(--arbor-lav-soft)", "var(--arbor-lav-ink)"],
    clay: ["var(--arbor-green-soft)", "var(--arbor-green-ink)"],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}
