import React, { useMemo } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { fmtDay } from "../../lib/formatDate";
import { visitRecords, type Appointment, type AppointmentFollowUp } from "../../lib/careTrack";
import { appointmentRoleLabel } from "../../lib/appointmentLabel";
import { Icon } from "../ui/Icon";

/**
 * B-CAREPRO-37 — My child › About: the newest after-visit note, on its OWN line
 * under the "What Arbor remembers" card (critic r1: inside the card it sat over
 * "Edit or delete any fact" with neither control — a visit note is the
 * parent's record of the visit, edited on #/appointments, not a memory fact).
 * What the parent wrote after the visit, dated by the visit, naming its
 * profession (lib/careTrack visitRecords, the same read the Journal's visit
 * rows use), with the door to every visit. The parent's words only; nothing
 * turns them into Arbor's sentence. Renders nothing without a note.
 */
export default function AboutLastVisit() {
  const { childProfile, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const appointments = useChildCollection<Appointment>(childProfile.id, "appointments");
  const followUps = useChildCollection<AppointmentFollowUp>(childProfile.id, "apptFollowUps");
  const visit = useMemo(() => visitRecords(appointments.items, followUps.items)[0] ?? null, [appointments.items, followUps.items]);
  if (!visit) return null;
  return (
    <div className="about-visit" data-testid="about-visit">
      <Icon name="event_available" size={18} className="about-visit-icon" />
      <p className="about-visit-text">
        <span className="about-visit-meta" data-testid="about-visit-meta">
          {t("companion.about.visit.title", { profession: appointmentRoleLabel({ role: visit.role, profession: visit.profession }, t), date: fmtDay(visit.at, uiLang) })}
        </span>
        <span className="about-visit-note" dir="auto" data-testid="about-visit-note">{visit.note}</span>
      </p>
      <button type="button" className="about-visit-open min-h-11" data-testid="about-visit-open" onClick={() => setActiveTab("appointments")}>
        {t("companion.about.visit.open")}<Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
      </button>
    </div>
  );
}
