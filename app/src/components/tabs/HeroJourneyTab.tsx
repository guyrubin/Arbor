import { createPortal } from "react-dom";
import { useDialog } from "../../hooks/useDialog";
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { celebrate } from "../../lib/celebrate";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { api, type AvatarStyle } from "../../lib/api";
import { isolate } from "../../lib/i18n";
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
import { loadCharter, aimVirtues } from "../../lib/becoming";
// W0.7 — age-fit filtering (shared helper; banding reused from playbank/stages)
import { filterByAge, loadShowAllAges, saveShowAllAges, windowFromRange } from "../../lib/ageFilter";
import { agefilterText } from "../../lib/i18nElevation/agefilter";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { track } from "../../lib/analytics";
import { HeroScenePlayer } from "../stories/HeroScenePlayer";
import { useKidSafeNav } from "../kidmode/useKidSafeNav";
import { EmptyState } from "../ui/EmptyState";
import { SectionSkeleton } from "../ui/Skeleton";
import { statesText } from "../../lib/i18nElevation/states";
import { HeroAvatar } from "../ui/HeroAvatar";
import HeroCrest from "../ui/HeroCrest";
import { ArborMascot } from "../ui/ArborMascot";
import WorldScene from "../practice/WorldScene";
import { T, METRIC_VARS } from "../../lib/tokens";
import { fmtDay } from "../../lib/formatDate";

/** Comic-world skin per pack — bg + ink token + bilingual label (matches the
 *  Hero Arcade design layer so the Academy reads as the same comic universe). */
const PACK_WORLD: Record<HeroPackId, { bg: string; ink: string; label: string; labelHe: string }> = {
  courage: { bg: "var(--arbor-peach)", ink: "var(--arbor-peach-ink)", label: "Courage", labelHe: "אומץ" },
  responsibility: { bg: "var(--arbor-yellow)", ink: "var(--arbor-yellow-ink)", label: "Responsibility", labelHe: "אחריות" },
  growth: { bg: "var(--arbor-clay)", ink: "var(--arbor-clay-deep)", label: "Growth", labelHe: "צמיחה" },
  wisdom: { bg: "var(--arbor-sky)", ink: "var(--arbor-sky-ink)", label: "Wisdom", labelHe: "חוכמה" },
  truth: { bg: "var(--arbor-pack-truth)", ink: "var(--arbor-pack-truth)", label: "Truth", labelHe: "אמת" },
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
  "the-broken-music-box": { emoji: "🎵", sfx: "TING!", sfxHe: "טינג!" },
  "the-found-acorn-crown": { emoji: "🌰", sfx: "SHINE!", sfxHe: "נצנוץ!" },
  "the-two-gifts": { emoji: "🎁", sfx: "KNOCK!", sfxHe: "טוק!" },
  "leave-the-tent": { emoji: "⛺", sfx: "WHOOSH!", sfxHe: "ואוש!" },
  "the-two-paths-through-the-meadow": { emoji: "🌿", sfx: "HMM!", sfxHe: "המ!" },
  "the-two-mothers-and-the-quiet-judge": { emoji: "🤝", sfx: "SHH…", sfxHe: "ששש…" },
  "the-tyrant-and-the-town": { emoji: "📢", sfx: "STOP!", sfxHe: "די!" },
  "the-friendly-monster": { emoji: "👾", sfx: "GRRAH!", sfxHe: "גראח!" },
};

const METRIC_COLORS: Record<DevelopmentMetricId, string> = METRIC_VARS;

const METRIC_EMOJI: Record<DevelopmentMetricId, string> = {
  courage: "🦁",
  responsibility: "🛡️",
  resilience: "💪",
  empathy: "💛",
  wisdom: "🦉",
  truth: "🕯️",
};

export default function HeroJourneyTab() {
  const { childProfile } = useArbor();
  // KID-05: hub tiles navigate the PARENT shell — rendered only while the
  // shell is reachable (null inside Kid Mode, where the call would be a
  // silent no-op and a dead button in front of the child).
  const kidNav = useKidSafeNav();
  const { aiLang, t, uiLang } = useLanguage();
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
  // W0.7 — default the story catalog to the child's age band; "Show all ages"
  // (persisted per surface) keeps every story reachable (UC-1 rule).
  const [showAllAges, setShowAllAges] = useState<boolean>(() => loadShowAllAges("hero-journeys"));
  const childMonths = ageMonthsFromProfile(childProfile);
  const toggleShowAllAges = () => {
    setShowAllAges((prev) => {
      const next = !prev;
      saveShowAllAges("hero-journeys", next);
      track("agefilter_toggle", { surface: "hero-journeys", showAll: next });
      return next;
    });
  };
  const [activeStory, setActiveStory] = useState<HeroStorySpec | null>(null);
  const [render, setRender] = useState<HeroJourneyRender | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [choiceId, setChoiceId] = useState<string | undefined>(undefined);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const immersiveTriggerRef = useRef<HTMLButtonElement>(null);
  const wasImmersive = useRef(false);
  useLayoutEffect(() => {
    // Child immersion stays in Kid Mode's existing focus boundary. Restore its
    // invoking control after removal without registering a second parent trap.
    if (!kidNav && wasImmersive.current && !immersive) {
      immersiveTriggerRef.current?.focus({ preventScroll: true });
    }
    wasImmersive.current = immersive;
  }, [immersive, kidNav]);
  const { ref: dialogRef, requestClose } = useDialog({ open: Boolean(kidNav) && immersive && Boolean(activeStory && render), onClose: () => setImmersive(false), returnFocusRef: immersiveTriggerRef });
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
    celebrate({ kind: "choice" });
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
    celebrate({ kind: "complete" });
    toast(aiLang === "he" ? "המסע הושלם — הסיפור נשמר" : "Journey complete — story saved", "success");
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
            className="w-full text-start p-3.5 rounded-2xl transition flex items-center gap-3 group hover:-translate-y-0.5"
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
        className="touch-target disabled:opacity-30 flex items-center gap-1 text-sm"
        style={{ color: "var(--arbor-muted)" }}
      >
        <Icon name="chevron_left" size={16} /> Back
      </button>
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--arbor-faint)" }}>
        {activeStory && `${sceneIndex + 1} / ${activeStory.beats.length}`}
      </span>
      {sceneIndex < scenes.length - 1 ? (
        <button
          onClick={() => canAdvance && setSceneIndex((i) => Math.min(scenes.length - 1, i + 1))}
          disabled={!canAdvance}
          className="touch-target disabled:opacity-30 flex items-center gap-1 text-sm font-bold"
          style={{ color: "var(--arbor-green-ink)" }}
        >
          Next <Icon name="chevron_right" size={16} />
        </button>
      ) : (
        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "var(--arbor-green-ink)" }}>The End</span>
      )}
    </div>
  );

  // ── Catalog view (comic "story worlds" — the child is the hero of each) ──────
  if (!activeStory || !render) {
    const he = aiLang === "he";
    // E8/F-10: the display copy below bidi-isolates each interpolation of the
    // name so a Hebrew name can't reorder the English headline copy (e.g.
    // `${name}'s Story Quests`).
    const name = childProfile.name?.split(" ")[0] || (he ? "הגיבור" : "your hero");
    // "Aim at the highest good": the family's Charter values steer which stories
    // surface first, and the aim is made visible to the child + parent.
    const charter = loadCharter();
    const aims = aimVirtues(charter);
    const isAimed = (s: HeroStorySpec) => aims.includes(s.primaryMetric);
    const orderedStories = aims.length
      ? [...visibleStories].sort((a, b) => (isAimed(b) ? 1 : 0) - (isAimed(a) ? 1 : 0))
      : visibleStories;
    // W0.7 — age gate AFTER pack filter + aim ordering (never re-ranks). Every
    // canon story is authored for ages 4–8, so for a younger child the default
    // view is an honest empty state with the "Show all ages" door, not a grid
    // of content written for someone else's age.
    const { visible: ageVisibleStories, hidden: ageHiddenStories } = filterByAge(
      orderedStories,
      (s) => windowFromRange(s.ageRange),
      childMonths,
    );
    const displayStories = showAllAges ? orderedStories : ageVisibleStories;
    const hiddenAgeMin = ageHiddenStories.length
      ? Math.min(...ageHiddenStories.map((s) => s.ageRange[0]))
      : null;
    const hiddenAgeMax = ageHiddenStories.length
      ? Math.max(...ageHiddenStories.map((s) => s.ageRange[1]))
      : null;
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
              {he ? `מסעות הגיבור של ${isolate(name)}` : `${isolate(name)}'s Story Quests`}
            </h1>
            {charter.length > 0 && (
              <p className="text-[12.5px] font-bold mt-1.5" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
                {he ? `מגדלים את ${isolate(name)} לקראת: ${charter.join(" · ")}` : `Raising ${isolate(name)} toward: ${charter.join(" · ")}`}
              </p>
            )}
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
            {he ? `${isolate(name)}, הפכו לגיבור של כל סיפור!` : `Pick a story, hero — ${isolate(name)} stars in every one!`}
          </div>
        </div>

        {/* IN-HUB TILES (UC-4) — Hero Comics + Family Formation live inside the
            Academy / Story Journeys surface, not as their own sidebar doors. */}
        <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          {kidNav && (
          <button
            className="world-tile text-start"
            onClick={() => kidNav("comics")}
            aria-label={he ? "קומיקס גיבור" : "Hero Comics"}
          >
            <div className="comic-halftone relative grid place-items-center" style={{ height: 96, background: "var(--arbor-peach)", borderBottom: "var(--comic-line)" }}>
              <Icon name="auto_stories" size={44} style={{ color: "#fff", filter: "drop-shadow(2px 2px 0 rgba(23,27,34,.3))" }} />
              <span className="comic-sfx absolute bottom-1 z-[3] text-[20px] -rotate-6" style={{ insetInlineStart: 8 }} aria-hidden="true">{he ? "פאו!" : "POW!"}</span>
            </div>
            <div className="p-3.5">
              <p className="font-black text-[16.5px] leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
                {he ? "קומיקס גיבור" : "Hero Comics"}
              </p>
              <p className="text-[12.5px] font-bold mt-1" style={{ color: "var(--arbor-ink-soft)" }} dir="auto">
                {he ? `${isolate(name)} כוכב הקומיקס של כל סיפור` : `${isolate(name)} stars in every story's comic`}
              </p>
            </div>
          </button>
          )}

          {kidNav && (
          <button
            className="world-tile text-start"
            onClick={() => kidNav("family")}
            aria-label={he ? "מגילת המשפחה" : "Family Formation"}
          >
            <div className="comic-halftone relative grid place-items-center" style={{ height: 96, background: "var(--arbor-yellow)", borderBottom: "var(--comic-line)" }}>
              <Icon name="history_edu" size={44} style={{ color: "#fff", filter: "drop-shadow(2px 2px 0 rgba(23,27,34,.3))" }} />
            </div>
            <div className="p-3.5">
              <p className="font-black text-[16.5px] leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
                {he ? "מגילת המשפחה" : "Family Formation"}
              </p>
              <p className="text-[12.5px] font-bold mt-1" style={{ color: "var(--arbor-ink-soft)" }} dir="auto">
                {he ? "הערכים שמכוונים את הסיפורים שלכם" : "The values that steer your stories"}
              </p>
            </div>
          </button>
          )}
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
                className="px-3.5 py-2.5 min-h-[44px] rounded-full text-[13px] font-black transition"
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3">
            <h2 className="font-black" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px,3.4vw,24px)" }}>
              {he ? "בחרו את הסיפור שלכם" : "Choose your story"}
            </h2>
            {/* W0.7 — "Show all ages" toggle (comic register), shown only when
                the child's-age view actually hides stories or it's already on. */}
            {(ageHiddenStories.length > 0 || showAllAges) && (
              <span className="ms-auto inline-flex items-center gap-2">
                {!showAllAges && ageHiddenStories.length > 0 && (
                  <span className="text-[11.5px] font-black" style={{ color: "var(--arbor-muted)" }} dir="auto">
                    {agefilterText("elev.agefilter.hiddenCount", he, { n: ageHiddenStories.length })}
                  </span>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={showAllAges}
                  onClick={toggleShowAllAges}
                  data-testid="agefilter-toggle-hero-journeys"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-2.5 min-h-[44px] text-[11.5px] font-black"
                  style={{
                    background: showAllAges ? "var(--arbor-yellow)" : "#fff",
                    border: "2px solid var(--comic-ink)",
                    color: "var(--arbor-ink)",
                  }}
                >
                  <Icon name={showAllAges ? "check" : "unfold_more"} size={14} />
                  {agefilterText("elev.agefilter.showAll", he)}
                </button>
              </span>
            )}
          </div>
          {/* W0.7 — honest empty state: the catalog is written for older ages. */}
          {displayStories.length === 0 && ageHiddenStories.length > 0 && (
            <div className="comic-panel p-5 text-center" data-testid="agefilter-empty-hero-journeys">
              <p className="text-[14px] font-black" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                {agefilterText("elev.agefilter.empty", he, {
                  min: hiddenAgeMin ?? "",
                  max: hiddenAgeMax ?? "",
                  name,
                })}
              </p>
              <button
                type="button"
                onClick={toggleShowAllAges}
                className="mt-3 inline-flex items-center gap-1 rounded-full px-3.5 py-2.5 min-h-[44px] text-[12.5px] font-black"
                style={{ background: "var(--arbor-yellow)", border: "2px solid var(--comic-ink)", color: "var(--arbor-ink)" }}
              >
                <Icon name="unfold_more" size={15} /> {agefilterText("elev.agefilter.showAll", he)}
              </button>
            </div>
          )}
          <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            {displayStories.map((story) => {
              const w = PACK_WORLD[story.pack];
              const art = STORY_ART[story.id] ?? { emoji: "⭐", sfx: "POW!", sfxHe: "פאו!" };
              const isLoading = loadingId === story.id;
              return (
                <button
                  key={story.id}
                  className="world-tile text-start relative"
                  aria-disabled={!!loadingId}
                  aria-label={`${he ? story.titleHe : story.title} — ${he ? w.labelHe : w.label}`}
                  onClick={() => !loadingId && startJourney(story)}
                >
                  {isAimed(story) ? (
                    <span
                      className="absolute top-0 left-0 z-[2] text-[10.5px] font-black px-2.5 py-1 inline-flex items-center gap-1"
                      style={{ background: "var(--arbor-yellow)", color: "var(--arbor-ink)", border: "var(--comic-line)", borderTopLeftRadius: "var(--play-radius)", borderBottomRightRadius: "12px" }}
                    >
                      ★ {he ? "המטרה שלכם" : "Your aim"}
                    </span>
                  ) : story.origin === "original" ? (
                    <span
                      className="absolute top-0 left-0 z-[2] text-[11px] font-black text-white px-2.5 py-1"
                      style={{ background: "var(--arbor-pink)", border: "var(--comic-line)", borderTopLeftRadius: "var(--play-radius)", borderBottomRightRadius: "12px" }}
                    >
                      {he ? "מקורי" : "ORIGINAL"}
                    </span>
                  ) : null}
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
                          /* Press feedback while the story generates — label
                             via i18n (masterplan 4.3: no hardcoded literals). */
                          <><Icon name="autorenew" size={16} className="motion-safe:animate-spin" /> {statesText("elev.states.hero.opening", he)}</>
                        ) : (
                          <>{he ? "שחקו" : "Play"} <Icon name="play_arrow" size={16} fill={1} /></>
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
            <Icon name="auto_stories" size={20} /> {he ? `הספרייה (${runs.length})` : `Library (${runs.length})`}
          </h2>
          {!runsCol.loaded ? (
            /* Masterplan 4.3 — per-section skeleton mimicking the library tile
               grid (reserves real dimensions; ~10s → inline retry wired to the
               W0 syncStore, which re-mounts this runsCol listener). */
            <SectionSkeleton title={false} rows={2} rowClassName="h-[120px]" loaded={runsCol.loaded} testId="hero-library-skeleton" />
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
                  <button key={run.id} onClick={() => replay(run)} className="world-tile text-start" aria-label={run.title}>
                    <div className="comic-halftone grid place-items-center" style={{ height: 72, background: w.bg, borderBottom: "var(--comic-line)" }}>
                      <span style={{ fontSize: 34 }} aria-hidden="true">{art.emoji}</span>
                    </div>
                    <div className="p-2.5">
                      <span className="text-[12.5px] font-black block leading-tight line-clamp-2" style={{ color: "var(--arbor-ink)" }} dir="auto">{run.title}</span>
                      <span className="text-[10.5px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                        {run.completedAt ? fmtDay(run.completedAt, uiLang) : he ? "בתהליך" : "In progress"}
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
          {activeStory.parentInsight && (
            <div className="rounded-2xl p-4 space-y-1.5" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "var(--arbor-muted)" }}>
                {aiLang === "he" ? "למבוגרים · למה הסיפור הזה" : "For grown-ups · Why this story"}
              </p>
              <p dir="auto" className="text-[13px] leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>
                {aiLang === "he" ? activeStory.parentInsight.he : activeStory.parentInsight.en}
              </p>
            </div>
          )}
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.25)" }}>
            <p className="text-[11px] uppercase tracking-widest font-bold" style={{ color: "var(--arbor-green-ink)" }}>{aiLang === "he" ? "מה תרגלנו היום" : "Today we practiced"}</p>
            <div className="flex flex-wrap gap-2">
              {render.reflection.practiced.map((p, i) => (
                <span
                  key={i}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"
                  style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-paper-elevated)" }}
                >
                  <Icon name="check" size={12} /> {p}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-widest font-bold" style={{ color: "var(--arbor-green-ink)" }}>{aiLang === "he" ? "דברו על זה יחד" : "Talk about it together"}</p>
            {render.reflection.questions.map((q, i) => (
              <button
                key={i}
                onClick={() => setQuestionsChecked((s) => ({ ...s, [i]: !s[i] }))}
                className="w-full text-start p-2.5 rounded-xl transition flex items-start gap-2"
                style={questionsChecked[i]
                  ? { background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.30)", color: "var(--arbor-green-ink)" }
                  : { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
              >
                <span
                  className="mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-white"
                  style={{ background: questionsChecked[i] ? "var(--arbor-clay)" : "var(--arbor-rule-strong)" }}
                >
                  {questionsChecked[i] && <Icon name="check" size={12} />}
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
              style={{ background: T.gradientCta }}
            >
              <Icon name="emoji_events" size={16} /> {aiLang === "he" ? `סיימו ושמרו את הסיפור של ${isolate(childProfile.name)}` : `Finish & save ${isolate(childProfile.name)}'s story`}
            </button>
          ) : (
            <div className="text-center text-sm font-bold flex items-center justify-center gap-2" style={{ color: "var(--arbor-green-ink)" }}>
              <Icon name="check" size={16} /> {aiLang === "he" ? `נשמר לסיפור של ${isolate(childProfile.name)}` : `Saved to ${isolate(childProfile.name)}'s story`}
            </div>
          )}
        </div>
      )}

      {!immersiveMode && renderNav()}
    </div>
  );

  // Kid Mode owns its own trap and Escape gate. Keep the child view inside
  // that subtree; only the parent view portals out of the transformed tab.
  const immersiveDialog = (
        <div ref={dialogRef} tabIndex={-1} data-arbor-dialog-layer role="dialog" aria-modal="true" aria-label={render.title} className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--arbor-paper)" }}>
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "var(--arbor-muted)" }}>{render.title}</span>
            <button onClick={kidNav ? requestClose : () => setImmersive(false)} className="touch-target" aria-label={t("aria.exitImmersive")} style={{ minWidth: "var(--touch-min)", minHeight: "var(--touch-min)", color: "var(--arbor-muted)" }}>
              <Icon name="close" size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto flex items-center justify-center px-6 py-8">
            <div className="max-w-3xl w-full">{playerBody(true)}</div>
          </div>
          <div className="px-6 py-5">{renderNav()}</div>
        </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={exitJourney} className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
          <Icon name="arrow_back" size={16} /> All journeys
        </button>
        <span className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{render.title}</span>
        <button
          ref={immersiveTriggerRef}
          onClick={() => setImmersive(true)}
          className="flex items-center gap-1.5 text-sm font-bold"
          style={{ color: "var(--arbor-muted)" }}
        >
          <Icon name="fullscreen" size={16} /> <span className="hidden sm:inline">Immersive</span>
        </button>
      </div>

      <div className="rounded-3xl p-6 md:p-8" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-md)" }}>
        {playerBody(false)}
      </div>

      {/* Immersive fullscreen overlay */}
      {immersive && (kidNav ? createPortal(
        <div className="arbor-app arbor-parent" style={{ display: "contents" }}>{immersiveDialog}</div>, document.body,
      ) : immersiveDialog)}
    </motion.div>
  );
}
