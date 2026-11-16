import React, { useEffect, useMemo, useState } from "react";
import GoalBuilderModal from "../practice/GoalBuilderModal";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { DsRoot, Guide, MoreLink, Route, RouteHead, RouteSection, scrollToSection } from "../../design/primitives";
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
import MilestoneAreas from "./MilestoneAreas";
import { seenTotals } from "./milestonesModel";
import AreaTimeline from "./AreaTimeline";
import MilestonesBand from "./MilestonesBand";
import MilestonesReadGuide from "./MilestonesReadGuide";
import { milestonesV10Copy } from "./milestonesV10Copy";
import PortraitCards, { GoalFocus } from "./PortraitCards";
import ThenAndNow from "./ThenAndNow";
import { useNowClock } from "./useNowClock";
import "./childPortrait.css";
import "./milestonesV10.css";

/**
 * v10.1 — My child › Milestones (#/development), the map: one tree, two
 * compositions (useComposition), four numbered sections under the guide.
 *
 *  1. The areas: the header band (kicker, "<name>'s growth, in your words.",
 *     the one figure, Map / List) and the index of eight equal areas, which
 *     picks the area section 2 opens.
 *  2. That area: its dated line of Seen it (AreaTimeline) and its skills to
 *     mark (AreaRowDetail: Seen it / Not yet / Not sure, Add your own, the
 *     three doors). The rail beside it: how to read the page, Arbor's first
 *     pick ("Arbor suggests"), and the focus with the 5-minute check (the
 *     page's one primary move) as one object.
 *  3. In your words: a strength and a moment the parent kept, then Then and now.
 *  4. What to notice next: Arbor's other picks, one answer control each.
 *
 * The moments views belong to the Moments pill; the care and record doors to
 * Care. The shell draws the breadcrumb and the pill row, so the page starts at
 * the guide. Three modules, one primary move, at every width. One accent
 * (sapphire); areas are told apart by glyph and name.
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
    { id: "ms-areas", title: v10.guideAreas, sub: v10.guideAreasSub },
    { id: "ms-area", title: v10.guideArea, sub: v10.guideAreaSub },
    { id: "ms-words", title: v10.guideWords, sub: v10.guideWordsSub },
    { id: "ms-next", title: v10.guideNext, sub: v10.guideNextSub },
  ];

  return (
    <DsRoot composition={composition} className="ms-v10" dir={uiLang === "he" ? "rtl" : "ltr"} data-testid="child-portrait">
      {goalOwner === childProfile.id && <GoalBuilderModal key={`goal-picker:${childProfile.id}`} open childId={childProfile.id} childName={childProfile.name}
        behaviorLogs={record.sources.behaviorLogs ?? []}
        onClose={() => setGoalOwner(null)} />}
      <MilestoneAreas key={childProfile.id} observations={observations} momentText={title} primaryMoveProps={{ "data-primary-move": "start-development-check" }}
        onExplore={exploreDomain} composition={composition} onOpened={onOpened}>
        {({ map, check, area, suggest, next, openDomain }) => (
          <>
            <Guide stops={stops} label={v10.onThisPage} mini={!desk} />
            <Route composition={composition}>
              <RouteSection id="ms-areas" n={1} on aria-labelledby="ms-title">
                <div data-module="child-milestones-areas">
                  <MilestonesBand composition={composition} kicker={t("companion.milestones.kicker")} title={heading} titleId="ms-title"
                    sub={t("elev.loop.ms.footer")} current="development" totals={totals}>
                    {map}
                  </MilestonesBand>
                </div>
              </RouteSection>
              <RouteSection id="ms-area" n={2} aria-labelledby="ms-area-title">
                <div className="ms-row" data-module="child-milestones-area">
                  <div className="stg">
                    <div className="mcst" data-testid="ms-open-area">
                      <div className="mcsh">
                        <span className="tg" aria-hidden="true"><Icon name={DOMAIN_ICONS[openDomain]} size={22} /></span>
                        <h2 className="tt" id="ms-area-title">{domainName(openDomain, t)}</h2>
                        <MoreLink href={`#${routeHash("milestones")}`}>{v10.everyItem}</MoreLink>
                      </div>
                      <AreaTimeline domain={openDomain} milestones={milestones} composition={composition} gender={childProfile.gender ?? null} />
                      {area}
                    </div>
                  </div>
                  <div className="rlc">
                    <MilestonesReadGuide />
                    {suggest}
                    <div className="mcc ms-focus-check">
                      <GoalFocus onEditGoal={() => setGoalOwner(childProfile.id)} />
                      {check}
                    </div>
                  </div>
                </div>
              </RouteSection>
              <RouteSection id="ms-words" n={3} aria-labelledby="ms-words-title">
                <div data-module="child-milestones-portrait">
                  <RouteHead id="ms-words-title" title={v10.wordsTitle} />
                  <div className="ms-objs"><PortraitCards sources={record.sources} /></div>
                  <ThenAndNow observations={observations} logs={record.sources.behaviorLogs ?? []} now={now} />
                </div>
              </RouteSection>
              <RouteSection id="ms-next" n={4} aria-labelledby="ms-next-title">
                <RouteHead id="ms-next-title" title={v10.nextTitle} link={<MoreLink href={`#${routeHash("milestones")}`}>{v10.allMilestones}</MoreLink>} />
                {next}
              </RouteSection>
            </Route>
          </>
        )}
      </MilestoneAreas>
    </DsRoot>
  );
}
