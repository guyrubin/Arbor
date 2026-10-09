import React, { useEffect, useId, useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { kidModeOpenFor, TOGETHER_CARDS } from "../../lib/age/playGate";
import { useKidModeEntry } from "../kidmode/useKidModeEntry";
import { markPinNudgeShown, readParentPin, shouldNudgeForPin } from "../kidmode/parentGate";
import { usePracticeData } from "../../practice/usePracticeData";
import { useChildCollection } from "../../hooks/useChildCollection";
import { withChildSignals } from "../../lib/i18nElevation/childsignals";
import { SINCE_LAST_PLAY_FALLBACK_MS, doorSinceSentence, kidActivityLedgers } from "../../lib/kidExitRecap";
import { runTitle } from "../../lib/heroJourneys";
import { lastKidSessionStartedAt } from "../../lib/kidModeGate";
import { genderedKey } from "../../lib/today/fromRecord";
import type { HeroJourneyRun } from "../../types";
import { requestOpenSettings } from "../layout/settingsBus";
import { opensInKidMode, studioCountKey, studioCountsSince, studioWorldsForChild, worksInLanguage, type StudioWorld } from "../practice/studioWorlds";
import Icon from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { OFFSCREEN_IDEAS, STORY_DOORS, WORLD_ART, type TogetherCategory } from "./companionChoices";
import { trackCompanionPlaceOpen, trackPracticeStudioOpen, trackPracticeTogetherDid } from "../../lib/kpiEvents";
import { TOGETHER_ART } from "../../lib/parentArt";
import "./companionExperience.css";

type Preview = { kind: "world"; world: StudioWorld } | { kind: "offscreen"; id: string };

/** Parent previews lead to the existing child-mode entry seam. Nothing on this
 * page starts a camera/microphone or writes an activity just because it is seen. */
export default function TogetherView() {
  const { childProfile, setActiveTab, saveMoment, activeFamilyTopic } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const lang = he ? "he" : "en";
  const name = childProfile.name?.split(" ")[0] || (t("companion.together-view.your-child"));
  const [category, setCategory] = useState<TogetherCategory>("all");
  const [previewState, setPreviewState] = useState<{ childId: string; value: Preview | null }>({ childId: childProfile.id, value: null });
  const preview = previewState.childId === childProfile.id ? previewState.value : null;
  const setPreview = (value: Preview | null) => setPreviewState({ childId: childProfile.id, value });
  const [keptState, setKeptState] = useState<{ childId: string; ids: string[] }>({ childId: childProfile.id, ids: [] });
  const kept = keptState.childId === childProfile.id ? keptState.ids : [];
  const { request: requestKidMode, step: heroStep } = useKidModeEntry();
  const { worlds } = studioWorldsForChild(lang, childProfile);
  const kidAvailable = kidModeOpenFor(childProfile);
  const filterId = useId();
  useEffect(() => { setPreview(null); setKeptState({ childId: childProfile.id, ids: [] }); setCategory("all"); }, [childProfile.id]);
  useEffect(() => { trackCompanionPlaceOpen("together"); }, [childProfile.id]);

  // ── Parity 9 Oct: what Practice Studio's door said, back on Together. ──
  // B-PLAY-05 + B-KID-31: ONE sentence — what the child played since the
  // latest Kid Mode session began (7 days when none is known), in rounds, plus
  // a finished story by title. The only view a parent has of play they did
  // not watch. B-PLAY-02: the same window counts each world in its own unit.
  const practiceData = usePracticeData(childProfile.id);
  const heroRuns = useChildCollection<HeroJourneyRun>(childProfile.id, "heroRuns");
  const playWindow = useMemo(() => {
    const known = lastKidSessionStartedAt();
    return { sinceMs: known ?? Date.now() - SINCE_LAST_PLAY_FALLBACK_MS, isFallback: known == null };
  }, [childProfile.id]);
  const counts = useMemo(
    () => studioCountsSince({ speech: practiceData.speech, mimic: practiceData.mimic, adventures: practiceData.adventures, events: practiceData.events }, playWindow.sinceMs),
    [practiceData.speech, practiceData.mimic, practiceData.adventures, practiceData.events, playWindow.sinceMs],
  );
  const since = useMemo(() => doorSinceSentence({
    ledgers: kidActivityLedgers(practiceData),
    stories: heroRuns.items.map((r) => ({ title: runTitle(r, lang), completedAt: r.completedAt })),
    sinceMs: playWindow.sinceMs, sinceIsFallback: playWindow.isFallback, nowMs: Date.now(), total: counts.total,
    uiLang: lang, gender: childProfile.gender, t: withChildSignals(t, uiLang === "he"), childName: name,
  }), [practiceData, heroRuns.items, playWindow, counts.total, lang, childProfile.gender, t, uiLang, name]);
  const sinceText = since ? `${since.before}${since.title ?? ""}${since.after}` : "";
  // B-SHELL-NEW-1b: the sentence can be kept as ONE parent moment; the inline
  // line below is this write's one failure message (the seam stays quiet).
  const [sinceKept, setSinceKept] = useState<{ childId: string; text: string } | null>(null);
  const [sinceError, setSinceError] = useState(false);
  const sinceIsKept = sinceKept?.childId === childProfile.id && sinceKept.text === sinceText;
  const keepSince = async () => {
    if (!sinceText || sinceIsKept) return;
    setSinceError(false);
    try { if (await saveMoment(sinceText, { callerShowsFailure: true })) setSinceKept({ childId: childProfile.id, text: sinceText }); else setSinceError(true); }
    catch { setSinceError(true); }
  };
  // KID-21: the parent area was reached by the grown-up question and no PIN is
  // set — say so ONCE, here on the parent page, never in front of the child.
  const [nudgePin] = useState(() => shouldNudgeForPin());
  useEffect(() => { if (nudgePin) markPinNudgeShown(); }, [nudgePin]);
  const pinSet = Boolean(readParentPin());
  const filters: { id: TogetherCategory; label: string; icon: string }[] = [
    { id: "all", label: t("companion.together-view.all-together"), icon: "interests" },
    { id: "stories", label: t("companion.together-view.stories"), icon: "auto_stories" },
    ...(kidAvailable && worlds.length ? [{ id: "games" as const, label: t("companion.together-view.games"), icon: "sports_esports" }] : []),
    { id: "offscreen", label: t("companion.together-view.away-from-the-screen"), icon: "wb_sunny" },
  ];
  const show = (id: TogetherCategory) => category === "all" || category === id;
  const openWorld = (world: StudioWorld) => {
    setPreview(null);
    const direct = (!opensInKidMode(world) || !worksInLanguage(world, lang)) && !!world.tab;
    trackPracticeStudioOpen(world.id, direct ? "direct" : "kidmode");
    if (direct && world.tab) setActiveTab(world.tab);
    else requestKidMode({ view: "arcade", worldId: world.id });
  };
  const offlineIds: readonly string[] = kidAvailable ? OFFSCREEN_IDEAS.map((idea) => idea.id) : TOGETHER_CARDS;
  const offline = (id: string) => {
    const idea = OFFSCREEN_IDEAS.find((item) => item.id === id);
    return idea ? { title: idea.title[lang], detail: idea.detail[lang], say: idea.say[lang], icon: idea.icon }
      : { title: t(`elev.ages.together.${id}.title`), detail: t(`elev.ages.together.${id}.do`), say: t(`elev.ages.together.${id}.say`), icon: "favorite" };
  };
  const previewTitle = preview?.kind === "world" ? t(preview.world.kidNameKey) : preview ? offline(preview.id).title : "";
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
    <div className="companion-page companion-together" dir={he ? "rtl" : "ltr"}>
      <section className="companion-together-hero" data-module="together-invitation" aria-labelledby={`${filterId}-title`}>
        <div>
          <span className="companion-eyebrow">{t("companion.together-view.together-room-for-curiosity-and-connection")}</span>
          <h1 id={`${filterId}-title`} className="arbor-type-hero">{t("companion.together-view.a-little-world-to-discover-with", { value0: name })}</h1>
          <p>{t("companion.together-view.a-story-to-get-lost-in-a-game-to-wonder-at")}</p>
          {kidAvailable && since && <div className="companion-since" data-testid="together-since">
            <p dir="auto">{since.before}{since.title && <i><bdi>{since.title}</bdi></i>}{since.after}</p>
            <button type="button" className="companion-text-button" data-testid="together-since-keep" disabled={sinceIsKept} onClick={() => void keepSince()}>
              <Icon name={sinceIsKept ? "check" : "bookmark_add"} size={17} />{sinceIsKept ? t("elev.practice.door.kept") : t("elev.practice.door.keep")}
            </button>
            {sinceError && <p role="alert" className="companion-caption">{t("companion.together-view.the-moment-wasn-t-saved-please-try-again")}</p>}
          </div>}
          <button type="button" className="companion-primary" data-primary-move="choose-together" onClick={() => setPreview({ kind: "offscreen", id: offlineIds[0] })}><Icon name="favorite" size={19} />{t("companion.together-view.one-small-idea-for-time-together")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button>
          {/* B-KID-11: a labelled hand-over on the page (the chrome icon has no label on a phone). */}
          {kidAvailable && <button type="button" className="companion-secondary companion-handover" data-testid="together-handover" onClick={() => { trackPracticeStudioOpen("kidmode", "hero"); requestKidMode(); }}><Icon name="sports_esports" size={19} />{t("practice.studio.kidmode.cta")}</button>}
        </div>
        <figure className="companion-together-art"><img src={TOGETHER_ART.src} srcSet={TOGETHER_ART.srcSet} width={TOGETHER_ART.width} height={TOGETHER_ART.height} alt={t("companion.together-view.illustration-of-an-open-book-building-bloc")} fetchPriority="high" /></figure>
      </section>

      {activeFamilyTopic && <div className="companion-topic-context"><Icon name="bookmark" size={18} /><span>{t("companion.together-view.your-question-stays-with-you")}<b dir="auto">{activeFamilyTopic.title}</b></span><span className="companion-caption">{t("companion.together-view.here-it-is-also-enough-just-to-enjoy")}</span></div>}

      <div className="companion-filter-row" role="group" aria-label={t("companion.together-view.what-feels-right-now")}>
        {filters.map((filter) => <button key={filter.id} type="button" className="companion-filter" aria-pressed={category === filter.id} onClick={() => setCategory(filter.id)}><Icon name={filter.icon} size={19} />{filter.label}</button>)}
      </div>

      {show("stories") && <section className="companion-collection" data-module="together-stories" aria-labelledby={`${filterId}-stories`}>
        <div className="companion-section-heading"><div><span className="companion-eyebrow">{t("companion.together-view.read-imagine-talk")}</span><h2 id={`${filterId}-stories`}>{t("companion.together-view.which-story-shall-we-step-into")}</h2></div>{category === "all" && <button type="button" className="companion-text-button" onClick={() => setCategory("stories")}>{t("companion.together-view.all-stories")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button>}</div>
        <div className="companion-story-grid">{STORY_DOORS.slice(0, category === "all" ? 2 : undefined).map((story) => <button key={story.id} type="button" className="companion-story-card" onClick={() => setActiveTab(story.tab)}><div className="companion-card-art"><img src={story.art} alt="" loading="lazy" width="480" height="320" /><span className="companion-art-label"><Icon name={story.icon} size={16} />{t("companion.together-view.choose-and-preview")}</span></div><div className="companion-card-copy"><h3>{story.title[lang]}</h3><p>{story.detail[lang]}</p><span className="companion-door-link">{t("companion.together-view.explore")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></span></div></button>)}</div>
      </section>}

      {kidAvailable && show("games") && <section className="companion-collection" data-module="together-games" aria-labelledby={`${filterId}-games`}>
        <div className="companion-section-heading"><div><span className="companion-eyebrow">{t("companion.together-view.first-choose-then-play")}</span><h2 id={`${filterId}-games`}>{t("companion.together-view.little-invitations-to-play")}</h2></div>{category === "all" && worlds.length > 3 && <button type="button" className="companion-text-button" onClick={() => setCategory("games")}>{t("companion.together-view.all-games")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button>}</div>
        {worlds.length ? <div className="companion-world-grid">{worlds.slice(0, category === "all" ? 3 : undefined).map((world) => <button key={world.id} type="button" className="companion-world-card" onClick={() => setPreview({ kind: "world", world })}><img src={`/visuals/cards/web/game-${WORLD_ART[world.id]}-480.webp`} srcSet={`/visuals/cards/web/game-${WORLD_ART[world.id]}-480.webp 1x, /visuals/cards/web/game-${WORLD_ART[world.id]}-1024.webp 2x`} alt="" width="480" height="320" loading="lazy" decoding="async" /><div><h3>{t(world.kidNameKey)}</h3>{category === "games" && (counts.byWorld[world.id] ?? 0) > 0 && <span className="companion-world-count" data-testid="together-world-count">{t(studioCountKey(world.unit, counts.byWorld[world.id]), { n: counts.byWorld[world.id] })}</span>}<p>{t(`practice.world.${world.key}.skill`)}</p><span className="companion-door-link">{t("companion.together-view.preview-before-playing")}<Icon name="arrow_forward" size={17} className="companion-arrow rtl:-scale-x-100" /></span></div></button>)}</div> : <p className="companion-caption">{t("companion.together-view.there-are-no-listed-screen-games-for-this")}</p>}
      </section>}

      {show("offscreen") && <section className="companion-collection" data-module="together-offscreen" aria-labelledby={`${filterId}-offscreen`}>
        <div className="companion-section-heading"><div><span className="companion-eyebrow">{t("companion.together-view.in-everyday-life")}</span><h2 id={`${filterId}-offscreen`}>{t("companion.together-view.something-small-to-do-together")}</h2></div><button type="button" className="companion-text-button" onClick={() => setActiveTab("daily-play")}>{t("companion.together-view.more-ideas")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button></div>
        <div className="companion-offscreen-grid">{offlineIds.map((id) => { const idea = offline(id); return <button key={id} type="button" className="companion-offscreen-card" onClick={() => setPreview({ kind: "offscreen", id })}><Icon name={idea.icon} size={26} /><h3>{idea.title}</h3><p className="companion-say" dir="auto">“{idea.say}”</p><span className="companion-door-link">{t("companion.together-view.how-to-begin")}<Icon name="arrow_forward" size={17} className="companion-arrow rtl:-scale-x-100" /></span></button>; })}</div>
      </section>}

      {/* KID-21 / B-PLAY-06: the one-time PIN nudge, only after the grown-up question let a parent in. */}
      {kidAvailable && nudgePin && <button type="button" className="companion-pin-nudge" data-testid="together-pin-nudge" onClick={() => requestOpenSettings({ focus: "pin" })}>
        <Icon name="lock" size={18} /><span><b>{t("elev.gate.set.title")}</b> {t("elev.gate.set.sub")}</span><span className="companion-pin-nudge-cta">{t("elev.gate.set.cta")}</span>
      </button>}
      <footer className="companion-together-footer">
        {kidAvailable ? <><Icon name="verified_user" size={21} /><p>{pinSet ? (t("companion.together-view.you-choose-when-to-enter-play-your-pin-pro")) : (t("companion.together-view.play-opens-in-the-child-area-set-a-pin-to"))}</p><button type="button" className="companion-text-button" onClick={() => requestOpenSettings({ focus: "pin" })}>{t("companion.together-view.parent-settings")}</button></> : <p dir="auto">{t(genderedKey("elev.ages.practice.fromThree", childProfile.gender), { name })}</p>}
        {/* KID-20 / RUN-04: the reassurance chips are parent copy, so they live on the parent page. */}
        {kidAvailable && <ul className="companion-trust-chips" aria-label={t("elev.practice.door.aria")}>
          {([pinSet ? "elev.practice.door.locked" : "elev.practice.door.gated", "elev.practice.door.private", "elev.practice.door.stars"] as const).map((key) => <li key={key}><Icon name="verified_user" size={13} />{t(key)}</li>)}
        </ul>}
        <p className="companion-caption companion-play-note">{t("practice.studio.note")}</p>
      </footer>
      {heroStep}
      <Modal open={preview !== null} onClose={() => setPreview(null)} title={previewTitle}>
        {preview?.kind === "world" && <div className="companion-preview" dir={he ? "rtl" : "ltr"}>
          <img src={`/visuals/cards/web/game-${WORLD_ART[preview.world.id]}-480.webp`} srcSet={`/visuals/cards/web/game-${WORLD_ART[preview.world.id]}-480.webp 1x, /visuals/cards/web/game-${WORLD_ART[preview.world.id]}-1024.webp 2x`} width="480" height="320" alt="" decoding="async" />
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
        {saveError && <p role="alert" className="companion-caption">{t("companion.together-view.the-moment-wasn-t-saved-please-try-again")}</p>}
      </Modal>
    </div>
  );
}
