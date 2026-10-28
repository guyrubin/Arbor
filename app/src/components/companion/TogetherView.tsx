import React, { useEffect, useId, useMemo, useState } from "react";
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
import type { HeroJourneyRun } from "../../types";
import { requestOpenSettings } from "../layout/settingsBus";
import { latestPlayedWorldId, opensInKidMode, studioCountKey, studioCountsSince, studioWorldsForChild, worksInLanguage, type StudioWorld } from "../practice/studioWorlds";
import Icon from "../ui/Icon";
import { BrandChip } from "../ui/BrandChip";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";
import { Sheet, useCompactSurface } from "../ui/Sheet";
import { OFFSCREEN_IDEAS, STORY_DOORS, worldArtSrc, type TogetherCategory } from "./companionChoices";
import { trackCompanionPlaceOpen, trackPracticeStudioOpen, trackPracticeTogetherDid } from "../../lib/kpiEvents";
import { TOGETHER_ART } from "../../lib/parentArt";
import { useTogetherNavigation } from "./togetherNavigation";
import { openFamilyTopicSheet } from "./familyTopicEvents";
import TogetherRoutines from "./TogetherRoutines";
import "./companionExperience.css";
import "./togetherDiscovery.css";
// FEAT-05: the shared question-chip rules (44px hit area, pill) live here.
import "./companionWorkspace.css";

type Preview = { kind: "world"; world: StudioWorld } | { kind: "offscreen"; id: string } | { kind: "story"; id: string };
type StoryDoorId = "story-library" | "story-bedtime" | "story-comics" | "story-family";

/** Parent previews lead to the existing child-mode entry seam. Nothing on this
 * page starts a camera/microphone or writes an activity just because it is seen. */
export default function TogetherView() {
  const { childProfile, setActiveTab, saveMoment, activeFamilyTopic, openCaptureSheet, behaviorLogs = [], logsLoaded = false } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const lang = he ? "he" : "en";
  const name = childProfile.name?.split(" ")[0] || (t("companion.together-view.your-child"));
  const [previewState, setPreviewState] = useState<{ childId: string; value: Preview | null }>({ childId: childProfile.id, value: null });
  const preview = previewState.childId === childProfile.id ? previewState.value : null;
  const setPreview = (value: Preview | null) => setPreviewState({ childId: childProfile.id, value });
  const [keptState, setKeptState] = useState<{ childId: string; ids: string[] }>({ childId: childProfile.id, ids: [] });
  const kept = keptState.childId === childProfile.id ? keptState.ids : [];
  const { request: requestKidMode, step: heroStep } = useKidModeEntry();
  const { worlds } = studioWorldsForChild(lang, childProfile);
  const kidAvailable = kidModeOpenFor(childProfile);
  const gamesOpen = kidAvailable && worlds.length > 0;
  const { category, setCategory, pageRef, rememberDoor } = useTogetherNavigation(childProfile.id, gamesOpen);
  const filterId = useId();
  // v3 F-TOG-3: below lg a preview is a bottom sheet (grab handle, thumb-reach close); Modal stays the wide answer.
  const PreviewSurface = useCompactSurface() ? Sheet : Modal;
  useEffect(() => { setPreview(null); setKeptState({ childId: childProfile.id, ids: [] }); }, [childProfile.id]);
  useEffect(() => { trackCompanionPlaceOpen("together"); }, [childProfile.id]);

  // B-PLAY-02: the Games filter counts each world in its own unit, over the
  // window since the latest Kid Mode session began (7 days when none is known).
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
  // v4: three filters, Routines · Play · Stories, as Together's first level
  // (the place pills of Now and My child sit in the same spot). Play holds the
  // games (when open for this child) and the away-from-the-screen ideas, so it
  // exists at every age. Label-only pills, like the place pills.
  const filters: { id: TogetherCategory; label: string }[] = [
    { id: "routines", label: t("companion.together-view.routines") },
    { id: "games", label: t("companion.together-view.play") },
    { id: "stories", label: t("companion.together-view.stories") },
  ];
  type Section = "games" | "stories" | "routines" | "offscreen";
  const show = (section: Section) => (section === "games" || section === "offscreen" ? category === "games" : category === section);
  // v3 F-TOG-1: the hero CTA and the doors choose a category, then bring its
  // heading into view and give it focus (the heading carries tabIndex -1).
  const goTo = (next: "games" | "offscreen") => {
    setCategory(next);
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    window.requestAnimationFrame(() => {
      const heading = document.getElementById(`${filterId}-${next}`);
      if (!heading) return;
      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      heading.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
      heading.focus({ preventScroll: true });
    });
  };
  // "Continue a favorite": the preview of the world played most recently, else the games.
  const continueFavorite = () => {
    const id = latestPlayedWorldId({ speech: practiceData.speech, mimic: practiceData.mimic, adventures: practiceData.adventures, events: practiceData.events }, worlds);
    const world = worlds.find((w) => w.id === id);
    if (world) setPreview({ kind: "world", world });
    else goTo("games");
  };
  const openWorld = (world: StudioWorld) => {
    setPreview(null);
    const direct = (!opensInKidMode(world) || !worksInLanguage(world, lang)) && !!world.tab;
    trackPracticeStudioOpen(world.id, direct ? "direct" : "kidmode");
    if (direct && world.tab) { rememberDoor(`world-${world.id}`); setActiveTab(world.tab); }
    else requestKidMode({ view: "arcade", worldId: world.id });
  };
  const offlineIds: readonly string[] = kidAvailable ? OFFSCREEN_IDEAS.map((idea) => idea.id) : TOGETHER_CARDS;
  const offline = (id: string) => {
    const idea = OFFSCREEN_IDEAS.find((item) => item.id === id);
    return idea ? { title: idea.title[lang], detail: idea.detail[lang], say: idea.say[lang], icon: idea.icon }
      : { title: t(`elev.ages.together.${id}.title`), detail: t(`elev.ages.together.${id}.do`), say: t(`elev.ages.together.${id}.say`), icon: "favorite" };
  };
  // v4 (blueprint decision 3): a story opens as a sheet over Together — its
  // picture, what it is and the one way in — instead of leaving at once for a
  // full tab. The reader routes keep their own flows (the library's book
  // reader is the child's, in Kid Mode; comics keep their creation flow).
  const storyOf = (id: string) => STORY_DOORS.find((story) => story.id === id) ?? null;
  const openStory = (id: string) => {
    const story = storyOf(id);
    if (!story) return;
    setPreview(null);
    rememberDoor(`story-${story.id}` as StoryDoorId);
    setActiveTab(story.tab);
  };
  const previewTitle = preview?.kind === "world" ? t(preview.world.kidNameKey)
    : preview?.kind === "story" ? storyOf(preview.id)?.title[lang] ?? ""
    : preview ? offline(preview.id).title : "";
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const keepOffline = async (id: string) => {
    if (kept.includes(id) || saving) return;
    setSaving(true); setSaveError(false);
    const idea = offline(id);
    const moment = kidAvailable ? (t("companion.together-view.we-tried-together", { value0: idea.title })) : t(`elev.ages.together.${id}.moment`);
    // The inline alert is this failure's one message; the seam stays quiet.
    try {
      if (await saveMoment(moment, { callerShowsFailure: true })) { setKeptState({ childId: childProfile.id, ids: [...kept, id] }); trackPracticeTogetherDid(id); }
      else setSaveError(true);
    }
    catch { setSaveError(true); }
    finally { setSaving(false); }
  };

  return (
    <div ref={pageRef} className="companion-page companion-together" dir={he ? "rtl" : "ltr"}>
      {/* v4: Together's first level — Routines · Play · Stories — where the place pills sit on Now and My child. */}
      <div className="companion-filter-row together-pills" role="group" aria-label={t("companion.together-view.what-feels-right-now")}>
        {filters.map((filter) => <button key={filter.id} type="button" className="companion-filter" aria-pressed={category === filter.id} onClick={() => setCategory(filter.id)}>{filter.label}</button>)}
      </div>

      {/* v3 F-TOG-1: the hero — kicker, title, sub, the one move and the studio doors beside the Together picture. */}
      <section className={`companion-together-hero${firstTime ? " together-hero-solo" : ""}`} data-module="together-invitation" aria-labelledby={`${filterId}-title`}>
        <div className="together-hero-copy">
          <span className="companion-eyebrow together-kicker">{t("companion.together-view.kicker")}</span>
          <h1 id={`${filterId}-title`} className="arbor-type-hero">{t("companion.together-view.a-little-world-to-discover-with", { value0: name })}</h1>
          {/* VIS-07: while the empty state below speaks, the hero does not repeat its sentence or its picture. */}
          {!firstTime && <p className="together-hero-sub">{t("companion.together-view.a-story-to-get-lost-in-a-game-to-wonder-at")}</p>}
          <button type="button" className="companion-primary together-hero-cta" data-primary-move="choose-together" data-testid="together-cta" onClick={() => goTo("offscreen")}><Icon name="favorite" size={19} />{t("companion.together-view.one-small-idea-for-time-together")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button>
          {/* The studio doors: wide layouts only (the stylesheet hides them on a phone). */}
          {/* v4: each door wears the brand chip (the one icon object), chip beside label. */}
          <div className="together-doors" data-testid="together-doors">
            <button type="button" className="together-door" data-testid="together-door-story" onClick={() => { rememberDoor("story-bedtime"); setActiveTab("bedtime-stories"); }}><BrandChip icon="auto_stories" tone="pink" shape="leaf" size={32} />{t("companion.together-view.door-create-story")}</button>
            {gamesOpen && <>
              <button type="button" className="together-door" data-testid="together-door-continue" onClick={continueFavorite}><BrandChip icon="replay" tone="lav" shape="arch" size={32} />{t("companion.together-view.door-continue-favorite")}</button>
              <button type="button" className="together-door" data-testid="together-door-find" onClick={() => goTo("games")}><BrandChip icon="extension" tone="green" shape="drop" size={32} />{t("companion.together-view.door-find-play")}</button>
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

      {/* v3 F-TOG-1 order — games, stories, routines, away from the screen, then the gate card.
          v4: one filter shows at a time — Play is the games and the away ideas. */}
      {kidAvailable && <section hidden={!show("games")} className="companion-collection" data-module="together-games" aria-labelledby={`${filterId}-games`}>
        <div className="companion-section-heading"><div><span className="companion-eyebrow">{t("companion.together-view.first-choose-then-play")}</span><h2 id={`${filterId}-games`} tabIndex={-1}>{t("companion.together-view.little-invitations-to-play")}</h2></div></div>
        {worlds.length ? <div className="companion-world-grid">{worlds.map((world) => <button key={world.id} type="button" data-together-return={`world-${world.id}`} className="companion-world-card" onClick={() => setPreview({ kind: "world", world })}><img src={worldArtSrc(world.id).src480} srcSet={`${worldArtSrc(world.id).src480} 1x, ${worldArtSrc(world.id).src} 2x`} alt="" width="480" height="320" loading="lazy" decoding="async" /><div><h3>{t(world.kidNameKey)}</h3>{category === "games" && <div className="together-world-count-slot" aria-busy={!playLoaded}>{category === "games" && (counts.byWorld[world.id] ?? 0) > 0 && <span className="companion-world-count" data-testid="together-world-count">{t(studioCountKey(world.unit, counts.byWorld[world.id]), { n: counts.byWorld[world.id] })}</span>}</div>}<p>{t(`practice.world.${world.key}.skill`)}</p><span className="companion-door-link">{t("companion.together-view.preview-before-playing")}<Icon name="arrow_forward" size={17} className="companion-arrow rtl:-scale-x-100" /></span></div></button>)}</div> : <p className="companion-caption">{t("companion.together-view.there-are-no-listed-screen-games-for-this")}</p>}
      </section>}

      <section hidden={!show("stories")} className="companion-collection" data-module="together-stories" aria-labelledby={`${filterId}-stories`}>
        <div className="companion-section-heading"><div><span className="companion-eyebrow">{t("companion.together-view.read-imagine-talk")}</span><h2 id={`${filterId}-stories`}>{t("companion.together-view.which-story-shall-we-step-into")}</h2></div></div>
        <div className="companion-story-grid">{STORY_DOORS.map((story) => <button key={story.id} type="button" className="companion-story-card" data-together-return={`story-${story.id}`} aria-haspopup="dialog" onClick={() => setPreview({ kind: "story", id: story.id })}><div className="companion-card-art"><img src={story.art} alt="" loading="lazy" width="480" height="320" /><span className="companion-art-label"><Icon name={story.icon} size={16} />{t("companion.together-view.choose-and-preview")}</span></div><div className="companion-card-copy"><h3>{story.title[lang]}</h3><p>{story.detail[lang]}</p><span className="companion-door-link">{t("companion.together-view.explore")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></span></div></button>)}</div>
      </section>

      {/* FEAT-07 → v3 F-TOG-1: the ready-made routines are a module of their own. */}
      <section hidden={!show("routines")} className="companion-collection" data-module="together-routines" aria-labelledby={`${filterId}-routines`}>
        {show("routines") && <TogetherRoutines headingId={`${filterId}-routines`} />}
      </section>

      <section hidden={!show("offscreen")} className="companion-collection" data-module="together-offscreen" aria-labelledby={`${filterId}-offscreen`}>
        <div className="companion-section-heading"><div><span className="companion-eyebrow">{t("companion.together-view.in-everyday-life")}</span><h2 id={`${filterId}-offscreen`} tabIndex={-1}>{t("companion.together-view.something-small-to-do-together")}</h2></div><button type="button" className="companion-text-button" data-together-return="more-ideas" onClick={() => { rememberDoor("more-ideas"); setActiveTab("daily-play"); }}>{t("companion.together-view.more-ideas")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button></div>
        <div className="companion-offscreen-grid">{offlineIds.map((id) => { const idea = offline(id); return <button key={id} type="button" className="companion-offscreen-card" onClick={() => setPreview({ kind: "offscreen", id })}><Icon name={idea.icon} size={26} /><h3>{idea.title}</h3><p className="companion-say" dir="auto">“{idea.say}”</p><span className="companion-door-link">{t("companion.together-view.how-to-begin")}<Icon name="arrow_forward" size={17} className="companion-arrow rtl:-scale-x-100" /></span></button>; })}</div>
      </section>

      {/* v3 F-TOG-1: one gate card at every width — the way into play. The PIN
          facts (locked, private, stars) live in Settings › PIN; under three only
          the from-three line shows. */}
      <div className="together-gate" data-testid="together-gate">
        {kidAvailable ? <>
          <span className="together-gate-mark" aria-hidden="true"><Icon name="lock" size={21} fill={1} /></span>
          <p className="together-gate-note">{pinSet ? (t("companion.together-view.you-choose-when-to-enter-play-your-pin-pro")) : (t("companion.together-view.play-opens-in-the-child-area-set-a-pin-to"))}</p>
          <div className="together-gate-actions">
            {!pinSet && <button type="button" className="companion-text-button" data-testid="together-gate-pin" onClick={() => requestOpenSettings({ focus: "pin" })}>{t("companion.together-view.set-a-pin")}</button>}
            <button type="button" className="together-start" data-testid="together-start-playing" onClick={() => { trackPracticeStudioOpen("kidmode", "hero"); requestKidMode(); }}><Icon name="play_arrow" size={18} />{t("companion.together-view.start-playing")}</button>
          </div>
        </> : <p dir="auto" className="together-gate-note">{t(genderedKey("elev.ages.practice.fromThree", childProfile.gender), { name })}</p>}
      </div>
      {heroStep}
      <PreviewSurface open={preview !== null} onClose={() => setPreview(null)} title={previewTitle}>
        {preview?.kind === "world" && <div className="companion-preview" dir={he ? "rtl" : "ltr"}>
          <img src={worldArtSrc(preview.world.id).src480} srcSet={`${worldArtSrc(preview.world.id).src480} 1x, ${worldArtSrc(preview.world.id).src} 2x`} width="480" height="320" alt="" decoding="async" />
          <p>{t(`practice.world.${preview.world.key}.skill`)}</p>
          <p className="companion-caption">{!worksInLanguage(preview.world, lang) ? (t("companion.together-view.this-voice-game-is-currently-in-english-op")) : opensInKidMode(preview.world) ? (t("companion.together-view.when-you-are-ready-enter-the-child-area-yo")) : (t("companion.together-view.open-the-language-tools-in-the-parent-area"))}</p>
          <button type="button" className="companion-primary" onClick={() => openWorld(preview.world)}><Icon name="play_arrow" size={20} />{worksInLanguage(preview.world, lang) && opensInKidMode(preview.world) ? (t("companion.together-view.start-playing")) : (t("companion.together-view.open"))}</button>
        </div>}
        {preview?.kind === "offscreen" && <div className="companion-preview" dir={he ? "rtl" : "ltr"}>
          <img src={TOGETHER_ART.src} srcSet={TOGETHER_ART.srcSet} width={TOGETHER_ART.width} height={TOGETHER_ART.height} alt="" />
          <p>{offline(preview.id).detail}</p><blockquote className="companion-say" dir="auto">{t("elev.loop.ms.quoted", { text: offline(preview.id).say })}</blockquote>
          <p className="companion-caption">{t("companion.together-view.you-can-put-the-screen-down-and-try-it-the")}</p>
          <button type="button" className="companion-primary" onClick={() => setPreview(null)}>{t("companion.together-view.let-s-give-it-a-try")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button>
          <button type="button" className="companion-text-button" disabled={saving || kept.includes(preview.id)} onClick={() => void keepOffline(preview.id)}><Icon name={kept.includes(preview.id) ? "check" : "bookmark_add"} size={18} />{kept.includes(preview.id) ? (t("companion.together-view.a-moment-from-your-time-together-is-saved")) : (t("companion.together-view.we-already-tried-it-keep-the-moment"))}</button>
        </div>}
        {preview?.kind === "story" && (() => {
          const story = storyOf(preview.id);
          if (!story) return null;
          return <div className="companion-preview together-story-preview" data-testid="together-story-preview" data-story={story.id} dir={he ? "rtl" : "ltr"}>
            <img src={story.art} width="480" height="320" alt="" decoding="async" />
            <p dir="auto">{story.detail[lang]}</p>
            <p className="companion-caption">{t("companion.together-view.story-preview-note")}</p>
            <button type="button" className="companion-primary" data-testid="together-story-open" onClick={() => openStory(story.id)}><Icon name={story.icon} size={20} />{t("companion.together-view.explore")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button>
          </div>;
        })()}
        {saveError && <p role="alert" className="companion-caption">{t("companion.together-view.the-moment-wasn-t-saved-please-try-again")}</p>}
      </PreviewSurface>
    </div>
  );
}
