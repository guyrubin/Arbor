import { createPortal } from "react-dom";
import { useDialog } from "../../hooks/useDialog";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { celebrate } from "../../lib/celebrate";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { api } from "../../lib/api";
import { normalizeAvatarStyle } from "../../lib/avatarStyle";
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
import { ProvenanceBadge } from "../ui/ProvenanceBadge";
import { generateJourneyPage, toSavedComicMeta, type SavedComicMeta } from "../../lib/heroComics";
import { useKidSafeNav } from "../kidmode/useKidSafeNav";
import { isKidModeActive, noteKidActivity, subscribeKidMode } from "../../lib/kidModeGate";
import { ComicPage, MascotSay, PlayButton, PlayPanel } from "../ui/playkit";
import { EmptyState } from "../ui/EmptyState";
import { SectionSkeleton } from "../ui/Skeleton";
import { statesText } from "../../lib/i18nElevation/states";
import { HeroAvatar } from "../ui/HeroAvatar";
import HeroCrest from "../ui/HeroCrest";
import { ArborMascot } from "../ui/ArborMascot";
import WorldScene from "../practice/WorldScene";
import { chooseTonightsStory } from "../kidmode/tonightsStory";
import { dayKey } from "../../practice/signals";
import { PageHeader, cardCls } from "../ui/kit";
import { T, METRIC_VARS } from "../../lib/tokens";
import { fmtDay } from "../../lib/formatDate";
import { kidsStoriesText } from "../../lib/i18nElevation/kidsStories";

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
const STORY_ART: Record<string, { emoji: string; sfx: string; sfxHe: string; src?: string }> = {
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
  "the-lantern-path": { emoji: "🏮", sfx: "GLOW!", sfxHe: "זוהר!", src: "/visuals/stories/v1/lantern-path-v1.webp" },
  "the-cloud-orchestra": { emoji: "🎼", sfx: "BOOM!", sfxHe: "בום!", src: "/visuals/stories/v1/cloud-orchestra-v1.webp" },
  "the-little-bridge-builders": { emoji: "🌉", sfx: "CLICK!", sfxHe: "קליק!", src: "/visuals/stories/v1/little-bridge-builders-v1.webp" },
};

/** Immediate, authored, provider-free render. Used only when the personalized
 * route is unavailable; preserves all eight beats, localized copy and exact
 * authored choice consequences without adding any generation. */
export function authoredJourneyRender(story: HeroStorySpec, lang: "en" | "he"): HeroJourneyRender {
  const he = lang === "he";
  const decision = story.beats.find((beat) => beat.id === "decision");
  return {
    storyId: story.id,
    title: he ? story.titleHe : story.title,
    scenes: story.beats.map((beat) => ({
      beatId: beat.id,
      title: he ? (beat.titleHe ?? beat.title) : beat.title,
      narration: he ? (beat.spineHe ?? beat.spine) : beat.spine,
      imagePrompt: "",
    })),
    choices: (decision?.choices ?? []).map((choice) => ({
      id: choice.id,
      label: he ? (choice.labelHe ?? choice.label) : choice.label,
      consequence: he ? (choice.outcomeHintHe ?? choice.outcomeHint) : choice.outcomeHint,
    })),
    reflection: {
      practiced: he ? (story.parentReflection.practicedHe ?? story.parentReflection.practiced) : story.parentReflection.practiced,
      questions: he ? (story.parentReflection.questionsHe ?? story.parentReflection.questions) : story.parentReflection.questions,
    },
  };
}

/**
 * KID-25 — the same story, twice in one evening, cost two generations.
 *
 * Tapping Play always POSTed to /generate-hero-journey. A child who backs out
 * of a story and opens it again waits for a model round-trip a second time,
 * gets DIFFERENT text for the story they had just started, and the family pays
 * twice. The render is deterministic per (child, story, day) by intent — that
 * is exactly what a memo key is.
 *
 * Module-scoped so it survives a tab unmount inside one session (which is what
 * "back out and open it again" does); the day key is part of the key, so it
 * self-expires overnight without a timer. Never persisted: a render is model
 * output about a child, and this cache is a within-session cost guard, not
 * storage. Completed runs are already persisted properly, in `heroRuns`.
 */
const journeyMemo = new Map<string, HeroJourneyRender>();

/** `childId|storyId|lang|YYYY-MM-DD` — language is in the key because the same
 *  story in Hebrew is a different render, not the same one. */
export function journeyMemoKey(childId: string, storyId: string, lang: string, day: string): string {
  return `${childId}|${storyId}|${lang}|${day}`;
}

/** Test seam — the map is module state by design. */
export function clearJourneyMemo(): void {
  journeyMemo.clear();
}

const METRIC_COLORS: Record<DevelopmentMetricId, string> = METRIC_VARS;

const METRIC_EMOJI: Record<DevelopmentMetricId, string> = {
  courage: "🦁",
  responsibility: "🛡️",
  resilience: "💪",
  empathy: "💛",
  wisdom: "🦉",
  truth: "🕯️",
};

export default function HeroJourneyTab({ initialStoryId }: { initialStoryId?: string } = {}) {
  const { childProfile, setActiveTab } = useArbor();
  // KID-05: hub tiles navigate the PARENT shell — rendered only while the
  // shell is reachable (null inside Kid Mode, where the call would be a
  // silent no-op and a dead button in front of the child).
  const kidNav = useKidSafeNav();
  const { aiLang, t, uiLang } = useLanguage();
  const { toast } = useToast();
  // OBJ-KID-04: ToastContext QUEUES toasts while kid-locked, so a failed start
  // inside Kid Mode was silent — the child tapped Play and nothing moved. Branch
  // at the call site (never in ToastContext, which the parent shell relies on).
  const kidMode = useSyncExternalStore(subscribeKidMode, isKidModeActive, isKidModeActive);
  /** Kid-register answer to a failed generate: the story is resting. */
  const [storyResting, setStoryResting] = useState(false);

  const runsCol = useChildCollection<HeroJourneyRun>(childProfile.id, "heroRuns");
  const runs = runsCol.items;
  // G2 (22 Sep 2026): every story read with a hero is a comic. Page keys are
  // collected as the child turns pages (cover = 0, beats = 1..N); a complete
  // set is saved as a book on the child's shelf when the story finishes.
  const savedComicsCol = useChildCollection<SavedComicMeta>(childProfile.id, "savedComics");
  const comicPageKeys = useRef<Map<number, string>>(new Map());
  const [comicSaved, setComicSaved] = useState(false);
  // M2: the kid ending line and the parent toast read ONE saved state. The ref
  // is the synchronous twin of `comicSaved` (a setState is not readable inside
  // the same async handler); `markComicSaved` is the only writer of either.
  const comicSavedRef = useRef(false);
  const markComicSaved = (value: boolean) => { comicSavedRef.current = value; setComicSaved(value); };
  // M2: the cover is generated today but was never SHOWN. It is now the
  // reader's opening page — same ComicPage primitive, same framed loading and
  // smudged/Redraw states as a beat, and it never blocks: the child can turn
  // past a cover that is still drawing.
  const [coverArt, setCoverArt] = useState<{ url?: string; loading: boolean; error: boolean }>({ loading: false, error: false });
  const [onCover, setOnCover] = useState(false);
  const coverRun = useRef(0);
  const photoUrl = (childProfile as unknown as { photoUrl?: string }).photoUrl;
  // AVA-3: use a generated stylized character (a data-URL avatar) as the story hero —
  // never a raw face photo or a remote URL — so scenes stay consistent and privacy-safe.
  const heroAvatarUrl = childProfile.avatar && photoUrl?.startsWith("data:") ? photoUrl : undefined;
  const heroAvatarStyle = normalizeAvatarStyle(childProfile.avatar?.style);
  const heroName = childProfile.name?.split(" ")[0] || (aiLang === "he" ? "הילד/ה" : "your child");

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
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
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
    setStoryResting(false);
    try {
      // KID-25: a second Play of tonight's story makes NO network call.
      const memoKey = journeyMemoKey(childProfile.id, story.id, aiLang, dayKey(new Date()));
      const memoed = journeyMemo.get(memoKey);
      const r = memoed ?? await api.generateHeroJourney({
        storyId: story.id,
        childName: childProfile.name,
        age: childProfile.age,
        language: aiLang,
      });
      if (!memoed) journeyMemo.set(memoKey, r);
      startedAtRef.current = new Date().toISOString();
      setActiveStory(story);
      setRender(r);
      setSceneIndex(0);
      setChoiceId(undefined);
      setQuestionsChecked({});
      setSaved(false);
      setFinishing(false);
      finishingRef.current = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start the journey.";
      const fallback = authoredJourneyRender(story, aiLang);
      journeyMemo.set(journeyMemoKey(childProfile.id, story.id, aiLang, dayKey(new Date())), fallback);
      startedAtRef.current = new Date().toISOString();
      setActiveStory(story);
      setRender(fallback);
      setSceneIndex(0);
      setChoiceId(undefined);
      setQuestionsChecked({});
      setSaved(false);
      setFinishing(false);
      finishingRef.current = false;
      if (!kidMode) toast(msg, "error");
    } finally {
      setLoadingId(null);
    }
  };

  const chooseOption = (id: string) => {
    setChoiceId(id);
    celebrate({ kind: "choice" });
    setSceneIndex((i) => Math.min(scenes.length - 1, i + 1));
  };

  // G2: the cover page (index 0) is drawn once per story start; the queue
  // (sceneCache MAX_CONCURRENT) keeps it behind the first beat's page.
  // M2: the SAME call now also feeds the reader's opening page — one
  // generation path (generateJourneyPage / journeyPageKey), never a second.
  // `Redraw` on the cover re-enters here rather than through an effect dep, so
  // a retry costs exactly one call and the story-start effect stays keyed to
  // the story.
  const drawCover = () => {
    const cover = coverPageArgs();
    if (!cover) return;
    const run = ++coverRun.current;
    setCoverArt({ loading: true, error: false });
    generateJourneyPage(cover)
      .then(({ key, url }) => {
        comicPageKeys.current.set(0, key);
        if (coverRun.current === run) setCoverArt({ url, loading: false, error: false });
      })
      .catch(() => { if (coverRun.current === run) setCoverArt({ loading: false, error: true }); });
  };

  useEffect(() => {
    comicPageKeys.current = new Map();
    markComicSaved(false);
    coverRun.current += 1;
    setCoverArt({ loading: false, error: false });
    // With a hero the book opens on its cover; without one there is no cover to
    // show and the reader opens on beat 1 exactly as before.
    setOnCover(Boolean(activeStory && render && heroAvatarUrl));
    if (!activeStory || !render || !heroAvatarUrl) return;
    drawCover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStory?.id, heroAvatarUrl, aiLang]);

  const coverPageArgs = () => activeStory && render && heroAvatarUrl ? {
    storyId: activeStory.id,
    lang: aiLang,
    heroName: childProfile.name?.split(" ")[0] ?? "",
    heroDataUrl: heroAvatarUrl,
    style: heroAvatarStyle,
    childId: childProfile.id,
    childIdentity: childProfile.id,
    pageIndex: 0,
    cover: true as const,
    title: render.title || activeStory.title,
    theme: `${render.title || activeStory.title} — ${activeStory.theme}`,
    sfx: [] as string[],
  } : undefined;

  const saveStoryAsComic = async () => {
    if (!activeStory || !render || !heroAvatarUrl) return;
    const expected = 1 + scenes.filter((scene) => scene.imagePrompt).length;
    // A cover that failed at story start gets ONE more try at the end (bounded:
    // one call), so a single busy moment does not cost the child their book.
    if (!comicPageKeys.current.has(0)) {
      const cover = coverPageArgs();
      if (cover) await generateJourneyPage(cover).then(({ key }) => comicPageKeys.current.set(0, key)).catch(() => {});
    }
    const keys = [...comicPageKeys.current.entries()].sort((a, b) => a[0] - b[0]).map(([, key]) => key);
    if (keys.length !== expected) return; // incomplete art → no shelf entry (never a book that cannot open)
    await savedComicsCol.upsert(toSavedComicMeta({
      id: activeStory.id,
      adventureId: activeStory.id,
      title: render.title || activeStory.title,
      lang: aiLang,
      pageUrls: [],
      createdAt: new Date().toISOString(),
      pageKeys: keys,
    }));
    markComicSaved(true);
  };

  const finishJourney = async () => {
    if (!activeStory || !render || finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
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
    try {
      await runsCol.upsert(run);
      await saveStoryAsComic().catch(() => { /* the story itself is saved; the shelf entry is best-effort */ });
      // M2: one saved state, two registers. The child hears "your comic is on
      // your shelf" (kid copy, rendered below); the parent gets the same fact
      // in parent copy. Neither register borrows the other's words.
      const shelved = comicSavedRef.current;
      // N1-01-R5: a finished story is one completed kid activity. A COUNT — the
      // story, its title and the child's choice never leave this function.
      // A no-op outside Kid Mode.
      noteKidActivity();
      setSaved(true);
      celebrate({ kind: "complete" });
      if (!kidMode) {
        toast(
          shelved
            ? (aiLang === "he" ? "המסע הושלם — הסיפור נשמר והקומיקס על המדף" : "Journey complete — story saved and the comic is on the shelf")
            : (aiLang === "he" ? "המסע הושלם — הסיפור נשמר" : "Journey complete — story saved"),
          "success",
        );
      }
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
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
    setFinishing(false);
    finishingRef.current = false;
  };

  const exitJourney = () => {
    setActiveStory(null);
    setRender(null);
    setImmersive(false);
    setFinishing(false);
    finishingRef.current = false;
  };

  // ── Shared player pieces ───────────────────────────────────────────────────
  const renderChoices = () =>
    isDecision &&
    !choiceId && (
      <div className="space-y-2 w-full max-w-xl mx-auto">
        <p className="text-[11px] uppercase tracking-widest font-bold text-center" style={{ color: "var(--arbor-green-ink)" }}>
          {kidsStoriesText("journey.decision", aiLang, { name: childProfile.name })}
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
  // M2: the cover is a PAGE, not a beat. It sits before beat 1 and the counter
  // says so ("Cover", then "1 / 8") — the eight beats keep their own numbers.
  const hasCoverPage = Boolean(heroAvatarUrl);
  const atFirstPage = onCover || (sceneIndex === 0 && !hasCoverPage);
  const goBack = () => {
    if (onCover) return;
    if (sceneIndex === 0) { if (hasCoverPage) setOnCover(true); return; }
    setSceneIndex((i) => Math.max(0, i - 1));
  };
  // Turning off the cover never waits for its art: a cover still drawing is a
  // framed loading page the child can read past.
  const goNext = () => {
    if (onCover) { setOnCover(false); return; }
    if (canAdvance) setSceneIndex((i) => Math.min(scenes.length - 1, i + 1));
  };
  const renderNav = () => (
    <div className="flex items-center justify-between w-full max-w-xl mx-auto pt-2">
      <button
        onClick={goBack}
        disabled={atFirstPage}
        className="touch-target disabled:opacity-30 flex items-center gap-1 text-sm"
        style={{ color: "var(--arbor-muted)" }}
      >
        <Icon name="chevron_left" size={16} /> {kidsStoriesText("journey.back", aiLang)}
      </button>
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--arbor-faint)" }}>
        {onCover
          ? kidsStoriesText("journey.cover", aiLang)
          : activeStory && `${sceneIndex + 1} / ${activeStory.beats.length}`}
      </span>
      {onCover || sceneIndex < scenes.length - 1 ? (
        <button
          onClick={goNext}
          disabled={!onCover && !canAdvance}
          className="touch-target disabled:opacity-30 flex items-center gap-1 text-sm font-bold"
          style={{ color: "var(--arbor-green-ink)" }}
        >
          {kidsStoriesText("journey.next", aiLang)} <Icon name="chevron_right" size={16} />
        </button>
      ) : (
        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "var(--arbor-green-ink)" }}>{kidsStoriesText("journey.end", aiLang)}</span>
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
    const ageCandidates = showAllAges ? orderedStories : ageVisibleStories;
    // OBJ-KID-05 / KID-25: the kid home's "Today's adventure" banner names ONE
    // story. Pin the catalog to it — but only after the age view has run, so a
    // child the canon is not written for still gets the honest empty state
    // rather than a story meant for someone else (W0.7 is not bypassed).
    const pinned = initialStoryId ? ageCandidates.find((s) => s.id === initialStoryId) : undefined;
    const displayStories = pinned ? [pinned] : ageCandidates;
    // §3f row 3 — tonight's ONE story for the parent door. Same helper, same
    // local day key and same per-child seed the kid home uses (KidDashboard),
    // so both surfaces name the same story all day. A pinned request (the kid
    // banner deep-link) wins; otherwise the day pick, and only if it survives
    // this surface's own age view — never a story written for another age.
    const tonightId = pinned?.id ?? chooseTonightsStory(dayKey(new Date()), childProfile.id);
    const tonightStory = ageCandidates.find((x) => x.id === tonightId) ?? ageCandidates[0];
    const tonightArt = (tonightStory && STORY_ART[tonightStory.id]) ?? { emoji: "⭐", sfx: "POW!", sfxHe: "פאו!" };
    const hiddenAgeMin = ageHiddenStories.length
      ? Math.min(...ageHiddenStories.map((s) => s.ageRange[0]))
      : null;
    const hiddenAgeMax = ageHiddenStories.length
      ? Math.max(...ageHiddenStories.map((s) => s.ageRange[1]))
      : null;
    // IA-08 / RUN-12 (law 2): #/stories is ONE route with two audiences. The
    // comic wash (`.arbor-play`) is the child's register and mounts only while
    // Kid Mode is on; the parent standing at the door gets the parent register
    // — kit spacing, no play wash. The catalogue body itself is shared.
    // §3f rows 3–4 / IA-08: the two registers now differ in CONTENT, not only
    // in the wrapper. Kid Mode keeps the comic academy (crest, mascot, world
    // grid). The parent door opens on ONE cover for tonight, with the shelf and
    // the library below it as their own modules (moduleBudget 3).
    return kidMode ? (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="arbor-play space-y-6"
      >
        {/* HERO BANNER — the child fronts their own story academy. KID-29
            residue: the "N stories done" chip and the six virtue counters used
            to sit here, on the CHILD's banner — a running tally is a
            measurement of the child rendered in front of them (laws 1 + 3).
            They are counts a PARENT reads, so they moved to the parent door's
            counts line. The kid banner is the crest and the name. */}
        <section className="comic-panel p-5 sm:p-6 flex items-center gap-4 sm:gap-5" aria-label={he ? "הגיבור שלך" : "Your hero"}>
          <HeroCrest size={92}>
            <HeroAvatar size={92} mood="cheer" />
          </HeroCrest>
          <div className="flex-1 min-w-0">
            <h1 className="font-black leading-none truncate" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px,5vw,38px)" }} dir="auto">
              {he ? `מסעות הגיבור של ${isolate(name)}` : `${isolate(name)}'s Story Quests`}
            </h1>
            {charter.length > 0 && (
              <p className="text-[12.5px] font-bold mt-1.5" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
                {he ? `מגדלים את ${isolate(name)} לקראת: ${charter.join(" · ")}` : `Raising ${isolate(name)} toward: ${charter.join(" · ")}`}
              </p>
            )}
          </div>
        </section>

        {/* SPROUT COACH BUBBLE */}
        <div className="flex items-end gap-3">
          <ArborMascot size={50} mood="wave" animate className="flex-shrink-0" />
          <div className="comic-panel px-4 py-3 text-[14px] font-extrabold" dir="auto">
            {he ? `${isolate(name)}, הפכו לגיבור של כל סיפור!` : `Pick a story, hero — ${isolate(name)} stars in every one!`}
          </div>
        </div>

        {/* §3f row 3: the Hero Comics and Family Formation tiles used to sit
            here. Both were wrapped in `{kidNav && …}` — and `useKidSafeNav()`
            returns null INSIDE Kid Mode — so they only ever rendered on the
            PARENT door, where Hero Comics duplicated the hub's own pill (it is
            `stories.tools`) and Family Formation duplicates the Learn hub's.
            Two extra doors above the first story card, neither of them this
            surface's job. Deleted; both routes keep their own hub pill, so
            nothing became unreachable (routeReachability.test.ts). */}

        {/* PACK FILTER — comic chips. Absent while the catalog is pinned to
            tonight's single story: there is nothing to filter. */}
        {!pinned && (
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
        )}

        {/* G1 hero-first (22 Sep 2026): a child without a generated hero gets one
            parent-side step here, never a story starring the raw photo. */}
        {!kidMode && (!childProfile.avatar ? (
          <PlayPanel tone="lav" className="text-center mb-4" data-testid="hero-first-gate">
            <p className="text-[1.15rem] font-extrabold mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
              {he ? `קודם כול, צרו את הגיבור של ${isolate(heroName)}` : `First, create ${isolate(heroName)}'s hero`}
            </p>
            <p className="text-sm mb-4 max-w-md mx-auto" style={{ color: "var(--arbor-muted)" }} dir="auto">
              {he
                ? `הסיפורים מצוירים סביב הדמות המאוירת של ${heroName} — לא סביב תמונה אמיתית.`
                : `Stories are drawn around ${isolate(heroName)}'s illustrated character — never around a real photo.`}
            </p>
            <PlayButton tone="clay" onClick={() => setActiveTab("profile")}>
              <Icon name="auto_awesome" size={16} /> {he ? `צרו את הגיבור של ${isolate(heroName)}` : `Create ${isolate(heroName)}'s hero`}
            </PlayButton>
          </PlayPanel>
        ) : null)}
        {/* STORY WORLDS — each card is an illustrated world starring the hero */}
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3">
            <h2 className="font-black" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px,3.4vw,24px)" }} dir="auto">
              {kidMode ? (he ? "בחרו את הסיפור שלכם" : "Choose your story") : t("elev.stories.catalogue.title")}
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
          {/* OBJ-KID-04 — a failed generate ANSWERS the child, inside
              `.arbor-play`, in the kid register. role=status so the line is
              announced; the tapped card is already back in its idle state
              (setLoadingId(null) in the finally), so a second tap retries. */}
          {storyResting && (
            <div role="status" aria-live="polite" className="mb-3">
              <MascotSay mood="think" tone="yellow">{t("elev.play.hero.rest")}</MascotSay>
            </div>
          )}
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
                      className="absolute top-0 z-[2] text-[10.5px] font-black px-2.5 py-1 inline-flex items-center gap-1"
                      style={{ background: "var(--arbor-yellow)", color: "var(--arbor-ink)", border: "var(--comic-line)", insetInlineStart: 0, borderStartStartRadius: "var(--play-radius)", borderEndEndRadius: "12px" }}
                    >
                      ★ {he ? "המטרה שלכם" : "Your aim"}
                    </span>
                  ) : story.origin === "original" ? (
                    <span
                      className="absolute top-0 z-[2] text-[11px] font-black text-white px-2.5 py-1"
                      style={{ background: "var(--arbor-pink-ink)", border: "var(--comic-line)", insetInlineStart: 0, borderStartStartRadius: "var(--play-radius)", borderEndEndRadius: "12px" }}
                    >
                      {he ? "מקורי" : "ORIGINAL"}
                    </span>
                  ) : null}
                  {/* Scene: the hero standing in this story's world */}
                  <div className="comic-halftone relative overflow-hidden" style={{ height: 150, background: w.bg, borderBottom: "var(--comic-line)" }}>
                    {/* The story's world, with the child's hero generated into the scene
                        (same pipeline as the Practice world-cards). Falls back to the
                        hero + emoji motif while loading / with no hero / on error. */}
                    <WorldScene worldId={`story-${story.id}`} imagePrompt={`${story.title} — ${story.theme}`} heroUrl={heroAvatarUrl} heroStyle={heroAvatarStyle}>
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
            <Icon name="auto_stories" size={20} /> {kidMode ? (he ? `הספרייה (${runs.length})` : `Library (${runs.length})`) : `${t("elev.stories.library.title")} (${runs.length})`}
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
    ) : (
      <div className="space-y-6 max-w-[1100px]">
        <PageHeader
          title={t("nav.tab.stories")}
          subtitle={t("elev.stories.sub", { name })}
        />
        {/* §3f row 3 — ONE dominant cover, above the fold. The parent door used
            to open on a comic hero banner, a mascot bubble in the kid's voice,
            two in-hub tiles and a filter row, so the FIRST story card rendered
            at 1,151 px: an evening surface that made you scroll past four
            things before it offered a story. chooseTonightsStory() (built for
            the kid home in 02e04b42, reused verbatim) already picks ONE story
            per local day, so the kid banner and this cover name the same one. */}
        <section data-module="stories-tonight">
          <button
            type="button"
            data-primary-move="read-tonights-story"
            onClick={() => { if (!loadingId && tonightStory) void startJourney(tonightStory); }}
            disabled={!tonightStory || !!loadingId}
            aria-label={tonightStory ? (he ? tonightStory.titleHe : tonightStory.title) : undefined}
            className={`${cardCls} w-full text-start overflow-hidden p-0 transition motion-safe:hover:-translate-y-0.5 disabled:opacity-60`}
          >
            <span
              className="grid place-items-center w-full"
              style={{ height: 168, background: tonightStory ? PACK_WORLD[tonightStory.pack].bg : "var(--arbor-paper-deep)" }}
            >
              <span className="flex items-center gap-3">
                <HeroAvatar size={92} ring animate={false} />
                <span style={{ fontSize: 56 }} aria-hidden="true">{tonightArt.emoji}</span>
              </span>
            </span>
            <span className="block p-5">
              <span className="block text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--arbor-muted)" }}>
                {t("elev.stories.tonight.eyebrow")}
              </span>
              <span className="block text-[1.35rem] font-extrabold leading-tight mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
                {tonightStory ? (he ? tonightStory.titleHe : tonightStory.title) : t("elev.stories.catalogue.title")}
              </span>
              <span className="flex flex-wrap items-center gap-2 mt-3">
                {tonightStory && (
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: "var(--arbor-paper-deep)", color: PACK_WORLD[tonightStory.pack].ink }}>
                    {he ? PACK_WORLD[tonightStory.pack].labelHe : PACK_WORLD[tonightStory.pack].label}
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 min-h-[44px] text-[13px] font-extrabold ms-auto"
                  style={{ background: "var(--gradient-cta, var(--arbor-clay))", color: "var(--arbor-subtab-on-ink)" }}
                >
                  {tonightStory && loadingId === tonightStory.id
                    ? <><Icon name="autorenew" size={16} className="motion-safe:animate-spin" /> {statesText("elev.states.hero.opening", he)}</>
                    : <><Icon name="play_arrow" size={16} fill={1} /> {t("elev.stories.tonight.cta")}</>}
                </span>
              </span>
            </span>
          </button>
        </section>

        {/* RUN-08 — the counts that used to be a chip reading "0 stories done"
            plus six virtue counters all showing 0 on day 0: a wall of zeros on
            the first evening. One quiet line, rendered only once there IS
            something to count. Counts, never verdicts (law 1). */}
        {(runs.length > 0 || METRIC_IDS.some((m) => totalMetrics[m] > 0)) && (
          <p className="text-[11.5px] px-1 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: "var(--arbor-muted)" }}>
            {runs.length > 0 && <span>{t("elev.stories.counts.stories", { n: runs.length })}</span>}
            {METRIC_IDS.filter((m) => totalMetrics[m] > 0).map((m) => (
              <span key={m} className="inline-flex items-center gap-1">
                <span aria-hidden="true">{METRIC_EMOJI[m]}</span>
                {METRIC_LABELS[m]} {totalMetrics[m]}
              </span>
            ))}
          </p>
        )}

        <section data-module="stories-catalogue" className="space-y-6">
        {/* PACK FILTER — comic chips. Absent while the catalog is pinned to
            tonight's single story: there is nothing to filter. */}
        {!pinned && (
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
        )}

        {/* G1 hero-first (22 Sep 2026): a child without a generated hero gets one
            parent-side step here, never a story starring the raw photo. */}
        {!kidMode && (!childProfile.avatar ? (
          <PlayPanel tone="lav" className="text-center mb-4" data-testid="hero-first-gate">
            <p className="text-[1.15rem] font-extrabold mb-1" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
              {he ? `קודם כול, צרו את הגיבור של ${isolate(heroName)}` : `First, create ${isolate(heroName)}'s hero`}
            </p>
            <p className="text-sm mb-4 max-w-md mx-auto" style={{ color: "var(--arbor-muted)" }} dir="auto">
              {he
                ? `הסיפורים מצוירים סביב הדמות המאוירת של ${heroName} — לא סביב תמונה אמיתית.`
                : `Stories are drawn around ${isolate(heroName)}'s illustrated character — never around a real photo.`}
            </p>
            <PlayButton tone="clay" onClick={() => setActiveTab("profile")}>
              <Icon name="auto_awesome" size={16} /> {he ? `צרו את הגיבור של ${isolate(heroName)}` : `Create ${isolate(heroName)}'s hero`}
            </PlayButton>
          </PlayPanel>
        ) : null)}
        {/* STORY WORLDS — each card is an illustrated world starring the hero */}
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3">
            <h2 className="font-black" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px,3.4vw,24px)" }} dir="auto">
              {kidMode ? (he ? "בחרו את הסיפור שלכם" : "Choose your story") : t("elev.stories.catalogue.title")}
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
          {/* OBJ-KID-04 — a failed generate ANSWERS the child, inside
              `.arbor-play`, in the kid register. role=status so the line is
              announced; the tapped card is already back in its idle state
              (setLoadingId(null) in the finally), so a second tap retries. */}
          {storyResting && (
            <div role="status" aria-live="polite" className="mb-3">
              <MascotSay mood="think" tone="yellow">{t("elev.play.hero.rest")}</MascotSay>
            </div>
          )}
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
                      className="absolute top-0 z-[2] text-[10.5px] font-black px-2.5 py-1 inline-flex items-center gap-1"
                      style={{ background: "var(--arbor-yellow)", color: "var(--arbor-ink)", border: "var(--comic-line)", insetInlineStart: 0, borderStartStartRadius: "var(--play-radius)", borderEndEndRadius: "12px" }}
                    >
                      ★ {he ? "המטרה שלכם" : "Your aim"}
                    </span>
                  ) : story.origin === "original" ? (
                    <span
                      className="absolute top-0 z-[2] text-[11px] font-black text-white px-2.5 py-1"
                      style={{ background: "var(--arbor-pink-ink)", border: "var(--comic-line)", insetInlineStart: 0, borderStartStartRadius: "var(--play-radius)", borderEndEndRadius: "12px" }}
                    >
                      {he ? "מקורי" : "ORIGINAL"}
                    </span>
                  ) : null}
                  {/* Scene: the hero standing in this story's world */}
                  <div className="comic-halftone relative overflow-hidden" style={{ height: 150, background: w.bg, borderBottom: "var(--comic-line)" }}>
                    {/* The story's world, with the child's hero generated into the scene
                        (same pipeline as the Practice world-cards). Falls back to the
                        hero + emoji motif while loading / with no hero / on error. */}
                    <WorldScene worldId={`story-${story.id}`} imagePrompt={`${story.title} — ${story.theme}`} heroUrl={heroAvatarUrl} heroStyle={heroAvatarStyle}>
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

        </section>

        <section data-module="stories-library">
        {/* JOURNEY LIBRARY */}
        <div>
          <h2 className="font-black mb-3 inline-flex items-center gap-2" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px,3.4vw,24px)" }}>
            <Icon name="auto_stories" size={20} /> {kidMode ? (he ? `הספרייה (${runs.length})` : `Library (${runs.length})`) : `${t("elev.stories.library.title")} (${runs.length})`}
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
        </section>
      </div>
    );
  }

  // ── Player view ────────────────────────────────────────────────────────────
  // M2: the opening page of the book. Same ComicPage primitive the beats use
  // (frame, page-flip, loading, smudged + Redraw); no page number, because the
  // cover is not one of the eight beats. The title the model lettered into the
  // art is repeated as text so the page still names the story while the art is
  // drawing, smudged, or read by a screen reader.
  const coverPage = (immersiveMode: boolean) => (
    <div className="flex flex-col items-center text-center gap-5">
      <span className="text-[11px] uppercase tracking-widest font-bold" style={{ color: "var(--arbor-green-ink)" }}>
        {kidsStoriesText("journey.cover", aiLang)}
      </span>
      <AnimatePresence mode="wait">
        <ComicPage
          key="journey-cover"
          src={coverArt.url}
          alt={kidsStoriesText("journey.coverAlt", aiLang, { title: render.title || activeStory.title })}
          loading={!coverArt.url && coverArt.loading}
          error={!coverArt.url && !coverArt.loading && coverArt.error}
          rtl={uiLang === "he"}
          contentFit="contain"
          onImageError={() => setCoverArt({ loading: false, error: true })}
          onRetry={drawCover}
          errorLabel={kidsStoriesText("page.smudged", aiLang)}
          retryLabel={kidsStoriesText("page.redraw", aiLang)}
          loadingLabel={kidsStoriesText("page.drawing", aiLang)}
        />
      </AnimatePresence>
      {/* S4: the badge labels GENERATED art only — a cover that is still
          drawing or smudged has no art to attribute. */}
      {coverArt.url && <ProvenanceBadge lang={uiLang === "he" ? "he" : "en"} className="-mt-2" />}
      <h3
        dir="auto"
        className={`font-extrabold tracking-tight ${immersiveMode ? "text-xl" : "text-lg"}`}
        style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display), Georgia, serif" }}
      >
        {render.title || activeStory.title}
      </h3>
    </div>
  );

  const playerBody = (immersiveMode: boolean) => (
    <div className="space-y-6">
      {onCover && coverPage(immersiveMode)}
      {!onCover && displayScene && (
        <HeroScenePlayer
          scene={displayScene}
          seed={`${activeStory.id}-${displayScene.beatId}-${childProfile.name}`}
          beatNumber={sceneIndex + 1}
          beatTotal={activeStory.beats.length}
          photoUrl={photoUrl}
          heroAvatarUrl={heroAvatarUrl}
          heroAvatarStyle={heroAvatarStyle}
          heroName={childProfile.name?.split(" ")[0]}
          childIdentity={childProfile.id}
          childId={childProfile.id}
          onPageResolved={({ beatNumber, key }) => comicPageKeys.current.set(beatNumber, key)}
          immersive={immersiveMode}
          fallbackArtUrl={STORY_ART[activeStory.id]?.src}
        />
      )}

      {!onCover && renderChoices()}

      {/* Reflection / completion */}
      {!onCover && isReflection && (
        <div className="w-full max-w-xl mx-auto space-y-4">
          {kidMode ? (
            <div className="rounded-2xl p-4 space-y-3 text-center" style={{ background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.25)" }}>
              <p className="font-black" style={{ color: "var(--arbor-green-ink)" }}>{kidsStoriesText("journey.childEndingTitle", aiLang)}</p>
              <p className="text-sm" style={{ color: "var(--arbor-ink-soft)" }}>{kidsStoriesText("journey.childEndingBody", aiLang)}</p>
              {comicSaved && <p className="text-sm font-black" style={{ color: "var(--arbor-green-ink)" }} data-testid="journey-comic-saved">{kidsStoriesText("journey.comicSaved", aiLang)}</p>}
              {render.reflection.questions[0] && (
                <button
                  type="button"
                  aria-expanded={Boolean(questionsChecked[0])}
                  onClick={() => setQuestionsChecked((state) => ({ ...state, 0: !state[0] }))}
                  className="w-full rounded-xl p-3 text-start"
                  style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
                >
                  <span className="block text-xs font-black">{kidsStoriesText("journey.childReflection", aiLang)}</span>
                  {questionsChecked[0] && <span dir="auto" className="mt-2 block text-sm">{render.reflection.questions[0]}</span>}
                </button>
              )}
            </div>
          ) : (
            <>
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
                    <span key={i} className="text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1" style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-paper-elevated)" }}>
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
                    onClick={() => setQuestionsChecked((state) => ({ ...state, [i]: !state[i] }))}
                    className="w-full text-start p-2.5 rounded-xl transition flex items-start gap-2"
                    style={questionsChecked[i]
                      ? { background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.30)", color: "var(--arbor-green-ink)" }
                      : { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
                  >
                    <span className="mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-white" style={{ background: questionsChecked[i] ? "var(--arbor-clay)" : "var(--arbor-rule-strong)" }}>
                      {questionsChecked[i] && <Icon name="check" size={12} />}
                    </span>
                    <span dir="auto" className="text-xs">{q}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {!saved ? (
            <button
              onClick={finishJourney}
              disabled={finishing}
              className="w-full py-3 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98]"
              style={{ background: T.gradientCta }}
            >
              <Icon name="emoji_events" size={16} /> {kidMode
                ? kidsStoriesText("journey.finish", aiLang)
                : aiLang === "he" ? `סיימו ושמרו את הסיפור של ${isolate(childProfile.name)}` : `Finish & save ${isolate(childProfile.name)}'s story`}
            </button>
          ) : kidMode ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-sm font-bold inline-flex items-center gap-2" style={{ color: "var(--arbor-green-ink)" }}>
                <Icon name="check" size={16} /> {kidsStoriesText("journey.saved", aiLang)}
              </span>
              <button type="button" onClick={exitJourney} className="touch-target min-h-[44px] rounded-xl px-4 text-sm font-black" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}>
                {kidsStoriesText("journey.backStories", aiLang)}
              </button>
            </div>
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
        {/* §3f row 4 — these two measured 20 px and 16 px tall: the way out of a
            story and the way into full screen, both under the touch floor. Both
            now clear 44 px, and both are keyed (they were English literals). */}
        <button
          onClick={exitJourney}
          className="inline-flex items-center gap-1.5 text-sm font-bold px-2 min-h-[44px]"
          style={{ color: "var(--arbor-muted)" }}
        >
          <Icon name="arrow_back" size={16} style={uiLang === "he" ? { transform: "scaleX(-1)" } : undefined} /> {t("elev.stories.reader.back")}
        </button>
        <span className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{render.title}</span>
        <button
          ref={immersiveTriggerRef}
          onClick={() => setImmersive(true)}
          className="inline-flex items-center gap-1.5 text-sm font-bold px-2 min-h-[44px]"
          style={{ color: "var(--arbor-muted)" }}
          aria-label={t("elev.stories.reader.immersive")}
        >
          <Icon name="fullscreen" size={16} /> <span className="hidden sm:inline">{t("elev.stories.reader.immersive")}</span>
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
