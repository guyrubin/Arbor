import React, { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { kidModeOpenFor, TOGETHER_CARDS } from "../../lib/age/playGate";
import { useKidModeEntry } from "../kidmode/useKidModeEntry";
import { readParentPin } from "../kidmode/parentGate";
import { usePracticeData } from "../../practice/usePracticeData";
import { useChildCollection } from "../../hooks/useChildCollection";
import { SINCE_LAST_PLAY_FALLBACK_MS } from "../../lib/kidExitRecap";
import { lastKidSessionStartedAt } from "../../lib/kidModeGate";
import { genderedKey } from "../../lib/today/fromRecord";
import { pillRowFor, sectionForTab } from "../../lib/navigation";
import { routeHash } from "../../lib/routes";
import { ageYearsOf } from "../../lib/age/forChild";
import { localizeActivity } from "../../playbank/content";
import { concernDomainsFromLogs, daySeedFor, selectDailyPlay, type SessionLength } from "../../playbank/select";
import { activeGoalDomains, focusGoal } from "../../practice/goalBuilder";
import { DOMAIN_VARS } from "../../lib/tokens";
import type { HeroJourneyRun } from "../../types";
import { requestOpenSettings } from "../layout/settingsBus";
import { latestPlayedWorldId, opensInKidMode, studioCountKey, studioCountsSince, studioWorldsForChild, worksInLanguage, type StudioWorld } from "../practice/studioWorlds";
import Icon from "../ui/Icon";
import { EmptyState } from "../ui/EmptyState";
import { Sheet } from "../ui/Sheet";
import { OFFSCREEN_IDEAS, WORLD_ART, type TogetherCategory } from "./companionChoices";
import { trackCompanionPlaceOpen, trackPracticeStudioOpen, trackPracticeTogetherDid } from "../../lib/kpiEvents";
import { TOGETHER_ART } from "../../lib/parentArt";
import { useTogetherNavigation } from "./togetherNavigation";
import { openFamilyTopicSheet } from "./familyTopicEvents";
import TogetherRoutines from "./TogetherRoutines";
import TogetherStories from "./TogetherStories";
import "./companionExperience.css";
import "./togetherDiscovery.css";
// FEAT-05: the shared question-chip rules (44px hit area, pill) live here.
import "./companionWorkspace.css";

// v3 F-TOG-2: the bedtime story maker is a sheet on Together, no longer a page.
const BedtimeStoryBody = lazy(() => import("../tabs/BedtimeStoriesTab").then((module) => ({ default: module.BedtimeStoryBody })));

type Preview = { kind: "world"; world: StudioWorld };

/** Parent previews lead to the existing child-mode entry seam. Nothing on this
 * page starts a camera/microphone or writes an activity just because it is seen.
 *
 * v3 F-TOG-2: the five pills (All together, Games, Stories, Routines, Away
 * from the screen) are #/practice?f=…; this page reads f and shows that pill's
 * content. The Shell draws the row once PLACE_PILLS.together exists
 * (F-SHELL-1); until then the page draws the same five links itself, so
 * exactly one row shows. An old link arrives as a query on the same address
 * (TOGETHER_ARRIVAL_QUERY): ?world=<id> opens that world's preview (#/speech,
 * #/mimic …) and ?sheet=create-story the story maker (#/bedtime-stories). */
export default function TogetherView() {
  const { childProfile, setActiveTab, saveMoment, activeFamilyTopic, openCaptureSheet, behaviorLogs = [], logsLoaded = false, actionLoop = [] } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const lang = he ? "he" : "en";
  const name = childProfile.name?.split(" ")[0] || (t("companion.together-view.your-child"));
  const [previewState, setPreviewState] = useState<{ childId: string; value: Preview | null }>({ childId: childProfile.id, value: null });
  const [keptState, setKeptState] = useState<{ childId: string; ids: string[] }>({ childId: childProfile.id, ids: [] });
  const kept = keptState.childId === childProfile.id ? keptState.ids : [];
  const [createState, setCreateState] = useState<{ childId: string; open: boolean }>({ childId: childProfile.id, open: false });
  const { request: requestKidMode, step: heroStep } = useKidModeEntry();
  const { worlds } = studioWorldsForChild(lang, childProfile);
  const kidAvailable = kidModeOpenFor(childProfile);
  const gamesOpen = kidAvailable && worlds.length > 0;
  const { category, setCategory, pageRef, rememberDoor, query } = useTogetherNavigation(childProfile.id, gamesOpen);
  const ids = useId();
  // v3 F-TOG-2: the page's own pill row stands in until the Shell draws one.
  const shellDrawsPills = pillRowFor(sectionForTab("practice"), "practice").length > 1;
  const pills: readonly { id: TogetherCategory; key: string }[] = [
    { id: "all", key: "companion.together-view.all-together" },
    ...(gamesOpen ? [{ id: "games" as const, key: "companion.together-view.games" }] : []),
    { id: "stories", key: "companion.together-view.stories" },
    { id: "routines", key: "companion.together-view.routines" },
    { id: "offscreen", key: "companion.together-view.away-from-the-screen" },
  ];
  useEffect(() => { setPreviewState({ childId: childProfile.id, value: null }); setKeptState({ childId: childProfile.id, ids: [] }); }, [childProfile.id]);
  useEffect(() => { trackCompanionPlaceOpen("together"); }, [childProfile.id]);

  // v3 F-TOG-2: an arrival's sheet opens once per address; closing it names
  // the pill alone in the address (no new history entry, so no hashchange),
  // and a later arrival at the same address opens it again.
  const queryKey = query.toString();
  const [settledKey, setSettledKey] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reopen = () => setSettledKey(null);
    window.addEventListener("hashchange", reopen);
    return () => window.removeEventListener("hashchange", reopen);
  }, []);
  const arrival = settledKey === queryKey ? null : query;
  const arrivedWorld = gamesOpen && arrival ? worlds.find((world) => world.id === arrival.get("world")) : undefined;
  const settleArrival = () => {
    if (!arrival || (!arrival.has("world") && arrival.get("sheet") !== "create-story")) return;
    setSettledKey(queryKey);
    try { window.history.replaceState(window.history.state, "", `#${routeHash("practice", { f: category })}`); } catch { /* the sheet closed either way */ }
  };
  const localPreview = previewState.childId === childProfile.id ? previewState.value : null;
  const preview: Preview | null = localPreview ?? (arrivedWorld ? { kind: "world", world: arrivedWorld } : null);
  const setPreview = (value: Preview | null) => setPreviewState({ childId: childProfile.id, value });
  const closePreview = () => { setPreview(null); settleArrival(); };
  const createOpen = (createState.childId === childProfile.id && createState.open) || arrival?.get("sheet") === "create-story";
  const openCreate = () => setCreateState({ childId: childProfile.id, open: true });
  const closeCreate = () => { setCreateState({ childId: childProfile.id, open: false }); settleArrival(); };

  // B-PLAY-02: each world counts in its own unit, over the window since the
  // latest Kid Mode session began (7 days when none is known). v3 F-TOG-2: the
  // count shows on every pill (a plain count, never a score).
  // v3 F-TOG-1: the "what {name} played" sentence left Together's hero — kid-world
  // moments surface in Now ("From {name}'s world today") and in Moments.
  const practiceData = usePracticeData(childProfile.id);
  const heroRuns = useChildCollection<HeroJourneyRun>(childProfile.id, "heroRuns");
  const playWindow = useMemo(() => {
    const known = lastKidSessionStartedAt();
    return { sinceMs: known ?? Date.now() - SINCE_LAST_PLAY_FALLBACK_MS };
  }, [childProfile.id]);
  const counts = useMemo(
    () => studioCountsSince({ speech: practiceData.speech, mimic: practiceData.mimic, adventures: practiceData.adventures, events: practiceData.events }, playWindow.sinceMs),
    [practiceData.speech, practiceData.mimic, practiceData.adventures, practiceData.events, playWindow.sinceMs],
  );
  const playCollections = [practiceData.speech, practiceData.mimic, practiceData.missions, practiceData.adventures, practiceData.events, heroRuns];
  const playLoaded = playCollections.every((collection) => collection.loaded);
  const playError = playCollections.some((collection) => collection.error);
  // VIS-07: the first-time empty state, decided only once every read resolved
  // and none failed (a failed read is never "empty"): no play on record and
  // no moment kept yet, the same "no records" that empties My child.
  const firstTime = playLoaded && !playError && logsLoaded && behaviorLogs.length === 0
    && playCollections.every((collection) => collection.items.length === 0);
  const pinSet = Boolean(readParentPin());
  const show = (id: TogetherCategory) => category === "all" || category === id;
  // v3 F-TOG-1: the hero CTA and the doors choose a pill, then bring its
  // heading into view and give it focus (the heading carries tabIndex -1).
  // v3 F-TOG-2: the pill is the address, so the focus waits for it to land.
  const focusHeading = (next: TogetherCategory) => {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    window.requestAnimationFrame(() => {
      const heading = document.getElementById(`${ids}-${next}`);
      if (!heading || heading.closest("[hidden]")) return;
      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      heading.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
      heading.focus({ preventScroll: true });
    });
  };
  const pendingFocus = useRef<TogetherCategory | null>(null);
  useEffect(() => {
    if (pendingFocus.current !== category) return;
    pendingFocus.current = null;
    focusHeading(category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);
  const goTo = (next: "games" | "offscreen") => {
    if (category === next) { focusHeading(next); return; }
    pendingFocus.current = next;
    setCategory(next);
  };
  // "Continue a favorite": the preview of the world played most recently, else the games.
  const continueFavorite = () => {
    const id = latestPlayedWorldId({ speech: practiceData.speech, mimic: practiceData.mimic, adventures: practiceData.adventures, events: practiceData.events }, worlds);
    const world = worlds.find((w) => w.id === id);
    if (world) setPreview({ kind: "world", world });
    else goTo("games");
  };
  const openWorld = (world: StudioWorld) => {
    // v3 F-TOG-2: a voice game that does not speak this language yet stays a
    // preview; no English drill page opens in its place.
    if (!worksInLanguage(world, lang)) return;
    closePreview();
    const direct = !opensInKidMode(world) && !!world.tab;
    trackPracticeStudioOpen(world.id, direct ? "direct" : "kidmode");
    if (direct && world.tab) { rememberDoor(`world-${world.id}`); setActiveTab(world.tab); }
    else requestKidMode({ view: "arcade", worldId: world.id });
  };
  // v3 F-TOG-2: Daily play's picks (#/daily-play lands on this pill) join the
  // ideas: the same selection, whole on the card. No reason line, no done or
  // plan state; keeping one saves a moment, like any idea here.
  const goalDomains = useMemo(() => {
    const goal = focusGoal(childProfile.activeGoals ?? []);
    return activeGoalDomains(goal ? [goal] : []);
  }, [childProfile.activeGoals]);
  const playPicks = useMemo(() => {
    const stored = (name: string) => { try { return localStorage.getItem(`${name}.${childProfile.id}`); } catch { return null; } };
    let doneIds: string[] = [];
    try { const parsed: unknown = JSON.parse(stored("arbor.play.done") || "[]"); if (Array.isArray(parsed)) doneIds = parsed.filter((value): value is string => typeof value === "string"); } catch { /* none recorded */ }
    const length = stored("arbor.play.sessionLength");
    const sessionLength: SessionLength = length === "short" || length === "extended" ? length : "standard";
    const concernDomains = concernDomainsFromLogs(behaviorLogs.map((log) => ({ behaviorType: log.behaviorType, timestamp: log.timestamp })), Date.now());
    const last = actionLoop.find((entry) => entry.status === "completed" && entry.outcome);
    return selectDailyPlay({
      ageYears: ageYearsOf(childProfile),
      concernDomains,
      goalDomains,
      recentlyDoneIds: doneIds,
      daySeed: daySeedFor(Date.now()),
      interests: childProfile.interests ?? [],
      sessionLength,
      lastAction: last?.outcome ? { recommendation: last.recommendation, outcome: last.outcome } : undefined,
    }, 3).map((pick) => localizeActivity(pick.activity, lang));
  }, [childProfile, behaviorLogs, actionLoop, goalDomains, lang]);
  type AwayCard = { id: string; title: string; detail: string; say?: string; steps?: readonly string[]; icon: string; moment: string };
  const awayCards: AwayCard[] = [
    ...(kidAvailable
      ? OFFSCREEN_IDEAS.map((idea) => ({ id: idea.id, title: idea.title[lang], detail: idea.detail[lang], say: idea.say[lang], icon: idea.icon, moment: t("companion.together-view.we-tried-together", { value0: idea.title[lang] }) }))
      : TOGETHER_CARDS.map((id) => ({ id, title: t(`elev.ages.together.${id}.title`), detail: t(`elev.ages.together.${id}.do`), say: t(`elev.ages.together.${id}.say`), icon: "favorite", moment: t(`elev.ages.together.${id}.moment`) }))),
    ...playPicks.map((activity) => ({ id: `play-${activity.id}`, title: activity.title, detail: activity.whatItBuilds, steps: activity.steps, icon: "eco", moment: t("companion.together-view.we-tried-together", { value0: activity.title }) })),
  ];
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const keepOffline = async (card: AwayCard) => {
    const id = card.id;
    if (kept.includes(id) || saving) return;
    setSaving(true); setSaveError(false);
    const moment = card.moment;
    // The inline alert is this failure's one message; the seam stays quiet.
    // The card turns to "saved" only once the write resolved.
    try {
      if (await saveMoment(moment, { callerShowsFailure: true })) { setKeptState({ childId: childProfile.id, ids: [...kept, id] }); trackPracticeTogetherDid(id); }
      else setSaveError(true);
    }
    catch { setSaveError(true); }
    finally { setSaving(false); }
  };
  const worldArt = (world: StudioWorld) => ({
    src: `/visuals/cards/web/game-${WORLD_ART[world.id]}-480.webp`,
    srcSet: `/visuals/cards/web/game-${WORLD_ART[world.id]}-480.webp 1x, /visuals/cards/web/game-${WORLD_ART[world.id]}-1024.webp 2x`,
  });

  return (
    <div ref={pageRef} className="companion-page companion-together" dir={he ? "rtl" : "ltr"}>
      {/* v3 F-TOG-2: the five pills, drawn here only while the Shell draws no row (exactly one row shows). */}
      {!shellDrawsPills && <div role="group" className="together-pill-row" data-testid="together-pill-row" aria-label={t("nav.pills.aria", { place: t("companion.place.together") })}>
        {pills.map((pill) => <button key={pill.id} type="button" className="together-pill" data-pill={pill.id} aria-pressed={category === pill.id} onClick={() => { if (category !== pill.id) setCategory(pill.id); }}>{t(pill.key)}</button>)}
      </div>}
      {/* v3 F-TOG-1: the hero — kicker, title, sub, the one move and the studio doors beside the Together picture. */}
      <section className={`companion-together-hero${firstTime ? " together-hero-solo" : ""}`} data-module="together-invitation" aria-labelledby={`${ids}-title`}>
        <div className="together-hero-copy">
          <span className="companion-eyebrow together-kicker">{t("companion.together-view.kicker")}</span>
          <h1 id={`${ids}-title`} className="arbor-type-hero">{t("companion.together-view.a-little-world-to-discover-with", { value0: name })}</h1>
          {/* VIS-07: while the empty state below speaks, the hero does not repeat its sentence or its picture. */}
          {!firstTime && <p className="together-hero-sub">{t("companion.together-view.a-story-to-get-lost-in-a-game-to-wonder-at")}</p>}
          <button type="button" className="companion-primary together-hero-cta" data-primary-move="choose-together" data-testid="together-cta" onClick={() => goTo("offscreen")}><Icon name="favorite" size={19} />{t("companion.together-view.one-small-idea-for-time-together")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button>
          {/* The studio doors: wide layouts only (the stylesheet hides them on a phone). */}
          <div className="together-doors" data-testid="together-doors">
            <button type="button" className="together-door" data-testid="together-door-story" onClick={openCreate}><Icon name="auto_stories" size={18} />{t("companion.together-view.door-create-story")}</button>
            {gamesOpen && <>
              <button type="button" className="together-door" data-testid="together-door-continue" onClick={continueFavorite}><Icon name="replay" size={18} />{t("companion.together-view.door-continue-favorite")}</button>
              <button type="button" className="together-door" data-testid="together-door-find" onClick={() => goTo("games")}><Icon name="extension" size={18} />{t("companion.together-view.door-find-play")}</button>
            </>}
          </div>
        </div>
        {!firstTime && <figure className="companion-together-art" aria-hidden="true"><img src={TOGETHER_ART.src} srcSet={TOGETHER_ART.srcSet} width={TOGETHER_ART.width} height={TOGETHER_ART.height} alt="" /></figure>}
      </section>

      {/* FEAT-05: the question line is the chip that opens the question sheet (no count, no dot). */}
      {activeFamilyTopic && <div className="companion-topic-context" data-testid="together-question-row">
        <button type="button" className="companion-topic-chip" data-testid="together-topic-chip" aria-haspopup="dialog" onClick={() => openFamilyTopicSheet()}>
          <span className="companion-topic-chip-pill"><Icon name="bookmark" size={18} className="companion-topic-chip-icon" /><span className="companion-topic-chip-text">{t("companion.together-view.your-question-stays-with-you")}<b dir="auto">{activeFamilyTopic.title}</b></span></span>
        </button>
        <span className="companion-caption">{t("companion.together-view.here-it-is-also-enough-just-to-enjoy")}</span>
      </div>}

      {/* VIS-07: one calm first-time empty state: the Together picture, one sentence, one action (Keep a moment). */}
      {firstTime && <section className="together-empty-card" data-testid="together-empty">
        <EmptyState illustration={TOGETHER_ART} headline={t("companion.together-view.empty")} cta={t("companion.portrait.capture")} onCta={() => openCaptureSheet()} ctaTestId="together-empty-cta" className="together-empty" />
      </section>}

      {/* v3 F-TOG-1: the mock's order — games, stories, routines, away from the screen, then the gate card.
          v3 F-TOG-2: every pill shows all of its cards; the Shell's pill row replaces the "All …" links. */}
      {kidAvailable && <section hidden={!show("games")} className="companion-collection" data-module="together-games" aria-labelledby={`${ids}-games`}>
        <div className="companion-section-heading"><div><span className="companion-eyebrow">{t("companion.together-view.first-choose-then-play")}</span><h2 id={`${ids}-games`} tabIndex={-1}>{t("companion.together-view.little-invitations-to-play")}</h2></div></div>
        {worlds.length ? <ul className="together-game-grid">{worlds.map((world) => {
          const domain = world.domains[0];
          return <li key={world.id}><button type="button" data-together-return={`world-${world.id}`} className="together-game-card" onClick={() => setPreview({ kind: "world", world })}>
            <img className="together-game-art" src={worldArt(world).src} srcSet={worldArt(world).srcSet} alt="" width="480" height="320" loading="lazy" decoding="async" />
            <span className="together-game-copy">
              <span className="together-game-title">{t(world.kidNameKey)}</span>
              {domain && <span className="together-domain-chip" style={{ background: DOMAIN_VARS[domain].soft, color: DOMAIN_VARS[domain].ink }}>{t(`elev.domains.${domain}`)}</span>}
              <span className="together-game-meta" aria-busy={!playLoaded}>{playLoaded && (counts.byWorld[world.id] ?? 0) > 0 && <span className="companion-world-count" data-testid="together-world-count">{t(studioCountKey(world.unit, counts.byWorld[world.id]), { n: counts.byWorld[world.id] })}</span>}<span className="together-game-preview">{worksInLanguage(world, lang) ? t("companion.together-view.preview-first") : t("companion.together-view.english-only")}</span></span>
            </span>
          </button></li>;
        })}</ul> : <p className="companion-caption">{t("companion.together-view.there-are-no-listed-screen-games-for-this")}</p>}
      </section>}

      <section hidden={!show("stories")} className="companion-collection" data-module="together-stories" aria-labelledby={`${ids}-stories`}>
        {show("stories") && <TogetherStories headingId={`${ids}-stories`} onCreate={openCreate} />}
      </section>

      {/* FEAT-07 → v3 F-TOG-1: the ready-made routines are a module of their own. */}
      <section hidden={!show("routines")} className="companion-collection" data-module="together-routines" aria-labelledby={`${ids}-routines`}>
        {show("routines") && <TogetherRoutines mode={category === "routines" ? "routines" : "all"} headingId={`${ids}-routines`} />}
      </section>

      {/* v3 F-TOG-2: every idea, whole, on its card: what to do, what to say,
          and "keep the moment" in place. "Saved" shows once the write resolved. */}
      <section hidden={!show("offscreen")} className="companion-collection" data-module="together-offscreen" aria-labelledby={`${ids}-offscreen`}>
        <div className="companion-section-heading"><div><span className="companion-eyebrow">{t("companion.together-view.in-everyday-life")}</span><h2 id={`${ids}-offscreen`} tabIndex={-1}>{t("companion.together-view.something-small-to-do-together")}</h2></div></div>
        <ul className="companion-offscreen-grid together-away-grid">{awayCards.map((idea) => {
          const id = idea.id;
          const done = kept.includes(id);
          return <li key={id} className="together-away-card" data-testid={`together-away-${id}`}>
            <Icon name={idea.icon} size={26} className="together-away-icon" />
            <h3>{idea.title}</h3>
            <p className="together-away-detail">{idea.detail}</p>
            {idea.say && <p className="companion-say" dir="auto">{t("elev.loop.ms.quoted", { text: idea.say })}</p>}
            {idea.steps && idea.steps.length > 0 && <ol className="together-away-steps">{idea.steps.map((step, n) => <li key={n}>{step}</li>)}</ol>}
            <button type="button" className="together-keep" data-testid="together-keep" data-kept={done ? "true" : undefined} disabled={saving || kept.includes(id)} onClick={() => void keepOffline(idea)}><Icon name={done ? "check_circle" : "bookmark_add"} size={18} />{done ? (t("companion.together-view.a-moment-from-your-time-together-is-saved")) : (t("companion.together-view.we-already-tried-it-keep-the-moment"))}</button>
          </li>;
        })}</ul>
        {saveError && <p role="alert" className="companion-caption" data-testid="together-keep-failed">{t("companion.together-view.the-moment-wasn-t-saved-please-try-again")}</p>}
      </section>

      {/* v3 F-TOG-1: one gate card at every width — the way into play. The PIN
          facts (locked, private, stars) live in Settings › PIN; under three only
          the from-three line shows. */}
      <div className="together-gate" data-testid="together-gate">
        {kidAvailable ? <>
          <span className="together-gate-mark" aria-hidden="true"><Icon name="lock" size={21} fill={1} /></span>
          <p className="together-gate-note">{pinSet ? (t("companion.together-view.you-choose-when-to-enter-play-your-pin-pro")) : (t("companion.together-view.play-opens-in-the-child-area-set-a-pin-to"))}</p>
          <div className="together-gate-actions">
            {!pinSet && <button type="button" className="companion-text-button" data-testid="together-gate-pin" onClick={() => requestOpenSettings({ focus: "pin" })}>{t("companion.together-view.parent-settings")}</button>}
            <button type="button" className="together-start" data-testid="together-start-playing" onClick={() => { trackPracticeStudioOpen("kidmode", "hero"); requestKidMode(); }}><Icon name="play_arrow" size={18} />{t("companion.together-view.start-playing")}</button>
          </div>
        </> : <p dir="auto" className="together-gate-note">{t(genderedKey("elev.ages.practice.fromThree", childProfile.gender), { name })}</p>}
      </div>
      {heroStep}
      {/* v3 F-TOG-2: a world's preview is a sheet; play starts only through the Kid Mode gate. */}
      {preview && <Sheet open onClose={closePreview} title={t(preview.world.kidNameKey)}>
        <div className="together-sheet companion-preview" data-testid="together-world-preview" data-world={preview.world.id} dir={he ? "rtl" : "ltr"}>
          <img src={worldArt(preview.world).src} srcSet={worldArt(preview.world).srcSet} width="480" height="320" alt="" decoding="async" />
          <p>{t(`practice.world.${preview.world.key}.skill`)}</p>
          <p className="companion-caption">{!worksInLanguage(preview.world, lang) ? (t("companion.together-view.this-voice-game-is-currently-in-english-op")) : opensInKidMode(preview.world) ? (t("companion.together-view.when-you-are-ready-enter-the-child-area-yo")) : (t("companion.together-view.open-the-language-tools-in-the-parent-area"))}</p>
          {worksInLanguage(preview.world, lang) && <button type="button" className="companion-primary" data-testid="together-world-open" onClick={() => openWorld(preview.world)}><Icon name="play_arrow" size={20} />{opensInKidMode(preview.world) ? (t("companion.together-view.start-playing")) : (t("companion.together-view.open"))}</button>}
        </div>
      </Sheet>}
      {/* v3 F-TOG-2: "Create a story" (the hero door or the Stories pill) opens the story maker in place. */}
      {createOpen && <Sheet open onClose={closeCreate} title={t("companion.together-view.door-create-story")}>
        <div className="together-sheet together-create-sheet" data-testid="together-create-sheet" dir={he ? "rtl" : "ltr"}>
          <Suspense fallback={<p role="status" className="companion-caption">{t("companion.together-view.story-opening")}</p>}>
            <BedtimeStoryBody embedded />
          </Suspense>
        </div>
      </Sheet>}
    </div>
  );
}
