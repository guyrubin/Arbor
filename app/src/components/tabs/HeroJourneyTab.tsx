import React, { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import {
  Sparkles,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Check,
  Library,
  Mountain,
  Trophy,
  ArrowLeft,
} from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { api, type AvatarStyle } from "../../lib/api";
import {
  HERO_STORIES,
  PACKS,
  METRIC_IDS,
  METRIC_LABELS,
  emptyMetrics,
  addMetrics,
  applyChoice,
  getStorySpec,
  storiesInPack,
} from "../../lib/heroJourneys";
import type {
  DevelopmentMetricId,
  HeroJourneyRender,
  HeroJourneyRun,
  HeroPackId,
  HeroSceneRender,
  HeroStorySpec,
} from "../../types";
import { HeroScenePlayer } from "../stories/HeroScenePlayer";
import { EmptyState } from "../ui/EmptyState";
import { cardCls } from "../ui/kit";

const PACK_COLORS: Record<HeroPackId, string> = {
  courage: "#e2562d",
  responsibility: "#d7aa55",
  growth: "#6f9e6f",
  wisdom: "#68B4FF",
};

const METRIC_COLORS: Record<DevelopmentMetricId, string> = {
  courage: "#e2562d",
  responsibility: "#d7aa55",
  resilience: "#A07AF8",
  empathy: "#38C8F0",
  wisdom: "#68B4FF",
};

export default function HeroJourneyTab() {
  const { childProfile } = useArbor();
  const { aiLang } = useLanguage();
  const { toast } = useToast();

  const runsCol = useChildCollection<HeroJourneyRun>(childProfile.id, "heroRuns");
  const runs = runsCol.items;
  const photoUrl = (childProfile as unknown as { photoUrl?: string }).photoUrl;
  // AVA-3: use a generated stylized character (a data-URL avatar) as the story hero —
  // never a raw face photo or a remote URL — so scenes stay consistent and privacy-safe.
  const heroAvatarUrl = childProfile.avatar && photoUrl?.startsWith("data:") ? photoUrl : undefined;
  const heroAvatarStyle = childProfile.avatar?.style as AvatarStyle | undefined;

  const totalMetrics = useMemo(
    () => runs.reduce((acc, r) => addMetrics(acc, r.metricsEarned ?? {}), emptyMetrics()),
    [runs]
  );
  const metricMax = Math.max(1, ...METRIC_IDS.map((m) => totalMetrics[m]));

  const [packFilter, setPackFilter] = useState<HeroPackId | "all">("all");
  const [activeStory, setActiveStory] = useState<HeroStorySpec | null>(null);
  const [render, setRender] = useState<HeroJourneyRender | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [choiceId, setChoiceId] = useState<string | undefined>(undefined);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [questionsChecked, setQuestionsChecked] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState(false);
  const startedAtRef = useRef<string>("");

  // Scenes aligned to the fixed spine order, with a graceful fallback if the
  // model drops or reorders a beat.
  const scenes: HeroSceneRender[] = useMemo(() => {
    if (!activeStory || !render) return [];
    return activeStory.beats.map((b) => {
      const s = render.scenes.find((rs) => rs.beatId === b.id);
      return s ?? { beatId: b.id, title: b.title, narration: b.spine, imagePrompt: "" };
    });
  }, [activeStory, render]);

  const beat = activeStory?.beats[sceneIndex];
  const isDecision = beat?.id === "decision";
  const isConsequence = beat?.id === "consequence";
  const isReflection = beat?.id === "reflection";
  const chosen = render?.choices.find((c) => c.id === choiceId);

  // On the consequence beat, show the chosen choice's tailored outcome text.
  const displayScene: HeroSceneRender | undefined = scenes[sceneIndex]
    ? isConsequence && chosen
      ? { ...scenes[sceneIndex], narration: chosen.consequence }
      : scenes[sceneIndex]
    : undefined;

  const visibleStories =
    packFilter === "all" ? HERO_STORIES : storiesInPack(packFilter);

  const startJourney = async (story: HeroStorySpec) => {
    setLoadingId(story.id);
    try {
      const r = await api.generateHeroJourney({
        storyId: story.id,
        childName: childProfile.name,
        age: childProfile.age,
        language: aiLang,
      });
      startedAtRef.current = new Date().toISOString();
      setActiveStory(story);
      setRender(r);
      setSceneIndex(0);
      setChoiceId(undefined);
      setQuestionsChecked({});
      setSaved(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start the journey.";
      toast(msg, "error");
    } finally {
      setLoadingId(null);
    }
  };

  const chooseOption = (id: string) => {
    setChoiceId(id);
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 } });
    setSceneIndex((i) => Math.min(scenes.length - 1, i + 1));
  };

  const finishJourney = async () => {
    if (!activeStory || !render) return;
    const metricsEarned = applyChoice(activeStory, choiceId);
    const run: HeroJourneyRun = {
      id: `run-${Date.now()}`,
      storyId: activeStory.id,
      title: render.title || activeStory.title,
      language: aiLang,
      startedAt: startedAtRef.current || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      choiceId,
      metricsEarned,
      render,
    };
    await runsCol.upsert(run);
    setSaved(true);
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
    toast("Journey complete — development saved", "success");
  };

  const replay = (run: HeroJourneyRun) => {
    const story = getStorySpec(run.storyId);
    if (!story) return;
    startedAtRef.current = run.startedAt;
    setActiveStory(story);
    setRender(run.render);
    setSceneIndex(0);
    setChoiceId(run.choiceId);
    setQuestionsChecked({});
    setSaved(true);
  };

  const exitJourney = () => {
    setActiveStory(null);
    setRender(null);
    setImmersive(false);
  };

  // ── Shared player pieces ───────────────────────────────────────────────────
  const renderChoices = () =>
    isDecision &&
    !choiceId && (
      <div className="space-y-2 w-full max-w-xl mx-auto">
        <p className="text-[11px] uppercase tracking-widest font-bold text-center" style={{ color: "var(--arbor-green-ink)" }}>
          What do you do, {childProfile.name}?
        </p>
        {render?.choices.map((c) => (
          <button
            key={c.id}
            onClick={() => chooseOption(c.id)}
            className="w-full text-left p-3.5 rounded-2xl transition flex items-center gap-3 group hover:-translate-y-0.5"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
          >
            <span className="w-7 h-7 rounded-full font-extrabold flex items-center justify-center flex-shrink-0 uppercase" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
              {c.id}
            </span>
            <span dir="auto" className="text-sm font-medium" style={{ color: "var(--arbor-ink)" }}>
              {c.label}
            </span>
          </button>
        ))}
      </div>
    );

  const canAdvance = !isDecision || !!choiceId;
  const renderNav = () => (
    <div className="flex items-center justify-between w-full max-w-xl mx-auto pt-2">
      <button
        onClick={() => setSceneIndex((i) => Math.max(0, i - 1))}
        disabled={sceneIndex === 0}
        className="disabled:opacity-30 flex items-center gap-1 text-sm"
        style={{ color: "var(--arbor-muted)" }}
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--arbor-faint)" }}>
        {activeStory && `${sceneIndex + 1} / ${activeStory.beats.length}`}
      </span>
      {sceneIndex < scenes.length - 1 ? (
        <button
          onClick={() => canAdvance && setSceneIndex((i) => Math.min(scenes.length - 1, i + 1))}
          disabled={!canAdvance}
          className="disabled:opacity-30 flex items-center gap-1 text-sm font-bold"
          style={{ color: "var(--arbor-green-ink)" }}
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      ) : (
        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "var(--arbor-green-ink)" }}>The End</span>
      )}
    </div>
  );

  // ── Catalog view ───────────────────────────────────────────────────────────
  if (!activeStory || !render) {
    return (
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div>
          <h2 className="text-2xl md:text-[2rem] leading-[1.1] tracking-tight flex items-center gap-2.5" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            <Mountain className="w-6 h-6" style={{ color: "var(--arbor-green-ink)" }} /> Story Journeys
          </h2>
          <p className="text-sm mt-1.5 max-w-2xl" style={{ color: "var(--arbor-muted)" }}>
            {childProfile.name} becomes the hero of timeless stories that build courage, responsibility,
            resilience, empathy, and wisdom.
          </p>
        </div>

        {/* Development metrics */}
        <div className={`${cardCls} p-5 space-y-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
              <Trophy className="w-3.5 h-3.5" /> {childProfile.name}'s development
            </span>
            <span className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{runs.length} journeys completed</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            {METRIC_IDS.map((m) => (
              <div key={m} className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold" style={{ color: "var(--arbor-muted)" }}>{METRIC_LABELS[m]}</span>
                  <span className="font-extrabold" style={{ color: "var(--arbor-ink)" }}>{totalMetrics[m]}</span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--arbor-paper-deep)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(totalMetrics[m] / metricMax) * 100}%`, background: METRIC_COLORS[m] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pack filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPackFilter("all")}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition"
            style={packFilter === "all" ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
          >
            All packs
          </button>
          {PACKS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPackFilter(p.id)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition"
              style={packFilter === p.id ? { background: `${PACK_COLORS[p.id]}22`, color: "var(--arbor-ink)", border: `1px solid ${PACK_COLORS[p.id]}55` } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
            >
              {p.title}
            </button>
          ))}
        </div>

        {/* Story cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleStories.map((story) => {
            const color = PACK_COLORS[story.pack];
            const isLoading = loadingId === story.id;
            return (
              <div
                key={story.id}
                className={`${cardCls} p-5 flex flex-col gap-3 transition hover:-translate-y-0.5`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md"
                    style={{ background: `${color}22`, color }}
                  >
                    {story.pack}
                  </span>
                  {story.origin === "original" && (
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>Original</span>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-extrabold leading-tight" style={{ color: "var(--arbor-ink)" }}>
                    {aiLang === "he" ? story.titleHe : story.title}
                  </h3>
                  <p className="text-xs mt-1" style={{ color: "var(--arbor-muted)" }}>{story.theme}</p>
                </div>
                <p className="text-[11px] leading-relaxed flex-1" style={{ color: "var(--arbor-muted)" }}>{story.learningObjective}</p>
                <button
                  onClick={() => startJourney(story)}
                  disabled={!!loadingId}
                  className="mt-1 w-full py-2.5 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay) 60%,var(--arbor-clay-deep))" }}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Weaving your journey…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Start journey
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Library */}
        <div className={`${cardCls} p-5 space-y-4`}>
          <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
            <Library className="w-3.5 h-3.5" /> Journey library ({runs.length})
          </span>
          {!runsCol.loaded ? (
            <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>Loading…</p>
          ) : runs.length === 0 ? (
            <EmptyState
              headline="No journeys yet"
              body="Pick a story above and start your first hero journey. Completed journeys and the development they build are saved here."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => replay(run)}
                  className="text-left rounded-2xl p-3 transition group space-y-1"
                  style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
                >
                  <span className="text-xs font-bold block leading-tight line-clamp-2" style={{ color: "var(--arbor-ink)" }}>
                    {run.title}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>
                    {run.completedAt ? new Date(run.completedAt).toLocaleDateString() : "In progress"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Player view ────────────────────────────────────────────────────────────
  const playerBody = (immersiveMode: boolean) => (
    <div className="space-y-6">
      {displayScene && (
        <HeroScenePlayer
          scene={displayScene}
          seed={`${activeStory.id}-${displayScene.beatId}-${childProfile.name}`}
          beatNumber={sceneIndex + 1}
          beatTotal={activeStory.beats.length}
          photoUrl={photoUrl}
          heroAvatarUrl={heroAvatarUrl}
          heroAvatarStyle={heroAvatarStyle}
          heroName={childProfile.name?.split(" ")[0]}
          immersive={immersiveMode}
        />
      )}

      {renderChoices()}

      {/* Reflection / completion */}
      {isReflection && (
        <div className="w-full max-w-xl mx-auto space-y-4">
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.25)" }}>
            <p className="text-[11px] uppercase tracking-widest font-bold" style={{ color: "var(--arbor-green-ink)" }}>Today we practiced</p>
            <div className="flex flex-wrap gap-2">
              {render.reflection.practiced.map((p, i) => (
                <span
                  key={i}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"
                  style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-paper-elevated)" }}
                >
                  <Check className="w-3 h-3" /> {p}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-widest font-bold" style={{ color: "var(--arbor-green-ink)" }}>Talk about it together</p>
            {render.reflection.questions.map((q, i) => (
              <button
                key={i}
                onClick={() => setQuestionsChecked((s) => ({ ...s, [i]: !s[i] }))}
                className="w-full text-left p-2.5 rounded-xl transition flex items-start gap-2"
                style={questionsChecked[i]
                  ? { background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.30)", color: "var(--arbor-green-ink)" }
                  : { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
              >
                <span
                  className="mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-white"
                  style={{ background: questionsChecked[i] ? "var(--arbor-clay)" : "var(--arbor-rule-strong)" }}
                >
                  {questionsChecked[i] && <Check className="w-3 h-3" />}
                </span>
                <span dir="auto" className="text-xs">
                  {q}
                </span>
              </button>
            ))}
          </div>

          {!saved ? (
            <button
              onClick={finishJourney}
              className="w-full py-3 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay) 60%,var(--arbor-clay-deep))" }}
            >
              <Trophy className="w-4 h-4" /> Finish & save {childProfile.name}'s development
            </button>
          ) : (
            <div className="text-center text-sm font-bold flex items-center justify-center gap-2" style={{ color: "var(--arbor-green-ink)" }}>
              <Check className="w-4 h-4" /> Saved to {childProfile.name}'s development
            </div>
          )}
        </div>
      )}

      {!immersiveMode && renderNav()}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={exitJourney} className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
          <ArrowLeft className="w-4 h-4" /> All journeys
        </button>
        <span className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{render.title}</span>
        <button
          onClick={() => setImmersive(true)}
          className="flex items-center gap-1.5 text-sm font-bold"
          style={{ color: "var(--arbor-muted)" }}
        >
          <Maximize2 className="w-4 h-4" /> <span className="hidden sm:inline">Immersive</span>
        </button>
      </div>

      <div className="rounded-3xl p-6 md:p-8" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-md)" }}>
        {playerBody(false)}
      </div>

      {/* Immersive fullscreen overlay */}
      {immersive && (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--arbor-paper)" }}>
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "var(--arbor-muted)" }}>{render.title}</span>
            <button onClick={() => setImmersive(false)} aria-label="Exit immersive" style={{ color: "var(--arbor-muted)" }}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto flex items-center justify-center px-6 py-8">
            <div className="max-w-3xl w-full">{playerBody(true)}</div>
          </div>
          <div className="px-6 py-5">{renderNav()}</div>
        </div>
      )}
    </motion.div>
  );
}
