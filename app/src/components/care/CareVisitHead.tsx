import React from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { appointmentRoleLabel } from "../../lib/appointmentLabel";
import { fmtDayTime } from "../../lib/formatDate";
import type { Appointment } from "../../lib/careTrack";

/* v3 EXTRA-CARE — the head of the Care landing's primary card: the next
   visit (who, when) and how many days are left, in neutral ink. A calendar
   fact about the family's own booking, never a judgement about the child.
   ConsultTab renders it on #/consult only, above the three prep steps. */

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

export default function CareVisitHead({ visit, nowMs = Date.now() }: { visit: Appointment; nowMs?: number }) {
  const { t, uiLang } = useLanguage();
  const days = daysUntil(visit.whenIso, nowMs);
  const badge = days === null ? null : inDaysLabel(days);
  const when = visit.whenIso ? fmtDayTime(visit.whenIso, uiLang) : visit.when;
  return (
    <div
      data-testid="consult-visit-head"
      className="mb-5 flex items-start gap-3 rounded-[var(--r-lg)] border p-4"
      style={{ borderColor: "var(--arbor-rule)", background: "var(--arbor-paper-elevated)" }}
    >
      <span
        aria-hidden="true"
        className="flex-shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl"
        style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
      >
        <Icon name="event" size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="t-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.consult.visit.kicker")}</p>
        <p className="t-base font-extrabold leading-snug" style={{ color: "var(--arbor-ink)" }}>{appointmentRoleLabel(visit, t)}</p>
        {when && <p className="t-sm" style={{ color: "var(--arbor-ink-soft)" }}>{when}</p>}
      </div>
      {badge && (
        <span
          data-testid="consult-visit-in"
          className="flex-shrink-0 rounded-full px-3 py-1 t-xs font-bold whitespace-nowrap"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
        >
          {t(badge.key, badge.vars)}
        </span>
      )}
    </div>
  );
}
