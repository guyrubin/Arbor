import React, { useMemo } from "react";
import { Icon } from "../ui/Icon";
import { CareGlyph } from "./CareVisitHead";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { homeForTab } from "../../lib/companionPlaces";
import { sectionForTab } from "../../lib/navigation";
import { fmtDayShort } from "../../lib/formatDate";
import { appointmentStatus, sortAppointments, type Appointment, type AppointmentFollowUp } from "../../lib/careTrack";
import type { ActiveTab } from "../../lib/routes";

/* v3 EXTRA-CARE — the Care landing's doors: the three Care pages a parent
   opens from here (School brief, Appointments, Care summary), each an
   existing internal route that belongs to the Care door (homeForTab), with
   the glyph its pill already carries. Never a professional directory and
   never a way to find or contact someone new (B-CAREPRO-19). The trust line
   closes the module.
   v3 F-CARE-1 (mock :356-359, phone :738-739): three cards with a glyph blob
   from sm, full width under the visit card and the aside from xl; below sm,
   rows with a plain glyph and an end chevron. The Appointments door reads
   the family's own calendar: the next booking's day and how many past
   visits have an outcome written down (a count of visits, never a score). */

type Door = { tab: ActiveTab; titleKey: string; subKey: string };

const DOORS: readonly Door[] = [
  { tab: "school-brief", titleKey: "nav.pill.school-brief", subKey: "elev.consult.door.schoolBrief" },
  { tab: "appointments", titleKey: "nav.tab.appointments", subKey: "elev.consult.door.appointments" },
  { tab: "handoff", titleKey: "nav.tab.handoff", subKey: "elev.consult.door.summary" },
];

/** The doors that really belong to Care, each with its pill's own glyph. */
export function careDoors(): { tab: ActiveTab; titleKey: string; subKey: string; icon: string }[] {
  return DOORS.flatMap((door) => {
    const home = homeForTab(door.tab);
    if (home.kind !== "door" || home.door.id !== "care") return [];
    const icon = sectionForTab(door.tab).items.find((item) => item.tab === door.tab)?.msIcon;
    return icon ? [{ ...door, icon }] : [];
  });
}

/** v3 F-CARE-1: the Appointments door's live line — the next dated booking
 *  not marked done, and the past visits that have an outcome written down.
 *  Null when neither exists (the door keeps its static line). */
export function appointmentsDoorFacts(
  appts: Appointment[],
  followUps: readonly AppointmentFollowUp[],
  nowMs: number,
): { nextIso: string | null; pastWithOutcome: number } | null {
  const { upcoming, past } = sortAppointments(appts, nowMs);
  const next = upcoming.find((a) => !!a.whenIso && appointmentStatus(a) !== "done") ?? null;
  const pastWithOutcome = past.filter((a) => followUps.some((f) => f.apptId === a.id)).length;
  if (!next && pastWithOutcome === 0) return null;
  return { nextIso: next?.whenIso ?? null, pastWithOutcome };
}

export default function CareDoors() {
  const { childProfile, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const doors = careDoors();
  const apptsCol = useChildCollection<Appointment>(childProfile.id, "appointments");
  const followUpsCol = useChildCollection<AppointmentFollowUp>(childProfile.id, "apptFollowUps");
  const facts = useMemo(
    () => (apptsCol.loaded && !apptsCol.error ? appointmentsDoorFacts(apptsCol.items, followUpsCol.items, Date.now()) : null),
    [apptsCol.loaded, apptsCol.error, apptsCol.items, followUpsCol.items],
  );
  const subOf = (door: Door): string => {
    if (door.tab !== "appointments" || !facts) return t(door.subKey);
    const parts = [
      facts.nextIso ? t("elev.consult.door.appointments.next", { day: fmtDayShort(facts.nextIso, uiLang) }) : "",
      facts.pastWithOutcome > 0
        ? t(facts.pastWithOutcome === 1 ? "elev.consult.door.appointments.past.one" : "elev.consult.door.appointments.past.other", { n: facts.pastWithOutcome })
        : "",
    ].filter(Boolean);
    return parts.join(" · ");
  };
  return (
    <nav data-module="consult-doors" aria-label={t("elev.consult.doors.label")} className="min-w-0 xl:col-span-2 flex flex-col gap-3.5">
      <ul className="grid gap-2.5 sm:gap-3 sm:grid-cols-3">
        {doors.map((door) => (
          <li key={door.tab} className="min-w-0">
            <button
              type="button"
              data-testid="care-door"
              data-door={door.tab}
              onClick={() => setActiveTab(door.tab)}
              className="w-full h-full flex items-center gap-2.5 sm:gap-3 rounded-[18px] px-3.5 py-3 sm:p-4 min-h-[44px] text-start transition hover:brightness-[0.98]"
              style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", boxShadow: "0 0 0 1px var(--arbor-rule), var(--shadow-sm)" }}
            >
              <Icon name={door.icon} size={20} className="sm:hidden flex-shrink-0" style={{ color: "var(--arbor-sky-ink)" }} />
              <CareGlyph icon={door.icon} className="hidden sm:inline-flex" />
              <span className="min-w-0 flex-1 flex flex-col">
                <span className="t-sm font-extrabold">{t(door.titleKey)}</span>
                <span data-testid="care-door-sub" className="t-xs leading-snug" style={{ color: "var(--arbor-ink-soft)" }}>{subOf(door)}</span>
              </span>
              <Icon name="chevron_right" size={18} className="sm:hidden flex-shrink-0 rtl:-scale-x-100" style={{ color: "var(--arbor-ink-soft)" }} />
            </button>
          </li>
        ))}
      </ul>
      <p data-testid="consult-trust-line" className="flex items-start gap-2 t-xs leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>
        <Icon name="verified_user" size={17} className="flex-shrink-0 mt-px" style={{ color: "var(--arbor-green-ink)" }} />
        <span>{t("elev.consult.trust")}</span>
      </p>
    </nav>
  );
}
