import React, { useEffect, useId } from "react";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { kidModeOpenFor } from "../../lib/age/playGate";
import { useHashQuery } from "../../hooks/useHashQuery";
import { routeHash } from "../../lib/routes";
import { usePracticeData } from "../../practice/usePracticeData";
import { focusGoal, goalLabel } from "../../practice/goalBuilder";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { localized } from "../../lib/routines";
import { routineDayKey, routineIdOfPlan, routineTemplatesForAge } from "../../lib/routineTemplates";
import { latestPlayedWorldId, studioWorldsForChild } from "../practice/studioWorlds";
import { trackCompanionPlaceOpen } from "../../lib/kpiEvents";
import Icon from "../ui/Icon";
import { DsRoot, Guide, MoreLink, Route, RouteHead, RouteSection, Token } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import { openFamilyTopicSheet } from "./familyTopicEvents";
import TogetherRoutines from "./TogetherRoutines";
import { todaysRhythm } from "./togetherRhythm";
import { FITS_COPY } from "./nowV41Copy";
import { clockOf, dayPart, routineForPart } from "./rightNowModel";
import { ChainStrip, type ChainNode } from "../together/ChainStrip";
import { TOGETHER_COPY } from "../together/togetherCopy";
import { routineStepsThisWeek } from "../together/routinesWeek";
import "../together/together.css";
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
  const dayFmt = new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-US", { weekday: "short", day: "numeric" });
  const listFmt = new Intl.ListFormat(lang === "he" ? "he" : "en", { style: "long", type: "conjunction" });
  const weekDays = listFmt.format(week.days.map((d) => dayFmt.format(d)));
  const chain: ChainNode[] = [
    ...(goal ? [{ kind: "you" as const, tag: copy.chainFocus, text: goalLabel(goal, t) }] : []),
    ...(fits ? [{ kind: "arbor" as const, tag: FITS_COPY[lang].label(clockOf(now.getHours() * 60 + now.getMinutes())), text: localized(fits.routine.title, lang) }] : []),
    { kind: "you", tag: copy.chainYouStart, text: t("companion.together-view.routines-start"), sub: copy.chainStartSub },
    { kind: "back", tag: copy.chainWeek, text: week.steps > 0 ? copy.doneSteps(week.steps) : copy.chainWeekCounted, sub: week.steps > 0 ? copy.doneDays(weekDays) : undefined },
  ];

  const routinesId = `${ids}-routines`;
  const doorsId = `${ids}-doors`;
  const door = (testId: string, art: string, title: string, sub: string, onClick: () => void) => (
    <button key={testId} type="button" className="dm-door" data-testid={testId} onClick={onClick}>
      <img src={art} alt="" width={64} height={64} loading="lazy" decoding="async" />
      <span className="stack" style={{ gap: 3, minWidth: 0 }}>
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
      door("together-door-find", "/visuals/worlds/v2/mood-mountain-v2-480.webp", t("companion.together-view.door-find-play"), copy.doorFindSub, () => setActiveTab("daily-play")),
    ] : []),
  ];

  return (
    <DsRoot composition={composition} className="together-v10" data-testid="together-routines-screen" dir={lang === "he" ? "rtl" : "ltr"}>
      <div className="stack" style={{ gap: phone ? 12 : 16 }}>
        <Guide
          label={copy.onThisPage}
          mini={phone}
          stops={[
            { id: "routines", title: phone ? t("companion.together-view.routines") : copy.stopRoutines, sub: copy.stopRoutinesSub },
            { id: "doors", title: copy.stopDoors, sub: copy.stopDoorsSub },
          ]}
        />
        {/* FEAT-05: the question line is the chip that opens the question sheet (no count, no dot). */}
        {activeFamilyTopic && <div className="companion-topic-context" data-testid="together-question-row">
          <button type="button" className="companion-topic-chip" data-testid="together-topic-chip" aria-haspopup="dialog" onClick={() => openFamilyTopicSheet()}>
            <span className="companion-topic-chip-pill"><Icon name="bookmark" size={18} className="companion-topic-chip-icon" /><span className="companion-topic-chip-text">{t("companion.together-view.your-question-stays-with-you")}<b dir="auto">{activeFamilyTopic.title}</b></span></span>
          </button>
          <span className="companion-caption">{t("companion.together-view.here-it-is-also-enough-just-to-enjoy")}</span>
        </div>}
        <ChainStrip nodes={chain} composition={composition} label={copy.chainLabel(name)} />
        <Route composition={composition}>
          <section className="rsec" id="routines" data-module="together-routines" aria-labelledby={routinesId}>
            <span className="rstop on" style={{ top: 14 }} aria-hidden="true">1</span>
            <div className="rhead" style={{ paddingInlineStart: phone ? 0 : 8 }}>
              <h1 className="h3 tg-routines-h1" id={routinesId}>{copy.routinesTitle}</h1>
              <span className="small">{t("companion.together-view.routines-sub")}</span>
            </div>
            <TogetherRoutines composition={composition} headingId={routinesId} />
          </section>
          <RouteSection id="doors" n={2} aria-labelledby={doorsId} className={phone ? "dm-pm" : undefined}>
            <div data-module="together-doors" className="stack" style={{ gap: 14 }}>
              <div style={{ paddingInlineStart: phone ? 0 : 8 }}><RouteHead id={doorsId} title={copy.doorsTitle} sub={copy.doorsSub(name)} /></div>
              {phone
                ? <div className="stack" style={{ gap: 10 }}>{doors}</div>
                : <div className="g12">{doors.map((d, i) => <div key={i} style={{ gridColumn: "span 4", minWidth: 0, display: "flex", flexDirection: "column" }}>{d}</div>)}</div>}
              {week.steps > 0 && (
                <div className="dm-door dm-dw" data-testid="together-done-week" style={phone ? undefined : { gridTemplateColumns: "auto minmax(0, 1fr) auto", gap: "4px 16px", padding: "12px 18px", minHeight: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 15, fontFamily: "var(--font-display)" }}>{copy.doneTitle}</span>
                  <span className="line" style={{ gap: 10, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", gap: 5, flex: "none" }} aria-hidden="true">
                      {week.days.map((d) => <Token key={d.toISOString()} kind="plan" size="sm" label={dayFmt.format(d)} />)}
                    </span>
                    <span className="s"><b className="strong">{copy.doneSteps(week.steps)}</b> {copy.doneDays(weekDays)}</span>
                  </span>
                  <MoreLink onClick={() => setActiveTab("weekly")}>{t("nav.tab.weekly")}</MoreLink>
                </div>
              )}
            </div>
          </RouteSection>
        </Route>
      </div>
    </DsRoot>
  );
}
