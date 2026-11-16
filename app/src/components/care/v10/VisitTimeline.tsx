import React, { useMemo } from "react";
import { Icon } from "../../ui/Icon";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { appointmentRoleLabel } from "../../../lib/appointmentLabel";
import { fmtDay, fmtDayTime } from "../../../lib/formatDate";
import { appointmentStatus, sortAppointments, visitRecords, type Appointment, type AppointmentFollowUp } from "../../../lib/careTrack";
import { careCopy } from "./careV10Copy";

/* Care › Visits, section 4 (design v10.1): the family's appointments on one
   dated line (past solid, today ringed, ahead open), the next booking and the
   last one as cards, and the parent's own note from the last visit (its one
   home). Editing a booking (questions, calendar file, Remove appointment,
   Past visits and what to ask) stays on Appointments, one tap away. */

const SHOWN_ON_LINE = 6;

export function openAddAppointment(setActiveTab: (t: "appointments") => void) {
  setActiveTab("appointments");
  if (typeof window !== "undefined") window.location.hash = "#/appointments?add=1";
}

type Mark = { id: string; label: string; date: string; who: string; past: boolean };

export default function VisitTimeline({ appointments, followUps, nowMs = Date.now() }: {
  appointments: readonly Appointment[];
  followUps: readonly AppointmentFollowUp[];
  nowMs?: number;
}) {
  const { setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const c = careCopy(uiLang).visits;
  const { upcoming, past } = useMemo(() => sortAppointments([...appointments], nowMs), [appointments, nowMs]);
  const lastNote = useMemo(() => visitRecords(appointments, followUps)[0] ?? null, [appointments, followUps]);
  const dated = (a: Appointment) => !!a.whenIso && !Number.isNaN(new Date(a.whenIso).getTime());
  const marks: Mark[] = [
    ...[...past].filter(dated).reverse().map((a) => ({ a, past: true })),
    ...upcoming.filter(dated).map((a) => ({ a, past: false })),
  ].slice(-SHOWN_ON_LINE).map(({ a, past: p }) => ({ id: a.id, label: String(new Date(a.whenIso!).getDate()), date: fmtDay(a.whenIso!, uiLang), who: appointmentRoleLabel(a, t), past: p }));
  const firstAhead = marks.findIndex((m) => !m.past);
  const next = upcoming[0] ?? null;
  const last = past[0] ?? null;

  if (appointments.length === 0) {
    return (
      <div className="vt care-appts" data-testid="care-appointments-empty">
        <p className="care-appts-empty">{t("elev.consult.visit.none")}</p>
        <button type="button" className="ds-link" onClick={() => openAddAppointment(setActiveTab)}>
          <Icon name="add" size={18} /> {t("elev.careNet.appt.add")}
        </button>
      </div>
    );
  }

  return (
    <div className="vt care-appts" data-testid="care-appointments">
      {marks.length > 0 && (
        <ol className="care-line" aria-label={c.timelineLabel}>
          {marks.map((m, i) => (
            <React.Fragment key={m.id}>
              {i === firstAhead && (
                <li className="care-line-today" aria-label={c.today(fmtDay(new Date(nowMs).toISOString(), uiLang))}>
                  <i className="tok here sm" aria-hidden="true" />
                </li>
              )}
              <li className={m.past ? "care-line-mark past" : "care-line-mark"}>
                <i className="tok date" aria-hidden="true">{m.label}</i>
                <span className="care-line-date">{m.date}</span>
                <span className="care-line-who">{m.who}</span>
              </li>
            </React.Fragment>
          ))}
        </ol>
      )}
      <div className="care-vcards">
        {next && <VisitCard appt={next} next />}
        {last && <VisitCard appt={last} />}
      </div>
      {lastNote && (
        <figure className="care-lastnote" data-testid="care-last-visit-note">
          <figcaption className="kicker">{c.lastNote} · {fmtDay(lastNote.at, uiLang)}</figcaption>
          <blockquote dir="auto" className="ds-said">{lastNote.note}</blockquote>
        </figure>
      )}
      <div className="care-appts-foot">
        <button type="button" className="ds-link" data-testid="care-appointments-open" onClick={() => setActiveTab("appointments")}>
          <Icon name="history" size={18} /> {t("elev.learnCare.appt.more.title")}
          <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}

/** Appointments' own reading of a stored mode (provider text passes through). */
function modeLabel(mode: string, t: (k: string) => string): string {
  return /^in.?person$/i.test(mode) ? t("elev.careNet.mode.inPerson")
    : /^(online|remote|video)$/i.test(mode) ? t("elev.careNet.mode.online")
    : mode;
}

function VisitCard({ appt, next = false }: { appt: Appointment; next?: boolean }) {
  const { t, uiLang } = useLanguage();
  const status = appointmentStatus(appt);
  const when = appt.whenIso ? fmtDayTime(appt.whenIso, uiLang) : appt.when;
  return (
    <section className={next ? "vcard next care-vcard" : "vcard care-vcard"} aria-label={appointmentRoleLabel(appt, t)}>
      <div className="care-vcard-head">
        <h3 className="care-vcard-title">{appointmentRoleLabel(appt, t)}</h3>
        <span className={next ? "tagc ink" : "tagc"}>{t(`elev.learnCare.appt.status.${status}`)}</span>
      </div>
      <p className="small">{[appt.who && appt.who !== appointmentRoleLabel(appt, t) ? appt.who : null, appt.mode ? modeLabel(appt.mode, t) : null, when].filter(Boolean).join(" · ")}</p>
    </section>
  );
}
