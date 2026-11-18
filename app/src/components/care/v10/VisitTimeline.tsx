import React, { useMemo } from "react";
import { Icon } from "../../ui/Icon";
import { Token } from "../../../design/primitives";
import { useComposition } from "../../../design/useComposition";
import { useArbor } from "../../../context/ArborContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useToast } from "../../../context/ToastContext";
import { ReceiptNoteLine, useReceiptNote } from "../../ui/Receipt";
import { useChildCollection } from "../../../hooks/useChildCollection";
import { appointmentRoleLabel, PROFESSION_KEY } from "../../../lib/appointmentLabel";
import { fmtDayV10, fmtTimeV10 } from "../../../lib/formatDate";
import {
  appointmentStartMs, appointmentStatus, appointmentToIcs, consultAudienceForProfession, defaultIcsEgressDeps,
  isAppointmentProfession, saveIcsFile, sortAppointments, visitRecords,
  type Appointment, type AppointmentFollowUp, type AppointmentProfession,
} from "../../../lib/careTrack";
import { REHEARSAL_MAX_QUESTIONS } from "../../../consult/rehearsalQuestions";
import { RehearseQuestions } from "../../sections/Appointments";
import { careCopy } from "./careV10Copy";

/* Care › Visits, the appointments section (design V77, N-Care-D/M): the next
   booking and the last one as cards, as drawn. The next one carries its acts —
   Add to calendar (the same calendar file Appointments saves), Talk it through
   (Appointments' own rehearsal: nothing kept until Keep) and Add to the visit
   summary (the builder above, prefilled the way Appointments' Prepare does).
   The last one carries the parent's own note from it. Remove is the same
   one-tap remove Appointments has. Past visits and what to ask stay on
   Appointments, one tap away. */

/** Appointments' prepared question (the `apptQuestions` collection). */
type PrepQuestion = { id: string; text: string };

export function openAddAppointment(setActiveTab: (t: "appointments") => void) {
  setActiveTab("appointments");
  if (typeof window !== "undefined") window.location.hash = "#/appointments?add=1";
}

/** Appointments' own reading of a stored mode (provider text passes through). */
export function modeLabel(mode: string, t: (k: string) => string): string {
  return /^in.?person$/i.test(mode) ? t("elev.careNet.mode.inPerson")
    : /^(online|remote|video)$/i.test(mode) ? t("elev.careNet.mode.online")
    : mode;
}

export default function VisitTimeline({ appointments, followUps, nowMs = Date.now() }: {
  appointments: readonly Appointment[];
  followUps: readonly AppointmentFollowUp[];
  nowMs?: number;
}) {
  const { setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const { upcoming, past } = useMemo(() => sortAppointments([...appointments], nowMs), [appointments, nowMs]);
  const lastNote = useMemo(() => visitRecords(appointments, followUps)[0] ?? null, [appointments, followUps]);
  const next = upcoming[0] ?? null;
  const last = past[0] ?? null;
  // V77: "Past visits and what to ask" closes the last visit's card (Appointments holds them).
  const more = (
    <button type="button" className="care-appts-more" data-testid="care-appointments-open" onClick={() => setActiveTab("appointments")}>
      <Icon name="history" size={18} /> <span className="grow">{t("elev.learnCare.appt.more.title")}</span>
      <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" />
    </button>
  );

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
    <div className="care-appts" data-testid="care-appointments">
      <div className="care-vcards">
        {next && <VisitCard appt={next} next />}
        {last && <VisitCard appt={last} note={lastNote && lastNote.apptId === last.id ? lastNote.note : null}>{more}</VisitCard>}
      </div>
      {/* The parent's own note from a visit that is not the last card's. */}
      {lastNote && (!last || lastNote.apptId !== last.id) && (
        <figure className="care-lastnote" data-testid="care-last-visit-note">
          <figcaption className="kicker">{careCopy(uiLang).visits.lastNote} · {fmtDayV10(lastNote.at, uiLang)}</figcaption>
          <blockquote dir="auto" className="ds-said">{lastNote.note}</blockquote>
        </figure>
      )}
      {!last && more}
    </div>
  );
}

function VisitCard({ appt, next = false, note = null, children }: { appt: Appointment; next?: boolean; note?: string | null; children?: React.ReactNode }) {
  const composition = useComposition();
  const desk = composition === "desk";
  const { childProfile, requestConsultPrefill, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const { toast } = useToast();
  const receipt = useReceiptNote();
  const apptsCol = useChildCollection<Appointment>(childProfile.id, "appointments");
  const questionsCol = useChildCollection<PrepQuestion>(childProfile.id, "apptQuestions");
  const c = careCopy(uiLang).visits;
  const status = appointmentStatus(appt);
  const statusLabel = t(`elev.learnCare.appt.status.${status}`);
  const role = appointmentRoleLabel(appt, t);
  const title = appt.who.trim() || role;
  const start = appointmentStartMs(appt);
  const iso = start != null ? new Date(start).toISOString() : null;
  const day = iso ? fmtDayV10(iso, uiLang) : appt.when.trim();
  const time = iso ? fmtTimeV10(iso, uiLang) : "";
  const mode = appt.mode ? modeLabel(appt.mode, t) : "";
  const low = (x: string) => (uiLang === "en" ? x.toLowerCase() : x);

  // The board's lines: desktop "Speech therapist · In person · Wed 25 Nov · 10:00"
  // (the last: "In person · 09:00 · your note"); phone "Wed 25 Nov · 10:00 · in person · confirmed".
  const meta = desk
    ? (next ? [role, mode, day, time] : [mode, time, note ? c.yourNote : ""]).filter(Boolean).join(" · ")
    : [day, time, low(mode), low(statusLabel)].filter(Boolean).join(" · ");

  const saveIcs = async () => {
    const file = appointmentToIcs(appt, Date.now());
    if (!file) return;
    const channel = await saveIcsFile(file, defaultIcsEgressDeps());
    if (channel === "download") receipt.show({ text: t("elev.learnCare.appt.ics.done") });
    else if (channel === "unavailable") toast(t("elev.learnCare.appt.ics.failed"), "error");
  };
  // Appointments' Prepare: the builder takes this professional and the reason already written.
  const addToSummary = () => {
    const profession: AppointmentProfession = appt.profession && isAppointmentProfession(appt.profession) ? appt.profession : "other";
    requestConsultPrefill({
      audience: consultAudienceForProfession(profession),
      reason: t("elev.careNet.appt.prepare.reason", { profession: t(PROFESSION_KEY[profession]), date: day }),
    });
    setActiveTab("consult");
    if (typeof document !== "undefined") document.getElementById("care-ready")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // Appointments' Keep: the reviewed questions join the ones the visit summary carries.
  const keepRehearsal = (reviewed: string[]): string | null => {
    const clean = reviewed.map((x) => x.trim()).filter(Boolean).slice(0, REHEARSAL_MAX_QUESTIONS);
    if (!clean.length) return null;
    const stamp = Date.now();
    clean.forEach((text, i) => void questionsCol.upsert({ id: `q${stamp}-${String(i).padStart(2, "0")}`, text }));
    return clean.length === 1 ? t("elev.learnCare.appt.rehearse.kept.one") : t("elev.learnCare.appt.rehearse.kept.many", { n: clean.length });
  };

  return (
    <section className={next ? "vcard next care-vcard" : "vcard care-vcard"} aria-label={title} data-testid="care-visit-card" data-next={next ? "true" : undefined}>
      <div className="care-vcard-head">
        {!desk && iso && <Token kind="date" size="md" label={day}>{new Date(start!).getDate()}</Token>}
        <div className="care-vcard-what">
          <h3 className="care-vcard-title" dir="auto">{title}</h3>
          {!desk && <p className="small">{meta}</p>}
        </div>
        {desk && <span className={next ? "tagc ink" : "tagc"}>{next || !iso ? statusLabel : `${statusLabel} · ${day}`}</span>}
        <button type="button" className="care-vcard-remove" onClick={() => void apptsCol.remove(appt.id)} aria-label={t("aria.removeAppointment")}>
          <Icon name="delete" size={18} />
        </button>
      </div>
      {desk && <p className="small">{meta}</p>}
      {note && <blockquote dir="auto" className="ds-said care-vcard-note">{note}</blockquote>}
      {children}
      <ReceiptNoteLine note={receipt.note} testId="care-visit-receipt" size="sm" />
      {next && (
        <div className="care-vcard-acts">
          {iso && (
            <button type="button" className="btn primary care-vcard-cal" onClick={() => void saveIcs()}>
              <Icon name="calendar_month" size={18} /> {t("elev.learnCare.appt.ics")}
            </button>
          )}
          <RehearseQuestions lang={uiLang === "he" ? "he" : "en"} onKeep={keepRehearsal} />
          <button type="button" className="mbtn care-vcard-summary" onClick={addToSummary}>
            <Icon name="add" size={18} /> {c.addToSummary}
          </button>
        </div>
      )}
    </section>
  );
}
