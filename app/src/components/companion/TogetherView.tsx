import React, { useEffect, useId } from "react";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { kidModeOpenFor } from "../../lib/age/playGate";
import { useHashQuery } from "../../hooks/useHashQuery";
import { routeHash } from "../../lib/routes";
import { useChildCollection } from "../../hooks/useChildCollection";
import { fmtDayV10 } from "../../lib/formatDate";
import type { HeroJourneyRun } from "../../types";
import { usePracticeData } from "../../practice/usePracticeData";
import { focusGoal, goalLabel } from "../../practice/goalBuilder";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { localized } from "../../lib/routines";
import { routineDayKey, routineIdOfPlan, routineTemplatesForAge } from "../../lib/routineTemplates";
import { latestPlayedWorldId, studioWorldsForChild } from "../practice/studioWorlds";
import { trackCompanionPlaceOpen } from "../../lib/kpiEvents";
import Icon from "../ui/Icon";
import { DsRoot, Guide, MoreLink, Route, scrollToSection, Token } from "../../design/primitives";
import { Draw, FrameFigure, FrameHead, IndexRow, RailTile, ReadGuide, StageCard, type IndexItem } from "../moments/v10/frame";
import "../moments/mychild.css";
import { useComposition } from "../../design/useComposition";
import { useShortViewport } from "../together/useShortViewport";
import { openFamilyTopicSheet } from "./familyTopicEvents";
import TogetherRoutines, { BAND_ICON, BAND_OF, BANDS } from "./TogetherRoutines";
import { routineSlot, todaysRhythm, type RhythmSlot } from "./togetherRhythm";
import { FITS_COPY } from "./nowV41Copy";
import { clockOf, dayPart, routineForPart, type DayPart } from "./rightNowModel";

/** The part of the day it is now, as the routine slot whose band is marked in the index. */
const DAY_PART_SLOT: Readonly<Record<DayPart, RhythmSlot>> = { morning: "morning", midday: "midday", afternoon: "afternoon", evening: "evening" };
import { ChainStrip, type ChainNode } from "../together/ChainStrip";
import { TOGETHER_COPY } from "../together/togetherCopy";
import { routineStepsThisWeek } from "../together/routinesWeek";
import "../together/together.css";
// The question chip's phone rules (@container together) live here.
import "./companionExperience.css";
// FEAT-05: the shared question-chip rules (44px hit area, pill) live here.
import "./companionWorkspace.css";

/* ════════════════════════════════════════════════════════════════════════════
   TogetherView — Together › Routines (#/practice), design system v10.1.

   The shell owns the place title, the breadcrumb and the pill row
   (Routines · Play · Stories); this screen renders from the guide down:
   the chain strip, (1) the ready-made routines on the day map and (2) the
   ways into stories and games with one "Done together this week" line.

   v4's in-page filter row became the shell's pills. Old addresses still land
   on the right screen: #/practice?f=games|offscreen opens Play, ?f=stories
   opens Stories (replacing the history entry, so Back skips the hop).
   Nothing on this page starts a camera or microphone or writes an activity
   just because it is seen.
   ════════════════════════════════════════════════════════════════════════════ */

/** The route's declared move (surfaceContract "start-routine"): each routine card opens its start. */
const START_ROUTINE_MOVE = { "data-primary-move": "start-routine" } as const;

/** Where a former in-page filter now lives (null: it stays on Routines). */
export function togetherFilterRoute(filter: string | null): "daily-play" | "stories" | null {
  if (filter === "games" || filter === "offscreen") return "daily-play";
  if (filter === "stories") return "stories";
  return null;
}

export default function TogetherView() {
  const { childProfile } = useArbor();
  const { user, firebaseEnabled, loading } = useAuth();
  const filter = useHashQuery().get("f");
  const moved = togetherFilterRoute(filter);
  useEffect(() => {
    if (moved && typeof window !== "undefined") window.location.replace(`#${routeHash(moved)}`);
  }, [moved]);
  if (moved || !childProfile.id || (firebaseEnabled && (loading || !user))) return null;
  const ownerId = firebaseEnabled ? user!.uid : "local-sandbox";
  return <ScopedTogetherView key={JSON.stringify([ownerId, childProfile.id])} />;
}

function ScopedTogetherView() {
  const { childProfile, setActiveTab, activeFamilyTopic, actionPlans = [] } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const copy = TOGETHER_COPY[lang];
  const composition = useComposition();
  // Under the boards' height the band goes compact (first action above the Ask bar).
  const short = useShortViewport();
  const phone = composition === "phone";
  const ids = useId();
  const name = childProfile.name?.split(" ")[0] || t("companion.together-view.your-child");
  useEffect(() => { trackCompanionPlaceOpen("together"); }, [childProfile.id]);

  const { worlds } = studioWorldsForChild(lang, childProfile);
  const gamesOpen = kidModeOpenFor(childProfile) && worlds.length > 0;
  const practiceData = usePracticeData(childProfile.id);
  // "Continue a favorite": the preview of the world played most recently (on Play), else Play's games.
  const continueFavorite = () => {
    const id = latestPlayedWorldId({ speech: practiceData.speech, mimic: practiceData.mimic, adventures: practiceData.adventures, events: practiceData.events }, worlds);
    window.location.hash = routeHash("daily-play", id ? { world: id } : { section: "games" });
  };

  // The chain: your focus → the routine that fits right now → you start → your week.
  const now = new Date();
  const goal = focusGoal(childProfile.activeGoals ?? []);
  const templates = routineTemplatesForAge(ageMonthsFromProfile(childProfile));
  const planFor = (routineId: string) => actionPlans.find((p) => routineIdOfPlan(p) === routineId) ?? null;
  const fits = routineForPart(todaysRhythm(templates, planFor, routineDayKey(now), lang), dayPart(now.getHours()));
  const week = routineStepsThisWeek(actionPlans, now);
  // The last story read together (the Stories runs: finished, else started), for the week line.
  const storyRuns = useChildCollection<HeroJourneyRun>(childProfile.id, "heroRuns");
  const lastStoryMs = storyRuns.items.reduce((max, r) => {
    const ms = Date.parse(r.completedAt || r.startedAt);
    return Number.isFinite(ms) && ms <= now.getTime() && ms > max ? ms : max;
  }, Number.NEGATIVE_INFINITY);
  const lastStory = Number.isFinite(lastStoryMs) ? fmtDayV10(lastStoryMs, lang, now) : null;
  const dayFmt = new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { weekday: "short", day: "numeric" });
  const listFmt = new Intl.ListFormat(lang === "he" ? "he" : "en", { style: "long", type: "conjunction" });
  const weekDays = listFmt.format(week.days.map((d) => dayFmt.format(d)));
  const chain: ChainNode[] = [
    ...(goal ? [{ kind: "you" as const, tag: t("elev.goal.profile.title"), text: goalLabel(goal, t) }] : []),
    ...(fits ? [{ kind: "arbor" as const, tag: FITS_COPY[lang].label(clockOf(now.getHours() * 60 + now.getMinutes())), text: localized(fits.routine.title, lang) }] : []),
    { kind: "you", tag: copy.chainYouStart, text: t("companion.together-view.routines-start"), sub: copy.chainStartSub },
    { kind: "back", tag: copy.chainWeek, text: week.steps > 0 ? copy.doneSteps(week.steps) : copy.chainWeekCounted, sub: week.steps > 0 ? copy.doneDays(weekDays) : undefined },
  ];

  const routinesId = `${ids}-routines`;
  const doorsId = `${ids}-doors`;
  const door = (testId: string, art: string, title: string, sub: string, onClick: () => void) => (
    <button key={testId} type="button" className="dm-door" data-testid={testId} onClick={onClick}>
      <img src={art} alt="" width={64} height={64} loading="lazy" decoding="async" />
      <span className="tg-stack" style={{ gap: 3, minWidth: 0 }}>
        <span className="nm">{title}</span>
        <span className="s">{sub}</span>
      </span>
      <span className="chev" aria-hidden="true"><Icon name="chevron_right" size={18} className="rtl:-scale-x-100" /></span>
    </button>
  );
  const doors = [
    door("together-door-story", "/visuals/worlds/v2/story-quest-v2-480.webp", t("companion.together-view.door-create-story"), copy.doorStorySub(name), () => setActiveTab("bedtime-stories")),
    ...(gamesOpen ? [
      door("together-door-continue", "/visuals/worlds/v2/play-together-v2-480.webp", t("companion.together-view.door-continue-favorite"), copy.doorContinueSub(name), continueFavorite),
      door("together-door-find", "/visuals/worlds/v2/mood-mountain-v2-480.webp", t("companion.together-view.door-find-play"), copy.doorFindSub(worlds.length), () => setActiveTab("daily-play")),
    ] : []),
  ];

  // The index: the four times of day, each with its count; the part of the day it is now is marked.
  const templatesByBand = BANDS.map((band) => ({ band, n: templates.filter((r) => BAND_OF[routineSlot(r.id)] === band).length })).filter((b) => b.n > 0);
  const nowBand = BAND_OF[DAY_PART_SLOT[dayPart(now.getHours())]];
  const bandName = { morning: copy.bandMorning, afternoon: copy.bandAfternoon, evening: copy.bandEvening, anytime: copy.bandAnytime } as const;
  const indexItems: IndexItem[] = templatesByBand.map(({ band, n }) => ({
    id: band,
    icon: BAND_ICON[band],
    name: bandName[band],
    figure: n,
    meta: band === "anytime" ? copy.anytimeMeta : undefined,
    on: band === nowBand,
    onOpen: () => scrollToSection(`band-${band}`),
    testId: `together-index-${band}`,
  }));
  // The routines module, stamped once (one element in either composition).
  const routinesModule = (
    <div data-module="together-routines">
      <TogetherRoutines composition={composition} headingId={routinesId} primaryMoveProps={START_ROUTINE_MOVE} />
    </div>
  );
  const chainStrip = <ChainStrip nodes={chain} composition={composition} label={copy.chainLabel(name)} line={short} />;
  const guideTile = (
    <RailTile icon="grid_view" title={copy.howToRead}>
      <ReadGuide
        phone={phone}
        steps={[
          { drawing: Draw.pick(4), label: copy.guidePick },
          { drawing: Draw.cards(), label: copy.guideStart },
          { drawing: <span className="ax"><i className="tok plan" style={{ left: "20%" }} /><i className="tok plan" style={{ left: "50%" }} /><i className="tok plan" style={{ left: "80%" }} /></span>, label: copy.guideTick },
        ]}
        keyItems={[
          { mark: <span className="ds-pencil" style={{ padding: "0 6px" }} aria-hidden="true"><Icon name="schedule" size={14} /></span>, label: copy.keyFits },
          { mark: <Token kind="plan" size="sm" label="" />, label: copy.keyTicked },
          { mark: <span className="tg-steps" aria-hidden="true"><i /></span>, label: copy.keyToDo },
        ]}
      />
    </RailTile>
  );
  const doneTile = (week.steps > 0 || lastStory !== null) && (
    <section className={phone ? "tgdone m" : "tgdone"} data-testid="together-done-week">
      <span className="ct"><i className="tg" aria-hidden="true"><Icon name="check" size={15} /></i>{copy.doneTitle}</span>
      <span className="line" style={{ gap: 10, flexWrap: "wrap" }}>
        {week.steps > 0 && <span style={{ display: "inline-flex", gap: 5, flex: "none" }} aria-hidden="true">
          {week.days.map((d) => <Token key={d.toISOString()} kind="plan" size="sm" label={dayFmt.format(d)} />)}
        </span>}
        <span className="s" style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          {week.steps > 0 && <><b className="strong" style={{ color: "var(--ink)" }}>{copy.doneSteps(week.steps)}</b> {copy.doneDays(weekDays)}{lastStory ? " " : ""}</>}
          {lastStory && copy.lastStory(lastStory)}
        </span>
      </span>
      <MoreLink onClick={() => setActiveTab("weekly")}>{t("nav.tab.weekly")}</MoreLink>
    </section>
  );
  const doorsTile = (
    <section className="vt" id="doors" data-module="together-doors" aria-labelledby={doorsId} style={{ gap: 10, padding: "16px 18px 14px" }}>
      <div className="vh"><span className="gi" aria-hidden="true"><Icon name="extension" size={16} /></span><h2 className="h3" id={doorsId}>{copy.doorsTitle}</h2></div>
      <span className="small" style={{ marginTop: -4 }}>{copy.doorsSub(name)}</span>
      <div className="tg-stack" style={{ gap: 8 }}>{doors}</div>
    </section>
  );

  return (
    <DsRoot composition={composition} className="ds-mychild together-v10" data-testid="together-routines-screen" dir={lang === "he" ? "rtl" : "ltr"}>
      <div className="tg-stack" style={{ gap: phone ? 12 : 16 }}>
        <Guide
          label={copy.onThisPage}
          mini={phone}
          stops={[
            { id: "times", title: copy.stopTimes, sub: copy.stopTimesSub },
            { id: "routines", title: phone ? t("companion.together-view.routines") : copy.stopRoutines, sub: copy.stopRoutinesV77Sub },
          ]}
        />
        {/* FEAT-05: the question line is the chip that opens the question sheet (no count, no dot). */}
        {activeFamilyTopic && <div className="companion-topic-context" data-testid="together-question-row">
          <button type="button" className="companion-topic-chip" data-testid="together-topic-chip" aria-haspopup="dialog" onClick={() => openFamilyTopicSheet()}>
            <span className="companion-topic-chip-pill"><Icon name="bookmark" size={18} className="companion-topic-chip-icon" /><span className="companion-topic-chip-text">{t("companion.together-view.your-question-stays-with-you")}<b dir="auto">{activeFamilyTopic.title}</b></span></span>
          </button>
          <span className="companion-caption">{t("companion.together-view.here-it-is-also-enough-just-to-enjoy")}</span>
        </div>}
        <Route composition={composition}>
          {/* 1 · the header band: the page's h1, the figure, the index of the times of day and the chain. */}
          <section className="rsec" id="times" aria-labelledby={routinesId}>
            <span className="rstop on" style={{ top: 14 }} aria-hidden="true">1</span>
            <div className={short ? "scene now compact-band" : "scene now"} style={{ padding: phone ? (short ? "12px 12px 10px" : "16px 14px 14px") : (short ? "16px 24px 14px" : "22px 28px 18px"), gap: short ? 10 : phone ? 12 : 16 }}>
              <i className="orb" style={{ width: 360, height: 360, right: -170, top: -230, opacity: 0.55 }} />
              <FrameHead
                phone={phone}
                kicker={copy.routinesKicker}
                startHere={copy.startHere}
                title={<span id={routinesId}>{t("companion.together-view.routines-title")}</span>}
                sub={t("companion.together-view.routines-sub")}
                figure={<FrameFigure n={templates.length} unit={copy.routinesFigure} sub={copy.routinesFigureSub} />}
              />
              <IndexRow phone={phone} label={copy.timesOfDay} items={indexItems} />
              {chainStrip}
            </div>
          </section>
          {/* 2 · the stage (every routine, by time of day) and the rail (guide, this week, the doors). */}
          <section className="rsec" id="routines" aria-label={copy.byTimeOfDay}>
            <span className="rstop" style={{ top: 14 }} aria-hidden="true">2</span>
            {phone ? (
              <div className="tg-stack" style={{ gap: 12 }}>
                <div className="mcst" style={{ padding: "14px 12px" }}>{routinesModule}</div>
                {guideTile}
                {doneTile}
                {doorsTile}
              </div>
            ) : (
              <div className="rowa">
                <div className="stg">
                  <StageCard icon="wb_sunny" title={copy.byTimeOfDay} className={short ? "together-stage compact-stage" : "together-stage"}>
                    {routinesModule}
                  </StageCard>
                </div>
                <div className="rlc" style={{ gap: 14 }}>
                  {guideTile}
                  {doneTile}
                  {doorsTile}
                </div>
              </div>
            )}
          </section>
        </Route>
      </div>
    </DsRoot>
  );
}
