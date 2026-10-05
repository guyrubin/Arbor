import { createPortal } from "react-dom";
import { useDialog } from "../../hooks/useDialog";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { celebrate } from "../../lib/celebrate";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { latestNotedMoment } from "../../lib/bedtimeStories";
import { storyBuildsShort } from "../../lib/storyBuildsShort";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { api } from "../../lib/api";
import { normalizeAvatarStyle } from "../../lib/avatarStyle";
import { isolate } from "../../lib/i18n";
import { isolateNameIn, langDir } from "../../lib/bidi";
import {
  HERO_STORIES,
  PACKS,
  applyChoice,
  getStorySpec,
  runTitle,
  storiesForLanguage,
  storiesInPack,
  storyHasLanguage,
  storyLanguage,
} from "../../lib/heroJourneys";
import type {
  DevelopmentMetricId,
  HeroChoiceRender,
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
import { STORY_COMIC, clearJourneyPageFailure, generateJourneyPage, journeyPageKey, shelveBookPages, toSavedComicMeta, type SavedComicMeta } from "../../lib/heroComics";
import { useKidSafeNav } from "../kidmode/useKidSafeNav";
import { isKidModeActive, noteKidActivity, subscribeKidMode } from "../../lib/kidModeGate";
import { ComicPage, MascotSay, usePrefersReducedMotion } from "../ui/playkit";
import { EmptyState } from "../ui/EmptyState";
import { SectionSkeleton } from "../ui/Skeleton";
import { statesText } from "../../lib/i18nElevation/states";
import { HeroAvatar, resolveHeroUrl } from "../ui/HeroAvatar";
import HeroCreateDialog from "../profile/HeroCreateDialog";
import TonightFromToday from "../stories/TonightFromToday";
import { consumeTonightMode, type TonightMode } from "../../lib/tonightMode";
import WorldScene from "../practice/WorldScene";
import { useKidTheme } from "../../hooks/useKidTheme";
import { kidArt, storyCoverKey } from "../../lib/kidThemeManifest";
import { setKidSurfaceTitle } from "../kidmode/kidSurfaceTitle";
import { pickTonightsStory, TONIGHT_AIM_REASON_KEY } from "../kidmode/tonightsStory";
import { dayKey } from "../../practice/signals";
import { PageHeader, cardCls } from "../ui/kit";
import { T, METRIC_VARS } from "../../lib/tokens";
import { fmtDay } from "../../lib/formatDate";
import { kidsStoriesText } from "../../lib/i18nElevation/kidsStories";
import { authoredChoice, authoredScene, completeRender, type StoryHero } from "../../lib/heroJourneyRender";
import KidLibrary from "../kidmode/KidLibrary";
import { kidBookOpenable, kidBooks } from "../kidmode/kidBooks";
import { adoptSavedRender, getSavedRender, hydrateHeroRenders, renderSignature, resolvePersonalisedRender, type SavedHeroRender } from "../../lib/heroRenderStore";
import { KidBookTitleCard } from "../kidmode/KidBookCover";
import { autoReadPage } from "../kidmode/kidReadAloud";
import { kidSfx } from "../kidmode/audio/kidAudio";
import { KidFinishMoment } from "../kidmode/rewards/KidSouvenir";
import { stopVoice } from "../../lib/voice";
import { KID_BOOK_ART_CLASS, KID_BOOK_SIDE_CLASS, KID_BOOK_SPREAD_CLASS } from "../stories/HeroScenePlayer";
import { DecisionChoices } from "../stories/DecisionChoices";

/** Comic-world skin per pack — bg + ink token + bilingual label (matches the
 *  Hero Arcade design layer so the Academy reads as the same comic universe). */
/** W2-SHELLPLAY critic r1: the parent cover's art band — the pack's -soft
 *  tint (the saturated PACK_WORLD.bg is the kid register's). */
const PACK_SOFT: Record<HeroPackId, string> = {
  courage: "var(--arbor-peach-soft)",
  responsibility: "var(--arbor-yellow-soft)",
  growth: "var(--arbor-clay-soft)",
  wisdom: "var(--arbor-sky-soft)",
  truth: "var(--arbor-lav-soft)",
};

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
  "the-lantern-path": { emoji: "🏮", sfx: "GLOW!", sfxHe: "זוהר!" },
  "the-cloud-orchestra": { emoji: "🎼", sfx: "BOOM!", sfxHe: "בום!" },
  "the-little-bridge-builders": { emoji: "🌉", sfx: "CLICK!", sfxHe: "קליק!" },
};

/** Immediate, authored, provider-free render. Used only when the personalized
 * route is unavailable; preserves all eight beats, localized copy and exact
 * authored choice consequences without adding any generation. */
export function authoredJourneyRender(story: HeroStorySpec, lang: "en" | "he", artTheme?: string, hero?: StoryHero): HeroJourneyRender {
  const he = lang === "he";
  const decision = story.beats.find((beat) => beat.id === "decision");
  return {
    storyId: story.id,
    title: he ? story.titleHe : story.title,
    // B-KID-76 (a): the authored words name the child as the hero.
    scenes: story.beats.map((beat) => authoredScene(beat, lang, artTheme, hero)),
    choices: (decision?.choices ?? []).map((choice) => authoredChoice(choice, lang, hero)),
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

/** Remember today's personalised render (key carries the story language). */
export function rememberJourney(key: string, render: HeroJourneyRender): void {
  journeyMemo.set(key, render);
}

/** B-KID-121: a saved run is restored only in the language it was written in.
 *  A story read in English and reopened with the app in Hebrew does not show
 *  the English run: the book opens in Hebrew (authored text at once in Kid
 *  Mode, a new personalised run requested as usual). */
export function runRestorable(run: { language?: string }, storyLang: "en" | "he"): boolean {
  return (run.language === "he" ? "he" : "en") === storyLang;
}

/**
 * B-KID-124 (B-KID-10, P0) — what a Kid Mode book opens on, AT ONCE: today's
 * personalised render when it is already memoised, else the authored text in
 * the story language (the child named by nameTheHero). Never a network call:
 * the child tapped a cover and must see that book in the same frame, not the
 * "My books" grid for the ~7 s the model takes.
 */
/** B-KID-124: the reader's pin identity - the story id AND the overlay's per-tap
 *  nonce, so a second book, or the same book tapped again, is a new pin. */
export function kidPinKey(storyId: string, nonce: number): string {
  return `${storyId}#${nonce}`;
}

/** B-KID-124: a personalised render that arrives late replaces the authored
 *  words only for the SAME open, while the child is still on the first page
 *  (no Next, Back or choice yet) and the page is not being read aloud. */
export function kidLateRenderApplies(s: { openSeq: number; requestSeq: number; pageMoved: boolean; narrationSpoken: boolean }): boolean {
  return s.openSeq === s.requestSeq && !s.pageMoved && !s.narrationSpoken;
}

export function kidBookOpening(
  story: HeroStorySpec,
  childId: string,
  lang: "en" | "he",
  artTheme: string | undefined,
  hero: StoryHero,
  day: string,
): { render: HeroJourneyRender; personalised: boolean } {
  // B-KID-127: the child's KEPT render for this story + language comes first
  // (no day in its key: a story written for a child is never written twice).
  const kept = getSavedRender(childId, story.id, lang, renderSignature(hero.name?.split(" ")[0] ?? "", story));
  if (kept) return { render: kept, personalised: true };
  const memoed = journeyMemo.get(journeyMemoKey(childId, story.id, lang, day));
  return memoed ? { render: memoed, personalised: true } : { render: authoredJourneyRender(story, lang, artTheme, hero), personalised: false };
}

const METRIC_COLORS: Record<DevelopmentMetricId, string> = METRIC_VARS;


export default function HeroJourneyTab({ initialStoryId, pinNonce = 0 }: {
  initialStoryId?: string;
  /** B-KID-124: a fresh value on every tap of a cover, so the SAME book tapped
   *  again (after Home) opens again even when this tab stayed mounted. */
  pinNonce?: number;
} = {}) {
  const { childProfile, behaviorLogs } = useArbor();
  // B-PLAY-15: the hero-first gate opens the shared create dialog in place.
  const [heroDialogOpen, setHeroDialogOpen] = useState(false);
  // B-PLAY-14: the Tonight cover's two options. The evening entry points ask
  // for "today" through lib/tonightMode (one-shot); otherwise the hero story.
  // W2-SHELLPLAY critic r2: the default stays the cover (it carries the route's
  // one stamp); with no hero, the cover's FIRST act is the in-place hero row in
  // its art band, Play second — and the shell drops "starring".
  const [tonightMode, setTonightMode] = useState<TonightMode>(() => consumeTonightMode() ?? "hero");
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
  // B-KID-127: the child's personalised renders, kept per story + language
  // (account copy; the device copy is lib/heroRenderStore). Text only.
  const rendersCol = useChildCollection<SavedHeroRender>(childProfile.id, "heroRenders");
  useEffect(() => { void hydrateHeroRenders(childProfile.id); }, [childProfile.id]);
  useEffect(() => {
    for (const doc of rendersCol.items) adoptSavedRender({ ...doc, childId: childProfile.id });
  }, [rendersCol.items, childProfile.id]);
  /** B-KID-127: kept render (device, then account), else ONE generation that is kept. */
  const personalisedFor = (story: HeroStorySpec, lang: "en" | "he", fresh = false) => resolvePersonalisedRender({
    childId: childProfile.id,
    story,
    lang,
    firstName: childProfile.name?.split(" ")[0] ?? "",
    remote: rendersCol.items,
    generate: () => api.generateHeroJourney({ storyId: story.id, childName: childProfile.name, age: childProfile.age, language: lang }),
    persistRemote: (doc) => { void rendersCol.upsert(doc).catch(() => { /* the device copy stands */ }); },
    fresh,
  });
  const runs = runsCol.items;
  // B-KID-46 (KB-03): the language a story is told in. A story that cannot be
  // told in it (no Hebrew beats) is not listed — catalogue, Tonight pick and
  // the Library shelf alike; the pick's order is language → age → illustrated.
  const storyLang = storyLanguage(uiLang, aiLang);
  const isTellable = (storyId: string) => {
    const spec = getStorySpec(storyId);
    return !spec || storyHasLanguage(spec, storyLang);
  };
  const shelfRuns = runs.filter((r) => isTellable(r.storyId));
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
  // B-KID-124: a pinned book in Kid Mode is open on the FIRST paint - the
  // authored text (or today's memoised personalised run) in the story language,
  // never the catalogue grid while a model call runs. Computed once per mount.
  // B-KID-121: a book is told in the STORY language (Hebrew when the UI or the
  // story language is Hebrew) - the same language that lists it - so a Hebrew
  // UI never opens an English run.
  const kidTellLang: "en" | "he" = storyLang;
  const kidArtTheme = (story: HeroStorySpec) =>
    childProfile.avatar && (childProfile as unknown as { photoUrl?: string }).photoUrl?.startsWith("data:") ? (STORY_COMIC[story.id]?.theme ?? story.theme) : undefined;
  const kidPinInit = useRef<{ story: HeroStorySpec; refused: boolean; render?: HeroJourneyRender; personalised?: boolean; lang: "en" | "he" } | null | undefined>(undefined);
  if (kidPinInit.current === undefined) {
    const story = isKidModeActive() && initialStoryId ? getStorySpec(initialStoryId) : undefined;
    if (!story) kidPinInit.current = null;
    else if (!kidBookOpenable(story, { lang: storyLang, ageMonths: ageMonthsFromProfile(childProfile), showAllAges: loadShowAllAges("hero-journeys") })) kidPinInit.current = { story, refused: true, lang: kidTellLang };
    else {
      const opening = kidBookOpening(story, childProfile.id, kidTellLang, kidArtTheme(story), { name: childProfile.name, gender: childProfile.gender }, dayKey(new Date()));
      kidPinInit.current = { story, refused: false, render: opening.render, personalised: opening.personalised, lang: kidTellLang };
    }
  }
  const kidPinOpen = kidPinInit.current && !kidPinInit.current.refused ? kidPinInit.current : null;
  const [coverArt, setCoverArt] = useState<{ url?: string; loading: boolean; error: boolean }>({ loading: false, error: false });
  const [onCover, setOnCover] = useState(() => Boolean(kidPinOpen && childProfile.avatar && (childProfile as unknown as { photoUrl?: string }).photoUrl?.startsWith("data:")));
  const coverRun = useRef(0);
  // R2: the shelf entry belongs to reading the book to its end, not to the
  // Finish button (a re-read has none). These three keep that idempotent.
  const reducedMotion = usePrefersReducedMotion();
  const reachedEnding = useRef(false);
  const shelvingRef = useRef(false);
  const coverRetried = useRef(false);
  const photoUrl = (childProfile as unknown as { photoUrl?: string }).photoUrl;
  // AVA-3: use a generated stylized character (a data-URL avatar) as the story hero —
  // never a raw face photo or a remote URL — so scenes stay consistent and privacy-safe.
  const heroAvatarUrl = childProfile.avatar && photoUrl?.startsWith("data:") ? photoUrl : undefined;
  const heroAvatarStyle = normalizeAvatarStyle(childProfile.avatar?.style);
  const kidTheme = useKidTheme();
  // B-KID-70 (R-4): a story's cover in the child's ONE theme (manifest), or null
  // — then today's rendering (emoji motif / SVG hills) stays; never another theme's file.
  const storyCover = (id: string) => kidArt(kidTheme, storyCoverKey(id));
  // B-KID-01: the fallback-page cameo is the generated hero or Sprout — a
  // photo-only child (photoUrl, no avatar) resolves to null here, never the photo.
  const heroCameoUrl = resolveHeroUrl(childProfile) ?? undefined;
  const heroName = childProfile.name?.split(" ")[0] || (aiLang === "he" ? "הילד/ה" : "your child");


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
  const [activeStory, setActiveStory] = useState<HeroStorySpec | null>(() => kidPinOpen?.story ?? null);
  const [render, setRender] = useState<HeroJourneyRender | null>(() => kidPinOpen?.render ?? null);
  // B-KID-124: a pinned book the gate refuses lands on ITS cover with Read,
  // never on a bare grid.
  const [refusedPin, setRefusedPin] = useState<HeroStorySpec | null>(() => (kidPinInit.current?.refused ? kidPinInit.current.story : null));
  // B-KID-120: the language the open render is WRITTEN in. The page text, the
  // title, the Decision question and the choices take lang + dir from it
  // (never dir="auto"), and the child's name inside it is isolated.
  const [renderLang, setRenderLang] = useState<"en" | "he">(() => kidPinOpen?.lang ?? "en");
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
  // B-KID-127: the parent's explicit "Write a new version" (the only way a kept
  // story is written again; never in Kid Mode, never automatic).
  const [rewriting, setRewriting] = useState(false);
  // B-KID-76 (b): the Kid Mode book's ending page (after the last beat).
  const [atEnd, setAtEnd] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const startedAtRef = useRef<string>("");

  // Scenes aligned to the fixed spine order, with a graceful fallback if the
  // model drops or reorders a beat.
  // B-KID-23 F-1: a beat or choice the model dropped is filled from the
  // authored story in the render's language (aiLang), never the English spine.
  // B-KID-76 (a): the child the authored text names as its hero.
  const storyHero = useMemo<StoryHero>(() => ({ name: childProfile.name, gender: childProfile.gender }), [childProfile.name, childProfile.gender]);
  const { scenes, choices } = useMemo(
    () => (activeStory && render ? completeRender(activeStory, render, renderLang, storyHero) : { scenes: [] as HeroSceneRender[], choices: [] as HeroChoiceRender[] }),
    [activeStory, render, renderLang, storyHero],
  );

  const beat = activeStory?.beats[sceneIndex];
  const isDecision = beat?.id === "decision";
  const isConsequence = beat?.id === "consequence";
  const isReflection = beat?.id === "reflection";
  const chosen = choices.find((c) => c.id === choiceId);

  // On the consequence beat, show the chosen choice's tailored outcome text.
  const displayScene: HeroSceneRender | undefined = scenes[sceneIndex]
    ? isConsequence && chosen
      ? { ...scenes[sceneIndex], narration: chosen.consequence }
      : scenes[sceneIndex]
    : undefined;

  // B-KID-76 (b): read-to-me. In Kid Mode each page reads itself aloud once it
  // opens (400 ms after it settles), through the existing voice path; the
  // per-child mute in the top bar and the gesture rule live in kidReadAloud.
  // The Decision page reads its question too. Turning the page stops it.
  const kidSpeech = !kidMode || !activeStory || !render
    ? ""
    : atEnd
      ? kidsStoriesText("journey.end", aiLang)
      : onCover
        ? (render.title || activeStory.title)
        : isDecision && !choiceId && displayScene
          // B-KID-73: the Decision page speaks its question, then each choice
          // (one line each — the kid voice queue reads them in turn).
          ? [`${displayScene.narration} ${kidsStoriesText("journey.decision", renderLang, { name: childProfile.name?.split(" ")[0] ?? "" })}`, ...choices.map((c) => c.label)].join("\n")
          : displayScene?.narration ?? "";
  useEffect(() => {
    if (!kidSpeech) return;
    const timer = setTimeout(() => {
      const spoke = autoReadPage(childProfile.id, kidSpeech.split("\n"), atEnd ? (aiLang === "he" ? "he" : "en") : renderLang);
      // B-KID-124: once a page's words are being read aloud, a late
      // personalised render no longer replaces them on this read.
      if (spoke && !onCover && !atEnd) kidNarrationSpoken.current = true;
    }, 400);
    return () => { clearTimeout(timer); stopVoice(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidSpeech]);
  useEffect(() => { setAtEnd(false); }, [activeStory?.id]);

  const visibleStories = storiesForLanguage(
    packFilter === "all" ? HERO_STORIES : storiesInPack(packFilter),
    storyLang,
  );

  const startJourney = async (story: HeroStorySpec) => {
    setLoadingId(story.id);
    setStoryResting(false);
    try {
      // KID-25: a second Play of tonight's story makes NO network call.
      // B-KID-121: the memo, the request and the render all carry the story language.
      const memoKey = journeyMemoKey(childProfile.id, story.id, storyLang, dayKey(new Date()));
      const memoed = journeyMemo.get(memoKey);
      // B-KID-127: a kept render opens with zero network; only a story never
      // written for this child is generated (and then kept).
      const r = memoed ?? (await personalisedFor(story, storyLang)).render;
      if (!memoed) rememberJourney(memoKey, r);
      startedAtRef.current = new Date().toISOString();
      setActiveStory(story);
      setRender(r);
      setRenderLang(storyLang);
      setSceneIndex(0);
      setChoiceId(undefined);
      setQuestionsChecked({});
      setSaved(false);
      setFinishing(false);
      finishingRef.current = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start the journey.";
      // B-KID-45 (KB-02): a child with a hero keeps the page art on the
      // authored fallback (the story's comic theme + the beat spine).
      const fallback = authoredJourneyRender(story, storyLang, heroAvatarUrl ? (STORY_COMIC[story.id]?.theme ?? story.theme) : undefined, storyHero);
      // B-KID-33: the fallback is NOT memoised for the day — the next open asks
      // again (one call), it never replays a refusal or a crash.
      startedAtRef.current = new Date().toISOString();
      setActiveStory(story);
      setRender(fallback);
      setRenderLang(storyLang);
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

  // B-KID-42: tonight's banner pins ONE story — open THAT book on arrival
  // (one tap from the kid home), once per mount; never a one-card catalogue.
  // B-KID-53: in Kid Mode an open book's own title is the overlay title, and
  // the overlay's Home is the one back (the reader drops its own back + title).
  const kidStoryTitle = kidMode && activeStory && render ? (uiLang === "he" ? activeStory.titleHe : activeStory.title) : null;
  useEffect(() => {
    setKidSurfaceTitle(kidStoryTitle);
    return () => setKidSurfaceTitle(null);
  }, [kidStoryTitle]);

  // ── B-KID-124 (P0): a tapped book always opens THAT book, at once ─────────
  // The pin is keyed by story id + the overlay's per-tap nonce (it was a
  // once-per-mount boolean: only the first pinned book of a mounted tab ever
  // opened, and the grid stayed behind every later tap). In Kid Mode the book
  // opens on its authored text in the same frame; the personalised words are
  // asked for in the background and replace page 1 only while the child is
  // still on the first page and its words are not being read aloud; otherwise
  // they are cached for the next open. A failure changes nothing on screen.
  const pinKey = initialStoryId ? kidPinKey(initialStoryId, pinNonce) : null;
  const pinRef = useRef<string | null>(kidPinInit.current ? pinKey : null);
  const kidOpenSeq = useRef(0);
  const kidPageMoved = useRef(false);
  const kidNarrationSpoken = useRef(false);
  const kidPersonalise = (story: HeroStorySpec, lang: "en" | "he", seq: number) => {
    const memoKey = journeyMemoKey(childProfile.id, story.id, lang, dayKey(new Date()));
    personalisedFor(story, lang)
      .then(({ render: r }) => {
        rememberJourney(memoKey, r);
        if (!kidLateRenderApplies({ openSeq: kidOpenSeq.current, requestSeq: seq, pageMoved: kidPageMoved.current, narrationSpoken: kidNarrationSpoken.current })) return;
        setRender(r);
      })
      .catch(() => { /* the authored book stays exactly as it is */ });
  };
  const openKidBook = (story: HeroStorySpec, gated: boolean) => {
    if (gated && !kidBookOpenable(story, { lang: storyLang, ageMonths: childMonths, showAllAges })) {
      exitJourney();
      setRefusedPin(story);
      return;
    }
    const opening = kidBookOpening(story, childProfile.id, kidTellLang, kidArtTheme(story), storyHero, dayKey(new Date()));
    const seq = ++kidOpenSeq.current;
    kidPageMoved.current = false;
    kidNarrationSpoken.current = false;
    startedAtRef.current = new Date().toISOString();
    setRefusedPin(null);
    setActiveStory(story);
    setRender(opening.render);
    setRenderLang(kidTellLang);
    setSceneIndex(0);
    setChoiceId(undefined);
    setQuestionsChecked({});
    setSaved(false);
    setFinishing(false);
    finishingRef.current = false;
    setAtEnd(false);
    setOnCover(Boolean(heroAvatarUrl));
    if (!opening.personalised) kidPersonalise(story, kidTellLang, seq);
  };
  useEffect(() => {
    if (!initialStoryId || !pinKey) return;
    const story = getStorySpec(initialStoryId);
    if (!story) return;
    if (pinRef.current === pinKey) {
      // Opened on the first paint (above): only the background request is left.
      const init = kidPinInit.current;
      if (init && !init.refused && kidOpenSeq.current === 0) {
        const seq = ++kidOpenSeq.current;
        startedAtRef.current = new Date().toISOString();
        if (!init.personalised) kidPersonalise(story, init.lang, seq);
      }
      return;
    }
    pinRef.current = pinKey;
    if (kidMode) { openKidBook(story, true); return; }
    // Parent door: unchanged - B-KID-46 language gate, W0.7 age view, then
    // the generate-then-open flow.
    if (!storyHasLanguage(story, storyLang)) return;
    if (!showAllAges && filterByAge([story], (s) => windowFromRange(s.ageRange), childMonths).visible.length === 0) return;
    void startJourney(story);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey]);

  const chooseOption = (id: string) => {
    kidPageMoved.current = true;
    setChoiceId(id);
    celebrate({ kind: "choice" });
    setSceneIndex((i) => Math.min(scenes.length - 1, i + 1));
  };

  // R2 (critic P2): declared ABOVE its only caller. `drawCover` closed over a
  // const declared 26 lines later — safe while the only call sites were an
  // effect and an onRetry, one synchronous call away from a TDZ white screen.
  const coverPageArgs = () => activeStory && render && heroAvatarUrl ? {
    storyId: activeStory.id,
    lang: renderLang,
    heroName: childProfile.name?.split(" ")[0] ?? "",
    heroDataUrl: heroAvatarUrl,
    style: heroAvatarStyle,
    childId: childProfile.id,
    childIdentity: childProfile.id,
    pageIndex: 0,
    cover: true as const,
    // B-KID-55 (KB-05): the cover's title is the DOM overlay (always shown, in
    // the story's language) — never lettered into the image.
    theme: `${render.title || activeStory.title} — ${activeStory.theme}`,
    sfx: [] as string[],
  } : undefined;

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
    // Story start and Redraw are both deliberate requests; the session failure
    // guard only suppresses the automatic re-requests a remount would make.
    clearJourneyPageFailure(journeyPageKey(cover));
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
    reachedEnding.current = false;
    coverRetried.current = false;
    setCoverArt({ loading: false, error: false });
    // With a hero the book opens on its cover; without one there is no cover to
    // show and the reader opens on beat 1 exactly as before.
    setOnCover(Boolean(activeStory && render && heroAvatarUrl));
    if (!activeStory || !render || !heroAvatarUrl) return;
    drawCover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStory?.id, heroAvatarUrl, renderLang]);

  const saveStoryAsComic = async () => {
    if (!activeStory || !render || !heroAvatarUrl) return;
    const expected = 1 + scenes.filter((scene) => scene.imagePrompt).length;
    // A cover that failed at story start gets ONE more try at the end (bounded:
    // one call), so a single busy moment does not cost the child their book.
    if (!comicPageKeys.current.has(0)) {
      // R2: the shelf attempt now runs on the ending as well as on Finish, so
      // the "one more try" is bounded per STORY, not per attempt.
      if (coverRetried.current) return;
      coverRetried.current = true;
      const cover = coverPageArgs();
      if (cover) {
        clearJourneyPageFailure(journeyPageKey(cover));
        await generateJourneyPage(cover).then(({ key }) => comicPageKeys.current.set(0, key)).catch(() => {});
      }
    }
    const keys = [...comicPageKeys.current.entries()].sort((a, b) => a[0] - b[0]).map(([, key]) => key);
    if (keys.length !== expected) return; // incomplete art → no shelf entry (never a book that cannot open)
    await savedComicsCol.upsert(toSavedComicMeta({
      id: activeStory.id,
      adventureId: activeStory.id,
      // M3: the read-along comic is its OWN shelf book (doc id
      // `<storyId>:journey`) — it no longer overwrites a parent-built book.
      kind: "journey",
      title: render.title || activeStory.title,
      lang: renderLang,
      pageUrls: [],
      createdAt: new Date().toISOString(),
      pageKeys: keys,
    }));
    // B-KID-49: a shelved book's pages are evicted from the device store last.
    shelveBookPages(childProfile.id, keys);
    markComicSaved(true);
  };

  /**
   * R2 (critic FAIL — the re-read path). Shelving hung off the Finish button,
   * and a story that already has a run has no Finish button (`saved` is true
   * from `replay`). The child read the cover and all eight pages, the ending
   * claimed the story was saved, and `savedComics` stayed empty.
   *
   * The shelf entry now belongs to READING the book to its end: once the last
   * beat is on screen and the cover + every illustrated beat has resolved, the
   * book is shelved exactly once. Idempotent (`comicSavedRef` + an in-flight
   * guard) and still refuses an incomplete page set, so no book that cannot
   * open ever reaches the shelf.
   */
  const shelveWhenComplete = async () => {
    if (!reachedEnding.current || comicSavedRef.current || shelvingRef.current) return;
    shelvingRef.current = true;
    try { await saveStoryAsComic(); } catch { /* best-effort: the run itself is saved */ }
    finally { shelvingRef.current = false; }
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
      language: renderLang,
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

  // R2: reaching the last beat IS "finished reading". The attempt repeats from
  // `onPageResolved` because the last page is usually still drawing when the
  // child gets here; both paths funnel through the same idempotent writer.
  useEffect(() => {
    if (!isReflection || !activeStory || !render) return;
    reachedEnding.current = true;
    void shelveWhenComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReflection, activeStory?.id]);

  const replay = (run: HeroJourneyRun) => {
    const story = getStorySpec(run.storyId);
    if (!story) return;
    // B-KID-121: a run written in another language is not restored.
    if (!runRestorable(run, storyLang)) {
      if (kidMode) openKidBook(story, false);
      else void startJourney(story);
      return;
    }
    startedAtRef.current = run.startedAt;
    setActiveStory(story);
    setRender(run.render);
    setRenderLang(run.language === "he" ? "he" : "en");
    setSceneIndex(0);
    setChoiceId(run.choiceId);
    setQuestionsChecked({});
    setSaved(true);
    setFinishing(false);
    finishingRef.current = false;
  };

  // B-KID-121: the app language changed under an open book - its words are in
  // the old language, so the book reopens in the story language (Kid Mode: at
  // once on the authored text; parent: generate-then-open as before).
  useEffect(() => {
    if (!activeStory || !render || renderLang === storyLang) return;
    if (kidMode) openKidBook(activeStory, false);
    else void startJourney(activeStory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyLang]);

  const rewriteStory = async () => {
    if (!activeStory || rewriting || kidMode) return;
    setRewriting(true);
    try {
      const { render: r } = await personalisedFor(activeStory, storyLang, true);
      rememberJourney(journeyMemoKey(childProfile.id, activeStory.id, storyLang, dayKey(new Date())), r);
      setRender(r);
      setRenderLang(storyLang);
      setSceneIndex(0);
      setChoiceId(undefined);
      setSaved(false);
    } catch (e) {
      if (e instanceof Error) toast(e.message, "error");
    } finally {
      setRewriting(false);
    }
  };

  const exitJourney = () => {
    kidOpenSeq.current += 1; // B-KID-124: a late personalised render lands nowhere
    setRefusedPin(null);
    setActiveStory(null);
    setRender(null);
    setAtEnd(false);
    setImmersive(false);
    setFinishing(false);
    finishingRef.current = false;
  };

  // ── Shared player pieces ───────────────────────────────────────────────────
  const renderChoices = () =>
    isDecision &&
    !choiceId && (
      <div className="space-y-2 w-full max-w-xl mx-auto">
        <p lang={renderLang} dir={langDir(renderLang)} className="text-[11px] uppercase tracking-widest font-bold text-center" style={{ color: "var(--arbor-green-ink)" }}>
          {kidsStoriesText("journey.decision", renderLang, { name: isolate(childProfile.name ?? "", renderLang) })}
        </p>
        <DecisionChoices choices={choices} lang={renderLang} heroName={childProfile.name?.split(" ")[0]} onChoose={chooseOption} />
      </div>
    );

  const canAdvance = !isDecision || !!choiceId;
  // M2: the cover is a PAGE, not a beat. It sits before beat 1 and the counter
  // says so ("Cover", then "1 / 8") — the eight beats keep their own numbers.
  const hasCoverPage = Boolean(heroAvatarUrl);
  const atFirstPage = onCover || (sceneIndex === 0 && !hasCoverPage);
  const goBack = () => {
    if (onCover) return;
    kidPageMoved.current = true;
    kidSfx("pageTurn"); // B-KID-73: silent outside Kid Mode / with Sound off
    if (sceneIndex === 0) { if (hasCoverPage) setOnCover(true); return; }
    setSceneIndex((i) => Math.max(0, i - 1));
  };
  // Turning off the cover never waits for its art: a cover still drawing is a
  // framed loading page the child can read past.
  const goNext = () => {
    kidPageMoved.current = true;
    if (onCover || canAdvance) kidSfx("pageTurn"); // B-KID-73
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
    // W0.7 — age gate AFTER pack filter + aim ordering (never re-ranks). Each
    // story carries its own band (B-KID-52: 3–5 … 6–8); a child no story is
    // written for gets the honest empty state with the "Show all ages" door,
    // not a grid of content written for someone else's age.
    const { visible: ageVisibleStories, hidden: ageHiddenStories } = filterByAge(
      orderedStories,
      (s) => windowFromRange(s.ageRange),
      childMonths,
    );
    // B-KID-70 (R-4b): illustrated stories (a cover in the child's theme) lead
    // the catalogue; a stable partition, so the aim order holds inside each half.
    const illustratedFirst = (list: HeroStorySpec[]) => [...list.filter((s) => storyCover(s.id)), ...list.filter((s) => !storyCover(s.id))];
    const ageCandidates = illustratedFirst(showAllAges ? orderedStories : ageVisibleStories);
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
    // B-PLAY-16: the pick comes from the family — age view, unread first
    // (heroRuns), the charter's aims, then the day hash — with the SAME inputs
    // the kid home passes, so both name the same story. The reason is shown.
    const tonightPick = pickTonightsStory(dayKey(new Date()), childProfile.id, {
      readIds: runs.map((r) => r.storyId), aims, ageMonths: childMonths, showAllAges,
      prefer: (s) => storyCover(s.id) !== null,
      lang: storyLang,
    });
    const tonightStory = pinned ?? tonightPick.story ?? undefined;
    const tonightReason = pinned ? null : tonightPick.reason;
    const tonightReasonLine =
      tonightReason?.kind === "aim" ? t(TONIGHT_AIM_REASON_KEY[tonightReason.metric])
      : tonightReason?.kind === "unread" ? t("elev.stories.tonight.reason.unread", { name })
      : "";
    // W2-SHELLPLAY critic r1: the cover's "Builds · Ask after" well, in the UI
    // language only — a Hebrew row with no Hebrew text is not drawn.
    const tonightBuilds = tonightStory ? (uiLang === "he" ? tonightStory.learningObjectiveHe : tonightStory.learningObjective) ?? "" : "";
    // W2-SHELLPLAY critic r2: the glanceable phrase (<= 6 words) when the story
    // has one; the full sentence stays on the row's title.
    const tonightBuildsShort = storyBuildsShort(tonightStory?.id, uiLang === "he" ? "he" : "en");
    // W2-SHELLPLAY critic r2 (B-SHELL-NEW-2d): the parent's own words from today
    // or yesterday, quoted once above the cover; absent when there are none.
    const notedMoment = latestNotedMoment(behaviorLogs ?? [], new Date());
    const tonightAskAfter = tonightStory
      ? (uiLang === "he" ? tonightStory.parentReflection.questionsHe?.[0] : tonightStory.parentReflection.questions[0]) ?? ""
      : "";
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
    // B-KID-124: a refused pin shows THAT book's cover with Read (never the grid).
    if (refusedPin) {
      const cover = storyCover(refusedPin.id);
      const pinTitle = uiLang === "he" ? refusedPin.titleHe : refusedPin.title;
      return kidMode ? (
        <div className="arbor-play flex flex-col items-center gap-4 text-center" data-kid-book-pin-cover={refusedPin.id} style={{ marginInline: -20, marginBlockStart: -24 }}>
          <div className={KID_BOOK_ART_CLASS} style={{ background: "var(--arbor-paper-deep)" }}>
            {cover
              ? <img src={cover.src} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: cover.objectPosition }} />
              : <KidBookTitleCard title={pinTitle} pack={refusedPin.pack} />}
          </div>
          <p lang={uiLang === "he" ? "he" : "en"} dir={langDir(uiLang === "he" ? "he" : "en")} className="font-black px-5" style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1.2, color: "var(--arbor-ink)" }}>{pinTitle}</p>
          <div className="flex w-full max-w-md flex-col gap-3 px-5 pb-5">
            <button type="button" data-kid-book-pin-read="" onClick={() => openKidBook(refusedPin, false)} style={{ minBlockSize: 56, borderRadius: 18, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, border: "var(--comic-line)", cursor: "pointer", background: "var(--arbor-green-cta-start)", color: "var(--arbor-on-accent)" }}>{kidsStoriesText("shelf.read", uiLang === "he" ? "he" : "en")}</button>
            <button type="button" onClick={() => setRefusedPin(null)} style={{ minBlockSize: 56, borderRadius: 18, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, border: "var(--comic-line)", cursor: "pointer", background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" }}>{kidsStoriesText("kidBooks.title", uiLang === "he" ? "he" : "en")}</button>
          </div>
        </div>
      ) : null;
    }
    return kidMode ? (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="arbor-play space-y-6"
      >
        {/* B-KID-85 (KB-28 + KA-04): the kid catalogue is "My books" — ONE
            cover grid (KidLibrary) over the one list the home row reads
            (kidBooks: story language, age view, opened first, illustrated
            first), then the saved comics ("Made before"). The crest, the
            Sprout bubble, the pack filter chips, the age switch, the ribbons,
            the virtue chips and the separate Library shelf are gone from the
            kid register; the parent branch below is unchanged. */}
        <KidLibrary
          books={kidBooks({ lang: storyLang, ageMonths: childMonths, showAllAges, hasCover: (id) => storyCover(id) !== null, runs })}
          theme={kidTheme}
          lang={uiLang === "he" ? "he" : "en"}
          childProfile={childProfile}
          loadingId={loadingId}
          onOpen={(story) => { openKidBook(story, false); }}
        />
      </motion.div>
    ) : (
      <div className="space-y-6 max-w-[1100px]">
        {/* W2-SHELLPLAY critic r1: the H1 names tonight, not the catalogue; no
            eyebrow, no subtitle (four labels stood before the story). "Starring"
            only once the child has a hero — the cover cannot keep that claim
            with the generic mascot. */}
        <PageHeader
          title={childProfile.avatar ? t("elev.stories.tonight.h1.starring", { name }) : t("elev.stories.tonight.h1")}
        />
        {/* §3f row 3 — ONE dominant cover, above the fold. The parent door used
            to open on a comic hero banner, a mascot bubble in the kid's voice,
            two in-hub tiles and a filter row, so the FIRST story card rendered
            at 1,151 px: an evening surface that made you scroll past four
            things before it offered a story. chooseTonightsStory() (built for
            the kid home in 02e04b42, reused verbatim) already picks ONE story
            per local day, so the kid banner and this cover name the same one. */}
        <section data-module="stories-tonight">
          {/* B-PLAY-14: "From today" · "A hero adventure" — a two-option switch
              on the cover. "From today" renders the shared bedtime body inline
              (generate-and-discard, the same code as #/bedtime-stories). */}
          <div role="group" aria-label={t("elev.stories.tonight.mode.label")} data-testid="stories-tonight-mode" className="inline-flex items-center gap-1 rounded-xl p-1 mb-3" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
            {(["today", "hero"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={tonightMode === m}
                onClick={() => setTonightMode(m)}
                data-testid={`stories-tonight-mode-${m}`}
                className="px-3 min-h-11 rounded-lg text-[13px] font-bold transition"
                style={tonightMode === m ? { background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", boxShadow: "var(--shadow-xs)" } : { color: "var(--arbor-muted)" }}
              >
                {m === "today" ? t("elev.stories.tonight.mode.today") : t("elev.stories.tonight.mode.hero")}
              </button>
            ))}
          </div>
          {/* W2-SHELLPLAY critic r1: the cover is a card, not one 586 px
              button — the declared move is stamped on the ONE control that
              plays it. Phone: a 112 px art band (avatar only), title, the
              family's reason, one recessed "Builds · Ask after" well and Play,
              all inside 812 px. ≥1024: two columns, art at inline-start, the
              text column held to 60ch. The archetype essay lives in the reader
              (reflection beat), not on the cover. */}
          {tonightMode === "today" ? <TonightFromToday /> : (
          <div data-testid="stories-cover" className={`${cardCls} w-full overflow-hidden p-0 lg:grid lg:grid-cols-[2fr_3fr]`}>
            {/* SHIP-FIX (W2-SHELLPLAY r3 F1): below sm the art band is ONE row —
                avatar at inline-start, the hero row beside it (100 px, was a
                148 px column) — so Play clears the fixed bottom nav at 375. */}
            <div
              className="flex flex-row sm:flex-col items-center justify-center gap-3 sm:gap-1 w-full min-h-[96px] sm:min-h-[168px] lg:h-full lg:min-h-[220px] py-2 px-3"
              style={{ background: tonightStory ? PACK_SOFT[tonightStory.pack] : "var(--arbor-paper-deep)" }}
            >
              <span aria-hidden="true"><HeroAvatar size={84} ring animate={false} /></span>
              {/* W2-SHELLPLAY critic r2: hero-first is ONE quiet 44 px text row
                  inside the art band (was a kid-register PlayPanel/PlayButton
                  below the cover, heavier than Play). "Read it together" stays
                  the page's only filled button. */}
              {!kidMode && !childProfile.avatar && (
                <button
                  type="button"
                  data-testid="hero-first-gate"
                  onClick={() => setHeroDialogOpen(true)}
                  className="inline-flex min-h-11 items-center gap-1 px-2 t-sm font-bold text-start"
                  style={{ color: "var(--arbor-clay-ink)" }}
                  dir="auto"
                >
                  {t("elev.stories.tonight.heroRow", { name: heroName })}
                  <Icon name="arrow_forward" size={15} style={he ? { transform: "scaleX(-1)" } : undefined} />
                </button>
              )}
            </div>
            <div className="p-4 sm:p-5 lg:max-w-[60ch]">
              {/* W2-SHELLPLAY critic r2 (B-SHELL-NEW-2d) → SHIP-FIX r3 F1/F2: ONE
                  moment line — the parent's own words from today or yesterday,
                  the screen's one warm accent — now INSIDE the cover text column
                  (the 108 px band above the cover pushed Play under the nav).
                  Peach inline-start rule, quote in the editorial face with its
                  glyphs inside the <bdi>. No link: the "From today" switch is the
                  one door into that mode. Absent with no moment. */}
              {!kidMode && notedMoment && (
                <p data-testid="stories-tonight-noted" className="m-0 mb-2 ps-2.5 t-sm leading-snug line-clamp-2" style={{ borderInlineStart: "3px solid var(--arbor-peach-ink)", color: "var(--arbor-ink)" }}>
                  <span className="t-xs font-bold" style={{ color: "var(--arbor-peach-ink)" }}>
                    {t(notedMoment.from === "today" ? "elev.stories.tonight.noted" : "elev.stories.tonight.noted.yesterday")}
                  </span>{" "}
                  <bdi dir="auto" style={{ fontFamily: "var(--font-editorial)" }}>“{notedMoment.text}”</bdi>
                </p>
              )}
              <h2 className="text-[1.35rem] font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
                {tonightStory ? (he ? tonightStory.titleHe : tonightStory.title) : t("elev.stories.catalogue.title")}
              </h2>
              {/* B-PLAY-16: why THIS story tonight — from the family's own record. */}
              {tonightReasonLine && (
                <p data-testid="stories-tonight-reason" className="mt-1.5 text-[12.5px] font-bold" style={{ color: "var(--arbor-green-ink)" }} dir="auto">
                  {tonightReasonLine}
                </p>
              )}
              {/* B-PLAY-11 + W2-SHELLPLAY critic r1: what this story builds and
                  the one thing to ask after — read BEFORE reading, in the UI
                  language. A row with no text in that language is not drawn
                  (never English in the Hebrew UI). */}
              {(tonightBuilds || tonightAskAfter) && (
                <dl data-testid="stories-tonight-insight" className="mt-3 rounded-[14px] p-4 space-y-1.5 text-[13px]" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                  {tonightBuilds && (
                    <div className="flex gap-2">
                      <dt className="font-extrabold flex-shrink-0" style={{ color: "var(--arbor-ink)" }}>{t("elev.stories.tonight.builds")} ·</dt>
                      {/* W2-SHELLPLAY critic r2: two lines at most below sm, so
                          Play stays clear of the bottom nav at 375. */}
                      <dd className="m-0 line-clamp-2 sm:line-clamp-none" title={tonightBuilds} style={{ color: "var(--arbor-ink-soft)" }} dir="auto">{tonightBuildsShort ?? tonightBuilds}</dd>
                    </div>
                  )}
                  {tonightAskAfter && (
                    <div className="flex gap-2">
                      <dt className="font-extrabold flex-shrink-0" style={{ color: "var(--arbor-ink)" }}>{t("elev.stories.tonight.askAfter")} ·</dt>
                      <dd className="m-0 text-[15px] leading-snug" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }} dir="auto">{tonightAskAfter}</dd>
                    </div>
                  )}
                </dl>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {tonightStory && (
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: "var(--arbor-paper-deep)", color: PACK_WORLD[tonightStory.pack].ink }}>
                    {he ? PACK_WORLD[tonightStory.pack].labelHe : PACK_WORLD[tonightStory.pack].label}
                  </span>
                )}
                <button
                  type="button"
                  data-primary-move="read-tonights-story"
                  onClick={() => { if (!loadingId && tonightStory) void startJourney(tonightStory); }}
                  disabled={!tonightStory || !!loadingId}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 min-h-[44px] text-[13px] font-extrabold ms-auto transition active:scale-[0.98] disabled:opacity-60 focus:outline-none focus-visible:ring-2"
                  style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}
                >
                  {tonightStory && loadingId === tonightStory.id
                    ? <><Icon name="autorenew" size={16} className="motion-safe:animate-spin" /> {statesText("elev.states.hero.opening", he)}</>
                    : <><Icon name="play_arrow" size={16} fill={1} /> {t("elev.stories.tonight.cta")}</>}
                </button>
              </div>
            </div>
          </div>
          )}
        </section>

        {/* RUN-08 — the counts that used to be a chip reading "0 stories done"
            plus six virtue counters all showing 0 on day 0: a wall of zeros on
            the first evening. One quiet line, rendered only once there IS
            something to count. Counts, never verdicts (law 1). */}
        {/* B-PLAY-11: the six virtue tallies ("Courage 3") are gone from the
            parent page — a running per-virtue count of the child reads as a
            measurement (law 1). The one count kept is the shared-reading line. */}
        {runs.length > 0 && (
          <p className="text-[11.5px] px-1" style={{ color: "var(--arbor-muted)" }}>
            {t(runs.length === 1 ? "elev.stories.counts.stories.one" : "elev.stories.counts.stories", { n: runs.length })}
          </p>
        )}

        {/* G1 hero-first (22 Sep 2026): a child without a generated hero gets one
            parent-side step here, never a story starring the raw photo.
            B-PLAY-11: it stays OUT of the "More stories" disclosure so it is
            never collapsed away. */}
        {!kidMode && !childProfile.avatar && (
          <HeroCreateDialog
            open={heroDialogOpen}
            childId={childProfile.id}
            childName={heroName}
            onClose={() => setHeroDialogOpen(false)}
          />
        )}
        {/* B-PLAY-11: the pack filter and the whole catalogue sit behind ONE
            collapsed "More stories" disclosure (R25: a demoted module inside a
            data-module-disclosure), so above the fold is cover + insight + Play. */}
        <details data-module-disclosure="stories-more" className="group" data-testid="stories-more" open={pinned ? true : undefined}>
        <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 min-h-11 px-1 text-[13px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
          <Icon name="expand_more" size={18} className="transition group-open:rotate-180" />
          {t("elev.stories.more")}
        </summary>
        <section data-module="stories-catalogue" data-module-demoted className="space-y-6 mt-3">
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
                    ? { background: w ? PACK_SOFT[p.id as HeroPackId] : "var(--arbor-clay-soft)", color: w ? w.ink : "var(--arbor-clay-deep)", border: "1px solid var(--arbor-rule-strong)", boxShadow: "var(--shadow-sm)" }
                    : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
        )}

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
                    background: showAllAges ? "var(--arbor-yellow)" : "var(--arbor-paper-elevated)",
                    border: "1px solid var(--arbor-rule-strong)",
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
            <div className={`${cardCls} p-5 text-center`} data-testid="agefilter-empty-hero-journeys">
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
                style={{ background: "var(--arbor-yellow)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
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
                      style={{ background: "var(--arbor-yellow)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)", insetInlineStart: 0, borderStartStartRadius: "var(--play-radius)", borderEndEndRadius: "12px" }}
                    >
                      ★ {he ? "המטרה שלכם" : "Your aim"}
                    </span>
                  ) : story.origin === "original" ? (
                    <span
                      className="absolute top-0 z-[2] text-[11px] font-black text-white px-2.5 py-1"
                      style={{ background: "var(--arbor-pink-ink)", border: "1px solid var(--arbor-rule)", insetInlineStart: 0, borderStartStartRadius: "var(--play-radius)", borderEndEndRadius: "12px" }}
                    >
                      {he ? "מקורי" : "ORIGINAL"}
                    </span>
                  ) : null}
                  {/* Scene: the hero standing in this story's world */}
                  <div className="relative overflow-hidden" style={{ height: 150, background: w.bg, borderBottom: "1px solid var(--arbor-rule)" }}>
                    {/* The story's world, with the child's hero generated into the scene
                        (same pipeline as the Practice world-cards). Falls back to the
                        hero + emoji motif while loading / with no hero / on error. */}
                    <WorldScene worldId={`story-${story.id}`} theme={kidTheme} imagePrompt={`${story.title} — ${story.theme}`}>
                      <div className="flex items-center gap-1.5">
                        <HeroAvatar size={80} ring animate={false} />
                        <span style={{ fontSize: 46, filter: "drop-shadow(2px 2px 0 rgba(23,27,34,.3))" }} aria-hidden="true">
                          {art.emoji}
                        </span>
                      </div>
                    </WorldScene>
                    <span
                      className="absolute top-2 z-[3] text-[10.5px] font-black rounded-full px-2 py-0.5"
                      style={{ insetInlineEnd: 8, background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
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
                        style={{ border: "1px solid var(--arbor-rule-strong)", color: w.ink }}
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
        </details>

        <section data-module="stories-library">
        {/* JOURNEY LIBRARY */}
        <div>
          <h2 className="font-black mb-3 inline-flex items-center gap-2" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px,3.4vw,24px)" }}>
            <Icon name="auto_stories" size={20} /> {kidMode ? (he ? `הספרייה (${shelfRuns.length})` : `Library (${shelfRuns.length})`) : `${t("elev.stories.library.title")} (${shelfRuns.length})`}
          </h2>
          {!runsCol.loaded ? (
            /* Masterplan 4.3 — per-section skeleton mimicking the library tile
               grid (reserves real dimensions; ~10s → inline retry wired to the
               W0 syncStore, which re-mounts this runsCol listener). */
            <SectionSkeleton title={false} rows={2} rowClassName="h-[120px]" loaded={runsCol.loaded} testId="hero-library-skeleton" />
          ) : shelfRuns.length === 0 ? (
            <div className={`${cardCls} p-5`}>
              <EmptyState
                headline={he ? "עדיין אין מסעות" : "No quests yet"}
                body={he ? "בחרו סיפור למעלה והתחילו את המסע הראשון. כל מסע שהושלם נשמר כאן." : "Pick a story above and start your first quest. Completed quests are saved here."}
              />
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
              {shelfRuns.map((run) => {
                const spec = getStorySpec(run.storyId);
                const w = spec ? PACK_WORLD[spec.pack] : PACK_WORLD.courage;
                const art = STORY_ART[run.storyId] ?? { emoji: "⭐", sfx: "POW!", sfxHe: "פאו!" };
                const cover = storyCover(run.storyId);
                return (
                  <button key={run.id} onClick={() => replay(run)} className="world-tile text-start" aria-label={runTitle(run, uiLang === "he" ? "he" : "en")}>
                    <div className="grid place-items-center overflow-hidden" style={{ height: 72, background: w.bg, borderBottom: "1px solid var(--arbor-rule)" }}>
                      {cover ? <img src={cover.src480} alt="" aria-hidden="true" loading="lazy" decoding="async" className="h-full w-full object-cover" style={{ objectPosition: cover.objectPosition }} /> : <span style={{ fontSize: 34 }} aria-hidden="true">{art.emoji}</span>}
                    </div>
                    <div className="p-2.5">
                      <span className="text-[12.5px] font-black block leading-tight line-clamp-2" style={{ color: "var(--arbor-ink)" }} dir="auto">{runTitle(run, uiLang === "he" ? "he" : "en")}</span>
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
      {/* R2 (critic P0/P1): no "COVER" eyebrow. The nav counter already says
          Cover, and the model letters the title INTO the art — a second grey
          label above an untitled-looking picture is what stopped this reading
          as a cover. */}
      <div className="relative w-full max-w-3xl mx-auto">
        <ComicPage
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
        {/* R2 (critic P1): the front page is the one whose job is "this book is
            about you", and it was the only page without the child. Same cameo
            strip the beats carry (HeroScenePlayer), over the cover frame. */}
        {heroAvatarUrl && (
          <div
            className="absolute bottom-2 h-[38%] max-h-40 rounded-2xl p-1"
            style={{ insetInlineStart: "5%", background: "var(--arbor-paper-elevated)", outline: "2px solid var(--comic-ink)", boxShadow: "var(--comic-pop)" }}
          >
            <img
              src={heroAvatarUrl}
              alt={heroName
                ? kidsStoriesText("journey.heroAlt", aiLang, { name: isolate(heroName, aiLang) })
                : kidsStoriesText("journey.heroAltUnnamed", aiLang)}
              className="h-full w-auto rounded-xl object-contain"
            />
          </div>
        )}
      </div>
      {/* S4: the badge labels GENERATED art only — a cover that is still
          drawing or smudged has no art to attribute. */}
      {coverArt.url && <ProvenanceBadge lang={uiLang === "he" ? "he" : "en"} className="-mt-2" />}
      {/* R2 (critic P0): the lettered art carries the title. The text title is
          the FALLBACK — it renders only while there is no art to letter it
          (drawing / smudged), and the alt text carries it for a screen reader. */}
      {!coverArt.url && (
        <h3
          lang={renderLang}
          dir={langDir(renderLang)}
          className={`font-extrabold tracking-tight ${immersiveMode ? "text-xl" : "text-lg"}`}
          style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display), Georgia, serif" }}
        >
          {isolateNameIn(render.title || activeStory.title, childProfile.name?.split(" ")[0], renderLang)}
        </h3>
      )}
    </div>
  );

  // R2 (critic G2): the turn off the cover. AnimatePresence wrapped ONE static
  // key before, so nothing animated — the cover simply vanished. Cover and beat
  // are now the two presence states of the same slot: `mode="wait"` plays the
  // cover's flip-out to completion, then beat 1 mounts and ComicPage plays its
  // own flip-in. Reduced motion collapses both to a cross-fade, exactly as the
  // shared primitive does.
  const playerBody = (immersiveMode: boolean) => (
    <div className="space-y-6">
      <div style={reducedMotion ? undefined : { perspective: 1600 }}>
        <AnimatePresence mode="wait" initial={false}>
          {onCover ? (
            <motion.div
              key="journey-cover"
              exit={reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, rotateY: uiLang === "he" ? -16 : 16, x: uiLang === "he" ? 28 : -28 }}
              transition={{ duration: reducedMotion ? 0.2 : 0.42, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: uiLang === "he" ? "right center" : "left center" }}
            >
              {coverPage(immersiveMode)}
            </motion.div>
          ) : displayScene ? (
            <motion.div key={`journey-beat-${displayScene.beatId}`}>
              <HeroScenePlayer
                scene={displayScene}
                storyId={activeStory.id}
                seed={`${activeStory.id}-${displayScene.beatId}-${childProfile.name}`}
                beatNumber={sceneIndex + 1}
                beatTotal={activeStory.beats.length}
                cameoUrl={heroCameoUrl}
                heroAvatarUrl={heroAvatarUrl}
                heroAvatarStyle={heroAvatarStyle}
                heroName={childProfile.name?.split(" ")[0]}
                childIdentity={childProfile.id}
                childId={childProfile.id}
                onPageResolved={({ beatNumber, key }) => { comicPageKeys.current.set(beatNumber, key); void shelveWhenComplete(); }}
                immersive={immersiveMode}
                fallbackArtUrl={storyCover(activeStory.id)?.src}
                fallbackArtHasHero={storyCover(activeStory.id)?.hasHero ?? false}
                metaAction={kidMode && !immersiveMode ? immersiveButton : undefined}
                textLang={renderLang}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

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
                  className="w-full rounded-xl p-3 min-h-[44px] text-start"
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
                    {uiLang === "he" ? "למבוגרים · למה הסיפור הזה" : "For grown-ups · Why this story"}
                  </p>
                  <p dir="auto" className="text-[13px] leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>
                    {/* B-PLAY-11: the grown-up insight is parent chrome → uiLang. */}
                    {uiLang === "he" ? activeStory.parentInsight.he : activeStory.parentInsight.en}
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
                    className="w-full text-start p-2.5 min-h-[44px] rounded-xl transition flex items-start gap-2"
                    style={questionsChecked[i]
                      ? { background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.30)", color: "var(--arbor-green-ink)" }
                      : { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
                  >
                    {/* CR-01: explicit checked/unchecked pair so the white mark's fill is provable (same pixels as the ternary it replaces). */}
                    {questionsChecked[i]
                      ? <span className="mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-white" style={{ background: "var(--arbor-clay)" }}><Icon name="check" size={12} /></span>
                      : <span className="mt-0.5 w-4 h-4 rounded flex-shrink-0" style={{ background: "var(--arbor-rule-strong)" }} aria-hidden="true" />}
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
  // B-KID-53 polish: ONE full-screen control. The parent keeps it in the reader's
  // top row; Kid Mode has no top row (the overlay carries back + title), so the
  // control sits in the page's own meta row beside Read aloud.
  const immersiveButton = (
        <button
          ref={immersiveTriggerRef}
          onClick={() => setImmersive(true)}
          className="inline-flex items-center justify-center gap-1.5 text-sm font-bold px-2 min-h-[44px]"
          style={{ color: "var(--arbor-muted)", minWidth: "var(--touch-min)" }}
          aria-label={t("elev.stories.reader.immersive")}
        >
          <Icon name="fullscreen" size={16} /> <span className="hidden sm:inline">{t("elev.stories.reader.immersive")}</span>
        </button>
  );
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

  // ── B-KID-76 (b): the Kid Mode reader is a picture book ─────────────────────
  // Full-bleed art on the top ~55 % (HeroScenePlayer layout="book"), the words
  // below at the kid scale, ONE big Next (56 px, full width) and a smaller
  // Back; the Decision page keeps its large stacked cards; the last beat's Next
  // is "The End" and opens the ending page: the cover, "The End", Read again /
  // My books — and reaching it marks the book read (finishJourney). No
  // Immersive control: the reader is already full-bleed. Parent reader below
  // is unchanged.
  if (kidMode) {
    const bookArt = coverArt.url ?? storyCover(activeStory.id)?.src;
    const bookArtBox = (
      <div className={KID_BOOK_ART_CLASS} data-kid-book-art="" style={{ background: "var(--arbor-paper-deep)" }}>
        {bookArt
          ? <img src={bookArt} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: coverArt.url ? "50% 50%" : storyCover(activeStory.id)?.objectPosition }} />
          : <KidBookTitleCard title={render.title || activeStory.title} pack={activeStory.pack} />}
      </div>
    );
    const isLastBeat = !onCover && sceneIndex === scenes.length - 1;
    const toEnding = () => {
      setAtEnd(true);
      if (!saved) void finishJourney();
      kidSfx("finish"); // B-KID-94: the ONE finish sound
    };
    const readAgain = () => {
      kidPageMoved.current = true;
      setAtEnd(false);
      setChoiceId(undefined);
      setSceneIndex(0);
      setOnCover(Boolean(heroAvatarUrl));
    };
    const bigButton = { minBlockSize: 56, borderRadius: 18, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, border: "var(--comic-line)", cursor: "pointer" } as const;
    // B-KID-128: the page's controls sit under the words - on the wide spread
    // that is the text column beside the picture, never under a giant image.
    const bookNav = (
          <div className="flex items-stretch gap-3 px-5 pb-5 pt-4" data-kid-book-nav="">
            <button
              type="button"
              onClick={goBack}
              disabled={atFirstPage}
              aria-label={kidsStoriesText("journey.back", uiLang === "he" ? "he" : "en")}
              className="disabled:opacity-30"
              style={{ inlineSize: 48, minBlockSize: 48, alignSelf: "center", display: "grid", placeItems: "center", borderRadius: 999, background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "var(--comic-line)", cursor: "pointer", flexShrink: 0 }}
            >
              <Icon name="chevron_left" size={24} style={uiLang === "he" ? { transform: "scaleX(-1)" } : undefined} />
            </button>
            <button
              type="button"
              onClick={isLastBeat ? toEnding : goNext}
              disabled={!onCover && !canAdvance}
              data-kid-book-next=""
              className="disabled:opacity-40"
              style={{ ...bigButton, flex: 1, background: "var(--arbor-green-cta-start)", color: "var(--arbor-on-accent)" }}
            >
              {isLastBeat ? kidsStoriesText("journey.end", uiLang === "he" ? "he" : "en") : kidsStoriesText("journey.next", uiLang === "he" ? "he" : "en")}
            </button>
          </div>
    );
    const bookSide = (
      <>
        {!onCover && <div className="px-5 pt-4">{renderChoices()}</div>}
        {bookNav}
      </>
    );
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-kid-book-reader="" style={{ marginInline: -20, marginBlockStart: -24 }}>
        <AnimatePresence mode="wait" initial={false}>
          {atEnd ? (
            <motion.div key="kid-book-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-kid-book-ending="">
              {/* B-KID-94: the ONE finish moment — the hero cheers and the child
                  keeps this book's sticker (its cover, die-cut), earned once. */}
              <div className="pt-4"><KidFinishMoment childId={childProfile.id} kind="book" refId={activeStory.id} lang={uiLang === "he" ? "he" : "en"} /></div>
              <div className="flex flex-col items-center gap-4 px-5 pt-5 text-center">
                <p lang={uiLang === "he" ? "he" : "en"} dir={langDir(uiLang === "he" ? "he" : "en")} className="font-black" style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 32, color: "var(--arbor-ink)" }}>{kidsStoriesText("journey.end", uiLang === "he" ? "he" : "en")}</p>
                <div className="flex w-full max-w-md flex-col gap-3">
                  <button type="button" onClick={readAgain} style={{ ...bigButton, background: "var(--arbor-green-cta-start)", color: "var(--arbor-on-accent)" }}>{kidsStoriesText("reader.again", uiLang === "he" ? "he" : "en")}</button>
                  <button type="button" onClick={exitJourney} style={{ ...bigButton, background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" }}>{kidsStoriesText("kidBooks.title", uiLang === "he" ? "he" : "en")}</button>
                </div>
              </div>
            </motion.div>
          ) : onCover ? (
            <motion.div key="kid-book-cover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-kid-book-cover="" className={KID_BOOK_SPREAD_CLASS}>
              {bookArtBox}
              <div className={KID_BOOK_SIDE_CLASS}>
              <p lang={renderLang} dir={langDir(renderLang)} data-kid-book-title="" className="font-black px-5 pt-4 text-center" style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1.2, color: "var(--arbor-ink)" }}>{isolateNameIn(render.title || activeStory.title, childProfile.name?.split(" ")[0], renderLang)}</p>
              {bookSide}
              </div>
            </motion.div>
          ) : displayScene ? (
            <motion.div key={`kid-book-${displayScene.beatId}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <HeroScenePlayer
                layout="book"
                scene={displayScene}
                storyId={activeStory.id}
                seed={`${activeStory.id}-${displayScene.beatId}-${childProfile.name}`}
                beatNumber={sceneIndex + 1}
                beatTotal={activeStory.beats.length}
                cameoUrl={heroCameoUrl}
                heroAvatarUrl={heroAvatarUrl}
                heroAvatarStyle={heroAvatarStyle}
                heroName={childProfile.name?.split(" ")[0]}
                childIdentity={childProfile.id}
                childId={childProfile.id}
                onPageResolved={({ beatNumber, key }) => { comicPageKeys.current.set(beatNumber, key); void shelveWhenComplete(); }}
                fallbackArtUrl={storyCover(activeStory.id)?.src}
                fallbackArtHasHero={storyCover(activeStory.id)?.hasHero ?? false}
                textLang={renderLang}
                aside={bookSide}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      {/* B-KID-53 polish: Kid Mode has no reader top row (the overlay carries
          back + title; full screen sits in the page meta row). */}
      {!kidMode && (
      <div className="flex items-center justify-between">
        {/* §3f row 4 — these two measured 20 px and 16 px tall: the way out of a
            story and the way into full screen, both under the touch floor. Both
            now clear 44 px, and both are keyed (they were English literals). */}
        {!kidMode && (<button
          onClick={exitJourney}
          className="inline-flex items-center gap-1.5 text-sm font-bold px-2 min-h-[44px]"
          style={{ color: "var(--arbor-muted)" }}
        >
          {/* R2: the child's way out of a book is not "All journeys" — that is
              the parent's word for a catalogue. Kid Mode gets the kid-register
              line it already has; the parent door keeps its own. */}
          <Icon name="arrow_back" size={16} style={uiLang === "he" ? { transform: "scaleX(-1)" } : undefined} />{" "}
          {kidMode ? kidsStoriesText("journey.backStories", aiLang) : t("elev.stories.reader.back")}
        </button>)}
        {!kidMode && <span className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{render.title}</span>}
        <div className="flex items-center gap-1">
          {!kidMode && (
            <button
              type="button"
              data-testid="stories-rewrite"
              onClick={() => { void rewriteStory(); }}
              disabled={rewriting}
              aria-busy={rewriting || undefined}
              className="inline-flex items-center text-sm font-bold px-2 min-h-[44px] disabled:opacity-50"
              style={{ color: "var(--arbor-muted)" }}
            >
              {t("elev.stories.reader.rewrite")}
            </button>
          )}
          {immersiveButton}
        </div>
      </div>
      )}

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
