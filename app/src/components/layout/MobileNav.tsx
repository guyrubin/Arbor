import React from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { COMPANION_PLACES, placeForTab } from "../../lib/companionPlaces";
import { Icon } from "../ui/Icon";
import { selectionHaptic } from "../../lib/native";
import { requestOpenSettings } from "./settingsBus";

/** Three places, one conversation door; settings never become a fourth place. */
export default function MobileNav() {
  const { activeTab, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const activePlace = placeForTab(activeTab).id;
  return <nav aria-label={t("elev.sidebar.nav.aria")}
    className="arbor-chrome-glass lg:hidden fixed bottom-0 inset-x-0 z-40 flex"
    style={{ borderTop: "1px solid var(--arbor-rule)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
    {COMPANION_PLACES.map(place => {
      const active = activePlace === place.id && activeTab !== "coach";
      return <button key={place.id} onClick={() => { void selectionHaptic(); setActiveTab(place.tab); }}
        aria-current={active ? "page" : undefined}
        className="min-h-[64px] min-w-0 flex-1 flex flex-col items-center justify-center gap-1 px-1 text-[12px] font-bold"
        style={{ color: active ? "var(--arbor-clay-deep)" : "var(--arbor-muted)" }}>
        <Icon name={place.icon} size={23} chrome active={active}/>{he ? place.he : place.en}
      </button>;
    })}
    <button onClick={() => { void selectionHaptic(); setActiveTab("coach"); }} aria-current={activeTab === "coach" ? "page" : undefined}
      className="min-h-[64px] min-w-0 flex-1 flex flex-col items-center justify-center gap-1 px-1 text-[12px] font-bold"
      style={{ color: activeTab === "coach" ? "var(--arbor-clay-deep)" : "var(--arbor-muted)" }}>
      <Icon name="forum" size={23} chrome active={activeTab === "coach"}/>{he ? "לדבר" : "Talk"}
    </button>
    <button onClick={() => requestOpenSettings()} aria-label={t("aria.settings")} className="min-h-[64px] w-11 shrink-0 flex items-center justify-center" style={{ color: "var(--arbor-muted)" }}>
      <Icon name="settings" size={21}/>
    </button>
  </nav>;
}
