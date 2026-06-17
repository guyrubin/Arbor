import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Compass, Map, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { PageHeader, SectionCard, cardCls, Chip } from "../ui/kit";
import { fillTemplate, scenariosForAge, type AdventureScenario } from "../../practice/content";
import { usePracticeData } from "../../practice/usePracticeData";
import MemoryMatch from "./MemoryMatch";
import type { AdventureResult } from "../../types";
import { api } from "../../lib/api";
import { track } from "../../lib/analytics";

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
  const { childProfile } = useArbor();
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
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="Practice Studio"
        title={t("prac.adventures.title")}
        subtitle={t("prac.adventures.sub", { name: first })}
      />

      {!scenario && (
        <div className={`${cardCls} p-5 flex flex-wrap items-center gap-3`} style={{ background: "var(--arbor-lav-soft)" }}>
          <Wand2 className="w-5 h-5 flex-shrink-0" style={{ color: "var(--arbor-lav-ink)" }} />
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>Make a fresh adventure for {first}</p>
            <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>A brand-new comprehension story, personalized to {first}&apos;s age and interests.</p>
          </div>
          <button
            onClick={createAdventure}
            disabled={generating}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold px-4 py-2.5 rounded-xl text-white transition active:scale-[0.98] disabled:opacity-60"
            style={{ background: "var(--arbor-lav-ink)" }}
          >
            <Sparkles className="w-3.5 h-3.5" /> {generating ? "Creating…" : "Create adventure"}
          </button>
          {genError && <p className="w-full text-[11px]" style={{ color: "var(--arbor-pink-ink)" }}>{genError}</p>}
        </div>
      )}

      {!scenario && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenarios.map((s) => (
            <button key={s.id} onClick={() => openScenario(s.id)} className={`${cardCls} p-5 text-left transition hover:shadow-md`}>
              <div className="flex items-start gap-3">
                <span className="text-4xl">{s.emoji}</span>
                <div className="flex-1">
                  <p className="text-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{s.title}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{fillTemplate(s.intro, vars)}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <Chip tone="sky">Ages {s.ageBand[0]}–{s.ageBand[1]}</Chip>
                    <Chip tone="lav">{s.scenes.length} choices</Chip>
                    {playedCount(s) > 0 && <Chip tone="mint">Played ✓</Chip>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!scenario && <MemoryMatch data={data} childAge={childProfile.age} />}

      {scenario && !finished && scene && (
        <SectionCard title={`${scenario.emoji} ${scenario.title}`} icon={<Map className="w-5 h-5" />} tone="lav"
          action={
            <button onClick={() => setActiveId(null)} className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
              ← All adventures
            </button>
          }>
          {/* Scene progress dots */}
          <div className="flex items-center gap-1.5 mb-5">
            {scenario.scenes.map((_, i) => (
              <span key={i} className="h-2 rounded-full transition-all" style={{ width: i === sceneIdx ? 24 : 8, background: i <= sceneIdx ? "var(--arbor-lav-ink)" : "rgba(41,51,63,0.12)" }} />
            ))}
            <span className="text-[10px] font-bold ml-2 uppercase tracking-wide" style={{ color: "var(--arbor-muted)" }}>{SKILL_LABEL[scene.skill]}</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={scene.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
              <p className="text-lg font-extrabold leading-snug mb-5 max-w-2xl" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                {fillTemplate(scene.prompt, vars)}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {scene.choices.map((c) => {
                  const isPicked = picked === c.id;
                  const reveal = picked !== null;
                  return (
                    <button
                      key={c.id}
                      onClick={() => choose(c.id)}
                      disabled={pickedChoice?.correct === true}
                      className={`${cardCls} p-4 text-center transition`}
                      style={{
                        border: isPicked ? `2px solid ${c.correct ? "var(--arbor-clay)" : "var(--arbor-pink-ink)"}` : "1px solid rgba(41,51,63,0.06)",
                        opacity: reveal && !isPicked && pickedChoice?.correct ? 0.5 : 1,
                      }}
                    >
                      <span className="text-3xl block">{c.emoji}</span>
                      <span className="text-xs font-bold block mt-2" style={{ color: "var(--arbor-ink)" }}>{c.text}</span>
                    </button>
                  );
                })}
              </div>

              {pickedChoice && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-4 text-sm flex flex-wrap items-center gap-3"
                  style={{ background: pickedChoice.correct ? "var(--arbor-green-soft)" : "var(--arbor-yellow-soft)", color: "var(--arbor-ink)" }}>
                  <span className="flex-1 min-w-[220px] leading-relaxed">{fillTemplate(pickedChoice.feedback, vars)}</span>
                  {pickedChoice.correct ? (
                    <button onClick={next} className="font-extrabold text-white text-xs px-4 py-2.5 rounded-xl" style={{ background: "var(--arbor-clay)" }}>
                      {sceneIdx < scenario.scenes.length - 1 ? "Keep going →" : "Finish the adventure 🎉"}
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold" style={{ color: "var(--arbor-yellow-ink)" }}>Try another one — thinking out loud together is the whole game.</span>
                  )}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </SectionCard>
      )}

      {scenario && finished && (
        <SectionCard title="Adventure complete!" icon={<Sparkles className="w-5 h-5" />} tone="mint">
          <div className="text-center py-6">
            <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="text-6xl block">
              {scenario.emoji}
            </motion.span>
            <p className="text-xl font-extrabold mt-3" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              {first} helped finish &ldquo;{scenario.title}&rdquo;!
            </p>
            <p className="text-xs mt-2" style={{ color: "var(--arbor-muted)" }}>
              {sessionCorrect} of {scenario.scenes.length} first-try answers — every answer taught us something, and it all feeds {first}&apos;s development picture.
            </p>
            <div className="flex justify-center gap-2 mt-5">
              <button onClick={() => openScenario(scenario.id)} className="inline-flex items-center gap-1.5 text-xs font-extrabold px-4 py-2.5 rounded-xl" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
                <RotateCcw className="w-3.5 h-3.5" /> Play again
              </button>
              <button onClick={() => setActiveId(null)} className="inline-flex items-center gap-1.5 text-xs font-extrabold px-4 py-2.5 rounded-xl text-white" style={{ background: "var(--arbor-clay)" }}>
                <Compass className="w-3.5 h-3.5" /> More adventures
              </button>
            </div>
          </div>
        </SectionCard>
      )}
    </motion.div>
  );
}
