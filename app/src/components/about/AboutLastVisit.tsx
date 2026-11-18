import React, { useMemo } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { fmtDayV10 as fmtDay } from "../../lib/formatDate";
import { visitRecords, type Appointment, type AppointmentFollowUp } from "../../lib/careTrack";
import { appointmentRoleLabel } from "../../lib/appointmentLabel";
import { MoreLink } from "../../design/primitives";

/**
 * B-CAREPRO-37, v10.1 — My child › About: the newest visit, as ONE line and a
 * link to Care › Visits (one home per object: the visit and what the parent
 * wrote after it live on #/appointments, which folds into Visits). The line
 * names the profession and the visit day (lib/careTrack visitRecords, the same
 * read the Journal's visit rows use). Renders nothing without a visit note.
 */
export default function AboutLastVisit({ className }: { className?: string } = {}) {
  const { childProfile, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const appointments = useChildCollection<Appointment>(childProfile.id, "appointments");
  const followUps = useChildCollection<AppointmentFollowUp>(childProfile.id, "apptFollowUps");
  const visit = useMemo(() => visitRecords(appointments.items, followUps.items)[0] ?? null, [appointments.items, followUps.items]);
  if (!visit) return null;
  return (
    <MoreLink className={className} onClick={() => setActiveTab("appointments")}>
      <span data-testid="about-visit">
        {t("companion.about.visit.title", { profession: appointmentRoleLabel({ role: visit.role, profession: visit.profession }, t), date: fmtDay(visit.at, uiLang) })}
      </span>
    </MoreLink>
  );
}
