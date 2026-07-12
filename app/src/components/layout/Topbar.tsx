import React from "react";
import TopbarKidSwitcher from "./TopbarKidSwitcher";
import TopbarSearch from "../search/TopbarSearch";
import TopbarBell from "./TopbarBell";
import KidModeButton from "./KidModeButton";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { sectionForTab } from "../../lib/navigation";

/**
 * Desktop topbar — the wireframe's lean control band (md+). Hidden on mobile,
 * where the in-content accessories strip + bottom MobileNav cover the same jobs.
 *
 * Left zone = page TITLE + SUBTITLE keyed off the active section (nav.title.* /
 * nav.sub.*): the topbar tells you WHERE you are, on the sapphire-tinted band.
 *
 * Right zone mirrors the wireframe: search field → Kid Mode → "how Arbor helps"
 * rail toggle → notification bell → child switcher. Ask Arbor is a first-class
 * sidebar nav row, so it is NOT duplicated here (removed the redundant topbar
 * button). The AI rail is off by default; this toggle is its single, discoverable
 * desktop entry point. All tokens are sourced from index.css; no raw hex.
 */
export default function Topbar() {
  const { activeTab, childProfile, showAiRail, setShowAiRail } = useArbor();
  const { t } = useLanguage();
  const section = sectionForTab(activeTab);

  return (
    <header
      className="hidden md:flex items-center gap-4 px-5 xl:px-7 flex-none min-w-0"
      style={{
        height: "74px",
        background: "var(--arbor-topbar-band)",
        borderBottom: "1px solid var(--arbor-rule)",
      }}
      aria-label={t("aria.applicationTopbar")}
    >
      {/* Left zone: page title + subtitle stack (orientation) */}
      <div className="flex flex-col justify-center flex-1 min-w-0">
        <span
          className="text-[18px] font-extrabold leading-tight truncate"
          style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
        >
          {t("nav.title." + section.id)}
        </span>
        <span className="text-[12px] truncate" style={{ color: "var(--arbor-muted)" }}>
          {t("nav.sub." + section.id, { name: childProfile.name })}
        </span>
      </div>

      {/* Right zone: lean desktop control band (search → Kid Mode → rail toggle →
          bell → child switcher). Ask Arbor lives in the sidebar, not here. */}
      <div className="flex min-w-0 flex-shrink-0 items-center gap-2.5">
        <div className="hidden md:block">
          <TopbarSearch />
        </div>
        <div className="hidden lg:block">
          <KidModeButton />
        </div>
        <button
          onClick={() => setShowAiRail(!showAiRail)}
          aria-label={t("top.howHelps")}
          aria-pressed={showAiRail}
          title={t("top.howHelps")}
          className="hidden xl:inline-flex items-center justify-center w-11 h-11 rounded-xl transition flex-shrink-0"
          style={showAiRail
            ? { background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }
            : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="verified_user" size={18} />
        </button>
        <TopbarBell />
        <TopbarKidSwitcher />
      </div>
    </header>
  );
}
