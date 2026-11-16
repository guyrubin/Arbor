import React from "react";
import { Guide, Route, RouteSection, RouteHead, SideRail, type GuideStop } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { Icon } from "../../ui/Icon";
import { appointmentRoleLabel } from "../../../lib/appointmentLabel";
import { fmtDay } from "../../../lib/formatDate";
import { sortAppointments, type Appointment } from "../../../lib/careTrack";
import { useChildCollection } from "../../../hooks/useChildCollection";
import type { AskSpecialistParts } from "../../sections/AskSpecialist";
import VisitScene, { type PackedCounts } from "./VisitScene";
import { openAddAppointment } from "./VisitTimeline";
import { daysUntil } from "../CareVisitHead";
import { careCopy } from "./careV10Copy";
import "./care.css";

/* Care › Visits (design v10.1, boards N-Care and N-Brief): the builder's parts
   placed in four numbered sections that match the guide —
   1 · the next visit (the scene: H1, days to go, runway, packed so far, the
       one move), 2 · getting ready (the rail: who it is for, your one line),
   3 · the visit summary (choose what to bring · preview · share), and on the
       landing 4 · appointments (the dated line, the next and last visit, the
       last visit's note) with Help and the pause beside it, then what is
       shared. The Teacher brief is the same screen with the teacher chosen:
       its three stops read The brief · Who it is for · What goes in.
   Desktop is the stage-and-rail composition; phone is one column in the same
   order. One tree renders (useComposition), so every control exists once. */

const SECTION = { visit: "care-visit", ready: "care-ready", summary: "care-summary", appointments: "care-appointments" } as const;

export default function VisitsComposition({ composition, parts, visit, heading, sublines, packed, landing, followUp, timeline, aside, shared, nowMs }: {
  composition: Composition;
  parts: AskSpecialistParts;
  visit: Appointment | null;
  heading: React.ReactNode;
  sublines: React.ReactNode;
  packed: PackedCounts;
  landing: boolean;
  followUp: React.ReactNode;
  timeline: React.ReactNode;
  aside: React.ReactNode;
  shared: React.ReactNode;
  nowMs: number;
}) {
  const { childProfile, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const copy = careCopy(uiLang);
  const c = copy.visits;
  const desk = composition === "desk";
  const teacher = parts.isTeacher;
  const apptsCol = useChildCollection<Appointment>(childProfile.id, "appointments");
  const sorted = sortAppointments(apptsCol.items, nowMs);
  const days = visit ? daysUntil(visit.whenIso, nowMs) : null;

  const stops: GuideStop[] = teacher
    ? [
        { id: SECTION.visit, title: copy.brief.stopBrief, sub: copy.brief.stopBriefSub },
        { id: SECTION.ready, title: copy.brief.stopWho, sub: copy.brief.stopWhoSub },
        { id: SECTION.summary, title: copy.brief.stopIn, sub: copy.brief.stopInSub },
      ]
    : [
        landing
          ? { id: SECTION.visit, title: c.stopVisit, sub: days !== null ? c.stopVisitSub(days) : c.stopVisitNone }
          : { id: SECTION.visit, title: t("nav.view.handoff"), sub: c.stopSummarySub },
        { id: SECTION.ready, title: c.stopReady, sub: c.stopReadySub },
        { id: SECTION.summary, title: c.stopSummary, sub: c.stopSummarySub },
        ...(landing ? [{ id: SECTION.appointments, title: c.stopAppointments, sub: c.stopAppointmentsSub(sorted.upcoming.length, sorted.past.length) }] : []),
      ];

  /* The scene's foot: the builder's move, or for the Teacher brief a line
     naming the next visit (the brief's own Save as PDF is its move). */
  const sceneHeading = (
    <div className="stack care-heading">
      {teacher && <span className="kicker">{copy.brief.kicker}</span>}
      {heading}
      {sublines}
    </div>
  );
  const scene = (
    <VisitScene
      composition={composition}
      visit={landing && !teacher ? visit : null}
      heading={sceneHeading}
      packed={landing && !teacher ? packed : { moments: 0, milestones: 0, words: 0 }}
      build={parts.build}
      nowMs={nowMs}
      brief={teacher || !landing}
      briefLine={teacher && visit?.whenIso ? copy.brief.nextVisit(appointmentRoleLabel(visit, t), fmtDay(visit.whenIso, uiLang)) : undefined}
    />
  );

  const ready = (
    <>
      <section className="rcard tint fit care-who">{parts.audience}</section>
      {parts.reason && <section className="rcard fit care-reason">{parts.reason}</section>}
      {parts.visionNote}
    </>
  );

  const summary = teacher ? (
    <div className="vt care-teacher">{parts.teacher}</div>
  ) : (
    <>
      <section className="vt care-bring">
        {parts.bring}
        {parts.packet}
      </section>
      {parts.preview && <section className="vt care-preview">{parts.preview}</section>}
      {parts.share && <section className="vt care-share">{parts.share}</section>}
    </>
  );

  const addAppointment = (
    <button type="button" className="ds-link care-add" onClick={() => openAddAppointment(setActiveTab)}>
      <Icon name="add" size={16} /> {t("elev.careNet.appt.add")}
    </button>
  );

  return (
    <div className="care-visits">
      <Guide stops={stops} mini={!desk} label={copy.onThisPage} className="care-guide" />
      <Route composition={composition}>
        <RouteSection id={SECTION.visit} n={1} on>
          {desk ? (
            <div className="g12 care-row-a" data-testid={landing ? "consult-visit-card" : undefined}>
              {scene}
              <SideRail id={SECTION.ready} n={2} title={teacher ? copy.brief.stopWho : c.readyHead} sub={teacher ? undefined : c.readySub} className="x4 care-rail">
                {ready}
              </SideRail>
            </div>
          ) : (
            <div className="stack care-phone-a" data-testid={landing ? "consult-visit-card" : undefined}>
              {scene}
              <div id={SECTION.ready} className="stack care-phone-ready">{ready}</div>
            </div>
          )}
        </RouteSection>

        <RouteSection id={SECTION.summary} n={3} aria-labelledby="care-summary-title">
          <RouteHead id="care-summary-title" title={teacher ? copy.brief.stopIn : c.summaryHead} sub={teacher ? undefined : c.summarySub} />
          <div className={desk ? (teacher ? "care-row-c" : "g12 care-row-b") : "stack care-phone-b"}>{summary}</div>
          {!landing && followUp}
        </RouteSection>

        {landing && (
          <RouteSection id={SECTION.appointments} n={4} aria-labelledby="care-appointments-title">
            <RouteHead id="care-appointments-title" title={c.stopAppointments} sub={c.appointmentsSub(sorted.upcoming.length, sorted.past.length)} link={addAppointment} />
            <div className={desk ? "g12 care-row-d" : "stack care-phone-d"}>
              <div className={desk ? "x8 stack care-appts-col" : "stack care-appts-col"}>
                {timeline}
                {followUp}
              </div>
              <div className={desk ? "x4 stack care-aside-col" : "stack care-aside-col"}>{aside}</div>
            </div>
            <div className="care-shared-row">{shared}</div>
          </RouteSection>
        )}
      </Route>
    </div>
  );
}
