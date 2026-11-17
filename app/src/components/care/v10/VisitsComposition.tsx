import React from "react";
import { Guide, Route, RouteSection, RouteHead, SideRail, type GuideStop } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { Icon } from "../../ui/Icon";
import { sortAppointments, type Appointment } from "../../../lib/careTrack";
import { useChildCollection } from "../../../hooks/useChildCollection";
import type { AskSpecialistParts } from "../../sections/AskSpecialist";
import VisitScene, { type PackedCounts } from "./VisitScene";
import { openAddAppointment } from "./VisitTimeline";
import { daysUntil } from "../CareVisitHead";
import { careCopy } from "./careV10Copy";
import { useShellRowEnd } from "../../../lib/shellSlots";
import { appointmentRoleLabel } from "../../../lib/appointmentLabel";
import { fmtDayV10 } from "../../../lib/formatDate";
import "./care.css";

/* Care › Visits (design v10.1, boards N-Care and N-Brief): the builder's parts
   placed in four numbered sections that match the guide —
   1 · the next visit (the scene: H1, days to go, runway, packed so far, the
       one move), 2 · getting ready (the rail: who it is for, your one line),
   3 · the visit summary (choose what to bring · preview · share), and on the
       landing 4 · appointments (the dated line, the next and last visit, the
       last visit's note) with Help and the pause beside it, then what is
       shared. The Teacher brief is the same screen with the teacher chosen:
       two stops, The brief (the scene, its template card inside it) and
       Share and draft (the School Brief editor: save, copy, draft).
   Desktop is the stage-and-rail composition; phone is one column in the same
   order. One tree renders (useComposition), so every control exists once. */

const SECTION = { visit: "care-visit", ready: "care-ready", summary: "care-summary", appointments: "care-appointments" } as const;

export default function VisitsComposition({ composition, parts, visit, heading, sublines, packed, landing, followUp, homeDoor = null, timeline, aside, shared, nowMs }: {
  composition: Composition;
  parts: AskSpecialistParts;
  visit: Appointment | null;
  heading: React.ReactNode;
  sublines: React.ReactNode;
  packed: PackedCounts;
  landing: boolean;
  followUp: React.ReactNode;
  /** "I have recommendations for home" (the landing's home-program door). */
  homeDoor?: React.ReactNode;
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
    ? desk
      ? [
          { id: SECTION.visit, title: copy.brief.stopBrief, sub: copy.brief.stopBriefSub },
          { id: SECTION.summary, title: copy.brief.stopShare, sub: copy.brief.stopShareSub },
        ]
      : [
          // V77 N-Brief-M: the phone guide's short stops — the brief, then the page itself.
          { id: SECTION.visit, title: copy.brief.stopShortBrief },
          { id: SECTION.summary, title: copy.brief.stopShortPage },
        ]
    : !desk && landing
    ? [
        // Design V77 (N-Care-M): the phone guide's short stops — the visit (and getting ready, in its card), the summary, the dates.
        { id: SECTION.visit, title: c.stopShort.visit },
        { id: SECTION.summary, title: c.stopShort.summary },
        { id: SECTION.appointments, title: c.stopShort.dates },
      ]
    : [
        landing
          ? { id: SECTION.visit, title: c.stopVisit, sub: c.stopVisitSub }
          : { id: SECTION.visit, title: t("nav.view.handoff"), sub: c.stopSummarySub },
        { id: SECTION.ready, title: c.stopReady, sub: c.stopReadySub },
        { id: SECTION.summary, title: c.stopSummary, sub: c.stopSummarySub },
        ...(landing ? [{ id: SECTION.appointments, title: c.stopAppointments, sub: c.stopAppointmentsSub }] : []),
      ];

  /* The scene's foot: the builder's move, or for the Teacher brief a line
     naming the next visit (the brief's own Save as PDF is its move). */
  const briefWho = <section className="rcard tint fit care-who care-brief-who">{parts.audience}</section>;
  const sceneHeading = (
    <div className="stack care-heading">
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
      reviewed={parts.reviewed}
      nowMs={nowMs}
      brief={teacher || !landing}
      briefKicker={teacher ? (desk ? copy.brief.kicker : t("elev.consult.template.teacher")) : undefined}
      // V77 N-Brief-D: the brief's header row names the next visit ("Next visit: speech therapist, Wed 25 Nov").
      briefLine={teacher && visit && desk && visit.whenIso ? copy.brief.nextVisit(uiLang === "en" ? appointmentRoleLabel(visit, t).toLowerCase() : appointmentRoleLabel(visit, t), fmtDayV10(visit.whenIso, uiLang)) : undefined}
      aside={teacher ? briefWho : undefined}
    />
  );

  /* Desktop: who it is for and your one line are two cards in the rail;
     phone (V77 N-Care-M): one tint card holds both. */
  const ready = desk ? (
    <>
      <section className="rcard tint fit care-who">{parts.audience}</section>
      {parts.reason && <section className="rcard fit care-reason">{parts.reason}</section>}
      {parts.visionNote}
    </>
  ) : (
    <>
      <section className="rcard tint fit care-who care-who-phone">
        {parts.audience}
        {parts.reason && <div className="care-reason">{parts.reason}</div>}
        {/* V77 N-Care-M: "I have recommendations for home" closes the card. */}
        {landing && homeDoor}
      </section>
      {parts.visionNote}
    </>
  );

  const summary = teacher ? (
    <>
      <div className="vt care-teacher">{parts.teacher}</div>
    </>
  ) : (
    <>
      <section className="vt care-bring" aria-labelledby="care-bring-title">
        <h3 id="care-bring-title" className="care-cardhead"><span className="care-gi" aria-hidden="true"><Icon name="description" size={22} /></span>{t("elev.consult.step.bring")}</h3>
        {parts.bring}
        {parts.packet}
      </section>
      {parts.preview && (
        <section className="vt care-preview" aria-labelledby="care-preview-title">
          <h3 id="care-preview-title" className="care-cardhead"><span className="care-gi" aria-hidden="true"><Icon name="visibility" size={22} /></span>{c.previewHead}</h3>
          {parts.preview}
        </section>
      )}
      {parts.share && (
        <section className="vt care-share">
          {parts.share}
          {/* V77 N-Care-D: "I have recommendations for home" closes the Share card. */}
          {desk && landing && homeDoor}
        </section>
      )}
    </>
  );

  // V77 (N-Care-D, N-Brief-D): the shell's pill row ends with the day and time, then "Add appointment"
  // (the same action as section 4's head, which the board also draws). Not on #/handoff.
  useShellRowEnd(landing || teacher ? {
    action: { label: t("elev.careNet.appt.add"), onClick: () => openAddAppointment(setActiveTab), icon: "add", testId: "care-row-add-appointment" },
  } : null);

  const addAppointment = (
    <button type="button" className="ds-link care-add" onClick={() => openAddAppointment(setActiveTab)}>
      <Icon name="add" size={18} /> {t("elev.careNet.appt.add")}
    </button>
  );

  return (
    <div className="care-visits">
      <Guide stops={stops} mini={!desk} label={copy.onThisPage} className="care-guide" />
      <Route composition={composition}>
        <RouteSection id={SECTION.visit} n={1} on>
          {teacher ? (
            /* phone (V77 N-Brief-M): the link back to Visits sits in the hero, under its heading */
            <div className={desk ? "g12 care-row-a" : "stack care-phone-a"}>{scene}</div>
          ) : desk ? (
            <div className="g12 care-row-a" data-testid={landing ? "consult-visit-card" : undefined}>
              {scene}
              <SideRail id={SECTION.ready} n={2} title={c.readyHead} sub={c.readySub} className="x4 care-rail">
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

        <RouteSection id={SECTION.summary} n={teacher || !desk ? 2 : 3} aria-labelledby="care-summary-title">
          {/* V77 N-Brief-M: on a phone the brief's page is its own section ("The brief · you review every line"). */}
          <RouteHead id="care-summary-title" title={teacher ? (desk ? copy.brief.stopShare : copy.brief.pageHead) : c.summaryHead} sub={teacher ? (desk ? copy.brief.stopShareSub : c.summarySub) : c.summarySub} />
          <div className={desk ? (teacher ? "care-row-c" : "g12 care-row-b") : "stack care-phone-b"}>{summary}</div>
          {!landing && followUp}
        </RouteSection>

        {landing && (
          <RouteSection id={SECTION.appointments} n={desk ? 4 : 3} aria-labelledby="care-appointments-title">
            <RouteHead id="care-appointments-title" title={c.stopAppointments} sub={c.appointmentsSub(sorted.upcoming.length, sorted.past.length)} link={addAppointment} />
            <div className={desk ? "g12 care-row-d" : "stack care-phone-d"}>
              <div className={desk ? "x8 stack care-appts-col" : "stack care-appts-col"}>
                {timeline}
                {/* V77 N-Care-M: "At home while you wait" follows the past visits. */}
                {!desk && parts.home}
                {followUp}
              </div>
              <div className={desk ? "x4 stack care-aside-col" : "stack care-aside-col"}>
                {/* V77 N-Care-D: "At home while you wait" heads the rail beside the appointments. */}
                {desk && parts.home && <div className="rcard fit care-home-practice">{parts.home}</div>}
                {aside}
              </div>
            </div>
            <div className="care-shared-row">{shared}</div>
          </RouteSection>
        )}
      </Route>
    </div>
  );
}
