import React from "react";
import TopbarKidSwitcher from "./TopbarKidSwitcher";
import TopbarSearch from "../search/TopbarSearch";
import TopbarBell from "./TopbarBell";
import KidModeButton from "./KidModeButton";
import AskArborButton from "./AskArborButton";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { sectionForTab } from "../../lib/navigation";

/**
 * AP-044: Desktop topbar placeholder bar.
 *
 * Rendered above the main content area on md+ viewports. Hidden on mobile
 * (the mobile brand header inside the main scroll column covers that role,
 * and compact KidModeButton / AskArborButton entries live in the in-content
 * accessories row so mobile users can still reach both).
 *
 * UC-1 left zone = a true page TITLE + SUBTITLE stack keyed off the active
 * section (nav.title.* / nav.sub.*) — the topbar now tells you WHERE you are
 * and what the view is for, on the design's sapphire-tinted band.
 *
 * Right zone (UC-1 order): search field → notification bell → child switcher
 * (with name). Ask Arbor + Kid Mode stay mounted (both routes valid; Kid Mode
 * is out-of-scope visually but the entry survives).
 *
 * All tokens are sourced from index.css; no raw hex values.
 */
export default function Topbar() {
  const { activeTab, childProfile } = useArbor();
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

      {/* Right zone (UC-1 order): search → bell → child switcher.
          Ask Arbor + Kid Mode stay mounted as secondary entries. */}
      <div className="hidden lg:flex min-w-0 flex-shrink-0 items-center gap-2.5">
        <div className="hidden 2xl:block">
          <AskArborButton />
        </div>
        <div className="hidden 2xl:block">
          <KidModeButton />
        </div>
        {/* Search slot — AP-045 */}
        <div className="hidden xl:block">
          <TopbarSearch />
        </div>
        {/* Notification bell slot — AP-046 */}
        <TopbarBell />
        {/* Kid-switcher slot — AP-047 (now carries the child name) */}
        <TopbarKidSwitcher />
      </div>
    </header>
  );
}
