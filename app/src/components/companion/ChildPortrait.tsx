import React, { useEffect, useMemo, useState } from "react";
import GoalBuilderModal from "../practice/GoalBuilderModal";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { DsRoot, Fig, Guide, MoreLink, Route, RouteHead, RouteSection, Scene, StartHere, scrollToSection } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import { useObservationRecord } from "../../hooks/useObservationRecord";
import { domainName, type DomainId } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import type { Observation } from "../../lib/observations";
import { milestoneText } from "../../lib/milestoneData";
import { routeHash } from "../../lib/routes";
import { behaviorTypeLabel } from "../../content/behaviorTaxonomy";
import { portraitDiscussionPrompt } from "./portraitModel";
import { PORTRAIT_COPY } from "./portraitCopy";
import { trackCompanionPlaceOpen } from "../../lib/kpiEvents";
import { Icon } from "../ui/Icon";
import { domainToneStyle, seenTotals } from "./domainTone";
import MilestoneAreas from "./MilestoneAreas";
import MilestonesViewSwitch from "./MilestonesViewSwitch";
import { milestonesV10Copy } from "./milestonesV10Copy";
import PortraitCards from "./PortraitCards";
import ThenAndNow from "./ThenAndNow";
import { useNowClock } from "./useNowClock";
import "./childPortrait.css";
import "./milestonesV10.css";

/**
 * v10.1 — My child › Milestones (#/development), the milestone map: one tree,
 * two compositions (useComposition), four numbered sections under the guide.
 *
 *  1. The map: the scene (kicker, "<name>'s growth, in your words.", the
 *     Map / List switch) holding the eight territories (DevelopmentMap). Desk:
 *     the 5-minute check (the page's one primary move) and Then and now sit
 *     in the rail beside it.
 *  2. In your words: a strength, a moment the parent kept, what the family is
 *     working on (PortraitCards; the goal picker opens here). Phone: the check
 *     closes this row, then Then and now.
 *  3. One area, opened: the open area's head and body (AreaRowDetail: its
 *     skills with Seen it / Not yet / Not sure, Add your own, the three doors).
 *  4. What to notice next: up to three skills, one answer control each
 *     (desk: the rail beside the open area).
 *
 * The moments views belong to the Moments pill; the care and record doors to
 * Care. The shell draws the breadcrumb and the pill row, so the page starts at
 * the guide. Three modules, one primary move, at every width.
 * CLINICAL FIREWALL: Seen-it counts and the parent's own words only.
 */
export interface ChildPortraitProps {
  onDiscuss?: (prompt: string, childId: string) => void;
}

export default function ChildPortrait({ onDiscuss }: ChildPortraitProps) {
  const { childProfile, milestones, seedCoach } = useArbor();
  const { t, uiLang } = useLanguage();
  const composition = useComposition();
  const desk = composition === "desk";
  const copy = PORTRAIT_COPY[uiLang === "he" ? "he" : "en"];
  const v10 = milestonesV10Copy(uiLang);
  useEffect(() => { trackCompanionPlaceOpen("child"); }, [childProfile.id]);
  const [goalOwner, setGoalOwner] = useState<string | null>(null);
  useEffect(() => { setGoalOwner(null); }, [childProfile.id]);
  const record = useObservationRecord();
  const now = useNowClock();
  const observations = useMemo(() => record.observations.filter(o => o.childId === childProfile.id), [record.observations, childProfile.id]);
  const logMap = useMemo(() => new Map((record.sources.behaviorLogs ?? []).map(log => [`behaviorLogs:${log.id}`, log])), [record.sources.behaviorLogs]);
  const totals = useMemo(() => seenTotals(milestones), [milestones]);
  const name = (childProfile.name || "").split(/\s+/)[0] || childProfile.name;
  const [titleBefore, titleAfter = ""] = t("companion.milestones.title").split("{name}");
  // A territory quotes the newest moment in the parent's own words (never the stored type).
  const title = (o: Observation): string => {
    const v = o.value;
    switch (v.type) {
      case "moment": { const log = logMap.get(o.id); return log?.trigger?.trim() || log?.notes?.trim() || behaviorTypeLabel(v.behaviorType, t); }
      case "milestone": { const milestone = milestones.find(item => item.id === v.milestoneId); return milestone ? milestoneText(milestone, "title", t, { gender: childProfile.gender ?? null }) : v.title; }
      case "keepsake": return v.note;
      case "word": return v.phrase;
      case "goal_note": return v.text;
      case "fact": return v.fact;
      case "play": return v.title;
      case "practice": return o.origin === "speechAttempts" ? copy.speech : o.origin === "mimicSessions" ? copy.mimic : o.origin === "adventureResults" ? copy.adventure : o.origin === "missionRecords" ? copy.mission : t("companion.portrait.practice");
      case "measurement": return t("companion.portrait.measurement");
      case "check": return t("companion.portrait.check");
    }
  };
  // "Explore this with Arbor": Talk opens with the area, no record attached (Shell's onDiscuss).
  const exploreDomain = (domain: DomainId) => {
    const prompt = portraitDiscussionPrompt([domain], area => domainName(area, t), uiLang === "he");
    if (onDiscuss) onDiscuss(prompt, childProfile.id);
    else seedCoach({ prompt, source: "child-portrait" });
  };
  // On a phone the open area sits below the map, so a tap brings it into view.
  const onOpened = () => { if (!desk) scrollToSection("ms-area"); };

  const heading = <>{titleBefore}<bdi dir="auto">{name}</bdi>{titleAfter || null}</>;
  const stops = [
    { id: "ms-map", title: v10.guideMap, sub: v10.guideMapSub },
    { id: "ms-words", title: v10.guideWords, sub: v10.guideWordsSub },
    { id: "ms-area", title: v10.guideArea },
    { id: "ms-next", title: v10.guideNext, sub: v10.guideNextSub },
  ];

  return (
    <DsRoot composition={composition} className="ms-v10" dir={uiLang === "he" ? "rtl" : "ltr"} data-testid="child-portrait">
      {goalOwner === childProfile.id && <GoalBuilderModal key={`goal-picker:${childProfile.id}`} open childId={childProfile.id} childName={childProfile.name}
        behaviorLogs={record.sources.behaviorLogs ?? []}
        onClose={() => setGoalOwner(null)} />}
      <MilestoneAreas key={childProfile.id} observations={observations} momentText={title} primaryMoveProps={{ "data-primary-move": "start-development-check" }}
        onExplore={exploreDomain} composition={composition} onOpened={onOpened}>
        {({ map, check, area, next, openDomain }) => {
          const cards = <PortraitCards sources={record.sources} onEditGoal={() => setGoalOwner(childProfile.id)} />;
          const thenAndNow = <ThenAndNow observations={observations} logs={record.sources.behaviorLogs ?? []} now={now} />;
          const areaCard = (
            <div className="area ar" style={domainToneStyle(openDomain)} data-testid="ms-open-area">
              <div className="ah">
                <span className="tg" aria-hidden="true"><Icon name={DOMAIN_ICONS[openDomain]} size={17} /></span>
                <div className="ms-ah-text">
                  <span className="ak">{v10.areaKicker}</span>
                  <h3 className="an" id="ms-area-title">{domainName(openDomain, t)}</h3>
                </div>
                <MoreLink onClick={() => scrollToSection("ms-map")}>{v10.allAreas}</MoreLink>
              </div>
              {area}
            </div>
          );
          const nextHead = <RouteHead id="ms-next-title" title={v10.nextTitle} link={<MoreLink href={`#${routeHash("milestones")}`}>{v10.allMilestones}</MoreLink>} />;
          return <>
            <Guide stops={stops} label={v10.onThisPage} mini={!desk} />
            <Route composition={composition}>
              <RouteSection id="ms-map" n={1} on aria-labelledby="ms-title">
                <div className="ms-row" data-module="child-milestones-areas">
                  <div className="stg">
                    <Scene field="child" orbs={desk ? [{ size: 300, right: -90, top: -120 }, { size: 220, left: -70, bottom: -110, b: true }] : [{ size: 180, right: -70, top: -80 }]}>
                      <header className="ms-head">
                        <div className="ms-head-text">
                          <p className="kicker">{t("companion.milestones.kicker")} <StartHere>{v10.startHere}</StartHere></p>
                          <h1 className="title" id="ms-title">{heading}</h1>
                          <p className="ms-sub">{t("elev.loop.ms.footer")}</p>
                        </div>
                        <div className="ms-head-tools">
                          {!desk && totals.seen > 0 && <Fig n={totals.seen} unit={v10.hubUnit} sub={totals.areas === 1 ? v10.hubAreasOne : v10.hubAreasMany.replace("{n}", String(totals.areas))} size="md" />}
                          <MilestonesViewSwitch current="development" />
                        </div>
                      </header>
                      {map}
                    </Scene>
                  </div>
                  {desk && <div className="rlc">{check}{thenAndNow}</div>}
                </div>
              </RouteSection>
              <RouteSection id="ms-words" n={2} aria-labelledby="ms-words-title">
                <div data-module="child-milestones-portrait">
                  <RouteHead id="ms-words-title" title={v10.wordsTitle} sub={v10.wordsSub} />
                  <div className="ms-objs">{cards}{!desk && check}</div>
                  {!desk && thenAndNow}
                </div>
              </RouteSection>
              <RouteSection id="ms-area" n={3} aria-labelledby="ms-area-title">
                <div className="ms-row" data-module="child-milestones-area">
                  <div className="stg">{areaCard}</div>
                  {desk ? (
                    <div className="rlc" id="ms-next">{nextHead}{next}</div>
                  ) : null}
                </div>
              </RouteSection>
              {!desk && (
                <RouteSection id="ms-next" n={4} aria-labelledby="ms-next-title">
                  {nextHead}
                  {next}
                </RouteSection>
              )}
            </Route>
          </>;
        }}
      </MilestoneAreas>
    </DsRoot>
  );
}
