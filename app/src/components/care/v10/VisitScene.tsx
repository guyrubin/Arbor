import React from "react";
import { Icon } from "../../ui/Icon";
import { Fig, Token } from "../../../design/primitives";
import CareStage from "./CareStage";
import type { Composition } from "../../../design/useComposition";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { appointmentRoleLabel } from "../../../lib/appointmentLabel";
import { fmtDayV10, fmtDayTimeV10 } from "../../../lib/formatDate";
import { appointmentStatus, type Appointment } from "../../../lib/careTrack";
import { modeLabel } from "./VisitTimeline";
import { daysUntil, inDaysLabel } from "../CareVisitHead";
import { careCopy } from "./careV10Copy";

/* Care › Visits, section 1 (design v10.1): the next visit as a scene — the
   page's H1, the days to the family's own booking as a figure, the runway
   (one dash per day left, the date at its end) and what is already packed
   from the record. Calendar facts and counts of what the parent recorded;
   never a judgement about the child. With no booking, production's own
   empty line and its door to Appointments. The builder's one move (Build the
   one-page summary) is handed in and sits at the scene's foot. */

/** Days the runway draws at most (the Prepare window is 14 days). */
const RUNWAY_MAX = 14;
const ART = "/visuals/parent/v2/area-words-960.webp";

export type PackedCounts = { moments: number; milestones: number; words: number; planSteps?: number };

export default function VisitScene({ composition, visit, heading, packed, build, brief = false, briefLine, briefKicker, aside, reviewed = false, nowMs = Date.now() }: {
  /** The Teacher brief's kicker, in the stage's header row beside Start here (V77 N-Brief). */
  briefKicker?: React.ReactNode;
  /** The parent ticked "I reviewed" (the stepper's Review step). */
  reviewed?: boolean;
  /** The Teacher brief: who it is for and the template, as a card inside the
   *  full-width scene (design v10.1 size pass: no rail on the brief). */
  aside?: React.ReactNode;
  /** Heading only (the Visit summary and Teacher brief routes): no visit head,
   *  runway or counts — production keeps those on the landing. */
  brief?: boolean;
  /** "Next visit: …" beside the brief's kicker, when a visit is booked. */
  briefLine?: string;
  composition: Composition;
  visit: Appointment | null;
  /** The page's one h1 (ConsultTab owns its wording). */
  heading: React.ReactNode;
  packed: PackedCounts;
  /** The builder's Build button (the route's primary move). */
  build: React.ReactNode;
  nowMs?: number;
}) {
  const { setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const c = careCopy(uiLang).visits;
  const desk = composition === "desk";
  const days = visit ? daysUntil(visit.whenIso, nowMs) : null;
  const badge = days === null ? null : inDaysLabel(days);
  const when = visit ? (visit.whenIso ? fmtDayTimeV10(visit.whenIso, uiLang) : visit.when) : null;
  // "confirmed, in person": the booking's own status and mode, in the reader's words.
  const statusLine = visit ? [t(`elev.learnCare.appt.status.${appointmentStatus(visit)}`), visit.mode ? modeLabel(visit.mode, t) : ""]
    .filter(Boolean).map((x) => (uiLang === "en" ? x.toLowerCase() : x)).join(", ") : "";
  const visitDay = visit?.whenIso ? new Date(visit.whenIso) : null;
  const todayLabel = fmtDayV10(new Date(nowMs).toISOString(), uiLang);
  const dateLabel = visit?.whenIso ? fmtDayV10(visit.whenIso, uiLang) : "";
  const tiles = [
    { n: packed.moments, unit: c.packedMoments(packed.moments), sub: c.packedMomentsSub, kind: "moment" as const },
    { n: packed.milestones, unit: c.packedMilestones(packed.milestones), sub: c.packedMilestonesSub, kind: "moment" as const },
    { n: packed.words, unit: c.packedWords(packed.words), sub: c.packedWordsSub, kind: "moment" as const },
    { n: packed.planSteps ?? 0, unit: c.packedPlan(packed.planSteps ?? 0), sub: c.packedPlanSub, kind: "plan" as const },
  ].filter((x) => x.n > 0);

  const figure = visit && days !== null
    ? <SceneFigure days={days} label={c.daysToGo(days)} when={when} status={desk ? "" : statusLine} size={desk ? "md" : "sm"} badge={badge ? t(badge.key, badge.vars) : ""} />
    : visit && when ? <p className="care-scene-when">{appointmentRoleLabel(visit, t)} · {when}</p> : null;

  return (
    <CareStage
      composition={composition}
      labelledBy="consult-h1"
      data-testid={brief ? undefined : "consult-visit-head"}
      data-visit={brief ? undefined : visit ? "booked" : "none"}
      kicker={brief ? briefKicker : <span data-testid="consult-kicker">{t(desk ? "elev.consult.kicker" : "elev.consult.visit.kicker")}</span>}
      // V77 N-Brief: the Teacher brief's stage is where the page starts too.
      startHere={!brief || !!briefKicker}
      note={briefLine ?? (desk && !brief ? t("elev.consult.template.note.visit") : undefined)}
      art={desk || briefKicker ? ART : undefined}
      artOnPhone={!!briefKicker}
      heading={desk && visit && !brief ? <><span className="care-scene-over">{[t("elev.consult.visit.kicker"), statusLine].filter(Boolean).join(" · ")}</span>{heading}</> : heading}
      figure={figure}
      aside={aside}
      wide={!!aside}
    >
      {visit && days !== null && days > 0 && visitDay && (
        <div className="stack care-runway">
          <div className="runway" role="img" aria-label={c.runwayLabel(days, todayLabel, dateLabel)}>
            <i className="tok here" aria-hidden="true" />
            {Array.from({ length: Math.min(days, RUNWAY_MAX) }, (_, i) => <span key={i} className="rd" />)}
            <i className="tok date lg" aria-hidden="true">{visitDay.getDate()}</i>
          </div>
          {desk && <div className="rwl"><span>{c.today(todayLabel)}</span><span>{dateLabel}</span></div>}
        </div>
      )}


      {!visit && !brief && (
        <p data-testid="consult-visit-none" className="care-scene-none">{t("elev.consult.visit.none")}</p>
      )}

      {tiles.length > 0 && desk && (
        <div className="stack care-packed">
          <span className="kicker">{c.packed}</span>
          <div className="packed" role="group" aria-label={c.packed} style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
            {tiles.map((x) => (
              <span key={x.sub} className="pk">
                <Token kind={x.kind} size="sm" label={x.unit} />
                <span><b>{x.n}</b> {x.unit}<small>{x.sub}</small></span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={desk ? "line care-scene-foot" : "stack care-scene-foot"}>
        {/* Design V77: the hero has no appointments link; with nothing booked
            it offers to add one (Appointments lives in section 4). */}
        {!brief && !visit && <button
          type="button"
          data-testid="consult-visit-appointments"
          onClick={() => setActiveTab("appointments")}
          className="ds-link min-h-[44px]"
        >
          <Icon name={visit ? "calendar_month" : "add"} size={18} />
          {t(visit ? "elev.consult.visit.appointments" : "elev.consult.visit.add")}
          <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" />
        </button>}
        {/* V77: the stepper shares the foot with the one move */}
        {visit && !brief && (
          <ol className="care-steps" aria-label={c.stepsLabel}>
          {([
            [c.stepBooked, "solid"],
            [c.stepChoose, reviewed ? "solid" : "here"],
            [c.stepReview, reviewed ? "solid" : "open"],
            [c.stepShare, reviewed ? "here" : "open"],
          ] as const).map(([label, state], i) => (
            <React.Fragment key={label}>
              {i > 0 && <li aria-hidden="true" className={state === "open" ? "care-steps-ln" : "care-steps-ln on"} />}
              <li className="care-steps-st" aria-current={state === "here" ? "step" : undefined}>
                <Token kind="plan" state={state} size="sm" label={label} />
                <span>{label}</span>
              </li>
            </React.Fragment>
          ))}
        </ol>
      )}
        {build}
      </div>
    </CareStage>
  );
}

function SceneFigure({ days, label, when, status, size, badge }: { days: number; label: string; when: string | null; status: string; size: "xl" | "md" | "sm"; badge: string }) {
  if (days === 0) {
    return <p className="care-scene-when"><span data-testid="consult-visit-in" className="care-scene-today">{badge}</span>{when ? ` · ${when}` : ""}</p>;
  }
  return (
    <Fig
      n={days}
      size={size}
      unit={<span data-testid="consult-visit-in" aria-label={badge}>{label}</span>}
      sub={when ? <>{when}{status && <><br />{status}</>}</> : undefined}
    />
  );
}
