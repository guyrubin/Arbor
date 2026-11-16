import React from "react";
import { Icon } from "../../ui/Icon";
import { Scene, LivingForm, Fig, Token, StartHere } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { appointmentRoleLabel } from "../../../lib/appointmentLabel";
import { fmtDay, fmtDayTime } from "../../../lib/formatDate";
import type { Appointment } from "../../../lib/careTrack";
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

export type PackedCounts = { moments: number; milestones: number; words: number };

export default function VisitScene({ composition, visit, heading, packed, build, brief = false, briefLine, aside, nowMs = Date.now() }: {
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
  const when = visit ? (visit.whenIso ? fmtDayTime(visit.whenIso, uiLang) : visit.when) : null;
  const visitDay = visit?.whenIso ? new Date(visit.whenIso) : null;
  const todayLabel = fmtDay(new Date(nowMs).toISOString(), uiLang);
  const dateLabel = visit?.whenIso ? fmtDay(visit.whenIso, uiLang) : "";
  const tiles = [
    { n: packed.moments, unit: c.packedMoments(packed.moments), sub: c.packedMomentsSub },
    { n: packed.milestones, unit: c.packedMilestones(packed.milestones), sub: c.packedMilestonesSub },
    { n: packed.words, unit: c.packedWords(packed.words), sub: c.packedWordsSub },
  ].filter((x) => x.n > 0);

  const art = desk
    ? <LivingForm src={ART} width={196} height={136} crop={{ w: 250, h: 250, x: -27, y: -60 }} />
    : <LivingForm src={ART} width={72} height={50} crop={{ w: 90, h: 90, x: -9, y: -21 }} />;

  return (
    <Scene
      field="care"
      as="section"
      aria-labelledby="consult-h1"
      data-testid={brief ? undefined : "consult-visit-head"}
      data-visit={brief ? undefined : visit ? "booked" : "none"}
      className={desk ? (aside ? "x12 care-scene" : "x8 care-scene") : "care-scene"}
      orbs={desk
        ? [{ size: 420, left: -230, bottom: -280, opacity: 0.8 }, { size: 360, right: -180, top: -240, opacity: 0.6, b: true }]
        : [{ size: 250, left: -150, bottom: -160, opacity: 0.8 }, { size: 220, right: -130, top: -140, opacity: 0.55, b: true }]}
    >
      {brief ? (
        briefLine && <div className="line between care-scene-top"><span /><span className="small">{briefLine}</span></div>
      ) : (
        <div className="line between care-scene-top">
          <span className="gsec">
            <span className="kicker" data-testid="consult-kicker">{t("elev.consult.kicker")}</span>
            <StartHere>{t("elev.learnCare.brief.startHere")}</StartHere>
          </span>
        </div>
      )}
      {desk ? (
        <div className="line care-scene-main">
          {art}
          <div className="stack care-scene-head">
            {heading}
            {visit && days !== null && <SceneFigure days={days} label={c.daysToGo(days)} when={when} size="xl" badge={badge ? t(badge.key, badge.vars) : ""} />}
            {visit && days === null && when && <p className="care-scene-when">{appointmentRoleLabel(visit, t)} · {when}</p>}
          </div>
          {aside && <div className="care-scene-aside">{aside}</div>}
        </div>
      ) : (
        <>
          {heading}
          <div className="line care-scene-main">
            {art}
            {visit && days !== null
              ? <SceneFigure days={days} label={c.daysToGo(days)} when={when} size="md" badge={badge ? t(badge.key, badge.vars) : ""} />
              : visit ? <p className="care-scene-when">{`${appointmentRoleLabel(visit, t)} · ${when ?? ""}`}</p> : null}
          </div>
          {aside}
        </>
      )}

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
                <Token kind="moment" size="sm" label={x.unit} />
                <span><b>{x.n}</b> {x.unit}<small>{x.sub}</small></span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={desk ? "line care-scene-foot" : "stack care-scene-foot"}>
        {!brief && <button
          type="button"
          data-testid="consult-visit-appointments"
          onClick={() => setActiveTab("appointments")}
          className="ds-link min-h-[44px]"
        >
          <Icon name={visit ? "calendar_month" : "add"} size={16} />
          {t(visit ? "elev.consult.visit.appointments" : "elev.consult.visit.add")}
          <Icon name="chevron_right" size={16} className="rtl:-scale-x-100" />
        </button>}
        {build}
      </div>
    </Scene>
  );
}

function SceneFigure({ days, label, when, size, badge }: { days: number; label: string; when: string | null; size: "xl" | "md"; badge: string }) {
  if (days === 0) {
    return <p className="care-scene-when"><span data-testid="consult-visit-in" className="care-scene-today">{badge}</span>{when ? ` · ${when}` : ""}</p>;
  }
  return (
    <Fig
      n={days}
      size={size}
      unit={<span data-testid="consult-visit-in" aria-label={badge}>{label}</span>}
      sub={when ?? undefined}
    />
  );
}
