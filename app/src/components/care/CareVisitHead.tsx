import React from "react";
import { Icon } from "../ui/Icon";
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
   v3 F-CARE-1 (mock :335, phone :728): a glyph blob, the kicker, ONE title
   line "{who} · {when}", and the day count as a sky chip from sm (under the
   title on a phone). With no booked visit the head says so; the steps still
   follow, so a parent can prepare without a booking. */

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

/** v3 F-CARE-1: the Care landing's glyph blob (the mock's soft shape, filled
 *  from the palette). Decorative: the text next to it carries the meaning. */
export function CareGlyph({ icon, tone = "sky", size = "md", className = "inline-flex" }: { icon: string; tone?: "sky" | "peach"; size?: "sm" | "md" | "lg"; className?: string }) {
  const box = size === "lg" ? "w-11 h-11 sm:w-[52px] sm:h-[52px]" : size === "md" ? "w-10 h-10" : "w-9 h-9";
  const glyph = size === "lg" ? 26 : size === "md" ? 21 : 19;
  return (
    <span aria-hidden="true" className={`relative flex-shrink-0 items-center justify-center ${box} ${className}`}>
      <span
        className="absolute inset-0"
        style={{
          background: tone === "peach"
            ? "linear-gradient(135deg, var(--arbor-peach-wash), var(--arbor-peach))"
            : "linear-gradient(135deg, var(--arbor-sky), var(--arbor-clay))",
          borderRadius: tone === "peach" ? "50% 50% 14% 14% / 50% 50% 10% 10%" : "62% 38% 60% 40% / 40% 60% 40% 60%",
        }}
      />
      <Icon name={icon} size={glyph} fill={1} className="relative" style={{ color: "var(--arbor-on-accent)" }} />
    </span>
  );
}

export default function CareVisitHead({ visit, nowMs = Date.now() }: { visit: Appointment | null; nowMs?: number }) {
  const { t, uiLang } = useLanguage();
  const days = visit ? daysUntil(visit.whenIso, nowMs) : null;
  const badge = days === null ? null : inDaysLabel(days);
  const when = visit ? (visit.whenIso ? fmtDayTime(visit.whenIso, uiLang) : visit.when) : "";
  const role = visit ? appointmentRoleLabel(visit, t) : "";
  const who = visit?.who?.trim() ?? "";
  // The person when the parent named one (the role then rides under it), else
  // the role; a typed name is isolated so it cannot reorder a Hebrew line.
  const title = !visit ? t("elev.consult.visit.none") : <>{who ? <bdi>{who}</bdi> : role}{when ? ` · ${when}` : ""}</>;
  return (
    <div data-testid="consult-visit-head" data-visit={visit ? "booked" : "none"} className="flex items-center gap-3 sm:gap-3.5">
      <CareGlyph icon="event" size="lg" />
      <div className="min-w-0 flex-1">
        <p className="t-xs font-bold" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.consult.visit.kicker")}</p>
        <p className="arbor-type-title leading-snug" style={{ color: "var(--arbor-ink)" }}>{title}</p>
        {who && role && <p className="t-xs" style={{ color: "var(--arbor-ink-soft)" }}>{role}</p>}
        {badge && <p className="sm:hidden t-xs font-bold mt-0.5" style={{ color: "var(--arbor-sky-ink)" }}>{t(badge.key, badge.vars)}</p>}
      </div>
      {badge && (
        <span
          className="hidden sm:inline-flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1 t-xs font-bold whitespace-nowrap"
          style={{ background: "var(--arbor-sky-wash)", color: "var(--arbor-sky-ink)" }}
        >
          <Icon name="schedule" size={15} />
          <span data-testid="consult-visit-in">{t(badge.key, badge.vars)}</span>
        </span>
      )}
    </div>
  );
}
