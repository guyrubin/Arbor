import React from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SECTIONS, sectionForTab, primaryTabOf } from "../../lib/navigation";

/** Bottom tab bar shown on mobile (< md) — the six primary sections. */
export default function MobileNav() {
  const { activeTab, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const activeSectionId = sectionForTab(activeTab).id;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex bg-white"
      style={{ borderTop: "1px solid var(--arbor-rule)", boxShadow: "0 -4px 16px rgba(41,51,63,0.04)" }}
    >
      {SECTIONS.map((sec) => {
        const on = sec.id === activeSectionId;
        const Icon = sec.icon;
        return (
          <button
            key={sec.id}
            onClick={() => setActiveTab(primaryTabOf(sec))}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[9.5px] font-bold transition"
            style={{ color: on ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}
          >
            <Icon className="w-[18px] h-[18px]" />
            {t("nav.short." + sec.id)}
          </button>
        );
      })}
    </nav>
  );
}
