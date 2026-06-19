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
  Trophy,
  ArrowLeft,
  Play,
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
import { HeroAvatar } from "../ui/HeroAvatar";
import HeroCrest from "../ui/HeroCrest";
import { ArborMascot } from "../ui/ArborMascot";
import WorldScene from "../practice/WorldScene";

/** Comic-world skin per pack — bg + ink token + bilingual label (matches the
 *  Hero Arcade design layer so the Academy reads as the same comic universe). */
const PACK_WORLD: Record<HeroPackId, { bg: string; ink: string; label: string; labelHe: string }> = {
  courage: { bg: "var(--arbor-peach)", ink: "var(--arbor-peach-ink)", label: "Courage", labelHe: "אומץ" },
  responsibility: { bg: "var(--arbor-yellow)", ink: "var(--arbor-yellow-ink)", label: "Responsibility", labelHe: "אחריות" },
  growth: { bg: "var(--arbor-clay)", ink: "var(--arbor-clay-deep)", label: "Growth", labelHe: "צמיחה" },
  wisdom: { bg: "var(--arbor-sky)", ink: "var(--arbor-sky-ink)", label: "Wisdom", labelHe: "חוכמה" },
};

/** Per-story scene motif: a big emoji prop + a comic SFX burst (EN/HE), so every
 *  card is its own illustrated world with the child's hero standing inside it. */
const STORY_ART: Record<string, { emoji: string; sfx: string; sfxHe: string }> = {
  "david-and-goliath": { emoji: "🛡️", sfx: "BOOM!", sfxHe: "בום!" },
  "moses-and-pharaoh": { emoji: "👑", sfx: "ECHO!", sfxHe: "הד!" },
  "the-lion-who-was-afraid": { emoji: "🦁", sfx: "ROAR!", sfxHe: "שאגה!" },
  "noahs-ark": { emoji: "🌈", sfx: "SPLASH!", sfxHe: "שלאמפ!" },
  "jonah-and-the-great-fish": { emoji: "🐋", sfx: "GULP!", sfxHe: "גלופ!" },
  "the-dragon-of-responsibility": { emoji: "🐉", sfx: "FWOOSH!", sfxHe: "פוווש!" },
  "joseph-and-his-brothers": { emoji: "🧥", sfx: "SHINE!", sfxHe: "ברק!" },
  "jacob-wrestling-the-angel": { emoji: "🌅", sfx: "HOLD ON!", sfxHe: "חזק!" },
  "the-garden-of-forgotten-seeds": { emoji: "🌻", sfx: "BLOOM!", sfxHe: "פריחה!" },
  "king-solomons-choice": { emoji: "⚖️", sfx: "AHA!", sfxHe: "אהה!" },
};

const METRIC_COLORS: Record<DevelopmentMetricId, string> = {
  courage: "#e2562d",
  responsibility: "#d7aa55",
  resilience: "#A07AF8",
  empathy: "#38C8F0",
  wisdom: "#68B4FF",
};

const METRIC_EMOJI: Record<DevelopmentMetricId, string> = {
  courage: "🦁",
  responsibility: "🛡️",
  resilience: "💪",
  empathy: "💛",
  wisdom: "🦉",
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

  // ── Catalog view (comic "story worlds" — the child is the hero of each) ──────
  if (!activeStory || !render) {
    const he = aiLang === "he";
    const name = childProfile.name?.split(" ")[0] || (he ? "הגיבור" : "your hero");
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="arbor-play space-y-6"
      >
        {/* HERO BANNER — the child fronts their own story academy */}
        <section className="comic-panel p-5 sm:p-6 flex items-center gap-4 sm:gap-5" aria-label={he ? "הגיבור שלך" : "Your hero"}>
          <HeroCrest size={92}>
            <HeroAvatar size={92} mood="cheer" />
          </HeroCrest>
          <div className="flex-1 min-w-0">
            <span
              className="inline-block text-[12px] font-black rounded-full px-2.5 py-0.5 mb-1.5"
              style={{ background: "var(--arbor-yellow-soft)", color: "var(--arbor-yellow-ink)", border: "var(--comic-line)" }}
            >
              {he ? `${runs.length} סיפורים הושלמו` : `${runs.length} stories done`}
            </span>
            <h1 className="font-black leading-none truncate" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px,5vw,38px)" }} dir="auto">
              {he ? `מסעות הגיבור של ${name}` : `${name}'s Story Quests`}
            </h1>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {METRIC_IDS.map((m) => (
                <span
                  key={m}
                  title={METRIC_LABELS[m]}
                  className="inline-flex items-center gap-1 text-[12px] font-black rounded-full px-2.5 py-1"
                  style={{ background: "#fff", border: "var(--comic-line)" }}
                >
                  <span aria-hidden="true">{METRIC_EMOJI[m]}</span>
                  <b style={{ color: METRIC_COLORS[m] }}>{totalMetrics[m]}</b>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* SPROUT COACH BUBBLE */}
        <div className="flex items-end gap-3">
          <ArborMascot size={50} mood="wave" animate className="flex-shrink-0" />
          <div className="comic-panel px-4 py-3 text-[14px] font-extrabold" dir="auto">
            {he ? `${name}, הפכו לגיבור של כל סיפור!` : `Pick a story, hero — ${name} stars in every one!`}
          </div>
        </div>

        {/* PACK FILTER — comic chips */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={he ? "סינון לפי כוח" : "Filter by power"}>
          {[{ id: "all" as const, label: he ? "הכול" : "All" }, ...PACKS.map((p) => ({ id: p.id, label: he ? p.titleHe : p.title }))].map((p) => {
            const active = packFilter === p.id;
            const w = p.id === "all" ? null : PACK_WORLD[p.id as HeroPackId];
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={active}
                onClick={() => setPackFilter(p.id as HeroPackId | "all")}
                className="px-3.5 py-1.5 rounded-full text-[13px] font-black transition"
                style={
                  active
                    ? { background: w ? w.bg : "var(--arbor-clay)", color: "#fff", border: "var(--comic-line)", boxShadow: "var(--comic-pop)" }
                    : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink-soft)", border: "var(--comic-line)" }
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* STORY WORLDS — each card is an illustrated world starring the hero */}
        <div>
          <h2 className="font-black mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px,3.4vw,24px)" }}>
            {he ? "בחרו את הסיפור שלכם" : "Choose your story"}
          </h2>
          <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            {visibleStories.map((story) => {
              const w = PACK_WORLD[story.pack];
              const art = STORY_ART[story.id] ?? { emoji: "⭐", sfx: "POW!", sfxHe: "פאו!" };
              const isLoading = loadingId === story.id;
              return (
                <button
                  key={story.id}
                  className="world-tile text-left relative"
                  aria-disabled={!!loadingId}
                  aria-label={`${he ? story.titleHe : story.title} — ${he ? w.labelHe : w.label}`}
                  onClick={() => !loadingId && startJourney(story)}
                >
                  {story.origin === "original" && (
                    <span
                      className="absolute top-0 left-0 z-[2] text-[11px] font-black text-white px-2.5 py-1"
                      style={{ background: "var(--arbor-pink)", border: "var(--comic-line)", borderTopLeftRadius: "var(--play-radius)", borderBottomRightRadius: "12px" }}
                    >
                      {he ? "מקורי" : "ORIGINAL"}
                    </span>
                  )}
                  {/* Scene: the hero standing in this story's world */}
                  <div className="comic-halftone relative overflow-hidden" style={{ height: 150, background: w.bg, borderBottom: "var(--comic-line)" }}>
                    {/* The story's world, with the child's hero generated into the scene
                        (same pipeline as the Practice world-cards). Falls back to the
                        hero + emoji motif while loading / with no hero / on error. */}
                    <WorldScene worldId={`story-${story.id}`} imagePrompt={`${story.title} — ${story.theme}`} heroUrl={photoUrl}>
                      <div className="flex items-center gap-1.5">
                        <HeroAvatar size={80} ring animate={false} />
                        <span style={{ fontSize: 46, filter: "drop-shadow(2px 2px 0 rgba(23,27,34,.3))" }} aria-hidden="true">
                          {art.emoji}
                        </span>
                      </div>
                    </WorldScene>
                    <span
                      className="absolute top-2 z-[3] text-[10.5px] font-black rounded-full px-2 py-0.5"
                      style={{ insetInlineEnd: 8, background: "#fff", border: "2px solid var(--comic-ink)", color: "var(--arbor-ink)" }}
                    >
                      {he ? "גיל" : "Age"} {story.ageRange[0]}–{story.ageRange[1]}
                    </span>
                    <span className="comic-sfx absolute bottom-1 z-[3] text-[24px] -rotate-6" style={{ insetInlineStart: 8 }} aria-hidden="true">
                      {he ? art.sfxHe : art.sfx}
                    </span>
                  </div>
                  {/* Caption */}
                  <div className="p-3.5">
                    <p className="font-black text-[16.5px] leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
                      {he ? story.titleHe : story.title}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className="inline-block text-[10.5px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{ border: "2px solid var(--comic-ink)", color: w.ink }}
                      >
                        {he ? w.labelHe : w.label}
                      </span>
                      <span className="ms-auto inline-flex items-center gap-1 text-[13px] font-black" style={{ color: w.ink }}>
                        {isLoading ? (
                          <><RefreshCw className="w-4 h-4 animate-spin" /> {he ? "טוען…" : "Loading…"}</>
                        ) : (
                          <>{he ? "שחקו" : "Play"} <Play className="w-4 h-4" fill="currentColor" /></>
                        )}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* JOURNEY LIBRARY */}
        <div>
          <h2 className="font-black mb-3 inline-flex items-center gap-2" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px,3.4vw,24px)" }}>
            <Library className="w-5 h-5" /> {he ? `הספרייה (${runs.length})` : `Library (${runs.length})`}
          </h2>
          {!runsCol.loaded ? (
            <p className="text-[13px] font-bold" style={{ color: "var(--arbor-muted)" }}>{he ? "טוען…" : "Loading…"}</p>
          ) : runs.length === 0 ? (
            <div className="comic-panel p-5">
              <EmptyState
                headline={he ? "עדיין אין מסעות" : "No quests yet"}
                body={he ? "בחרו סיפור למעלה והתחילו את המסע הראשון. כל מסע שהושלם נשמר כאן." : "Pick a story above and start your first quest. Completed quests are saved here."}
              />
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
              {runs.map((run) => {
                const spec = getStorySpec(run.storyId);
                const w = spec ? PACK_WORLD[spec.pack] : PACK_WORLD.courage;
                const art = STORY_ART[run.storyId] ?? { emoji: "⭐", sfx: "POW!", sfxHe: "פאו!" };
                return (
                  <button key={run.id} onClick={() => replay(run)} className="world-tile text-left" aria-label={run.title}>
                    <div className="comic-halftone grid place-items-center" style={{ height: 72, background: w.bg, borderBottom: "var(--comic-line)" }}>
                      <span style={{ fontSize: 34 }} aria-hidden="true">{art.emoji}</span>
                    </div>
                    <div className="p-2.5">
                      <span className="text-[12.5px] font-black block leading-tight line-clamp-2" style={{ color: "var(--arbor-ink)" }} dir="auto">{run.title}</span>
                      <span className="text-[10.5px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                        {run.completedAt ? new Date(run.completedAt).toLocaleDateString() : he ? "בתהליך" : "In progress"}
                      </span>
                    </div>
                  </button>
                );
              })}
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
