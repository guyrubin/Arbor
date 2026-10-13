import React, { useEffect, useMemo, useState } from "react";
import GoalBuilderModal from "../practice/GoalBuilderModal";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useObservationRecord } from "../../hooks/useObservationRecord";
import { domainName, type DomainId } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";
import { milestoneText } from "../../lib/milestoneData";
import { behaviorTypeLabel } from "../../content/behaviorTaxonomy";
import { portraitDiscussionPrompt } from "./portraitModel";
import { PORTRAIT_COPY } from "./portraitCopy";
import { trackCompanionPlaceOpen } from "../../lib/kpiEvents";
import ChildDoors, { useChildPhoneLayout } from "./ChildDoors";
import MilestoneAreas from "./MilestoneAreas";
import PortraitCards from "./PortraitCards";
import "./childPortrait.css";

/**
 * v3 F-CHILD-1 — My child, the Milestones pill (#/development): one scroll.
 *
 *  1. The header: "MY CHILD · GROWTH" and "<name>'s growth, in your words."
 *     (the name isolated in <bdi>). No identity button: the About pill holds
 *     the child's details now.
 *  2. Three portrait cards (PortraitCards): a strength, a moment the parent
 *     kept, and what the family is working on (the goal picker opens here).
 *  3. "Milestones across areas" (MilestoneAreas → DevelopmentMap): eight
 *     area rows with Seen-it pips and the newest moment; a row opens inline
 *     (a sheet on a phone) to answer its skills; the 5-minute check is the
 *     page's one primary move; the growing line and the record note close it.
 *
 * The moments views (over time, in different places, across areas) belong to
 * the Moments pill; the care and record doors belong to Care and the pills.
 *
 * v3 F-CHILD-4 (MOB-02) — on a phone (below 768 px) the pill is one stack,
 * as the mock's Phone frame: the areas card comes first (tiles, each opening
 * its area in a bottom sheet), the h1 stays for screen readers only (the pill
 * row names the place), then the goal card (the goal picker's only door; the
 * strength and kept cards are wide-screen only), then the doors to the
 * journal, the memory and Care (the check's door is the page's own primary
 * move, so it is not repeated). The memory door reads the waiting queue
 * itself: this pill shows no proposal, so any that waits is named there, in
 * words, as About names one its areas do not show. The modules are built
 * once and only their order changes, so a pill keeps its two modules and its
 * one primary move at every width.
 * CLINICAL FIREWALL: Seen-it counts and the parent's own words only.
 */
export interface ChildPortraitProps {
  onDiscuss?: (prompt: string, childId: string) => void;
}

export default function ChildPortrait({ onDiscuss }: ChildPortraitProps) {
  const { childProfile, milestones, seedCoach } = useArbor();
  const { t, uiLang } = useLanguage();
  const phone = useChildPhoneLayout();
  const copy = PORTRAIT_COPY[uiLang === "he" ? "he" : "en"];
  useEffect(() => { trackCompanionPlaceOpen("child"); }, [childProfile.id]);
  const [goalOwner, setGoalOwner] = useState<string | null>(null);
  useEffect(() => { setGoalOwner(null); }, [childProfile.id]);
  const record = useObservationRecord();
  const observations = useMemo(() => record.observations.filter(o => o.childId === childProfile.id), [record.observations, childProfile.id]);
  const logMap = useMemo(() => new Map((record.sources.behaviorLogs ?? []).map(log => [`behaviorLogs:${log.id}`, log])), [record.sources.behaviorLogs]);
  const name = (childProfile.name || "").split(/\s+/)[0] || childProfile.name;
  const [titleBefore, titleAfter = ""] = t("companion.milestones.title").split("{name}");
  // A row quotes the newest moment in the parent's own words (never the stored type).
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

  const heading = <>{titleBefore}<bdi dir="auto">{name}</bdi>{titleAfter || null}</>;
  // Each module is built once; a phone only reorders them (keys keep their state).
  const portraitModule = <div key="portrait" data-module="child-milestones-portrait">
    {!phone && <header className="portrait-intro">
      <div>
        <p className="portrait-kicker">{t("companion.milestones.kicker")}</p>
        <h1>{heading}</h1>
      </div>
    </header>}
    <PortraitCards sources={record.sources} onEditGoal={() => setGoalOwner(childProfile.id)} />
  </div>;
  const areasModule = <div key="areas" data-module="child-milestones-areas">
    {goalOwner === childProfile.id && <GoalBuilderModal key={`goal-picker:${childProfile.id}`} open childId={childProfile.id} childName={childProfile.name}
      behaviorLogs={record.sources.behaviorLogs ?? []}
      onClose={() => setGoalOwner(null)} />}
    <MilestoneAreas key={childProfile.id} observations={observations} momentText={title} primaryMoveProps={{ "data-primary-move": "start-development-check" }} onExplore={exploreDomain} />
  </div>;

  return <section className="child-portrait milestones-body" dir={uiLang === "he" ? "rtl" : "ltr"} data-testid="child-portrait">
    {phone
      ? [<h1 key="title" className="sr-only">{heading}</h1>, areasModule, portraitModule, <ChildDoors key="doors" omit="screening" />]
      : [portraitModule, areasModule]}
  </section>;
}
