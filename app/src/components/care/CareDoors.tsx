import React from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { homeForTab } from "../../lib/companionPlaces";
import { sectionForTab } from "../../lib/navigation";
import type { ActiveTab } from "../../lib/routes";

/* v3 EXTRA-CARE — the Care landing's doors: the three Care pages a parent
   opens from here (School brief, Appointments, Care summary), each an
   existing internal route that belongs to the Care door (homeForTab), with
   the glyph its pill already carries. Never a professional directory and
   never a way to find or contact someone new (B-CAREPRO-19). The trust line
   closes the module. */

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

export default function CareDoors() {
  const { setActiveTab } = useArbor();
  const { t } = useLanguage();
  const doors = careDoors();
  return (
    <nav data-module="consult-doors" aria-label={t("elev.consult.doors.label")} className="min-w-0 min-[1600px]:col-span-2 flex flex-col gap-3">
      <ul className="grid gap-3 sm:grid-cols-3">
        {doors.map((door) => (
          <li key={door.tab} className="min-w-0">
            <button
              type="button"
              data-testid="care-door"
              data-door={door.tab}
              onClick={() => setActiveTab(door.tab)}
              className="w-full h-full flex items-center gap-3 rounded-[var(--r-lg)] border p-4 min-h-[44px] text-start transition hover:brightness-[0.98]"
              style={{ borderColor: "var(--arbor-rule)", background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" }}
            >
              <span aria-hidden="true" className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: "var(--arbor-paper-deep)" }}>
                <Icon name={door.icon} size={20} />
              </span>
              <span className="min-w-0 flex-1 flex flex-col">
                <span className="t-sm font-extrabold">{t(door.titleKey)}</span>
                <span className="t-xs leading-snug" style={{ color: "var(--arbor-muted)" }}>{t(door.subKey)}</span>
              </span>
              <Icon name="arrow_forward" size={18} className="flex-shrink-0 rtl:-scale-x-100" />
            </button>
          </li>
        ))}
      </ul>
      <p data-testid="consult-trust-line" className="flex items-start gap-2 t-xs leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>
        <Icon name="verified_user" size={16} className="flex-shrink-0 mt-px" />
        <span>{t("elev.consult.trust")}</span>
      </p>
    </nav>
  );
}
