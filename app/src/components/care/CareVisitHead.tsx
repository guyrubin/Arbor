import React from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { appointmentRoleLabel } from "../../lib/appointmentLabel";
import { fmtDayTime } from "../../lib/formatDate";
import type { Appointment } from "../../lib/careTrack";

/* v3 EXTRA-CARE — the head of the Care landing's primary card: the next
   visit (who, when) and how many days are left, in neutral ink. A calendar
   fact about the family's own booking, never a judgement about the child.
   ConsultTab hands it to AskSpecialist on #/consult only; the builder sets
   it at the top of the visit card, with the since counts under it, directly
   above the three prep steps. The card draws the surface; this is a row.

   v4 (Care is one screen, no tabs): Appointments left the pill row, so the
   visit head is its home — "All appointments" under the visit, and with no
   visit booked the same row says so and offers to add one. */

const DAY_MS = 86_400_000;

/** Whole calendar days from today to the visit's day, in local time; null
 *  when the date is missing, unreadable or already past. */
export function daysUntil(whenIso: string | undefined, nowMs: number): number | null {
  if (!whenIso) return null;
  const when = new Date(whenIso);
  if (Number.isNaN(when.getTime())) return null;
  const now = new Date(nowMs);
  const startOfVisitDay = new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((startOfVisitDay - startOfToday) / DAY_MS);
  return days >= 0 ? days : null;
}

/** The badge's i18n key and vars for a day count. */
export function inDaysLabel(days: number): { key: string; vars?: Record<string, number> } {
  if (days === 0) return { key: "elev.consult.inDays.zero" };
  if (days === 1) return { key: "elev.consult.inDays.one" };
  if (days === 2) return { key: "elev.consult.inDays.two" };
  return { key: "elev.consult.inDays", vars: { n: days } };
}

const linkCls = "inline-flex items-center gap-1 rounded-full min-h-[44px] t-sm font-bold";

export default function CareVisitHead({ visit, nowMs = Date.now() }: { visit: Appointment | null; nowMs?: number }) {
  const { setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const days = visit ? daysUntil(visit.whenIso, nowMs) : null;
  const badge = days === null ? null : inDaysLabel(days);
  const when = visit ? (visit.whenIso ? fmtDayTime(visit.whenIso, uiLang) : visit.when) : null;
  return (
    <div data-testid="consult-visit-head" data-visit={visit ? "booked" : "none"} className="flex flex-wrap items-start gap-x-3 gap-y-2">
      <span
        aria-hidden="true"
        className="flex-shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl"
        style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
      >
        <Icon name="event" size={22} />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="t-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.consult.visit.kicker")}</p>
        {visit ? <>
          <p className="t-lg font-extrabold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{appointmentRoleLabel(visit, t)}</p>
          {when && <p className="t-sm" style={{ color: "var(--arbor-ink-soft)" }}>{when}</p>}
        </> : (
          <p data-testid="consult-visit-none" className="t-base font-extrabold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("elev.consult.visit.none")}</p>
        )}
        <button
          type="button"
          data-testid="consult-visit-appointments"
          onClick={() => setActiveTab("appointments")}
          className={linkCls}
          style={{ color: "var(--arbor-clay)" }}
        >
          <Icon name={visit ? "calendar_month" : "add"} size={16} />
          {t(visit ? "elev.consult.visit.appointments" : "elev.consult.visit.add")}
          <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
        </button>
      </div>
      {badge && (
        <span
          className="flex-shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 t-xs font-bold whitespace-nowrap"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="schedule" size={14} />
          <span data-testid="consult-visit-in">{t(badge.key, badge.vars)}</span>
        </span>
      )}
    </div>
  );
}
